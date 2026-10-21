// AuraProxy - zentraler Reverse-Proxy für das Aura-Ökosystem. Verwaltet Domain→Ziel-
// Zuordnungen und steuert einen danebenlaufenden Caddy-Container über dessen Admin-API
// (http://caddy:2019) - Caddy übernimmt die eigentliche Weiterleitung UND holt automatisch
// Let's-Encrypt-Zertifikate pro Domain. AuraProxy selbst spricht kein TLS/ACME, sondern
// erzeugt nur die gewünschte Caddy-Konfiguration und lädt sie bei jeder Änderung neu.
//
// WICHTIG, unbedingt lesen: Let's Encrypt braucht zur Ausstellung/Erneuerung eines
// Zertifikats kurz Port 80 (oder 443) von aussen erreichbar - auch wenn der Dienst am Ende
// auf einem anderen Port laufen soll. Zusätzliche externe Ports müssen beim Start fest
// geöffnet sein (siehe docker-compose.yml, Vorrat 8090-8099) - Docker kann Ports nicht
// nachträglich ohne Neustart des Containers öffnen.

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
const net = require('net');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 256 * 1024, files: 2, fields: 5 } });   // Zertifikat und Schlüssel sind klein
const uploadBackup = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 5 } });

const app = express();
const PORT = process.env.PORT || 3000;
const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || 'http://caddy:2019';
const EXTRA_PORTS = (process.env.EXTRA_PORTS || '8090,8091,8092,8093,8094,8095,8096,8097,8098,8099').split(',').map(p => parseInt(p.trim(), 10));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
// Lesezugriff auf Caddys eigene, automatisch ausgestellte Zertifikate (zum Anzeigen/Löschen)
// sowie Ablage für eigene, hochgeladene Zertifikate pro Domain.
const CADDY_DATA_DIR = process.env.CADDY_DATA_DIR || '/caddy-data';
const CUSTOM_CERTS_DIR = path.join(__dirname, 'custom-certs');
if (!fs.existsSync(CUSTOM_CERTS_DIR)) fs.mkdirSync(CUSTOM_CERTS_DIR, { recursive: true });

if (!process.env.SESSION_SECRET) {
    console.warn('WARNUNG: SESSION_SECRET ist nicht gesetzt - bitte in .env eintragen (z.B. openssl rand -hex 32).');
}

app.use(express.json({ limit: '2mb' }));
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

const db = new sqlite3.Database(path.join(dataDir, 'auraproxy.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
});

db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL`);

    // Fester Admin-Zugang (Benutzername "admin"), plus optional weitere Personen über
    // AuraDirect - gleiches Muster wie bei AuraDirect selbst, da AuraProxy reine
    // Infrastruktur ist (meist nur 1-2 Personen verwalten das).
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT,
        firstname TEXT NOT NULL DEFAULT '',
        lastname TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'local',
        active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS domain_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        externalPort INTEGER NOT NULL DEFAULT 443,
        targetHost TEXT NOT NULL,
        targetPort INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(domain, externalPort)
    )`);
    db.run(`ALTER TABLE domain_mappings ADD COLUMN hasCustomCert INTEGER NOT NULL DEFAULT 0`, () => {});
    // Zertifikatsmodus: 'auto' = Let's Encrypt (öffentliche Domain), 'internal' = eigene Zertifizierungsstelle von AuraProxy (interne Namen)
    db.run(`ALTER TABLE domain_mappings ADD COLUMN tlsMode TEXT NOT NULL DEFAULT 'auto'`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS connected_products (product TEXT PRIMARY KEY, lastSeenAt TEXT NOT NULL)`);

    db.get(`SELECT id FROM users WHERE username = 'admin'`, [], async (err, row) => {
        if (!err && !row) {
            const hash = await bcrypt.hash('admin', 10);
            db.run(`INSERT INTO users (username, passwordHash, firstname, lastname) VALUES ('admin', ?, 'Admin', '')`, [hash], () => {
                console.log('Standard-Admin-Konto erstellt (admin / admin) - bitte Passwort nach dem ersten Login ändern.');
            });
        }
    });
});

function getSetting(key) {
    return new Promise((resolve) => db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => resolve(row ? row.value : null)));
}
function setSetting(key, value) {
    return new Promise((resolve, reject) => db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value], (err) => err ? reject(err) : resolve()
    ));
}

// --- Aura-Suite: "Über Aura-Suite" (Dialog in der Oberfläche, Datei about.js) ---
// Programmversion aus package.json; die Version der Aura-Suite setzt, wer sie betreibt (Umgebungswert AURA_SUITE_VERSION, z. B. in der .env). Nur für angemeldete Personen.
const { createSuitePing, versionOlder } = require('./suite-ping');   // anonymer Check-in beim Lizenzserver (siehe suite-ping.js)
const AURA_APP_NAME = 'AuraProxy';
const AURA_APP_VERSION = String(require('./package.json').version);
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
app.get('/api/version', requireAuth, (req, res) => { const suite = suitePing.suite(); res.set('Cache-Control', 'no-store').json({ product: AURA_APP_NAME, installed: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite, updateAvailable: !!(suite && AURA_SUITE_INSTALLED && versionOlder(AURA_SUITE_INSTALLED, suite.version)) }); });

// Anonymer Check-in beim Lizenzserver (nicht abschaltbar): Produkt, Version, Zustand, Zahl der Konten, zufällige Installations-Kennung. Keine Namen, keine Inhalte.
// Aus der Antwort kommt die Aura-Suite-Version, die im Lizenzserver eingetragen ist: sie erscheint unter "Über Aura-Suite" (siehe /api/version).
const suitePing = createSuitePing({
    product: 'proxy', version: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, dataDir, host: process.env.LICENSE_CHECKIN_HOST,
    getState: async () => 'free',   // AuraProxy ist kostenlos
    getCounts: () => new Promise((resolve) => db.get(`SELECT COUNT(*) AS c FROM users WHERE active = 1`, [], (err, row) => resolve(err || !row ? null : { totalUsers: row.c, totalAdmins: null }))),
    getLicenseKey: () => getSetting('license_key')
});

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ error: 'Nicht angemeldet.' });
}

// --- Datenschutzerklärung mit Bestätigung beim ersten Login (gemeinsames Modul der Aura-Suite) ---
const auraPrivacy = require('./aura-privacy-server');
const DEFAULT_PRIVACY_POLICY = "# Datenschutzerklärung\n\nDiese Anwendung (AuraProxy) leitet Verbindungen zu den Anwendungen des Betreibers weiter und verwaltet dafür folgende Daten:\n\n- Benutzername und Name der Personen, die AuraProxy verwalten (das Passwort nur als Prüfwert, bei Zwei-Faktor-Anmeldung zusätzlich das Geheimnis der Authenticator-App)\n- Zuordnungen von Domains zu Zielen sowie Zertifikate, bei eigenen Zertifikaten auch den zugehörigen privaten Schlüssel\n- Die Zertifizierungsstelle für interne Namen mit ihrem privaten Schlüssel\n- Beim automatischen Zertifikat von Let's Encrypt werden die Domainnamen an Let's Encrypt übermittelt\n- In den technischen Protokollen des Weiterleitungsdienstes können IP-Adressen der Besucherinnen und Besucher erscheinen\n\nDiese Daten werden ausschliesslich auf dem Server des Betreibers gespeichert und, abgesehen von der genannten Übermittlung an Let's Encrypt, nicht an Dritte weitergegeben. Auskunft, Berichtigung und Löschung erhaltet ihr bei den Administrator:innen." + '\n\n' + auraPrivacy.CHECKIN_NOTICE;
auraPrivacy.register(app, { db, requireAuth, requireAdmin: requireAuth, getUserId: (req) => (req.session && req.session.userId) || null, defaultText: DEFAULT_PRIVACY_POLICY });

// --- KOSTENLOS ---
// AuraProxy ist KOSTENLOS: es wird für die zentrale Benutzerverwaltung (zusammen mit AuraDirect) gebraucht. Keine Testphase, keine Lizenz, keine Sperre.
// (In der kostenlosen 1-Benutzer-Version der anderen Produkte muss es nicht eingerichtet werden: dort genügt der Administrator.)
function recordProductConnection(product) {
    if (!['aurachat', 'auraplan', 'auradirect', 'auramail', 'auraticket'].includes(product)) return;
    db.run(`INSERT INTO connected_products (product, lastSeenAt) VALUES (?, ?) ON CONFLICT(product) DO UPDATE SET lastSeenAt = excluded.lastSeenAt`, [product, new Date().toISOString()], () => {});
}
async function getStoredLicenseInfo() {
    return { valid: true, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: true, freeTierReason: 'always-free', free: true, customer: null, expiresAt: null, error: null };
}

function getConfig(key) { return getSetting(key); }
function setConfig(key, value) { return setSetting(key, value); }
function toSessionUser(row) { return { id: row.id, username: row.username, firstname: row.firstname, lastname: row.lastname }; }
function generateTwofaSecret() { return authenticator.generateSecret(); }

// Vor der lokalen Anmeldung: bei AuraDirect nachfragen (gleiches Muster wie bei AuraMail/
// AuraTicket), damit ein einziges AuraDirect-Konto auch hier funktioniert.
async function tryAuraDirectLogin(username, password, twofaCode) {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    if (!url) return { configured: false };
    // Liefert immer ein Objekt zurück: bei Erfolg die Antwort von AuraDirect (valid, role,
    // requires2fa, ...), bei technischen Problemen "problem" mit einer verständlichen
    // Erklärung - damit die Anmeldeseite sagen kann, woran es hakt, statt nur "falsches
    // Passwort" (früher ging der Grund hier komplett verloren).
    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey || '' },
            body: JSON.stringify({ username, password, product: 'auraproxy', twofaCode }),
            signal: AbortSignal.timeout(6000)
        });
        if (resp.status === 401) return { configured: true, problem: 'Der Dienst-Schlüssel für AuraDirect wird dort nicht akzeptiert (Einstellungen → AuraDirect prüfen).' };
        if (resp.status === 402) return { configured: true, problem: 'AuraDirect meldet, dass es nicht lizenziert ist.' };
        if (!resp.ok) return { configured: true, problem: `AuraDirect antwortete mit Status ${resp.status}.` };
        const data = await resp.json().catch(() => ({}));
        return { configured: true, ...data };
    } catch (err) {
        return { configured: true, problem: `AuraDirect ist nicht erreichbar (${err.message}).` };
    }
}
function provisionFromAuraDirect(username, adResult) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, existing) => {
            if (err) return reject(err);
            if (existing) {
                db.run(`UPDATE users SET firstname = ?, lastname = ? WHERE id = ?`,
                    [adResult.firstname || existing.firstname, adResult.lastname || existing.lastname, existing.id],
                    (e) => e ? reject(e) : db.get(`SELECT * FROM users WHERE id = ?`, [existing.id], (e2, row) => e2 ? reject(e2) : resolve(row)));
            } else {
                const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
                db.run(`INSERT INTO users (username, passwordHash, firstname, lastname, source) VALUES (?, ?, ?, ?, 'auradirect')`,
                    [username, hash, adResult.firstname || '', adResult.lastname || ''],
                    function (e) { e ? reject(e) : db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e2, row) => e2 ? reject(e2) : resolve(row)); });
            }
        });
    });
}

app.post('/api/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich.' });

    // Das feste lokale Konto "admin" bleibt bewusst IMMER rein lokal (Notzugang) - so geht die
    // Anmeldung auch dann sofort, wenn AuraDirect gerade nicht erreichbar ist oder noch gar
    // nicht eingerichtet wurde.
    const adResp = username.trim() === 'admin' ? { configured: false } : await tryAuraDirectLogin(username, password);
    if (adResp.requires2fa) {
        req.session.pendingAuraDirectUsername = username;
        req.session.pendingAuraDirectPassword = password;
        return res.json({ requires2fa: true, viaAuraDirect: true });
    }
    if (adResp.valid) {
        try {
            const row = await provisionFromAuraDirect(username, adResp);
            req.session.userId = row.id;
            req.session.user = toSessionUser(row);
            return res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname });
        } catch (e) { return res.status(500).json({ error: 'Fehler beim Übernehmen der AuraDirect-Anmeldung: ' + e.message }); }
    }

    // Verständliche Rückmeldung, falls AuraDirect geantwortet hat, die Person aber trotzdem
    // nicht hereinkommt (nur wenn es kein lokales Konto mit diesem Namen gibt).
    const adHint = () => {
        if (adResp.problem) return ` Hinweis zu AuraDirect: ${adResp.problem}`;
        if (adResp.error === 'Kein Zugriff auf dieses Produkt.') return null;
        if (adResp.error) return ` Hinweis von AuraDirect: ${adResp.error}`;
        return '';
    };

    db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username.trim()], async (err, row) => {
        if (err || !row) {
            if (adResp.error === 'Kein Zugriff auf dieses Produkt.') {
                return res.status(401).json({ error: 'Die Anmeldung bei AuraDirect war erfolgreich, aber dieses Konto ist nicht für AuraProxy freigeschaltet. In AuraDirect → Benutzer → bei der Person das Häkchen "AuraProxy" setzen.' });
            }
            return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' + (adHint() || '') });
        }
        if (row.source === 'auradirect') return res.status(401).json({ error: 'Diese Person wird über AuraDirect verwaltet.' + (adResp.error === 'Kein Zugriff auf dieses Produkt.' ? ' Der Zugriff auf AuraProxy wurde dort entzogen oder fehlt.' : (adHint() || ' AuraDirect hat die Anmeldung abgelehnt (Passwort/Zugriff prüfen).')) });
        const ok = await bcrypt.compare(password, row.passwordHash).catch(() => false);
        if (!ok) return res.status(401).json({ error: 'Ungültiger Benutzername oder falsches Passwort.' });

        if (row.twofa_enabled) {
            if (!row.twofa_secret) {
                const secret = generateTwofaSecret();
                db.run(`UPDATE users SET twofa_secret = ? WHERE id = ?`, [secret, row.id]);
                req.session.pendingUserId = row.id;
                const otpauthUrl = authenticator.keyuri(row.username, 'AuraProxy', secret);
                const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
                return res.json({ requires2faSetup: true, qrCodeDataUrl });
            }
            req.session.pendingUserId = row.id;
            return res.json({ requires2fa: true });
        }
        req.session.userId = row.id;
        req.session.user = toSessionUser(row);
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname });
    });
});
app.post('/api/login/2fa-auradirect', authLimiter, async (req, res) => {
    if (!req.session.pendingAuraDirectUsername) return res.status(400).json({ error: 'Kein Login ausstehend.' });
    const { pendingAuraDirectUsername: username, pendingAuraDirectPassword: password } = req.session;
    const adResp = await tryAuraDirectLogin(username, password, req.body.code);
    delete req.session.pendingAuraDirectUsername;
    delete req.session.pendingAuraDirectPassword;
    if (adResp.error === 'Kein Zugriff auf dieses Produkt.') return res.status(401).json({ error: 'Anmeldung bei AuraDirect erfolgreich, aber dieses Konto ist nicht für AuraProxy freigeschaltet (AuraDirect → Benutzer → Häkchen "AuraProxy").' });
    if (adResp.problem) return res.status(401).json({ error: adResp.problem });
    if (!adResp.valid) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
    try {
        const row = await provisionFromAuraDirect(username, adResp);
        req.session.userId = row.id;
        req.session.user = toSessionUser(row);
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname });
    } catch (e) { res.status(500).json({ error: 'Fehler: ' + e.message }); }
});
app.post('/api/login/2fa-setup', authLimiter, async (req, res) => {
    if (!req.session.pendingUserId) return res.status(400).json({ error: 'Kein Login ausstehend.' });
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.pendingUserId], (err, row) => {
        if (err || !row) return res.status(400).json({ error: 'Fehler.' });
        const ok = authenticator.verify({ token: String(req.body.code || '').trim(), secret: row.twofa_secret });
        if (!ok) return res.status(401).json({ error: 'Code ist falsch.' });
        db.run(`UPDATE users SET twofa_enabled = 1 WHERE id = ?`, [row.id], () => {
            delete req.session.pendingUserId;
            req.session.userId = row.id;
            req.session.user = toSessionUser(row);
            res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname });
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
        req.session.userId = row.id;
        req.session.user = toSessionUser(row);
        res.json({ success: true, userId: row.id, username: row.username, firstname: row.firstname });
    });
});
app.get('/api/logout', (req, res) => req.session.destroy(() => res.json({ success: true })));
app.get('/api/me', requireAuth, (req, res) => res.json(req.session.user));

app.get('/api/license', requireAuth, async (req, res) => res.json(await getStoredLicenseInfo()));
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

// --- AuraDirect-Anbindung ---
app.get('/api/admin/auradirect-config', requireAuth, async (req, res) => {
    res.json({ url: await getConfig('auradirect_url') || '', hasServiceKey: !!(await getConfig('auradirect_service_key')) });
});
// Prüft, ob Adresse + Dienst-Schlüssel bei AuraDirect tatsächlich funktionieren - ohne dass
// dafür erst jemand versuchen muss, sich anzumelden.
app.post('/api/admin/auradirect-config/test', requireAuth, async (req, res) => {
    const url = await getConfig('auradirect_url');
    const serviceKey = await getConfig('auradirect_service_key');
    if (!url) return res.status(400).json({ error: 'Noch keine AuraDirect-Adresse gespeichert.' });
    if (!serviceKey) return res.status(400).json({ error: 'Noch kein Dienst-Schlüssel gespeichert.' });
    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/service/users`, { headers: { 'X-Service-Key': serviceKey }, signal: AbortSignal.timeout(6000) });
        if (resp.status === 401) return res.status(400).json({ error: 'AuraDirect erreicht, aber der Dienst-Schlüssel wird abgelehnt - bitte in AuraDirect → Benutzer neu kopieren.' });
        if (!resp.ok) return res.status(502).json({ error: `AuraDirect antwortete mit Status ${resp.status}.` });
        const people = await resp.json();
        res.json({ success: true, message: `Verbindung in Ordnung - ${Array.isArray(people) ? people.length : '?'} aktive Person(en) in AuraDirect. Wer sich hier anmelden soll, braucht dort bei sich das Häkchen "AuraProxy".` });
    } catch (err) {
        res.status(502).json({ error: 'AuraDirect ist nicht erreichbar: ' + err.message });
    }
});

// Öffentlich (ohne Anmeldung): nur der Hinweis, ob die Anmeldung über AuraDirect eingerichtet ist.
app.get('/api/public/info', async (req, res) => {
    res.json({ auradirectEnabled: !!(await getConfig('auradirect_url')) });
});

app.post('/api/admin/auradirect-config', requireAuth, async (req, res) => {
    const url = (req.body.url || '').trim();
    const serviceKey = (req.body.serviceKey || '').trim();
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Die Adresse sollte mit http:// oder https:// beginnen.' });
    if (serviceKey && /^https?:\/\//i.test(serviceKey)) return res.status(400).json({ error: 'Das sieht nach einer Adresse aus, nicht nach einem Dienst-Schlüssel.' });
    await setConfig('auradirect_url', url);
    if (serviceKey) await setConfig('auradirect_service_key', serviceKey);
    res.json({ success: true });
});

// --- Kernstück: Caddy-Konfiguration erzeugen und anwenden ---
// Pro extern genutztem Port ein eigener Caddy-"Server"-Block (eigener "listen"), damit jeder
// Port nur die für ihn bestimmten Domain-Weiterleitungen bekommt. Port 80 läuft IMMER mit,
// unabhängig von Zuordnungen - wird für die Let's-Encrypt-Validierung gebraucht und leitet
// ansonsten automatisch auf https weiter (Caddys Standardverhalten).
// --- Prüfungen und Zertifikatsmodus ---
const TLS_MODES = ['auto', 'internal'];
const INTERNAL_TLDS = new Set(['local', 'lan', 'internal', 'intranet', 'home', 'corp', 'localdomain', 'localhost', 'test', 'invalid', 'example']);
const HOSTNAME_RX = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
function validDomain(d) {
    if (typeof d !== 'string' || d.length < 1 || d.length > 253) return false;
    if (net.isIPv4(d)) return true;
    return HOSTNAME_RX.test(d) && !/^\d+$/.test(d.split('.').pop());   // keine Namen mit rein numerischer Endung (z. B. 999.1.1.1)
}   // klein geschrieben; verhindert u. a. "../" in Dateinamen
function validTargetHost(h) { return typeof h === 'string' && h.length >= 1 && h.length <= 253 && (net.isIP(h) > 0 || /^[A-Za-z0-9]([A-Za-z0-9._-]{0,251}[A-Za-z0-9])?$/.test(h)); }
function validPort(n) { return Number.isInteger(n) && n >= 1 && n <= 65535; }
// Namen, für die Let's Encrypt kein Zertifikat ausstellen kann (nicht öffentlich auflösbar): IP-Adressen, Namen ohne Punkt, interne Endungen
function looksInternalName(d) {
    if (net.isIP(d)) return true;
    if (!d.includes('.')) return true;
    return INTERNAL_TLDS.has(d.split('.').pop()) || d.endsWith('.home.arpa') || d.endsWith('.fritz.box');
}
function defaultTlsMode(d) { return looksInternalName(d) ? 'internal' : 'auto'; }
function dialAddress(host, port) { return `${net.isIPv6(host) ? '[' + host + ']' : host}:${port}`; }
function customCertPaths(domain) {
    if (!validDomain(domain)) throw new Error('Ungültige Domain: ' + String(domain).slice(0, 60));   // Schutz vor Pfaden wie "../x" im Dateinamen
    return { cert: path.join(CUSTOM_CERTS_DIR, `${domain}.crt`), key: path.join(CUSTOM_CERTS_DIR, `${domain}.key`) };
}
async function buildCaddyConfig() {
    const allMappings = await new Promise((resolve) => db.all(`SELECT * FROM domain_mappings WHERE active = 1`, [], (err, rows) => resolve(rows || [])));
    // Ein einzelner ungültiger Alt-Eintrag darf nicht dazu führen, dass Caddy die GESAMTE Konfiguration ablehnt: ungültige Zuordnungen werden übersprungen
    const mappings = allMappings.filter(m => validDomain(m.domain) && validTargetHost(m.targetHost) && validPort(m.targetPort) && validPort(m.externalPort));
    if (mappings.length !== allMappings.length) console.warn(`[AuraProxy] ${allMappings.length - mappings.length} Zuordnung(en) mit ungültigem Namen, Ziel oder Port wurden übersprungen - bitte in der Oberfläche korrigieren.`);
    const servers = {
        port_80: { listen: [':80'], routes: [] } // bleibt für ACME-Validierung offen, auch ohne eigene Zuordnung
    };
    const usedPorts = new Set([80]);
    mappings.forEach(m => usedPorts.add(m.externalPort));
    usedPorts.forEach(port => {
        if (!servers[`port_${port}`]) servers[`port_${port}`] = { listen: [`:${port}`], routes: [] };
    });

    // Eigene, hochgeladene Zertifikate: über "load_files" bekannt machen und der jeweiligen
    // Domain per SNI-Regel zuweisen - Caddy versucht für DIESE Domains dann kein eigenes
    // Let's-Encrypt-Zertifikat mehr zu holen.
    const customCertDomains = mappings.filter(m => m.hasCustomCert && validDomain(m.domain));
    const loadFiles = customCertDomains.map(m => ({ certificate: customCertPaths(m.domain).cert, key: customCertPaths(m.domain).key, tags: [`custom-${m.domain}`] }));

    mappings.forEach(m => {
        const server = servers[`port_${m.externalPort}`];
        server.routes.push({
            match: [{ host: [m.domain] }],
            handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: dialAddress(m.targetHost, m.targetPort) }] }]
        });
        if (m.hasCustomCert && validDomain(m.domain)) {
            if (!server.tls_connection_policies) server.tls_connection_policies = [];
            server.tls_connection_policies.push({
                match: { sni: [m.domain] },
                certificate_selection: { any_tag: [`custom-${m.domain}`] }
            });
        }
    });

    const config = { admin: { listen: '0.0.0.0:2019', origins: ['http://auraproxy-admin'] }, apps: { http: { servers } } };
    // Interne Namen: Zertifikate stellt die eigene Zertifizierungsstelle von Caddy aus (Modul "internal"); alle anderen holen sich Let's Encrypt
    const internalDomains = [...new Set(mappings.filter(m => !(m.hasCustomCert && validDomain(m.domain)) && m.tlsMode === 'internal').map(m => m.domain))];
    const tls = {};
    if (loadFiles.length > 0) tls.certificates = { load_files: loadFiles };
    if (internalDomains.length > 0) tls.automation = { policies: [{ subjects: internalDomains, issuers: [{ module: 'internal' }] }] };
    if (Object.keys(tls).length > 0) config.apps.tls = tls;
    return config;
}
async function pushCaddyConfig() {
    const config = await buildCaddyConfig();
    const resp = await fetch(`${CADDY_ADMIN_URL}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Origin': 'http://auraproxy-admin' },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(8000)
    });
    if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Caddy hat die neue Konfiguration abgelehnt (Status ${resp.status}): ${body}`);
    }
}
// Beim Start einmal die gespeicherten Zuordnungen anwenden - falls der Caddy-Container
// zwischenzeitlich neu gestartet wurde und seine (nur im Arbeitsspeicher gehaltene)
// Konfiguration verloren hat.
setTimeout(() => { pushCaddyConfig().catch(err => console.error('[AuraProxy] Caddy-Start-Konfiguration fehlgeschlagen:', err.message)); }, 3000);

app.get('/api/domains', requireAuth, (req, res) => {
    db.all(`SELECT * FROM domain_mappings ORDER BY domain`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.get('/api/domains/available-ports', requireAuth, (req, res) => res.json({ ports: [443, ...EXTRA_PORTS] }));

app.post('/api/domains', requireAuth, async (req, res) => {
    const { domain, externalPort, targetHost, targetPort, tlsMode } = req.body || {};
    if (!domain || !targetHost || !targetPort) return res.status(400).json({ error: 'Domain, Ziel-Adresse und Ziel-Port sind erforderlich.' });
    const dom = String(domain).trim().toLowerCase(), tHost = String(targetHost).trim(), tPort = parseInt(targetPort, 10);
    if (!validDomain(dom)) return res.status(400).json({ error: 'Ungültige Domain. Erlaubt sind Namen wie aurachat.firma.ch, ein einzelner Name wie aurachat oder eine IPv4-Adresse (nur Kleinbuchstaben, Ziffern, Bindestrich und Punkt).' });
    if (!validTargetHost(tHost)) return res.status(400).json({ error: 'Ungültige Ziel-Adresse (Name oder IP-Adresse, ohne Leerzeichen und ohne http://).' });
    if (!validPort(tPort)) return res.status(400).json({ error: 'Ungültiger Ziel-Port (1 bis 65535).' });
    const mode = (tlsMode === undefined || tlsMode === null || tlsMode === '') ? defaultTlsMode(dom) : tlsMode;
    if (!TLS_MODES.includes(mode)) return res.status(400).json({ error: 'Ungültiger Zertifikatsmodus (auto oder internal).' });
    const port = parseInt(externalPort, 10) || 443;
    if (port !== 443 && !EXTRA_PORTS.includes(port)) return res.status(400).json({ error: `Port ${port} ist nicht vorbereitet. Verfügbar: 443, ${EXTRA_PORTS.join(', ')} (siehe docker-compose.yml, um weitere Ports vorzubereiten).` });
    db.run(
        `INSERT INTO domain_mappings (domain, externalPort, targetHost, targetPort, tlsMode) VALUES (?, ?, ?, ?, ?)`,
        [dom, port, tHost, tPort, mode],
        async function (err) {
            if (err) return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Diese Domain+Port-Kombination existiert bereits.' : err.message });
            const warning = (mode === 'auto' && looksInternalName(dom)) ? 'Dieser Name ist nicht öffentlich erreichbar: Let\'s Encrypt kann dafür kein Zertifikat ausstellen. Wähle "Intern (eigene Zertifizierungsstelle)".' : undefined;
            try { await pushCaddyConfig(); res.json({ success: true, id: this.lastID, tlsMode: mode, warning }); }
            catch (cErr) { res.status(502).json({ error: 'In der Datenbank gespeichert, aber Caddy konnte nicht aktualisiert werden: ' + cErr.message }); }
        }
    );
});
app.put('/api/domains/:id', requireAuth, (req, res) => {
    const { active, domain, externalPort, targetHost, targetPort, tlsMode } = req.body || {};
    db.get(`SELECT * FROM domain_mappings WHERE id = ?`, [req.params.id], (gErr, row) => {
        if (gErr || !row) return res.status(404).json({ error: 'Zuordnung nicht gefunden.' });
        const updates = [], params = [];
        if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
        if (domain !== undefined) {
            const dom = String(domain).trim().toLowerCase();
            if (!validDomain(dom)) return res.status(400).json({ error: 'Ungültige Domain (nur Kleinbuchstaben, Ziffern, Bindestrich und Punkt).' });
            if (dom !== row.domain && row.hasCustomCert) return res.status(400).json({ error: 'Diese Zuordnung hat ein eigenes Zertifikat für den bisherigen Namen. Bitte zuerst das eigene Zertifikat entfernen, dann den Namen ändern.' });
            updates.push('domain = ?'); params.push(dom);
        }
        if (externalPort !== undefined) {
            const port = parseInt(externalPort, 10);
            if (port !== 443 && !EXTRA_PORTS.includes(port)) return res.status(400).json({ error: `Port ${port} ist nicht vorbereitet. Verfügbar: 443, ${EXTRA_PORTS.join(', ')}.` });
            updates.push('externalPort = ?'); params.push(port);
        }
        if (targetHost !== undefined) { const h = String(targetHost).trim(); if (!validTargetHost(h)) return res.status(400).json({ error: 'Ungültige Ziel-Adresse.' }); updates.push('targetHost = ?'); params.push(h); }
        if (targetPort !== undefined) { const n = parseInt(targetPort, 10); if (!validPort(n)) return res.status(400).json({ error: 'Ungültiger Ziel-Port (1 bis 65535).' }); updates.push('targetPort = ?'); params.push(n); }
        if (tlsMode !== undefined) { if (!TLS_MODES.includes(tlsMode)) return res.status(400).json({ error: 'Ungültiger Zertifikatsmodus (auto oder internal).' }); updates.push('tlsMode = ?'); params.push(tlsMode); }
        if (updates.length === 0) return res.json({ success: true });
        params.push(req.params.id);
        db.run(`UPDATE domain_mappings SET ${updates.join(', ')} WHERE id = ?`, params, async (err) => {
            if (err) return res.status(400).json({ error: err.message.includes('UNIQUE') ? 'Diese Domain+Port-Kombination existiert bereits.' : err.message });
            const finalDomain = domain !== undefined ? String(domain).trim().toLowerCase() : row.domain, finalMode = tlsMode !== undefined ? tlsMode : row.tlsMode;
            const warning = (finalMode === 'auto' && looksInternalName(finalDomain)) ? 'Dieser Name ist nicht öffentlich erreichbar: Let\'s Encrypt kann dafür kein Zertifikat ausstellen. Wähle "Intern (eigene Zertifizierungsstelle)".' : undefined;
            try { await pushCaddyConfig(); res.json({ success: true, warning }); }
            catch (cErr) { res.status(502).json({ error: 'Gespeichert, aber Caddy konnte nicht aktualisiert werden: ' + cErr.message }); }
        });
    });
});
app.delete('/api/domains/:id', requireAuth, (req, res) => {
    db.run(`DELETE FROM domain_mappings WHERE id = ?`, [req.params.id], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        try { await pushCaddyConfig(); res.json({ success: true }); }
        catch (cErr) { res.status(502).json({ error: 'Gelöscht, aber Caddy konnte nicht aktualisiert werden: ' + cErr.message }); }
    });
});
app.get('/api/domains/caddy-status', requireAuth, async (req, res) => {
    try {
        const resp = await fetch(`${CADDY_ADMIN_URL}/config/`, { headers: { 'Origin': 'http://auraproxy-admin' }, signal: AbortSignal.timeout(5000) });
        res.json({ reachable: resp.ok });
    } catch { res.json({ reachable: false }); }
});

// --- Zertifikate: anzeigen, löschen, eigene hochladen ---
// Caddy legt automatisch ausgestellte Zertifikate unter /data/caddy/certificates/<anbieter>/
// <domain>/<domain>.crt ab - direkt im Dateisystem gelesen (gleiche Datenablage wie Caddy
// selbst), da Caddys Admin-API dafür keinen eigenen Lese-Endpunkt anbietet.
function findAutomaticCerts() {
    const certsRoot = path.join(CADDY_DATA_DIR, 'caddy', 'certificates');
    const results = [];
    if (!fs.existsSync(certsRoot)) return results;
    for (const issuer of fs.readdirSync(certsRoot)) {
        const issuerPath = path.join(certsRoot, issuer);
        if (!fs.statSync(issuerPath).isDirectory()) continue;
        for (const domain of fs.readdirSync(issuerPath)) {
            const crtPath = path.join(issuerPath, domain, `${domain}.crt`);
            if (fs.existsSync(crtPath)) results.push({ domain, issuer, crtPath });
        }
    }
    return results;
}
function readCertExpiry(crtPath) {
    try {
        const pem = fs.readFileSync(crtPath, 'utf-8');
        const cert = new crypto.X509Certificate(pem);
        return cert.validTo; // menschenlesbares Datum, von Node direkt aus dem Zertifikat gelesen
    } catch {
        return null;
    }
}
// --- Eigene Zertifizierungsstelle (CA) für interne Namen ---
// Caddy legt sie beim ersten internen Zertifikat selbst an (…/pki/authorities/local/root.crt). Geräte müssen NUR dieses Root-Zertifikat einmal als vertrauenswürdig
// installieren; danach sind alle internen Namen gültig (https ohne Warnung, Mikrofon und Kamera im Browser gehen). Das Root-Zertifikat ist öffentlich, der private Schlüssel bleibt im Datenordner.
function caDir() { return path.join(CADDY_DATA_DIR, 'caddy', 'pki', 'authorities', 'local'); }
function caRootPath() { return path.join(caDir(), 'root.crt'); }
const CA_FILES = ['root.crt', 'root.key', 'intermediate.crt', 'intermediate.key'];
const CUSTOM_CERT_FILE_RX = /^[a-z0-9.-]+\.(crt|key)$/;
function readCa() {
    try {
        const pem = fs.readFileSync(caRootPath(), 'utf8'); const c = new crypto.X509Certificate(pem);
        return { pem, der: c.raw, subject: String(c.subject).replace(/\n/g, ', '), validFrom: c.validFrom, validTo: c.validTo, fingerprint256: c.fingerprint256, serialNumber: c.serialNumber };
    } catch { return null; }
}
app.get('/api/ca', requireAuth, (req, res) => {
    const ca = readCa();
    if (!ca) return res.json({ available: false });
    const { pem, der, ...info } = ca;
    res.json({ available: true, ...info });
});
function sendCa(res, body, name) {
    res.set({ 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.send(body);
}
app.get('/ca.crt', (req, res) => { const ca = readCa(); if (!ca) return res.status(404).type('text/plain').send('Noch keine eigene Zertifizierungsstelle vorhanden: Sie entsteht, sobald das erste interne Zertifikat ausgestellt wurde.'); sendCa(res, ca.pem, 'AuraProxy-CA.crt'); });   // PEM (Linux, macOS, iPhone, Android)
app.get('/ca.cer', (req, res) => { const ca = readCa(); if (!ca) return res.status(404).type('text/plain').send('Noch keine eigene Zertifizierungsstelle vorhanden.'); sendCa(res, ca.der, 'AuraProxy-CA.cer'); });                                                                                                                       // DER (Windows)
app.get('/api/certificates', requireAuth, async (req, res) => {
    const mappings = await new Promise((resolve) => db.all(`SELECT domain, hasCustomCert FROM domain_mappings`, [], (err, rows) => resolve(rows || [])));
    const customByDomain = new Map(mappings.filter(m => m.hasCustomCert).map(m => [m.domain, true]));
    const automatic = findAutomaticCerts()
        .filter(c => !customByDomain.has(c.domain)) // eigene Zertifikate haben Vorrang in der Anzeige
        .map(c => c.issuer === 'local'
            ? { domain: c.domain, type: 'internal', issuer: 'Interne Zertifizierungsstelle (AuraProxy)', expiresAt: readCertExpiry(c.crtPath) }
            : { domain: c.domain, type: 'automatic', issuer: c.issuer.includes('staging') ? 'Let\'s Encrypt (Test/Staging)' : 'Let\'s Encrypt', expiresAt: readCertExpiry(c.crtPath) });
    const custom = mappings.filter(m => m.hasCustomCert).map(m => {
        const { cert } = customCertPaths(m.domain);
        return { domain: m.domain, type: 'custom', issuer: 'Eigenes Zertifikat', expiresAt: fs.existsSync(cert) ? readCertExpiry(cert) : null };
    });
    res.json([...custom, ...automatic]);
});
app.delete('/api/certificates/:domain', requireAuth, (req, res) => {
    // Löscht nur die Dateien - Caddy stellt bei Bedarf automatisch ein neues aus, sobald die
    // Domain wieder angefragt wird. Kein "Widerruf" bei der Zertifizierungsstelle selbst.
    const certs = findAutomaticCerts().filter(c => c.domain === req.params.domain);
    if (certs.length === 0) return res.status(404).json({ error: 'Kein automatisch ausgestelltes Zertifikat für diese Domain gefunden.' });
    try {
        certs.forEach(c => fs.rmSync(path.dirname(c.crtPath), { recursive: true, force: true }));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Löschen fehlgeschlagen: ' + err.message });
    }
});
app.post('/api/domains/:id/certificate', requireAuth, upload.fields([{ name: 'cert', maxCount: 1 }, { name: 'key', maxCount: 1 }]), async (req, res) => {
    if (!req.files || !req.files.cert || !req.files.key) return res.status(400).json({ error: 'Bitte sowohl Zertifikat- als auch Schlüssel-Datei auswählen.' });
    db.get(`SELECT * FROM domain_mappings WHERE id = ?`, [req.params.id], async (err, mapping) => {
        if (err || !mapping) return res.status(404).json({ error: 'Zuordnung nicht gefunden.' });
        try {
            new crypto.X509Certificate(req.files.cert[0].buffer); // prüft nur, ob es sich überhaupt um ein gültiges Zertifikat handelt
        } catch {
            return res.status(400).json({ error: 'Das ist keine gültige Zertifikatsdatei (PEM-Format erwartet).' });
        }
        if (!validDomain(mapping.domain)) return res.status(400).json({ error: 'Der Name dieser Zuordnung ist ungültig (nur Kleinbuchstaben, Ziffern, Bindestrich und Punkt). Bitte zuerst den Namen korrigieren.' });
        const { cert, key } = customCertPaths(mapping.domain);
        fs.writeFileSync(cert, req.files.cert[0].buffer);
        fs.writeFileSync(key, req.files.key[0].buffer);
        db.run(`UPDATE domain_mappings SET hasCustomCert = 1 WHERE id = ?`, [mapping.id], async (uErr) => {
            if (uErr) return res.status(500).json({ error: uErr.message });
            try { await pushCaddyConfig(); res.json({ success: true }); }
            catch (cErr) { res.status(502).json({ error: 'Hochgeladen, aber Caddy konnte nicht aktualisiert werden: ' + cErr.message }); }
        });
    });
});
app.delete('/api/domains/:id/certificate', requireAuth, (req, res) => {
    db.get(`SELECT * FROM domain_mappings WHERE id = ?`, [req.params.id], async (err, mapping) => {
        if (err || !mapping) return res.status(404).json({ error: 'Zuordnung nicht gefunden.' });
        if (validDomain(mapping.domain)) { const { cert, key } = customCertPaths(mapping.domain); [cert, key].forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); }); }   // bei ungültigem Alt-Namen nur das Kennzeichen zurücksetzen, keine Dateien anfassen
        db.run(`UPDATE domain_mappings SET hasCustomCert = 0 WHERE id = ?`, [mapping.id], async (uErr) => {
            if (uErr) return res.status(500).json({ error: uErr.message });
            try { await pushCaddyConfig(); res.json({ success: true, message: 'Eigenes Zertifikat entfernt - Caddy holt bei Bedarf automatisch ein neues über Let\'s Encrypt.' }); }
            catch (cErr) { res.status(502).json({ error: 'Entfernt, aber Caddy konnte nicht aktualisiert werden: ' + cErr.message }); }
        });
    });
});


// --- Backup & Wiederherstellung ---
app.get('/api/admin/backup', requireAuth, (req, res) => {
    const tmpDbPath = path.join(dataDir, `backup-tmp-${Date.now()}.db`);
    db.run(`VACUUM INTO ?`, [tmpDbPath], (err) => {
        if (err) return res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
        try {
            const zip = new AdmZip();
            zip.addLocalFile(tmpDbPath, '', 'auraproxy.db');
            // Eigene Zertifikate und die eigene Zertifizierungsstelle gehören mit ins Backup: Ginge die CA verloren, müssten alle Geräte einer NEUEN CA vertrauen.
            try { for (const f of fs.readdirSync(CUSTOM_CERTS_DIR)) if (CUSTOM_CERT_FILE_RX.test(f)) zip.addLocalFile(path.join(CUSTOM_CERTS_DIR, f), 'custom-certs'); } catch { /* Ordner leer oder nicht vorhanden */ }
            for (const f of CA_FILES) { const cp = path.join(caDir(), f); if (fs.existsSync(cp)) zip.addLocalFile(cp, 'caddy-pki'); }
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="auraproxy-backup-${timestamp}.zip"` });
            res.send(zip.toBuffer());
        } catch (zipErr) {
            res.status(500).json({ error: 'Backup fehlgeschlagen: ' + zipErr.message });
        } finally {
            fs.unlink(tmpDbPath, () => {});
        }
    });
});
app.post('/api/admin/backup/restore', requireAuth, uploadBackup.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    try {
        const zip = new AdmZip(req.file.buffer);
        const dbEntry = zip.getEntry('auraproxy.db');
        if (!dbEntry) return res.status(400).json({ error: 'Diese Datei enthält keine auraproxy.db - ist das wirklich ein AuraProxy-Backup?' });
        fs.writeFileSync(path.join(dataDir, 'auraproxy.db'), dbEntry.getData());
        // Eigene Zertifikate und CA zurückspielen: nur Dateien mit festen, geprüften Namen (kein Pfad aus dem Backup wird verwendet)
        zip.getEntries().forEach((e) => {
            if (e.isDirectory) return;
            let m = /^custom-certs\/([a-z0-9.-]+\.(?:crt|key))$/.exec(e.entryName);
            if (m && CUSTOM_CERT_FILE_RX.test(m[1]) && validDomain(m[1].replace(/\.(crt|key)$/, ''))) { fs.mkdirSync(CUSTOM_CERTS_DIR, { recursive: true }); fs.writeFileSync(path.join(CUSTOM_CERTS_DIR, m[1]), e.getData(), { mode: 0o600 }); return; }
            m = /^caddy-pki\/((?:root|intermediate)\.(?:crt|key))$/.exec(e.entryName);
            if (m && CA_FILES.includes(m[1])) { fs.mkdirSync(caDir(), { recursive: true }); fs.writeFileSync(path.join(caDir(), m[1]), e.getData(), { mode: m[1].endsWith('.key') ? 0o600 : 0o644 }); }
        });
        res.json({ success: true, message: 'Wiederhergestellt. Server startet jetzt neu...' });
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen: ' + err.message });
    }
});

suitePing.start();
app.listen(PORT, () => console.log(`AuraProxy läuft auf Port ${PORT}`));
