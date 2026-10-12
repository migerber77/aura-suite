'use strict';
// =====================================================================================================
// AuraChat Cockpit-Agent
//
// Ein kleiner, eigener Dienst, der als EINZIGER auf Docker schaut und den Zustand des Servers einsammelt:
// Docker-Container, Arbeitsspeicher, Prozessor, Speicherplatz, Schwachstellen-Berichte und offene Updates.
// Das AuraChat-Backend (von aussen erreichbar) bekommt NIE Zugriff auf Docker, sondern fragt nur diesen Agenten.
//
// Sicherheit:
//  - Nur LESEN. Es werden ausschliesslich fest eingebaute GET-Abfragen an Docker gestellt (siehe ERLAUBT unten).
//    Nicht dabei: Einzelheiten eines Containers (dort stehen die Umgebungsvariablen mit Geheimnissen), Protokolle,
//    Dateizugriff, Starten/Stoppen.
//  - Jede Abfrage an den Agenten braucht ein Passwort (Token), das er beim ersten Start selbst erzeugt und in
//    /shared/token ablegt; nur das Backend und der Scanner bekommen dieses Verzeichnis zu sehen.
//  - Der Agent hat keinen Port nach aussen und liegt in einem eigenen, internen Docker-Netz.
// Ohne Abhängigkeiten (nur Node.js).
// =====================================================================================================
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const CONFIG = {
    port: Number(process.env.COCKPIT_PORT) || 3600,
    socket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    procDir: process.env.COCKPIT_PROC || '/proc',
    tokenFile: process.env.COCKPIT_TOKEN_FILE || '/shared/token',
    reportsDir: process.env.COCKPIT_REPORTS || '/reports',
    hostCheckFile: process.env.COCKPIT_HOSTCHECK || '/hostcheck/host-status.json',
    diskPath: process.env.COCKPIT_DISK_PATH || '/',
    scanScript: process.env.COCKPIT_SCAN_SCRIPT || path.join(__dirname, 'scan.sh'),
    snapshotCacheMs: 4000,
    dfCacheMs: 120000,
    dockerTimeoutMs: 5000,
    statsTimeoutMs: 6000,
    statsConcurrency: 6,
    maxReportBytes: 40 * 1024 * 1024,
    maxReportFiles: 100
};

// ---------- Docker (nur lesend, nur fest eingebaute Abfragen) ----------
const ERLAUBT = [
    /^\/info$/,
    /^\/version$/,
    /^\/containers\/json\?all=1$/,
    /^\/containers\/[0-9a-f]{12,64}\/stats\?stream=false$/,
    /^\/system\/df$/,
    /^\/images\/json$/
];
const isAllowedDockerPath = (p) => typeof p === 'string' && ERLAUBT.some(rx => rx.test(p));

function dockerGet(apiPath, timeoutMs = CONFIG.dockerTimeoutMs) {
    return new Promise((resolve, reject) => {
        if (!isAllowedDockerPath(apiPath)) return reject(new Error('Diese Docker-Abfrage ist nicht erlaubt.'));
        const req = http.request({ socketPath: CONFIG.socket, path: apiPath, method: 'GET', headers: { Host: 'docker' }, timeout: timeoutMs }, (res) => {
            let body = ''; let size = 0;
            res.setEncoding('utf8');
            res.on('data', (chunk) => { size += chunk.length; if (size > 30 * 1024 * 1024) return req.destroy(new Error('Docker-Antwort zu gross')); body += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 400) return reject(new Error(`Docker meldet Status ${res.statusCode}`));
                try { resolve(JSON.parse(body)); } catch { reject(new Error('Die Antwort von Docker ist nicht lesbar')); }
            });
        });
        req.on('timeout', () => req.destroy(new Error('Docker antwortet nicht (Zeitlimit)')));
        req.on('error', (err) => reject(err.code === 'ENOENT' || err.code === 'ECONNREFUSED' ? new Error('Der Docker-Zugang (Socket) fehlt oder ist nicht erreichbar') : err));
        req.end();
    });
}

// ---------- Auswertung (reine Funktionen, einzeln testbar) ----------
function parseMeminfo(text) {
    const kb = {};
    String(text || '').split('\n').forEach(line => { const m = line.match(/^(\w+):\s+(\d+)/); if (m) kb[m[1]] = Number(m[2]) * 1024; });
    const total = kb.MemTotal || 0;
    const available = kb.MemAvailable !== undefined ? kb.MemAvailable : (kb.MemFree || 0) + (kb.Buffers || 0) + (kb.Cached || 0);
    const used = Math.max(0, total - available);
    const swapTotal = kb.SwapTotal || 0, swapUsed = Math.max(0, swapTotal - (kb.SwapFree || 0));
    return { totalBytes: total, availableBytes: available, usedBytes: used, percent: total ? round1(used / total * 100) : 0, swapTotalBytes: swapTotal, swapUsedBytes: swapUsed };
}
const round1 = (n) => Math.round(n * 10) / 10;
function parseLoadavg(text) { const p = String(text || '').trim().split(/\s+/).slice(0, 3).map(Number); return p.length === 3 && p.every(Number.isFinite) ? p : null; }
function parseUptime(text) { const n = parseFloat(String(text || '').split(/\s+/)[0]); return Number.isFinite(n) ? Math.round(n) : null; }
function parseCpuStat(text) {
    const line = String(text || '').split('\n').find(l => /^cpu\s/.test(l));
    if (!line) return null;
    const f = line.trim().split(/\s+/).slice(1).map(Number);
    if (f.length < 4 || f.some(x => !Number.isFinite(x))) return null;
    const idle = f[3] + (f[4] || 0);
    const total = f.slice(0, 8).reduce((a, b) => a + b, 0);
    return { idle, total };
}
function cpuPercentBetween(prev, cur) {
    if (!prev || !cur) return null;
    const dTotal = cur.total - prev.total, dIdle = cur.idle - prev.idle;
    if (dTotal <= 0) return null;
    return Math.min(100, Math.max(0, round1((1 - dIdle / dTotal) * 100)));
}
function containerCpuPercent(stats) {
    try {
        const cpu = stats.cpu_stats, pre = stats.precpu_stats;
        const dCpu = cpu.cpu_usage.total_usage - (pre.cpu_usage ? pre.cpu_usage.total_usage : 0);
        const dSys = (cpu.system_cpu_usage || 0) - (pre.system_cpu_usage || 0);
        const n = cpu.online_cpus || (cpu.cpu_usage.percpu_usage ? cpu.cpu_usage.percpu_usage.length : 1) || 1;
        if (!(dSys > 0) || dCpu < 0) return null;
        return round1(dCpu / dSys * n * 100);
    } catch { return null; }
}
function containerMemory(stats) {
    try {
        const m = stats.memory_stats; if (!m || typeof m.usage !== 'number') return { usedBytes: null, limitBytes: null };
        const s = m.stats || {};
        const cache = s.inactive_file !== undefined ? s.inactive_file : (s.total_inactive_file !== undefined ? s.total_inactive_file : (s.cache || 0));
        return { usedBytes: Math.max(0, m.usage - cache), limitBytes: typeof m.limit === 'number' ? m.limit : null };
    } catch { return { usedBytes: null, limitBytes: null }; }
}
function healthFromStatus(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('(unhealthy)')) return 'unhealthy';
    if (s.includes('(healthy)')) return 'healthy';
    if (s.includes('health: starting')) return 'starting';
    return 'none';
}
function normalizeContainer(c) {
    const labels = c.Labels || {};
    const name = String((c.Names && c.Names[0]) || String(c.Id || '').slice(0, 12)).replace(/^\//, '');
    return {
        id: String(c.Id || '').slice(0, 12), fullId: String(c.Id || ''), name, image: String(c.Image || ''),
        state: String(c.State || ''), status: String(c.Status || ''), health: healthFromStatus(c.Status),
        project: labels['com.docker.compose.project'] || '', service: labels['com.docker.compose.service'] || '',
        createdAt: Number.isFinite(c.Created) ? new Date(c.Created * 1000).toISOString() : null
    };
}
function summarizeDf(df) {
    const sum = (arr, f) => (Array.isArray(arr) ? arr.reduce((a, x) => a + Math.max(0, Number(f(x)) || 0), 0) : 0);
    const cache = Array.isArray(df.BuildCache) ? df.BuildCache : [];
    return {
        imagesBytes: Math.max(0, Number(df.LayersSize) || sum(df.Images, i => i.Size)),
        containersBytes: sum(df.Containers, c => c.SizeRw),
        volumesBytes: sum(df.Volumes, v => v.UsageData && v.UsageData.Size),
        buildCacheBytes: sum(cache, b => b.Size),
        buildCacheReclaimableBytes: sum(cache.filter(b => b.InUse === false), b => b.Size)
    };
}
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
function summarizeTrivyReport(json, fallbackName, fallbackTime) {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    const all = [];
    const results = Array.isArray(json && json.Results) ? json.Results : [];
    for (const r of results) for (const v of (Array.isArray(r.Vulnerabilities) ? r.Vulnerabilities : [])) {
        const sev = SEVERITIES.includes(String(v.Severity).toUpperCase()) ? String(v.Severity).toUpperCase() : 'UNKNOWN';
        counts[sev]++;
        all.push({ id: String(v.VulnerabilityID || ''), pkg: String(v.PkgName || ''), installed: String(v.InstalledVersion || ''), fixed: String(v.FixedVersion || ''), severity: sev, title: String(v.Title || '').slice(0, 110) });
    }
    all.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0));
    const when = json && (json.CreatedAt || json.createdAt);
    return { image: String((json && json.ArtifactName) || fallbackName), scannedAt: when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : fallbackTime, counts, fixable: all.filter(v => v.fixed).length, critFixable: all.filter(v => v.fixed && v.severity === 'CRITICAL').length, highFixable: all.filter(v => v.fixed && v.severity === 'HIGH').length, top: all.slice(0, 5) };
}
function readVulnReports(dir) {
    let files = [];
    try { files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('.')).slice(0, CONFIG.maxReportFiles); } catch { return { configured: false, images: [], totals: null, oldestScan: null }; }
    const images = [];
    for (const f of files) {
        try {
            const full = path.join(dir, f); const st = fs.statSync(full);
            if (!st.isFile() || st.size > CONFIG.maxReportBytes) continue;
            images.push(summarizeTrivyReport(JSON.parse(fs.readFileSync(full, 'utf8')), f.replace(/\.json$/, ''), st.mtime.toISOString()));
        } catch { /* kaputte Datei: überspringen */ }
    }
    if (!images.length) return { configured: files.length > 0, images: [], totals: null, oldestScan: null };
    // fixable = alle Stufen mit Korrektur; critFixable/highFixable = nur kritische bzw. hohe, die sich durch Aktualisieren beheben lassen
    const totals = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0, fixable: 0, critFixable: 0, highFixable: 0 };
    images.forEach(i => { SEVERITIES.forEach(s => { totals[s] += i.counts[s]; }); totals.fixable += i.fixable; totals.critFixable += i.critFixable; totals.highFixable += i.highFixable; });
    images.sort((a, b) => (b.counts.CRITICAL - a.counts.CRITICAL) || (b.counts.HIGH - a.counts.HIGH) || a.image.localeCompare(b.image));
    return { configured: true, images, totals, oldestScan: images.map(i => i.scannedAt).sort()[0] };
}
function readHostUpdates(file) {
    try {
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
        return { configured: true, checkedAt: j.updatedAt && !Number.isNaN(Date.parse(j.updatedAt)) ? new Date(j.updatedAt).toISOString() : null, upgradable: n(j.upgradable), securityUpgradable: n(j.securityUpgradable), rebootRequired: j.rebootRequired === true,
            packages: (Array.isArray(j.securityPackages) ? j.securityPackages : []).slice(0, 10).map(p => ({ name: String(p.name || '').slice(0, 80), version: String(p.version || '').slice(0, 60) })), os: String(j.os || '').slice(0, 80), kernel: String(j.kernel || '').slice(0, 60) };
    } catch { return { configured: false }; }
}

// ---------- Einsammeln ----------
let lastCpuSample = null;
const readProc = (name) => { try { return fs.readFileSync(path.join(CONFIG.procDir, name), 'utf8'); } catch { return ''; } };
async function sampleCpuPercent() {
    const now = { ...parseCpuStat(readProc('stat')), at: Date.now() };
    if (!now.total) return null;
    let prev = lastCpuSample;
    if (!prev || now.at - prev.at < 1000 || now.at - prev.at > 120000) { // keine brauchbare frühere Messung: kurz zweimal messen
        prev = now; await new Promise(r => setTimeout(r, 400));
        const second = { ...parseCpuStat(readProc('stat')), at: Date.now() };
        lastCpuSample = second;
        return cpuPercentBetween(prev, second);
    }
    lastCpuSample = now;
    return cpuPercentBetween(prev, now);
}
function diskInfo() {
    try {
        const s = fs.statfsSync(CONFIG.diskPath);
        const total = s.blocks * s.bsize, free = s.bavail * s.bsize, used = (s.blocks - s.bfree) * s.bsize;
        return { path: CONFIG.diskPath, totalBytes: total, usedBytes: used, freeBytes: free, percent: used + free ? round1(used / (used + free) * 100) : 0 };
    } catch { return null; }
}
const cache = { snapshot: null, snapshotAt: 0, pending: null, df: null, dfAt: 0, images: null, imagesAt: 0 };
async function mapLimit(items, limit, fn) {
    const out = new Array(items.length); let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]); } }));
    return out;
}
async function collectDocker() {
    const result = { available: false, error: null, version: null, containersTotal: 0, containersRunning: 0, imagesCount: 0, rootDir: null, usage: null, containers: [], host: null };
    try {
        const [info, list] = await Promise.all([dockerGet('/info'), dockerGet('/containers/json?all=1')]);
        result.available = true; result.version = info.ServerVersion || null; result.rootDir = info.DockerRootDir || null; result.imagesCount = info.Images || 0;
        result.host = { name: info.Name || null, os: info.OperatingSystem || null, kernel: info.KernelVersion || null, cpuCount: info.NCPU || null, memTotalBytes: info.MemTotal || null };
        const containers = (Array.isArray(list) ? list : []).map(normalizeContainer);
        result.containersTotal = containers.length; result.containersRunning = containers.filter(c => c.state === 'running').length;
        const running = containers.filter(c => c.state === 'running');
        const stats = await mapLimit(running, CONFIG.statsConcurrency, async (c) => { try { return await dockerGet(`/containers/${c.fullId}/stats?stream=false`, CONFIG.statsTimeoutMs); } catch { return null; } });
        running.forEach((c, i) => { const s = stats[i]; if (s) { c.cpuPercent = containerCpuPercent(s); const m = containerMemory(s); c.memoryBytes = m.usedBytes; c.memoryLimitBytes = m.limitBytes; } });
        containers.forEach(c => { if (c.cpuPercent === undefined) { c.cpuPercent = null; c.memoryBytes = null; c.memoryLimitBytes = null; } delete c.fullId; });
        containers.sort((a, b) => (a.state === 'running') - (b.state === 'running') || a.name.localeCompare(b.name));
        result.containers = containers;
        if (!cache.df || Date.now() - cache.dfAt > CONFIG.dfCacheMs) { try { cache.df = summarizeDf(await dockerGet('/system/df', 20000)); cache.dfAt = Date.now(); } catch { /* alte Werte behalten */ } }
        result.usage = cache.df;
    } catch (err) { result.error = err.message; }
    return result;
}
async function buildSnapshot() {
    const [docker, cpuPercent] = await Promise.all([collectDocker(), sampleCpuPercent()]);
    const mem = parseMeminfo(readProc('meminfo'));
    const load = parseLoadavg(readProc('loadavg'));
    const dh = docker.host || {};
    return {
        generatedAt: new Date().toISOString(),
        host: {
            hostname: dh.name || os.hostname(), os: dh.os || null, kernel: dh.kernel || null,
            uptimeSeconds: parseUptime(readProc('uptime')), cpuCount: dh.cpuCount || os.cpus().length || null,
            load, cpuPercent, memory: mem, disk: diskInfo()
        },
        docker: { available: docker.available, error: docker.error, version: docker.version, containersTotal: docker.containersTotal, containersRunning: docker.containersRunning, imagesCount: docker.imagesCount, rootDir: docker.rootDir, usage: docker.usage, containers: docker.containers },
        vulnerabilities: readVulnReports(CONFIG.reportsDir),
        hostUpdates: readHostUpdates(CONFIG.hostCheckFile)
    };
}
async function getSnapshot() {
    if (cache.snapshot && Date.now() - cache.snapshotAt < CONFIG.snapshotCacheMs) return cache.snapshot;
    if (!cache.pending) cache.pending = buildSnapshot().then(s => { cache.snapshot = s; cache.snapshotAt = Date.now(); return s; }).finally(() => { cache.pending = null; });
    return cache.pending;
}
async function imageList() {
    if (!cache.images || Date.now() - cache.imagesAt > 60000) {
        const arr = await dockerGet('/images/json');
        const names = new Set();
        (Array.isArray(arr) ? arr : []).forEach(i => (i.RepoTags || []).forEach(t => { if (t && t !== '<none>:<none>' && /^[\w.\-:/@]+$/.test(t)) names.add(t); }));
        cache.images = [...names].sort(); cache.imagesAt = Date.now();
    }
    return cache.images;
}

// ---------- Passwort (Token) ----------
function ensureToken() {
    try { const t = fs.readFileSync(CONFIG.tokenFile, 'utf8').trim(); if (/^[0-9a-f]{32,}$/i.test(t)) return t; } catch { /* noch keiner da */ }
    const token = crypto.randomBytes(24).toString('hex');
    fs.mkdirSync(path.dirname(CONFIG.tokenFile), { recursive: true });
    fs.writeFileSync(CONFIG.tokenFile, token, { mode: 0o600 });
    return token;
}
function tokenOk(header, token) {
    const m = /^Bearer (\S+)$/.exec(String(header || ''));
    if (!m) return false;
    const a = Buffer.from(m[1]), b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- HTTP ----------
function createServer(token) {
    return http.createServer(async (req, res) => {
        const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
        try {
            const url = new URL(req.url, 'http://x');
            if (url.pathname === '/health') return send(200, { ok: true });
            if (req.method !== 'GET') return send(405, { error: 'Nur GET.' });
            if (!tokenOk(req.headers.authorization, token)) return send(401, { error: 'Zugang verweigert.' });
            if (url.pathname === '/snapshot') return send(200, await getSnapshot());
            if (url.pathname === '/images.txt') return send(200, (await imageList()).join('\n') + '\n', 'text/plain');
            if (url.pathname === '/scan.sh') return send(200, fs.readFileSync(CONFIG.scanScript, 'utf8'), 'text/plain');
            send(404, { error: 'Unbekannter Pfad.' });
        } catch (err) { send(500, { error: err.message }); }
    });
}

if (require.main === module) {
    let token;
    try { token = ensureToken(); }
    catch (err) { // ohne Passwort wird NICHT gestartet (sonst läge der Dienst ungeschützt offen)
        console.error(`Cockpit-Agent: Das Zugangs-Passwort konnte nicht abgelegt werden (${err.message}). Der Dienst startet nicht ohne Passwort. Ist der Ordner ${path.dirname(CONFIG.tokenFile)} eingebunden und beschreibbar?`);
        process.exit(1);
    }
    createServer(token).listen(CONFIG.port, '0.0.0.0', () => console.log(`Cockpit-Agent läuft auf Port ${CONFIG.port} (Docker: ${CONFIG.socket})`));
}

module.exports = { CONFIG, isAllowedDockerPath, parseMeminfo, parseLoadavg, parseUptime, parseCpuStat, cpuPercentBetween, containerCpuPercent, containerMemory, healthFromStatus, normalizeContainer, summarizeDf, summarizeTrivyReport, readVulnReports, readHostUpdates, diskInfo, ensureToken, tokenOk, createServer, getSnapshot, dockerGet, _cache: cache, _resetCache: () => { cache.snapshot = null; cache.df = null; cache.images = null; lastCpuSample = null; } };
