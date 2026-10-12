'use strict';
/* AuraCall - Rufnummern: prüfen, in die weltweit eindeutige Form (E.164, z.B. +41791234567) bringen, gefährliche Ziele sperren.
 * Warum so streng: ausgehende Anrufe kosten Geld. Teure Sondernummern und fremde Länder sind der klassische Weg, eine Telefonanlage auszunutzen. */

// Landesvorwahl ("41", "+41", "0041") -> nur Ziffern, 1 bis 3 Stellen, sonst null
function cleanCountryCode(cc) { const d = String(cc === undefined || cc === null ? '' : cc).replace(/^(\+|00)/, ''); return /^[1-9]\d{0,2}$/.test(d) ? d : null; }

// Beliebige Eingabe -> "+<Landesvorwahl><Nummer>" oder null. Erlaubt: Leerzeichen, Bindestriche, Punkte, Schrägstriche, Klammern.
// Muss mit "+", "00" (international) oder "0" (Inland) beginnen: Eine nackte "112" ist KEINE gültige Zielnummer.
function normalizeNumber(input, defaultCountryCode = '41') {
    if (typeof input !== 'string' && typeof input !== 'number') return null;
    let s = String(input).trim();
    if (!s || s.length > 40 || /[^\d\s+\-./()]/.test(s)) return null;
    const plus = s.startsWith('+'); if (/\+/.test(s.slice(1))) return null;
    let d = s.replace(/[^\d]/g, '');
    if (!d) return null;
    if (plus) { /* schon international */ }
    else if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) { const cc = cleanCountryCode(defaultCountryCode); if (!cc) return null; d = cc + d.slice(1); }
    else return null;
    if (/^0/.test(d) || d.length < 8 || d.length > 15) return null;   // E.164: höchstens 15 Ziffern; mindestens 8 (Landesvorwahl + Nummer), schliesst Kurznummern wie 112/117/144 aus
    return '+' + d;
}

// Gesperrte Ziele (nach der Normalisierung). Gibt einen Grund (Text) zurück oder null. Bewusst klein und nachvollziehbar - der eigentliche Schutz ist die Liste erlaubter Vorwahlen.
const BLOCKED = [
    [/^\+41(90\d|84\d|87\d)/, 'Schweizer Mehrwertnummer (090x) bzw. Sondernummer (084x/087x)'],
    [/^\+49(900|137|118|180|181|188)/, 'deutsche Mehrwert- bzw. Sondernummer'],
    [/^\+43(900|930|931|939|810|820|821|828)/, 'österreichische Mehrwert- bzw. Sondernummer'],
    [/^\+33(89|8\d9)/, 'französische Mehrwertnummer (089x)'],
    [/^\+39(89|144|166|899)/, 'italienische Mehrwertnummer'],
    [/^\+44(9|87|8\d)/, 'britische Mehrwert- bzw. Sondernummer'],
    [/^\+1(900|976|809|284|649|664|767|809|829|849|868|869|876|473|671|242|246|264|345|441|721|758|784|787|939)/, 'US-Mehrwertnummer bzw. karibische Nummer (häufig für Betrug genutzt)'],
    [/^\+(870|871|872|873|874|881|882|883|888|979)/, 'Satelliten- bzw. internationale Mehrwertnummer'],
    [/^\+(41|43|49|33|39|44)?(112|110|117|118|144|143|147|911|999)$/, 'Notrufnummer'],
];
function blockedReason(e164) { if (!e164) return 'ungültige Nummer'; for (const [re, why] of BLOCKED) if (re.test(e164)) return why; return null; }
// Erlaubte Vorwahlen: Liste wie ["+41","+49"]; leere Liste = nichts erlaubt (sicherer Standard)
function isAllowed(e164, prefixes) { return !!e164 && Array.isArray(prefixes) && prefixes.some(p => /^\+\d{1,4}$/.test(String(p)) && e164.startsWith(String(p))); }
function parsePrefixList(text) {
    const items = (Array.isArray(text) ? text : String(text || '').split(/[\s,;]+/)).map(x => String(x).trim()).filter(Boolean);
    const out = []; for (const it of items) { const m = /^\+?(\d{1,4})$/.exec(it); if (!m) return { error: `"${it.slice(0, 20)}" ist keine Vorwahl (Beispiel: +41)`, prefixes: [] }; if (!out.includes('+' + m[1])) out.push('+' + m[1]); }
    return { prefixes: out };
}

// Wie die Leitung die Nummer sehen will: "e164plus" +41791234567, "e164" 41791234567, "national" 0791234567 (im eigenen Land) bzw. 0041... (Ausland)
function formatForDial(e164, format = 'e164plus', defaultCountryCode = '41') {
    const cc = cleanCountryCode(defaultCountryCode) || '41', d = e164.slice(1);
    if (format === 'e164') return d;
    if (format === 'national') return d.startsWith(cc) ? '0' + d.slice(cc.length) : '00' + d;
    return '+' + d;
}
// Schreibweisen, in denen der Anbieter die gewählte eigene Nummer schicken könnte (für die Zuordnung im Dialplan)
function didVariants(e164, defaultCountryCode = '41') {
    const cc = cleanCountryCode(defaultCountryCode) || '41', d = e164.slice(1), v = new Set([e164, d, '00' + d]);
    if (d.startsWith(cc)) v.add('0' + d.slice(cc.length));
    return [...v];
}
// Anrufer-Nummer von Asterisk: gültige Nummer -> E.164; sonst gekürzt und bereinigt; unterdrückt -> "unbekannt"
function normalizeCaller(raw, defaultCountryCode = '41') {
    const s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s || /^(anonymous|unknown|unavailable|restricted|private|withheld|s|anonym|unbekannt)$/i.test(s)) return 'unbekannt';
    const n = normalizeNumber(s, defaultCountryCode); if (n) return n;
    if (!/^[\d\s+*#\-./()]+$/.test(s)) return 'unbekannt';   // enthält Buchstaben o.ä. (kein Rufnummern-Text): nicht raten, schon gar nicht Ziffern daraus herausklauben
    const clean = s.replace(/[^\d+*#]/g, '').slice(0, 20); return clean || 'unbekannt';
}
// Für Protokolle: Mitte verdecken (+4179***4567)
function maskNumber(n) { const s = String(n || ''); return s.length <= 8 ? s.replace(/\d/g, '*') : s.slice(0, 5) + '*'.repeat(s.length - 9) + s.slice(-4); }

module.exports = { cleanCountryCode, normalizeNumber, blockedReason, isAllowed, parsePrefixList, formatForDial, didVariants, normalizeCaller, maskNumber };
