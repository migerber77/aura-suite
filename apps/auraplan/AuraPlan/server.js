const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'html')));

const PORT = process.env.PORT || 3002;
const SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET) console.error('WARNUNG: SESSION_SECRET ist nicht gesetzt - bitte in .env eintragen (z.B. openssl rand -hex 32).');
if (!process.env.LICENSE_SECRET) console.error('WARNUNG: LICENSE_SECRET ist nicht gesetzt - Lizenzprüfung kann nicht funktionieren. Muss in .env denselben Wert wie beim Lizenz-Server (LICENSE_SECRET) haben.');

// Datenordner muss vor der Sitzungs-Konfiguration existieren, da Sitzungen dort ebenfalls
// dauerhaft gespeichert werden (übersteht dadurch einen Container-Neustart, anders als die
// vorherige reine Arbeitsspeicher-Variante).
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(session({
    store: new SQLiteStore({ dir: dataDir, db: 'sessions.db' }),
    secret: SESSION_SECRET || 'unsicher-bitte-env-setzen',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 Tage
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Zu viele Versuche. Bitte später erneut versuchen.' } });

// --- Datenbank ---
const db = new sqlite3.Database(path.join(dataDir, 'auraplan.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
    else console.log('Mit AuraPlan-Datenbank verbunden.');
});
db.run('PRAGMA journal_mode = WAL;');

// db.serialize() stellt sicher, dass die Tabellen wirklich existieren, BEVOR geprüft wird,
// ob schon ein Admin-Konto da ist - ohne das können beide "wettlaufen" und das Admin-Konto
// wird nie angelegt (Tabelle scheint dann noch nicht zu existieren).
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'employee',
        vacationDaysPerYear REAL NOT NULL DEFAULT 25,
        color TEXT DEFAULT '#3270FD',
        active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER NOT NULL DEFAULT 0,
        privacy_accepted_version INTEGER NOT NULL DEFAULT 0,
        pensumPercent REAL NOT NULL DEFAULT 100,
        weeklyHours REAL NOT NULL DEFAULT 42,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        clockIn TEXT NOT NULL,
        clockOut TEXT,
        breakMinutes INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        deleted INTEGER NOT NULL DEFAULT 0,
        deletedAt TEXT,
        deletedByUserId INTEGER,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    // Migration für bereits bestehende Installationen ohne die neuen Spalten -
    // schlägt harmlos fehl (und wird ignoriert), falls sie schon existieren.
    db.run(`ALTER TABLE time_entries ADD COLUMN breakMinutes INTEGER NOT NULL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE time_entries ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE time_entries ADD COLUMN deletedAt TEXT`, () => {});
    db.run(`ALTER TABLE time_entries ADD COLUMN deletedByUserId INTEGER`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN twofa_secret TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN twofa_enabled INTEGER NOT NULL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN privacy_accepted_version INTEGER NOT NULL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN pensumPercent REAL NOT NULL DEFAULT 100`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN weeklyHours REAL NOT NULL DEFAULT 42`, () => {});

    // Sperrt Zeiteinträge einer Person für einen Tag oder eine ganze Woche - entweder von
    // der Person selbst ("Tag abschliessen", lockedLevel='employee') oder von Teamleitung/
    // Admin verhängt ("sperren", lockedLevel='teamlead'). periodKey ist das Datum (Tag) bzw.
    // der Montag der betreffenden Woche (Woche).
    db.run(`CREATE TABLE IF NOT EXISTS time_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        scope TEXT NOT NULL,
        periodKey TEXT NOT NULL,
        lockedLevel TEXT NOT NULL,
        lockedByUserId INTEGER NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, scope, periodKey)
    )`);

    // userId ohne NOT NULL: eine offene Schicht (noch niemandem zugewiesen) hat userId = NULL
    db.run(`CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        date TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        role TEXT,
        note TEXT,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS availabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        date TEXT NOT NULL,
        note TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS absences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'vacation',
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        decisionNote TEXT,
        decidedByUserId INTEGER,
        decidedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    db.run(`ALTER TABLE absences ADD COLUMN decisionNote TEXT`, () => {});
    db.run(`ALTER TABLE absences ADD COLUMN decidedByUserId INTEGER`, () => {});
    db.run(`ALTER TABLE absences ADD COLUMN decidedAt TEXT`, () => {});

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

    // Benachrichtigungen für AuraChat (dort abgeholt und von Aura vorgelesen) - z.B. wenn
    // ein Ferienantrag entschieden, eine neue Schicht zugeteilt oder ein eigener Zeiteintrag
    // von jemand anderem bearbeitet wurde. "delivered" wird beim Abholen gesetzt.
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        delivered INTEGER NOT NULL DEFAULT 0
    )`);

    // Zeitarten (z.B. Arbeitszeit, Militär, Krankheit) und Kostenstellen - beide durchs
    // Admin Panel verwaltbar, beide als Dropdown bei der Zeiterfassung wählbar.
    db.run(`CREATE TABLE IF NOT EXISTS activity_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        sortOrder INTEGER NOT NULL DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        active INTEGER NOT NULL DEFAULT 1
    )`);
    db.run(`ALTER TABLE time_entries ADD COLUMN activityTypeId INTEGER`, () => {});
    db.run(`ALTER TABLE time_entries ADD COLUMN costCenterId INTEGER`, () => {});

    // Sinnvolle Schweizer Standard-Zeitarten beim allerersten Start anlegen
    db.get(`SELECT COUNT(*) as c FROM activity_types`, [], (err, row) => {
        if (!err && row && row.c === 0) {
            ['Arbeitszeit', 'Militär', 'Krankheit', 'Unfall', 'Schwangerschaft/Mutterschaft', 'Unbezahlte Absenz', 'Feiertag', 'Andere'].forEach((name, i) => {
                db.run(`INSERT INTO activity_types (name, sortOrder) VALUES (?, ?)`, [name, i]);
            });
        }
    });
    // Nachtrag für bereits bestehende Installationen, die die Liste schon (ohne diese
    // beiden) angelegt hatten - nur einfügen, falls jeweils noch nicht vorhanden.
    ['Unbezahlte Absenz', 'Feiertag'].forEach((name) => {
        db.get(`SELECT id FROM activity_types WHERE name = ?`, [name], (err, row) => {
            if (!err && !row) db.run(`INSERT INTO activity_types (name, sortOrder) VALUES (?, 99)`, [name]);
        });
    });

    // Fest eingerichteter Admin-Zugang beim allerersten Start, analog zu AuraChat selbst
    db.get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`, [], async (err, row) => {
        if (err) return console.error('Fehler bei der Admin-Prüfung:', err);
        if (!row) {
            const hash = await bcrypt.hash('admin', 10);
            db.run(`INSERT INTO users (username, passwordHash, name, role, vacationDaysPerYear) VALUES ('admin', ?, 'Administrator', 'admin', 25)`, [hash], (e) => {
                if (e) console.error('Fehler beim Anlegen des Admin-Kontos:', e);
                else console.log('Standard-Admin-Konto erstellt (admin / admin) - bitte Passwort nach dem ersten Login ändern.');
            });
        }
    });
});

app.use(requireLicense);

// Domains und Zertifikate (https) verwaltet NICHT mehr AuraPlan, sondern zentral der AuraProxy der Aura-Suite (Let's Encrypt für öffentliche Domains,
// eigene Zertifizierungsstelle für interne Namen). AuraPlan spricht nur noch HTTP (Port 3002) und wird vom AuraProxy weitergeleitet.


// --- Hilfsfunktionen ---
// --- Aura-Suite: "Über Aura-Suite" (Dialog in der Oberfläche, Datei about.js) ---
// Programmversion aus package.json; die Version der Aura-Suite setzt, wer sie betreibt (Umgebungswert AURA_SUITE_VERSION, z. B. in der .env). Nur für angemeldete Personen.
const { createSuitePing, versionOlder } = require('./suite-ping');   // anonymer Check-in beim Lizenzserver (siehe suite-ping.js)
const AURA_APP_NAME = 'AuraPlan';
const AURA_APP_VERSION = String(require('./package.json').version);
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
app.get('/api/version', requireAuth, (req, res) => { const suite = suitePing.suite(); res.set('Cache-Control', 'no-store').json({ product: AURA_APP_NAME, installed: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite, updateAvailable: !!(suite && AURA_SUITE_INSTALLED && versionOlder(AURA_SUITE_INSTALLED, suite.version)) }); });

// Anonymer Check-in beim Lizenzserver (nicht abschaltbar): Produkt, Version, Zustand, Zahl der Konten, zufällige Installations-Kennung. Keine Namen, keine Inhalte.
// Aus der Antwort kommt die Aura-Suite-Version, die im Lizenzserver eingetragen ist: sie erscheint unter "Über Aura-Suite" (siehe /api/version).
const suitePing = createSuitePing({
    product: 'plan', version: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, dataDir, host: process.env.LICENSE_CHECKIN_HOST,
    getState: async () => { const i = await getStoredLicenseInfo(); return i.licenseValid ? 'licensed' : i.trial ? 'trial' : i.freeTier ? 'free' : 'expired'; },
    getCounts: () => new Promise((resolve) => db.get(`SELECT COUNT(*) AS c, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS a FROM users WHERE active = 1`, [], (err, row) => resolve(err || !row ? null : { totalUsers: row.c, totalAdmins: row.a || 0 }))),
    getLicenseKey: () => getSetting('license_key')
});

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ error: 'Anmeldung erforderlich.' });
}
function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') return next();
    res.status(403).json({ error: 'Nur für Administratoren.' });
}

// --- LIZENZMANAGEMENT ---
// Gleiches Format/Verfahren wie bei AuraChat: "<base64url(JSON)>.<base64url(HMAC-SHA256)>",
// mit demselben LICENSE_SECRET wie auf dem Lizenz-Server signiert - offline prüfbar, ohne
// bei jedem Start/jeder Anfrage den Lizenz-Server erreichen zu müssen. Anders als bei
// AuraChat gibt es hier keine einzelnen Premium-Features - es zählt nur "eine gültige,
// nicht abgelaufene, für 'auraplan' ausgestellte Lizenz vorhanden?" (oder Testphase aktiv).
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
    if (payload.product !== 'auraplan' && payload.product !== 'suite') return { valid: false, error: 'Diese Lizenz ist nicht für AuraPlan ausgestellt.' };   // 'suite': Suite-Lizenz (Business Solo/Advanced), kommt meist automatisch von AuraControl
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

// Suite-Lizenz automatisch von AuraControl übernehmen (gemeinsamer Baustein, siehe aura-license-sync.js)
const licenseSync = require('./aura-license-sync').startLicenseSync({
    product: 'plan', verify: (k) => verifyLicenseKey(k),
    getKey: () => getSetting('license_key'), setKey: (k) => setSetting('license_key', k),
    getSource: () => getSetting('license_source'), setSource: (v) => setSetting('license_source', v),
    log: (m) => console.log(m)
});

async function getStoredLicenseInfo() {
    const key = await getSetting('license_key');
    let base = { valid: false, customer: null, expiresAt: null, error: 'Keine Lizenz hinterlegt.' };
    if (key) {
        const result = verifyLicenseKey(key);
        base = {
            valid: result.valid,
            customer: (result.payload && result.payload.customer) || null,
            expiresAt: (result.payload && result.payload.expiresAt) || null,
            error: result.valid ? null : result.error,
            plan: (result.valid && result.payload && result.payload.product === 'suite') ? (result.payload.plan || 'suite') : null,
            users: (result.valid && result.payload && result.payload.product === 'suite') ? (result.payload.users || result.payload.maxUsers || null) : null,
            managedBy: (await getSetting('license_source')) === 'control' ? 'auracontrol' : null
        };
    }
    // Reihenfolge: erst die 14 Tage Testphase (alles erlaubt), dann eine gültige Lizenz, sonst die Gratis-Stufe (höchstens 1 aktives Konto: der Admin), sonst gesperrt.
    const trial = await getTrialInfo();
    if (trial.active) return { ...base, valid: true, licenseValid: base.valid, trial: true, trialDaysRemaining: trial.daysRemaining, freeTier: false };
    if (base.valid) return { ...base, licenseValid: true, trial: false, trialDaysRemaining: 0, freeTier: false };
    if (await isWithinFreeTier()) return { ...base, valid: true, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: true, freeTierReason: 'users' };
    return { ...base, licenseValid: false, trial: false, trialDaysRemaining: 0, freeTier: false };
}

// Blockiert die API ohne gültige Lizenz/Testphase (die Seite selbst lädt immer, damit das
// Frontend überhaupt einen Hinweis anzeigen und Admins eine Lizenz eintragen können) - Login
// und die Lizenz-Prüfung/-Eingabe/-Entfernung selbst bleiben bewusst ausgenommen (sonst käme
// niemand mehr rein, um die Sperre wieder aufzuheben).
async function requireLicense(req, res, next) {
    const exempt = ['/api/login', '/api/logout', '/api/me', '/api/license'];
    if (!req.path.startsWith('/api/') || exempt.includes(req.path)) return next();
    const info = await getStoredLicenseInfo();
    if (info.valid) return next();
    res.status(402).json({ error: 'Keine gültige Lizenz für AuraPlan hinterlegt.', licenseRequired: true });
}

function requireTeamLeadOrAdmin(req, res, next) {
    if (req.session && (req.session.role === 'admin' || req.session.role === 'teamleiter')) return next();
    res.status(403).json({ error: 'Nur für Teamleitung oder Administratoren.' });
}
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}
function mondayOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}
// Prüft, ob ein Tag für eine Person gesperrt ist (Tag- ODER Wochen-Sperre, egal ob
// selbst abgeschlossen oder von der Teamleitung verhängt) - gibt den strengsten
// gefundenen Sperreintrag zurück, oder null falls nichts gesperrt ist.
function createNotification(userId, message) {
    db.run(`INSERT INTO notifications (userId, message) VALUES (?, ?)`, [userId, message], () => {});
}
function getLockForDate(userId, date) {
    return new Promise((resolve) => {
        db.get(
            `SELECT * FROM time_locks WHERE userId = ? AND ((scope = 'day' AND periodKey = ?) OR (scope = 'week' AND periodKey = ?)) ORDER BY (lockedLevel = 'teamlead') DESC LIMIT 1`,
            [userId, date, mondayOf(date)],
            (err, row) => resolve(err ? null : row || null)
        );
    });
}
function daysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++; // Wochenenden zählen nicht als Ferientage
    }
    return count;
}

// --- Auth ---
const DEFAULT_PRIVACY_POLICY = `# Datenschutzerklärung

Diese Anwendung (AuraPlan) speichert folgende Daten, um Zeiterfassung, Schichtplanung und Ferienverwaltung zu ermöglichen:

- Name und Benutzername
- Gearbeitete Zeiten (Ein-/Ausstempeln, Pausen)
- Schichtpläne und Verfügbarkeiten
- Abwesenheits-/Urlaubsanträge inkl. Art und Zeitraum

Diese Daten werden ausschliesslich auf dem Server eures Unternehmens gespeichert und nicht an Dritte weitergegeben. Bei Fragen wendet euch an eure Administrator:innen.

## Rückmeldung an den Lizenzserver

Diese Anwendung meldet sich alle 12 Stunden anonym beim Lizenzserver des Herstellers. Übermittelt werden nur: eine zufällige Installationskennung, der Produktname und die Version, der Lizenzzustand (Testphase, kostenlos, lizenziert, abgelaufen), die Zahl der Konten und, falls vorhanden, der Lizenzschlüssel. Es werden keine Namen, keine Inhalte und keine Zugangsdaten übermittelt. Die IP-Adresse wird beim Hersteller nicht gespeichert.`;

function isTwoFactorRequired() {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM settings WHERE key = 'security_2fa_required'`, [], (err, row) => {
            resolve(!err && row && row.value === 'true');
        });
    });
}
async function generateTwoFactorSetup(username) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(username, 'AuraPlan', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrCodeDataUrl };
}
function verifyTwoFactorCode(secret, code) {
    try { return authenticator.verify({ token: String(code).trim(), secret }); }
    catch { return false; }
}

function toSessionSummary(user) {
    return { id: user.id, username: user.username, name: user.name, role: user.role, privacyAcceptedVersion: user.privacy_accepted_version || 0 };
}

async function beginSessionWithTwoFactorGate(req, res, user) {
    const twofaRequired = await isTwoFactorRequired();

    if (!twofaRequired) {
        req.session.userId = user.id;
        req.session.role = user.role;
        return res.json({ success: true, ...toSessionSummary(user) });
    }

    if (user.twofa_enabled && user.twofa_secret) {
        req.session.pending2faUserId = user.id;
        return res.json({ success: true, requires2fa: true });
    }

    const { secret, qrCodeDataUrl } = await generateTwoFactorSetup(user.username);
    req.session.pending2faUserId = user.id;
    req.session.pendingTwofaSecret = secret;
    res.json({ success: true, requires2faSetup: true, qrCodeDataUrl, secret });
}

// --- AuraDirect-Anbindung (optional, zentrale Benutzerverwaltung) ---
async function tryAuraDirectLogin(username, password, twofaCode) {
    const url = await getSetting('auradirect_url');
    const serviceKey = await getSetting('auradirect_service_key');
    if (!url) return null; // nicht eingerichtet - normal lokal weitermachen
    try {
        const resp = await fetch(`${url.replace(/\/$/, '')}/api/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Service-Key': serviceKey || '' },
            body: JSON.stringify({ username, password, product: 'auraplan', twofaCode }),
            signal: AbortSignal.timeout(6000)
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            console.error(`AuraDirect-Anmeldung: Antwort-Status ${resp.status} - ${body}`);
            return null;
        }
        const data = await resp.json();
        if (!data.valid && !data.requires2fa) console.log(`AuraDirect-Anmeldung: "${username}" wurde dort nicht als gültig bestätigt (${data.error || 'kein Grund angegeben'}).`);
        return data; // {valid, requires2fa, name, email, role, ...} - Aufrufer wertet selbst aus
    } catch (err) {
        console.error('AuraDirect nicht erreichbar:', err.message);
        return null; // lokal weitermachen, niemanden aussperren
    }
}
// Legt bei erfolgreicher AuraDirect-Anmeldung automatisch ein lokales Benutzerkonto an
// bzw. hält Name/Rolle aktuell - alle bestehenden Funktionen (Zeiterfassung, Schichten
// usw.) referenzieren weiterhin ganz normal eine lokale Benutzer-ID.
function provisionFromAuraDirect(username, adResult) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, existing) => {
            if (err) return reject(err);
            const role = ['admin', 'teamleiter'].includes(adResult.role) ? adResult.role : 'employee';
            if (existing) {
                db.run(`UPDATE users SET name = ?, role = ? WHERE id = ?`, [adResult.name || existing.name, role, existing.id], (e) => {
                    if (e) return reject(e);
                    db.get(`SELECT * FROM users WHERE id = ?`, [existing.id], (e2, row) => e2 ? reject(e2) : resolve(row));
                });
            } else {
                // Zufälliges, nie genutztes lokales Passwort - die Anmeldung läuft für dieses
                // Konto ja über AuraDirect, nicht über das hiesige Passwortfeld.
                bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10).then(hash => {
                    db.run(`INSERT INTO users (username, passwordHash, name, role) VALUES (?, ?, ?, ?)`,
                        [username, hash, adResult.name || username, role], function (e) {
                            if (e) return reject(e);
                            db.get(`SELECT * FROM users WHERE id = ?`, [this.lastID], (e2, row) => e2 ? reject(e2) : resolve(row));
                        });
                });
            }
        });
    });
}

app.post('/api/login', authLimiter, (req, res) => {
    const { username, password } = req.body;
    (async () => {
        const adResp = await tryAuraDirectLogin((username || '').trim(), password || '');

        if (adResp && adResp.requires2fa) {
            // Kurzlebig im Server-seitigen Session-Speicher, nur bis zum zweiten Schritt
            // (Code-Eingabe) - danach sofort wieder gelöscht.
            req.session.pendingAuraDirectUsername = (username || '').trim();
            req.session.pendingAuraDirectPassword = password || '';
            return res.json({ requires2fa: true, viaAuraDirect: true });
        }
        if (adResp && adResp.valid) {
            const user = await provisionFromAuraDirect((username || '').trim(), adResp);
            // AuraDirect hat 2FA bereits zentral geprüft (falls nötig) - hier NICHT nochmal
            // eine eigene, lokale 2FA-Einrichtung verlangen.
            req.session.userId = user.id;
            req.session.role = user.role;
            return res.json({ success: true });
        }

        db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [(username || '').trim()], async (err, user) => {
            if (err || !user) return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
            const match = await bcrypt.compare(password || '', user.passwordHash).catch(() => false);
            if (!match) return res.status(401).json({ error: 'Benutzername oder Passwort falsch.' });
            await beginSessionWithTwoFactorGate(req, res, user);
        });
    })();
});

// Schritt 2 einer AuraDirect-Anmeldung mit zentralem 2FA - Benutzername/Passwort wurden
// bereits in Schritt 1 geprüft, hier nur noch der Code.
app.post('/api/login/2fa-auradirect', authLimiter, async (req, res) => {
    const username = req.session.pendingAuraDirectUsername;
    const password = req.session.pendingAuraDirectPassword;
    if (!username) return res.status(400).json({ error: 'Kein Login ausstehend. Bitte erneut einloggen.' });

    const adResp = await tryAuraDirectLogin(username, password, req.body.code);
    delete req.session.pendingAuraDirectPassword; // so kurz wie möglich im Speicher halten

    if (!adResp || !adResp.valid) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
    delete req.session.pendingAuraDirectUsername;

    const user = await provisionFromAuraDirect(username, adResp);
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true });
});

app.get('/api/admin/auradirect', requireAuth, requireAdmin, async (req, res) => {
    res.json({ url: await getSetting('auradirect_url') || '', hasServiceKey: !!(await getSetting('auradirect_service_key')) });
});
app.post('/api/admin/auradirect', requireAuth, requireAdmin, async (req, res) => {
    // Wie beim Dienst-Schlüssel: ein leeres Feld beim Speichern löscht die URL NICHT mehr
    // versehentlich - nur ein tatsächlich eingetragener Wert überschreibt den bisherigen.
    // Zum bewussten Löschen der URL gibt es unten den eigenen "Trennen"-Weg.
    const url = (req.body.url || '').trim();
    if (url) await setSetting('auradirect_url', url);
    if (req.body.serviceKey && req.body.serviceKey.trim()) await setSetting('auradirect_service_key', req.body.serviceKey.trim());
    res.json({ success: true });
});
app.post('/api/admin/auradirect/disconnect', requireAuth, requireAdmin, async (req, res) => {
    await setSetting('auradirect_url', '');
    res.json({ success: true });
});

// Login Schritt 2a: 2FA-Einrichtung bestätigen (erster Login, nachdem 2FA aktiviert wurde)
app.post('/api/login/2fa-setup', authLimiter, (req, res) => {
    const { code } = req.body;
    const userId = req.session.pending2faUserId;
    const secret = req.session.pendingTwofaSecret;
    if (!userId || !secret) return res.status(400).json({ error: 'Keine 2FA-Einrichtung ausstehend. Bitte erneut einloggen.' });
    if (!verifyTwoFactorCode(secret, code)) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });

    db.run(`UPDATE users SET twofa_secret = ?, twofa_enabled = 1 WHERE id = ?`, [secret, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.get(`SELECT * FROM users WHERE id = ?`, [userId], (e, user) => {
            if (e || !user) return res.status(500).json({ error: 'Benutzer nicht gefunden.' });
            delete req.session.pending2faUserId;
            delete req.session.pendingTwofaSecret;
            req.session.userId = user.id;
            req.session.role = user.role;
            res.json({ success: true, ...toSessionSummary(user) });
        });
    });
});

// Login Schritt 2b: normaler 2FA-Code bei bereits eingerichtetem 2FA
app.post('/api/login/2fa', authLimiter, (req, res) => {
    const { code } = req.body;
    const userId = req.session.pending2faUserId;
    if (!userId) return res.status(400).json({ error: 'Kein Login ausstehend. Bitte erneut einloggen.' });
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user || !user.twofa_secret) return res.status(400).json({ error: '2FA ist für diesen Account nicht eingerichtet.' });
        if (!verifyTwoFactorCode(user.twofa_secret, code)) return res.status(401).json({ error: 'Code ist falsch oder abgelaufen.' });
        delete req.session.pending2faUserId;
        req.session.userId = user.id;
        req.session.role = user.role;
        res.json({ success: true, ...toSessionSummary(user) });
    });
});

app.put('/api/admin/users/:id/reset-2fa', requireAuth, requireAdmin, (req, res) => {
    db.run(`UPDATE users SET twofa_secret = NULL, twofa_enabled = 0 WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/admin/security', requireAuth, requireAdmin, async (req, res) => {
    res.json({ twoFactorRequired: await isTwoFactorRequired() });
});
app.post('/api/admin/security', requireAuth, requireAdmin, async (req, res) => {
    await setSetting('security_2fa_required', req.body.twoFactorRequired ? 'true' : 'false');
    res.json({ success: true });
});

// --- Datenschutzerklärung ---
app.get('/api/privacy-policy', (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'privacy_policy_text'`, [], (err, textRow) => {
        db.get(`SELECT value FROM settings WHERE key = 'privacy_policy_version'`, [], (e, versionRow) => {
            res.json({ text: (textRow && textRow.value) || DEFAULT_PRIVACY_POLICY, version: parseInt((versionRow && versionRow.value) || '1', 10) });
        });
    });
});
app.post('/api/privacy-policy/accept', requireAuth, (req, res) => {
    db.get(`SELECT value FROM settings WHERE key = 'privacy_policy_version'`, [], (err, row) => {
        const version = parseInt((row && row.value) || '1', 10);
        db.run(`UPDATE users SET privacy_accepted_version = ? WHERE id = ?`, [version, req.session.userId], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true, version });
        });
    });
});
app.post('/api/admin/privacy-policy', requireAuth, requireAdmin, async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text darf nicht leer sein.' });
    db.get(`SELECT value FROM settings WHERE key = 'privacy_policy_version'`, [], async (err, row) => {
        const newVersion = parseInt((row && row.value) || '1', 10) + 1;
        await setSetting('privacy_policy_text', text);
        await setSetting('privacy_policy_version', String(newVersion));
        res.json({ success: true, version: newVersion });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
    db.get(`SELECT id, username, name, role, vacationDaysPerYear, color, twofa_enabled, privacy_accepted_version, pensumPercent, weeklyHours FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Nicht gefunden.' });
        res.json(user);
    });
});

// --- Lizenz ---
app.get('/api/license', requireAuth, async (req, res) => {
    res.json(await getStoredLicenseInfo());
});
// Lizenz eintragen/entfernen gibt es hier nicht mehr: die Lizenz wird zentral in AuraControl eingetragen und von dort abgeholt (aura-license-sync.js).

app.post('/api/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [req.session.userId], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Nicht gefunden.' });
        const ok = await bcrypt.compare(currentPassword || '', user.passwordHash).catch(() => false);
        if (!ok) return res.status(400).json({ error: 'Aktuelles Passwort ist falsch.' });
        if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
        const hash = await bcrypt.hash(newPassword, 10);
        db.run(`UPDATE users SET passwordHash = ? WHERE id = ?`, [hash, user.id], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true });
        });
    });
});

// --- Benutzerverwaltung (Admin) ---
app.get('/api/users', requireAuth, (req, res) => {
    // Alle sehen die Namen/Farben aller aktiven Kolleg:innen (für Schichtplan/Kalenderansicht),
    // aber nur Admins sehen Details wie Ferienguthaben oder können etwas ändern.
    const fields = req.session.role === 'admin'
        ? 'id, username, name, role, vacationDaysPerYear, color, active, pensumPercent, weeklyHours'
        : 'id, name, color';
    const where = req.session.role === 'admin' ? '' : 'WHERE active = 1';
    db.all(`SELECT ${fields} FROM users ${where} ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    const { name, role, vacationDaysPerYear, color, active, pensumPercent, weeklyHours } = req.body;
    const finalRole = ['admin', 'teamleiter'].includes(role) ? role : 'employee';
    db.run(
        `UPDATE users SET name = ?, role = ?, vacationDaysPerYear = ?, color = ?, active = ?, pensumPercent = ?, weeklyHours = ? WHERE id = ?`,
        [name, finalRole, vacationDaysPerYear, color, active ? 1 : 0, pensumPercent || 100, weeklyHours || 42, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.post('/api/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
    const hash = await bcrypt.hash(newPassword, 10);
    db.run(`UPDATE users SET passwordHash = ? WHERE id = ?`, [hash, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
    if (Number(req.params.id) === req.session.userId) return res.status(400).json({ error: 'Eigenes Konto kann nicht gelöscht werden.' });
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Zeiterfassung ---
app.get('/api/time/status', requireAuth, (req, res) => {
    db.get(`SELECT * FROM time_entries WHERE userId = ? AND clockOut IS NULL ORDER BY id DESC LIMIT 1`, [req.session.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ clockedIn: !!row, entry: row || null });
    });
});

// --- Zeitarten (z.B. Arbeitszeit, Militär, Krankheit) ---
app.get('/api/activity-types', requireAuth, (req, res) => {
    const where = req.session.role === 'admin' ? '' : 'WHERE active = 1';
    db.all(`SELECT * FROM activity_types ${where} ORDER BY sortOrder, name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/admin/activity-types', requireAuth, requireAdmin, (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name ist erforderlich.' });
    db.run(`INSERT INTO activity_types (name) VALUES (?)`, [name], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});
app.put('/api/admin/activity-types/:id', requireAuth, requireAdmin, (req, res) => {
    const { name, active } = req.body;
    db.run(`UPDATE activity_types SET name = ?, active = ? WHERE id = ?`, [name, active ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Kostenstellen ---
app.get('/api/cost-centers', requireAuth, (req, res) => {
    const where = req.session.role === 'admin' ? '' : 'WHERE active = 1';
    db.all(`SELECT * FROM cost_centers ${where} ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/admin/cost-centers', requireAuth, requireAdmin, (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name ist erforderlich.' });
    db.run(`INSERT INTO cost_centers (name, code) VALUES (?, ?)`, [name, req.body.code || null], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});
app.put('/api/admin/cost-centers/:id', requireAuth, requireAdmin, (req, res) => {
    const { name, code, active } = req.body;
    db.run(`UPDATE cost_centers SET name = ?, code = ?, active = ? WHERE id = ?`, [name, code || null, active ? 1 : 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Manuelle Erfassung durch Mitarbeitende selbst (Alternative zum Ein-/Ausstempel-Knopf,
// z.B. nachträglich oder für Vormittag/Nachmittag getrennt) - respektiert Sperren genauso.
app.post('/api/time/manual-entry', requireAuth, async (req, res) => {
    const { date, clockIn, clockOut, breakMinutes, activityTypeId, costCenterId } = req.body;
    if (!date || !clockIn || !clockOut) return res.status(400).json({ error: 'Datum, Von- und Bis-Zeit sind erforderlich.' });
    const lock = await getLockForDate(req.session.userId, date);
    if (lock) return res.status(400).json({ error: 'Dieser Tag ist bereits abgeschlossen/gesperrt.' });
    db.run(
        `INSERT INTO time_entries (userId, date, clockIn, clockOut, breakMinutes, activityTypeId, costCenterId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.session.userId, date, clockIn, clockOut, breakMinutes || 0, activityTypeId || null, costCenterId || null],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.post('/api/time/clock-in', requireAuth, async (req, res) => {
    const lock = await getLockForDate(req.session.userId, todayStr());
    if (lock) return res.status(400).json({ error: 'Der heutige Tag ist bereits abgeschlossen/gesperrt - kein Einstempeln mehr möglich.' });
    db.get(`SELECT id FROM time_entries WHERE userId = ? AND clockOut IS NULL`, [req.session.userId], (err, existing) => {
        if (existing) return res.status(400).json({ error: 'Du bist bereits eingestempelt.' });
        const now = new Date();
        db.run(`INSERT INTO time_entries (userId, date, clockIn, activityTypeId, costCenterId) VALUES (?, ?, ?, ?, ?)`,
            [req.session.userId, todayStr(), now.toISOString(), req.body.activityTypeId || null, req.body.costCenterId || null], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, id: this.lastID });
            });
    });
});

// Mitarbeiter:in schliesst den heutigen Tag selbst ab - danach kein weiteres Einstempeln
// mehr möglich, bis Teamleitung/Admin wieder aufschliesst. Verlangt, vorher auszustempeln.
app.post('/api/time/close-day', requireAuth, async (req, res) => {
    const date = req.body.date || todayStr();
    db.get(`SELECT id FROM time_entries WHERE userId = ? AND clockOut IS NULL`, [req.session.userId], (err, openEntry) => {
        if (openEntry) return res.status(400).json({ error: 'Bitte zuerst ausstempeln, bevor der Tag abgeschlossen wird.' });
        db.run(
            `INSERT INTO time_locks (userId, scope, periodKey, lockedLevel, lockedByUserId) VALUES (?, 'day', ?, 'employee', ?) ON CONFLICT(userId, scope, periodKey) DO NOTHING`,
            [req.session.userId, date, req.session.userId],
            (e) => {
                if (e) return res.status(500).json({ error: e.message });
                res.json({ success: true });
            }
        );
    });
});

// Teamleitung/Admin: Tag oder Woche für eine Person (oder alle) sperren - danach kann
// niemand mehr (auch nicht die Person selbst) neue Zeiten für diesen Zeitraum erfassen.
app.post('/api/time/lock', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { userId, scope, date } = req.body;
    if (!['day', 'week'].includes(scope) || !date) return res.status(400).json({ error: 'Zeitraum (Tag/Woche) und Datum sind erforderlich.' });
    const periodKey = scope === 'week' ? mondayOf(date) : date;
    const targetIds = userId === 'all' ? null : [userId];

    const lockOne = (uid) => new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO time_locks (userId, scope, periodKey, lockedLevel, lockedByUserId) VALUES (?, ?, ?, 'teamlead', ?)
             ON CONFLICT(userId, scope, periodKey) DO UPDATE SET lockedLevel = 'teamlead', lockedByUserId = excluded.lockedByUserId`,
            [uid, scope, periodKey, req.session.userId],
            (err) => err ? reject(err) : resolve()
        );
    });

    (targetIds ? Promise.resolve(targetIds) : new Promise((resolve, reject) => {
        db.all(`SELECT id FROM users WHERE active = 1`, [], (err, rows) => err ? reject(err) : resolve(rows.map(r => r.id)));
    })).then(ids => Promise.all(ids.map(lockOne)))
      .then(() => res.json({ success: true }))
      .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/time/unlock', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { userId, scope, date } = req.body;
    if (!['day', 'week'].includes(scope) || !date) return res.status(400).json({ error: 'Zeitraum (Tag/Woche) und Datum sind erforderlich.' });
    const periodKey = scope === 'week' ? mondayOf(date) : date;
    const clause = userId === 'all' ? `scope = ? AND periodKey = ?` : `userId = ? AND scope = ? AND periodKey = ?`;
    const params = userId === 'all' ? [scope, periodKey] : [userId, scope, periodKey];
    db.run(`DELETE FROM time_locks WHERE ${clause}`, params, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/api/time/locks', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('periodKey >= ?'); params.push(from); }
    if (to) { conditions.push('periodKey <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    db.all(`SELECT l.*, u.name as userName FROM time_locks l JOIN users u ON u.id = l.userId ${where} ORDER BY l.periodKey`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/time/clock-out', requireAuth, (req, res) => {
    const breakMinutes = parseInt(req.body.breakMinutes, 10) || 0;
    db.get(`SELECT id FROM time_entries WHERE userId = ? AND clockOut IS NULL ORDER BY id DESC LIMIT 1`, [req.session.userId], (err, row) => {
        if (!row) return res.status(400).json({ error: 'Du bist nicht eingestempelt.' });
        db.run(`UPDATE time_entries SET clockOut = ?, breakMinutes = ? WHERE id = ?`, [new Date().toISOString(), breakMinutes, row.id], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true });
        });
    });
});

app.get('/api/time/entries', requireAuth, (req, res) => {
    const { from, to, userId } = req.query;
    const isAdmin = req.session.role === 'admin';
    const targetUserId = isAdmin && userId ? userId : req.session.userId;
    if (!isAdmin && userId && Number(userId) !== req.session.userId) return res.status(403).json({ error: 'Kein Zugriff.' });

    const conditions = ['t.userId = ?'];
    const params = [targetUserId];
    if (from) { conditions.push('t.date >= ?'); params.push(from); }
    if (to) { conditions.push('t.date <= ?'); params.push(to); }

    db.all(`SELECT t.*, a.name as activityTypeName, c.name as costCenterName FROM time_entries t
            LEFT JOIN activity_types a ON a.id = t.activityTypeId
            LEFT JOIN cost_centers c ON c.id = t.costCenterId
            WHERE ${conditions.join(' AND ')} ORDER BY t.date DESC, t.clockIn DESC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/time/entries/all', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('t.date >= ?'); params.push(from); }
    if (to) { conditions.push('t.date <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // Gelöschte Einträge werden NICHT weggefiltert (deleted=1 bleibt sichtbar, durchgestrichen
    // im Frontend) - revisionssichere Zeiterfassung, nichts verschwindet spurlos.
    db.all(`SELECT t.*, u.name as userName, a.name as activityTypeName, c.name as costCenterName FROM time_entries t
            JOIN users u ON u.id = t.userId
            LEFT JOIN activity_types a ON a.id = t.activityTypeId
            LEFT JOIN cost_centers c ON c.id = t.costCenterId
            ${where} ORDER BY t.date DESC, t.clockIn DESC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CSV-Export für die Lohnbuchhaltung - Semikolon als Trenner (Excel/DE-Gebietsschema-freundlich)
app.get('/api/time/entries/export', requireAuth, requireAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['t.deleted = 0']; // gelöschte Einträge nicht in der Lohnbuchhaltung mitzählen
    const params = [];
    if (from) { conditions.push('t.date >= ?'); params.push(from); }
    if (to) { conditions.push('t.date <= ?'); params.push(to); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    db.all(`SELECT t.*, u.name as userName, a.name as activityTypeName, c.name as costCenterName FROM time_entries t
            JOIN users u ON u.id = t.userId
            LEFT JOIN activity_types a ON a.id = t.activityTypeId
            LEFT JOIN cost_centers c ON c.id = t.costCenterId
            ${where} ORDER BY u.name, t.date`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = ['Name;Datum;Beginn;Ende;Pause (Min.);Nettostunden;Zeitart;Kostenstelle;Notiz'];
        rows.forEach(r => {
            const gross = r.clockOut ? (new Date(r.clockOut) - new Date(r.clockIn)) / 3600000 : 0;
            const net = Math.max(0, gross - (r.breakMinutes || 0) / 60).toFixed(2);
            const clockInTime = new Date(r.clockIn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const clockOutTime = r.clockOut ? new Date(r.clockOut).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
            lines.push([esc(r.userName), esc(r.date), esc(clockInTime), esc(clockOutTime), esc(r.breakMinutes || 0), esc(net), esc(r.activityTypeName || ''), esc(r.costCenterName || ''), esc(r.note || '')].join(';'));
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="auraplan-zeiterfassung.csv"`);
        res.send('\uFEFF' + lines.join('\r\n')); // BOM voran, damit Excel Umlaute korrekt zeigt
    });
});

app.post('/api/time/entries', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { userId, date, clockIn, clockOut, breakMinutes, note, activityTypeId, costCenterId } = req.body;
    if (!userId || !date || !clockIn) return res.status(400).json({ error: 'Mitarbeiter:in, Datum und Beginn sind erforderlich.' });
    db.run(`INSERT INTO time_entries (userId, date, clockIn, clockOut, breakMinutes, note, activityTypeId, costCenterId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, date, clockIn, clockOut || null, breakMinutes || 0, note || null, activityTypeId || null, costCenterId || null], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Teamleitung/Admin dürfen auch gesperrte/abgeschlossene Tage bearbeiten - Sperren richten
// sich gegen Mitarbeitende, nicht gegen die, die sie verhängen bzw. aufheben können.
app.put('/api/time/entries/:id', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { date, clockIn, clockOut, breakMinutes, note, activityTypeId, costCenterId } = req.body;
    db.get(`SELECT userId, date as oldDate FROM time_entries WHERE id = ?`, [req.params.id], (fetchErr, entry) => {
        db.run(`UPDATE time_entries SET date = ?, clockIn = ?, clockOut = ?, breakMinutes = ?, note = ?, activityTypeId = ?, costCenterId = ? WHERE id = ?`,
            [date, clockIn, clockOut || null, breakMinutes || 0, note || null, activityTypeId || null, costCenterId || null, req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!fetchErr && entry && entry.userId !== req.session.userId) {
                    db.get(`SELECT name FROM users WHERE id = ?`, [req.session.userId], (e2, actor) => {
                        createNotification(entry.userId, `Dein Zeiteintrag vom ${entry.oldDate} wurde von ${(actor && actor.name) || 'einer Teamleitung'} bearbeitet.`);
                    });
                }
                res.json({ success: true });
            });
    });
});

// Löschen ist bewusst ein "weiches" Löschen (durchstreichen) - für eine revisionssichere
// Zeiterfassung nach Schweizer Arbeitsgesetz darf nichts spurlos verschwinden.
app.delete('/api/time/entries/:id', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    db.get(`SELECT userId, date FROM time_entries WHERE id = ?`, [req.params.id], (fetchErr, entry) => {
        db.run(`UPDATE time_entries SET deleted = 1, deletedAt = ?, deletedByUserId = ? WHERE id = ?`,
            [new Date().toISOString(), req.session.userId, req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!fetchErr && entry && entry.userId !== req.session.userId) {
                    db.get(`SELECT name FROM users WHERE id = ?`, [req.session.userId], (e2, actor) => {
                        createNotification(entry.userId, `Dein Zeiteintrag vom ${entry.date} wurde von ${(actor && actor.name) || 'einer Teamleitung'} gelöscht.`);
                    });
                }
                res.json({ success: true });
            });
    });
});

app.post('/api/time/entries/:id/restore', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    db.run(`UPDATE time_entries SET deleted = 0, deletedAt = NULL, deletedByUserId = NULL WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Verfügbarkeiten (wann kann wer NICHT arbeiten) ---
app.get('/api/availabilities', requireAuth, (req, res) => {
    const { from, to, userId } = req.query;
    const isAdmin = req.session.role === 'admin';
    const conditions = [];
    const params = [];
    if (userId && (isAdmin || Number(userId) === req.session.userId)) { conditions.push('a.userId = ?'); params.push(userId); }
    else if (!isAdmin) { conditions.push('a.userId = ?'); params.push(req.session.userId); }
    if (from) { conditions.push('a.date >= ?'); params.push(from); }
    if (to) { conditions.push('a.date <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    db.all(`SELECT a.*, u.name as userName FROM availabilities a JOIN users u ON u.id = a.userId ${where} ORDER BY a.date`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/availabilities', requireAuth, (req, res) => {
    const { date, note } = req.body;
    if (!date) return res.status(400).json({ error: 'Datum ist erforderlich.' });
    db.run(`INSERT INTO availabilities (userId, date, note) VALUES (?, ?, ?)`, [req.session.userId, date, note || null], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/availabilities/:id', requireAuth, (req, res) => {
    db.get(`SELECT userId FROM availabilities WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Nicht gefunden.' });
        if (row.userId !== req.session.userId && req.session.role !== 'admin') return res.status(403).json({ error: 'Kein Zugriff.' });
        db.run(`DELETE FROM availabilities WHERE id = ?`, [req.params.id], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true });
        });
    });
});

// --- Schichtplanung ---
app.get('/api/shifts', requireAuth, (req, res) => {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) { conditions.push('s.date >= ?'); params.push(from); }
    if (to) { conditions.push('s.date <= ?'); params.push(to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // Jede Person sieht den ganzen Schichtplan (nicht nur eigene Schichten) - üblich für
    // Teamplanung, damit alle sehen, wer wann arbeitet. LEFT JOIN, damit offene (noch
    // niemandem zugewiesene) Schichten mit userId = NULL nicht rausfallen.
    db.all(`SELECT s.*, u.name as userName, u.color as userColor FROM shifts s LEFT JOIN users u ON u.id = s.userId ${where} ORDER BY s.date, s.startTime`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/shifts', requireAuth, requireAdmin, (req, res) => {
    const { userId, date, startTime, endTime, role, note } = req.body;
    if (!date || !startTime || !endTime) return res.status(400).json({ error: 'Datum, Beginn und Ende sind erforderlich.' });
    db.run(`INSERT INTO shifts (userId, date, startTime, endTime, role, note) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId || null, date, startTime, endTime, role || null, note || null], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (userId) createNotification(userId, `Dir wurde eine neue Schicht am ${date} von ${startTime} bis ${endTime} zugeteilt.`);
            res.json({ success: true, id: this.lastID });
        });
});

app.put('/api/shifts/:id', requireAuth, requireAdmin, (req, res) => {
    const { userId, date, startTime, endTime, role, note } = req.body;
    db.run(`UPDATE shifts SET userId = ?, date = ?, startTime = ?, endTime = ?, role = ?, note = ? WHERE id = ?`,
        [userId || null, date, startTime, endTime, role || null, note || null, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

// Mitarbeiter:innen übernehmen eine offene Schicht selbst - kein Admin nötig
app.post('/api/shifts/:id/claim', requireAuth, (req, res) => {
    db.get(`SELECT * FROM shifts WHERE id = ?`, [req.params.id], (err, shift) => {
        if (err || !shift) return res.status(404).json({ error: 'Schicht nicht gefunden.' });
        if (shift.userId) return res.status(400).json({ error: 'Diese Schicht ist bereits vergeben.' });
        db.run(`UPDATE shifts SET userId = ? WHERE id = ?`, [req.session.userId, req.params.id], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true });
        });
    });
});

app.delete('/api/shifts/:id', requireAuth, requireAdmin, (req, res) => {
    db.run(`DELETE FROM shifts WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Ferien-/Abwesenheitsplanung ---
app.get('/api/absences', requireAuth, (req, res) => {
    const canSeeAll = req.session.role === 'admin' || req.session.role === 'teamleiter';
    if (canSeeAll) {
        db.all(`SELECT a.*, u.name as userName, u.color as userColor, d.name as decidedByName FROM absences a JOIN users u ON u.id = a.userId LEFT JOIN users d ON d.id = a.decidedByUserId ORDER BY a.status = 'pending' DESC, a.startDate DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    } else {
        // Eigene Anträge im Detail, alle anderen genehmigten Abwesenheiten nur zur
        // Kalenderübersicht (wer ist wann weg) - ohne Status/Grund fremder Personen.
        db.all(`
            SELECT a.*, u.name as userName, u.color as userColor FROM absences a JOIN users u ON u.id = a.userId WHERE a.userId = ?
            UNION ALL
            SELECT a.id, a.userId, a.startDate, a.endDate, a.type, a.status, NULL as note, a.decisionNote, a.decidedByUserId, a.decidedAt, a.createdAt, u.name as userName, u.color as userColor
            FROM absences a JOIN users u ON u.id = a.userId WHERE a.userId != ? AND a.status = 'approved'
            ORDER BY startDate DESC
        `, [req.session.userId, req.session.userId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    }
});

app.get('/api/absences/balance', requireAuth, (req, res) => {
    const canSeeOthers = req.session.role === 'admin' || req.session.role === 'teamleiter';
    const userId = req.query.userId && canSeeOthers ? req.query.userId : req.session.userId;
    const year = req.query.year || new Date().getFullYear();
    db.get(`SELECT vacationDaysPerYear FROM users WHERE id = ?`, [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Nicht gefunden.' });
        db.all(`SELECT startDate, endDate FROM absences WHERE userId = ? AND type = 'vacation' AND status = 'approved' AND startDate LIKE ?`, [userId, `${year}-%`], (e, rows) => {
            if (e) return res.status(500).json({ error: e.message });
            const used = rows.reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0);
            res.json({ total: user.vacationDaysPerYear, used, remaining: user.vacationDaysPerYear - used });
        });
    });
});

app.post('/api/absences', requireAuth, (req, res) => {
    const { startDate, endDate, type, note } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start- und Enddatum sind erforderlich.' });
    if (endDate < startDate) return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen.' });
    db.run(`INSERT INTO absences (userId, startDate, endDate, type, note, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [req.session.userId, startDate, endDate, type || 'vacation', note || null], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
        });
});

// Genehmigen/Ablehnen - Teamleitung ODER Admin, mit optionalem Kommentar (v.a. bei Ablehnung
// sinnvoll) und nachvollziehbarer Protokollierung, wer wann entschieden hat.
app.put('/api/absences/:id/status', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { status, decisionNote } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status.' });
    db.get(`SELECT * FROM absences WHERE id = ?`, [req.params.id], (fetchErr, absence) => {
        db.run(`UPDATE absences SET status = ?, decisionNote = ?, decidedByUserId = ?, decidedAt = ? WHERE id = ?`,
            [status, decisionNote || null, req.session.userId, new Date().toISOString(), req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!fetchErr && absence && (status === 'approved' || status === 'rejected')) {
                    const typeLabel = absence.type === 'vacation' ? 'Ferienantrag' : (absence.type === 'sick' ? 'Krankmeldung' : 'Antrag');
                    const period = absence.startDate === absence.endDate ? `am ${absence.startDate}` : `vom ${absence.startDate} bis ${absence.endDate}`;
                    createNotification(absence.userId, `Dein ${typeLabel} ${period} wurde ${status === 'approved' ? 'genehmigt' : 'abgelehnt'}.`);
                }
                res.json({ success: true });
            });
    });
});

app.delete('/api/absences/:id', requireAuth, (req, res) => {
    const canManageAll = req.session.role === 'admin' || req.session.role === 'teamleiter';
    db.get(`SELECT * FROM absences WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Nicht gefunden.' });
        if (!canManageAll && (row.userId !== req.session.userId || row.status !== 'pending')) {
            return res.status(403).json({ error: 'Nur eigene, noch offene Anträge können zurückgezogen werden.' });
        }
        db.run(`DELETE FROM absences WHERE id = ?`, [req.params.id], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true });
        });
    });
});

function getSetting(key) {
    return new Promise((resolve) => {
        db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => resolve(row ? row.value : null));
    });
}
function setSetting(key, value) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value], (err) => err ? reject(err) : resolve());
    });
}

// --- Service-API: von AuraChat aufgerufen, damit Zeiterfassung/Ferien/Schichtplan
// per Chat- oder Sprachbefehl möglich sind. Eigener Dienst-Schlüssel (getrennt vom
// AuraDirect-Schlüssel), wird beim ersten Zugriff automatisch erzeugt.
let AURACHAT_SERVICE_KEY = null;
async function ensureAurachatServiceKey() {
    if (AURACHAT_SERVICE_KEY) return AURACHAT_SERVICE_KEY;
    let stored = await getSetting('aurachat_service_key');
    if (!stored) {
        stored = require('crypto').randomBytes(32).toString('hex');
        await setSetting('aurachat_service_key', stored);
    }
    AURACHAT_SERVICE_KEY = stored;
    return stored;
}
ensureAurachatServiceKey();

// --- Externe API: für Buchhaltungssoftware oder andere Drittsysteme. Eigener,
// separater Schlüssel (weder AuraChat- noch AuraDirect-Schlüssel) - Lesezugriff auf
// Mitarbeiter, Zeiterfassung und Absenzen, als JSON. Wird beim ersten Zugriff
// automatisch erzeugt, im Admin Panel einsehbar/neu erzeugbar.
let EXTERNAL_API_KEY = null;
async function ensureExternalApiKey() {
    if (EXTERNAL_API_KEY) return EXTERNAL_API_KEY;
    let stored = await getSetting('external_api_key');
    if (!stored) {
        stored = require('crypto').randomBytes(32).toString('hex');
        await setSetting('external_api_key', stored);
    }
    EXTERNAL_API_KEY = stored;
    return stored;
}
ensureExternalApiKey();

async function requireExternalApiKey(req, res, next) {
    const key = await ensureExternalApiKey();
    const provided = (req.headers['x-api-key'] || '').trim();
    if (provided !== key) return res.status(401).json({ error: 'Ungültiger oder fehlender API-Schlüssel.' });
    next();
}

app.get('/api/admin/external-api-key', requireAuth, requireAdmin, async (req, res) => {
    res.json({ key: await ensureExternalApiKey() });
});
app.post('/api/admin/external-api-key/regenerate', requireAuth, requireAdmin, async (req, res) => {
    EXTERNAL_API_KEY = require('crypto').randomBytes(32).toString('hex');
    await setSetting('external_api_key', EXTERNAL_API_KEY);
    res.json({ key: EXTERNAL_API_KEY });
});

// Read-only, für Drittsysteme (z.B. Buchhaltungsprogramme) - Header "X-API-Key" nötig.
app.get('/api/external/employees', requireExternalApiKey, (req, res) => {
    db.all(`SELECT username, name, role, vacationDaysPerYear, pensumPercent, weeklyHours, active FROM users ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.get('/api/external/time-entries', requireExternalApiKey, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['t.deleted = 0'];
    const params = [];
    if (from) { conditions.push('t.date >= ?'); params.push(from); }
    if (to) { conditions.push('t.date <= ?'); params.push(to); }
    db.all(
        `SELECT u.username, u.name, t.date, t.clockIn, t.clockOut, t.breakMinutes, a.name as activityType, c.name as costCenter
         FROM time_entries t JOIN users u ON u.id = t.userId
         LEFT JOIN activity_types a ON a.id = t.activityTypeId
         LEFT JOIN cost_centers c ON c.id = t.costCenterId
         WHERE ${conditions.join(' AND ')} ORDER BY t.date, u.name`, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows.map(r => ({
                ...r,
                hours: r.clockOut ? +(((new Date(r.clockOut) - new Date(r.clockIn)) / 3600000) - (r.breakMinutes || 0) / 60).toFixed(2) : null
            })));
        });
});
app.get('/api/external/absences', requireExternalApiKey, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['1=1'];
    const params = [];
    if (from) { conditions.push('a.startDate >= ?'); params.push(from); }
    if (to) { conditions.push('a.startDate <= ?'); params.push(to); }
    db.all(
        `SELECT u.username, u.name, a.startDate, a.endDate, a.type, a.status
         FROM absences a JOIN users u ON u.id = a.userId
         WHERE ${conditions.join(' AND ')} ORDER BY a.startDate`, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

async function requireAurachatServiceKey(req, res, next) {
    const key = await ensureAurachatServiceKey();
    const provided = (req.headers['x-service-key'] || '').trim();
    if (provided !== key) return res.status(401).json({ error: 'Ungültiger oder fehlender Dienst-Schlüssel.' });
    next();
}
function findUserByUsername(username) {
    return new Promise((resolve) => db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username], (err, row) => resolve(err ? null : row)));
}
function findDefaultActivityTypeId() {
    return new Promise((resolve) => db.get(`SELECT id FROM activity_types WHERE name = 'Arbeitszeit' AND active = 1`, [], (err, row) => resolve(row ? row.id : null)));
}

app.post('/api/service/clock-in', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.body.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    const lock = await getLockForDate(user.id, todayStr());
    if (lock) return res.status(400).json({ error: 'Der heutige Tag ist bereits abgeschlossen/gesperrt.' });
    db.get(`SELECT id FROM time_entries WHERE userId = ? AND clockOut IS NULL`, [user.id], async (err, existing) => {
        if (existing) return res.status(400).json({ error: 'Bereits eingestempelt.' });
        const activityTypeId = await findDefaultActivityTypeId();
        db.run(`INSERT INTO time_entries (userId, date, clockIn, activityTypeId) VALUES (?, ?, ?, ?)`,
            [user.id, todayStr(), new Date().toISOString(), activityTypeId], function (e) {
                if (e) return res.status(500).json({ error: e.message });
                res.json({ success: true });
            });
    });
});

app.post('/api/service/clock-out', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.body.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    db.get(`SELECT id, clockIn FROM time_entries WHERE userId = ? AND clockOut IS NULL ORDER BY id DESC LIMIT 1`, [user.id], (err, row) => {
        if (!row) return res.status(400).json({ error: 'Nicht eingestempelt.' });
        db.run(`UPDATE time_entries SET clockOut = ?, breakMinutes = ? WHERE id = ?`,
            [new Date().toISOString(), parseInt(req.body.breakMinutes, 10) || 0, row.id], (e) => {
                if (e) return res.status(500).json({ error: e.message });
                const hours = ((new Date() - new Date(row.clockIn)) / 3600000).toFixed(2);
                res.json({ success: true, hours });
            });
    });
});

app.get('/api/service/status', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.query.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    db.get(`SELECT * FROM time_entries WHERE userId = ? AND clockOut IS NULL ORDER BY id DESC LIMIT 1`, [user.id], (err, row) => {
        res.json({ clockedIn: !!row, clockIn: row ? row.clockIn : null });
    });
});

app.get('/api/service/balance', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.query.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    const year = new Date().getFullYear();
    db.all(`SELECT startDate, endDate FROM absences WHERE userId = ? AND type = 'vacation' AND status = 'approved' AND startDate LIKE ?`, [user.id, `${year}-%`], (err, rows) => {
        const used = (rows || []).reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0);
        res.json({ total: user.vacationDaysPerYear, used, remaining: user.vacationDaysPerYear - used });
    });
});

app.post('/api/service/absence', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.body.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    const { startDate, endDate, type, note } = req.body;
    if (!startDate || !endDate) return res.status(400).json({ error: 'Start- und Enddatum sind erforderlich.' });
    if (endDate < startDate) return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen.' });
    db.run(`INSERT INTO absences (userId, startDate, endDate, type, note, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [user.id, startDate, endDate, type || 'vacation', note || null], function (e) {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ success: true, id: this.lastID });
        });
});

app.get('/api/service/shifts', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.query.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    const { from, to } = req.query;
    const conditions = ['s.userId = ?'];
    const params = [user.id];
    if (from) { conditions.push('s.date >= ?'); params.push(from); }
    if (to) { conditions.push('s.date <= ?'); params.push(to); }
    db.all(`SELECT s.date, s.startTime, s.endTime, s.role FROM shifts s WHERE ${conditions.join(' AND ')} ORDER BY s.date, s.startTime`, params, (err, rows) => {
        res.json(rows || []);
    });
});

// Neue Benachrichtigungen abholen - werden dabei gleich als abgeholt markiert (AuraChat
// fragt das regelmässig ab und liest neue Meldungen laut vor).
app.get('/api/service/notifications', requireAurachatServiceKey, async (req, res) => {
    const user = await findUserByUsername(req.query.username);
    if (!user) return res.status(404).json({ error: 'Person nicht gefunden.' });
    db.all(`SELECT id, message, createdAt FROM notifications WHERE userId = ? AND delivered = 0 ORDER BY id`, [user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length) {
            db.run(`UPDATE notifications SET delivered = 1 WHERE id IN (${rows.map(r => r.id).join(',')})`);
        }
        res.json(rows);
    });
});

app.get('/api/admin/aurachat-service-key', requireAuth, requireAdmin, async (req, res) => {
    res.json({ key: await ensureAurachatServiceKey() });
});

// --- Backup & Wiederherstellung ---
// --- Import & Export (Admin) ---
function toCsvValue(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}
function toCsvRow(arr) { return arr.map(toCsvValue).join(',') + '\r\n'; }
function sendCsv(res, filename, header, rows) {
    let csv = '\uFEFF' + toCsvRow(header); // BOM voran, damit Excel Umlaute korrekt zeigt
    rows.forEach(r => { csv += toCsvRow(r); });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
}
// Sehr einfacher CSV-Parser - reicht für unsere eigenen Exporte als Vorlage, keine
// Anführungszeichen-Verschachtelung o.ä. nötig, da wir das Format selbst vorgeben.
function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { header: [], rows: [] };
    const splitLine = (line) => {
        const result = [];
        let cur = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (inQuotes) {
                if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (c === '"') { inQuotes = false; }
                else cur += c;
            } else {
                if (c === '"') inQuotes = true;
                else if (c === ',') { result.push(cur); cur = ''; }
                else cur += c;
            }
        }
        result.push(cur);
        return result;
    };
    const header = splitLine(lines[0]);
    const rows = lines.slice(1).map(splitLine);
    return { header, rows };
}

app.get('/api/admin/export/employees', requireAuth, requireAdmin, (req, res) => {
    db.all(`SELECT username, name, role, vacationDaysPerYear, pensumPercent, weeklyHours, color, active FROM users ORDER BY name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        sendCsv(res, 'auraplan-mitarbeiter.csv',
            ['username', 'name', 'role', 'vacationDaysPerYear', 'pensumPercent', 'weeklyHours', 'color', 'active'],
            rows.map(r => [r.username, r.name, r.role, r.vacationDaysPerYear, r.pensumPercent, r.weeklyHours, r.color, r.active]));
    });
});

// Mitarbeitende werden nicht mehr hier angelegt oder importiert (keine Routen POST /api/users und POST /api/admin/import/employees): das geschieht zentral in AuraDirect (kostenlos).
app.get('/api/admin/export/time-entries', requireAuth, requireAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['t.deleted = 0'];
    const params = [];
    if (from) { conditions.push('t.date >= ?'); params.push(from); }
    if (to) { conditions.push('t.date <= ?'); params.push(to); }
    db.all(
        `SELECT u.username, u.name, t.date, t.clockIn, t.clockOut, t.breakMinutes, t.note, a.name as activityType, c.name as costCenter
         FROM time_entries t JOIN users u ON u.id = t.userId
         LEFT JOIN activity_types a ON a.id = t.activityTypeId
         LEFT JOIN cost_centers c ON c.id = t.costCenterId
         WHERE ${conditions.join(' AND ')} ORDER BY t.date, u.name`, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            sendCsv(res, 'auraplan-zeiterfassung.csv',
                ['username', 'name', 'date', 'clockIn', 'clockOut', 'breakMinutes', 'activityType', 'costCenter', 'note'],
                rows.map(r => [r.username, r.name, r.date, r.clockIn, r.clockOut, r.breakMinutes, r.activityType, r.costCenter, r.note]));
        });
});

app.get('/api/admin/export/shifts', requireAuth, requireAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['1=1'];
    const params = [];
    if (from) { conditions.push('s.date >= ?'); params.push(from); }
    if (to) { conditions.push('s.date <= ?'); params.push(to); }
    db.all(
        `SELECT u.username, u.name, s.date, s.startTime, s.endTime, s.role, s.note
         FROM shifts s LEFT JOIN users u ON u.id = s.userId
         WHERE ${conditions.join(' AND ')} ORDER BY s.date, s.startTime`, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            sendCsv(res, 'auraplan-schichtplan.csv',
                ['username', 'name', 'date', 'startTime', 'endTime', 'role', 'note'],
                rows.map(r => [r.username, r.name, r.date, r.startTime, r.endTime, r.role, r.note]));
        });
});

app.get('/api/admin/export/absences', requireAuth, requireAdmin, (req, res) => {
    const { from, to } = req.query;
    const conditions = ['1=1'];
    const params = [];
    if (from) { conditions.push('a.startDate >= ?'); params.push(from); }
    if (to) { conditions.push('a.startDate <= ?'); params.push(to); }
    db.all(
        `SELECT u.username, u.name, a.startDate, a.endDate, a.type, a.status, a.note
         FROM absences a JOIN users u ON u.id = a.userId
         WHERE ${conditions.join(' AND ')} ORDER BY a.startDate`, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            sendCsv(res, 'auraplan-ferien-absenzen.csv',
                ['username', 'name', 'startDate', 'endDate', 'type', 'status', 'note'],
                rows.map(r => [r.username, r.name, r.startDate, r.endDate, r.type, r.status, r.note]));
        });
});


app.get('/api/admin/backup', requireAuth, requireAdmin, (req, res) => {
    const tmpDbPath = path.join(dataDir, `backup-tmp-${Date.now()}.db`);
    db.run(`VACUUM INTO ?`, [tmpDbPath], (err) => {
        if (err) return res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
        try {
            const zip = new AdmZip();
            zip.addLocalFile(tmpDbPath, '', 'auraplan.db');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="auraplan-backup-${timestamp}.zip"`
            });
            res.send(zip.toBuffer());
        } catch (zipErr) {
            res.status(500).json({ error: 'Backup fehlgeschlagen: ' + zipErr.message });
        } finally {
            fs.unlink(tmpDbPath, () => {});
        }
    });
});

// Ersetzt die Datenbank und beendet den Prozess sauber - Docker (restart: unless-stopped)
// startet automatisch mit der wiederhergestellten Datenbank neu.
app.post('/api/admin/backup/restore', requireAuth, requireAdmin, upload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    try {
        const zip = new AdmZip(req.file.buffer);
        const dbEntry = zip.getEntry('auraplan.db');
        if (!dbEntry) return res.status(400).json({ error: 'Diese Datei enthält keine auraplan.db - ist das wirklich ein AuraPlan-Backup?' });
        fs.writeFileSync(path.join(dataDir, 'auraplan.db'), dbEntry.getData());
        res.json({ success: true, message: 'Wiederhergestellt. Server startet jetzt neu...' });
        console.log('Backup wiederhergestellt - Prozess wird für einen sauberen Neustart beendet.');
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen: ' + err.message });
    }
});

// --- Übersicht: eine Zeile pro Person, für Arbeitszeiten/Schichtplan/Ferien (wie in Aplano) ---
app.get('/api/overview/hours', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { from, to } = req.query;
    db.all(`SELECT id, name, color, role FROM users WHERE active = 1 ORDER BY name`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(
            `SELECT userId, clockIn, clockOut, breakMinutes FROM time_entries WHERE deleted = 0 AND date >= ? AND date <= ?`,
            [from, to], (err2, entries) => {
                if (err2) return res.status(500).json({ error: err2.message });
                const hoursByUser = {};
                let openByUser = {};
                entries.forEach(e => {
                    if (!e.clockOut) { openByUser[e.userId] = true; return; }
                    const gross = (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000;
                    const net = Math.max(0, gross - (e.breakMinutes || 0) / 60);
                    hoursByUser[e.userId] = (hoursByUser[e.userId] || 0) + net;
                });
                res.json(users.map(u => ({
                    id: u.id, name: u.name, color: u.color, role: u.role,
                    hours: +(hoursByUser[u.id] || 0).toFixed(2),
                    clockedIn: !!openByUser[u.id]
                })));
            }
        );
    });
});

app.get('/api/overview/shifts', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const { from, to } = req.query;
    db.all(`SELECT id, name, color, role FROM users WHERE active = 1 ORDER BY name`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(
            `SELECT userId, date, startTime, endTime, role FROM shifts WHERE userId IS NOT NULL AND date >= ? AND date <= ? ORDER BY date, startTime`,
            [from, to], (err2, shifts) => {
                if (err2) return res.status(500).json({ error: err2.message });
                const shiftsByUser = {};
                shifts.forEach(s => {
                    if (!shiftsByUser[s.userId]) shiftsByUser[s.userId] = [];
                    shiftsByUser[s.userId].push(s);
                });
                res.json(users.map(u => ({
                    id: u.id, name: u.name, color: u.color, role: u.role,
                    shifts: shiftsByUser[u.id] || []
                })));
            }
        );
    });
});

app.get('/api/overview/vacation', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    db.all(`SELECT id, name, color, role, vacationDaysPerYear FROM users WHERE active = 1 ORDER BY name`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(
            `SELECT userId, startDate, endDate, status FROM absences WHERE type = 'vacation' AND startDate LIKE ?`,
            [`${year}-%`], (err2, absences) => {
                if (err2) return res.status(500).json({ error: err2.message });
                const usedByUser = {};
                const pendingByUser = {};
                absences.forEach(a => {
                    if (a.status === 'approved') usedByUser[a.userId] = (usedByUser[a.userId] || 0) + daysBetween(a.startDate, a.endDate);
                    if (a.status === 'pending') pendingByUser[a.userId] = (pendingByUser[a.userId] || 0) + 1;
                });
                res.json(users.map(u => ({
                    id: u.id, name: u.name, color: u.color, role: u.role,
                    total: u.vacationDaysPerYear,
                    used: usedByUser[u.id] || 0,
                    remaining: u.vacationDaysPerYear - (usedByUser[u.id] || 0),
                    pending: pendingByUser[u.id] || 0
                })));
            }
        );
    });
});

// Ganzjährige Zeitleiste (alle Ferien-Zeitr\u00e4ume, genehmigt + offen) f\u00fcr die Balkenansicht
app.get('/api/overview/vacation-timeline', requireAuth, requireTeamLeadOrAdmin, (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    db.all(`SELECT id, name, color FROM users WHERE active = 1 ORDER BY name`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        db.all(
            `SELECT userId, startDate, endDate, status FROM absences WHERE type = 'vacation' AND status IN ('approved', 'pending') AND startDate LIKE ?`,
            [`${year}-%`], (err2, absences) => {
                if (err2) return res.status(500).json({ error: err2.message });
                const rangesByUser = {};
                absences.forEach(a => {
                    if (!rangesByUser[a.userId]) rangesByUser[a.userId] = [];
                    rangesByUser[a.userId].push({ startDate: a.startDate, endDate: a.endDate, status: a.status });
                });
                res.json(users.map(u => ({ id: u.id, name: u.name, color: u.color, ranges: rangesByUser[u.id] || [] })));
            }
        );
    });
});

suitePing.start();
app.listen(PORT, () => {
    console.log(`AuraPlan läuft auf http://localhost:${PORT}`);
});
