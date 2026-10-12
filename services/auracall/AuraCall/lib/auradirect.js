'use strict';
/* Anmeldung über AuraDirect (zentrale Benutzerverwaltung für die Aura-Produkte, mit Anbindung an das Active Directory).
 * AuraCall schickt Benutzername, Passwort (und bei eingerichteter 2FA den Code) an AuraDirect; dort wird geprüft, ob die Person für "auracall" freigeschaltet ist.
 * Passwörter werden hier nie gespeichert oder protokolliert. Gleiches Verfahren wie bei AuraMail, AuraProxy, AuraChat und AuraPlan. */
const PRODUCT = 'auracall';
const clean = (x, max) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

class AuraDirect {
    constructor({ fetchImpl, timeoutMs } = {}) { this.fetch = fetchImpl || globalThis.fetch; this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 6000; }
    // Ergebnis: { kind: 'valid', role, name } | { kind: 'requires2fa' } | { kind: 'noaccess' } | { kind: 'invalid', hint? } | { kind: 'problem', message }
    async validate({ url, key, username, password, code }) {
        const base = String(url || '').replace(/\/+$/, ''); const body = { username, password, product: PRODUCT }; if (code !== undefined && code !== null && String(code).trim() !== '') body.twofaCode = String(code).slice(0, 40);
        let resp, text;
        try {
            resp = await this.fetch(`${base}/api/auth/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Key': String(key || '') }, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) });
            text = resp.status === 401 || resp.status === 402 ? '' : await resp.text();
        } catch (err) { return { kind: 'problem', message: `AuraDirect ist nicht erreichbar (${clean(err && err.message, 120)}).` }; }
        if (resp.status === 401) return { kind: 'problem', message: 'Der Dienst-Schlüssel für AuraDirect wird dort nicht akzeptiert (AuraCall → Sicherheit → AuraDirect prüfen).' };
        if (resp.status === 402) return { kind: 'problem', message: 'AuraDirect meldet, dass es nicht lizenziert ist.' };
        if (resp.status === 429) return { kind: 'problem', message: 'AuraDirect meldet zu viele Anfragen. Bitte kurz warten.' };
        if (!resp.ok) return { kind: 'problem', message: `AuraDirect antwortete mit Status ${resp.status}.` };
        // erwartet wird ein JSON-Objekt (keine Liste, kein Text), höchstens 100 KB
        let data; try { if (text.length > 100000) throw new Error(); data = JSON.parse(text); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); } catch { return { kind: 'problem', message: 'AuraDirect hat eine unverständliche Antwort geschickt.' }; }
        if (data.valid === true) return { kind: 'valid', role: clean(data.role, 30), name: clean(data.name || `${data.firstname || ''} ${data.lastname || ''}`, 80) };
        if (data.requires2fa === true) return { kind: 'requires2fa' };
        if (data.error === 'Kein Zugriff auf dieses Produkt.') return { kind: 'noaccess' };
        return { kind: 'invalid', hint: data.error ? clean(data.error, 160) : '' };
    }
    // Verbindungstest: mit erfundenen Zugangsdaten. Jede ordentliche JSON-Antwort heisst, dass Adresse, Dienst-Schlüssel und Lizenz in Ordnung sind.
    async test({ url, key }) {
        const r = await this.validate({ url, key, username: 'auracall-verbindungstest', password: 'kein-echtes-passwort' });
        if (r.kind === 'problem') return { ok: false, message: r.message };
        return { ok: true, message: 'Verbindung in Ordnung: AuraDirect antwortet, der Dienst-Schlüssel wird akzeptiert.' };
    }
}
module.exports = { AuraDirect, PRODUCT };
