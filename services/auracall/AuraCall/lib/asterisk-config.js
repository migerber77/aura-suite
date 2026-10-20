'use strict';
/* AuraCall - erzeugt die Asterisk-Konfiguration (PJSIP-Leitung + Dialplan) aus den Einstellungen.
 * SICHERHEIT: Jedes Feld wird streng geprüft, bevor es in eine Konfigurationsdatei kommt. In Asterisk-Dateien beginnt ";" einen Kommentar, "[...]" einen Abschnitt und
 * jede Zeile ist ein Befehl - ein eingeschleuster Zeilenumbruch im Passwort-Feld könnte die ganze Anlage umbauen. Deshalb: nur erlaubte Zeichen, sonst Fehler. */
const fs = require('fs'), path = require('path');
const phone = require('./phone');

const HOST_RE = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const CIDR_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(3[0-2]|[12]?\d)$/;
const USER_RE = /^[A-Za-z0-9._@+\-]{1,64}$/;
const NAME_RE = /^[A-Za-z0-9 ._\-]{0,30}$/;
const CODECS = ['alaw', 'ulaw'];

const isHost = (v) => typeof v === 'string' && (IPV4_RE.test(v) || (HOST_RE.test(v) && !/^\d+$/.test(v.split('.').pop())));   // Name oder IPv4; kein "Nur-Zahlen"-Name

// Prüft und bereinigt die Leitungs-Einstellungen. Gibt { ok, errors, value } zurück; errors sind Sätze für die Oberfläche.
function validateTrunk(input = {}, { keepPassword } = {}) {
    const e = [], v = {};
    const str = (x) => (x === undefined || x === null ? '' : String(x));
    v.enabled = input.enabled === true || input.enabled === 'true';
    v.host = str(input.host).trim();
    if (v.enabled || v.host) if (!isHost(v.host)) e.push('Server des Anbieters: bitte einen Namen (z.B. sip.anbieter.ch) oder eine IPv4-Adresse eintragen.');
    const port = input.port === undefined || input.port === '' ? 5060 : Number(input.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) e.push('Port: eine Zahl von 1 bis 65535 (üblich 5060).'); v.port = port;
    v.transport = str(input.transport || 'udp').toLowerCase(); if (!['udp', 'tcp'].includes(v.transport)) e.push('Übertragung: "udp" oder "tcp".');
    v.username = str(input.username).trim(); if (v.username && !USER_RE.test(v.username)) e.push('Benutzername: nur Buchstaben, Ziffern und . _ @ + - (höchstens 64 Zeichen).');
    v.authUsername = str(input.authUsername).trim(); if (v.authUsername && !USER_RE.test(v.authUsername)) e.push('Anmeldename: nur Buchstaben, Ziffern und . _ @ + - (höchstens 64 Zeichen).');
    const pw = input.password === undefined || input.password === '' ? (keepPassword || '') : str(input.password);
    if (/[\x00-\x1f\x7f;\\]/.test(pw) || pw.length > 128) e.push('Passwort: keine Zeilenumbrüche und keine Zeichen ; und \\ (die würden die Anlage durcheinanderbringen), höchstens 128 Zeichen.');
    else if (pw !== pw.trim()) e.push('Passwort: kein Leerzeichen am Anfang oder Ende (Asterisk würde es abschneiden, und die Anmeldung beim Anbieter schlüge fehl).');
    v.password = pw;
    v.register = input.register === undefined ? true : (input.register === true || input.register === 'true');
    if (v.enabled && v.register && (!v.username || !v.password)) e.push('Mit Anmeldung beim Anbieter werden Benutzername und Passwort gebraucht.');
    v.fromUser = str(input.fromUser).trim() || v.username; if (v.fromUser && !USER_RE.test(v.fromUser)) e.push('Absender (From-Benutzer): nur Buchstaben, Ziffern und . _ @ + -.');
    v.fromDomain = str(input.fromDomain).trim() || v.host; if (v.fromDomain && !isHost(v.fromDomain)) e.push('Absender-Domäne: ein Servername.');
    const ka = input.keepaliveSec === undefined || input.keepaliveSec === '' ? 0 : Number(input.keepaliveSec); if (!Number.isInteger(ka) || (ka !== 0 && (ka < 10 || ka > 120))) e.push('Haltesignal: 0 (aus) oder 10 bis 120 Sekunden (üblich 25).'); v.keepaliveSec = ka;
    const exp = input.expirationSec === undefined || input.expirationSec === '' ? 600 : Number(input.expirationSec); if (!Number.isInteger(exp) || exp < 60 || exp > 7200) e.push('Anmeldung erneuern alle: 60 bis 7200 Sekunden.'); v.expirationSec = exp;
    const cc = phone.cleanCountryCode(input.defaultCountryCode === undefined || input.defaultCountryCode === '' ? '41' : input.defaultCountryCode); if (!cc) e.push('Landesvorwahl: 1 bis 3 Ziffern (Schweiz 41).'); v.defaultCountryCode = cc || '41';
    v.dialFormat = str(input.dialFormat || 'e164plus'); if (!['e164plus', 'e164', 'national'].includes(v.dialFormat)) e.push('Nummernschreibweise: +41…, 41… oder 0…');
    v.callerIdName = str(input.callerIdName === undefined ? 'Aura' : input.callerIdName).trim(); if (!NAME_RE.test(v.callerIdName)) e.push('Name beim Angerufenen: höchstens 30 Zeichen, nur Buchstaben, Ziffern, Leerzeichen und . _ -.');
    v.callerIdOut = str(input.callerIdOut).trim(); if (v.callerIdOut) { const n = phone.normalizeNumber(v.callerIdOut, v.defaultCountryCode); if (!n) e.push('Eigene Nummer beim Angerufenen: eine gültige Nummer (z.B. +41441234567).'); else v.callerIdOut = n; }
    const list = (x) => (Array.isArray(x) ? x : str(x).split(/[\s,;]+/)).map(s => String(s).trim()).filter(Boolean);       // Netze/Server: durch Leerzeichen, Komma oder Strichpunkt getrennt
    const numList = (x) => (Array.isArray(x) ? x : str(x).split(/[,;\n]+/)).map(s => String(s).trim()).filter(Boolean);       // Rufnummern: NUR durch Komma, Strichpunkt oder Zeilenumbruch (Leerzeichen gehören zur Nummer: "+41 44 123 45 67")
    v.dids = []; for (const d of numList(input.dids)) { const n = phone.normalizeNumber(d, v.defaultCountryCode); if (!n) e.push(`Eigene Rufnummer "${d.slice(0, 25)}" ist ungültig.`); else if (!v.dids.includes(n)) v.dids.push(n); }
    v.acceptAll = input.acceptAll === undefined ? true : (input.acceptAll === true || input.acceptAll === 'true');
    if (v.enabled && !v.acceptAll && v.dids.length === 0) e.push('"Nur diese Nummern annehmen" braucht mindestens eine eigene Rufnummer.');
    v.publicAddress = str(input.publicAddress).trim(); if (v.publicAddress && !isHost(v.publicAddress)) e.push('Öffentliche Adresse: eine IPv4-Adresse oder ein Name (leer lassen, wenn der Server direkt im Internet steht).');
    v.localNets = list(input.localNets); for (const c of v.localNets) if (!CIDR_RE.test(c)) e.push(`Heimnetz "${c.slice(0, 25)}": Schreibweise wie 192.168.1.0/24.`);
    v.extraMatch = list(input.extraMatch); for (const m of v.extraMatch) if (!(isHost(m) || CIDR_RE.test(m))) e.push(`Zusätzlicher Anbieter-Server "${m.slice(0, 25)}": Name, IPv4-Adresse oder Netz (192.0.2.0/24).`);
    if (v.localNets.length > 20 || v.extraMatch.length > 20 || v.dids.length > 50) e.push('Zu viele Einträge in einer Liste (höchstens 20 bzw. 50).');
    return { ok: e.length === 0, errors: e, value: v };
}

function lines(...a) { return a.flat().filter(x => x !== null && x !== undefined && x !== false).join('\n') + '\n'; }

function renderPjsip(t) {
    const hostPort = t.port === 5060 ? t.host : `${t.host}:${t.port}`, hasAuth = !!(t.username && t.password);
    const authUser = t.authUsername || t.username, userPart = t.username || t.fromUser;
    return lines(
        '; AuraCall - automatisch erzeugt. NICHT von Hand ändern: wird bei "Anwenden" in AuraCall überschrieben.',
        '',
        '[auracall-transport]', 'type=transport', `protocol=${t.transport}`, 'bind=0.0.0.0:5060',
        t.publicAddress ? `external_media_address=${t.publicAddress}` : null, t.publicAddress ? `external_signaling_address=${t.publicAddress}` : null,
        t.localNets.map(n => `local_net=${n}`), '',
        hasAuth ? lines('[auracall-auth]', 'type=auth', 'auth_type=userpass', `username=${authUser}`, `password=${t.password}`, '') : null,
        t.register && hasAuth ? lines('[auracall-reg]', 'type=registration', 'transport=auracall-transport', 'outbound_auth=auracall-auth', `server_uri=sip:${hostPort}`, `client_uri=sip:${t.username}@${t.host}`,
            `contact_user=${t.username}`, 'retry_interval=60', 'forbidden_retry_interval=600', `expiration=${t.expirationSec}`, '') : null,
        '[auracall-trunk]', 'type=aor', `contact=sip:${hostPort}`,
        // Haltesignal: alle N Sekunden eine kleine Anfrage (OPTIONS) an den Anbieter. Hält die Umsetzung in Router/Firewall offen, über die der Anbieter eingehende Anrufe schickt (UDP-Verbindungen werden dort nach ca. 60 s Stille vergessen). 0 = aus.
        `qualify_frequency=${t.keepaliveSec || 0}`, t.keepaliveSec ? 'qualify_timeout=3.0' : null, '',
        '[auracall-trunk]', 'type=endpoint', 'transport=auracall-transport', 'context=auracall-in', 'disallow=all', `allow=${t.codecs ? t.codecs.join(',') : CODECS.join(',')}`,
        hasAuth ? 'outbound_auth=auracall-auth' : null, 'aors=auracall-trunk', userPart ? `from_user=${userPart}` : null, `from_domain=${t.fromDomain || t.host}`,
        'direct_media=no', 'rtp_symmetric=yes', 'force_rport=yes', 'rewrite_contact=yes', 'dtmf_mode=rfc4733', 'ice_support=no', 'media_encryption=no', 'language=de',
        t.callerIdOut ? `callerid="${t.callerIdName || 'Aura'}" <${t.callerIdOut}>` : null, '',
        '[auracall-trunk]', 'type=identify', 'endpoint=auracall-trunk', `match=${t.host}`, t.extraMatch.map(m => `match=${m}`)
    );
}

function renderDialplan(t, { audioHost = '127.0.0.1', audioPort = 9092 } = {}) {
    const entry = [];
    if (t.acceptAll) entry.push('exten => _.,1,NoOp(AuraCall: Anruf von ${CALLERID(num)} an ${EXTEN})', ' same => n,Set(AURACALL_DID=${EXTEN})', ' same => n,Goto(auracall-aura,s,1)');
    else {
        for (const did of t.dids) for (const v of phone.didVariants(did, t.defaultCountryCode)) entry.push(`exten => ${v},1,Set(AURACALL_DID=${did})`, ' same => n,Goto(auracall-aura,s,1)');
        entry.push('exten => _.,1,NoOp(AuraCall: Anruf an unbekannte Nummer ${EXTEN} abgewiesen)', ' same => n,Hangup(1)');
    }
    return lines(
        '; AuraCall - automatisch erzeugt. NICHT von Hand ändern: wird bei "Anwenden" in AuraCall überschrieben.',
        '',
        '[auracall-in]', entry, '',
        '[auracall-aura]',
        'exten => s,1,Answer()',
        // Kennung des Gesprächs im UUID-Format (8-4-4-4-12): aus der eindeutigen Kennung des Kanals per MD5 gebildet. MD5() gibt es in jedem Asterisk; bei UUID() wäre das nicht sicher.
        ' same => n,Set(AUH=${MD5(${UNIQUEID}-${CHANNEL})})',
        ' same => n,Set(AURACALL_UUID=${AUH:0:8}-${AUH:8:4}-${AUH:12:4}-${AUH:16:4}-${AUH:20:12})',
        ' same => n,UserEvent(AuraCallIn,Uuid: ${AURACALL_UUID},Caller: ${FILTER(0-9+*#,${CALLERID(num)})},Did: ${FILTER(0-9+*#,${AURACALL_DID})},Channel: ${CHANNEL})',
        ` same => n,AudioSocket(\${AURACALL_UUID},${audioHost}:${audioPort})`,
        ' same => n,Hangup()', '',
        '[auracall-out]',
        'exten => s,1,NoOp(AuraCall: ausgehend ${AURACALL_UUID})',
        ' same => n,UserEvent(AuraCallOut,Uuid: ${AURACALL_UUID},Channel: ${CHANNEL})',
        ` same => n,AudioSocket(\${AURACALL_UUID},${audioHost}:${audioPort})`,
        ' same => n,Hangup()'
    );
}

// Beide Dateien: { 'pjsip_auracall.conf': ..., 'extensions_auracall.conf': ... }
function renderAll(trunk, opts) { return { 'pjsip_auracall.conf': renderPjsip(trunk), 'extensions_auracall.conf': renderDialplan(trunk, opts) }; }
// Für die Anzeige: Passwort verdecken
const mask = (text) => text.replace(/^(password=).*$/mg, '$1********');

// Atomar schreiben (erst temporäre Datei, dann umbenennen): Asterisk liest nie eine halbe Datei
function writeFiles(dir, files) {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
        if (!/^[a-z_]+\.conf$/.test(name)) throw new Error('Ungültiger Dateiname');
        const target = path.join(dir, name), tmp = target + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, content, { mode: 0o640 }); fs.renameSync(tmp, target);
    }
}

// Kleiner Leser für Asterisk-Dateien (für Prüfungen): Abschnitte [name], "Schlüssel=Wert" und "exten => ..." ; Kommentare mit ";" (ausser "\;")
function parseConf(text) {
    const sections = []; let cur = null;
    for (const raw of text.split('\n')) {
        const line = raw.replace(/(^|[^\\]);.*$/, '$1').trim(); if (!line) continue;
        const m = /^\[([^\]]+)\]$/.exec(line); if (m) { cur = { name: m[1], entries: [] }; sections.push(cur); continue; }
        if (!cur) throw new Error('Zeile ausserhalb eines Abschnitts: ' + line);
        const i = line.indexOf('='); if (i <= 0) throw new Error('Keine gültige Zeile: ' + line);
        const k = line.slice(0, i).trim(), val = line.slice(i + 1).trim(); cur.entries.push([k, val.replace(/\\;/g, ';')]);
    }
    return sections;
}
module.exports = { validateTrunk, renderPjsip, renderDialplan, renderAll, mask, writeFiles, parseConf, isHost, CODECS };
