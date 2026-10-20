'use strict';
/* Anonymer Check-in beim Lizenzserver: gemeinsam für alle Aura-Produkte (AuraPlan, AuraTicket, AuraMail, AuraDirect, AuraProxy, AuraControl).
 *
 * Was gesendet wird (alle 12 Stunden, kurz nach dem Start zum ersten Mal): eine zufällige Installations-Kennung, das Produkt, seine Version, die Version der
 * Aura-Suite, der Zustand (trial / free / licensed / expired), die Zahl der Konten und, falls vorhanden, der Lizenzschlüssel. KEINE Namen, KEINE Inhalte.
 * Der Lizenzserver speichert die IP-Adresse nicht (nur eine grobe Ortsbestimmung auf Stadt-Ebene für die Weltkarte).
 *
 * Nicht abschaltbar (Entscheidung des Herstellers): ein leerer oder ungültiger LICENSE_CHECKIN_HOST ergibt den Standard-Lizenzserver. Ein ANDERER Rechner
 * (eigener Lizenzserver, z. B. eines Resellers) ist weiterhin möglich.
 *
 * Aus der Antwort wird nur die Aura-Suite-Version übernommen (streng geprüft) und im Datenordner gespeichert: sie erscheint unter "Über Aura-Suite". */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const CHECKIN_PORT = 8451;                          // fester Port des Lizenzserver-Containers
const DEFAULT_CHECKIN_HOST = 'auralic.gerber-backoffice-solutions.com';
const SUITE_VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/;
const STATES = ['trial', 'free', 'licensed', 'expired'];
const PRODUCTS = ['chat', 'call', 'plan', 'ticket', 'mail', 'direct', 'proxy', 'control'];

// Domain oder IP, mit oder ohne http(s)://, mit oder ohne Port: es zählt nur der Rechnername, der Port ist fest. Leer oder ungültig = Standard (nicht abschaltbar).
function buildCheckinBaseUrl(raw) {
    let host = String(raw === undefined || raw === null ? '' : raw).trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host)) host = DEFAULT_CHECKIN_HOST;
    return `http://${host}:${CHECKIN_PORT}`;
}
// Aura-Suite-Angaben vom Lizenzserver: streng geprüft, bevor sie gespeichert oder angezeigt werden (Version, Datum, kurzer Hinweis ohne Sonderzeichen)
function parseSuiteInfo(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const version = typeof raw.version === 'string' ? raw.version.trim() : ''; if (!SUITE_VERSION_RE.test(version)) return null;
    let date = null; if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) { const d = new Date(raw.date + 'T00:00:00Z'); if (!isNaN(d) && d.toISOString().slice(0, 10) === raw.date) date = raw.date; }
    const note = typeof raw.note === 'string' ? raw.note.replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    return { version, date, note };
}
// true, wenn a älter ist als b (Zahlen mit Punkten)
function versionOlder(a, b) {
    if (!SUITE_VERSION_RE.test(String(a)) || !SUITE_VERSION_RE.test(String(b))) return false;
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] || 0, q = y[i] || 0; if (p < q) return true; if (p > q) return false; }
    return false;
}
const count = (v) => (Number.isInteger(v) && v >= 0 && v <= 1000000 ? v : null);

function createSuitePing(opts = {}) {
    const o = { firstDelayMs: 30000, everyMs: 12 * 60 * 60 * 1000, retryDelays: [5 * 60000, 30 * 60000, 2 * 3600000], timeoutMs: 10000, now: () => Date.now(), fetchImpl: globalThis.fetch, setTimeoutImpl: setTimeout, clearTimeoutImpl: clearTimeout, ...opts };
    if (!PRODUCTS.includes(o.product)) throw new Error('suite-ping: unbekanntes Produkt');
    const baseUrl = buildCheckinBaseUrl(o.host), idFile = o.dataDir ? path.join(o.dataDir, 'installation-id') : null, suiteFile = o.dataDir ? path.join(o.dataDir, 'suite-latest.json') : null;
    let cachedId = null, suite = null, lastResult = null, timer = null, stopped = false;

    // Zufällige, dauerhafte Kennung (im Datenordner): sie hängt an keiner Hardware und keiner Person. Lässt sich nicht schreiben, gilt eine Kennung bis zum Neustart.
    function installationId() {
        if (cachedId) return cachedId;
        try { const v = idFile && fs.readFileSync(idFile, 'utf8').trim(); if (/^[0-9a-f-]{36}$/.test(v || '')) return (cachedId = v); } catch (e) { /* neu anlegen */ }
        cachedId = crypto.randomUUID();
        try { if (idFile) fs.writeFileSync(idFile, cachedId + '\n', { mode: 0o600 }); } catch (e) { /* nur im Speicher */ }
        return cachedId;
    }
    function loadSuite() { try { suite = suiteFile ? parseSuiteInfo(JSON.parse(fs.readFileSync(suiteFile, 'utf8'))) : null; } catch (e) { suite = null; } }
    function setSuite(info) {
        suite = info || null;
        try { if (suiteFile) { if (suite) fs.writeFileSync(suiteFile, JSON.stringify(suite)); else if (fs.existsSync(suiteFile)) fs.unlinkSync(suiteFile); } } catch (e) { /* nur im Speicher */ }
    }
    async function safe(fn, fallback) { try { const v = await fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }

    async function ping() {
        const state = await safe(o.getState, null), counts = (await safe(o.getCounts, null)) || {}, key = await safe(o.getLicenseKey, null);
        const body = { licenseKey: typeof key === 'string' && key ? key : null, installationId: installationId(), product: o.product, version: String(o.version || ''), suiteInstalled: SUITE_VERSION_RE.test(String(o.suiteInstalled || '')) ? String(o.suiteInstalled) : null,
            state: STATES.includes(state) ? state : null, totalUsers: count(counts.totalUsers), totalAdmins: count(counts.totalAdmins) };
        try {
            const resp = await o.fetchImpl(`${baseUrl}/api/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(o.timeoutMs) });
            const data = await resp.json().catch(() => ({}));
            // Nur eine echte Antwort des Lizenzservers ({ ok: true, ... }) ändert die Anzeige; fehlt die Version darin (oder ist sie ungültig), entfällt sie.
            // Eine Antwort mit 200 und anderem Inhalt (z. B. eine Anmeldeseite im Hotel-WLAN) lässt die gespeicherte Anzeige unberührt.
            if (resp.ok && data && data.ok === true) setSuite(parseSuiteInfo(data.suite));
            lastResult = { success: !!resp.ok, status: resp.status, retryable: !resp.ok && resp.status >= 500, at: new Date(o.now()).toISOString() };
        } catch (err) { lastResult = { success: false, status: 0, retryable: true, at: new Date(o.now()).toISOString() }; }
        return lastResult;
    }
    // Kurz nach dem Start, danach alle 12 Stunden; bei vorübergehenden Störungen mit wenigen Wiederholungen (5 Min, 30 Min, 2 Std)
    function schedule(ms, attempt) { if (stopped) return; timer = o.setTimeoutImpl(() => run(attempt), ms); if (timer && timer.unref) timer.unref(); }
    async function run(attempt = 0) {
        if (stopped) return; await ping();
        if (lastResult && !lastResult.success && lastResult.retryable && attempt < o.retryDelays.length) schedule(o.retryDelays[attempt], attempt + 1);
        else schedule(o.everyMs, 0);
    }
    loadSuite();
    return { installationId, suite: () => suite, status: () => ({ host: baseUrl.replace(/^http:\/\//, '').replace(/:\d+$/, ''), lastResult }), ping,
        start() { stopped = false; if (timer) o.clearTimeoutImpl(timer); schedule(o.firstDelayMs, 0); }, stop() { stopped = true; if (timer) o.clearTimeoutImpl(timer); timer = null; } };
}
module.exports = { createSuitePing, buildCheckinBaseUrl, parseSuiteInfo, versionOlder, DEFAULT_CHECKIN_HOST, CHECKIN_PORT, SUITE_VERSION_RE, STATES, PRODUCTS };
