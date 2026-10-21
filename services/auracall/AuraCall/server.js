'use strict';
/* AuraCall - Telefon-Anbindung für AuraChat: Aura nimmt Anrufe an und ruft an (über Asterisk).
 * Läuft ohne fremde Pakete, nur mit Node.js. Verwaltung im Browser (Port AURACALL_PORT), Asterisk-Anbindung über AMI und AudioSocket (nur lokal). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Db, randomPassword, passwordProblem } = require('./lib/db');
const { Ami } = require('./lib/ami');
const { AudioSocketServer } = require('./lib/audiosocket');
const { Manager, ManagerError } = require('./lib/manager');
const { WebApp, HttpError, RateLimiter } = require('./lib/web');
const ast = require('./lib/asterisk-config');
const { Auth } = require('./lib/auth');
const { AuraDirect } = require('./lib/auradirect');
const totp = require('./lib/totp');
const qr = require('./lib/qr');
const { renderPrivacy, privacyText, pickLang } = require('./lib/privacy');
const { License, DEFAULT_CHECKIN_HOST, versionOlder } = require('./lib/license');

const VERSION = require('./package.json').version;
// Aura-Suite-Version, die der Betreiber setzt (Umgebungswert AURA_SUITE_VERSION); Anzeige in "Über Aura-Suite"
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
const toHttp = (e) => {
    if (!(e instanceof ManagerError)) return e;
    const bad = ['NUMBER', 'BLOCKED', 'COUNTRY', 'PURPOSE', 'TIME', 'INVALID', 'SECTION'], conflict = ['DISABLED', 'HOURS', 'LIMIT', 'BUSY', 'NOT_READY', 'CONFIG'];
    if (e.code === 'LICENSE') return new HttpError(402, e.message, { details: e.code, licenseRequired: true });
    return new HttpError(bad.includes(e.code) ? 400 : conflict.includes(e.code) ? 409 : 502, e.message, { details: e.code });
};
const callId = (x) => { const n = Number(x); if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(404, 'Anruf nicht gefunden.'); return n; };
// Nur Text und Zahlen werden angenommen; Listen, Objekte, Wahrheitswerte ergeben "leer" (sonst würde z.B. ["0791234567"] stillschweigend zu "0791234567")
const text = (x, max = 500) => (typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, max) : '');

// Baut alles zusammen. cfg: Einstellungen aus der Umgebung (für Tests einzeln überschreibbar).
function createServer(cfg = {}) {
    const c = {
        dataDir: '/data', confDir: '/asterisk-conf', amiHost: '127.0.0.1', amiPort: 5038, amiUser: 'auracall', amiSecret: '', audioHost: '127.0.0.1', audioPort: 9092, audioRate: 8000,
        port: 8110, bind: '0.0.0.0', trustProxy: false, adminPassword: '', staticDir: path.join(__dirname, 'html'), log: console.log, licenseSecret: '', checkinHost: '', checkinUrl: '', ...cfg
    };
    const db = new Db(c.dataDir === ':memory:' ? ':memory:' : path.join(c.dataDir, 'auracall.db'));
    // Lizenz (Schlüssel prüfen, Probezeit, Rückmeldung beim Lizenzserver); ohne gültige Lizenz keine Anrufe
    const license = new License({ db, secret: c.licenseSecret, now: c.now || Date.now, fetchImpl: c.fetchImpl, checkinHost: c.checkinHost, checkinUrl: c.checkinUrl, version: VERSION, suiteInstalled: AURA_SUITE_INSTALLED || '', counts: () => { const n = db.userCount(); return { totalUsers: n, totalAdmins: n }; }, log: c.log, ...(c.licenseOptions || {}) });
    const ami = new Ami({ host: c.amiHost, port: c.amiPort, username: c.amiUser, secret: c.amiSecret, ...(c.amiOptions || {}) });
    const audio = new AudioSocketServer({ host: c.audioHost, port: c.audioPort, maxConnections: 8 });
    const mgr = new Manager({ db, ami, audio, confDir: c.confDir, audioHost: c.audioHostForAsterisk || c.audioHost, audioPort: c.audioPort, audioRate: c.audioRate, logger: c.log, licenseOk: () => license.allows(), licenseText: () => license.message(), ...(c.managerOptions || {}) });
    const app = new WebApp({ db, staticDir: c.staticDir, trustProxy: c.trustProxy, serviceKeyCheck: (k) => mgr.serviceKeyCheck(k), licenseGuard: () => { const ok = license.allows(); return { ok, message: ok ? '' : license.message() }; }, logger: c.log, ...(c.webOptions || {}) });
    const loginLimiter = new RateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), outboundLimiter = new RateLimiter({ windowMs: 60 * 1000, max: 10 });
    const pwFile = c.dataDir === ':memory:' ? null : path.join(c.dataDir, 'INITIAL-ADMIN-PASSWORT.txt');
    const route = (m, p, h, o) => app.route(m, p, async (ctx) => { try { return await h(ctx); } catch (e) { throw toHttp(e); } }, o);
    const directory = new AuraDirect({ fetchImpl: c.fetchImpl, timeoutMs: c.directoryTimeoutMs });
    const clock = c.now || Date.now;   // für Tests einstellbar (Zeitfenster der Einmal-Codes)
    const auth = new Auth({ db, getSettings: () => mgr.settings(), directory, now: clock });
    const twofaLimiter = new RateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });   // gemeinsam für alles rund um die 2FA (Einrichten, Bestätigen, Ausschalten)

    // ---- Anmeldung ----
    // Zwei Schritte ohne Zwischenspeicher auf dem Server: Der Browser schickt beim zweiten Schritt Benutzername, Passwort UND Code noch einmal (so liegt nirgends ein Passwort zwischengespeichert).
    route('POST', '/api/login', async (ctx) => {
        const u = text(ctx.body.username, 80), p = text(ctx.body.password, 300), code = text(ctx.body.code, 40);
        const r = await auth.login({ username: u, password: p, code });
        if (r.requires2fa) return { requires2fa: true, via: r.via };
        if (!r.ok) { db.audit(u.slice(0, 40), r.code === 'code' ? 'login-2fa-fehlgeschlagen' : 'login-fehlgeschlagen', ctx.ip); throw new HttpError(r.status, r.message, r.retryInMs ? { retryInMs: r.retryInMs } : {}); }
        ctx.setSession(db.createSession(r.user.id), 12 * 3600); db.audit(r.user.username, r.via === 'auradirect' ? 'login-auradirect' : 'login', ctx.ip);
        if (r.usedRecovery !== undefined) db.audit(r.user.username, '2fa-notfallcode-benutzt', `noch ${r.usedRecovery} übrig`);
        return { user: { username: r.user.username, mustChange: r.user.mustChange, mustSetup2fa: auth.needsSetup(r.user), source: r.user.source }, ...(r.usedRecovery !== undefined ? { usedRecovery: r.usedRecovery } : {}) };
    }, { auth: 'none', limiter: loginLimiter });
    route('POST', '/api/logout', (ctx) => { db.destroySession(ctx.token); ctx.clearSession(); return { ok: true }; }, { license: false, allowMustChange: true });
    route('GET', '/api/me', (ctx) => ({ user: { username: ctx.user.username, mustChange: ctx.user.mustChange, mustSetup2fa: ctx.user.mustSetup2fa, source: ctx.user.source, twofaEnabled: ctx.user.twofaEnabled, displayName: ctx.user.displayName }, version: VERSION }), { license: false, allowMustChange: true });
    // ---- Datenschutz beim ersten Login: Text und Prüfwert kommen aus der automatisch erzeugten Erklärung (/datenschutz), sie sagt also nie etwas anderes, als das Programm tut ----
    const privacyNow = () => { const text = privacyText(mgr.settings(), { lang: 'de', checkin: license.checkinEnabled() }); return { text, version: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) }; };
    route('GET', '/api/privacy-policy', (ctx) => { const p = privacyNow(); return { text: p.text, version: p.version, accepted: db.getUserPrivacy(ctx.user.id) === p.version }; }, { license: false });
    route('POST', '/api/privacy-policy/accept', (ctx) => {
        const p = privacyNow(), seen = ctx.body && ctx.body.version;
        if (seen !== undefined && String(seen) !== p.version) throw new HttpError(409, 'Die Datenschutzerklärung wurde inzwischen geändert. Bitte die Seite neu laden und die neue Fassung lesen.');
        db.setUserPrivacy(ctx.user.id, p.version); db.audit(ctx.user.username, 'datenschutz-bestaetigt', p.version); return { success: true, version: p.version };
    }, { license: false });
    route('POST', '/api/password', async (ctx) => {
        if (ctx.user.source !== 'local') throw new HttpError(400, 'Das Passwort dieses Kontos wird in AuraDirect verwaltet.');
        const r = await db.changePassword(ctx.user.id, text(ctx.body.oldPassword, 300), text(ctx.body.newPassword, 300));
        if (!r.ok) throw new HttpError(400, r.error);
        ctx.setSession(db.createSession(ctx.user.id), 12 * 3600); db.audit(ctx.user.username, 'passwort-geaendert', ctx.ip);
        if (pwFile) { try { fs.unlinkSync(pwFile); } catch { /* war nicht da */ } }
        return { ok: true };
    }, { license: false, allowMustChange: true });
    // ---- Zwei-Faktor-Anmeldung (eigenes Konto) ----
    const reauthFail = (r) => { throw new HttpError(r.reason === 'gesperrt' ? 429 : 401, r.reason === 'gesperrt' ? `Zu viele Fehlversuche. Dieses Konto ist für ${Math.ceil(r.retryInMs / 60000)} Minuten gesperrt.` : r.reason === 'code' ? 'Der Code stimmt nicht, ist abgelaufen oder wurde schon verwendet (jeder Code gilt nur einmal; bitte den nächsten abwarten).' : 'Das Passwort stimmt nicht.', r.retryInMs ? { retryInMs: r.retryInMs } : {}); };
    route('GET', '/api/2fa', (ctx) => ({ ...db.twofaStatus(ctx.user.id), mustSetup: !!ctx.user.mustSetup2fa }), { license: false, allowMustChange: true });
    route('POST', '/api/2fa/setup', (ctx) => { const r = db.twofaBegin(ctx.user.id); if (!r.ok) throw new HttpError(400, r.error); const q = qr.encode(r.uri, { ecl: 'M' }); return { secret: totp.groupSecret(r.secret), uri: r.uri, qr: { size: q.size, rows: qr.toRows(q) } }; }, { license: false, allowMustChange: true, limiter: twofaLimiter });
    route('POST', '/api/2fa/enable', (ctx) => {
        const r = db.twofaConfirm(ctx.user.id, text(ctx.body.code, 20), clock()); if (!r.ok) throw new HttpError(400, r.error);
        ctx.setSession(db.createSession(ctx.user.id), 12 * 3600); db.audit(ctx.user.username, '2fa-aktiviert', ctx.ip);   // alle bisherigen Anmeldungen sind beendet, diese hier wird neu angelegt
        return { recoveryCodes: r.recoveryCodes };
    }, { license: false, allowMustChange: true, limiter: twofaLimiter });
    route('POST', '/api/2fa/disable', async (ctx) => {
        const r = await db.reauth(ctx.user.id, text(ctx.body.password, 300), text(ctx.body.code, 40), clock()); if (!r.ok) reauthFail(r);
        db.twofaDisable(ctx.user.id); ctx.setSession(db.createSession(ctx.user.id), 12 * 3600); db.audit(ctx.user.username, '2fa-deaktiviert', ctx.ip); return { ok: true };
    }, { license: false, limiter: twofaLimiter });
    route('POST', '/api/2fa/recovery', async (ctx) => {
        const r = await db.reauth(ctx.user.id, text(ctx.body.password, 300), text(ctx.body.code, 40), clock()); if (!r.ok) reauthFail(r);
        const codes = db.newRecoveryCodes(ctx.user.id); if (!codes) throw new HttpError(400, 'Die Zwei-Faktor-Anmeldung ist nicht eingerichtet.'); db.audit(ctx.user.username, '2fa-notfallcodes-erneuert', ctx.ip); return { recoveryCodes: codes };
    }, { license: false, limiter: twofaLimiter });
    // ---- Konten ----
    const userId = (x) => { const n = Number(x); if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(404, 'Konto nicht gefunden.'); return n; };
    route('GET', '/api/users', () => ({ items: db.listUsers() }));
    route('POST', '/api/users/:id/2fa/reset', (ctx) => {
        const id = userId(ctx.params.id), u = db.getUser(id); if (!u) throw new HttpError(404, 'Konto nicht gefunden.');
        if (id === ctx.user.id) throw new HttpError(400, 'Für das eigene Konto bitte "Ausschalten" verwenden (mit Passwort und Code).');
        if (u.source !== 'local') throw new HttpError(400, 'Die Zwei-Faktor-Anmeldung dieses Kontos wird zentral in AuraDirect verwaltet.');
        db.twofaDisable(id); db.audit(ctx.user.username, '2fa-zurueckgesetzt', u.username); return { ok: true };
    });
    route('DELETE', '/api/users/:id', (ctx) => {
        const id = userId(ctx.params.id), u = db.getUser(id); if (!u) throw new HttpError(404, 'Konto nicht gefunden.');
        if (id === ctx.user.id) throw new HttpError(400, 'Das eigene Konto kann nicht entfernt werden.');
        if (u.source === 'local' && db.listUsers().filter(x => x.source === 'local').length <= 1) throw new HttpError(400, 'Das letzte lokale Konto (Notzugang) kann nicht entfernt werden.');
        db.removeUser(id); db.audit(ctx.user.username, 'benutzer-entfernt', u.username); return { ok: true };
    });
    route('POST', '/api/auradirect/test', async () => { const a = mgr.settings().auradirect; if (!a.url || !a.serviceKey) throw new HttpError(400, 'Bitte zuerst Adresse und Dienst-Schlüssel eintragen und speichern.'); return directory.test({ url: a.url, key: a.serviceKey }); });
    // Datenschutzerklärung: öffentlich lesbar (auch für Personen, die uns anrufen), gebaut aus den echten Einstellungen
    app.page('/datenschutz', ({ query, req }) => renderPrivacy(mgr.settings(), { lang: pickLang(query, req), checkin: license.checkinEnabled() }));
    // ---- Lizenz ----
    route('GET', '/api/license', () => ({ ...license.info(), checkin: license.checkinStatus(), sync: license.sync ? license.sync.status() : null }), { license: false });
    // "Über Aura-Suite": installierte Version, die Aura-Suite-Version des Betreibers und die aktuelle Version vom Lizenzserver (auch bei abgelaufener Lizenz erreichbar)
    route('GET', '/api/version', () => { const suite = license.suiteInfo(); return { product: 'AuraCall', installed: VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite, updateAvailable: !!(suite && versionOlder(VERSION, suite.version)) }; }, { license: false });
    // Lizenz eintragen/entfernen gibt es hier nicht mehr: die Lizenz wird zentral in AuraControl eingetragen und von dort abgeholt (lib/aura-license-sync.js)
    route('GET', '/api/health', () => ({ ok: true }), { auth: 'none' });

    // ---- Übersicht und Einstellungen ----
    route('GET', '/api/status', () => mgr.status());
    route('GET', '/api/settings', () => mgr.publicSettings());
    route('PUT', '/api/settings/:section', (ctx) => {
        const r = mgr.saveSettings(ctx.params.section, ctx.body, ctx.user.username);
        if (!r.ok) throw new HttpError(400, r.errors[0], { details: r.errors });
        return mgr.publicSettings();
    });
    route('POST', '/api/aurachat/test', () => mgr.checkAurachat());
    route('GET', '/api/trunk/preview', () => { const { v, files } = mgr.trunkFiles(); if (!files) return { ok: false, errors: v.errors }; return { ok: true, files: Object.fromEntries(Object.entries(files).map(([k, t]) => [k, ast.mask(t)])) }; });
    route('POST', '/api/trunk/apply', (ctx) => mgr.applyTrunk(ctx.user.username));
    route('POST', '/api/service-key', (ctx) => ({ key: mgr.rotateServiceKey(ctx.user.username) }));
    route('GET', '/api/audit', () => ({ items: db.recentAudit(50) }));

    // ---- Anrufe ----
    route('GET', '/api/calls', (ctx) => db.listCalls({ limit: ctx.query.limit, offset: ctx.query.offset, direction: ctx.query.direction }));
    route('GET', '/api/calls/:id', (ctx) => { const call = db.getCall(callId(ctx.params.id)); if (!call) throw new HttpError(404, 'Anruf nicht gefunden.'); return call; });
    route('DELETE', '/api/calls/:id', (ctx) => { const id = callId(ctx.params.id), call = db.getCall(id); if (!call) throw new HttpError(404, 'Anruf nicht gefunden.'); if (['active', 'dialing'].includes(call.outcome)) throw new HttpError(409, 'Ein laufender Anruf kann nicht gelöscht werden.'); db.deleteCall(id); db.audit(ctx.user.username, 'anruf-geloescht', String(id)); return { ok: true }; });
    route('POST', '/api/calls/:id/hangup', (ctx) => { if (!mgr.hangupCall(callId(ctx.params.id))) throw new HttpError(404, 'Dieser Anruf läuft nicht (mehr).'); db.audit(ctx.user.username, 'aufgelegt', ctx.params.id); return { ok: true }; });
    const outbound = async (ctx, source, user) => {
        const number = text(ctx.body.number, 60), purpose = text(ctx.body.purpose, 1000);
        if (ctx.body.when !== undefined && ctx.body.when !== null && ctx.body.when !== '') {
            const t = typeof ctx.body.when === 'number' ? ctx.body.when : Date.parse(String(ctx.body.when));
            const r = mgr.scheduleCall({ number, purpose, runAt: t, user }); return { scheduled: true, id: r.id, number: r.number, runAt: r.runAt };
        }
        const r = await mgr.placeCall({ number, purpose, user, source }); return { scheduled: false, id: r.id, number: r.number };
    };
    route('POST', '/api/outbound', (ctx) => outbound(ctx, 'manual', ctx.user.username), { limiter: outboundLimiter });
    route('POST', '/api/service/outbound', (ctx) => outbound(ctx, 'service', 'service'), { auth: 'service', limiter: outboundLimiter });
    route('GET', '/api/service/status', () => { const s = mgr.status(); return { asterisk: s.asterisk.connected, trunk: s.trunk.ready, activeCalls: s.calls.active.length }; }, { auth: 'service' });
    route('GET', '/api/scheduled', () => ({ items: db.listScheduled() }));
    route('DELETE', '/api/scheduled/:id', (ctx) => { if (!db.deleteScheduled(callId(ctx.params.id))) throw new HttpError(404, 'Nicht gefunden oder schon erledigt.'); db.audit(ctx.user.username, 'plan-geloescht', ctx.params.id); return { ok: true }; });

    // Erststart: Verwaltungs-Konto mit ZUFÄLLIGEM Anfangspasswort (kein "admin/admin"), das beim ersten Anmelden geändert werden muss
    async function ensureAdmin() {
        if (db.userCount() > 0) return null;
        const given = c.adminPassword && !passwordProblem(c.adminPassword, 'admin') ? c.adminPassword : '', pw = given || randomPassword(16);
        await db.createUser('admin', pw, { mustChange: true });
        if (!given) {
            if (pwFile) { fs.writeFileSync(pwFile, `Erste Anmeldung bei AuraCall\nBenutzer:  admin\nPasswort:  ${pw}\n\nDas Passwort muss beim ersten Anmelden geändert werden. Diese Datei wird danach gelöscht.\n`, { mode: 0o600 }); }
            c.log(`AuraCall: Erster Start. Anmeldung mit Benutzer "admin" und Passwort "${pw}" (muss beim ersten Anmelden geändert werden).`);
        } else c.log('AuraCall: Erster Start. Anmeldung mit Benutzer "admin" und dem Passwort aus ADMIN_PASSWORD (muss beim ersten Anmelden geändert werden).');
        return given ? null : pw;
    }
    // Notfall: Handy weg und keine Notfall-Codes mehr? AURACALL_RESET_2FA=<Benutzername> in der .env setzen und neu starten; das schaltet die 2FA dieses lokalen Kontos aus (Zugriff auf die .env des Servers heisst Zugriff als Betreiber). Danach die Zeile wieder entfernen.
    function resetTwofaFromEnv() {
        if (!c.reset2fa) return;
        for (const name of String(c.reset2fa).split(',').map(x => x.trim()).filter(Boolean)) {
            const id = db.idByUsername(name), u = id === null ? null : db.getUser(id);
            if (!u) { c.log(`AuraCall: AURACALL_RESET_2FA: Das Konto "${name}" gibt es nicht.`); continue; }
            if (u.source !== 'local') { c.log(`AuraCall: AURACALL_RESET_2FA: "${name}" wird in AuraDirect verwaltet (dort zurücksetzen).`); continue; }
            db.twofaDisable(id); db.audit('system', '2fa-zurueckgesetzt', `${name} (AURACALL_RESET_2FA)`);
            c.log(`AuraCall: Die Zwei-Faktor-Anmeldung von "${name}" wurde zurückgesetzt. Bitte AURACALL_RESET_2FA jetzt wieder aus der .env entfernen.`);
        }
    }
    async function start() {
        // Beginn der Probezeit festhalten und die Rückmeldung beim Lizenzserver planen
        license.installDate(); license.start(); if (!c.noLicenseSync) license.startSync();
        await ensureAdmin(); resetTwofaFromEnv(); await audio.listen(); mgr.audioPort = audio.port; mgr.start(); ami.start();   // der tatsächliche Port kommt in den Dialplan
        const port = await app.listen(c.port, c.bind); c.log(`AuraCall ${VERSION} läuft: Verwaltung auf Port ${port}, AudioSocket auf ${c.audioHost}:${audio.port}.`);
        return { port, audioPort: audio.port };
    }
    async function stop() { license.stop(); mgr.stop(); ami.stop(); await app.close(); await audio.close(); db.close(); }
    return { start, stop, app, mgr, db, ami, audio, ensureAdmin, auth, directory, license, limiters: { login: loginLimiter, outbound: outboundLimiter, twofa: twofaLimiter } };
}

if (require.main === module) {
    const e = process.env, num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
    if (!e.AMI_SECRET) { console.error('FEHLER: AMI_SECRET ist nicht gesetzt (Passwort für die Steuerung von Asterisk). Bitte ./setup.sh ausführen oder in der .env eintragen.'); process.exit(1); }
    const srv = createServer({ dataDir: e.DATA_DIR || '/data', confDir: e.ASTERISK_CONF_DIR || '/asterisk-conf', amiHost: e.AMI_HOST || '127.0.0.1', amiPort: num(e.AMI_PORT, 5038), amiUser: e.AMI_USER || 'auracall', amiSecret: e.AMI_SECRET,
        audioHost: e.AUDIOSOCKET_HOST || '127.0.0.1', audioPort: num(e.AUDIOSOCKET_PORT, 9092), audioRate: num(e.AUDIO_RATE, 8000), port: num(e.AURACALL_PORT, 8110), bind: e.AURACALL_BIND || '0.0.0.0', trustProxy: e.TRUST_PROXY === 'true', adminPassword: e.ADMIN_PASSWORD || '', reset2fa: e.AURACALL_RESET_2FA || '',
        licenseSecret: e.LICENSE_SECRET || '', checkinHost: e.LICENSE_CHECKIN_HOST !== undefined ? e.LICENSE_CHECKIN_HOST : DEFAULT_CHECKIN_HOST });   // LICENSE_CHECKIN_HOST leer = Standard-Lizenzserver (die Rückmeldung ist nicht abschaltbar)
    srv.start().catch((err) => { console.error('AuraCall konnte nicht starten:', err.message); process.exit(1); });
    let stopping = false; const bye = () => { if (stopping) return; stopping = true; srv.stop().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
    process.on('SIGTERM', bye); process.on('SIGINT', bye);
    process.on('unhandledRejection', (err) => console.error('Unbehandelter Fehler:', err && err.stack || err));
}
module.exports = { createServer, toHttp };
