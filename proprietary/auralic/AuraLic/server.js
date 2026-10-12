const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const AdmZip = require('adm-zip');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const session = require('express-session');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
const PORT = 3001;

// Läuft hinter Caddy (siehe docker-compose.yml) - nötig für korrekte IPs im Rate-Limiter
app.set('trust proxy', 1);

const LICENSE_SECRET = process.env.LICENSE_SECRET || '';
const AUTH_PASSWORD = process.env.LICENSE_SERVER_PASSWORD || ''; // Login "admin" - vollen Zugriff auf alles
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'); // ohne env-Wert: neuer Zufallswert pro Start (alle Sitzungen gehen bei Neustart verloren)

if (!LICENSE_SECRET) {
    console.warn('WARNUNG: LICENSE_SECRET ist nicht gesetzt - erzeugte Lizenzen werden von AuraChat-Instanzen nicht akzeptiert!');
}
if (!AUTH_PASSWORD) {
    console.error('FEHLER: LICENSE_SERVER_PASSWORD ist nicht gesetzt. Da dieser Server öffentlich erreichbar sein kann, werden ALLE Anfragen bis zur Konfiguration blockiert.');
}
if (!process.env.SESSION_SECRET) {
    console.warn('WARNUNG: SESSION_SECRET ist nicht gesetzt - alle Anmeldungen (Admin & Reseller) gehen bei jedem Neustart verloren. Für den Produktivbetrieb SESSION_SECRET setzen!');
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'html')));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' } // 30 Tage
}));

// Rate-Limiting gegen Brute-Force auf Login/Passwort (öffentlich erreichbar!)
// Nur den eigentlichen Login-Versuch begrenzen (Brute-Force-Schutz) - nicht die ganze
// Anwendung. War vorher versehentlich auf jede Anfrage angewendet, wodurch normale Nutzung
// (zwischen Reitern wechseln, Weltkarte laden, etc.) das Limit unbeabsichtigt erreichen konnte.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Zu viele Versuche. Bitte später erneut versuchen.'
});

// --- ANMELDUNG (Sitzungs-Login statt gemeinsames Passwort) ---
// Zwei Rollen: "superadmin" (Login "admin", volles Passwort aus LICENSE_SERVER_PASSWORD,
// sieht/verwaltet ALLES) und "reseller" (eigener Benutzername+Passwort, sieht NUR die
// eigenen Kunden/Lizenzen). "Fail closed": ohne konfiguriertes Passwort wird der
// Superadmin-Login blockiert, da dieser Server von aussen erreichbar sein kann.
// Ausnahme: /api/checkin - das rufen die AuraChat-Installationen selbst automatisiert
// auf, eigene Absicherung dort über die Signaturprüfung des Lizenzschlüssels selbst.
function requireAuth(req, res, next) {
    if (req.path === '/api/checkin') return next();
    if (req.session && req.session.role) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
    res.redirect('/login');
}
function requireSuperAdmin(req, res, next) {
    if (req.session && req.session.role === 'superadmin') return next();
    res.status(403).send(loginLayout('Kein Zugriff', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Nur für Administratoren. <a href="/" class="underline">Zurück</a></div>`));
}

function loginLayout(title, body) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} · AuraLic</title>
    <link rel="icon" type="image/png" href="/static/images/icon.png">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm">${body}</div>
</body>
</html>`;
}

app.get('/login', (req, res) => {
    if (req.session && req.session.role) return res.redirect('/');
    res.send(loginLayout('Anmelden', `
        <form method="POST" action="/login" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <div class="flex items-center gap-2 justify-center mb-2">
                <img src="/static/images/logo.png" alt="AuraLic" style="height:36px;width:auto;">
            </div>
            ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">Benutzername oder Passwort falsch.</div>` : ''}
            <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Benutzername</label>
                <input type="text" name="username" required autofocus class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            </div>
            <div>
                <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Passwort</label>
                <input type="password" name="password" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            </div>
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Anmelden</button>
        </form>
    `));
});

app.post('/login', authLimiter, async (req, res) => {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';

    if (username === 'admin') {
        if (!AUTH_PASSWORD) return res.status(503).send(loginLayout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Lizenz-Server ist nicht korrekt konfiguriert (LICENSE_SERVER_PASSWORD fehlt).</div>`));
        const storedHash = await getSetting('admin_password_hash');
        // Sobald einmal über "Passwort ändern" ein neues Passwort gesetzt wurde, gilt nur
        // noch dieses - das .env-Passwort bleibt sonst der Ausgangswert (falls nie geändert).
        const ok = storedHash ? await bcrypt.compare(password, storedHash).catch(() => false) : password === AUTH_PASSWORD;
        if (!ok) return res.redirect('/login?error=1');

        const twofaEnabled = (await getSetting('admin_twofa_enabled')) === 'true';
        if (twofaEnabled) {
            req.session.pending2fa = true;
            return res.redirect('/login/2fa');
        }
        req.session.role = 'superadmin';
        return res.redirect('/');
    }

    db.get(`SELECT * FROM resellers WHERE username = ? AND active = 1`, [username], async (err, reseller) => {
        if (err || !reseller) return res.redirect('/login?error=1');
        const match = await bcrypt.compare(password, reseller.passwordHash).catch(() => false);
        if (!match) return res.redirect('/login?error=1');
        req.session.role = 'reseller';
        req.session.resellerId = reseller.id;
        req.session.resellerName = reseller.name;
        req.session.discountPercent = reseller.discountPercent;
        res.redirect('/');
    });
});

app.get('/login/2fa', (req, res) => {
    if (!req.session.pending2fa) return res.redirect('/login');
    res.send(loginLayout('Anmeldung', `
        <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraLic" style="height:36px;width:auto;"></div>
        <form method="POST" action="/login/2fa" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
            <p class="text-xs text-slate-400 text-center">Code aus deiner Authenticator-App eingeben:</p>
            ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">Code ist falsch oder abgelaufen.</div>` : ''}
            <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required class="w-full text-center tracking-widest bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Bestätigen</button>
        </form>
    `));
});
app.post('/login/2fa', authLimiter, async (req, res) => {
    if (!req.session.pending2fa) return res.redirect('/login');
    const secret = await getSetting('admin_twofa_secret');
    const ok = secret && authenticator.verify({ token: String(req.body.code || '').trim(), secret });
    if (!ok) return res.redirect('/login/2fa?error=1');
    delete req.session.pending2fa;
    req.session.role = 'superadmin';
    res.redirect('/');
});

app.get('/2fa', requireSuperAdmin, async (req, res) => {
    const enabled = (await getSetting('admin_twofa_enabled')) === 'true';
    res.send(layout('2FA', `
        <h2 class="text-sm font-bold text-white mb-4">🛡️ Zwei-Faktor-Authentifizierung</h2>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg flex flex-col gap-4">
            ${enabled ? `
                <p class="text-sm text-emerald-400">✓ Aktiviert - beim Login wird zusätzlich ein Code verlangt.</p>
                <form method="POST" action="/2fa/disable"><button class="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20">Deaktivieren</button></form>
            ` : `
                <p class="text-xs text-slate-400">Noch nicht aktiviert. QR-Code mit einer Authenticator-App scannen (z.B. Google Authenticator), dann den 6-stelligen Code zur Bestätigung eingeben.</p>
                <form method="POST" action="/2fa/setup" class="flex flex-col items-center gap-3">
                    ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs w-full text-center">Code ist falsch. Neuen QR-Code laden und erneut versuchen.</div>` : ''}
                    <img src="/2fa/qr" alt="QR-Code" class="rounded-xl bg-white p-2">
                    <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required class="w-full max-w-xs text-center tracking-widest bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition px-6">Aktivieren</button>
                </form>
            `}
        </div>
    `, 'twofa', req.session));
});
app.get('/2fa/qr', requireSuperAdmin, async (req, res) => {
    let secret = req.session.pendingTwofaSecret;
    if (!secret) {
        secret = authenticator.generateSecret();
        req.session.pendingTwofaSecret = secret;
    }
    const otpauthUrl = authenticator.keyuri('admin', 'AuraLic', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    const img = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(img);
});
app.post('/2fa/setup', requireSuperAdmin, async (req, res) => {
    const secret = req.session.pendingTwofaSecret;
    const ok = secret && authenticator.verify({ token: String(req.body.code || '').trim(), secret });
    if (!ok) return res.redirect('/2fa?error=1');
    await setSetting('admin_twofa_secret', secret);
    await setSetting('admin_twofa_enabled', 'true');
    delete req.session.pendingTwofaSecret;
    res.redirect('/2fa');
});
app.post('/2fa/disable', requireSuperAdmin, async (req, res) => {
    await setSetting('admin_twofa_enabled', 'false');
    res.redirect('/2fa');
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
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

app.get('/change-password', requireSuperAdmin, (req, res) => {
    res.send(layout('Passwort ändern', `
        <div class="max-w-sm">
            <h2 class="text-base font-bold text-white mb-4">🔒 Admin-Passwort ändern</h2>
            <form method="POST" action="/change-password" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">${req.query.error === 'wrong' ? 'Aktuelles Passwort ist falsch.' : req.query.error === 'mismatch' ? 'Die beiden neuen Passwörter stimmen nicht überein.' : 'Neues Passwort muss mindestens 8 Zeichen lang sein.'}</div>` : ''}
                ${req.query.success ? `<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Passwort erfolgreich geändert.</div>` : ''}
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Aktuelles Passwort</label>
                    <input type="password" name="currentPassword" required autofocus class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Neues Passwort</label>
                    <input type="password" name="newPassword" required minlength="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Neues Passwort bestätigen</label>
                    <input type="password" name="newPasswordConfirm" required minlength="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Passwort ändern</button>
            </form>
        </div>
    `, 'change-password', req.session));
});

app.post('/change-password', requireSuperAdmin, async (req, res) => {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    const storedHash = await getSetting('admin_password_hash');
    const currentOk = storedHash ? await bcrypt.compare(currentPassword || '', storedHash).catch(() => false) : currentPassword === AUTH_PASSWORD;
    if (!currentOk) return res.redirect('/change-password?error=wrong');

    if (!newPassword || newPassword.length < 8) return res.redirect('/change-password?error=short');
    if (newPassword !== newPasswordConfirm) return res.redirect('/change-password?error=mismatch');

    const newHash = await bcrypt.hash(newPassword, 10);
    await setSetting('admin_password_hash', newHash);
    res.redirect('/change-password?success=1');
});

app.use(requireAuth);

// Verifiziert einen Lizenzschlüssel (gleiche Logik wie in AuraChat selbst) - für den
// Check-in-Endpunkt, um sicherzustellen, dass nur echte, unveränderte Schlüssel akzeptiert
// werden, nicht irgendein beliebiger Text.
function verifyLicenseKey(licenseKey) {
    try {
        const [payloadB64, signature] = (licenseKey || '').split('.');
        if (!payloadB64 || !signature) return { valid: false, error: 'Ungültiges Format.' };
        const expectedSignature = crypto.createHmac('sha256', LICENSE_SECRET).update(payloadB64).digest('base64url');
        if (signature !== expectedSignature) return { valid: false, error: 'Ungültige Signatur.' };
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        return { valid: true, payload };
    } catch (err) {
        return { valid: false, error: 'Konnte Lizenz nicht lesen.' };
    }
}

// Eigener, grosszügigerer Rate-Limiter fürs Check-in (kein Passwort-Brute-Force-Risiko,
// aber mehrere Installationen könnten hinter derselben IP/demselben NAT liegen)
const checkinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
});

// --- DATENBANK (Verlauf ausgestellter Lizenzen) ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'licenses.db'));

db.run(`CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer TEXT,
    features TEXT,
    issuedAt TEXT,
    expiresAt TEXT,
    licenseKey TEXT,
    maxUsers INTEGER,
    maxAdmins INTEGER,
    product TEXT NOT NULL DEFAULT 'aurachat'
)`);
db.run(`ALTER TABLE licenses ADD COLUMN product TEXT NOT NULL DEFAULT 'aurachat'`, () => {});

db.run(`CREATE TABLE IF NOT EXISTS resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    passwordHash TEXT,
    discountPercent REAL DEFAULT 20,
    contactEmail TEXT,
    active INTEGER DEFAULT 1,
    createdAt TEXT
)`);

// Einfache Ein-Zeilen-Einstellungstabelle - aktuell nur für die "neueste bekannte
// AuraChat-Version" genutzt, um veraltete Installationen markieren zu können.
db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

// Jede Installation, die sich per Check-in meldet - mit oder ohne Lizenz (licenseId bleibt
// dann leer). Getrennt von "licenses", weil eine Installation nicht zwingend eine Lizenz
// hat, und eine Lizenz theoretisch auf mehreren Installationen eingespielt sein könnte.
db.run(`CREATE TABLE IF NOT EXISTS installations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    installationId TEXT UNIQUE,
    licenseId INTEGER,
    ip TEXT,
    country TEXT,
    city TEXT,
    lat REAL,
    lon REAL,
    lastSeen TEXT,
    version TEXT,
    totalUsers INTEGER,
    totalAdmins INTEGER,
    manualLocation TEXT,
    manualLat REAL,
    manualLon REAL
)`);

// Migration für Lizenz-Server-Datenbanken, die vor den Nutzer-Obergrenzen bzw. vor
// Kosten-Tracking, Check-ins und dem Reseller-Modus erzeugt wurden
db.all(`PRAGMA table_info(licenses)`, [], (err, columns) => {
    if (err) return console.error('Konnte Tabellen-Info nicht lesen:', err.message);
    const existing = columns.map(c => c.name);
    const newColumns = {
        maxUsers: 'INTEGER', maxAdmins: 'INTEGER',
        pricePerUser: 'REAL', pricePerAdmin: 'REAL',
        hostingType: 'TEXT', cloudMonthlyFee: 'REAL',
        customerEmail: 'TEXT',
        lastCheckin: 'TEXT', lastTotalUsers: 'INTEGER', lastTotalAdmins: 'INTEGER', lastVersion: 'TEXT',
        contactPerson: 'TEXT', street: 'TEXT', zip: 'TEXT', city: 'TEXT', country: 'TEXT',
        billingDifferent: 'INTEGER', billingStreet: 'TEXT', billingZip: 'TEXT', billingCity: 'TEXT', billingCountry: 'TEXT',
        resellerId: 'INTEGER'
    };
    Object.entries(newColumns).forEach(([col, type]) => {
        if (!existing.includes(col)) {
            db.run(`ALTER TABLE licenses ADD COLUMN ${col} ${type}`, (alterErr) => {
                if (alterErr) console.error(`Migration fehlgeschlagen für Spalte "${col}":`, alterErr.message);
                else console.log(`Migration: Spalte "${col}" zu licenses hinzugefügt.`);
            });
        }
    });
});

// Migration für installations-Tabellen aus einer früheren Version ohne manuellen
// Standort-Override
db.all(`PRAGMA table_info(installations)`, [], (err, columns) => {
    if (err) return console.error('Konnte Tabellen-Info nicht lesen:', err.message);
    const existing = columns.map(c => c.name);
    const newColumns = { manualLocation: 'TEXT', manualLat: 'REAL', manualLon: 'REAL' };
    Object.entries(newColumns).forEach(([col, type]) => {
        if (!existing.includes(col)) {
            db.run(`ALTER TABLE installations ADD COLUMN ${col} ${type}`, (alterErr) => {
                if (alterErr) console.error(`Migration fehlgeschlagen für Spalte "${col}":`, alterErr.message);
                else console.log(`Migration: Spalte "${col}" zu installations hinzugefügt.`);
            });
        }
    });
});

// Berechnet die geschätzten laufenden Kosten pro Monat aus einer Lizenz-Zeile.
// null bei maxUsers/maxAdmins (= unbegrenzt) macht eine Berechnung unmöglich - dann wird
// "individuell" zurückgegeben statt einer falschen Zahl.
function calcMonthlyCost(row) {
    if (row.maxUsers === null || row.maxAdmins === null || row.pricePerUser === null || row.pricePerAdmin === null) {
        return null; // individuell / nicht berechenbar
    }
    const usersCost = (row.maxUsers || 0) * (row.pricePerUser || 0);
    const adminsCost = (row.maxAdmins || 0) * (row.pricePerAdmin || 0);
    const cloudCost = row.hostingType === 'cloud' ? (row.cloudMonthlyFee || 0) : 0;
    return usersCost + adminsCost + cloudCost;
}

function formatChf(n) {
    return n === null ? 'individuell' : `CHF ${n.toFixed(2)}`;
}

// Einfacher Versionsvergleich für "x.y.z"- oder "x.y"-Stile (auch die "1.00"-Schreibweise) -
// reicht für "ist älter als die aktuell bekannte Version", kein vollwertiges Semver nötig.
function isVersionOlder(installed, latest) {
    if (!installed || !latest) return false;
    const a = String(installed).split('.').map(n => parseInt(n, 10) || 0);
    const b = String(latest).split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x < y) return true;
        if (x > y) return false;
    }
    return false;
}

// --- Aura-Suite-Version: wird in jeder Installation unter "Über Aura-Suite" angezeigt (Abgleich alle 12 Stunden) ---
// Dieselbe Zahl ("latest_version") steuert auch die Markierung "veraltet" bei den Kunden. Dazu kommen das Datum ("Stand") und ein kurzer Hinweis.
// Alles wird streng geprüft: Die Installationen zeigen es an, ohne es zu hinterfragen.
const SUITE_VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/;
function isSuiteDate(v) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return false; const d = new Date(v + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === v; }
const cleanSuiteNote = (v) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
const escSuite = (v) => String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Liefert { version, date, note } oder null, wenn keine (gültige) Version gesetzt ist
function readSuite() {
    return new Promise((resolve) => db.all(`SELECT key, value FROM settings WHERE key IN ('latest_version', 'latest_version_date', 'latest_version_note')`, [], (err, rows) => {
        if (err) return resolve(null);
        const m = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
        const version = String(m.latest_version || '').trim(); if (!SUITE_VERSION_RE.test(version)) return resolve(null);
        resolve({ version, date: isSuiteDate(m.latest_version_date) ? m.latest_version_date : null, note: cleanSuiteNote(m.latest_version_note) });
    }));
}

// Eigene Richtpreise (Endkundenpreis) je Lizenzstufe - nur zur Anzeige/Orientierung für
// Reseller, keine feste Regel. Bei Änderungen an den echten Preisen (Datenblatt/Webseite)
// hier mit nachziehen.
const LIST_PRICES = {
    pro: { user: 4.00, admin: 9.00 },
    academy: { user: 7.00, admin: 15.00 }
};

const AVAILABLE_FEATURES = [
    { id: 'ssl', label: 'SSL-Verwaltung (Domain & Zertifikate)' },
    { id: 'chat_bg', label: 'Chat-Hintergrundbild' },
    { id: 'tts_stt', label: 'Eigener TTS/STT-Server' },
    { id: 'api_access', label: 'Externe API für andere Plattformen' },
    { id: 'avatar', label: 'Avatar ändern (Galerie & eigener Upload)' },
    { id: 'integrations', label: 'Integrationen (Smart-Home-Geräte & eigene Anwendungen)' },
    { id: 'image_gen', label: 'Bildgenerierung (eigener Server)' },
    { id: 'coding_model', label: 'Separates Coding-Modell (eigener Server)' },
    { id: 'study_report', label: 'Lernprotokoll (druckbares PDF aus Chat)' },
    { id: 'dual_model', label: 'Zweitmodell zur Genauigkeitsprüfung' },
    { id: 'email', label: 'E-Mail-Integration (IMAP oder Microsoft 365)' },
    { id: 'academy', label: 'Aura-Academy (experimentelles Nebenmodell-Training, im Backend integriert)' },
    { id: 'rebrand', label: 'Eigenes Logo/Icon (Rebranding für Wiederverkäufer)' },
    { id: 'telephony', label: 'Telefonanlagen-Anbindung (Asterisk/3CX über offene API)' }
];

const AVAILABLE_PRODUCTS = [
    { id: 'aurachat', label: 'AuraChat' },
    { id: 'auraplan', label: 'AuraPlan' },
    { id: 'auradirect', label: 'AuraDirect' },
    { id: 'auramail', label: 'AuraMail' },
    { id: 'auraticket', label: 'AuraTicket' },
    { id: 'auraproxy', label: 'AuraProxy' },
    { id: 'auracall', label: 'AuraCall' }
];

function generateLicenseKey(customer, features, expiresAt, maxUsers, maxAdmins, product) {
    // Bewusst OHNE Preisinfos im signierten Payload - das geht die einzelne AuraChat-
    // Installation nichts an, das ist reine Buchhaltung hier auf dem Lizenz-Server.
    const payload = {
        customer,
        product: product || 'aurachat',
        features,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
        maxUsers: maxUsers === null ? null : maxUsers,
        maxAdmins: maxAdmins === null ? null : maxAdmins
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', LICENSE_SECRET).update(payloadB64).digest('base64url');
    return `${payloadB64}.${signature}`;
}

function layout(title, body, activeNav, session) {
    const isSuperAdmin = session && session.role === 'superadmin';
    const isReseller = session && session.role === 'reseller';
    return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} · AuraLic</title>
    <link rel="icon" type="image/png" href="/static/images/icon.png">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-6">
    <div class="max-w-4xl mx-auto flex flex-col gap-6">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <img src="/static/images/logo.png" alt="AuraLic" style="height:36px;width:auto;">
                ${isReseller ? `<span class="text-xs text-slate-500 ml-1">· ${session.resellerName} (Reseller)</span>` : ''}
            </div>
            <nav class="flex gap-2 text-xs items-center">
                <a href="/" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'home' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">Lizenz erzeugen</a>
                <a href="/customers" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'customers' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">👥 Kunden</a>
                ${isSuperAdmin ? `<a href="/resellers" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'resellers' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🤝 Reseller</a>` : ''}
                ${isSuperAdmin ? `<a href="/world-map" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'world-map' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🌍 Weltkarte</a>` : ''}
                ${isSuperAdmin ? `<a href="/change-password" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'change-password' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🔒 Passwort</a>` : ''}
                ${isSuperAdmin ? `<a href="/2fa" class="px-3 py-1.5 rounded-lg transition ${activeNav === 'twofa' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🛡️ 2FA</a>` : ''}
                <form method="POST" action="/logout" class="ml-1"><button type="submit" class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition">Abmelden</button></form>
            </nav>
        </div>
        ${body}
    </div>
</body>
</html>`;
}

// --- Formular + Verlauf ---
app.get('/', (req, res) => {
    const isReseller = req.session.role === 'reseller';
    const productFilter = AVAILABLE_PRODUCTS.some(p => p.id === req.query.product) ? req.query.product : null;
    const filterClause = productFilter ? `AND l.product = ?` : '';
    const historyQuery = isReseller
        ? `SELECT l.*, r.name AS resellerName FROM licenses l LEFT JOIN resellers r ON r.id = l.resellerId WHERE l.resellerId = ? ${filterClause} ORDER BY l.id DESC LIMIT 50`
        : `SELECT l.*, r.name AS resellerName FROM licenses l LEFT JOIN resellers r ON r.id = l.resellerId WHERE 1=1 ${filterClause} ORDER BY l.id DESC LIMIT 50`;
    const historyParams = isReseller
        ? (productFilter ? [req.session.resellerId, productFilter] : [req.session.resellerId])
        : (productFilter ? [productFilter] : []);

    db.all(historyQuery, historyParams, (err, rows) => {
        const productTabs = `
            <div class="flex gap-1.5 text-xs mb-2">
                <a href="/" class="px-3 py-1.5 rounded-lg ${!productFilter ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">Alle</a>
                ${AVAILABLE_PRODUCTS.map(p => `<a href="/?product=${p.id}" class="px-3 py-1.5 rounded-lg ${productFilter === p.id ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">${p.label}</a>`).join('')}
            </div>`;
        const history = (rows || []).map(r => {
            const features = JSON.parse(r.features || '[]');
            const limitsText = `${r.maxUsers ?? 'unbegrenzt'} Nutzer, ${r.maxAdmins ?? 'unbegrenzt'} Admins`;
            const productLabel = AVAILABLE_PRODUCTS.find(p => p.id === r.product)?.label || r.product || 'AuraChat';
            return `
                <div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <div class="flex flex-col min-w-0">
                        <span class="text-sm font-semibold text-white truncate">${r.customer} <span class="text-[10px] font-normal text-slate-400 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5 ml-1">${productLabel}</span> ${r.resellerName ? `<span class="text-[10px] font-normal text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5 ml-1">${r.resellerName}</span>` : ''}</span>
                        <span class="text-xs text-slate-500">${r.product === 'aurachat' || !r.product ? features.join(', ') + ' · ' : ''}${limitsText} · ausgestellt ${new Date(r.issuedAt).toLocaleDateString('de-DE')} · gültig bis ${r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('de-DE') : 'unbegrenzt'}</span>
                    </div>
                    <a href="/download/${r.id}" class="text-xs text-blue-400 hover:text-blue-300 shrink-0 ml-3">⬇️ .lic</a>
                </div>`;
        }).join('') || '<div class="text-sm text-slate-500">Noch keine Lizenzen ausgestellt.</div>';

        const featureCheckboxes = AVAILABLE_FEATURES.map(f => `
            <label class="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" name="features" value="${f.id}" class="rounded">
                <span class="text-sm text-slate-200">${f.label}</span>
            </label>
        `).join('');

        function renderForm(resellerOptionsHtml) {
            const resellerPricingBox = isReseller ? `
                <div class="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300">
                    Eure Konditionen: <span class="font-semibold">${req.session.discountPercent}% Rabatt</span> auf die Richtpreise ·
                    Pro: CHF ${(LIST_PRICES.pro.user * (1 - req.session.discountPercent / 100)).toFixed(2)} / ${(LIST_PRICES.pro.admin * (1 - req.session.discountPercent / 100)).toFixed(2)} ·
                    Academy: CHF ${(LIST_PRICES.academy.user * (1 - req.session.discountPercent / 100)).toFixed(2)} / ${(LIST_PRICES.academy.admin * (1 - req.session.discountPercent / 100)).toFixed(2)}
                    <div class="text-blue-400/70 mt-1">Das ist euer Einkaufspreis - was ihr eurem Endkunden unten als "Preis pro Benutzer/Administrator" in Rechnung stellt, bestimmt ihr frei.</div>
                </div>` : '';

            res.send(layout('Neue Lizenz erzeugen', `
            <form method="POST" action="/generate" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <h2 class="text-sm font-bold text-white">Neue Lizenz erzeugen</h2>
                ${resellerPricingBox}
                ${resellerOptionsHtml || ''}
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Produkt</label>
                    <select name="product" id="product-select" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        ${AVAILABLE_PRODUCTS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kunde / Firma</label>
                    <input type="text" name="customer" required placeholder="z.B. Firma XY" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kontakt-E-Mail (optional)</label>
                    <input type="email" name="customerEmail" placeholder="ansprechpartner@firma.ch" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>

                <div class="border-t border-slate-800 pt-3 flex flex-col gap-3">
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider -mb-1">📍 Adresse</label>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Verantwortliche Person</label>
                        <input type="text" name="contactPerson" placeholder="Vor- und Nachname" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Strasse & Nr.</label>
                        <input type="text" name="street" placeholder="Musterstrasse 12" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">PLZ</label>
                            <input type="text" name="zip" placeholder="5330" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div class="col-span-2">
                            <label class="block text-[11px] text-slate-500 mb-1">Ort</label>
                            <input type="text" name="city" placeholder="Bad Zurzach" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Land</label>
                        <input type="text" name="country" placeholder="Schweiz" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>

                    <label class="flex items-center gap-2 text-sm text-slate-200 mt-1">
                        <input type="checkbox" id="billing-toggle" name="billingDifferent" value="1">
                        Abweichende Rechnungsadresse
                    </label>
                    <div id="billing-fields" class="hidden flex-col gap-3 bg-slate-950/50 border border-slate-800 rounded-xl p-3">
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Strasse & Nr. (Rechnung)</label>
                            <input type="text" name="billingStreet" placeholder="Musterstrasse 12" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-slate-500 mb-1">PLZ</label>
                                <input type="text" name="billingZip" placeholder="5330" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-[11px] text-slate-500 mb-1">Ort</label>
                                <input type="text" name="billingCity" placeholder="Bad Zurzach" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Land (Rechnung)</label>
                            <input type="text" name="billingCountry" placeholder="Schweiz" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                    </div>
                </div>

                <div id="features-section">
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Features</label>
                    <button type="button" id="select-all-features-btn" class="text-[11px] text-blue-400 hover:text-blue-300 mb-2 cursor-pointer">Alle auswählen</button>
                    <div class="flex flex-col gap-2">${featureCheckboxes}</div>
                </div>
                <div id="auraplan-license-note" class="hidden bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-300">
                    AuraPlan/AuraDirect kennen keine einzelnen Premium-Features - hier zählt nur, ob überhaupt eine gültige, nicht abgelaufene Lizenz vorliegt.
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Gültig bis (optional, leer = unbegrenzt)</label>
                    <input type="date" name="expires" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Max. Benutzer (leer = unbegrenzt)</label>
                        <input type="number" min="0" name="maxUsers" placeholder="unbegrenzt" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Max. Administratoren (leer = unbegrenzt)</label>
                        <input type="number" min="0" name="maxAdmins" placeholder="unbegrenzt" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>
                <div class="border-t border-slate-800 pt-3 flex flex-col gap-3">
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider -mb-1">💰 Kosten (nur für die Kundenübersicht hier, nicht Teil der Lizenz selbst)</label>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Preis pro Benutzer / Monat (CHF)</label>
                            <input type="number" min="0" step="0.01" name="pricePerUser" placeholder="z.B. 4.00" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Preis pro Administrator / Monat (CHF)</label>
                            <input type="number" min="0" step="0.01" name="pricePerAdmin" placeholder="z.B. 9.00" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Hosting</label>
                        <div class="flex gap-3">
                            <label class="flex items-center gap-1.5 text-sm text-slate-200"><input type="radio" name="hostingType" value="self-hosted" checked> Self-Hosted</label>
                            <label class="flex items-center gap-1.5 text-sm text-slate-200"><input type="radio" name="hostingType" value="cloud"> Cloud</label>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Cloud-Grundgebühr / Monat (CHF, nur falls Cloud)</label>
                        <input type="number" min="0" step="0.01" name="cloudMonthlyFee" placeholder="z.B. 29.00" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>
                <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Lizenz erzeugen</button>
            </form>
            <script>
                document.getElementById('select-all-features-btn').addEventListener('click', () => {
                    document.querySelectorAll('input[name="features"]').forEach(cb => cb.checked = true);
                });
                const productSelect = document.getElementById('product-select');
                const featuresSection = document.getElementById('features-section');
                const auraplanNote = document.getElementById('auraplan-license-note');
                function applyProductVisibility() {
                    const isAurachat = productSelect.value === 'aurachat';
                    featuresSection.classList.toggle('hidden', !isAurachat);
                    auraplanNote.classList.toggle('hidden', isAurachat);
                }
                productSelect.addEventListener('change', applyProductVisibility);
                applyProductVisibility();
                const billingToggle = document.getElementById('billing-toggle');
                const billingFields = document.getElementById('billing-fields');
                billingToggle.addEventListener('change', () => {
                    billingFields.classList.toggle('hidden', !billingToggle.checked);
                    billingFields.classList.toggle('flex', billingToggle.checked);
                });
            </script>

            <div class="flex flex-col gap-2">
                <h2 class="text-sm font-bold text-white">Verlauf (letzte 50)</h2>
                ${productTabs}
                <div class="flex flex-col gap-2">${history}</div>
            </div>

            ${isSuperAdminForBackup ? `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <h2 class="text-sm font-bold text-white">💾 Backup & Wiederherstellung</h2>
                <div class="flex flex-col gap-2">
                    <p class="text-xs text-slate-500">Sichert alle bisher ausgestellten Lizenzen und Reseller-Konten als .zip-Datei - praktisch für Migrationen oder falls mal etwas kaputtgeht.</p>
                    <a href="/backup" class="inline-block text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Backup herunterladen</a>
                </div>
                <div class="border-t border-slate-800 pt-4 flex flex-col gap-2">
                    <p class="text-xs text-amber-300">⚠️ Ersetzt alle aktuell gespeicherten Lizenzen durch den Inhalt der hochgeladenen Datei. Server startet danach neu. Nicht rückgängig zu machen.</p>
                    <form method="POST" action="/backup/restore" enctype="multipart/form-data" class="flex flex-col gap-2">
                        <input type="file" name="backup" accept=".zip" required class="w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-2">
                        <button type="submit" onclick="return confirm('Wirklich wiederherstellen? Alle aktuellen Lizenzen werden ersetzt.');" class="bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Wiederherstellen</button>
                    </form>
                </div>
            </div>` : ''}
        `, 'home', req.session));
        }

        const isSuperAdminForBackup = req.session.role === 'superadmin';

        if (req.session.role === 'superadmin') {
            db.all(`SELECT id, name FROM resellers WHERE active = 1 ORDER BY name`, [], (resErr, resellers) => {
                const options = (resellers || []).map(r => `<option value="${r.id}">${r.name}</option>`).join('');
                renderForm(`
                    <div>
                        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Reseller (optional)</label>
                        <select name="resellerId" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                            <option value="">Direktkunde (kein Reseller)</option>
                            ${options}
                        </select>
                    </div>
                `);
            });
        } else {
            renderForm('');
        }
    });
});

// --- Lizenz erzeugen ---
app.post('/generate', (req, res) => {
    const product = AVAILABLE_PRODUCTS.some(p => p.id === req.body.product) ? req.body.product : 'aurachat';
    const customer = (req.body.customer || '').trim();
    const customerEmail = (req.body.customerEmail || '').trim();
    const contactPerson = (req.body.contactPerson || '').trim();
    const street = (req.body.street || '').trim();
    const zip = (req.body.zip || '').trim();
    const city = (req.body.city || '').trim();
    const country = (req.body.country || '').trim();
    const billingDifferent = req.body.billingDifferent ? 1 : 0;
    const billingStreet = billingDifferent ? (req.body.billingStreet || '').trim() : '';
    const billingZip = billingDifferent ? (req.body.billingZip || '').trim() : '';
    const billingCity = billingDifferent ? (req.body.billingCity || '').trim() : '';
    const billingCountry = billingDifferent ? (req.body.billingCountry || '').trim() : '';
    // AuraPlan/AuraDirect kennen keine einzelnen Premium-Features - dort zählt nur "lizenziert
    // ja/nein", daher hier ein fixer Marker statt der AuraChat-Feature-Checkboxen.
    const features = product === 'aurachat'
        ? (Array.isArray(req.body.features) ? req.body.features : (req.body.features ? [req.body.features] : []))
        : ['licensed'];
    const expiresAt = req.body.expires ? new Date(req.body.expires).toISOString() : null;

    function parseLimit(value) {
        if (value === undefined || value === null || value === '') return null;
        const n = parseInt(value, 10);
        return (isNaN(n) || n < 0) ? null : n;
    }
    function parsePrice(value) {
        if (value === undefined || value === null || value === '') return null;
        const n = parseFloat(value);
        return (isNaN(n) || n < 0) ? null : n;
    }
    const maxUsers = parseLimit(req.body.maxUsers);
    const maxAdmins = parseLimit(req.body.maxAdmins);
    const pricePerUser = parsePrice(req.body.pricePerUser);
    const pricePerAdmin = parsePrice(req.body.pricePerAdmin);
    const hostingType = req.body.hostingType === 'cloud' ? 'cloud' : 'self-hosted';
    const cloudMonthlyFee = hostingType === 'cloud' ? parsePrice(req.body.cloudMonthlyFee) : null;
    // Reseller: immer die eigene ID (kann nicht für andere Reseller Lizenzen erzeugen).
    // Superadmin: aus dem Dropdown, leer = Direktkunde.
    const resellerId = req.session.role === 'reseller'
        ? req.session.resellerId
        : (req.body.resellerId ? parseInt(req.body.resellerId, 10) : null);

    if (!customer || (product === 'aurachat' && features.length === 0)) {
        return res.status(400).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Kunde und mindestens ein Feature sind erforderlich. <a href="/" class="underline">Zurück</a></div>`, null, req.session));
    }
    if (!LICENSE_SECRET) {
        return res.status(500).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">LICENSE_SECRET ist auf dem Lizenz-Server nicht konfiguriert. <a href="/" class="underline">Zurück</a></div>`, null, req.session));
    }

    const licenseKey = generateLicenseKey(customer, features, expiresAt, maxUsers, maxAdmins, product);
    const monthlyCost = calcMonthlyCost({ maxUsers, maxAdmins, pricePerUser, pricePerAdmin, hostingType, cloudMonthlyFee });

    db.run(
        `INSERT INTO licenses (customer, customerEmail, features, issuedAt, expiresAt, licenseKey, maxUsers, maxAdmins, pricePerUser, pricePerAdmin, hostingType, cloudMonthlyFee, contactPerson, street, zip, city, country, billingDifferent, billingStreet, billingZip, billingCity, billingCountry, resellerId, product)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [customer, customerEmail, JSON.stringify(features), new Date().toISOString(), expiresAt, licenseKey, maxUsers, maxAdmins, pricePerUser, pricePerAdmin, hostingType, cloudMonthlyFee, contactPerson, street, zip, city, country, billingDifferent, billingStreet, billingZip, billingCity, billingCountry, resellerId, product],
        function (err) {
            if (err) {
                return res.status(500).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Speichern fehlgeschlagen: ${err.message}</div>`, null, req.session));
            }
            const productLabel = AVAILABLE_PRODUCTS.find(p => p.id === product)?.label || product;
            res.send(layout('Lizenz erzeugt', `
                <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col gap-3">
                    <h2 class="text-sm font-bold text-emerald-300">✓ ${productLabel}-Lizenz erzeugt für "${customer}"</h2>
                    <div class="text-xs text-slate-400">${product === 'aurachat' ? `Features: ${features.join(', ')} · ` : ''}Gültig bis: ${expiresAt ? new Date(expiresAt).toLocaleDateString('de-DE') : 'unbegrenzt'} · Max. Benutzer: ${maxUsers ?? 'unbegrenzt'} · Max. Admins: ${maxAdmins ?? 'unbegrenzt'}</div>
                    <div class="text-xs text-slate-400">Geschätzte Kosten: <span class="text-white font-semibold">${formatChf(monthlyCost)}${monthlyCost !== null ? ' / Monat' : ''}</span> · Hosting: ${hostingType === 'cloud' ? 'Cloud' : 'Self-Hosted'}</div>
                    <textarea readonly rows="4" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono resize-none" onclick="this.select()">${licenseKey}</textarea>
                    <div class="flex gap-2">
                        <a href="/download/${this.lastID}" class="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-xl text-xs transition">⬇️ Als .lic-Datei herunterladen</a>
                        <a href="/" class="flex-1 text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-2 rounded-xl text-xs transition">Weitere Lizenz erzeugen</a>
                    </div>
                </div>
            `, 'home', req.session));
        }
    );
});

// --- .lic-Datei herunterladen ---
app.get('/download/:id', (req, res) => {
    db.get(`SELECT * FROM licenses WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).send('Lizenz nicht gefunden.');
        // Reseller dürfen nur ihre eigenen Lizenzen herunterladen
        if (req.session.role === 'reseller' && row.resellerId !== req.session.resellerId) {
            return res.status(403).send('Kein Zugriff auf diese Lizenz.');
        }
        const filename = `${row.customer.replace(/[^a-z0-9]/gi, '_')}.lic`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'text/plain');
        res.send(row.licenseKey);
    });
});

// --- Backup & Wiederherstellung (nur Superadmin - betrifft ALLE Reseller/Kunden) ---
app.get('/backup', requireSuperAdmin, (req, res) => {
    const tmpDbPath = path.join(dataDir, `backup-tmp-${Date.now()}.db`);
    db.run(`VACUUM INTO ?`, [tmpDbPath], (err) => {
        if (err) return res.status(500).send('Backup fehlgeschlagen: ' + err.message);
        try {
            const zip = new AdmZip();
            zip.addLocalFile(tmpDbPath, '', 'licenses.db');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="aurachat-license-backup-${timestamp}.zip"`
            });
            res.send(zip.toBuffer());
        } catch (zipErr) {
            res.status(500).send('Backup fehlgeschlagen: ' + zipErr.message);
        } finally {
            fs.unlink(tmpDbPath, () => {});
        }
    });
});

app.post('/backup/restore', requireSuperAdmin, upload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Keine Datei hochgeladen. <a href="/" class="underline">Zurück</a></div>`, null, req.session));
    try {
        const zip = new AdmZip(req.file.buffer);
        const dbEntry = zip.getEntry('licenses.db');
        if (!dbEntry) return res.status(400).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Diese Datei enthält keine licenses.db - ist das wirklich ein Lizenz-Server-Backup? <a href="/" class="underline">Zurück</a></div>`, null, req.session));

        fs.writeFileSync(path.join(dataDir, 'licenses.db'), dbEntry.getData());
        res.send(layout('Wiederhergestellt', `<div class="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-sm text-emerald-300">✓ Wiederhergestellt. Server startet jetzt neu... <a href="/" class="underline text-white">Nach ein paar Sekunden hier zurück</a></div>`, null, req.session));
        console.log('Backup wiederhergestellt - Prozess wird für einen sauberen Neustart beendet.');
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Wiederherstellung fehlgeschlagen: ${err.message}</div>`, null, req.session));
    }
});

// --- Kundenübersicht: aktuelle Lizenz je Kunde, geschätzte Kosten, Check-in-Status ---
app.get('/customers', (req, res) => {
    const isReseller = req.session.role === 'reseller';
    const query = isReseller
        ? `SELECT l.*, r.name AS resellerName FROM licenses l LEFT JOIN resellers r ON r.id = l.resellerId WHERE l.resellerId = ? ORDER BY l.id DESC`
        : `SELECT l.*, r.name AS resellerName FROM licenses l LEFT JOIN resellers r ON r.id = l.resellerId ORDER BY l.id DESC`;
    const params = isReseller ? [req.session.resellerId] : [];

    db.all(`SELECT key, value FROM settings WHERE key IN ('latest_version', 'latest_version_date', 'latest_version_note')`, [], (verErr, verRows) => {
    const sv = Object.fromEntries((verRows || []).map((r) => [r.key, r.value]));
    const latestVersion = sv.latest_version || '', latestDate = sv.latest_version_date || '', latestNote = sv.latest_version_note || '';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).send('Fehler: ' + err.message);

        // Neueste Lizenz je Kunde (Verlauf ist nach id DESC sortiert, erstes Vorkommen gewinnt)
        const latestByCustomer = new Map();
        (rows || []).forEach(r => {
            if (!latestByCustomer.has(r.customer)) latestByCustomer.set(r.customer, r);
        });
        const customers = Array.from(latestByCustomer.values());

        const now = Date.now();
        const CHECKIN_ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000; // 48h
        const activeCount = customers.filter(c => c.lastCheckin && (now - new Date(c.lastCheckin).getTime()) < CHECKIN_ACTIVE_WINDOW_MS).length;
        const totalMonthly = customers.reduce((sum, c) => {
            const cost = calcMonthlyCost(c);
            return sum + (cost || 0);
        }, 0);
        const hasIndividual = customers.some(c => calcMonthlyCost(c) === null);

        const rowsHtml = customers.map(c => {
            const features = JSON.parse(c.features || '[]');
            const cost = calcMonthlyCost(c);
            const isActive = c.lastCheckin && (now - new Date(c.lastCheckin).getTime()) < CHECKIN_ACTIVE_WINDOW_MS;
            const isOutdated = isVersionOlder(c.lastVersion, latestVersion);
            const checkinText = c.lastCheckin
                ? `${isActive ? '🟢' : '⚪'} zuletzt gesehen ${new Date(c.lastCheckin).toLocaleString('de-DE')} (${c.lastTotalUsers ?? '-'} Nutzer, ${c.lastTotalAdmins ?? '-'} Admins, v${c.lastVersion || '?'}${isOutdated ? ` <span class="text-amber-400">— Update verfügbar (v${latestVersion})</span>` : ''})`
                : '⚪ noch kein Check-in';
            return `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-sm font-semibold text-white">${c.customer} ${c.resellerName ? `<span class="text-[10px] font-normal text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-full px-2 py-0.5 ml-1">${c.resellerName}</span>` : ''}</div>
                            ${c.contactPerson ? `<div class="text-xs text-slate-400">${c.contactPerson}</div>` : ''}
                            ${c.customerEmail ? `<div class="text-xs text-slate-500">${c.customerEmail}</div>` : ''}
                            ${(c.street || c.city) ? `<div class="text-xs text-slate-500">${[c.street, [c.zip, c.city].filter(Boolean).join(' '), c.country].filter(Boolean).join(', ')}</div>` : ''}
                            ${c.billingDifferent ? `<div class="text-[11px] text-amber-400/80 mt-1">📄 Rechnung an: ${[c.billingStreet, [c.billingZip, c.billingCity].filter(Boolean).join(' '), c.billingCountry].filter(Boolean).join(', ')}</div>` : ''}
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-base font-bold text-white">${formatChf(cost)}${cost !== null ? '<span class="text-xs font-normal text-slate-500"> /Mt.</span>' : ''}</div>
                            <div class="text-[10px] text-slate-500 uppercase tracking-wider">${c.hostingType === 'cloud' ? 'Cloud' : 'Self-Hosted'}</div>
                            <a href="/customers/${c.id}/edit" class="text-[10px] text-blue-400 hover:text-blue-300">✏️ Bearbeiten</a>
                        </div>
                    </div>
                    <div class="text-xs text-slate-400">${features.join(', ')}</div>
                    <div class="text-xs text-slate-500">Max. ${c.maxUsers ?? 'unbegrenzt'} Nutzer, ${c.maxAdmins ?? 'unbegrenzt'} Admins · gültig bis ${c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('de-DE') : 'unbegrenzt'}</div>
                    <div class="text-xs ${isActive ? 'text-emerald-400' : 'text-slate-500'} pt-1 border-t border-slate-800 mt-1">${checkinText}</div>
                </div>`;
        }).join('') || '<div class="text-sm text-slate-500">Noch keine Kunden vorhanden.</div>';

        res.send(layout('Kunden', `
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Kunden</div>
                    <div class="text-2xl font-bold text-white">${customers.length}</div>
                </div>
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Aktive Installationen (48h)</div>
                    <div class="text-2xl font-bold text-emerald-400">${activeCount}</div>
                </div>
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">${isReseller ? 'Eure Einnahmen / Monat' : 'Geschätzte Einnahmen / Monat'}</div>
                    <div class="text-2xl font-bold text-white">CHF ${totalMonthly.toFixed(2)}${hasIndividual ? '<span class="text-xs font-normal text-slate-500"> +individuell</span>' : ''}</div>
                </div>
            </div>
            ${!isReseller ? `
            <div id="suite-version-card" class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3">
                <div class="flex items-center gap-2">
                    <h3 class="text-sm font-bold text-white">🏷️ Aura-Suite-Version</h3>
                    <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">${latestVersion ? 'aktuell: v' + escSuite(latestVersion) : 'nicht gesetzt'}</span>
                </div>
                <p class="text-[11px] text-slate-500">Diese Angaben erscheinen in jeder Installation unter „Über Aura-Suite“ und werden beim nächsten Abgleich (alle 12 Stunden) übernommen. Installationen mit einer älteren Version werden unten als „veraltet“ markiert. Die Version leer lassen und speichern schaltet die Anzeige ab.</p>
                <form method="POST" action="/settings/latest-version" class="flex flex-wrap items-end gap-3">
                    <label class="flex flex-col gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Version
                        <input type="text" name="latestVersion" value="${escSuite(latestVersion)}" placeholder="z. B. 2.1.0" maxlength="14" pattern="[0-9]{1,4}\\.[0-9]{1,4}(\\.[0-9]{1,4})?" title="Zahlen mit Punkten, z. B. 1.00 oder 2.1.0" class="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white w-28 normal-case font-normal focus:outline-none focus:border-blue-500">
                    </label>
                    <label class="flex flex-col gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Stand
                        <input type="date" name="suiteDate" value="${escSuite(latestDate)}" class="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white normal-case font-normal focus:outline-none focus:border-blue-500">
                    </label>
                    <label class="flex flex-col gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-1" style="min-width:200px">Hinweis (optional, höchstens 120 Zeichen)
                        <input type="text" name="suiteNote" value="${escSuite(latestNote)}" maxlength="120" placeholder="z. B. Neu: AuraCall und Docker-Hub-Installation" class="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white normal-case font-normal focus:outline-none focus:border-blue-500">
                    </label>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg transition">Speichern</button>
                </form>
            </div>` : ''}
            <div class="grid gap-3">${rowsHtml}</div>
        `, 'customers', req.session));
    });
    });
});

app.post('/settings/latest-version', requireSuperAdmin, (req, res) => {
    const version = String((req.body && req.body.latestVersion) || '').trim(), dateIn = String((req.body && req.body.suiteDate) || '').trim(), note = cleanSuiteNote(req.body && req.body.suiteNote);
    const fail = (msg) => res.status(400).send(layout('Aura-Suite-Version', `<div class="bg-slate-900 border border-red-500/40 rounded-2xl p-5 text-sm text-red-300">${msg}<div class="mt-3"><a href="/customers" class="text-blue-400">← Zurück</a></div></div>`, 'customers', req.session));
    if (!req.body || req.body.latestVersion === undefined) return fail('Die Eingabe fehlt (das Feld "Version" wurde nicht mitgeschickt). Es wurde nichts geändert.');   // nur ein leeres Feld schaltet die Anzeige ab, nie ein fehlendes
    if (version && !SUITE_VERSION_RE.test(version)) return fail('Die Version ist ungültig. Erlaubt sind z. B. 1.00, 2.1 oder 2.1.0 (nur Zahlen und Punkte).');
    if (dateIn && !isSuiteDate(dateIn)) return fail('Das Datum ist ungültig.');
    // Ohne Version ist die Anzeige abgeschaltet (alles leer). Ohne Datum gilt heute.
    const values = version ? [['latest_version', version], ['latest_version_date', dateIn || new Date().toISOString().slice(0, 10)], ['latest_version_note', note]] : [['latest_version', ''], ['latest_version_date', ''], ['latest_version_note', '']];
    Promise.all(values.map(([k, v]) => new Promise((resolve, reject) => db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [k, v], (err) => (err ? reject(err) : resolve())))))
        .then(() => res.redirect('/customers'))
        .catch((err) => res.status(500).send('Speichern fehlgeschlagen: ' + err.message));
});

// --- Kunde bearbeiten (Adresse/Kontakt/Preise - NICHT die Lizenz selbst, dafür einfach
// eine neue Lizenz erzeugen). Reseller dürfen nur ihre eigenen Kunden bearbeiten.
app.get('/customers/:id/edit', (req, res) => {
    db.get(`SELECT * FROM licenses WHERE id = ?`, [req.params.id], (err, c) => {
        if (err || !c) return res.status(404).send('Nicht gefunden.');
        if (req.session.role === 'reseller' && c.resellerId !== req.session.resellerId) {
            return res.status(403).send('Kein Zugriff auf diesen Kunden.');
        }
        const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        res.send(layout('Kunde bearbeiten', `
            <form method="POST" action="/customers/${c.id}/edit" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                <h2 class="text-sm font-bold text-white">"${c.customer}" bearbeiten</h2>
                <p class="text-xs text-slate-500 -mt-2">Ändert nur Adresse/Kontakt/Preise dieses Eintrags - Features, Obergrenzen und der Lizenzschlüssel selbst bleiben unverändert. Für andere Features/Obergrenzen stattdessen eine neue Lizenz erzeugen.</p>

                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kunde / Firma</label>
                    <input type="text" name="customer" required value="${esc(c.customer)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kontakt-E-Mail</label>
                    <input type="email" name="customerEmail" value="${esc(c.customerEmail)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[11px] text-slate-500 mb-1">Verantwortliche Person</label>
                    <input type="text" name="contactPerson" value="${esc(c.contactPerson)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-[11px] text-slate-500 mb-1">Strasse & Nr.</label>
                    <input type="text" name="street" value="${esc(c.street)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">PLZ</label>
                        <input type="text" name="zip" value="${esc(c.zip)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-[11px] text-slate-500 mb-1">Ort</label>
                        <input type="text" name="city" value="${esc(c.city)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] text-slate-500 mb-1">Land</label>
                    <input type="text" name="country" value="${esc(c.country)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>

                <div class="border-t border-slate-800 pt-3 grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Preis pro Benutzer / Monat (CHF)</label>
                        <input type="number" min="0" step="0.01" name="pricePerUser" value="${esc(c.pricePerUser)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                    <div>
                        <label class="block text-[11px] text-slate-500 mb-1">Preis pro Administrator / Monat (CHF)</label>
                        <input type="number" min="0" step="0.01" name="pricePerAdmin" value="${esc(c.pricePerAdmin)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] text-slate-500 mb-1">Hosting</label>
                    <div class="flex gap-3">
                        <label class="flex items-center gap-1.5 text-sm text-slate-200"><input type="radio" name="hostingType" value="self-hosted" ${c.hostingType !== 'cloud' ? 'checked' : ''}> Self-Hosted</label>
                        <label class="flex items-center gap-1.5 text-sm text-slate-200"><input type="radio" name="hostingType" value="cloud" ${c.hostingType === 'cloud' ? 'checked' : ''}> Cloud</label>
                    </div>
                </div>
                <div>
                    <label class="block text-[11px] text-slate-500 mb-1">Cloud-Grundgebühr / Monat (CHF, nur falls Cloud)</label>
                    <input type="number" min="0" step="0.01" name="cloudMonthlyFee" value="${esc(c.cloudMonthlyFee)}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>

                <div class="flex gap-2 mt-2">
                    <button type="submit" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Speichern</button>
                    <a href="/customers" class="flex-1 text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium py-2.5 rounded-xl text-sm transition">Abbrechen</a>
                </div>
            </form>
        `, 'customers', req.session));
    });
});

app.post('/customers/:id/edit', (req, res) => {
    db.get(`SELECT resellerId FROM licenses WHERE id = ?`, [req.params.id], (err, existing) => {
        if (err || !existing) return res.status(404).send('Nicht gefunden.');
        if (req.session.role === 'reseller' && existing.resellerId !== req.session.resellerId) {
            return res.status(403).send('Kein Zugriff auf diesen Kunden.');
        }

        function parsePrice(value) {
            if (value === undefined || value === null || value === '') return null;
            const n = parseFloat(value);
            return (isNaN(n) || n < 0) ? null : n;
        }
        const hostingType = req.body.hostingType === 'cloud' ? 'cloud' : 'self-hosted';

        db.run(
            `UPDATE licenses SET customer = ?, customerEmail = ?, contactPerson = ?, street = ?, zip = ?, city = ?, country = ?,
             pricePerUser = ?, pricePerAdmin = ?, hostingType = ?, cloudMonthlyFee = ? WHERE id = ?`,
            [
                (req.body.customer || '').trim(), (req.body.customerEmail || '').trim(), (req.body.contactPerson || '').trim(),
                (req.body.street || '').trim(), (req.body.zip || '').trim(), (req.body.city || '').trim(), (req.body.country || '').trim(),
                parsePrice(req.body.pricePerUser), parsePrice(req.body.pricePerAdmin), hostingType,
                hostingType === 'cloud' ? parsePrice(req.body.cloudMonthlyFee) : null,
                req.params.id
            ],
            (updateErr) => {
                if (updateErr) return res.status(500).send('Speichern fehlgeschlagen: ' + updateErr.message);
                res.redirect('/customers');
            }
        );
    });
});

// --- Reseller-Verwaltung (nur Superadmin) ---
app.get('/resellers', requireSuperAdmin, (req, res) => {
    db.all(
        `SELECT r.*, COUNT(l.id) AS customerCount
         FROM resellers r LEFT JOIN licenses l ON l.resellerId = r.id
         GROUP BY r.id ORDER BY r.createdAt DESC`,
        [], (err, resellers) => {
            if (err) return res.status(500).send('Fehler: ' + err.message);

            const rowsHtml = (resellers || []).map(r => `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4 ${!r.active ? 'opacity-50' : ''}">
                    <div>
                        <div class="text-sm font-semibold text-white">${r.name} ${!r.active ? '<span class="text-[10px] text-red-400 ml-1">(deaktiviert)</span>' : ''}</div>
                        <div class="text-xs text-slate-500">Login: <span class="text-slate-300">${r.username}</span> · ${r.discountPercent}% Rabatt · ${r.customerCount} Kunde${r.customerCount === 1 ? '' : 'n'} ${r.contactEmail ? `· ${r.contactEmail}` : ''}</div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button type="button" onclick="document.getElementById('reset-pw-${r.id}').classList.toggle('hidden')" class="text-xs text-blue-400 hover:text-blue-300 px-2 cursor-pointer">🔑 Passwort</button>
                        <form method="POST" action="/resellers/${r.id}/toggle-active">
                            <button type="submit" class="text-xs ${r.active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'} px-2 cursor-pointer">${r.active ? 'Deaktivieren' : 'Aktivieren'}</button>
                        </form>
                    </div>
                </div>
                <form id="reset-pw-${r.id}" method="POST" action="/resellers/${r.id}/reset-password" class="hidden flex gap-2 -mt-2 mb-1 px-1">
                    <input type="password" name="password" required minlength="8" placeholder="Neues Passwort (min. 8 Zeichen)" class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 rounded-lg transition">Setzen</button>
                </form>
            `).join('') || '<div class="text-sm text-slate-500">Noch keine Reseller angelegt.</div>';

            res.send(layout('Reseller', `
                <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                    <h2 class="text-sm font-bold text-white">Neuen Reseller anlegen</h2>
                    <form method="POST" action="/resellers" class="grid grid-cols-2 gap-3">
                        <div class="col-span-2">
                            <label class="block text-[11px] text-slate-500 mb-1">Firmenname</label>
                            <input type="text" name="name" required placeholder="z.B. IT-Partner AG" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Login-Benutzername</label>
                            <input type="text" name="username" required pattern="[a-zA-Z0-9_.-]+" placeholder="z.B. it-partner" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Passwort</label>
                            <input type="password" name="password" required minlength="8" placeholder="min. 8 Zeichen" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Rabatt (%)</label>
                            <input type="number" name="discountPercent" min="0" max="90" step="1" value="20" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <div>
                            <label class="block text-[11px] text-slate-500 mb-1">Kontakt-E-Mail (optional)</label>
                            <input type="email" name="contactEmail" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                        </div>
                        <button type="submit" class="col-span-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Reseller anlegen</button>
                    </form>
                </div>
                <div class="flex flex-col gap-3">
                    <h2 class="text-sm font-bold text-white">Bestehende Reseller</h2>
                    ${rowsHtml}
                </div>
            `, 'resellers', req.session));
        }
    );
});

app.post('/resellers', requireSuperAdmin, async (req, res) => {
    const name = (req.body.name || '').trim();
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const discountPercent = Math.min(90, Math.max(0, parseFloat(req.body.discountPercent) || 0));
    const contactEmail = (req.body.contactEmail || '').trim();

    if (!name || !username || password.length < 8) {
        return res.status(400).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">Name, Benutzername und ein Passwort (min. 8 Zeichen) sind erforderlich. <a href="/resellers" class="underline">Zurück</a></div>`, null, req.session));
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.run(
        `INSERT INTO resellers (name, username, passwordHash, discountPercent, contactEmail, active, createdAt) VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [name, username, passwordHash, discountPercent, contactEmail, new Date().toISOString()],
        (err) => {
            if (err) {
                const msg = err.message.includes('UNIQUE') ? 'Dieser Benutzername ist schon vergeben.' : err.message;
                return res.status(400).send(layout('Fehler', `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 text-sm">${msg} <a href="/resellers" class="underline">Zurück</a></div>`, null, req.session));
            }
            res.redirect('/resellers');
        }
    );
});

app.post('/resellers/:id/reset-password', requireSuperAdmin, async (req, res) => {
    const password = req.body.password || '';
    if (password.length < 8) return res.redirect('/resellers');
    const passwordHash = await bcrypt.hash(password, 12);
    db.run(`UPDATE resellers SET passwordHash = ? WHERE id = ?`, [passwordHash, req.params.id], () => res.redirect('/resellers'));
});

app.post('/resellers/:id/toggle-active', requireSuperAdmin, (req, res) => {
    db.get(`SELECT active FROM resellers WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) return res.redirect('/resellers');
        db.run(`UPDATE resellers SET active = ? WHERE id = ?`, [row.active ? 0 : 1, req.params.id], () => res.redirect('/resellers'));
    });
});

// --- Check-in: ruft eine laufende AuraChat-Installation selbst automatisiert auf, KEIN
// Passwort nötig (siehe Auth-Middleware oben) - stattdessen wird die Signatur des
// mitgeschickten Lizenzschlüssels geprüft, damit nicht irgendjemand beliebige Zahlen
// einschleusen kann.
// Grobe Standortbestimmung per IP über einen kostenlosen Dienst (kein API-Key nötig) -
// nur für die Anzeige auf der Weltkarte gedacht, keine präzise Ortung. Interne/private
// IPs (z.B. wenn kein Reverse Proxy die echte Adresse durchreicht) liefern kein Ergebnis -
// die Installation zählt dann zwar mit, erscheint aber nicht auf der Karte.
async function geolocateIp(rawIp) {
    // Node liefert IPv4-Adressen über einen IPv6-Dual-Stack-Socket oft als
    // "::ffff:1.2.3.4" statt nur "1.2.3.4" - ohne dieses Entfernen würde der
    // Filter für private Adressen (10.x/172.16-31.x/192.168.x) sie nicht erkennen
    // und unnötig (und erfolglos) beim externen Ortungsdienst nachfragen.
    const ip = (rawIp || '').replace(/^::ffff:/, '');
    if (!ip || ip === '::1' || ip === '127.0.0.1' || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return null;
    try {
        const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city,lat,lon`, { signal: AbortSignal.timeout(5000) });
        const data = await resp.json();
        if (data.status !== 'success') return null;
        return { country: data.country, city: data.city, lat: data.lat, lon: data.lon };
    } catch {
        return null;
    }
}

// Für den manuellen Standort-Override: wandelt einen frei eingegebenen Ortsnamen
// (z.B. "Bad Zurzach, Schweiz") in Koordinaten um - kostenloser Geocoding-Dienst von
// OpenStreetMap, kein API-Key nötig. Eigener User-Agent gemäss deren Nutzungsbedingungen.
async function geocodeLocationName(name) {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`, {
        headers: { 'User-Agent': 'AuraChat-License-Server/1.0' },
        signal: AbortSignal.timeout(8000)
    });
    const results = await resp.json();
    if (!results || results.length === 0) throw new Error('Ort nicht gefunden.');
    return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

app.post('/api/checkin', checkinLimiter, async (req, res) => {
    const { licenseKey, installationId, totalUsers, totalAdmins, version } = req.body || {};
    if (!licenseKey && !installationId) return res.status(400).json({ error: 'licenseKey oder installationId ist erforderlich.' });

    let licenseId = null;
    if (licenseKey) {
        const result = verifyLicenseKey(licenseKey);
        if (!result.valid) return res.status(401).json({ error: 'Ungültiger Lizenzschlüssel.' });

        const row = await new Promise((resolve) => db.get(`SELECT id FROM licenses WHERE licenseKey = ?`, [licenseKey], (e, r) => resolve(r)));
        if (!row) return res.status(404).json({ error: 'Dieser Lizenzschlüssel ist auf diesem Server nicht bekannt.' });
        licenseId = row.id;

        db.run(
            `UPDATE licenses SET lastCheckin = ?, lastTotalUsers = ?, lastTotalAdmins = ?, lastVersion = ? WHERE id = ?`,
            [new Date().toISOString(), totalUsers ?? null, totalAdmins ?? null, (version || '').slice(0, 30), licenseId]
        );
    }

    // installationId ist die stabile Kennung für die installations-Tabelle - falls eine
    // lizenzierte Installation (noch) keine mitschickt (ältere AuraChat-Version), fällt
    // das auf den Lizenzschlüssel selbst zurück, damit trotzdem EIN Eintrag entsteht.
    const stableId = installationId || `license:${licenseKey}`;
    const ip = (req.ip || '').replace(/^::ffff:/, ''); // siehe geolocateIp() - Node liefert IPv4 oft als "::ffff:x.x.x.x"
    const geo = await geolocateIp(ip);
    const suite = await readSuite();   // Aura-Suite-Version für "Über Aura-Suite" in der Installation (leer, wenn keine gesetzt ist)

    db.run(
        `INSERT INTO installations (installationId, licenseId, ip, country, city, lat, lon, lastSeen, version, totalUsers, totalAdmins)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(installationId) DO UPDATE SET
            licenseId = excluded.licenseId, ip = excluded.ip,
            country = COALESCE(excluded.country, installations.country), city = COALESCE(excluded.city, installations.city),
            lat = COALESCE(excluded.lat, installations.lat), lon = COALESCE(excluded.lon, installations.lon),
            lastSeen = excluded.lastSeen, version = excluded.version, totalUsers = excluded.totalUsers, totalAdmins = excluded.totalAdmins`,
        [stableId, licenseId, ip, geo && geo.country, geo && geo.city, geo && geo.lat, geo && geo.lon,
         new Date().toISOString(), (version || '').slice(0, 30), totalUsers ?? null, totalAdmins ?? null],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(suite ? { ok: true, suite } : { ok: true });
        }
    );
});

// --- Weltkarte: alle Installationen, die sich je gemeldet haben (mit oder ohne Lizenz) ---
app.get('/api/installations-map-data', requireSuperAdmin, (req, res) => {
    db.all(`SELECT i.*, l.customer FROM installations i LEFT JOIN licenses l ON l.id = i.licenseId ORDER BY i.lastSeen DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const now = Date.now();
        const ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;
        res.json({
            installations: (rows || []).map(r => ({
                id: r.id,
                lat: r.manualLat ?? r.lat, lon: r.manualLon ?? r.lon,
                isManual: r.manualLat !== null && r.manualLat !== undefined,
                manualLocation: r.manualLocation,
                country: r.country, city: r.city,
                customer: r.customer || null, licensed: !!r.licenseId,
                version: r.version, totalUsers: r.totalUsers, totalAdmins: r.totalAdmins,
                lastSeen: r.lastSeen, active: r.lastSeen && (now - new Date(r.lastSeen).getTime()) < ACTIVE_WINDOW_MS
            }))
        });
    });
});

app.post('/api/installations/:id/location', requireSuperAdmin, async (req, res) => {
    const locationName = (req.body.locationName || '').trim();
    if (!locationName) return res.status(400).json({ error: 'Ortsname ist erforderlich.' });
    try {
        const coords = await geocodeLocationName(locationName);
        db.run(`UPDATE installations SET manualLocation = ?, manualLat = ?, manualLon = ? WHERE id = ?`,
            [locationName, coords.lat, coords.lon, req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, lat: coords.lat, lon: coords.lon });
            });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/installations/:id/location', requireSuperAdmin, (req, res) => {
    db.run(`UPDATE installations SET manualLocation = NULL, manualLat = NULL, manualLon = NULL WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/world-map', requireSuperAdmin, (req, res) => {
    res.send(layout('Weltkarte', `
        <div id="map-stats" class="grid grid-cols-4 gap-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Installationen gesamt</div>
                <div id="stat-total" class="text-2xl font-bold text-white">–</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Aktiv (48h)</div>
                <div id="stat-active" class="text-2xl font-bold text-emerald-400">–</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Mit Lizenz</div>
                <div id="stat-licensed" class="text-2xl font-bold text-blue-400">–</div>
            </div>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div class="text-xs text-slate-500 uppercase tracking-wider mb-1">Ohne Lizenz</div>
                <div id="stat-unlicensed" class="text-2xl font-bold text-slate-400">–</div>
            </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <div id="map" style="height: 480px; border-radius: 12px;"></div>
        </div>
        <p class="text-[11px] text-slate-500">Standort grob per IP-Adresse geschätzt (Stadt-Ebene, nicht exakt) - Installationen, deren Standort nicht automatisch bestimmt werden konnte (z.B. rein interne Netzwerke), zählen in der Statistik oben mit, erscheinen aber ohne manuellen Standort nicht als Punkt auf der Karte. 🔵 lizenziert · ⚪ ohne Lizenz · Grösse des Punktes = aktiv (48h) oder nicht. ✋ = manuell gesetzter Standort.</p>

        <div class="flex flex-col gap-2">
            <h2 class="text-sm font-bold text-white">Alle Installationen</h2>
            <div id="installations-list" class="flex flex-col gap-2"></div>
        </div>

        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            let installationsData = [];

            function loadInstallations() {
                fetch('/api/installations-map-data', { credentials: 'include' })
                    .then(r => r.json())
                    .then(data => {
                        installationsData = data.installations || [];
                        renderStats();
                        renderMap();
                        renderList();
                    })
                    .catch(() => { document.getElementById('stat-total').textContent = 'Fehler'; });
            }

            function renderStats() {
                const list = installationsData;
                document.getElementById('stat-total').textContent = list.length;
                document.getElementById('stat-active').textContent = list.filter(i => i.active).length;
                document.getElementById('stat-licensed').textContent = list.filter(i => i.licensed).length;
                document.getElementById('stat-unlicensed').textContent = list.filter(i => !i.licensed).length;
            }

            let leafletMap = null;
            function renderMap() {
                if (!leafletMap) {
                    leafletMap = L.map('map', { worldCopyJump: true }).setView([20, 10], 2);
                    // Reines OpenStreetMap statt eines kommerziellen Anbieters - bleibt
                    // schlüsselfrei. Der CSS-Filter dreht die Farben um für ein dunkles
                    // Aussehen passend zum restlichen Lizenz-Server.
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap-Mitwirkende',
                        maxZoom: 18
                    }).addTo(leafletMap);
                    document.querySelector('#map .leaflet-tile-pane').style.filter = 'invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9)';
                }
                (leafletMap._markerLayer ? leafletMap._markerLayer.clearLayers() : (leafletMap._markerLayer = L.layerGroup().addTo(leafletMap)));

                installationsData.filter(i => i.lat && i.lon).forEach(i => {
                    const color = i.licensed ? '#3270FD' : '#94A3B8';
                    const marker = L.circleMarker([i.lat, i.lon], {
                        radius: i.active ? 8 : 5,
                        fillColor: color, color: i.isManual ? '#FBBF24' : color, weight: i.isManual ? 2 : 1, fillOpacity: i.active ? 0.85 : 0.4
                    });
                    marker.bindPopup(
                        '<b>' + (i.customer || (i.licensed ? 'Lizenziert' : 'Ohne Lizenz')) + '</b><br>' +
                        (i.isManual ? '✋ ' + i.manualLocation : (i.city ? i.city + ', ' : '') + (i.country || '')) + '<br>' +
                        'v' + (i.version || '?') + ' · ' + (i.totalUsers ?? '-') + ' Nutzer<br>' +
                        'zuletzt gesehen: ' + new Date(i.lastSeen).toLocaleString('de-DE')
                    );
                    leafletMap._markerLayer.addLayer(marker);
                });
            }

            function renderList() {
                const container = document.getElementById('installations-list');
                container.innerHTML = '';
                installationsData.forEach(i => {
                    const row = document.createElement('div');
                    row.className = 'bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3';
                    const locationLabel = i.isManual ? ('✋ ' + i.manualLocation) : (i.lat ? ((i.city ? i.city + ', ' : '') + (i.country || '')) : 'Standort unbekannt');
                    row.innerHTML =
                        '<div class="min-w-0">' +
                            '<div class="text-xs font-semibold text-white truncate">' + (i.customer || (i.licensed ? 'Lizenziert (kein Kundenname)' : 'Ohne Lizenz')) + '</div>' +
                            '<div class="text-[11px] text-slate-500">' + locationLabel + ' · v' + (i.version || '?') + ' · zuletzt ' + new Date(i.lastSeen).toLocaleDateString('de-DE') + '</div>' +
                        '</div>' +
                        '<div class="flex gap-1.5 shrink-0 items-center">' +
                            '<input type="text" placeholder="Ort eingeben, z.B. Bad Zurzach, Schweiz" class="loc-input bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white w-52">' +
                            '<button class="loc-save-btn bg-blue-600 hover:bg-blue-500 text-white text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer">Setzen</button>' +
                            (i.isManual ? '<button class="loc-clear-btn text-red-400 hover:text-red-300 text-[11px] px-1.5 cursor-pointer">✕</button>' : '') +
                        '</div>';
                    row.querySelector('.loc-save-btn').addEventListener('click', () => {
                        const val = row.querySelector('.loc-input').value.trim();
                        if (!val) return;
                        fetch('/api/installations/' + i.id + '/location', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ locationName: val })
                        }).then(r => r.json()).then(res => {
                            if (res.error) { alert('Fehler: ' + res.error); return; }
                            loadInstallations();
                        });
                    });
                    const clearBtn = row.querySelector('.loc-clear-btn');
                    if (clearBtn) clearBtn.addEventListener('click', () => {
                        fetch('/api/installations/' + i.id + '/location', { method: 'DELETE', credentials: 'include' })
                            .then(() => loadInstallations());
                    });
                    container.appendChild(row);
                });
            }

            loadInstallations();
        </script>
    `, 'world-map', req.session));
});

app.listen(PORT, () => {
    console.log(`AuraChat Lizenz-Server läuft auf http://localhost:${PORT}`);
});
