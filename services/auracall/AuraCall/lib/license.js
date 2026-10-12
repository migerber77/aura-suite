'use strict';
/* Lizenz von AuraCall: gleiches Verfahren wie bei den anderen Aura-Produkten.
 *  - Der Lizenzschlüssel ("<Daten>.<Signatur>") wird OFFLINE geprüft: Signatur mit LICENSE_SECRET (derselbe Wert wie beim Lizenzserver), Produkt "auracall", Ablaufdatum.
 *  - 14 Tage Probezeit ab dem ersten Start; danach braucht es eine gültige Lizenz. (AuraCall zählt als "Anwendung": keine Gratis-Regel wie bei den Diensten AuraDirect/AuraMail.)
 *  - Rückmeldung (Check-in) beim Lizenzserver wie bei AuraChat: alle 12 Stunden, nach jeder Änderung des Schlüssels, bei Netzproblemen mit Wiederholungen.
 *    Gesendet werden NUR: Lizenzschlüssel (oder leer), zufällige Installationskennung, Programmversion, Zahl der Konten. Nie Anrufe, Rufnummern oder Gesprächsinhalte. */
const crypto = require('crypto');
const PRODUCT = 'auracall', TRIAL_DAYS = 14, WARN_DAYS = 14, DAY = 86400000;
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
    if (payload.product !== PRODUCT) return { valid: false, error: 'Diese Lizenz ist nicht für AuraCall ausgestellt.' };
    if (payload.expiresAt) { const t = new Date(payload.expiresAt).getTime(); if (!Number.isFinite(t)) return { valid: false, error: 'Die Lizenzdaten sind beschädigt.' }; if (t < now) return { valid: false, error: 'Die Lizenz ist abgelaufen.', payload }; }
    return { valid: true, payload };
}
// Domain oder IP, mit oder ohne http(s)://, mit oder ohne Port: es zählt nur der Rechnername, der Port ist fest (wie bei AuraChat)
function buildCheckinBaseUrl(raw) { let host = String(raw || '').trim(); if (!host) return ''; host = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]; return /^[A-Za-z0-9.-]{1,253}$/.test(host) ? `http://${host}:${CHECKIN_PORT}` : ''; }
const str = (x, n) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

class License {
    constructor({ db, secret = '', now = Date.now, fetchImpl, checkinHost = '', checkinUrl = '', version = '', counts, delays = [5 * 60000, 30 * 60000, 2 * 3600000], firstDelayMs = 30000, everyMs = 12 * 3600000, timeoutMs = 10000, log = () => {} } = {}) {
        this.db = db; this.secret = secret; this.now = now; this.fetch = fetchImpl || globalThis.fetch; this.checkinUrl = checkinUrl || buildCheckinBaseUrl(checkinHost); this.version = version; this.counts = counts || (() => ({ totalUsers: null, totalAdmins: null }));
        this.delays = delays; this.firstDelayMs = firstDelayMs; this.everyMs = everyMs; this.timeoutMs = timeoutMs; this.log = log; this.lastCheckin = null; this.timers = new Set(); this.interval = null; this.retry = null; this.running = null;
    }
    // Beginn der Probezeit: beim ersten Aufruf festgehalten (bleibt über Neustarts gleich)
    installDate() { let t = this.db.getSetting('installDate', null); if (!Number.isFinite(t)) { t = this.now(); this.db.setSetting('installDate', t); } return t; }
    installationId() { let id = this.db.getSetting('installationId', null); if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID(); this.db.setSetting('installationId', id); } return id; }
    storedKey() { const k = this.db.getSetting('licenseKey', ''); return typeof k === 'string' ? k : ''; }
    // Zustand: licensed (gültiger Schlüssel) | trial (Probezeit läuft) | expired (Probezeit vorbei, kein gültiger Schlüssel). valid = darf telefonieren.
    info() {
        const now = this.now(), key = this.storedKey(), r = key ? verifyKey(key, this.secret, now) : null, p = r && r.payload || null;
        const out = { state: 'expired', valid: false, customer: p ? str(p.customer, 120) || null : null, expiresAt: p && p.expiresAt || null, daysLeft: null, expiresSoon: false, trialDaysRemaining: 0, keyError: key && !r.valid ? r.error : null, hasKey: !!key };
        if (r && r.valid) { out.state = 'licensed'; out.valid = true; if (p.expiresAt) { out.daysLeft = Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - now) / DAY)); out.expiresSoon = out.daysLeft <= WARN_DAYS; } return out; }
        const left = TRIAL_DAYS - (now - this.installDate()) / DAY;
        if (left > 0) { out.state = 'trial'; out.valid = true; out.trialDaysRemaining = Math.ceil(left); return out; }
        out.message = out.keyError ? `Keine gültige Lizenz: ${out.keyError}` : 'Die Testzeit ist abgelaufen und es ist keine Lizenz hinterlegt.'; return out;
    }
    allows() { return this.info().valid; }
    message() { const i = this.info(); return i.valid ? '' : `Keine gültige Lizenz für AuraCall. ${i.message || ''} Bitte unter "Lizenz" einen Schlüssel eintragen.`.replace(/\s+/g, ' ').trim(); }
    setKey(key) {
        const k = str(key, 4000).replace(/\s+/g, ''), r = verifyKey(k, this.secret, this.now()); if (!k) return { ok: false, error: 'Bitte einen Lizenzschlüssel eintragen.' }; if (!r.valid) return { ok: false, error: r.error };
        this.db.setSetting('licenseKey', k); return { ok: true, customer: str(r.payload.customer, 120), expiresAt: r.payload.expiresAt || null };
    }
    removeKey() { this.db.setSetting('licenseKey', ''); }
    // ---- Rückmeldung beim Lizenzserver ----
    checkinEnabled() { return !!this.checkinUrl; }
    checkinStatus() { return { enabled: this.checkinEnabled(), lastResult: this.lastCheckin }; }
    async checkin() {
        if (!this.checkinUrl) return null; const key = this.storedKey(), c = this.counts();
        try {
            const resp = await this.fetch(`${this.checkinUrl}/api/checkin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: key || null, installationId: this.installationId(), totalUsers: c.totalUsers, totalAdmins: c.totalAdmins, version: this.version }), signal: AbortSignal.timeout(this.timeoutMs) });
            let data = {}; try { data = await resp.json(); } catch { /* keine Antwort */ }
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
    stop() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); if (this.interval) clearInterval(this.interval); this.interval = null; this.retry = null; }
}
module.exports = { License, verifyKey, buildCheckinBaseUrl, PRODUCT, TRIAL_DAYS, WARN_DAYS, CHECKIN_PORT, DEFAULT_CHECKIN_HOST };
