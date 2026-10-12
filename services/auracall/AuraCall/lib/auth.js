'use strict';
/* Anmeldung: lokale Konten (mit Passwort und optional 2FA) und Konten aus AuraDirect. Der Benutzer "admin" ist IMMER ein lokales Konto (Notzugang, funktioniert auch wenn AuraDirect nicht erreichbar ist). */
const NAME_LOCK_AFTER = 5, NAME_LOCK_MS = 15 * 60 * 1000;
const GENERIC = 'Benutzername oder Passwort stimmt nicht.';

class Auth {
    constructor({ db, getSettings, directory, now = Date.now }) { this.db = db; this.getSettings = getSettings; this.directory = directory; this.now = now; this.names = new Map(); }
    // Fehlversuche je Name bei Anmeldungen über AuraDirect (lokal zählt die Datenbank selbst); schützt auch AuraDirect/Active Directory davor, dass über AuraCall Passwörter durchprobiert werden
    _locked(name, now) { const e = this.names.get(name.toLowerCase()); if (!e) return 0; if (e.until > now) return e.until - now; if (e.until) this.names.delete(name.toLowerCase()); return 0; }
    _fail(name, now) { const k = name.toLowerCase(), e = this.names.get(k) || { n: 0, until: 0 }; e.n++; if (e.n >= NAME_LOCK_AFTER) { e.until = now + NAME_LOCK_MS; e.n = 0; } this.names.set(k, e); if (this.names.size > 5000) this.names.clear(); }
    _clear(name) { this.names.delete(name.toLowerCase()); }
    needsSetup(user) { return this.db.needsTwofaSetup(user); }
    // Ergebnis: { ok:true, user, via } | { requires2fa:true, via } | { ok:false, status, message, retryInMs?, code? }
    async login({ username, password, code }) {
        const name = String(username === undefined || username === null ? '' : username).trim().slice(0, 80), pw = String(password === undefined || password === null ? '' : password), now = this.now();
        const cfg = (this.getSettings() || {}).auradirect || {};
        const viaDirectory = !!(cfg.enabled && cfg.url && cfg.serviceKey) && name !== '' && name.toLowerCase() !== 'admin' && pw !== '';
        const noCode = code === undefined || code === null || String(code).trim() === '';
        let hint = '';
        if (viaDirectory) {
            const left = this._locked(name, now); if (left) return { ok: false, status: 429, message: `Zu viele Fehlversuche. Dieses Konto ist für ${Math.ceil(left / 60000)} Minuten gesperrt.`, retryInMs: left };
            const r = await this.directory.validate({ url: cfg.url, key: cfg.serviceKey, username: name, password: pw, code });
            if (r.kind === 'valid') {
                if (r.role !== 'admin') return { ok: false, status: 403, message: 'Dieses Konto hat in AuraDirect eine Rolle, die AuraCall nicht kennt. Vorgesehen ist "Administrator:in" (AuraDirect → Benutzer → bei der Person AuraCall).' };
                const p = this.db.upsertDirectoryUser(name, r.name, now);
                if (p.invalid) return { ok: false, status: 400, message: 'Dieser Benutzername aus AuraDirect enthält Zeichen, die AuraCall nicht annimmt (erlaubt: Buchstaben, Ziffern und . _ @ -).' };
                if (p.conflict) return { ok: false, status: 409, message: 'In AuraCall gibt es schon ein lokales Konto mit diesem Namen. Es wird nicht mit dem AuraDirect-Konto vermischt; bitte das lokale Konto umbenennen oder entfernen.' };
                this._clear(name); return { ok: true, user: p.user, via: 'auradirect' };
            }
            if (r.kind === 'requires2fa') { if (noCode) return { requires2fa: true, via: 'auradirect' }; this._fail(name, now); return { ok: false, status: 401, message: 'Der Code stimmt nicht oder ist abgelaufen.', code: 'code' }; }
            if (r.kind === 'noaccess') return { ok: false, status: 403, message: 'Die Anmeldung bei AuraDirect war erfolgreich, aber dieses Konto ist nicht für AuraCall freigeschaltet. In AuraDirect → Benutzer → bei der Person AuraCall aktivieren.' };
            if (r.kind === 'problem') hint = r.message;
            // "invalid": AuraDirect kennt die Person nicht oder das Passwort stimmt nicht -> ein lokales Konto kommt noch infrage
        }
        const src = this.db.userSource(name);
        if (src === 'local') {
            const r = await this.db.login(name, pw, now, code);
            if (r.ok) return { ok: true, user: r.user, via: 'local', usedRecovery: r.usedRecovery };
            if (r.reason === 'zweiter-faktor') return { requires2fa: true, via: 'local' };
            if (r.reason === 'gesperrt') return { ok: false, status: 429, message: `Zu viele Fehlversuche. Dieses Konto ist für ${Math.ceil(r.retryInMs / 60000)} Minuten gesperrt.`, retryInMs: r.retryInMs };
            if (r.reason === 'code') return { ok: false, status: 401, message: 'Der Code stimmt nicht, ist abgelaufen oder wurde schon verwendet.', code: 'code' };
            return { ok: false, status: 401, message: GENERIC + (hint ? ` Hinweis zu AuraDirect: ${hint}` : '') };
        }
        if (viaDirectory) this._fail(name, now); else await this.db.login(name, pw, now);   // gleiche Antwortzeit wie bei einem bekannten Konto
        if (src === 'auradirect' && hint) return { ok: false, status: 401, message: `Diese Person wird über AuraDirect angemeldet, aber die Prüfung ist gerade nicht möglich. ${hint}` };
        return { ok: false, status: 401, message: GENERIC + (hint ? ` Hinweis zu AuraDirect: ${hint}` : '') };
    }
}
module.exports = { Auth, GENERIC };
