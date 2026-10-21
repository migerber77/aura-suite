'use strict';
/* Lizenz von AuraCall: gleiches Verfahren wie bei den anderen Aura-Produkten.
 *  - Der Lizenzschlüssel ("<Daten>.<Signatur>") wird OFFLINE geprüft: Signatur mit LICENSE_SECRET (derselbe Wert wie beim Lizenzserver), Produkt "auracall", Ablaufdatum.
 *  - 14 Tage Probezeit ab dem ersten Start; danach braucht es eine gültige Lizenz (enthalten in Business Solo und Business Advanced). Im Free Plan ist AuraCall nicht enthalten: keine Gratis-Stufe.
 *  - Rückmeldung (Check-in) beim Lizenzserver wie bei AuraChat: alle 12 Stunden, nach jeder Änderung des Schlüssels, bei Netzproblemen mit Wiederholungen.
 *    Gesendet werden NUR: Lizenzschlüssel (oder leer), zufällige Installationskennung, Programmversion, Zahl der Konten. Nie Anrufe, Rufnummern oder Gesprächsinhalte. */
const crypto = require('crypto');
const PRODUCT = 'auracall', PING_PRODUCT = 'call', TRIAL_DAYS = 14, WARN_DAYS = 14, DAY = 86400000;
const CHECKIN_PORT = 8451;                       // fester Port des Lizenzserver-Containers (wie bei AuraChat)
const DEFAULT_CHECKIN_HOST = 'auralic.gerber-backoffice-solutions.com';

// Prüft einen Schlüssel. Gibt { valid, payload?, error? } zurück.
function verifyKey(key, secret, now = Date.now()) {
    if (typeof key !== 'string' || key.length > 4000 || !key.includes('.')) return { valid: false, error: 'Ungültiges Lizenzformat.' };
    const parts = key.trim().split('.'); if (parts.length !== 2 || !parts[0] || !parts[1]) return { valid: false, error: 'Ungültiges Lizenzformat.' };
    if (!secret) return { valid: false, error: 'Das Lizenzsystem ist nicht eingerichtet (LICENSE_SECRET fehlt in der .env).' };
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url')), got = Buffer.from(parts[1]);
    if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return { valid: false, error: 'Die Lizenzsignatur ist ungültig (falscher Schlüssel oder LICENSE_SECRET stimmt nicht mit dem Lizenzserver überein).' };
    let payload; try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); } catch { return { valid: false, error: 'Die Lizenzdaten sind beschädigt.' }; }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { valid: false, error: 'Die Lizenzdaten sind beschädigt.' };
    if (payload.product !== PRODUCT && payload.product !== 'suite') return { valid: false, error: 'Diese Lizenz ist nicht für AuraCall ausgestellt.' };   // 'suite': Suite-Lizenz (Business Solo/Advanced), kommt meist von AuraControl
    if (payload.expiresAt) { const t = new Date(payload.expiresAt).getTime(); if (!Number.isFinite(t)) return { valid: false, error: 'Die Lizenzdaten sind beschädigt.' }; if (t < now) return { valid: false, error: 'Die Lizenz ist abgelaufen.', payload }; }
    return { valid: true, payload };
}
// Domain oder IP, mit oder ohne http(s)://, mit oder ohne Port: es zählt nur der Rechnername, der Port ist fest (wie bei AuraChat)
// Nicht abschaltbar (Entscheidung des Herstellers): leer oder ungültig ergibt den Standard-Lizenzserver; ein ANDERER Rechner (eigener Lizenzserver) bleibt möglich.
function buildCheckinBaseUrl(raw) { let host = String(raw === undefined || raw === null ? '' : raw).trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0]; if (!/^[A-Za-z0-9.-]{1,253}$/.test(host)) host = DEFAULT_CHECKIN_HOST; return `http://${host}:${CHECKIN_PORT}`; }
// Aura-Suite-Version vom Lizenzserver (nur Anzeige in "Über Aura-Suite"): streng geprüft, bevor sie gespeichert wird. Der Abgleich läuft über ungesichertes HTTP.
const SUITE_VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/;
function parseSuiteInfo(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const version = typeof raw.version === 'string' ? raw.version.trim() : ''; if (!SUITE_VERSION_RE.test(version)) return null;
    let date = null; if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) { const d = new Date(raw.date + 'T00:00:00Z'); if (!isNaN(d) && d.toISOString().slice(0, 10) === raw.date) date = raw.date; }
    const note = typeof raw.note === 'string' ? raw.note.replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    return { version, date, note };
}
function versionOlder(installed, latest) {
    const a = String(installed).split('.').map((n) => parseInt(n, 10) || 0), b = String(latest).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x < y) return true; if (x > y) return false; }
    return false;
}
const str = (x, n) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

class License {
    constructor({ db, secret = '', now = Date.now, fetchImpl, checkinHost = '', checkinUrl = '', version = '', suiteInstalled = '', counts, delays = [5 * 60000, 30 * 60000, 2 * 3600000], firstDelayMs = 30000, everyMs = 12 * 3600000, timeoutMs = 10000, log = () => {} } = {}) {
        this.db = db; this.secret = secret; this.now = now; this.fetch = fetchImpl || globalThis.fetch; this.checkinUrl = checkinUrl || buildCheckinBaseUrl(checkinHost); this.version = version; this.suiteInstalled = SUITE_VERSION_RE.test(String(suiteInstalled || '')) ? String(suiteInstalled) : ''; this.counts = counts || (() => ({ totalUsers: null, totalAdmins: null }));
        this.delays = delays; this.firstDelayMs = firstDelayMs; this.everyMs = everyMs; this.timeoutMs = timeoutMs; this.log = log; this.lastCheckin = null; this.timers = new Set(); this.interval = null; this.retry = null; this.running = null;
    }
    // Beginn der Probezeit: beim ersten Aufruf festgehalten (bleibt über Neustarts gleich)
    installDate() { let t = this.db.getSetting('installDate', null); if (!Number.isFinite(t)) { t = this.now(); this.db.setSetting('installDate', t); } return t; }
    installationId() { let id = this.db.getSetting('installationId', null); if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID(); this.db.setSetting('installationId', id); } return id; }
    storedKey() { const k = this.db.getSetting('licenseKey', ''); return typeof k === 'string' ? k : ''; }
    // Zustand: licensed (gültiger Schlüssel) | trial (14 Tage Probezeit, alles erlaubt) | expired (Probezeit vorbei, keine gültige Lizenz). valid = darf telefonieren.
    // Eine Gratis-Stufe gibt es nicht mehr (AuraCall gehört nicht zum Free Plan).
    info() {
        const now = this.now(), key = this.storedKey(), r = key ? verifyKey(key, this.secret, now) : null, p = r && r.payload || null;
        const out = { state: 'expired', valid: false, plan: p && p.product === 'suite' ? str(p.plan, 20) || 'suite' : null, managedBy: this.db.getSetting('licenseSource', '') === 'control' ? 'auracontrol' : null, customer: p ? str(p.customer, 120) || null : null, expiresAt: p && p.expiresAt || null, daysLeft: null, expiresSoon: false, trialDaysRemaining: 0, keyError: key && !r.valid ? r.error : null, hasKey: !!key };
        if (r && r.valid) { out.state = 'licensed'; out.valid = true; if (p.expiresAt) { out.daysLeft = Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - now) / DAY)); out.expiresSoon = out.daysLeft <= WARN_DAYS; } return out; }
        const left = TRIAL_DAYS - (now - this.installDate()) / DAY;
        if (left > 0) { out.state = 'trial'; out.valid = true; out.trialDaysRemaining = Math.ceil(left); return out; }
        out.message = out.keyError ? `Keine gültige Lizenz: ${out.keyError}` : 'Die Testzeit ist abgelaufen. AuraCall braucht jetzt eine Lizenz (enthalten in Business Solo und Business Advanced).'; return out;
    }
    allows() { return this.info().valid; }
    message() { const i = this.info(); return i.valid ? '' : `Keine gültige Lizenz für AuraCall. ${i.message || ''} Die Lizenz wird zentral in AuraControl eingetragen und kommt automatisch hierher.`.replace(/\s+/g, ' ').trim(); }
    setKey(key) {
        const k = str(key, 4000).replace(/\s+/g, ''), r = verifyKey(k, this.secret, this.now()); if (!k) return { ok: false, error: 'Bitte einen Lizenzschlüssel eintragen.' }; if (!r.valid) return { ok: false, error: r.error };
        this.db.setSetting('licenseKey', k); this.db.setSetting('licenseSource', 'manual'); return { ok: true, customer: str(r.payload.customer, 120), expiresAt: r.payload.expiresAt || null };
    }
    removeKey() { this.db.setSetting('licenseKey', ''); this.db.setSetting('licenseSource', ''); }
    // Suite-Lizenz von AuraControl übernehmen (gemeinsamer Baustein aura-license-sync.js). AuraCall läuft im Host-Netzwerk: AuraControl ist unter 127.0.0.1:8000 erreichbar.
    startSync(opts = {}) {
        if (this.sync) return this.sync;
        this.sync = require('./aura-license-sync').startLicenseSync({
            product: 'call', secret: this.secret, defaultUrl: 'http://127.0.0.1:8000', verify: (k) => verifyKey(k, this.secret, this.now()),
            getKey: () => this.storedKey(), setKey: (k) => { this.db.setSetting('licenseKey', k || ''); if (k) this.run().catch(() => {}); },
            getSource: () => this.db.getSetting('licenseSource', ''), setSource: (v) => this.db.setSetting('licenseSource', v || ''),
            log: this.log, fetchImpl: this.fetch, ...opts
        });
        return this.sync;
    }
    // ---- Aura-Suite-Version vom Lizenzserver (Anzeige) ----
    suiteInfo() { const raw = this.db.getSetting('suiteInfo', ''); if (typeof raw !== 'string' || !raw) return null; try { return parseSuiteInfo(JSON.parse(raw)); } catch { return null; } }
    setSuite(info) { this.db.setSetting('suiteInfo', info ? JSON.stringify(info) : ''); }
    // ---- Rückmeldung beim Lizenzserver ----
    checkinEnabled() { return !!this.checkinUrl; }   // immer wahr: die Rückmeldung ist nicht abschaltbar
    checkinStatus() { return { enabled: this.checkinEnabled(), lastResult: this.lastCheckin }; }
    async checkin() {
        if (!this.checkinUrl) return null; const key = this.storedKey(), c = this.counts();
        try {
            const resp = await this.fetch(`${this.checkinUrl}/api/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: key || null, installationId: this.installationId(), product: PING_PRODUCT, state: this.info().state, suiteInstalled: this.suiteInstalled || null, totalUsers: c.totalUsers, totalAdmins: c.totalAdmins, version: this.version }), signal: AbortSignal.timeout(this.timeoutMs) });
            let data = {}; try { data = await resp.json(); } catch { /* keine Antwort */ }
            // Nur eine echte Antwort des Lizenzservers ({ ok: true, ... }) ändert die gespeicherte Anzeige; fehlt die Version darin (oder ist sie ungültig), wird sie entfernt.
            if (resp.ok && data && data.ok === true) { try { this.setSuite(parseSuiteInfo(data.suite)); } catch { /* Anzeige ist nicht wichtig */ } }
            this.lastCheckin = { success: resp.ok, message: resp.ok ? 'OK' : str(data && data.error, 200) || `Status ${resp.status}`, retryable: !resp.ok && resp.status >= 500, at: new Date(this.now()).toISOString() };   // ein abgelehnter Schlüssel (4xx) ändert sich durch Wiederholen nicht
        } catch (err) {
            const timedOut = err && (err.name === 'TimeoutError' || /timeout|aborted/i.test(err.message || ''));
            this.lastCheckin = { success: false, message: timedOut ? 'Lizenzserver nicht erreichbar (Zeitüberschreitung)' : `Lizenzserver nicht erreichbar (${str(err && err.message, 120)})`, retryable: true, at: new Date(this.now()).toISOString() };
        }
        return this.lastCheckin;
    }
    // sofort, bei Netzproblemen nach 5 Minuten, 30 Minuten und 2 Stunden erneut
    async run(attempt = 0) {
        if (this.retry) { clearTimeout(this.retry); this.timers.delete(this.retry); this.retry = null; }
        const r = await this.checkin();
        if (r && !r.success && r.retryable && attempt < this.delays.length) { this.retry = setTimeout(() => { this.timers.delete(this.retry); this.run(attempt + 1).catch(() => {}); }, this.delays[attempt]); this.retry.unref(); this.timers.add(this.retry); }
        return r;
    }
    start() {
        if (!this.checkinEnabled() || this.interval) return;
        const first = setTimeout(() => { this.timers.delete(first); this.run().catch(() => {}); }, this.firstDelayMs); first.unref(); this.timers.add(first);
        this.interval = setInterval(() => this.run().catch(() => {}), this.everyMs); this.interval.unref();
    }
    stop() { if (this.sync) { this.sync.stop(); this.sync = null; } for (const t of this.timers) clearTimeout(t); this.timers.clear(); if (this.interval) clearInterval(this.interval); this.interval = null; this.retry = null; }
}
module.exports = { License, parseSuiteInfo, versionOlder, verifyKey, buildCheckinBaseUrl, PRODUCT, TRIAL_DAYS, WARN_DAYS, CHECKIN_PORT, DEFAULT_CHECKIN_HOST };
