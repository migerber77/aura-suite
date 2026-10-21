'use strict';
/* Gemeinsamer Baustein der Aura-Suite (in allen Node-Produkten gleich): Suite-Lizenz von AuraControl übernehmen.
 *
 * Die Suite-Lizenz (Business Solo / Business Advanced, Produkt "suite") wird EINMAL in AuraControl eingetragen. Jedes Produkt holt sie dort ab:
 *   GET <LICENSE_SYNC_URL>/api/license/suite-key   mit  Authorization: Bearer <HMAC-SHA256(LICENSE_SECRET, "aura-suite-license-sync")>
 * Antwort { key: "<Schlüssel>" } oder { key: null } (in AuraControl ist keine Suite-Lizenz eingetragen).
 *   - Gültiger Suite-Schlüssel, der sich vom gespeicherten unterscheidet: wird übernommen (Quelle "control").
 *   - key: null und die gespeicherte Lizenz kam von AuraControl: wird entfernt. In den Produkten selbst kann keine Lizenz mehr eingetragen werden;
 *     eine früher von Hand eingetragene bleibt gültig, bis AuraControl eine Suite-Lizenz liefert (dann wird sie ersetzt).
 *   - AuraControl nicht erreichbar oder Fehler: nichts ändert sich (die Lizenz wird offline geprüft und bleibt gültig).
 * Kurz nach dem Start und danach alle 15 Minuten. LICENSE_SYNC_URL leer setzen ("-") schaltet das Abholen ab.
 * Verwendung: const sync = require('./aura-license-sync').startLicenseSync({ product: 'plan', verify, getKey, setKey, getSource, setSource, log }); */
const crypto = require('crypto');

const SYNC_LABEL = 'aura-suite-license-sync';
const DEFAULT_URL = 'http://host.docker.internal:8000';   // AuraControl auf diesem Rechner (Container brauchen extra_hosts: host.docker.internal:host-gateway)

function syncToken(secret) { return secret ? crypto.createHmac('sha256', secret).update(SYNC_LABEL).digest('base64url') : ''; }
function payloadOf(key) { try { return JSON.parse(Buffer.from(String(key).split('.')[0], 'base64url').toString('utf8')); } catch { return null; } }
function resolveUrl(raw, fallback) {
    const v = String(raw === undefined || raw === null ? '' : raw).trim();
    if (v === '-' || v.toLowerCase() === 'off') return '';
    const u = v || fallback || DEFAULT_URL;
    return /^https?:\/\/[A-Za-z0-9.\-_:[\]]+(\/[^\s]*)?$/.test(u) ? u.replace(/\/+$/, '') : '';
}

function startLicenseSync(o) {
    const opts = Object.assign({ secret: process.env.LICENSE_SECRET || '', url: resolveUrl(process.env.LICENSE_SYNC_URL, o && o.defaultUrl), everyMs: 15 * 60000, firstDelayMs: 20000,
        timeoutMs: 8000, fetchImpl: globalThis.fetch, log: () => {}, autoStart: true }, o || {});
    let timer = null, first = null, last = null, running = null, warned = false;
    const at = () => new Date().toISOString();

    async function syncNow() {
        if (running) return running;
        running = (async () => {
            if (!opts.url || !opts.secret) { last = { ok: false, skipped: true, message: !opts.url ? 'Abholen abgeschaltet' : 'LICENSE_SECRET fehlt', at: at() }; return last; }
            let resp, data;
            try {
                resp = await opts.fetchImpl(`${opts.url}/api/license/suite-key`, { headers: { Authorization: `Bearer ${syncToken(opts.secret)}`, 'X-Aura-Product': opts.product }, signal: AbortSignal.timeout(opts.timeoutMs) });
                data = await resp.json().catch(() => null);
            } catch (err) {
                if (!warned) { opts.log(`Lizenz: AuraControl unter ${opts.url} nicht erreichbar (${err && err.message ? err.message : err}). Neuer Versuch in 15 Minuten.`); warned = true; }
                last = { ok: false, message: 'AuraControl nicht erreichbar', at: at() }; return last;
            }
            if (!resp.ok || !data || typeof data !== 'object' || !('key' in data)) { last = { ok: false, message: `AuraControl antwortet mit Status ${resp.status}`, at: at() }; return last; }
            warned = false;
            const current = (await opts.getKey()) || '';
            if (typeof data.key === 'string' && data.key) {
                const r = opts.verify(data.key), p = r && r.payload;
                if (!r || !r.valid || !p || p.product !== 'suite') { last = { ok: false, message: 'Die Lizenz von AuraControl ist hier nicht gültig' + (r && r.error ? `: ${r.error}` : ''), at: at() }; return last; }
                if (data.key !== current) { await opts.setKey(data.key); await opts.setSource('control'); opts.log(`Lizenz: Suite-Lizenz von AuraControl übernommen (${p.users || p.maxUsers || '?'} Benutzer).`); last = { ok: true, changed: true, at: at() }; return last; }
                if ((await opts.getSource()) !== 'control') await opts.setSource('control');
                last = { ok: true, changed: false, at: at() }; return last;
            }
            if (data.key === null && current && (await opts.getSource()) === 'control') {
                await opts.setKey(''); await opts.setSource(''); opts.log('Lizenz: In AuraControl ist keine Suite-Lizenz mehr eingetragen; die übernommene Lizenz wurde entfernt.');
                last = { ok: true, changed: true, removed: true, at: at() }; return last;
            }
            last = { ok: true, changed: false, at: at() }; return last;
        })().finally(() => { running = null; });
        return running;
    }
    function start() {
        if (timer || !opts.url) return;
        first = setTimeout(() => { syncNow().catch(() => {}); }, opts.firstDelayMs); if (first.unref) first.unref();
        timer = setInterval(() => { syncNow().catch(() => {}); }, opts.everyMs); if (timer.unref) timer.unref();
    }
    function stop() { if (first) clearTimeout(first); if (timer) clearInterval(timer); first = timer = null; }
    function status() { return { enabled: !!opts.url, url: opts.url || null, lastResult: last }; }
    if (opts.autoStart) start();
    return { syncNow, start, stop, status };
}

module.exports = { startLicenseSync, syncToken, resolveUrl, payloadOf, SYNC_LABEL, DEFAULT_URL };
