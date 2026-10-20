'use strict';
/* AuraCall - Einstellungen: Vorgaben und Prüfregeln. Jede Eingabe aus der Oberfläche läuft durch diese Prüfungen, bevor sie gespeichert wird. */
const phone = require('./phone');
const { LANG_NAMES } = require('./prompt');

// Ein Begrüssungstext MUSS sagen, dass hier eine KI spricht (Offenlegung gegenüber Anrufenden; im EU-Raum seit 2. August 2026 Pflicht bei Gesprächen mit KI)
const AI_NOTICE = /\b(KI|AI)\b|k(ü|ue)nstliche[rnm]?\s+Intelligenz|virtuelle[rnm]?\s+(Assistent|Assistentin)|Sprachassistent/i;
const hasAiNotice = (t) => AI_NOTICE.test(String(t || ''));

const DEFAULTS = Object.freeze({
    general: Object.freeze({ company: '', lang: 'de', greetingIn: '', greetingOut: '', knowledge: '', storeTranscripts: false, retentionDays: 30, timezone: 'Europe/Zurich' }),
    limits: Object.freeze({ maxConcurrent: 2, outboundEnabled: false, outboundPerDay: 20, outboundPerMinute: 3, outboundHours: '08:00-20:00', outboundAllowedPrefixes: Object.freeze(['+41']) }),
    audio: Object.freeze({ gain: 1, sensitivity: 'normal', idlePromptSec: 8, maxCallMin: 10 }),
    aurachat: Object.freeze({ url: '', apiKey: '', model: '', warmupMin: 4 }),   // model: Modell NUR fürs Telefon (leer = das von AuraChat); warmupMin: Abstand der Aufwärm-Anfragen (0 = aus)
    security: Object.freeze({ twofaRequired: false }),                         // Zwei-Faktor-Anmeldung für alle lokalen Konten vorschreiben
    auradirect: Object.freeze({ enabled: false, url: '', serviceKey: '' }),   // Anmeldung über AuraDirect; serviceKey leer = bisherigen behalten
    privacy: Object.freeze({ controller: '', address: '', email: '', phone: '', dpo: '', extra: '' })   // Angaben für die Datenschutzerklärung (verantwortliche Stelle)
});
const SENSITIVITY = { normal: { minRms: 350, endSilenceMs: 700 }, laut: { minRms: 700, endSilenceMs: 800 }, leise: { minRms: 200, endSilenceMs: 700 } };

const str = (x, max) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
const bool = (x, d) => (x === undefined ? d : x === true || x === 'true');
const int = (x, d, min, max, name, errs) => { if (x === undefined || x === null || x === '') return d; const n = Number(x); if (!Number.isInteger(n) || n < min || n > max) { errs.push(`${name}: eine ganze Zahl von ${min} bis ${max}.`); return d; } return n; };

function isValidTimezone(tz) { try { new Intl.DateTimeFormat('de-CH', { timeZone: tz }); return typeof tz === 'string' && tz.length > 0 && tz.length < 60; } catch { return false; } }
// "08:00-20:00" -> { from, to } in Minuten; nur innerhalb eines Tages; "00:00-24:00" = immer
function parseHours(s) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]|24):([0-5]\d)$/.exec(String(s || '').trim()); if (!m) return null;
    const from = Number(m[1]) * 60 + Number(m[2]), to = Number(m[3]) * 60 + Number(m[4]); if (to > 24 * 60 || from >= to) return null; return { from, to };
}
function localMinutes(date, tz) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date); const g = (t) => Number(parts.find(p => p.type === t).value);
    return (g('hour') % 24) * 60 + g('minute');
}
function inOutboundHours(date, hoursStr, tz) { const h = parseHours(hoursStr); if (!h) return false; const m = localMinutes(date, isValidTimezone(tz) ? tz : 'Europe/Zurich'); return m >= h.from && m < h.to; }

function validateGeneral(input = {}, current = DEFAULTS.general) {
    const e = [], v = { ...DEFAULTS.general, ...current };
    if (input.company !== undefined) { v.company = str(input.company, 80).replace(/\s+/g, ' ').trim(); }
    if (input.lang !== undefined) { if (!LANG_NAMES[input.lang]) e.push('Sprache: ' + Object.keys(LANG_NAMES).join(', ') + '.'); else v.lang = input.lang; }
    for (const k of ['greetingIn', 'greetingOut']) if (input[k] !== undefined) {
        const t = str(input[k], 400).replace(/\s+/g, ' ').trim();
        if (t && !hasAiNotice(t)) e.push(`${k === 'greetingIn' ? 'Begrüssung bei eingehenden Anrufen' : 'Begrüssung bei ausgehenden Anrufen'}: Der Text muss sagen, dass hier eine KI spricht (zum Beispiel "…die KI-Assistentin von {company}…"). Das ist eine Offenlegungspflicht gegenüber den Anrufenden. Leer lassen = Standardtext.`);
        else v[k] = t;
    }
    if (input.knowledge !== undefined) v.knowledge = str(input.knowledge, 6000);
    if (input.storeTranscripts !== undefined) v.storeTranscripts = bool(input.storeTranscripts, false);
    if (input.retentionDays !== undefined) v.retentionDays = int(input.retentionDays, v.retentionDays, 1, 365, 'Aufbewahrung in Tagen', e);
    if (input.timezone !== undefined) { if (!isValidTimezone(input.timezone)) e.push('Zeitzone: z.B. Europe/Zurich.'); else v.timezone = input.timezone; }
    return { ok: e.length === 0, errors: e, value: v };
}
function validateLimits(input = {}, current = DEFAULTS.limits) {
    const e = [], v = { ...DEFAULTS.limits, ...current, outboundAllowedPrefixes: [...(current.outboundAllowedPrefixes || DEFAULTS.limits.outboundAllowedPrefixes)] };
    if (input.maxConcurrent !== undefined) v.maxConcurrent = int(input.maxConcurrent, v.maxConcurrent, 1, 8, 'Gleichzeitige Gespräche', e);
    if (input.outboundEnabled !== undefined) v.outboundEnabled = bool(input.outboundEnabled, false);
    if (input.outboundPerDay !== undefined) v.outboundPerDay = int(input.outboundPerDay, v.outboundPerDay, 0, 500, 'Ausgehende Anrufe in 24 Stunden', e);
    if (input.outboundPerMinute !== undefined) v.outboundPerMinute = int(input.outboundPerMinute, v.outboundPerMinute, 1, 20, 'Ausgehende Anrufe pro Minute', e);
    if (input.outboundHours !== undefined) { if (!parseHours(input.outboundHours)) e.push('Erlaubte Zeit für ausgehende Anrufe: von-bis innerhalb eines Tages, z.B. 08:00-20:00.'); else v.outboundHours = String(input.outboundHours).trim(); }
    if (input.outboundAllowedPrefixes !== undefined) { const r = phone.parsePrefixList(input.outboundAllowedPrefixes); if (r.error) e.push('Erlaubte Länder: ' + r.error); else v.outboundAllowedPrefixes = r.prefixes; }
    return { ok: e.length === 0, errors: e, value: v };
}
function validateAudio(input = {}, current = DEFAULTS.audio) {
    const e = [], v = { ...DEFAULTS.audio, ...current };
    if (input.gain !== undefined) { const g = Number(input.gain); if (!Number.isFinite(g) || g < 0.3 || g > 2) e.push('Lautstärke: eine Zahl von 0.3 bis 2 (1 = unverändert).'); else v.gain = Math.round(g * 100) / 100; }
    if (input.sensitivity !== undefined) { if (!SENSITIVITY[input.sensitivity]) e.push('Empfindlichkeit: normal, laut (laute Umgebung) oder leise.'); else v.sensitivity = input.sensitivity; }
    if (input.idlePromptSec !== undefined) v.idlePromptSec = int(input.idlePromptSec, v.idlePromptSec, 3, 60, 'Nachfragen nach Sekunden Stille', e);
    if (input.maxCallMin !== undefined) v.maxCallMin = int(input.maxCallMin, v.maxCallMin, 1, 60, 'Höchstdauer eines Gesprächs in Minuten', e);
    return { ok: e.length === 0, errors: e, value: v };
}
// url: Adresse von AuraChat; apiKey: leer = bisherigen behalten
function validateAurachat(input = {}, current = DEFAULTS.aurachat) {
    const e = [], v = { ...DEFAULTS.aurachat, ...current };
    if (input.url !== undefined) {
        const u = str(input.url, 300).trim();
        if (u) { try { const p = new URL(u); if (!/^https?:$/.test(p.protocol)) throw new Error(); if (p.username || p.password) { e.push('Adresse von AuraChat: ohne Benutzername und Passwort (dafür gibt es den API-Schlüssel).'); } else v.url = p.origin + p.pathname.replace(/\/+$/, ''); } catch { e.push('Adresse von AuraChat: z.B. http://192.168.1.10:8091'); } } else v.url = '';
    }
    if (input.model !== undefined) {
        const raw = input.model === null ? '' : input.model, m = typeof raw === 'string' ? raw.trim() : null;   // nur Text; zu langes wird abgelehnt, nicht stillschweigend gekürzt (sonst bekäme man ein anderes Modell als eingetippt)
        if (m === null || (m && !/^[A-Za-z0-9._:\/-]{1,100}$/.test(m))) e.push('Modell fürs Telefon: nur Buchstaben, Ziffern und . _ : / - (höchstens 100 Zeichen, z.B. gemma4:12b); leer = das Modell von AuraChat.'); else v.model = m;
    }
    if (input.warmupMin !== undefined) v.warmupMin = int(input.warmupMin, v.warmupMin, 0, 30, 'Aufwärmen alle ... Minuten (0 = aus)', e);
    if (input.apiKey !== undefined && input.apiKey !== '') { const k = str(input.apiKey, 300).trim(); if (!/^[\x21-\x7e]{8,300}$/.test(k)) e.push('API-Schlüssel: mindestens 8 sichtbare Zeichen ohne Leerzeichen.'); else v.apiKey = k; }
    return { ok: e.length === 0, errors: e, value: v };
}
function validateSecurity(input = {}, current = DEFAULTS.security) {
    const e = [], v = { ...DEFAULTS.security, ...current };
    if (input.twofaRequired !== undefined) v.twofaRequired = bool(input.twofaRequired, false);
    return { ok: e.length === 0, errors: e, value: v };
}
// Adresse von AuraDirect wie die von AuraChat: nur http/https, ohne Zugangsdaten in der Adresse; Dienst-Schlüssel leer = bisherigen behalten
function validateAuradirect(input = {}, current = DEFAULTS.auradirect) {
    const e = [], v = { ...DEFAULTS.auradirect, ...current };
    if (input.url !== undefined) {
        const u = str(input.url, 300).trim();
        if (u) { try { const p = new URL(u); if (!/^https?:$/.test(p.protocol)) throw new Error(); if (p.username || p.password) e.push('Adresse von AuraDirect: ohne Benutzername und Passwort (dafür gibt es den Dienst-Schlüssel).'); else v.url = p.origin + p.pathname.replace(/\/+$/, ''); } catch { e.push('Adresse von AuraDirect: z.B. http://192.168.1.10:4000'); } } else v.url = '';
    }
    if (input.serviceKey !== undefined && input.serviceKey !== '') { const k = str(input.serviceKey, 300).trim(); if (!/^[\x21-\x7e]{8,300}$/.test(k)) e.push('Dienst-Schlüssel: mindestens 8 sichtbare Zeichen ohne Leerzeichen (steht in AuraDirect oben auf der Benutzerseite).'); else v.serviceKey = k; }
    if (input.enabled !== undefined) v.enabled = bool(input.enabled, false);
    if (v.enabled && e.length === 0 && (!v.url || !v.serviceKey)) e.push('AuraDirect einschalten: bitte Adresse und Dienst-Schlüssel eintragen.');
    return { ok: e.length === 0, errors: e, value: v };
}
const maskAuradirect = (a) => ({ enabled: !!a.enabled, url: a.url || '', hasKey: !!a.serviceKey });
// Angaben für die Datenschutzerklärung. Alles nur Text (wird beim Anzeigen maskiert, nie als HTML ausgegeben)
function validatePrivacy(input = {}, current = DEFAULTS.privacy) {
    const e = [], v = { ...DEFAULTS.privacy, ...current }, one = (x, n) => str(x, n).replace(/\s+/g, ' ').trim();
    for (const [k, max, label] of [['controller', 120, 'Verantwortliche Stelle (Name der Firma)'], ['address', 240, 'Adresse'], ['dpo', 200, 'Datenschutzverantwortliche Person']]) if (input[k] !== undefined) v[k] = one(input[k], max + 1).length > max ? (e.push(`${label}: höchstens ${max} Zeichen.`), v[k]) : one(input[k], max);
    if (input.email !== undefined) { const m = one(input.email, 200); if (m && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(m)) e.push('E-Mail-Adresse: z.B. datenschutz@hotel-muster.ch'); else v.email = m; }
    if (input.phone !== undefined) { const m = one(input.phone, 60); if (m && !/^[0-9+()\/ .-]{5,40}$/.test(m)) e.push('Telefon: nur Ziffern, + ( ) / . - und Leerzeichen.'); else v.phone = m; }
    if (input.extra !== undefined) { const t = str(input.extra, 4001); if (t.length > 4000) e.push('Zusätzlicher Text: höchstens 4000 Zeichen.'); else v.extra = t.trim(); }
    return { ok: e.length === 0, errors: e, value: v };
}
const maskAurachat = (a) => ({ url: a.url || '', hasKey: !!a.apiKey, model: a.model || '', warmupMin: a.warmupMin === undefined ? DEFAULTS.aurachat.warmupMin : a.warmupMin });
module.exports = { AI_NOTICE, hasAiNotice, DEFAULTS, SENSITIVITY, parseHours, inOutboundHours, isValidTimezone, localMinutes, validateGeneral, validateLimits, validateAudio, validateAurachat, maskAurachat, validateSecurity, validateAuradirect, maskAuradirect, validatePrivacy };
