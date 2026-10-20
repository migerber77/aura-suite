// AuraTicket - Ticketsystem für das Aura-Ökosystem. Tickets entstehen entweder manuell oder
// automatisch aus eingehenden E-Mails (über AuraMail abgerufen). Antworten gehen als E-Mail
// über dasselbe Postfach zurück. Zusätzlich: Massenmail-Kampagnen über dieselbe Anbindung.
//
// Lizenz-Einstufung: AuraTicket ist eine "Applikation" (wie AuraChat/AuraPlan), keine
// Applikation. Lizenzregel (wie bei allen Aura-Produkten): 14 Tage Testphase, danach gültige Lizenz oder die
// Gratis-Stufe (1 aktives Konto: der Admin); mehr Konten brauchen eine Lizenz.

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const AdmZip = require('adm-zip');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET) {
    console.warn('WARNUNG: SESSION_SECRET ist nicht gesetzt - bitte in .env eintragen (z.B. openssl rand -hex 32).');
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    store: new SQLiteStore({ dir: dataDir, db: 'sessions.db' }),
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'html')));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Zu viele Versuche. Bitte später erneut versuchen.' } });

const db = new sqlite3.Database(path.join(dataDir, 'auraticket.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
});

db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        firstname TEXT NOT NULL DEFAULT '',
        lastname TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'agent',
        source TEXT NOT NULL DEFAULT 'local',
        active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE NOT NULL,
        subject TEXT NOT NULL DEFAULT '(kein Betreff)',
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        requesterEmail TEXT NOT NULL,
        requesterName TEXT DEFAULT '',
        assignedUserId INTEGER,
        mailboxAddress TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assignedUserId) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticketId INTEGER NOT NULL,
        direction TEXT NOT NULL DEFAULT 'incoming',
        fromAddress TEXT,
        fromName TEXT,
        bodyText TEXT,
        bodyHtml TEXT,
        authorUserId INTEGER,
        externalMessageId TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(ticketId) REFERENCES tickets(id),
        FOREIGN KEY(authorUserId) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ticket_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        filename TEXT NOT NULL,
        contentType TEXT,
        data BLOB,
        FOREIGN KEY(messageId) REFERENCES ticket_messages(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        bodyText TEXT,
        bodyHtml TEXT,
        mailboxAddress TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        createdByUserId INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        sentAt TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS campaign_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaignId INTEGER NOT NULL,
        email TEXT NOT NULL,
        name TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        sentAt TEXT,
        FOREIGN KEY(campaignId) REFERENCES campaigns(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS configs (userId INTEGER, key TEXT, value TEXT, PRIMARY KEY (userId, key))`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS connected_products (product TEXT PRIMARY KEY, lastSeenAt TEXT NOT NULL)`);

    // Für AuraChat: Hinweise, die dort im Chat angezeigt und vorgelesen werden (neues
    // Ticket eingegangen, Kundschaft hat auf ein zugewiesenes Ticket geantwortet, ...).
    db.run(`CREATE TABLE IF NOT EXISTS ticket_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        message TEXT NOT NULL,
        delivered INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`, [], async (err, row) => {
        if (!err && !row) {
            const hash = await bcrypt.hash('admin', 10);
            db.run(`INSERT INTO users (username, passwordHash, firstname, lastname, role) VALUES ('admin', ?, 'Admin', '', 'admin')`, [hash], () => {
                console.log('Standard-Admin-Konto erstellt (admin / admin) - bitte Passwort nach dem ersten Login ändern.');
            });
        }
    });
});

const GLOBAL_USER_ID = 0;

function getSetting(key) {
    return new Promise((resolve) => db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => resolve(row ? row.value : null)));
}
function setSetting(key, value) {
    return new Promise((resolve, reject) => db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value], (err) => err ? reject(err) : resolve()
    ));
}
function getConfig(key) {
    return new Promise((resolve) => db.get(`SELECT value FROM configs WHERE userId = ? AND key = ?`, [GLOBAL_USER_ID, key], (err, row) => resolve(row ? row.value : null)));
}
function setConfig(key, value) {
    return new Promise((resolve, reject) => db.run(
        `INSERT INTO configs (userId, key, value) VALUES (?, ?, ?) ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value`,
        [GLOBAL_USER_ID, key, value], (err) => err ? reject(err) : resolve()
    ));
}

// --- Aura-Suite: "Über Aura-Suite" (Dialog in der Oberfläche, Datei about.js) ---
// Programmversion aus package.json; die Version der Aura-Suite setzt, wer sie betreibt (Umgebungswert AURA_SUITE_VERSION, z. B. in der .env). Nur für angemeldete Personen.
const { createSuitePing, versionOlder } = require('./suite-ping');   // anonymer Check-in beim Lizenzserver (siehe suite-ping.js)
const AURA_APP_NAME = 'AuraTicket';
const AURA_APP_VERSION = String(require('./package.json').version);
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
app.get('/api/version', requireAuth, (req, res) => { const suite = suitePing.suite(); res.set('Cache-Control', 'no-store').json({ product: AURA_APP_NAME, installed: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite, updateAvailable: !!(suite && AURA_SUITE_INSTALLED && versionOlder(AURA_SUITE_INSTALLED, suite.version)) }); });

// Anonymer Check-in beim Lizenzserver (nicht abschaltbar): Produkt, Version, Zustand, Zahl der Konten, zufällige Installations-Kennung. Keine Namen, keine Inhalte.
// Aus der Antwort kommt die Aura-Suite-Version, die im Lizenzserver eingetragen ist: sie erscheint unter "Über Aura-Suite" (siehe /api/version).
const suitePing = createSuitePing({
    product: 'ticket', version: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, dataDir, host: process.env.LICENSE_CHECKIN_HOST,
    getState: async () => { const i = await getStoredLicenseInfo(); return i.licenseValid ? 'licensed' : i.trial ? 'trial' : i.freeTier ? 'free' : 'expired'; },
    getCounts: () => new Promise((resolve) => db.get(`SELECT COUNT(*) AS c, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS a FROM users WHERE active = 1`, [], (err, row) => resolve(err || !row ? null : { totalUsers: row.c, totalAdmins: row.a || 0 }))),
    getLicenseKey: () => getSetting('license_key')
});

function requireAuth(req, res, next) {
    if (req.session && req.session.user && req.session.user.id) return next();
    res.status(401).json({ error: 'Nicht angemeldet.' });
}
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).json({ error: 'Nur für Administratoren.' });
}

// --- Datenschutzerklärung mit Bestätigung beim ersten Login (gemeinsames Modul der Aura-Suite) ---
const auraPrivacy = require('./aura-privacy-server');
const DEFAULT_PRIVACY_POLICY = '# Datenschutzerklärung\n\nDiese Anwendung (AuraTicket) speichert folgende Daten, um Tickets und Kampagnen zu bearbeiten:\n\n- Name, Benutzername und Rolle (das Passwort nur als Prüfwert, bei Zwei-Faktor-Anmeldung zusätzlich das Geheimnis der Authenticator-App)\n- Tickets und Kampagnen mit ihren Inhalten, dem Status, der Zuständigkeit und den Zeitstempeln, einschliesslich der Angaben, die Mitarbeitende oder Kundinnen und Kunden darin erfassen\n- Technische Protokolle (z. B. Anmeldungen und Fehler) für Betrieb und Sicherheit\n\nDiese Daten werden ausschliesslich auf dem Server des Betreibers gespeichert und nicht an Dritte weitergegeben. Auskunft, Berichtigung und Löschung erhaltet ihr bei den Administrator:innen.' + '\n\n' + auraPrivacy.CHECKIN_NOTICE;
auraPrivacy.register(app, { db, requireAuth, requireAdmin: requireAdmin, getUserId: (req) => (req.session && req.session.user && req.session.user.id) || null, defaultText: DEFAULT_PRIVACY_POLICY });
function toSessionUser(row) {
    return { id: row.id, username: row.username, firstname: row.firstname, lastname: row.lastname, role: row.role };
}
function generateTwofaSecret() { return authenticator.generateSecret(); }

// --- LIZENZMANAGEMENT ---
// Lizenzregel (einheitlich für alle Aura-Produkte): 14 Tage Testphase mit allem, danach eine gültige Lizenz oder die Gratis-Stufe
// (höchstens 1 aktives Konto: der Admin). Mehr Konten brauchen eine Lizenz.
const TRIAL_DAYS = 14;

function verifyLicenseKey(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.includes('.')) return { valid: false, error: 'Ungültiges Lizenzformat.' };
    const [payloadB64, signatureB64] = licenseKey.trim().split('.');
    if (!payloadB64 || !signatureB64) return { valid: false, error: 'Ungültiges Lizenzformat.' };
    const secret = process.env.LICENSE_SECRET || '';
    if (!secret) return { valid: false, error: 'Lizenzsystem ist serverseitig nicht konfiguriert (LICENSE_SECRET fehlt).' };
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const sigBuf = Buffer.from(signatureB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return { valid: false, error: 'Lizenzsignatur ist ungültig.' };
    let payload;
    try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')); } catch { return { valid: false, error: 'Lizenz-Daten sind beschädigt.' }; }
    if (payload.product !== 'auraticket') return { valid: false, error: 'Diese Lizenz ist nicht für AuraTicket ausgestellt.' };
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) return { valid: false, error: 'Lizenz ist abgelaufen.', payload };
    return { valid: true, payload };
}

function getTrialInfo() {
    return getSetting('install_date').then(async (installDate) => {
        if (!installDate) { installDate = new Date().toISOString(); await setSetting('install_date', installDate); }
        const daysElapsed = (Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24);
        return { active: daysElapsed < TRIAL_DAYS, daysRemaining: Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed)) };
    });
}
// Dauerhafte Gratis-Stufe nach der Testphase: EIN aktives Konto, und das ist der Admin. Jedes weitere Konto braucht eine Lizenz.
function isWithinFreeTier() {
    return new Promise((resolve) => db.get(`SELECT COUNT(*) as c FROM users WHERE active = 1`, [], (err, row) => resolve(!err && !!row && row.c <= 1)));
}

async function getStoredLicenseInfo() {
    const key = await getSetting('license_key');
    let base = { valid: false, customer: null, expiresAt: null, error: 'Keine Lizenz hinterlegt.' };
    if (key) {
        const result = verifyLicenseKey(key);
        base = { valid: result.valid, customer: (result.payload && result.payload.customer) || null, expiresAt: (result.payload && result.payload.expiresAt) || null, error: result.valid ? null : result.error };
    }
    // Reihenfolge: erst die 14 Tage Testphase (alles erlaubt), dann eine gültige Lizenz, sonst die Gratis-Stufe (höchstens 1 aktives Konto: der Admin), sonst gesperrt.
    const trial = await getTrialInfo();
    if (trial.active) return { ...base, valid: true, licenseValid: base.valid, trial: true, trialDaysRemaining: trial.daysRemaining, freeTier: false };
    if (base.valid) return { ...base, licenseValid: true, trial: false, trialDaysRemaining: 0, freeTier: false };
    if (await isWithinFreeTier()) return { ...base, valid: true, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: true, freeTierReason: 'users' };
    return { ...base, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: false };
}
async function requireLicense(req, res, next) {
    const exempt = ['/api/login', '/api/logout', '/api/me', '/api/license', '/api/admin/license', '/api/admin/license/remove'];
    if (!req.path.startsWith('/api/') || exempt.includes(req.path)) return next();
    const info = await getStoredLicenseInfo();
    if (info.valid) return next();
    res.status(402).json({ error: 'Keine gültige Lizenz für AuraTicket hinterlegt.', licenseRequired: true });
}

app.use(requireLicense);

// Vor der lokalen Anmeldung: bei AuraDirect nachfragen (gleiches Muster wie bei AuraMail),
// damit ein einziges AuraDirect-Konto überall funktioniert.
async function tryAuraDirectLogin(username, password, twofaCode) {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    if (!url) return null;
    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey || '' },
            body: JSON.stringify({ username, password, product: 'auraticket', twofaCode }),
            signal: AbortSignal.timeout(6000)
        });
        if (!resp.ok) return null;
        return await resp.json();
    } catch {
        return null;
    }
}
function provisionFromAuraDirect(username, adResult) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, existing) => {
            if (err) return reject(err);
            const role = adResult.role === 'admin' ? 'admin' : 'agent';
            if (existing) {
                db.run(`UPDATE users SET firstname = ?, lastname = ?, role = ? WHERE id = ?`,
                    [adResult.firstname || existing.firstname, adResult.lastname || existing.lastname, role, existing.id],
                    (e) => e ? reject(e) : db.get(`SELECT * FROM users WHERE id = ?`, [existing.id], (e2, row) => e2 ? reject(e2) : resolve(row)));
            } else {
                const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
                db.run(`INSERT INTO users (username, passwordHash, firstname, lastname, role, source) VALUES (?, ?, ?, ?, ?, 'auradirect')`,
                    [username, hash, adResult.firstname || '', adResult.lastname || '', role],
                    function (e) { e ? reject(e) : db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e2, row) => e2 ? reject(e2) : resolve(row)); });
            }
        });
    });
}

app.post('/api/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich.' });

    const adResp = await tryAuraDirectLogin(username, password);
    if (adResp && adResp.requires2fa) {
        req.session.pendingAuraDirectUsername = username;
        req.session.pendingAuraDirectPassword = password;
        return res.json({ requires2fa: true, viaAuraDirect: true });
    }
    if (adResp && adResp.valid) {
        try {
            const row = await provisionFromAuraDirect(username, adResp);
            req.session.user = toSessionUser(row);
            return res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
        } catch (e) {
            return res.status(500).json({ error: 'Fehler beim Übernehmen der AuraDirect-Anmeldung: ' + e.message });
        }
    }

    db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username.trim()], async (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' });
        if (row.source === 'auradirect') return res.status(401).json({ error: 'Diese Person wird über AuraDirect verwaltet - AuraDirect war soeben aber nicht erreichbar oder hat die Anmeldung abgelehnt.' });
        const ok = await bcrypt.compare(password, row.passwordHash).catch(() => false);
        if (!ok) return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' });

        const twofaRequiredGlobally = (await getConfig('twofa_required')) === 'true';
        if (row.twofa_enabled || twofaRequiredGlobally) {
            if (!row.twofa_secret) {
                const secret = generateTwofaSecret();
                db.run(`UPDATE users SET twofa_secret = ? WHERE id = ?`, [secret, row.id]);
                req.session.pendingUserId = row.id;
                const otpauthUrl = authenticator.keyuri(row.username, 'AuraTicket', secret);
                const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
                return res.json({ requires2faSetup: true, qrCodeDataUrl });
            }
            req.session.pendingUserId = row.id;
            return res.json({ requires2fa: true });
        }
        req.session.user = toSessionUser(row);
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
    });
});

app.post('/api/login/2fa-auradirect', authLimiter, async (req, res) => {
    if (!req.session.pendingAuraDirectUsername) return res.status(400).json({ error: 'Kein Login ausstehend.' });
    const { pendingAuraDirectUsername: username, pendingAuraDirectPassword: password } = req.session;
    const adResp = await tryAuraDirectLogin(username, password, req.body.code);
    delete req.session.pendingAuraDirectUsername;
    delete req.session.pendingAuraDirectPassword;
    if (!adResp || !adResp.valid) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
    try {
        const row = await provisionFromAuraDirect(username, adResp);
        req.session.user = toSessionUser(row);
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
    } catch (e) {
        res.status(500).json({ error: 'Fehler: ' + e.message });
    }
});

app.post('/api/login/2fa-setup', authLimiter, async (req, res) => {
    if (!req.session.pendingUserId) return res.status(400).json({ error: 'Kein Login ausstehend.' });
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.pendingUserId], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Fehler.' });
        const ok = authenticator.verify({ token: String(req.body.code || '').trim(), secret: row.twofa_secret });
        if (!ok) return res.status(401).json({ error: 'Code ist falsch.' });
        db.run(`UPDATE users SET twofa_enabled = 1 WHERE id = ?`, [row.id], () => {
            delete req.session.pendingUserId;
            req.session.user = toSessionUser(row);
            req.session.twofaVerified = true;
            res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
        });
    });
});
app.post('/api/login/2fa', authLimiter, (req, res) => {
    if (!req.session.pendingUserId) return res.status(400).json({ error: 'Kein Login ausstehend.' });
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.pendingUserId], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Fehler.' });
        const ok = authenticator.verify({ token: String(req.body.code || '').trim(), secret: row.twofa_secret });
        if (!ok) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
        delete req.session.pendingUserId;
        req.session.user = toSessionUser(row);
        req.session.twofaVerified = true;
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
    });
});

app.get('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));
app.get('/api/me', requireAuth, (req, res) => {
    db.get(`SELECT id, username, firstname, lastname, role FROM users WHERE id = ?`, [req.session.user.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Nicht gefunden.' });
        res.json(row);
    });
});

app.get('/api/license', requireAuth, async (req, res) => res.json(await getStoredLicenseInfo()));
app.post('/api/admin/license', requireAuth, requireAdmin, async (req, res) => {
    const key = (req.body.key || '').trim();
    if (!key) return res.status(400).json({ error: 'Bitte einen Lizenzschlüssel eintragen.' });
    const result = verifyLicenseKey(key);
    if (!result.valid) return res.status(400).json({ error: result.error });
    await setSetting('license_key', key);
    res.json({ success: true, customer: result.payload.customer, expiresAt: result.payload.expiresAt });
});
app.post('/api/admin/license/remove', requireAuth, requireAdmin, async (req, res) => {
    await setSetting('license_key', '');
    res.json({ success: true });
});

// --- AuraMail-Anbindung (Konfiguration) ---
// --- AuraDirect-Anbindung (für zentrale Anmeldung) ---
app.get('/api/admin/auradirect-config', requireAuth, requireAdmin, async (req, res) => {
    res.json({ url: await getConfig('auradirect_url') || '', hasServiceKey: !!(await getConfig('auradirect_service_key')) });
});
app.post('/api/admin/auradirect-config', requireAuth, requireAdmin, async (req, res) => {
    const url = (req.body.url || '').trim();
    const serviceKey = (req.body.serviceKey || '').trim();
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Die Adresse sollte mit http:// oder https:// beginnen - das sieht eher nach dem Dienst-Schlüssel aus.' });
    if (serviceKey && /^https?:\/\//i.test(serviceKey)) return res.status(400).json({ error: 'Das sieht nach einer Adresse aus, nicht nach einem Dienst-Schlüssel.' });
    await setConfig('auradirect_url', url);
    if (serviceKey) await setConfig('auradirect_service_key', serviceKey);
    res.json({ success: true });
});

app.get('/api/admin/auramail-config', requireAuth, requireAdmin, async (req, res) => {
    res.json({
        url: await getConfig('auramail_url') || '',
        hasServiceKey: !!(await getConfig('auramail_service_key')),
        mailboxAddress: await getConfig('auramail_mailbox_address') || ''
    });
});
app.post('/api/admin/auramail-config', requireAuth, requireAdmin, async (req, res) => {
    const url = (req.body.url || '').trim();
    const serviceKey = (req.body.serviceKey || '').trim();
    const mailboxAddress = (req.body.mailboxAddress || '').trim().toLowerCase();
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Die Adresse sollte mit http:// oder https:// beginnen - das sieht eher nach dem Dienst-Schlüssel aus.' });
    if (serviceKey && /^https?:\/\//i.test(serviceKey)) return res.status(400).json({ error: 'Das sieht nach einer Adresse aus, nicht nach einem Dienst-Schlüssel.' });
    await setConfig('auramail_url', url);
    if (serviceKey) await setConfig('auramail_service_key', serviceKey);
    await setConfig('auramail_mailbox_address', mailboxAddress);
    res.json({ success: true });
});

// --- Ticket-Logik ---
function generateTicketNumber() {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM settings WHERE key = 'ticket_counter'`, [], (err, row) => {
            const next = (row ? parseInt(row.value, 10) : 0) + 1;
            db.run(`INSERT INTO settings (key, value) VALUES ('ticket_counter', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [String(next)], () => {
                resolve('T-' + String(next).padStart(5, '0'));
            });
        });
    });
}

async function callAuramail(path, options = {}) {
    const url = await getConfig('auramail_url');
    const serviceKey = await getConfig('auramail_service_key');
    if (!url) throw new Error('Keine AuraMail-Adresse hinterlegt.');
    const resp = await fetch(`${url.replace(/\/$/, '')}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey || '', ...(options.headers || {}) },
        signal: AbortSignal.timeout(10000)
    });
    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `AuraMail antwortete mit Status ${resp.status}.`);
    }
    return resp.json();
}

// Holt neue eingehende Mails vom konfigurierten AuraMail-Postfach und wandelt sie in Tickets
// um (oder hängt sie an ein bestehendes Ticket an, falls die Betreffzeile eine Ticketnummer
// enthält - einfache, robuste Zuordnung ohne komplexe Header-Logik).
async function pollAuramailForTickets() {
    const mailboxAddress = await getConfig('auramail_mailbox_address');
    if (!mailboxAddress) return;
    const since = (await getSetting('auramail_poll_since')) || '1970-01-01';
    let messages;
    try {
        messages = await callAuramail(`/api/external/mailboxes/${encodeURIComponent(mailboxAddress)}/messages?since=${encodeURIComponent(since)}`);
    } catch (err) {
        console.error('[AuraMail-Abruf] Fehler:', err.message);
        return;
    }
    let latestTimestamp = since;
    for (const msg of messages) {
        if (msg.receivedAt > latestTimestamp) latestTimestamp = msg.receivedAt;
        const numberMatch = (msg.subject || '').match(/T-\d{5}/);
        if (numberMatch) {
            const ticket = await new Promise((resolve) => db.get(`SELECT * FROM tickets WHERE number = ?`, [numberMatch[0]], (e, r) => resolve(r)));
            if (ticket) {
                db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, fromName, bodyText, bodyHtml, externalMessageId) VALUES (?, 'incoming', ?, ?, ?, ?, ?)`,
                    [ticket.id, msg.fromAddress, msg.fromName, msg.bodyText, msg.bodyHtml, msg.messageId]);
                db.run(`UPDATE tickets SET status = 'open', updatedAt = ? WHERE id = ?`, [new Date().toISOString(), ticket.id]);
                if (ticket.assignedUserId) {
                    db.get(`SELECT username FROM users WHERE id = ?`, [ticket.assignedUserId], (e, u) => {
                        if (u) db.run(`INSERT INTO ticket_notifications (username, message) VALUES (?, ?)`,
                            [u.username, `Neue Antwort auf Ticket ${ticket.number} von ${msg.fromName || msg.fromAddress}.`]);
                    });
                }
                continue;
            }
        }
        const number = await generateTicketNumber();
        db.run(
            `INSERT INTO tickets (number, subject, requesterEmail, requesterName, mailboxAddress, source) VALUES (?, ?, ?, ?, ?, 'email')`,
            [number, msg.subject || '(kein Betreff)', msg.fromAddress, msg.fromName, mailboxAddress],
            function (err) {
                if (err || !this.lastID) return;
                db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, fromName, bodyText, bodyHtml, externalMessageId) VALUES (?, 'incoming', ?, ?, ?, ?, ?)`,
                    [this.lastID, msg.fromAddress, msg.fromName, msg.bodyText, msg.bodyHtml, msg.messageId]);
                // Kein:e Eigentümer:in bekannt (neues Ticket) - alle aktiven Agent:innen informieren.
                db.all(`SELECT username FROM users WHERE active = 1`, [], (uErr, agents) => {
                    (agents || []).forEach(a => db.run(`INSERT INTO ticket_notifications (username, message) VALUES (?, ?)`,
                        [a.username, `Neues Ticket ${number}: ${msg.subject || '(kein Betreff)'} von ${msg.fromName || msg.fromAddress}.`]));
                });
            }
        );
    }
    if (latestTimestamp !== since) await setSetting('auramail_poll_since', latestTimestamp);
}
setInterval(pollAuramailForTickets, 3 * 60 * 1000);

app.post('/api/admin/auramail-config/poll-now', requireAuth, requireAdmin, async (req, res) => {
    try { await pollAuramailForTickets(); res.json({ success: true }); }
    catch (err) { res.status(502).json({ error: err.message }); }
});

app.get('/api/tickets', requireAuth, (req, res) => {
    const { status, assignedUserId } = req.query;
    const conditions = ['1=1'], params = [];
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (assignedUserId) { conditions.push('assignedUserId = ?'); params.push(assignedUserId); }
    db.all(
        `SELECT t.*, u.firstname as assignedFirstname, u.lastname as assignedLastname,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticketId = t.id) as messageCount
         FROM tickets t LEFT JOIN users u ON u.id = t.assignedUserId
         WHERE ${conditions.join(' AND ')} ORDER BY t.updatedAt DESC LIMIT 300`,
        params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

app.post('/api/tickets', requireAuth, async (req, res) => {
    const { subject, requesterEmail, requesterName, bodyText } = req.body;
    if (!subject || !requesterEmail) return res.status(400).json({ error: 'Betreff und Anfragende-Adresse sind erforderlich.' });
    const number = await generateTicketNumber();
    db.run(
        `INSERT INTO tickets (number, subject, requesterEmail, requesterName, source, assignedUserId) VALUES (?, ?, ?, ?, 'manual', ?)`,
        [number, subject, requesterEmail, requesterName || '', req.session.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const ticketId = this.lastID;
            db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, fromName, bodyText, authorUserId) VALUES (?, 'note', ?, ?, ?, ?)`,
                [ticketId, requesterEmail, requesterName || '', bodyText || '', req.session.user.id]);
            res.json({ success: true, id: ticketId, number });
        }
    );
});

app.get('/api/tickets/:id', requireAuth, (req, res) => {
    db.get(
        `SELECT t.*, u.firstname as assignedFirstname, u.lastname as assignedLastname FROM tickets t LEFT JOIN users u ON u.id = t.assignedUserId WHERE t.id = ?`,
        [req.params.id], (err, ticket) => {
            if (err || !ticket) return res.status(404).json({ error: 'Nicht gefunden.' });
            db.all(
                `SELECT m.*, u.firstname as authorFirstname, u.lastname as authorLastname,
                        (SELECT COUNT(*) FROM ticket_attachments WHERE messageId = m.id) as attachmentCount
                 FROM ticket_messages m LEFT JOIN users u ON u.id = m.authorUserId WHERE m.ticketId = ? ORDER BY m.createdAt ASC`,
                [req.params.id], (mErr, messages) => {
                    if (mErr) return res.status(500).json({ error: mErr.message });
                    res.json({ ...ticket, messages });
                }
            );
        }
    );
});

app.put('/api/tickets/:id', requireAuth, (req, res) => {
    const { status, priority, assignedUserId } = req.body;
    const updates = [], params = [];
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (assignedUserId !== undefined) { updates.push('assignedUserId = ?'); params.push(assignedUserId || null); }
    if (updates.length === 0) return res.json({ success: true });
    updates.push('updatedAt = ?'); params.push(new Date().toISOString());
    params.push(req.params.id);
    db.run(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/tickets/:id/reply', requireAuth, async (req, res) => {
    const { bodyText, internalNote } = req.body;
    db.get(`SELECT * FROM tickets WHERE id = ?`, [req.params.id], async (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: 'Nicht gefunden.' });
        if (internalNote) {
            db.run(`INSERT INTO ticket_messages (ticketId, direction, bodyText, authorUserId) VALUES (?, 'note', ?, ?)`, [ticket.id, bodyText, req.session.user.id]);
            return res.json({ success: true });
        }
        if (!ticket.mailboxAddress) return res.status(400).json({ error: 'Dieses Ticket ist keinem Postfach zugeordnet - Antwort per E-Mail nicht möglich (manuell erstelltes Ticket ohne E-Mail-Bezug).' });
        try {
            await callAuramail(`/api/external/mailboxes/${encodeURIComponent(ticket.mailboxAddress)}/send`, {
                method: 'POST',
                body: JSON.stringify({ to: [ticket.requesterEmail], subject: `Re: ${ticket.subject} [${ticket.number}]`, text: bodyText })
            });
            db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, bodyText, authorUserId) VALUES (?, 'outgoing', ?, ?, ?)`,
                [ticket.id, ticket.mailboxAddress, bodyText, req.session.user.id]);
            db.run(`UPDATE tickets SET status = 'pending', updatedAt = ? WHERE id = ?`, [new Date().toISOString(), ticket.id]);
            res.json({ success: true });
        } catch (sendErr) {
            res.status(502).json({ error: 'Versand fehlgeschlagen: ' + sendErr.message });
        }
    });
});

// --- Externe API: für AuraChat (Chat-/Sprachbefehle + Benachrichtigungen). Eigener,
// separater Dienst-Schlüssel - gleiches Muster wie bei AuraMail.
let TICKET_SERVICE_KEY = null;
async function ensureTicketServiceKey() {
    if (TICKET_SERVICE_KEY) return TICKET_SERVICE_KEY;
    let stored = await getSetting('external_api_key');
    if (!stored) { stored = crypto.randomBytes(32).toString('hex'); await setSetting('external_api_key', stored); }
    TICKET_SERVICE_KEY = stored;
    return stored;
}
ensureTicketServiceKey();
async function requireTicketServiceKey(req, res, next) {
    const key = await ensureTicketServiceKey();
    const provided = (req.headers['x-service-key'] || '').trim();
    if (provided !== key) return res.status(401).json({ error: 'Ungültiger oder fehlender Dienst-Schlüssel.' });
    next();
}
app.get('/api/admin/external-api-key', requireAuth, requireAdmin, async (req, res) => res.json({ key: await ensureTicketServiceKey() }));
app.post('/api/admin/external-api-key/regenerate', requireAuth, requireAdmin, async (req, res) => {
    TICKET_SERVICE_KEY = crypto.randomBytes(32).toString('hex');
    await setSetting('external_api_key', TICKET_SERVICE_KEY);
    res.json({ key: TICKET_SERVICE_KEY });
});

// Für AuraChat: Status/Zahlen abfragen, Status ändern, zuweisen, antworten - jeweils per
// Benutzername statt Sitzung, da der Aufruf von AuraChat aus im Namen der dortigen Person
// erfolgt, nicht als eigene Anmeldung bei AuraTicket.
app.get('/api/service/tickets', requireTicketServiceKey, (req, res) => {
    const { status, assignedUsername } = req.query;
    const conditions = ['1=1'], params = [];
    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (assignedUsername) { conditions.push('u.username = ?'); params.push(assignedUsername); }
    db.all(
        `SELECT t.number, t.subject, t.status, t.priority, t.requesterEmail, t.requesterName, t.updatedAt, u.username as assignedUsername
         FROM tickets t LEFT JOIN users u ON u.id = t.assignedUserId WHERE ${conditions.join(' AND ')} ORDER BY t.updatedAt DESC LIMIT 50`,
        params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});
// Für AuraChat: ein Ticket ANLEGEN (z.B. Housekeeping-Meldung "Zimmer 305 braucht Toilettenpapier"). Die Herkunft ist immer "aurachat".
// Texte werden von Steuerzeichen befreit und gekürzt; die Oberfläche zeigt sie ohnehin nur als Text. Ein Ticket ohne Postfach ist
// nicht beantwortbar (richtig so: eine Meldung eines Gastes soll nicht per E-Mail "beantwortet" werden).
app.post('/api/service/tickets', requireTicketServiceKey, async (req, res) => {
    const body = req.body || {};
    const clean = (v, max) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
    const subject = clean(body.subject, 200);
    if (!subject) return res.status(400).json({ error: 'Der Betreff ist erforderlich.' });
    const bodyText = clean(body.bodyText, 2000);
    const requesterName = clean(body.requesterName, 100);
    let requesterEmail = clean(body.requesterEmail, 200);
    if (!/^[^\s@]+@[^\s@]+$/.test(requesterEmail)) requesterEmail = 'aurachat@aurachat.invalid'; // Pflichtfeld; ".invalid" ist nie zustellbar
    const priority = ['low', 'normal', 'high', 'urgent'].includes(body.priority) ? body.priority : 'normal';
    let assignedUserId = null;
    if (body.assignToUsername) {
        const user = await new Promise((resolve) => db.get(`SELECT id FROM users WHERE username = ?`, [String(body.assignToUsername)], (e, r) => resolve(r)));
        if (!user) return res.status(404).json({ error: `Person "${clean(body.assignToUsername, 60)}" nicht gefunden.` });
        assignedUserId = user.id;
    }
    // Nummernvergabe ist nicht atomar: bei gleichzeitigen Meldungen kann dieselbe Nummer vorkommen (UNIQUE) - dann neu versuchen
    for (let attempt = 0; attempt < 3; attempt++) {
        const number = await generateTicketNumber();
        const result = await new Promise((resolve) => db.run(
            `INSERT INTO tickets (number, subject, priority, requesterEmail, requesterName, source, assignedUserId) VALUES (?, ?, ?, ?, ?, 'aurachat', ?)`,
            [number, subject, priority, requesterEmail, requesterName, assignedUserId], function (err) { resolve({ err, id: this && this.lastID }); }));
        if (result.err) { if (/UNIQUE|constraint/i.test(result.err.message) && attempt < 2) continue; return res.status(500).json({ error: result.err.message }); }
        db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, fromName, bodyText) VALUES (?, 'note', ?, ?, ?)`, [result.id, requesterEmail, requesterName, bodyText]);
        return res.json({ success: true, id: result.id, number });
    }
});
// Zahlen für das AuraChat-Widget: offen / wartend / gelöst / geschlossen / insgesamt, und wie viele
// OFFENE Tickets der angefragten Person zugewiesen sind (?username=...).
app.get('/api/service/stats', requireTicketServiceKey, (req, res) => {
    const username = String(req.query.username || '').trim();
    db.all(`SELECT status, COUNT(*) AS c FROM tickets GROUP BY status`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const by = { open: 0, pending: 0, resolved: 0, closed: 0 };
        let total = 0;
        (rows || []).forEach(r => { by[r.status] = (by[r.status] || 0) + r.c; total += r.c; });
        const respond = (mine) => res.json({ open: by.open, pending: by.pending, resolved: by.resolved, closed: by.closed, total, mine });
        if (!username) return respond(0);
        db.get(`SELECT COUNT(*) AS c FROM tickets t JOIN users u ON u.id = t.assignedUserId WHERE u.username = ? AND t.status = 'open'`,
            [username], (e, row) => respond(!e && row ? row.c : 0));
    });
});
app.put('/api/service/tickets/:number', requireTicketServiceKey, (req, res) => {
    const { status, assignToUsername } = req.body;
    db.get(`SELECT * FROM tickets WHERE number = ?`, [req.params.number], async (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: `Ticket ${req.params.number} nicht gefunden.` });
        const updates = [], params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (assignToUsername) {
            const user = await new Promise((resolve) => db.get(`SELECT id FROM users WHERE username = ?`, [assignToUsername], (e, r) => resolve(r)));
            if (!user) return res.status(404).json({ error: `Person "${assignToUsername}" nicht gefunden.` });
            updates.push('assignedUserId = ?'); params.push(user.id);
        }
        if (updates.length === 0) return res.json({ success: true });
        updates.push('updatedAt = ?'); params.push(new Date().toISOString());
        params.push(ticket.id);
        db.run(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, params, (uErr) => {
            if (uErr) return res.status(500).json({ error: uErr.message });
            res.json({ success: true });
        });
    });
});
app.post('/api/service/tickets/:number/reply', requireTicketServiceKey, (req, res) => {
    const { bodyText, byUsername } = req.body;
    db.get(`SELECT * FROM tickets WHERE number = ?`, [req.params.number], async (err, ticket) => {
        if (err || !ticket) return res.status(404).json({ error: `Ticket ${req.params.number} nicht gefunden.` });
        if (!ticket.mailboxAddress) return res.status(400).json({ error: 'Dieses Ticket ist keinem Postfach zugeordnet.' });
        const author = byUsername ? await new Promise((resolve) => db.get(`SELECT id FROM users WHERE username = ?`, [byUsername], (e, r) => resolve(r))) : null;
        try {
            await callAuramail(`/api/external/mailboxes/${encodeURIComponent(ticket.mailboxAddress)}/send`, {
                method: 'POST',
                body: JSON.stringify({ to: [ticket.requesterEmail], subject: `Re: ${ticket.subject} [${ticket.number}]`, text: bodyText })
            });
            db.run(`INSERT INTO ticket_messages (ticketId, direction, fromAddress, bodyText, authorUserId) VALUES (?, 'outgoing', ?, ?, ?)`,
                [ticket.id, ticket.mailboxAddress, bodyText, author ? author.id : null]);
            db.run(`UPDATE tickets SET status = 'pending', updatedAt = ? WHERE id = ?`, [new Date().toISOString(), ticket.id]);
            res.json({ success: true });
        } catch (sendErr) {
            res.status(502).json({ error: 'Versand fehlgeschlagen: ' + sendErr.message });
        }
    });
});
// Ungelesene Hinweise für eine Person abholen (und als zugestellt markieren) - AuraChat
// fragt das regelmässig ab und liest die Nachrichten vor.
app.get('/api/service/notifications', requireTicketServiceKey, (req, res) => {
    const username = req.query.username;
    if (!username) return res.status(400).json({ error: 'username ist erforderlich.' });
    db.all(`SELECT id, message FROM ticket_notifications WHERE username = ? AND delivered = 0 ORDER BY createdAt ASC LIMIT 10`, [username], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length > 0) db.run(`UPDATE ticket_notifications SET delivered = 1 WHERE id IN (${rows.map(r => r.id).join(',')})`);
        res.json(rows.map(r => ({ message: r.message })));
    });
});

// --- Massenmail-Kampagnen ---
// Einfacher CSV-Parser für den Empfänger-Upload (email, name) - reicht für unser eigenes,
// vorgegebenes Format.
function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    return lines.map(line => {
        const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return { email: parts[0], name: parts[1] || '' };
    }).filter(r => r.email && r.email.includes('@'));
}

app.get('/api/campaigns', requireAuth, (req, res) => {
    db.all(
        `SELECT c.*, (SELECT COUNT(*) FROM campaign_recipients WHERE campaignId = c.id) as recipientCount,
                (SELECT COUNT(*) FROM campaign_recipients WHERE campaignId = c.id AND status = 'sent') as sentCount,
                (SELECT COUNT(*) FROM campaign_recipients WHERE campaignId = c.id AND status = 'failed') as failedCount
         FROM campaigns c ORDER BY c.createdAt DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});
app.post('/api/campaigns', requireAuth, requireAdmin, upload.single('recipients'), (req, res) => {
    const { name, subject, bodyText, mailboxAddress } = req.body;
    if (!name || !subject || !mailboxAddress || !req.file) return res.status(400).json({ error: 'Name, Betreff, Absender-Postfach und eine Empfänger-CSV-Datei sind erforderlich.' });
    const recipients = parseCsv(req.file.buffer.toString('utf-8'));
    if (recipients.length === 0) return res.status(400).json({ error: 'Die CSV-Datei enthält keine gültigen Adressen (Format: eine Adresse pro Zeile, optional ",Name").' });
    db.run(
        `INSERT INTO campaigns (name, subject, bodyText, mailboxAddress, createdByUserId) VALUES (?, ?, ?, ?, ?)`,
        [name, subject, bodyText || '', mailboxAddress.toLowerCase(), req.session.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const campaignId = this.lastID;
            const stmt = db.prepare(`INSERT INTO campaign_recipients (campaignId, email, name) VALUES (?, ?, ?)`);
            recipients.forEach(r => stmt.run(campaignId, r.email, r.name));
            stmt.finalize(() => res.json({ success: true, id: campaignId, recipientCount: recipients.length }));
        }
    );
});
app.get('/api/campaigns/:id', requireAuth, (req, res) => {
    db.get(`SELECT * FROM campaigns WHERE id = ?`, [req.params.id], (err, campaign) => {
        if (err || !campaign) return res.status(404).json({ error: 'Nicht gefunden.' });
        db.all(`SELECT email, name, status, error, sentAt FROM campaign_recipients WHERE campaignId = ? ORDER BY id`, [req.params.id], (rErr, recipients) => {
            if (rErr) return res.status(500).json({ error: rErr.message });
            res.json({ ...campaign, recipients });
        });
    });
});

// Versendet eine Kampagne im Hintergrund (nicht blockierend) - mit kleiner Pause zwischen
// den Nachrichten, um den Mailserver/Zieldienste nicht zu überlasten und das Risiko als Spam
// eingestuft zu werden etwas zu senken (ersetzt aber keine echte Versanddienst-Reputation).
async function sendCampaignInBackground(campaignId) {
    const campaign = await new Promise((resolve) => db.get(`SELECT * FROM campaigns WHERE id = ?`, [campaignId], (e, r) => resolve(r)));
    if (!campaign) return;
    const recipients = await new Promise((resolve) => db.all(`SELECT * FROM campaign_recipients WHERE campaignId = ? AND status = 'pending'`, [campaignId], (e, r) => resolve(r || [])));
    for (const recipient of recipients) {
        try {
            const personalizedText = (campaign.bodyText || '').replace(/\{\{name\}\}/g, recipient.name || '');
            await callAuramail(`/api/external/mailboxes/${encodeURIComponent(campaign.mailboxAddress)}/send`, {
                method: 'POST',
                body: JSON.stringify({ to: [recipient.email], subject: campaign.subject, text: personalizedText })
            });
            db.run(`UPDATE campaign_recipients SET status = 'sent', sentAt = ? WHERE id = ?`, [new Date().toISOString(), recipient.id]);
        } catch (err) {
            db.run(`UPDATE campaign_recipients SET status = 'failed', error = ? WHERE id = ?`, [err.message, recipient.id]);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 Sekunden Pause zwischen Nachrichten
    }
    db.run(`UPDATE campaigns SET status = 'sent', sentAt = ? WHERE id = ?`, [new Date().toISOString(), campaignId]);
}
app.post('/api/campaigns/:id/send', requireAuth, requireAdmin, (req, res) => {
    db.get(`SELECT * FROM campaigns WHERE id = ?`, [req.params.id], (err, campaign) => {
        if (err || !campaign) return res.status(404).json({ error: 'Nicht gefunden.' });
        if (campaign.status !== 'draft') return res.status(400).json({ error: 'Diese Kampagne wurde bereits gesendet oder versendet gerade.' });
        db.run(`UPDATE campaigns SET status = 'sending' WHERE id = ?`, [campaign.id], () => {
            sendCampaignInBackground(campaign.id);
            res.json({ success: true, message: `Versand gestartet - Fortschritt siehe Kampagnen-Übersicht.` });
        });
    });
});

// --- Benutzerverwaltung (Admin) ---
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    db.all(`SELECT id, username, firstname, lastname, role, source, active, twofa_enabled FROM users ORDER BY lastname, firstname`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    const { username, password, firstname, lastname, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich.' });
    const hash = await bcrypt.hash(password, 10);
    db.run(
        `INSERT INTO users (username, passwordHash, firstname, lastname, role) VALUES (?, ?, ?, ?, ?)`,
        [username.trim(), hash, firstname || '', lastname || '', role === 'admin' ? 'admin' : 'agent'],
        function (err) {
            if (err) return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Dieser Benutzername existiert bereits.' : err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});
app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { firstname, lastname, role, active, password } = req.body;
    const updates = [], params = [];
    if (firstname !== undefined) { updates.push('firstname = ?'); params.push(firstname); }
    if (lastname !== undefined) { updates.push('lastname = ?'); params.push(lastname); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role === 'admin' ? 'admin' : 'agent'); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (password) { updates.push('passwordHash = ?'); params.push(await bcrypt.hash(password, 10)); }
    if (updates.length === 0) return res.json({ success: true });
    params.push(req.params.id);
    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.post('/api/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Das neue Passwort muss mindestens 8 Zeichen haben.' });
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.user.id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Nicht gefunden.' });
        const ok = await bcrypt.compare(currentPassword, row.passwordHash).catch(() => false);
        if (!ok) return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
        const hash = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET passwordHash = ? WHERE id = ?`, [hash, row.id], () => res.json({ success: true }));
    });
});

// --- 2FA (global erzwingbar) ---
app.get('/api/admin/security', requireAuth, requireAdmin, async (req, res) => {
    res.json({ twofaRequired: (await getConfig('twofa_required')) === 'true' });
});
app.post('/api/admin/security', requireAuth, requireAdmin, async (req, res) => {
    await setConfig('twofa_required', req.body.twofaRequired ? 'true' : 'false');
    res.json({ success: true });
});

// --- Backup & Wiederherstellung ---
app.get('/api/admin/backup', requireAuth, requireAdmin, (req, res) => {
    const tmpDbPath = path.join(dataDir, `backup-tmp-${Date.now()}.db`);
    db.run(`VACUUM INTO ?`, [tmpDbPath], (err) => {
        if (err) return res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
        try {
            const zip = new AdmZip();
            zip.addLocalFile(tmpDbPath, '', 'auraticket.db');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="auraticket-backup-${timestamp}.zip"` });
            res.send(zip.toBuffer());
        } catch (zipErr) {
            res.status(500).json({ error: 'Backup fehlgeschlagen: ' + zipErr.message });
        } finally {
            fs.unlink(tmpDbPath, () => {});
        }
    });
});
app.post('/api/admin/backup/restore', requireAuth, requireAdmin, upload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    try {
        const zip = new AdmZip(req.file.buffer);
        const dbEntry = zip.getEntry('auraticket.db');
        if (!dbEntry) return res.status(400).json({ error: 'Diese Datei enthält keine auraticket.db - ist das wirklich ein AuraTicket-Backup?' });
        fs.writeFileSync(path.join(dataDir, 'auraticket.db'), dbEntry.getData());
        res.json({ success: true, message: 'Wiederhergestellt. Server startet jetzt neu...' });
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen: ' + err.message });
    }
});

suitePing.start();
app.listen(PORT, () => console.log(`AuraTicket läuft auf Port ${PORT}`));
