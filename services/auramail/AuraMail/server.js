// AuraMail - flexibler Mail-Dienst für das Aura-Ökosystem.
// Drei wählbare Anbindungsarten: interner (vereinfachter) Mailserver, Microsoft 365/Exchange
// via Graph-API, oder ein beliebiger externer IMAP/SMTP-Anbieter. Postfächer lassen sich mit
// AuraDirect abgleichen (automatisch persönliche Postfächer je Person) oder als geteilte
// Postfächer (z.B. "info@") unabhängig davon anlegen.
//
// EHRLICHER HINWEIS zum internen Mailserver: das ist eine funktionierende, aber bewusst
// einfache Node.js-Umsetzung (smtp-server zum Empfangen, nodemailer zum Versenden) - kein
// Ersatz für eine produktionsreife Lösung wie Postfix/Dovecot. Insbesondere Zustellbarkeit
// (SPF/DKIM/DMARC, IP-Reputation) muss beim direkten Versand selbst sichergestellt werden;
// ein konfigurierbarer Relay/Smarthost wird deshalb unterstützt und empfohlen.

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
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET) {
    console.warn('WARNUNG: SESSION_SECRET ist nicht gesetzt - bitte in .env eintragen (z.B. openssl rand -hex 32).');
}

app.use(express.json({ limit: '15mb' })); // grosszügiger wegen E-Mail-Anhängen als Base64
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

const db = new sqlite3.Database(path.join(dataDir, 'auramail.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
});

db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL`);

    // Login-Konten für AuraMail selbst (Admin + normale Personen, die ihr Postfach im
    // Web-Interface einsehen dürfen) - getrennt von den eigentlichen Postfächern, da ein
    // geteiltes Postfach (z.B. "info@") von mehreren Personen genutzt werden kann.
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        firstname TEXT NOT NULL DEFAULT '',
        lastname TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user',
        source TEXT NOT NULL DEFAULT 'local',
        active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER NOT NULL DEFAULT 0,
        privacy_accepted_version INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    // Postfächer: "personal" (an eine Person gebunden, meist per AuraDirect-Abgleich
    // entstanden) oder "shared" (geteilt, z.B. "info@firma.ch" - mehrere Personen dürfen
    // Zugriff haben, siehe mailbox_access).
    db.run(`CREATE TABLE IF NOT EXISTS mailboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'personal',
        ownerUserId INTEGER,
        externalUsername TEXT,
        externalPasswordEnc TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(ownerUserId) REFERENCES users(id)
    )`);
    // Wer (ausser der/dem Eigentümer:in) auf ein Postfach zugreifen darf - v.a. für geteilte
    // Postfächer relevant, kann aber auch persönliche Postfächer zusätzlich freigeben.
    db.run(`CREATE TABLE IF NOT EXISTS mailbox_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailboxId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        UNIQUE(mailboxId, userId),
        FOREIGN KEY(mailboxId) REFERENCES mailboxes(id),
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mailboxId INTEGER NOT NULL,
        folder TEXT NOT NULL DEFAULT 'inbox',
        messageId TEXT,
        inReplyTo TEXT,
        fromAddress TEXT,
        fromName TEXT,
        toAddress TEXT,
        ccAddress TEXT,
        subject TEXT,
        bodyText TEXT,
        bodyHtml TEXT,
        isRead INTEGER NOT NULL DEFAULT 0,
        receivedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(mailboxId) REFERENCES mailboxes(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId INTEGER NOT NULL,
        filename TEXT NOT NULL,
        contentType TEXT,
        data BLOB,
        FOREIGN KEY(messageId) REFERENCES messages(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS configs (userId INTEGER, key TEXT, value TEXT, PRIMARY KEY (userId, key))`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS connected_products (product TEXT PRIMARY KEY, lastSeenAt TEXT NOT NULL)`);

    // Fest eingerichteter Admin-Zugang beim allerersten Start, analog zu den anderen
    // Aura-Produkten.
    db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`, [], async (err, row) => {
        if (!err && !row) {
            const hash = await bcrypt.hash('admin', 10);
            db.run(`INSERT INTO users (username, passwordHash, firstname, lastname, role) VALUES ('admin', ?, 'Admin', '', 'admin')`, [hash], () => {
                console.log('Standard-Admin-Konto erstellt (admin / admin) - bitte Passwort nach dem ersten Login ändern.');
            });
        }
    });
});

const GLOBAL_USER_ID = 0; // globale Einstellungen (nicht personenbezogen) - gleiche Konvention wie bei den anderen Aura-Produkten

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
const AURA_APP_NAME = 'AuraMail';
const AURA_APP_VERSION = String(require('./package.json').version);
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
app.get('/api/version', requireAuth, (req, res) => { const suite = suitePing.suite(); res.set('Cache-Control', 'no-store').json({ product: AURA_APP_NAME, installed: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite, updateAvailable: !!(suite && AURA_SUITE_INSTALLED && versionOlder(AURA_SUITE_INSTALLED, suite.version)) }); });

// Anonymer Check-in beim Lizenzserver (nicht abschaltbar): Produkt, Version, Zustand, Zahl der Konten, zufällige Installations-Kennung. Keine Namen, keine Inhalte.
// Aus der Antwort kommt die Aura-Suite-Version, die im Lizenzserver eingetragen ist: sie erscheint unter "Über Aura-Suite" (siehe /api/version).
const suitePing = createSuitePing({
    product: 'mail', version: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, dataDir, host: process.env.LICENSE_CHECKIN_HOST,
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
const DEFAULT_PRIVACY_POLICY = '# Datenschutzerklärung\n\nDiese Anwendung (AuraMail) verwaltet E-Mail-Postfächer und speichert dafür folgende Daten:\n\n- Name, Benutzername und Rolle (das Passwort nur als Prüfwert, bei Zwei-Faktor-Anmeldung zusätzlich das Geheimnis der Authenticator-App)\n- Zugangsdaten zu den angebundenen Postfächern, soweit sie für das Abrufen und Senden nötig sind\n- E-Mail-Nachrichten, Anhänge und Zuordnungen von Postfächern zu Personen, die über diese Anwendung abgerufen, gesendet oder verwaltet werden\n- Technische Protokolle (z. B. Anmeldungen und Fehler) für Betrieb und Sicherheit\n\nDiese Daten werden ausschliesslich auf dem Server des Betreibers gespeichert und nicht an Dritte weitergegeben, ausser an die Mailserver, die der Betreiber für den Versand und Empfang angebunden hat. Auskunft, Berichtigung und Löschung erhaltet ihr bei den Administrator:innen.' + '\n\n' + auraPrivacy.CHECKIN_NOTICE;
auraPrivacy.register(app, { db, requireAuth, requireAdmin: requireAdmin, getUserId: (req) => (req.session && req.session.user && req.session.user.id) || null, defaultText: DEFAULT_PRIVACY_POLICY });

// Sehr einfache, symmetrische Verschlüsselung für Postfach-Passwörter externer Konten
// (IMAP/SMTP-Zugangsdaten) - Schlüssel liegt in der Umgebungsvariable, nicht in der
// Datenbank selbst (gleiches Prinzip wie bei AuraChats "persönlicher Verfassung").
const CRED_ENC_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(process.env.CREDENTIAL_ENCRYPTION_KEY).digest()
    : null;
if (!CRED_ENC_KEY) {
    console.warn('WARNUNG: CREDENTIAL_ENCRYPTION_KEY ist nicht gesetzt - externe Postfach-Passwörter können nicht sicher gespeichert werden (Verbindungen mit externen Zugangsdaten funktionieren erst, sobald der Schlüssel gesetzt ist).');
}
function encryptCredential(plaintext) {
    if (!CRED_ENC_KEY || !plaintext) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', CRED_ENC_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}
function decryptCredential(value) {
    if (!value || !CRED_ENC_KEY) return null;
    try {
        const [, ivB64, authTagB64, dataB64] = value.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', CRED_ENC_KEY, Buffer.from(ivB64, 'base64'));
        decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    } catch {
        return null;
    }
}

// --- LIZENZMANAGEMENT ---
// Gleiches Verfahren wie bei den anderen Aura-Produkten: HMAC-signierter Schlüssel, offline
// prüfbar.
// Lizenzregel (einheitlich für alle Aura-Produkte): 14 Tage Testphase mit allem, danach eine gültige Lizenz oder die Gratis-Stufe
// (höchstens 1 aktives Konto: der Admin). Mehr Konten brauchen eine Lizenz.
const TRIAL_DAYS = 14;

function verifyLicenseKey(licenseKey) {
    if (!licenseKey || typeof licenseKey !== 'string' || !licenseKey.includes('.')) {
        return { valid: false, error: 'Ungültiges Lizenzformat.' };
    }
    const [payloadB64, signatureB64] = licenseKey.trim().split('.');
    if (!payloadB64 || !signatureB64) return { valid: false, error: 'Ungültiges Lizenzformat.' };
    const secret = process.env.LICENSE_SECRET || '';
    if (!secret) return { valid: false, error: 'Lizenzsystem ist serverseitig nicht konfiguriert (LICENSE_SECRET fehlt).' };
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const sigBuf = Buffer.from(signatureB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, error: 'Lizenzsignatur ist ungültig.' };
    }
    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    } catch {
        return { valid: false, error: 'Lizenz-Daten sind beschädigt.' };
    }
    if (payload.product !== 'auramail') return { valid: false, error: 'Diese Lizenz ist nicht für AuraMail ausgestellt.' };
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
        return { valid: false, error: 'Lizenz ist abgelaufen.', payload };
    }
    return { valid: true, payload };
}

function getTrialInfo() {
    return getSetting('install_date').then(async (installDate) => {
        if (!installDate) {
            installDate = new Date().toISOString();
            await setSetting('install_date', installDate);
        }
        const daysElapsed = (Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24);
        return { active: daysElapsed < TRIAL_DAYS, daysRemaining: Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed)) };
    });
}

// Dauerhafte Gratis-Stufe nach der Testphase: EIN aktives Konto, und das ist der Admin. Jedes weitere Konto braucht eine Lizenz.
function isWithinFreeTier() {
    return new Promise((resolve) => db.get(`SELECT COUNT(*) as c FROM users WHERE active = 1`, [], (err, row) => resolve(!err && !!row && row.c <= 1)));
}
function recordProductConnection(product) {
    if (!['aurachat', 'auraplan', 'auradirect'].includes(product)) return;
    db.run(
        `INSERT INTO connected_products (product, lastSeenAt) VALUES (?, ?) ON CONFLICT(product) DO UPDATE SET lastSeenAt = excluded.lastSeenAt`,
        [product, new Date().toISOString()], () => {}
    );
}

async function getStoredLicenseInfo() {
    const key = await getSetting('license_key');
    let base = { valid: false, customer: null, expiresAt: null, error: 'Keine Lizenz hinterlegt.' };
    if (key) {
        const result = verifyLicenseKey(key);
        base = {
            valid: result.valid,
            customer: (result.payload && result.payload.customer) || null,
            expiresAt: (result.payload && result.payload.expiresAt) || null,
            error: result.valid ? null : result.error
        };
    }
    // Reihenfolge: erst die 14 Tage Testphase (alles erlaubt), dann eine gültige Lizenz, sonst die Gratis-Stufe (höchstens 1 aktives Konto: der Admin), sonst gesperrt.
    const trial = await getTrialInfo();
    if (trial.active) return { ...base, valid: true, licenseValid: base.valid, trial: true, trialDaysRemaining: trial.daysRemaining, freeTier: false };
    if (base.valid) return { ...base, licenseValid: true, trial: false, trialDaysRemaining: 0, freeTier: false };
    if (await isWithinFreeTier()) return { ...base, valid: true, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: true, freeTierReason: 'users' };
    return { ...base, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: false };
}

// Blockiert die API ohne gültige Lizenz/Testphase/Gratis-Stufe - Login und die
// Lizenz-Prüfung/-Eingabe selbst bleiben ausgenommen.
async function requireLicense(req, res, next) {
    const exempt = ['/api/login', '/api/logout', '/api/me', '/api/license', '/api/admin/license', '/api/admin/license/remove'];
    if (!req.path.startsWith('/api/') || exempt.includes(req.path)) return next();
    const info = await getStoredLicenseInfo();
    if (info.valid) return next();
    res.status(402).json({ error: 'Keine gültige Lizenz für AuraMail hinterlegt.', licenseRequired: true });
}

// --- 2FA ---
function generateTwofaSecret() { return authenticator.generateSecret(); }
async function require2faSetupCheck(req, res, next) {
    const requiredSetting = await getConfig('twofa_required');
    if (requiredSetting !== 'true') return next();
    if (req.session.twofaVerified) return next();
    res.status(403).json({ error: '2FA erforderlich.', twofaRequired: true });
}

app.use(requireLicense);

function toSessionUser(row) {
    return { id: row.id, username: row.username, firstname: row.firstname, lastname: row.lastname, role: row.role };
}

// Bevor lokal geprüft wird: fragt bei AuraDirect nach, ob diese Person dort für "auramail"
// freigeschaltet ist - genau dasselbe Muster wie bei AuraChat/AuraPlan, damit ein einziges
// AuraDirect-Konto überall funktioniert, statt separater Passwörter pro Produkt.
async function tryAuraDirectLogin(username, password, twofaCode) {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    if (!url) return { configured: false };
    // Liefert immer ein Objekt: bei Erfolg die Antwort von AuraDirect (valid, role, requires2fa, ...),
    // bei technischen Problemen "problem" mit einer verständlichen Erklärung - damit die Anmeldeseite
    // sagen kann, woran es hakt, statt nur "falsches Passwort".
    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey || '' },
            body: JSON.stringify({ username, password, product: 'auramail', twofaCode }),
            signal: AbortSignal.timeout(6000)
        });
        if (resp.status === 401) return { configured: true, problem: 'Der Dienst-Schlüssel für AuraDirect wird dort nicht akzeptiert (Admin Panel → AuraDirect prüfen).' };
        if (resp.status === 402) return { configured: true, problem: 'AuraDirect meldet, dass es nicht lizenziert ist.' };
        if (!resp.ok) return { configured: true, problem: `AuraDirect antwortete mit Status ${resp.status}.` };
        const data = await resp.json().catch(() => ({}));
        return { configured: true, ...data };
    } catch (err) {
        // AuraDirect nicht erreichbar - lokal weitermachen, niemanden aussperren
        return { configured: true, problem: `AuraDirect ist nicht erreichbar (${err.message}).` };
    }
}
function provisionFromAuraDirect(username, adResult) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, existing) => {
            if (err) return reject(err);
            const role = adResult.role === 'admin' ? 'admin' : 'user';
            if (existing) {
                db.run(`UPDATE users SET firstname = ?, lastname = ?, role = ? WHERE id = ?`,
                    [adResult.firstname || existing.firstname, adResult.lastname || existing.lastname, role, existing.id],
                    (e) => e ? reject(e) : db.get(`SELECT * FROM users WHERE id = ?`, [existing.id], (e2, row) => e2 ? reject(e2) : resolve(row)));
            } else {
                const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10); // Zugangsdaten kommen von AuraDirect, lokaler Wert ist irrelevant
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

    // Das feste lokale Konto "admin" bleibt bewusst IMMER rein lokal (Notzugang) - so geht die Anmeldung
    // auch dann sofort, wenn AuraDirect gerade nicht erreichbar ist oder noch nicht eingerichtet wurde.
    const adResp = username.trim() === 'admin' ? { configured: false } : await tryAuraDirectLogin(username, password);
    if (adResp.requires2fa) {
        req.session.pendingAuraDirectUsername = username;
        req.session.pendingAuraDirectPassword = password;
        return res.json({ requires2fa: true, viaAuraDirect: true });
    }
    if (adResp.valid) {
        try {
            const row = await provisionFromAuraDirect(username, adResp);
            req.session.user = toSessionUser(row);
            return res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname, role: row.role });
        } catch (e) {
            return res.status(500).json({ error: 'Fehler beim Übernehmen der AuraDirect-Anmeldung: ' + e.message });
        }
    }

    const noAccess = adResp.error === 'Kein Zugriff auf dieses Produkt.';
    const adHint = () => adResp.problem ? ` Hinweis zu AuraDirect: ${adResp.problem}` : (adResp.error && !noAccess ? ` Hinweis von AuraDirect: ${adResp.error}` : '');

    db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username.trim()], async (err, row) => {
        if (err || !row) {
            if (noAccess) return res.status(401).json({ error: 'Die Anmeldung bei AuraDirect war erfolgreich, aber dieses Konto ist nicht für AuraMail freigeschaltet. In AuraDirect → Benutzer → bei der Person das Häkchen "AuraMail" setzen.' });
            return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' + adHint() });
        }
        if (row.source === 'auradirect') return res.status(401).json({ error: 'Diese Person wird über AuraDirect verwaltet.' + (noAccess ? ' Der Zugriff auf AuraMail wurde dort entzogen oder fehlt (AuraDirect → Benutzer → Häkchen "AuraMail").' : (adHint() || ' AuraDirect hat die Anmeldung abgelehnt (Passwort/Zugriff prüfen).')) });
        const ok = await bcrypt.compare(password, row.passwordHash).catch(() => false);
        if (!ok) return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' });

        const twofaRequiredGlobally = (await getConfig('twofa_required')) === 'true';
        if (row.twofa_enabled || twofaRequiredGlobally) {
            if (!row.twofa_secret) {
                const secret = generateTwofaSecret();
                db.run(`UPDATE users SET twofa_secret = ? WHERE id = ?`, [secret, row.id]);
                req.session.pendingUserId = row.id;
                const otpauthUrl = authenticator.keyuri(row.username, 'AuraMail', secret);
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
    if (adResp.error === 'Kein Zugriff auf dieses Produkt.') return res.status(401).json({ error: 'Anmeldung bei AuraDirect erfolgreich, aber dieses Konto ist nicht für AuraMail freigeschaltet (AuraDirect → Benutzer → Häkchen "AuraMail").' });
    if (adResp.problem) return res.status(401).json({ error: adResp.problem });
    if (!adResp.valid) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
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
    db.get(`SELECT id, username, firstname, lastname, role, privacy_accepted_version FROM users WHERE id = ?`, [req.session.user.id], (err, row) => {
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

// --- Mail-Backend einbinden ---
const mailBackend = require('./mailBackend.js')({ db, getConfig, decryptCredential });

app.get('/api/admin/mail-config', requireAuth, requireAdmin, async (req, res) => {
    res.json({
        mode: await getMailMode(),
        o365: {
            tenantId: await getConfig('o365_tenant_id'),
            clientId: await getConfig('o365_client_id'),
            hasClientSecret: !!(await getConfig('o365_client_secret'))
        },
        external: {
            imapHost: await getConfig('external_imap_host'),
            imapPort: await getConfig('external_imap_port'),
            imapSecure: await getConfig('external_imap_secure'),
            smtpHost: await getConfig('external_smtp_host'),
            smtpPort: await getConfig('external_smtp_port'),
            smtpSecure: await getConfig('external_smtp_secure')
        },
        internal: {
            domain: await getConfig('internal_domain'),
            relayHost: await getConfig('internal_relay_host'),
            relayPort: await getConfig('internal_relay_port'),
            relayUsername: await getConfig('internal_relay_username'),
            hasRelayPassword: !!(await getConfig('internal_relay_password_enc'))
        }
    });
});
async function getMailMode() { return (await getConfig('mail_mode')) || 'internal'; }

app.post('/api/admin/mail-config/mode', requireAuth, requireAdmin, async (req, res) => {
    const mode = req.body.mode;
    if (!['internal', 'o365', 'external'].includes(mode)) return res.status(400).json({ error: 'Ungültiger Modus.' });
    await setConfig('mail_mode', mode);
    res.json({ success: true });
});
app.post('/api/admin/mail-config/o365', requireAuth, requireAdmin, async (req, res) => {
    const { tenantId, clientId, clientSecret } = req.body;
    if (tenantId !== undefined) await setConfig('o365_tenant_id', (tenantId || '').trim());
    if (clientId !== undefined) await setConfig('o365_client_id', (clientId || '').trim());
    if (clientSecret) await setConfig('o365_client_secret', clientSecret.trim()); // leer = unverändert lassen
    res.json({ success: true });
});
app.post('/api/admin/mail-config/external', requireAuth, requireAdmin, async (req, res) => {
    const { imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure } = req.body;
    await setConfig('external_imap_host', (imapHost || '').trim());
    await setConfig('external_imap_port', String(imapPort || 993));
    await setConfig('external_imap_secure', imapSecure === false ? 'false' : 'true');
    await setConfig('external_smtp_host', (smtpHost || '').trim());
    await setConfig('external_smtp_port', String(smtpPort || 587));
    await setConfig('external_smtp_secure', smtpSecure ? 'true' : 'false');
    res.json({ success: true });
});
app.post('/api/admin/mail-config/internal', requireAuth, requireAdmin, async (req, res) => {
    const { domain, relayHost, relayPort, relayUsername, relayPassword } = req.body;
    await setConfig('internal_domain', (domain || '').trim());
    await setConfig('internal_relay_host', (relayHost || '').trim());
    await setConfig('internal_relay_port', String(relayPort || 587));
    await setConfig('internal_relay_username', (relayUsername || '').trim());
    if (relayPassword) await setConfig('internal_relay_password_enc', encryptCredential(relayPassword.trim()));
    res.json({ success: true });
});
app.post('/api/admin/mail-config/test', requireAuth, requireAdmin, async (req, res) => {
    res.json(await mailBackend.testConnection());
});

// Schickt eine echte Test-E-Mail über die aktuell konfigurierte Anbindung - im Gegensatz zu
// "Verbindung testen" oben (die nur prüft, ob überhaupt eine Verbindung zustande kommt) wird
// hier tatsächlich eine Nachricht verschickt, inklusive Zustellung.
app.post('/api/admin/mail-config/test-send', requireAuth, requireAdmin, async (req, res) => {
    const { mailboxId, to } = req.body;
    if (!mailboxId || !to) return res.status(400).json({ error: 'Bitte Absender-Postfach und Empfänger-Adresse angeben.' });
    db.get(`SELECT * FROM mailboxes WHERE id = ?`, [mailboxId], async (err, mailbox) => {
        if (err || !mailbox) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
        try {
            const sentAt = new Date().toLocaleString('de-DE');
            await mailBackend.sendMail(mailbox, {
                to: [to.trim()],
                subject: 'AuraMail Testmail',
                text: `Das ist eine Testmail von AuraMail, gesendet über das Postfach ${mailbox.address} am ${sentAt}.\n\nWenn diese Nachricht bei dir ankommt, funktioniert die aktuelle Mail-Anbindung.`
            });
            res.json({ success: true, message: `Testmail an ${to.trim()} wurde übergeben. Bitte Posteingang (und Spam-Ordner) dort prüfen - "übergeben" heisst nicht zwingend "angekommen".` });
        } catch (sendErr) {
            res.status(502).json({ error: 'Versand fehlgeschlagen: ' + sendErr.message });
        }
    });
});

// --- Externe API: für andere Aura-Produkte (z.B. AuraTicket) zum Lesen/Versenden über ein
// Postfach. Eigener, separater Schlüssel - gleiches Muster wie bei AuraPlan.
let EXTERNAL_API_KEY = null;
async function ensureExternalApiKey() {
    if (EXTERNAL_API_KEY) return EXTERNAL_API_KEY;
    let stored = await getSetting('external_api_key');
    if (!stored) { stored = crypto.randomBytes(32).toString('hex'); await setSetting('external_api_key', stored); }
    EXTERNAL_API_KEY = stored;
    return stored;
}
ensureExternalApiKey();
async function requireServiceKey(req, res, next) {
    const key = await ensureExternalApiKey();
    const provided = (req.headers['x-service-key'] || '').trim();
    if (provided !== key) return res.status(401).json({ error: 'Ungültiger oder fehlender Dienst-Schlüssel.' });
    next();
}
app.get('/api/admin/external-api-key', requireAuth, requireAdmin, async (req, res) => res.json({ key: await ensureExternalApiKey() }));
app.post('/api/admin/external-api-key/regenerate', requireAuth, requireAdmin, async (req, res) => {
    EXTERNAL_API_KEY = crypto.randomBytes(32).toString('hex');
    await setSetting('external_api_key', EXTERNAL_API_KEY);
    res.json({ key: EXTERNAL_API_KEY });
});

// Für AuraTicket: neue eingehende Nachrichten eines Postfachs abrufen (für Ticket-Erstellung
// per E-Mail) und über ein Postfach versenden (für Ticket-Antworten und Massenmail-Kampagnen).
app.get('/api/external/mailboxes/:address/messages', requireServiceKey, (req, res) => {
    const since = req.query.since || '1970-01-01';
    db.get(`SELECT id FROM mailboxes WHERE address = ? AND active = 1`, [req.params.address.toLowerCase()], (err, mailbox) => {
        if (err || !mailbox) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
        db.all(
            `SELECT id, messageId, inReplyTo, fromAddress, fromName, toAddress, subject, bodyText, bodyHtml, receivedAt
             FROM messages WHERE mailboxId = ? AND folder = 'inbox' AND receivedAt > ? ORDER BY receivedAt ASC LIMIT 100`,
            [mailbox.id, since], (mErr, rows) => {
                if (mErr) return res.status(500).json({ error: mErr.message });
                res.json(rows);
            }
        );
    });
});
// Einfache Prüfung für AuraChat ("Verbindung testen"): stimmt der Dienst-Schlüssel, und gibt es das Postfach?
app.get('/api/external/ping', requireServiceKey, (req, res) => {
    const address = String(req.query.address || '').trim().toLowerCase();
    if (!address) return res.json({ ok: true });
    db.get(`SELECT id FROM mailboxes WHERE address = ? AND active = 1`, [address], (err, row) => res.json({ ok: true, mailboxExists: !err && !!row }));
});
app.post('/api/external/mailboxes/:address/send', requireServiceKey, (req, res) => {
    db.get(`SELECT * FROM mailboxes WHERE address = ? AND active = 1`, [req.params.address.toLowerCase()], async (err, mailbox) => {
        if (err || !mailbox) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
        const { to, cc, subject, text, html } = req.body;
        const toList = Array.isArray(to) ? to : (to || '').split(',').map(s => s.trim()).filter(Boolean);
        if (toList.length === 0) return res.status(400).json({ error: 'Mindestens ein:e Empfänger:in ist erforderlich.' });
        try {
            await mailBackend.sendMail(mailbox, { to: toList, cc: cc || [], subject, text, html });
            res.json({ success: true });
        } catch (sendErr) {
            res.status(502).json({ error: 'Versand fehlgeschlagen: ' + sendErr.message });
        }
    });
});

// --- Postfach-Verwaltung ---
app.get('/api/mailboxes', requireAuth, (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    const query = isAdmin
        ? `SELECT m.*, u.username as ownerUsername FROM mailboxes m LEFT JOIN users u ON u.id = m.ownerUserId ORDER BY m.type, m.address`
        : `SELECT m.*, u.username as ownerUsername FROM mailboxes m LEFT JOIN users u ON u.id = m.ownerUserId
           WHERE m.ownerUserId = ? OR m.id IN (SELECT mailboxId FROM mailbox_access WHERE userId = ?)
           ORDER BY m.type, m.address`;
    const params = isAdmin ? [] : [req.session.user.id, req.session.user.id];
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({ ...r, externalPasswordEnc: undefined })));
    });
});

app.post('/api/admin/mailboxes', requireAuth, requireAdmin, (req, res) => {
    const { address, displayName, type, ownerUserId, externalUsername, externalPassword } = req.body;
    if (!address) return res.status(400).json({ error: 'Adresse ist erforderlich.' });
    db.run(
        `INSERT INTO mailboxes (address, displayName, type, ownerUserId, externalUsername, externalPasswordEnc) VALUES (?, ?, ?, ?, ?, ?)`,
        [address.trim().toLowerCase(), displayName || '', type === 'shared' ? 'shared' : 'personal', ownerUserId || null, externalUsername || null, externalPassword ? encryptCredential(externalPassword) : null],
        function (err) {
            if (err) return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Diese Adresse existiert bereits.' : err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});
// --- Microsoft 365: vorhandene Konten anzeigen und gezielt als Postfächer übernehmen ---
app.get('/api/admin/o365/mailboxes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const list = await mailBackend.listO365Mailboxes();
        const existing = await new Promise((resolve) => db.all(`SELECT address FROM mailboxes`, [], (e, rows) => resolve(new Set((rows || []).map(r => r.address.toLowerCase())))));
        res.json(list.map(m => ({ ...m, alreadyAdded: existing.has(m.address) })));
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});
app.post('/api/admin/o365/mailboxes/import', requireAuth, requireAdmin, async (req, res) => {
    const items = Array.isArray(req.body.mailboxes) ? req.body.mailboxes : [];
    if (items.length === 0) return res.status(400).json({ error: 'Keine Postfächer ausgewählt.' });
    let created = 0, skipped = 0, linked = 0;
    for (const item of items) {
        const address = String(item.address || '').trim().toLowerCase();
        if (!address.includes('@')) { skipped++; continue; }
        const exists = await new Promise((resolve) => db.get(`SELECT id FROM mailboxes WHERE address = ?`, [address], (e, row) => resolve(row)));
        if (exists) { skipped++; continue; }
        const type = item.type === 'shared' ? 'shared' : 'personal';
        // Persönliche Postfächer automatisch der Person zuordnen, deren AuraMail-Benutzername
        // dem Teil vor dem @ entspricht (so wie es auch der AuraDirect-Abgleich anlegt) -
        // sonst wären sie nur für Administrator:innen sichtbar.
        let ownerUserId = null;
        if (type === 'personal') {
            const localPart = address.split('@')[0];
            const user = await new Promise((resolve) => db.get(`SELECT id FROM users WHERE lower(username) = ?`, [localPart], (e, row) => resolve(row)));
            if (user) { ownerUserId = user.id; linked++; }
        }
        await new Promise((resolve) => db.run(
            `INSERT INTO mailboxes (address, displayName, type, ownerUserId) VALUES (?, ?, ?, ?)`,
            [address, String(item.displayName || '').slice(0, 200), type, ownerUserId], () => resolve()
        ));
        created++;
    }
    res.json({ success: true, created, skipped, linked });
});

app.delete('/api/admin/mailboxes/:id', requireAuth, requireAdmin, (req, res) => {
    db.run(`DELETE FROM mailboxes WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
// Wem gehört ein Postfach, und wer darf es zusätzlich nutzen? (Oberfläche: Admin Panel → Postfächer → "Zuweisen")
app.get('/api/admin/mailboxes/:id/assignment', requireAuth, requireAdmin, (req, res) => {
    db.get(`SELECT id, address, displayName, type, ownerUserId FROM mailboxes WHERE id = ?`, [req.params.id], (err, mb) => {
        if (err || !mb) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
        db.all(`SELECT userId FROM mailbox_access WHERE mailboxId = ?`, [mb.id], (e, rows) => {
            res.json({ ...mb, accessUserIds: (rows || []).map(r => r.userId) });
        });
    });
});
app.put('/api/admin/mailboxes/:id/assignment', requireAuth, requireAdmin, async (req, res) => {
    const get = (sql, p) => new Promise((resolve, reject) => db.get(sql, p, (e, row) => e ? reject(e) : resolve(row)));
    const all = (sql, p) => new Promise((resolve, reject) => db.all(sql, p, (e, rows) => e ? reject(e) : resolve(rows || [])));
    const run = (sql, p) => new Promise((resolve, reject) => db.run(sql, p, (e) => e ? reject(e) : resolve()));
    try {
        const mailboxId = parseInt(req.params.id, 10);
        const ownerUserId = req.body.ownerUserId ? parseInt(req.body.ownerUserId, 10) : null;
        const accessUserIds = Array.isArray(req.body.accessUserIds)
            ? [...new Set(req.body.accessUserIds.map(n => parseInt(n, 10)).filter(Number.isInteger))] : [];
        if (!(await get(`SELECT id FROM mailboxes WHERE id = ?`, [mailboxId]))) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
        const ids = [...new Set([...(ownerUserId ? [ownerUserId] : []), ...accessUserIds])];
        if (ids.length > 0) {
            const known = await all(`SELECT id FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
            if (known.length !== ids.length) return res.status(400).json({ error: 'Eine ausgewählte Person gibt es nicht (mehr).' });
        }
        await run(`UPDATE mailboxes SET ownerUserId = ? WHERE id = ?`, [ownerUserId, mailboxId]);
        await run(`DELETE FROM mailbox_access WHERE mailboxId = ?`, [mailboxId]);
        for (const uid of accessUserIds) {
            if (uid !== ownerUserId) await run(`INSERT OR IGNORE INTO mailbox_access (mailboxId, userId) VALUES (?, ?)`, [mailboxId, uid]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/admin/mailboxes/:id/access', requireAuth, requireAdmin, (req, res) => {
    const { userId } = req.body;
    db.run(`INSERT OR IGNORE INTO mailbox_access (mailboxId, userId) VALUES (?, ?)`, [req.params.id, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.delete('/api/admin/mailboxes/:id/access/:userId', requireAuth, requireAdmin, (req, res) => {
    db.run(`DELETE FROM mailbox_access WHERE mailboxId = ? AND userId = ?`, [req.params.id, req.params.userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- AuraDirect-Abgleich: legt automatisch persönliche Postfächer + Login-Konten für
// aktive AuraDirect-Personen an, sofern noch nicht vorhanden. Bestehende werden nicht
// überschrieben (z.B. bereits angepasste Anzeigenamen bleiben erhalten).
app.get('/api/admin/auradirect', requireAuth, requireAdmin, async (req, res) => {
    res.json({ url: await getConfig('auradirect_url') || '', hasServiceKey: !!(await getConfig('auradirect_service_key')) });
});
app.post('/api/admin/auradirect', requireAuth, requireAdmin, async (req, res) => {
    const url = (req.body.url || '').trim();
    const serviceKey = (req.body.serviceKey || '').trim();
    // Verwechslung der beiden Felder (schon einmal passiert - URL landete im
    // Schlüssel-Feld) direkt beim Speichern abfangen, statt erst beim Abgleich mit einem
    // kryptischen "Status 401" zu scheitern.
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Die Adresse sollte mit http:// oder https:// beginnen - das sieht eher nach dem Dienst-Schlüssel aus. Bitte Felder prüfen.' });
    if (serviceKey && /^https?:\/\//i.test(serviceKey)) return res.status(400).json({ error: 'Das sieht nach einer Adresse aus, nicht nach einem Dienst-Schlüssel - bitte Felder prüfen (evtl. vertauscht?).' });
    await setConfig('auradirect_url', url);
    if (serviceKey) await setConfig('auradirect_service_key', serviceKey); // leer = bestehenden Schlüssel behalten
    res.json({ success: true });
});
// --- Personen aus AuraDirect übernehmen - OHNE dass sie sich vorher anmelden müssen, und
// ohne Mail-Domain/Postfächer (die gibt es z.B. bei Microsoft 365 gar nicht als Einstellung).
// Übernommen werden nur Personen, die in AuraDirect für AuraMail freigeschaltet sind, samt
// ihrer dortigen Rolle. Lokale Konten (z.B. "admin") werden nie angefasst, und ein von Hand
// deaktiviertes Konto bleibt deaktiviert.
async function syncUsersFromAuraDirect() {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    if (!url) throw new Error('Keine AuraDirect-Adresse hinterlegt.');
    const resp = await fetch(`${url.replace(/\/$/, '')}/api/service/users?product=auramail`, {
        headers: { 'X-Service-Key': serviceKey || '' },
        signal: AbortSignal.timeout(8000)
    });
    if (resp.status === 401) throw new Error('AuraDirect lehnt den Dienst-Schlüssel ab - bitte neu aus AuraDirect → Benutzer kopieren.');
    if (!resp.ok) throw new Error(`AuraDirect antwortete mit Status ${resp.status}.`);
    const people = await resp.json();
    if (!Array.isArray(people)) throw new Error('Unerwartete Antwort von AuraDirect.');
    // Ältere AuraDirect-Versionen kennen den Produktfilter nicht und würden ALLE Personen
    // liefern (ohne Rolle) - dann lieber abbrechen, als Unberechtigte zu übernehmen.
    if (people.length > 0 && !people.every(p => 'role' in p)) {
        throw new Error('Diese AuraDirect-Version kann noch nicht nach Produkt filtern - bitte AuraDirect auf den aktuellen Stand bringen. Sonst würden alle Personen übernommen, auch ohne AuraMail-Zugriff.');
    }
    const get = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (e, row) => e ? reject(e) : resolve(row)));
    const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, (e) => e ? reject(e) : resolve()));
    let created = 0, updated = 0;
    const conflicts = [];
    const seen = new Set();
    for (const person of people) {
        const username = String(person.username || '').trim();
        if (!username) continue;
        seen.add(username.toLowerCase());
        const role = person.role === 'admin' ? 'admin' : 'user';
        const existing = await get(`SELECT id, source FROM users WHERE lower(username) = lower(?)`, [username]);
        if (existing && existing.source !== 'auradirect') { conflicts.push(username); continue; }
        if (existing) {
            await run(`UPDATE users SET firstname = ?, lastname = ?, role = ? WHERE id = ?`, [person.firstname || '', person.lastname || '', role, existing.id]);
            updated++;
        } else {
            const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10); // Anmeldung läuft über AuraDirect, lokaler Wert ist irrelevant
            await run(`INSERT INTO users (username, passwordHash, firstname, lastname, role, source) VALUES (?, ?, ?, ?, ?, 'auradirect')`,
                [username, hash, person.firstname || '', person.lastname || '', role]);
            created++;
        }
    }
    // Nur zur Information (es wird nichts geändert): Personen hier, die in AuraDirect nicht
    // mehr für AuraMail freigeschaltet sind.
    const known = await new Promise((resolve) => db.all(`SELECT username FROM users WHERE source = 'auradirect' AND active = 1`, [], (e, rows) => resolve(rows || [])));
    const notInDirect = known.filter(u => !seen.has(u.username.toLowerCase())).length;
    // Postfächer ohne Eigentümer:in automatisch der Person zuordnen, deren AuraDirect-E-Mail genau der
    // Adresse des (persönlichen) Postfachs entspricht - z.B. michel.gerber@firma.ch, auch wenn der
    // Benutzername anders lautet. Bereits zugewiesene Postfächer bleiben unberührt.
    let assigned = 0;
    for (const person of people) {
        const email = String(person.email || '').trim().toLowerCase();
        const username = String(person.username || '').trim();
        if (!email || !username) continue;
        const u = await get(`SELECT id FROM users WHERE lower(username) = lower(?) AND source = 'auradirect'`, [username]);
        if (!u) continue;
        assigned += await new Promise((resolve, reject) => db.run(
            `UPDATE mailboxes SET ownerUserId = ? WHERE lower(address) = ? AND ownerUserId IS NULL AND type = 'personal'`,
            [u.id, email], function (e) { e ? reject(e) : resolve(this.changes || 0); }));
    }
    // Nur zur Erklärung, warum jemand fehlt: Personen, die es in AuraDirect gibt, die dort aber
    // (noch) nicht das Häkchen "AuraMail" haben. Schlägt das fehl, ist es nur eine Zusatzinfo.
    let notEnabled = [];
    try {
        const allResp = await fetch(`${url.replace(/\/$/, '')}/api/service/users`, { headers: { 'X-Service-Key': serviceKey || '' }, signal: AbortSignal.timeout(8000) });
        if (allResp.ok) {
            const all = await allResp.json();
            if (Array.isArray(all)) notEnabled = all.map(p => String(p.username || '').trim()).filter(n => n && !seen.has(n.toLowerCase())).slice(0, 20);
        }
    } catch { /* nur Zusatzinformation */ }
    return { created, updated, conflicts, notInDirect, assigned, notEnabled, total: people.length };
}
app.post('/api/admin/auradirect/sync-users', requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json({ success: true, ...(await syncUsersFromAuraDirect()) });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});
// Automatisch im Hintergrund (kurz nach dem Start und danach alle 6 Stunden), sobald
// AuraDirect eingerichtet ist - so tauchen neu freigeschaltete Personen von selbst auf.
async function autoSyncUsersFromAuraDirect() {
    if (!(await getConfig('auradirect_url'))) return;
    try {
        const r = await syncUsersFromAuraDirect();
        if (r.created || r.updated) console.log(`[AuraDirect-Abgleich] ${r.created} neu, ${r.updated} aktualisiert.`);
    } catch (err) {
        console.warn('[AuraDirect-Abgleich] nicht möglich:', err.message);
    }
}
setTimeout(autoSyncUsersFromAuraDirect, 20 * 1000);
setInterval(autoSyncUsersFromAuraDirect, 6 * 60 * 60 * 1000);

app.post('/api/admin/auradirect/sync', requireAuth, requireAdmin, async (req, res) => {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    const domain = (await getConfig('internal_domain')) || (await getConfig('mail_domain')) || '';
    if (!url) return res.status(400).json({ error: 'Keine AuraDirect-Adresse hinterlegt.' });
    if (!domain) return res.status(400).json({ error: 'Bitte zuerst unter Mail-Anbindung eine Domain für die Postfach-Adressen eintragen.' });

    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/service/users`, {
            headers: { 'X-Service-Key': serviceKey || '' },
            signal: AbortSignal.timeout(8000)
        });
        if (!resp.ok) return res.status(502).json({ error: `AuraDirect antwortete mit Status ${resp.status}.` });
        const people = await resp.json();

        let created = 0, skipped = 0;
        for (const person of people) {
            const address = `${person.username}@${domain}`.toLowerCase();
            const exists = await new Promise((resolve) => db.get(`SELECT id FROM mailboxes WHERE address = ?`, [address], (e, r) => resolve(r)));
            if (exists) { skipped++; continue; }

            // Login-Konto für die Person anlegen, falls noch keins existiert (per Benutzername)
            let userRow = await new Promise((resolve) => db.get(`SELECT id FROM users WHERE username = ?`, [person.username], (e, r) => resolve(r)));
            if (!userRow) {
                const tempHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
                const newId = await new Promise((resolve, reject) => db.run(
                    `INSERT INTO users (username, passwordHash, firstname, lastname, role, source) VALUES (?, ?, ?, ?, 'user', 'auradirect')`,
                    [person.username, tempHash, person.firstname || '', person.lastname || ''],
                    function (e) { e ? reject(e) : resolve(this.lastID); }
                ));
                userRow = { id: newId };
            }
            await new Promise((resolve) => db.run(
                `INSERT INTO mailboxes (address, displayName, type, ownerUserId) VALUES (?, ?, 'personal', ?)`,
                [address, `${person.firstname} ${person.lastname}`.trim(), userRow.id], () => resolve()
            ));
            created++;
        }
        res.json({ success: true, created, skipped, total: people.length });
    } catch (err) {
        res.status(502).json({ error: 'AuraDirect war nicht erreichbar: ' + err.message });
    }
});

// Prüft, ob die eingeloggte Person Zugriff auf ein bestimmtes Postfach hat (Eigentümer:in,
// per Freigabe berechtigt, oder Admin - Admins dürfen immer alles sehen).
function checkMailboxAccess(userId, isAdmin, mailboxId, callback) {
    if (isAdmin) return callback(true);
    db.get(
        `SELECT 1 FROM mailboxes WHERE id = ? AND ownerUserId = ?
         UNION SELECT 1 FROM mailbox_access WHERE mailboxId = ? AND userId = ?`,
        [mailboxId, userId, mailboxId, userId],
        (err, row) => callback(!err && !!row)
    );
}

app.get('/api/mailboxes/:id/messages', requireAuth, (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    const folder = req.query.folder || 'inbox';
    checkMailboxAccess(req.session.user.id, isAdmin, req.params.id, (allowed) => {
        if (!allowed) return res.status(403).json({ error: 'Kein Zugriff auf dieses Postfach.' });
        db.all(
            `SELECT id, fromAddress, fromName, toAddress, subject, isRead, receivedAt,
                    (SELECT COUNT(*) FROM attachments WHERE attachments.messageId = messages.id) as attachmentCount
             FROM messages WHERE mailboxId = ? AND folder = ? ORDER BY receivedAt DESC LIMIT 200`,
            [req.params.id, folder], (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            }
        );
    });
});

app.get('/api/messages/:id', requireAuth, (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    db.get(`SELECT * FROM messages WHERE id = ?`, [req.params.id], (err, msg) => {
        if (err || !msg) return res.status(404).json({ error: 'Nicht gefunden.' });
        checkMailboxAccess(req.session.user.id, isAdmin, msg.mailboxId, (allowed) => {
            if (!allowed) return res.status(403).json({ error: 'Kein Zugriff auf dieses Postfach.' });
            db.run(`UPDATE messages SET isRead = 1 WHERE id = ?`, [msg.id]);
            db.all(`SELECT id, filename, contentType, length(data) as size FROM attachments WHERE messageId = ?`, [msg.id], (aErr, attachments) => {
                res.json({ ...msg, attachments: attachments || [] });
            });
        });
    });
});

app.get('/api/attachments/:id', requireAuth, (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    db.get(
        `SELECT a.*, m.mailboxId FROM attachments a JOIN messages m ON m.id = a.messageId WHERE a.id = ?`,
        [req.params.id], (err, row) => {
            if (err || !row) return res.status(404).json({ error: 'Nicht gefunden.' });
            checkMailboxAccess(req.session.user.id, isAdmin, row.mailboxId, (allowed) => {
                if (!allowed) return res.status(403).json({ error: 'Kein Zugriff.' });
                res.setHeader('Content-Type', row.contentType || 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
                res.send(row.data);
            });
        }
    );
});

app.post('/api/mailboxes/:id/send', requireAuth, async (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    checkMailboxAccess(req.session.user.id, isAdmin, req.params.id, async (allowed) => {
        if (!allowed) return res.status(403).json({ error: 'Kein Zugriff auf dieses Postfach.' });
        db.get(`SELECT * FROM mailboxes WHERE id = ?`, [req.params.id], async (err, mailbox) => {
            if (err || !mailbox) return res.status(404).json({ error: 'Postfach nicht gefunden.' });
            const { to, cc, subject, text, html } = req.body;
            const toList = (to || '').split(',').map(s => s.trim()).filter(Boolean);
            const ccList = (cc || '').split(',').map(s => s.trim()).filter(Boolean);
            if (toList.length === 0) return res.status(400).json({ error: 'Mindestens ein:e Empfänger:in ist erforderlich.' });
            try {
                await mailBackend.sendMail(mailbox, { to: toList, cc: ccList, subject, text, html });
                db.run(
                    `INSERT INTO messages (mailboxId, folder, fromAddress, toAddress, ccAddress, subject, bodyText, bodyHtml, isRead, receivedAt)
                     VALUES (?, 'sent', ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [mailbox.id, mailbox.address, toList.join(', '), ccList.join(', '), subject || '', text || '', html || null, new Date().toISOString()]
                );
                res.json({ success: true });
            } catch (sendErr) {
                res.status(502).json({ error: 'Versand fehlgeschlagen: ' + sendErr.message });
            }
        });
    });
});

app.delete('/api/messages/:id', requireAuth, (req, res) => {
    const isAdmin = req.session.user.role === 'admin';
    db.get(`SELECT mailboxId FROM messages WHERE id = ?`, [req.params.id], (err, msg) => {
        if (err || !msg) return res.status(404).json({ error: 'Nicht gefunden.' });
        checkMailboxAccess(req.session.user.id, isAdmin, msg.mailboxId, (allowed) => {
            if (!allowed) return res.status(403).json({ error: 'Kein Zugriff.' });
            db.run(`UPDATE messages SET folder = 'trash' WHERE id = ?`, [req.params.id], (delErr) => {
                if (delErr) return res.status(500).json({ error: delErr.message });
                res.json({ success: true });
            });
        });
    });
});

// Regelmässiges Abfragen für "o365"/"external" - "internal" braucht das nicht (kommt direkt
// über den SMTP-Listener rein). Alle 3 Minuten, pro Postfach mit externen Zugangsdaten bzw.
// pro synchronisiertem O365-Postfach.
setInterval(async () => {
    const mode = await getMailMode();
    if (mode === 'internal') return;
    db.all(`SELECT * FROM mailboxes WHERE active = 1`, [], (err, mailboxes) => {
        if (err) return;
        mailboxes.forEach(async (mailbox) => {
            try {
                const newMessages = await mailBackend.fetchNewMessages(mailbox);
                for (const m of newMessages) {
                    const exists = m.messageId ? await new Promise((resolve) => db.get(`SELECT id FROM messages WHERE messageId = ? AND mailboxId = ?`, [m.messageId, mailbox.id], (e, r) => resolve(r))) : null;
                    if (exists) continue;
                    db.run(
                        `INSERT INTO messages (mailboxId, folder, messageId, inReplyTo, fromAddress, fromName, toAddress, subject, bodyText, bodyHtml, receivedAt)
                         VALUES (?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [mailbox.id, m.messageId || null, m.inReplyTo || null, m.fromAddress, m.fromName, m.toAddress, m.subject, m.bodyText, m.bodyHtml, m.receivedAt],
                        function (insertErr) {
                            if (insertErr || !this.lastID || !m.attachments) return;
                            m.attachments.forEach(a => {
                                db.run(`INSERT INTO attachments (messageId, filename, contentType, data) VALUES (?, ?, ?, ?)`,
                                    [this.lastID, a.filename || 'anhang', a.contentType || 'application/octet-stream', a.content]);
                            });
                        }
                    );
                }
            } catch (fetchErr) {
                console.error(`[Mail-Abruf] Fehler bei ${mailbox.address}:`, fetchErr.message);
            }
        });
    });
}, 3 * 60 * 1000);

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
        [username.trim(), hash, firstname || '', lastname || '', role === 'admin' ? 'admin' : 'user'],
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
    if (role !== undefined) { updates.push('role = ?'); params.push(role === 'admin' ? 'admin' : 'user'); }
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
            zip.addLocalFile(tmpDbPath, '', 'auramail.db');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="auramail-backup-${timestamp}.zip"` });
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
        const dbEntry = zip.getEntry('auramail.db');
        if (!dbEntry) return res.status(400).json({ error: 'Diese Datei enthält keine auramail.db - ist das wirklich ein AuraMail-Backup?' });
        fs.writeFileSync(path.join(dataDir, 'auramail.db'), dbEntry.getData());
        res.json({ success: true, message: 'Wiederhergestellt. Server startet jetzt neu...' });
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen: ' + err.message });
    }
});

suitePing.start();
app.listen(PORT, () => {
    console.log(`AuraMail läuft auf Port ${PORT}`);
    getMailMode().then((mode) => {
        if (mode === 'internal') {
            const smtpPort = parseInt(process.env.INTERNAL_SMTP_PORT || '2525', 10);
            require('./internalSmtpServer.js').startInternalSmtpServer({ db, getConfig, port: smtpPort });
        }
    });
});
