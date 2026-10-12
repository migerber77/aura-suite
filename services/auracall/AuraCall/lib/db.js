'use strict';
/* AuraCall - Datenbank (SQLite, in Node.js eingebaut: node:sqlite) und alles, was Passwörter und Anmeldungen betrifft. */
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const fs = require('fs'), path = require('path');
const totp = require('./totp');

const SESSION_MS = 12 * 60 * 60 * 1000;          // eine Anmeldung gilt 12 Stunden
const LOCK_AFTER = 5, LOCK_MS = 15 * 60 * 1000;  // 5 Fehlversuche -> 15 Minuten gesperrt
const WEAK = new Set(['password', 'passwort', 'admin', 'administrator', 'auracall', 'aurachat', '1234567890', '0123456789', 'qwertzuiop', 'qwertyuiop', 'asdfghjkl', 'passwort123', 'password123', 'admin12345', 'letmein123']);

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const scrypt = (pw, salt, N = 16384) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) { const salt = crypto.randomBytes(16), key = await scrypt(pw, salt); return `scrypt$16384$${salt.toString('base64')}$${key.toString('base64')}`; }
async function verifyPassword(pw, stored) {
    const [alg, n, salt, key] = String(stored || '').split('$'); if (alg !== 'scrypt' || !salt || !key) return false;
    try {
        const sb = Buffer.from(salt, 'base64'), expect = Buffer.from(key, 'base64');
        if (sb.toString('base64') !== salt || expect.toString('base64') !== key) return false;   // nur EXAKT gültiges Base64 (sonst würden angehängte Zeichen nach dem Füllzeichen einfach überlesen)
        const k = await scrypt(String(pw), sb, Number(n)); return k.length === expect.length && crypto.timingSafeEqual(k, expect);
    } catch { return false; }
}
// Regeln für ein Passwort: mindestens 10 Zeichen, nicht der Benutzername, nichts Bekanntes, nicht nur eine Zeichenart
function passwordProblem(pw, username = '') {
    const p = String(pw === undefined || pw === null ? '' : pw);
    if (p.length < 10) return 'Das Passwort braucht mindestens 10 Zeichen.';
    if (p.length > 200) return 'Das Passwort ist zu lang (höchstens 200 Zeichen).';
    if (username && p.toLowerCase().includes(String(username).toLowerCase())) return 'Das Passwort darf den Benutzernamen nicht enthalten.';
    if (WEAK.has(p.toLowerCase())) return 'Dieses Passwort ist zu bekannt. Bitte ein eigenes wählen.';
    if (/^(.)\1+$/.test(p)) return 'Das Passwort darf nicht nur aus einem Zeichen bestehen.';
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
    if (classes < 2) return 'Bitte Buchstaben mit Ziffern oder Sonderzeichen mischen.';
    return null;
}
// Zufälliges Anfangspasswort ohne verwechselbare Zeichen (kein 0/O, 1/l/I)
function randomPassword(len = 16) { const al = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.randomBytes(len); let s = ''; for (let i = 0; i < len; i++) s += al[b[i] % al.length]; return s; }

class Db {
    constructor(file) {
        if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
        this.file = file; this.db = new DatabaseSync(file);
        if (file !== ':memory:') { try { fs.chmodSync(file, 0o600); } catch { /* z.B. Windows */ } }
        this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
        this._loadKey();
        this._migrate();
    }
    // Schlüssel für die verschlüsselte Ablage der 2FA-Geheimnisse: liegt als secret.key NEBEN der Datenbank (nur für den Besitzer lesbar). Wer nur die Datenbank (z.B. aus einer Sicherung) hat, kann damit keine Codes berechnen.
    _loadKey() {
        if (this.file === ':memory:') { this.key = crypto.randomBytes(32); return; }
        const kf = path.join(path.dirname(this.file), 'secret.key');
        try { const hex = fs.readFileSync(kf, 'utf8').trim(); if (/^[0-9a-f]{64}$/.test(hex)) { this.key = Buffer.from(hex, 'hex'); return; } } catch { /* noch keiner da */ }
        this.key = crypto.randomBytes(32); fs.writeFileSync(kf, this.key.toString('hex') + '\n', { mode: 0o600 }); try { fs.chmodSync(kf, 0o600); } catch { /* z.B. Windows */ }
    }
    // AES-256-GCM; "aad" bindet den Wert an seinen Zweck und die Person (ein vertauschter Wert lässt sich nicht öffnen)
    seal(plain, aad = '') { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', this.key, iv); c.setAAD(Buffer.from(String(aad))); const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]); return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.'); }
    open(token, aad = '') { try { const [v, iv, tag, ct] = String(token).split('.'); if (v !== 'v1') return null; const d = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url')); d.setAAD(Buffer.from(String(aad))); d.setAuthTag(Buffer.from(tag, 'base64url')); return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8'); } catch { return null; } }
    _migrate() {
        this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, passwordHash TEXT NOT NULL, mustChange INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0, lockedUntil INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (tokenHash TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE, direction TEXT NOT NULL, number TEXT, did TEXT, purpose TEXT, startedAt INTEGER NOT NULL, answeredAt INTEGER, endedAt INTEGER, durationMs INTEGER, outcome TEXT NOT NULL, turns INTEGER NOT NULL DEFAULT 0, error TEXT, source TEXT);
        CREATE INDEX IF NOT EXISTS calls_started ON calls(startedAt);
        CREATE TABLE IF NOT EXISTS transcripts (id INTEGER PRIMARY KEY AUTOINCREMENT, callId INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE, t INTEGER NOT NULL, who TEXT NOT NULL, text TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS transcripts_call ON transcripts(callId);
        CREATE TABLE IF NOT EXISTS scheduled (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL, purpose TEXT, runAt INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', callId INTEGER, message TEXT, createdBy TEXT, createdAt INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, user TEXT, action TEXT NOT NULL, detail TEXT);
        `);
        // Spalten für Zwei-Faktor-Anmeldung und Konten aus AuraDirect nachrüsten (bestehende Installationen bleiben erhalten)
        const cols = this.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
        const add = (name, ddl) => { if (!cols.includes(name)) this.db.exec(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`); };
        add('source', "TEXT NOT NULL DEFAULT 'local'"); add('displayName', "TEXT NOT NULL DEFAULT ''"); add('twofaSecret', 'TEXT'); add('twofaPending', 'TEXT'); add('twofaEnabled', 'INTEGER NOT NULL DEFAULT 0'); add('twofaLastStep', 'INTEGER NOT NULL DEFAULT 0'); add('recovery', 'TEXT'); add('lastLoginAt', 'INTEGER');
    }
    close() { try { this.db.close(); } catch { /* schon zu */ } }
    // ---- Einstellungen: Werte als JSON ----
    getSetting(key, fallback) { const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key); if (!r) return fallback; try { return JSON.parse(r.value); } catch { return fallback; } }
    setSetting(key, value) { this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value)); }
    allSettings() { const o = {}; for (const r of this.db.prepare('SELECT key, value FROM settings').all()) { try { o[r.key] = JSON.parse(r.value); } catch { /* kaputter Eintrag */ } } return o; }
    // ---- Benutzer ----
    userCount() { return this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c; }
    async createUser(username, password, { mustChange = false } = {}) {
        if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) throw new Error('Benutzername: 3 bis 40 Zeichen, nur Buchstaben, Ziffern und . _ -');
        const hash = await hashPassword(password);
        const r = this.db.prepare('INSERT INTO users (username, passwordHash, mustChange, createdAt) VALUES (?, ?, ?, ?)').run(username, hash, mustChange ? 1 : 0, Date.now());
        return Number(r.lastInsertRowid);
    }
    getUser(id) { const u = this.db.prepare('SELECT id, username, mustChange, source, twofaEnabled, displayName FROM users WHERE id = ?').get(id); return u ? { id: u.id, username: u.username, mustChange: u.mustChange, source: u.source, twofaEnabled: !!u.twofaEnabled, displayName: u.displayName } : null; }   // mustChange wie bisher als 0/1
    _full(id) { return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null; }
    _pub(u) { return { id: u.id, username: u.username, mustChange: !!u.mustChange, source: u.source || 'local', twofaEnabled: !!u.twofaEnabled }; }
    // Ist die Zwei-Faktor-Anmeldung für alle vorgeschrieben und diese (lokale) Person hat sie noch nicht? Konten aus AuraDirect bringen ihre 2FA von dort mit.
    needsTwofaSetup(u) { return (this.getSetting('security', {}) || {}).twofaRequired === true && (u.source || 'local') === 'local' && !u.twofaEnabled; }
    _fail(u, now, reason) {
        const failed = u.failed + 1, lock = failed >= LOCK_AFTER ? now + LOCK_MS : 0;
        this.db.prepare('UPDATE users SET failed = ?, lockedUntil = ? WHERE id = ?').run(lock ? 0 : failed, lock, u.id);
        return lock ? { ok: false, reason: 'gesperrt', retryInMs: LOCK_MS } : { ok: false, reason };
    }
    // Zweiter Faktor: Code der App (jeder Zeitschritt nur einmal) ODER ein Notfall-Code (einmal). Gibt null bei Fehler zurück.
    _checkSecondFactor(u, code, now) {
        const secret = u.twofaSecret ? this.open(u.twofaSecret, 'twofa:' + u.id) : null; if (!secret) return null;
        if (totp.looksLikeRecovery(code)) {
            let hashes; try { hashes = JSON.parse(u.recovery || '[]'); } catch { hashes = []; } const h = totp.hashRecovery(code), i = hashes.indexOf(h);
            if (i < 0) return null; hashes.splice(i, 1); this.db.prepare('UPDATE users SET recovery = ? WHERE id = ?').run(JSON.stringify(hashes), u.id); return { recovery: true, left: hashes.length };
        }
        const step = totp.verify(secret, code, { now, window: 1, lastStep: u.twofaLastStep || 0 }); if (step === null) return null;
        this.db.prepare('UPDATE users SET twofaLastStep = ? WHERE id = ?').run(step, u.id); return { step };
    }
    // Anmelden: gibt { ok, user } oder { ok:false, reason: 'falsch'|'gesperrt'|'code'|'zweiter-faktor', retryInMs } zurück. Gleiche Antwortzeit auch bei unbekanntem Benutzer (kein Rückschluss, ob es ihn gibt).
    // Hat die Person 2FA und es kommt kein Code: reason 'zweiter-faktor' (Passwort stimmte; der Fehlversuchszähler bleibt UNVERÄNDERT und wird erst nach vollständiger Anmeldung zurückgesetzt, sonst liessen sich Codes mit bekanntem Passwort unbegrenzt durchprobieren).
    async login(username, password, now = Date.now(), code) {
        const u = this.db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
        if (!u) { await verifyPassword(password, 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'); return { ok: false, reason: 'falsch' }; }
        if (u.lockedUntil > now) return { ok: false, reason: 'gesperrt', retryInMs: u.lockedUntil - now };
        if (!(await verifyPassword(password, u.passwordHash))) return this._fail(u, now, 'falsch');
        let second = null;
        if (u.twofaEnabled) {
            if (code === undefined || code === null || String(code).trim() === '') return { ok: false, reason: 'zweiter-faktor', needs2fa: true };
            second = this._checkSecondFactor(u, code, now); if (!second) return this._fail(u, now, 'code');
        }
        this.db.prepare('UPDATE users SET failed = 0, lockedUntil = 0, lastLoginAt = ? WHERE id = ?').run(now, u.id);
        return { ok: true, user: this._pub(u), usedRecovery: second && second.recovery ? second.left : undefined };
    }
    // Passwort (und bei eingerichteter 2FA ein Code) erneut verlangen, bevor etwas Sicherheitsrelevantes geändert wird
    async reauth(userId, password, code, now = Date.now()) {
        const u = this._full(userId); if (!u) return { ok: false, reason: 'falsch' };
        if (u.lockedUntil > now) return { ok: false, reason: 'gesperrt', retryInMs: u.lockedUntil - now };
        if (!(await verifyPassword(password, u.passwordHash))) return this._fail(u, now, 'falsch');
        if (u.twofaEnabled && !this._checkSecondFactor(u, code, now)) return this._fail(u, now, 'code');
        this.db.prepare('UPDATE users SET failed = 0, lockedUntil = 0 WHERE id = ?').run(u.id); return { ok: true };
    }
    // ---- Zwei-Faktor-Anmeldung einrichten ----
    twofaStatus(userId) { const u = this._full(userId); if (!u) return null; let left = 0; try { left = JSON.parse(u.recovery || '[]').length; } catch { /* leer */ } return { enabled: !!u.twofaEnabled, source: u.source, recoveryLeft: u.twofaEnabled ? left : 0 }; }
    twofaBegin(userId, issuer = 'AuraCall') {
        const u = this._full(userId); if (!u) throw new Error('Benutzer unbekannt');
        if (u.source !== 'local') return { ok: false, error: 'Die Zwei-Faktor-Anmeldung dieses Kontos wird zentral in AuraDirect verwaltet.' };
        if (u.twofaEnabled) return { ok: false, error: 'Die Zwei-Faktor-Anmeldung ist schon eingerichtet. Zum Neu-Einrichten zuerst ausschalten.' };
        const secret = totp.newSecret(); this.db.prepare('UPDATE users SET twofaPending = ? WHERE id = ?').run(this.seal(secret, 'twofa-pending:' + userId), userId);
        return { ok: true, secret, uri: totp.otpauthUri({ secret, account: u.username, issuer }) };
    }
    twofaConfirm(userId, code, now = Date.now()) {
        const u = this._full(userId); if (!u) throw new Error('Benutzer unbekannt'); if (u.twofaEnabled) return { ok: false, error: 'Die Zwei-Faktor-Anmeldung ist schon eingerichtet.' };
        const pending = u.twofaPending ? this.open(u.twofaPending, 'twofa-pending:' + userId) : null; if (!pending) return { ok: false, error: 'Bitte zuerst auf "Einrichten" klicken und den QR-Code scannen.' };
        const step = totp.verify(pending, code, { now, window: 1 }); if (step === null) return { ok: false, error: 'Der Code stimmt nicht oder ist abgelaufen. Bitte den aktuellen Code der App eingeben.' };
        const codes = totp.recoveryCodes(10);
        this.db.prepare('UPDATE users SET twofaSecret = ?, twofaPending = NULL, twofaEnabled = 1, twofaLastStep = ?, recovery = ? WHERE id = ?').run(this.seal(pending, 'twofa:' + userId), step, JSON.stringify(codes.map(totp.hashRecovery)), userId);
        this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);   // alle bisherigen Anmeldungen enden; der Aufrufer legt die aktuelle neu an
        return { ok: true, recoveryCodes: codes };
    }
    twofaDisable(userId) { this.db.prepare('UPDATE users SET twofaSecret = NULL, twofaPending = NULL, twofaEnabled = 0, twofaLastStep = 0, recovery = NULL WHERE id = ?').run(userId); this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId); }
    newRecoveryCodes(userId) { const u = this._full(userId); if (!u || !u.twofaEnabled) return null; const codes = totp.recoveryCodes(10); this.db.prepare('UPDATE users SET recovery = ? WHERE id = ?').run(JSON.stringify(codes.map(totp.hashRecovery)), userId); return codes; }
    // ---- Konten verwalten ----
    listUsers() { return this.db.prepare('SELECT id, username, displayName, source, twofaEnabled, createdAt, lastLoginAt FROM users ORDER BY username COLLATE NOCASE').all().map(u => ({ id: u.id, username: u.username, displayName: u.displayName || '', source: u.source, twofaEnabled: !!u.twofaEnabled, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null })); }
    removeUser(id) { return Number(this.db.prepare('DELETE FROM users WHERE id = ?').run(id).changes); }
    idByUsername(username) { const r = this.db.prepare('SELECT id FROM users WHERE username = ?').get(String(username || '')); return r ? r.id : null; }
    userSource(username) { const r = this.db.prepare('SELECT source FROM users WHERE username = ?').get(String(username || '')); return r ? r.source : null; }
    // Person aus AuraDirect: beim ersten Login anlegen, danach nur Namen und Zeit nachführen. Ein LOKALES Konto mit gleichem Namen wird nie übernommen.
    upsertDirectoryUser(username, displayName, now = Date.now()) {
        if (typeof username !== 'string' || !/^[A-Za-z0-9._@-]{1,80}$/.test(username)) return { invalid: true };   // nur Text (aus null würde sonst ein Konto "null")
        const name = String(displayName || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80), ex = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (ex && ex.source !== 'auradirect') return { conflict: true };
        if (ex) { this.db.prepare('UPDATE users SET displayName = ?, lastLoginAt = ?, failed = 0, lockedUntil = 0 WHERE id = ?').run(name, now, ex.id); return { user: this._pub(ex) }; }
        const r = this.db.prepare("INSERT INTO users (username, passwordHash, mustChange, createdAt, source, displayName, lastLoginAt) VALUES (?, '!', 0, ?, 'auradirect', ?, ?)").run(username, now, name, now);
        return { user: this._pub(this._full(Number(r.lastInsertRowid))), created: true };
    }
    async changePassword(userId, oldPw, newPw) {
        const u = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId); if (!u) throw new Error('Benutzer unbekannt');
        if (!(await verifyPassword(oldPw, u.passwordHash))) return { ok: false, error: 'Das bisherige Passwort stimmt nicht.' };
        const problem = passwordProblem(newPw, u.username); if (problem) return { ok: false, error: problem };
        if (await verifyPassword(newPw, u.passwordHash)) return { ok: false, error: 'Das neue Passwort muss sich vom bisherigen unterscheiden.' };
        this.db.prepare('UPDATE users SET passwordHash = ?, mustChange = 0, failed = 0, lockedUntil = 0 WHERE id = ?').run(await hashPassword(newPw), userId);
        this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);   // alle Anmeldungen ungültig; die aktuelle wird vom Aufrufer neu angelegt
        return { ok: true };
    }
    // ---- Sitzungen: nur der Hash des Zeichens liegt in der Datenbank ----
    createSession(userId, now = Date.now(), ttl = SESSION_MS) { const token = crypto.randomBytes(32).toString('base64url'); this.db.prepare('INSERT INTO sessions (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)').run(sha256(token), userId, now, now + ttl); return token; }
    getSession(token, now = Date.now()) {
        if (!token || typeof token !== 'string' || token.length > 100) return null;
        const r = this.db.prepare('SELECT s.tokenHash, s.expiresAt, u.id, u.username, u.mustChange, u.source, u.twofaEnabled, u.displayName FROM sessions s JOIN users u ON u.id = s.userId WHERE s.tokenHash = ?').get(sha256(token));
        if (!r) return null; if (r.expiresAt <= now) { this.destroySession(token); return null; }
        return { id: r.id, username: r.username, mustChange: !!r.mustChange, source: r.source || 'local', twofaEnabled: !!r.twofaEnabled, displayName: r.displayName || '', mustSetup2fa: this.needsTwofaSetup(r) };
    }
    destroySession(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(sha256(token)); }
    purgeSessions(now = Date.now()) { return Number(this.db.prepare('DELETE FROM sessions WHERE expiresAt <= ?').run(now).changes); }
    // ---- Anrufe ----
    insertCall(c) { const r = this.db.prepare('INSERT INTO calls (uuid, direction, number, did, purpose, startedAt, answeredAt, outcome, source, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(c.uuid || null, c.direction, c.number || null, c.did || null, c.purpose || null, c.startedAt || Date.now(), c.answeredAt || null, c.outcome || 'active', c.source || null, c.error || null); return Number(r.lastInsertRowid); }
    updateCall(id, f) { const keys = Object.keys(f).filter(k => ['answeredAt', 'endedAt', 'durationMs', 'outcome', 'turns', 'error', 'number', 'did'].includes(k)); if (!keys.length) return; this.db.prepare(`UPDATE calls SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => f[k]), id); }
    callByUuid(uuid) { return this.db.prepare('SELECT * FROM calls WHERE uuid = ?').get(uuid) || null; }
    getCall(id) { const c = this.db.prepare('SELECT * FROM calls WHERE id = ?').get(id); if (!c) return null; c.transcript = this.db.prepare('SELECT t, who, text FROM transcripts WHERE callId = ? ORDER BY id').all(id); return c; }
    listCalls({ limit = 50, offset = 0, direction } = {}) {
        const ln = Number(limit), l = Number.isFinite(ln) && ln >= 1 ? Math.min(200, Math.floor(ln)) : 50;       // unsinnige Werte (negativ, Text) -> Standard
        const on = Number(offset), o = Number.isFinite(on) && on >= 0 ? Math.floor(on) : 0;
        const where = direction === 'in' || direction === 'out' ? 'WHERE direction = ?' : '', args = where ? [direction] : [];
        return {
            total: this.db.prepare(`SELECT COUNT(*) AS c FROM calls ${where}`).get(...args).c,
            items: this.db.prepare(`SELECT id, uuid, direction, number, did, purpose, startedAt, endedAt, durationMs, outcome, turns, error, source FROM calls ${where} ORDER BY startedAt DESC, id DESC LIMIT ? OFFSET ?`).all(...args, l, o)
        };
    }
    addTranscript(callId, rows) { const st = this.db.prepare('INSERT INTO transcripts (callId, t, who, text) VALUES (?, ?, ?, ?)'); for (const r of rows.slice(0, 500)) st.run(callId, Math.max(0, Math.round(r.t) || 0), r.who === 'aura' ? 'aura' : 'caller', String(r.text).slice(0, 1000)); }
    deleteCall(id) { return Number(this.db.prepare('DELETE FROM calls WHERE id = ?').run(id).changes); }
    countCallsSince(since, direction) { return this.db.prepare(`SELECT COUNT(*) AS c FROM calls WHERE startedAt >= ? ${direction ? 'AND direction = ?' : ''} AND outcome != 'rejected'`).get(...(direction ? [since, direction] : [since])).c; }
    purgeCalls(olderThanMs) { return Number(this.db.prepare('DELETE FROM calls WHERE startedAt < ? AND outcome NOT IN (\'active\', \'dialing\')').run(olderThanMs).changes); }
    markStaleCalls(now = Date.now()) { return Number(this.db.prepare("UPDATE calls SET outcome = 'abgebrochen', endedAt = ?, error = 'Programm wurde neu gestartet' WHERE outcome IN ('active', 'dialing')").run(now).changes); }
    // ---- Geplante Anrufe ----
    addScheduled(s) { return Number(this.db.prepare('INSERT INTO scheduled (number, purpose, runAt, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)').run(s.number, s.purpose || '', s.runAt, s.createdBy || '', Date.now()).lastInsertRowid); }
    dueScheduled(now = Date.now()) { return this.db.prepare("SELECT * FROM scheduled WHERE status = 'pending' AND runAt <= ? ORDER BY runAt LIMIT 20").all(now); }
    listScheduled() { return this.db.prepare("SELECT * FROM scheduled WHERE status = 'pending' OR createdAt > ? ORDER BY runAt DESC LIMIT 100").all(Date.now() - 7 * 86400000); }
    markScheduled(id, status, message, callId) { this.db.prepare('UPDATE scheduled SET status = ?, message = ?, callId = ? WHERE id = ?').run(status, message || null, callId || null, id); }
    deleteScheduled(id) { return Number(this.db.prepare("DELETE FROM scheduled WHERE id = ? AND status = 'pending'").run(id).changes); }
    // ---- Protokoll der Verwaltung (wer hat was geändert) ----
    audit(user, action, detail) { this.db.prepare('INSERT INTO audit (at, user, action, detail) VALUES (?, ?, ?, ?)').run(Date.now(), user || '', action, String(detail || '').slice(0, 500)); this.db.prepare('DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY id DESC LIMIT 2000)').run(); }
    recentAudit(limit = 50) { return this.db.prepare('SELECT at, user, action, detail FROM audit ORDER BY id DESC LIMIT ?').all(Math.min(200, limit)); }
}
module.exports = { Db, hashPassword, verifyPassword, passwordProblem, randomPassword, sha256, SESSION_MS, LOCK_AFTER, LOCK_MS };
