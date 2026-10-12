'use strict';
/* Zeitbasierte Einmal-Codes (TOTP, RFC 6238) für die Zwei-Faktor-Anmeldung, ohne fremde Pakete. Kompatibel mit Google Authenticator, Microsoft Authenticator, Aegis, 1Password u.a.
 * SHA-1, 6 Stellen, 30 Sekunden - das ist, was diese Programme standardmässig erwarten. */
const crypto = require('crypto');
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function base32Encode(buf) {
    let bits = 0, value = 0, out = '';
    for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out;
}
// Lässt Leerzeichen, Striche, Kleinbuchstaben und "=" zu (so wie Anwendungen das Geheimnis anzeigen); ungültiges -> null
function base32Decode(str) {
    const s = String(str === undefined || str === null ? '' : str).toUpperCase().replace(/[\s-]+/g, '').replace(/=+$/, '');
    if (!s || !/^[A-Z2-7]+$/.test(s)) return null;
    let bits = 0, value = 0; const out = [];
    for (const ch of s) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
    return Buffer.from(out);
}
const newSecret = () => base32Encode(crypto.randomBytes(20));   // 160 Bit, 32 Zeichen
function hotp(key, counter, digits = 6) {
    const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0); msg.writeUInt32BE(counter >>> 0, 4);
    const h = crypto.createHmac('sha1', key).update(msg).digest(), o = h[h.length - 1] & 15;
    const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(bin % 10 ** digits).padStart(digits, '0');
}
const stepOf = (now, period = 30) => Math.floor(now / 1000 / period);
function codeAt(secret, now = Date.now(), { period = 30, digits = 6 } = {}) { const key = base32Decode(secret); if (!key) throw new Error('Ungültiges Geheimnis'); return hotp(key, stepOf(now, period), digits); }
// Prüft einen eingegebenen Code. Gibt den Zeitschritt zurück, in dem er gültig war, sonst null.
// window: wie viele Schritte (je 30 s) vor/nach der Serverzeit noch gelten (Uhren gehen nie ganz gleich). lastStep: bereits verbrauchter Schritt - nie wieder annehmen (ein abgefangener Code taugt nicht ein zweites Mal).
function verify(secret, code, { now = Date.now(), window = 1, lastStep = 0, period = 30, digits = 6 } = {}) {
    const key = base32Decode(secret); if (!key) return null;
    if (typeof code !== 'string' && typeof code !== 'number') return null;   // keine Listen, Objekte, Wahrheitswerte (String(["123456"]) wäre sonst "123456")
    const c = String(code).replace(/[\s-]/g, ''); if (!/^\d+$/.test(c) || c.length !== digits) return null;
    const cur = stepOf(now, period); let found = null;
    for (let d = -window; d <= window; d++) {   // alle Schritte prüfen (gleich lange Laufzeit), den zeitlich spätesten Treffer nehmen
        const step = cur + d; if (step <= lastStep || step < 0) continue;
        const exp = Buffer.from(hotp(key, step, digits)), got = Buffer.from(c);
        if (crypto.timingSafeEqual(exp, got) && (found === null || step > found)) found = step;
    }
    return found;
}
function otpauthUri({ secret, account, issuer = 'AuraCall' }) {
    const label = encodeURIComponent(issuer) + ':' + encodeURIComponent(account);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
// Geheimnis zum Abtippen in 4er-Gruppen ("ABCD EFGH ...")
const groupSecret = (secret) => String(secret).replace(/(.{4})/g, '$1 ').trim();
// Notfall-Codes: einmal verwendbar, falls das Handy weg ist. Ohne verwechselbare Zeichen (0/o, 1/l/i).
const RC = 'abcdefghjkmnpqrstuvwxyz23456789';
function recoveryCodes(n = 10) { return Array.from({ length: n }, () => { const b = crypto.randomBytes(10); let s = ''; for (let i = 0; i < 10; i++) s += RC[b[i] % RC.length]; return s.slice(0, 5) + '-' + s.slice(5); }); }
const normalizeRecovery = (c) => (typeof c === 'string' ? c.toLowerCase().replace(/[\s-]+/g, '') : '');
const hashRecovery = (c) => sha256('auracall-recovery:' + normalizeRecovery(c));
const looksLikeRecovery = (c) => /^[a-z2-9]{10}$/.test(normalizeRecovery(c)) && !/^\d{6}$/.test(normalizeRecovery(c));

module.exports = { base32Encode, base32Decode, newSecret, hotp, codeAt, verify, stepOf, otpauthUri, groupSecret, recoveryCodes, hashRecovery, normalizeRecovery, looksLikeRecovery };
