const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const AdmZip = require('adm-zip');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const crypto = require('crypto');
const ldap = require('ldapjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'html')));

const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const AUTH_PASSWORD = process.env.AURADIRECT_ADMIN_PASSWORD || ''; // Login "admin" - voller Zugriff
// Dienst-Schlüssel: schützt /api/auth/validate davor, dass irgendein beliebiges Programm
// im Netzwerk Passwörter gegen AuraDirect durchprobieren kann. Wird beim allerersten Start
// automatisch erzeugt und in der Datenbank gespeichert (kein manuelles openssl-Kommando
// nötig) - in AuraChat/AuraPlan einfach den unten in der Oberfläche angezeigten Wert
// hineinkopieren. Wer lieber einen eigenen Wert vorgeben möchte, kann das weiterhin über
// die Umgebungsvariable AURADIRECT_SERVICE_KEY tun (hat Vorrang, falls gesetzt).
let SERVICE_KEY = process.env.AURADIRECT_SERVICE_KEY || '';

if (!SESSION_SECRET) console.error('WARNUNG: SESSION_SECRET ist nicht gesetzt.');
if (!process.env.LICENSE_SECRET) console.error('WARNUNG: LICENSE_SECRET ist nicht gesetzt - Lizenzprüfung kann nicht funktionieren. Muss in .env denselben Wert wie beim Lizenz-Server (LICENSE_SECRET) haben.');
if (!AUTH_PASSWORD) console.error('WARNUNG: AURADIRECT_ADMIN_PASSWORD ist nicht gesetzt.');

app.use(session({
    secret: SESSION_SECRET || 'unsicher-bitte-env-setzen',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 12 * 60 * 60 * 1000 }
}));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Zu viele Versuche. Bitte später erneut versuchen.' } });

const DEFAULT_PRIVACY_POLICY = `# Datenschutzerklärung

AuraDirect verwaltet zentral Benutzerkonten für AuraChat und AuraPlan und speichert dazu:

- Vor- und Nachname, Benutzername, E-Mail-Adresse
- Bei lokal angelegten Konten: ein sicher gehashtes Passwort (nie im Klartext)
- Bei per Active Directory verbundenen Konten: KEIN Passwort - die Anmeldung wird live
  gegen euer eigenes Active Directory geprüft, nie bei AuraDirect gespeichert
- Welche Rolle eine Person in welchem angebundenen Produkt (AuraChat, AuraPlan) hat
- Bei aktivierter Zwei-Faktor-Authentifizierung: ein Geheimnis zur Code-Prüfung

Diese Daten werden ausschliesslich auf dem Server eures Unternehmens gespeichert und nicht an Dritte weitergegeben. Bei Fragen wendet euch an eure Administrator:innen.`;

const validateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Zu viele Versuche.' } });

// --- Datenbank ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'auradirect.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
    else console.log('Mit AuraDirect-Datenbank verbunden.');
});
db.run('PRAGMA journal_mode = WAL;');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT,
        firstname TEXT NOT NULL DEFAULT '',
        lastname TEXT NOT NULL DEFAULT '',
        email TEXT,
        source TEXT NOT NULL DEFAULT 'local',
        active INTEGER NOT NULL DEFAULT 1,
        twofa_secret TEXT,
        twofa_enabled INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    // Migration von bereits bestehenden Installationen mit dem alten, einzelnen "name"-Feld -
    // schlägt harmlos fehl (und wird ignoriert), falls schon umgestellt.
    db.run(`ALTER TABLE users ADD COLUMN firstname TEXT NOT NULL DEFAULT ''`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN lastname TEXT NOT NULL DEFAULT ''`, () => {});
    db.run(`UPDATE users SET firstname = name WHERE firstname = '' AND name IS NOT NULL`, () => {});
    // Das alte "name"-Feld selbst wird nie entfernt worden sein - blockiert seither jedes
    // Neuanlegen einer Person, da es NOT NULL ist, aber von keiner aktuellen Stelle im Code
    // mehr befüllt wird ("SQLITE_CONSTRAINT: NOT NULL constraint failed: users.name").
    db.run(`ALTER TABLE users DROP COLUMN name`, () => {}); // schlägt harmlos fehl, falls schon entfernt oder nie vorhanden
    db.run(`ALTER TABLE users ADD COLUMN twofa_secret TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN twofa_enabled INTEGER NOT NULL DEFAULT 0`, () => {});
    db.run(`CREATE TABLE IF NOT EXISTS product_access (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        product TEXT NOT NULL,
        role TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        UNIQUE(userId, product),
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

    // Verfolgt, welche Produkte sich tatsächlich schon einmal ERFOLGREICH über den
    // Dienst-Schlüssel bei AuraDirect angemeldet haben (nicht nur behauptet, sondern
    // durch einen echten, funktionierenden Anmelde-Vorgang nachgewiesen) - Grundlage für
    // die "kostenlos, sobald 2 andere Aura-Produkte verbunden sind"-Regel.
    db.run(`CREATE TABLE IF NOT EXISTS connected_products (
        product TEXT PRIMARY KEY,
        lastSeenAt TEXT NOT NULL
    )`);
});

function getSetting(key) {
    return new Promise((resolve) => db.get(`SELECT value FROM settings WHERE key = ?`, [key], (err, row) => resolve(row ? row.value : null)));
}
function setSetting(key, value) {
    return new Promise((resolve, reject) => db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [key, value], (err) => err ? reject(err) : resolve()));
}

// Dienst-Schlüssel beim allerersten Start automatisch erzeugen, falls weder per
// Umgebungsvariable vorgegeben noch schon einmal in der Datenbank erzeugt.
(async () => {
    if (SERVICE_KEY) { await setSetting('service_key', SERVICE_KEY); return; }
    const stored = await getSetting('service_key');
    if (stored) { SERVICE_KEY = stored; return; }
    SERVICE_KEY = require('crypto').randomBytes(32).toString('hex');
    await setSetting('service_key', SERVICE_KEY);
    console.log('Neuer Dienst-Schlüssel automatisch erzeugt - im Admin Panel unter "Benutzer" sichtbar.');
})();

async function getAdConfig() {
    const keys = ['ad_enabled', 'ad_url', 'ad_bind_dn', 'ad_bind_password', 'ad_base_dn', 'ad_user_filter', 'ad_username_attr'];
    const values = await Promise.all(keys.map(getSetting));
    const cfg = {};
    keys.forEach((k, i) => { cfg[k] = values[i]; });
    cfg.ad_enabled = cfg.ad_enabled === 'true';
    cfg.ad_username_attr = cfg.ad_username_attr || 'sAMAccountName';
    cfg.ad_user_filter = cfg.ad_user_filter || '(objectClass=user)';
    return cfg;
}

// --- LDAP/Active-Directory-Hilfsfunktionen ---
function ldapSearchUser(cfg, username) {
    return new Promise((resolve, reject) => {
        const client = ldap.createClient({ url: cfg.ad_url, timeout: 8000, connectTimeout: 8000 });
        client.on('error', (err) => reject(err));
        client.bind(cfg.ad_bind_dn, cfg.ad_bind_password, (err) => {
            if (err) { client.destroy(); return reject(new Error('Dienstkonto-Anmeldung fehlgeschlagen: ' + err.message)); }
            const opts = { filter: `(&${cfg.ad_user_filter}(${cfg.ad_username_attr}=${username}))`, scope: 'sub' };
            const entries = [];
            client.search(cfg.ad_base_dn, opts, (err, res) => {
                if (err) { client.destroy(); return reject(err); }
                res.on('searchEntry', (entry) => entries.push(entry.pojo || entry.object));
                res.on('error', (err) => { client.destroy(); reject(err); });
                res.on('end', () => { client.unbind(); resolve(entries[0] || null); });
            });
        });
    });
}
function ldapBindAs(url, dn, password) {
    return new Promise((resolve, reject) => {
        const client = ldap.createClient({ url, timeout: 8000, connectTimeout: 8000 });
        client.on('error', (err) => reject(err));
        client.bind(dn, password, (err) => {
            client.unbind();
            if (err) return reject(err);
            resolve(true);
        });
    });
}
function attrValue(entry, name) {
    if (!entry) return null;
    const attrs = entry.attributes || [];
    const found = attrs.find(a => a.type === name);
    return found && found.values ? found.values[0] : (entry[name] || null);
}
async function authenticateAgainstAd(cfg, username, password) {
    const entry = await ldapSearchUser(cfg, username);
    if (!entry) return { valid: false };
    const dn = entry.objectName || entry.dn;
    await ldapBindAs(cfg.ad_url, dn, password); // wirft bei falschem Passwort
    return {
        valid: true,
        firstname: attrValue(entry, 'givenName') || username,
        lastname: attrValue(entry, 'sn') || '',
        email: attrValue(entry, 'mail') || null
    };
}

// --- Login (eigenes AuraDirect-Admin-Panel, Superadmin) ---
// --- LIZENZMANAGEMENT ---
// Gleiches Format/Verfahren wie bei AuraChat/AuraPlan: offline per HMAC-SHA256 geprüfter
// Schlüssel, kein Feature-System - nur "gültige, für 'auradirect' ausgestellte Lizenz
// vorhanden?".
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
    if (payload.product !== 'auradirect') return { valid: false, error: 'Diese Lizenz ist nicht für AuraDirect ausgestellt.' };
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
        return { valid: false, error: 'Lizenz ist abgelaufen.', payload };
    }
    return { valid: true, payload };
}
const TRIAL_DAYS = 14;
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
// Dauerhafte Gratis-Stufe (wie bei AuraChat): bis zu 4 aktive verwaltete Konten insgesamt
// laufen für immer kostenlos (entspricht "3 Nutzer + 1 Admin" - AuraDirect selbst kennt aber
// keine Admin/Nutzer-Unterscheidung für die verwalteten Konten, nur die eine feste
// Superadmin-Anmeldung, daher hier die Gesamtzahl statt getrennter Zählung).
function isWithinFreeTier() {
    return new Promise((resolve) => {
        db.get(`SELECT COUNT(*) as c FROM users WHERE active = 1`, [], (err, row) => {
            resolve(!err && row && row.c <= 4);
        });
    });
}

// Zeichnet auf, dass sich ein Produkt gerade ECHT (über einen funktionierenden Anmelde-
// Vorgang, nicht nur behauptet) bei AuraDirect gemeldet hat - Grundlage für die Regel
// "kostenlos, sobald mindestens 2 andere Aura-Produkte verbunden sind".
function recordProductConnection(product) {
    if (!['aurachat', 'auraplan'].includes(product)) return; // nur bekannte Produkte zählen
    db.run(
        `INSERT INTO connected_products (product, lastSeenAt) VALUES (?, ?)
         ON CONFLICT(product) DO UPDATE SET lastSeenAt = excluded.lastSeenAt`,
        [product, new Date().toISOString()], () => {}
    );
}
// Nur Verbindungen der letzten 60 Tage zählen - eine Anbindung, die seither nicht mehr
// genutzt wurde, soll nicht auf ewig eine Gratis-Freischaltung offen halten.
function hasEnoughConnectedProducts() {
    return new Promise((resolve) => {
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        db.get(`SELECT COUNT(*) as c FROM connected_products WHERE lastSeenAt >= ?`, [cutoff], (err, row) => {
            resolve(!err && row && row.c >= 2);
        });
    });
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
    const freeTier = await isWithinFreeTier();
    const connectedFree = !freeTier && await hasEnoughConnectedProducts();
    if (freeTier || connectedFree) {
        return { ...base, valid: true, licenseValid: base.valid, trial: false, trialDaysRemaining: 0, freeTier: true, freeTierReason: freeTier ? 'users' : 'connected' };
    }
    const trial = await getTrialInfo();
    if (trial.active) return { ...base, valid: true, licenseValid: base.valid, trial: true, trialDaysRemaining: trial.daysRemaining, freeTier: false };
    return { ...base, licenseValid: base.valid, trial: false, trialDaysRemaining: 0, freeTier: false };
}

// --- Aura-Suite: "Über Aura-Suite" (Dialog in der Oberfläche, Datei about.js) ---
// Programmversion aus package.json; die Version der Aura-Suite setzt, wer sie betreibt (Umgebungswert AURA_SUITE_VERSION, z. B. in der .env). Nur für angemeldete Personen.
const AURA_APP_NAME = 'AuraDirect';
const AURA_APP_VERSION = String(require('./package.json').version);
const AURA_SUITE_INSTALLED = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(String(process.env.AURA_SUITE_VERSION || '').trim()) ? String(process.env.AURA_SUITE_VERSION).trim() : null;
app.get('/api/version', (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
    res.set('Cache-Control', 'no-store').json({ product: AURA_APP_NAME, installed: AURA_APP_VERSION, suiteInstalled: AURA_SUITE_INSTALLED, suite: null, updateAvailable: false });
});

function requireSuperAdmin(req, res, next) {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    const exempt = ['/privacy-policy', '/privacy-policy/accept', '/license', '/license/save'];
    if (exempt.includes(req.path)) return next();
    getSetting('privacy_policy_version').then(v => {
        const currentVersion = parseInt(v || '1', 10);
        if ((req.session.privacyAcceptedVersion || 0) < currentVersion) return res.redirect('/privacy-policy');
        getStoredLicenseInfo().then(info => {
            if (!info.valid) return res.redirect('/license');
            next();
        });
    });
}
function layout(title, body, activeNav) {
    return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>AuraDirect — ${title}</title>
<link rel="icon" type="image/png" href="/static/images/icon.png"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
<header class="border-b border-slate-800 bg-slate-900/50">
  <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-3">
    <div class="flex items-center gap-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
    <nav class="flex gap-1.5 text-xs">
      <a href="/" class="px-3 py-1.5 rounded-lg ${activeNav === 'users' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">👥 Benutzer</a>
      <a href="/ad-settings" class="px-3 py-1.5 rounded-lg ${activeNav === 'ad' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🔌 Active Directory</a>
      <a href="/2fa" class="px-3 py-1.5 rounded-lg ${activeNav === 'twofa' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🛡️ 2FA</a>
      <a href="/privacy-policy-edit" class="px-3 py-1.5 rounded-lg ${activeNav === 'privacy' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">📄 Datenschutz</a>
      <a href="/license" class="px-3 py-1.5 rounded-lg ${activeNav === 'license' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🔑 Lizenz</a>
      <a href="/backup" class="px-3 py-1.5 rounded-lg ${activeNav === 'backup' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">💾 Backup</a>
      <a href="/change-password" class="px-3 py-1.5 rounded-lg ${activeNav === 'password' ? 'bg-blue-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'}">🔒 Passwort</a>
      <button id="about-btn" type="button" class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">ℹ️ Über</button>
      <a href="/logout" class="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">Abmelden</a>
    </nav>
  </div>
</header>
<main class="max-w-5xl mx-auto px-4 py-6">${body}</main>
<script src="/static/about.js" defer></script>
</body></html>`;
}
function loginLayout(title, body) {
    return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>AuraDirect — ${title}</title>
<link rel="icon" type="image/png" href="/static/images/icon.png"><script src="https://cdn.tailwindcss.com"></script></head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6">
<div class="w-full max-w-sm">${body}</div>
</body></html>`;
}

app.get('/login', (req, res) => {
    res.send(loginLayout('Anmeldung', `
        <form method="POST" action="/login" class="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
            <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
            ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">Benutzername oder Passwort falsch.</div>` : ''}
            <input type="text" name="username" placeholder="Benutzername" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            <input type="password" name="password" placeholder="Passwort" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Anmelden</button>
        </form>
    `));
});

app.post('/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;

    // Weg 1: der feste, ursprüngliche Admin-Zugang (Benutzername "admin").
    if (username === 'admin' && AUTH_PASSWORD) {
        const storedHash = await getSetting('admin_password_hash');
        const ok = storedHash ? await bcrypt.compare(password, storedHash).catch(() => false) : password === AUTH_PASSWORD;
        if (ok) {
            const twofaEnabled = (await getSetting('admin_twofa_enabled')) === 'true';
            if (twofaEnabled) { req.session.pending2fa = true; return res.redirect('/login/2fa'); }
            req.session.isSuperAdmin = true;
            return res.redirect('/');
        }
    }

    // Weg 2: eine normale, unter "Benutzer" angelegte Person mit Admin-Zugriff auf das
    // Produkt "auradirect" selbst - damit ein und dieselbe Person überall (AuraChat,
    // AuraPlan, AuraDirect, AuraMail) mit einem einzigen Konto Admin sein kann, statt
    // separater Zugänge pro System.
    const personRow = await new Promise((resolve) => db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username], (e, r) => resolve(r)));
    if (personRow) {
        const credOk = await bcrypt.compare(password, personRow.passwordHash || '').catch(() => false);
        if (credOk) {
            const access = await new Promise((resolve) => db.get(
                `SELECT * FROM product_access WHERE userId = ? AND product = 'auradirect' AND role = 'admin' AND active = 1`,
                [personRow.id], (e, r) => resolve(r)
            ));
            if (access) {
                if (personRow.twofa_enabled) {
                    req.session.pendingPersonId = personRow.id;
                    return res.redirect('/login/2fa-person');
                }
                req.session.isSuperAdmin = true;
                req.session.superAdminPersonId = personRow.id; // nur zur Nachvollziehbarkeit, wer sich angemeldet hat
                return res.redirect('/');
            }
        }
    }

    res.redirect('/login?error=1');
});

app.get('/login/2fa-person', (req, res) => {
    if (!req.session.pendingPersonId) return res.redirect('/login');
    res.send(loginLayout('Anmeldung', `
        <form method="POST" action="/login/2fa-person" class="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
            <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
            <p class="text-xs text-slate-400 text-center">Code aus deiner Authenticator-App eingeben:</p>
            ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">Code ist falsch oder abgelaufen.</div>` : ''}
            <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required class="w-full text-center tracking-widest bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Bestätigen</button>
        </form>
    `));
});
app.post('/login/2fa-person', authLimiter, async (req, res) => {
    if (!req.session.pendingPersonId) return res.redirect('/login');
    const personRow = await new Promise((resolve) => db.get(`SELECT * FROM users WHERE id = ?`, [req.session.pendingPersonId], (e, r) => resolve(r)));
    if (!personRow || !authenticator.verify({ token: String(req.body.code || '').trim(), secret: personRow.twofa_secret })) {
        return res.redirect('/login/2fa-person?error=1');
    }
    delete req.session.pendingPersonId;
    req.session.isSuperAdmin = true;
    req.session.superAdminPersonId = personRow.id;
    res.redirect('/');
});

app.get('/login/2fa', (req, res) => {
    if (!req.session.pending2fa) return res.redirect('/login');
    res.send(loginLayout('Anmeldung', `
        <form method="POST" action="/login/2fa" class="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
            <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
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
    req.session.isSuperAdmin = true;
    res.redirect('/');
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

// --- Lizenz ---
app.get('/license', async (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    const info = await getStoredLicenseInfo();
    const trialBox = info.trial ? `<div class="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl px-3 py-2 text-xs">⏳ Testphase aktiv - noch ${info.trialDaysRemaining} Tag(e).</div>` : '';
    const freeTierBox = info.freeTier
        ? (info.freeTierReason === 'connected'
            ? `<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Kostenlos, da mindestens 2 andere Aura-Produkte (AuraChat/AuraPlan) aktiv verbunden sind.</div>`
            : `<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Kostenlose Stufe aktiv (bis 4 verwaltete Konten) - für mehr wird eine Lizenz benötigt.</div>`)
        : '';
    res.send(loginLayout('Lizenz', `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4">
            <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
            <h2 class="text-sm font-bold text-white text-center">🔑 Lizenz</h2>
            ${trialBox}
            ${freeTierBox}
            ${info.licenseValid ? `<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Lizenziert für "${info.customer}"${info.expiresAt ? ' · gültig bis ' + new Date(info.expiresAt).toLocaleDateString('de-DE') : ' · unbegrenzt'}</div>
                   <form method="POST" action="/license/remove"><button type="submit" onclick="return confirm('Lizenz wirklich entfernen?');" class="w-full text-center bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 font-medium py-2.5 rounded-xl text-sm transition">Lizenz entfernen</button></form>` : ''}
            ${!info.licenseValid
                // Das Eingabefeld gibt es IMMER, solange keine gültige Lizenz hinterlegt ist - auch in der
                // kostenlosen Stufe und in der Testphase (früher fehlte es dort, man konnte keinen Schlüssel eintragen).
                ? `<p class="text-xs text-slate-400">${info.freeTier ? 'Ihr nutzt aktuell die kostenlose Stufe. Falls ihr eine Lizenz habt (z.B. für mehr verwaltete Konten), könnt ihr den Schlüssel hier eintragen:' : (info.trial ? 'Zusätzlich könnt ihr schon jetzt einen Lizenzschlüssel eintragen:' : 'Für diese Installation ist keine gültige Lizenz hinterlegt' + (info.error ? ' (' + String(info.error).replace(/[<>&"]/g, '') + ')' : '') + '. Bitte einen Lizenzschlüssel eintragen:')}</p>
                   <form method="POST" action="/license/save" class="flex flex-col gap-3">
                       <textarea name="key" id="license-key-textarea" rows="4" placeholder="Lizenzschlüssel hier einfügen" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"></textarea>
                       <label class="text-center text-xs px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer transition">
                           📁 Oder .lic-Datei auswählen
                           <input type="file" id="license-key-file" accept=".lic,text/plain" class="hidden">
                       </label>
                       <script>
                           document.getElementById('license-key-file').addEventListener('change', (e) => {
                               const file = e.target.files[0];
                               if (!file) return;
                               const reader = new FileReader();
                               reader.onload = () => { document.getElementById('license-key-textarea').value = reader.result.trim(); };
                               reader.readAsText(file);
                           });
                       </script>
                       ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">${String(req.query.error).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]))}</div>` : ''}
                       <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Aktivieren</button>
                   </form>`
                : ''}
            ${info.valid ? `<a href="/" class="w-full text-center bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl text-sm transition">Weiter zu AuraDirect</a>` : ''}
        </div>
    `));
});
app.post('/license/remove', async (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    await setSetting('license_key', '');
    res.redirect('/license');
});
app.post('/license/save', async (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    const key = (req.body.key || '').trim();
    const result = verifyLicenseKey(key);
    if (!result.valid) return res.redirect('/license?error=' + encodeURIComponent(result.error));
    await setSetting('license_key', key);
    res.redirect('/license');
});

// --- Datenschutzerklärung ---
app.get('/privacy-policy', async (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    const text = (await getSetting('privacy_policy_text')) || DEFAULT_PRIVACY_POLICY;
    res.send(loginLayout('Datenschutzerklärung', `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col gap-4 max-h-[85vh]">
            <div class="flex items-center gap-2 justify-center mb-2"><img src="/static/images/logo.png" alt="AuraDirect" style="height:36px;width:auto;"></div>
            <h2 class="text-sm font-bold text-white text-center">🔒 Datenschutzerklärung</h2>
            <div class="text-xs text-slate-300 overflow-y-auto pr-1 leading-relaxed whitespace-pre-wrap">${text}</div>
            <form method="POST" action="/privacy-policy/accept">
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Ich akzeptiere</button>
            </form>
        </div>
    `));
});
app.post('/privacy-policy/accept', async (req, res) => {
    if (!(req.session && req.session.isSuperAdmin)) return res.redirect('/login');
    const version = parseInt((await getSetting('privacy_policy_version')) || '1', 10);
    req.session.privacyAcceptedVersion = version;
    res.redirect('/');
});

app.get('/privacy-policy-edit', requireSuperAdmin, async (req, res) => {
    const text = (await getSetting('privacy_policy_text')) || DEFAULT_PRIVACY_POLICY;
    res.send(layout('Datenschutz', `
        <h2 class="text-sm font-bold text-white mb-4">📄 Datenschutzerklärung bearbeiten</h2>
        <p class="text-xs text-slate-500 mb-3 max-w-lg">Beim Speichern wird die Version erhöht - du musst dann selbst beim nächsten Zugriff erneut zustimmen.</p>
        <form method="POST" action="/privacy-policy-edit" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-3 max-w-lg">
            ${req.query.saved ? '<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Gespeichert.</div>' : ''}
            <textarea name="text" rows="12" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500">${text}</textarea>
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-xl text-sm transition self-start px-6">Speichern (erhöht Version)</button>
        </form>
    `, 'privacy'));
});
app.post('/privacy-policy-edit', requireSuperAdmin, async (req, res) => {
    const newText = (req.body.text || '').trim();
    if (!newText) return res.redirect('/privacy-policy-edit');
    const newVersion = parseInt((await getSetting('privacy_policy_version')) || '1', 10) + 1;
    await setSetting('privacy_policy_text', newText);
    await setSetting('privacy_policy_version', String(newVersion));
    res.redirect('/privacy-policy-edit?saved=1');
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
    `, 'twofa'));
});

app.get('/2fa/qr', requireSuperAdmin, async (req, res) => {
    let secret = req.session.pendingTwofaSecret;
    if (!secret) {
        secret = authenticator.generateSecret();
        req.session.pendingTwofaSecret = secret;
    }
    const otpauthUrl = authenticator.keyuri('admin', 'AuraDirect', secret);
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

app.get('/backup', requireSuperAdmin, (req, res) => {
    res.send(layout('Backup', `
        <h2 class="text-sm font-bold text-white mb-4">💾 Backup &amp; Wiederherstellung</h2>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg flex flex-col gap-3 mb-4">
            <p class="text-xs text-slate-500">Lädt die komplette AuraDirect-Datenbank (Benutzer, Zugriffsrechte, AD-Einstellungen) als Datei herunter.</p>
            <button id="backup-create-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-xs transition cursor-pointer self-start px-6">Backup herunterladen</button>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg flex flex-col gap-3">
            <p class="text-xs text-slate-500">⚠️ Ersetzt die komplette aktuelle Datenbank durch den Inhalt der hochgeladenen Sicherung. Der Server startet danach automatisch neu.</p>
            <input type="file" id="backup-restore-file" accept=".zip" class="w-full text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <button id="backup-restore-btn" class="bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-xl text-xs transition cursor-pointer self-start px-6">Wiederherstellen</button>
            <div id="backup-restore-status" class="text-[11px] hidden"></div>
        </div>
        <script>
            document.getElementById('backup-create-btn').addEventListener('click', () => {
                window.location.href = '/api/admin/backup';
            });
            document.getElementById('backup-restore-btn').addEventListener('click', async () => {
                const fileInput = document.getElementById('backup-restore-file');
                const statusEl = document.getElementById('backup-restore-status');
                if (!fileInput.files[0]) { alert('Bitte zuerst eine Backup-Datei auswählen.'); return; }
                if (!confirm('Aktuelle Datenbank wirklich durch dieses Backup ersetzen? Das kann nicht rückgängig gemacht werden.')) return;
                const formData = new FormData();
                formData.append('backup', fileInput.files[0]);
                statusEl.textContent = 'Wird wiederhergestellt...';
                statusEl.className = 'text-[11px] text-slate-400';
                statusEl.classList.remove('hidden');
                try {
                    const res = await fetch('/api/admin/backup/restore', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Fehler.');
                    statusEl.textContent = '✓ ' + data.message + ' Seite lädt in 5 Sekunden neu...';
                    statusEl.className = 'text-[11px] text-emerald-400';
                    setTimeout(() => location.reload(), 5000);
                } catch (err) {
                    statusEl.textContent = '✗ ' + err.message;
                    statusEl.className = 'text-[11px] text-red-400';
                }
            });
        </script>
    `, 'backup'));
});

// --- Backup & Wiederherstellung ---
app.get('/api/admin/backup', requireSuperAdmin, (req, res) => {
    const tmpDbPath = path.join(dataDir, `backup-tmp-${Date.now()}.db`);
    db.run(`VACUUM INTO ?`, [tmpDbPath], (err) => {
        if (err) return res.status(500).json({ error: 'Backup fehlgeschlagen: ' + err.message });
        try {
            const zip = new AdmZip();
            zip.addLocalFile(tmpDbPath, '', 'auradirect.db');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            res.set({
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="auradirect-backup-${timestamp}.zip"`
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
app.post('/api/admin/backup/restore', requireSuperAdmin, upload.single('backup'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
    try {
        const zip = new AdmZip(req.file.buffer);
        const dbEntry = zip.getEntry('auradirect.db');
        if (!dbEntry) return res.status(400).json({ error: 'Diese Datei enthält keine auradirect.db - ist das wirklich ein AuraDirect-Backup?' });
        fs.writeFileSync(path.join(dataDir, 'auradirect.db'), dbEntry.getData());
        res.json({ success: true, message: 'Wiederhergestellt. Server startet jetzt neu...' });
        console.log('Backup wiederhergestellt - Prozess wird für einen sauberen Neustart beendet.');
        db.close(() => { setTimeout(() => process.exit(0), 500); });
    } catch (err) {
        res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen: ' + err.message });
    }
});

app.get('/change-password', requireSuperAdmin, (req, res) => {
    res.send(layout('Passwort', `
        <div class="max-w-sm">
            <h2 class="text-base font-bold text-white mb-4">🔒 Admin-Passwort ändern</h2>
            <form method="POST" action="/change-password" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4">
                ${req.query.error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">${req.query.error === 'wrong' ? 'Aktuelles Passwort ist falsch.' : 'Neues Passwort muss mindestens 8 Zeichen lang sein.'}</div>` : ''}
                ${req.query.success ? `<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Passwort geändert.</div>` : ''}
                <input type="password" name="currentPassword" placeholder="Aktuelles Passwort" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                <input type="password" name="newPassword" placeholder="Neues Passwort" required minlength="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition">Ändern</button>
            </form>
        </div>
    `, 'password'));
});
app.post('/change-password', requireSuperAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const storedHash = await getSetting('admin_password_hash');
    const ok = storedHash ? await bcrypt.compare(currentPassword || '', storedHash).catch(() => false) : currentPassword === AUTH_PASSWORD;
    if (!ok) return res.redirect('/change-password?error=wrong');
    if (!newPassword || newPassword.length < 8) return res.redirect('/change-password?error=short');
    await setSetting('admin_password_hash', await bcrypt.hash(newPassword, 10));
    res.redirect('/change-password?success=1');
});

// --- Benutzerverwaltung ---
app.get('/', requireSuperAdmin, async (req, res) => {
    const serviceKey = await getSetting('service_key');
    db.all(`SELECT u.*, GROUP_CONCAT(p.product || ':' || p.role) as access FROM users u LEFT JOIN product_access p ON p.userId = u.id AND p.active = 1 GROUP BY u.id ORDER BY u.firstname, u.lastname`, [], (err, rows) => {
        if (err) return res.status(500).send(err.message);
        const rowsHtml = rows.map(u => {
            const access = (u.access || '').split(',').filter(Boolean).map(a => {
                const [product, role] = a.split(':');
                const label = { aurachat: 'AuraChat', auraplan: 'AuraPlan', auradirect: 'AuraDirect', auramail: 'AuraMail', auraticket: 'AuraTicket', auraproxy: 'AuraProxy', auracall: 'AuraCall' }[product] || product;
                return `<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 mr-1">${label}: ${role}</span>`;
            }).join('');
            return `<div class="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex-wrap gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-200 font-medium">${u.firstname} ${u.lastname}</span>
                    <span class="text-slate-500 text-xs">@${u.username}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded ${u.source === 'ad' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'}">${u.source === 'ad' ? 'Active Directory' : 'Lokal'}</span>
                    ${!u.active ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Inaktiv</span>' : ''}
                    ${access}
                </div>
                <a href="/users/${u.id}/edit" class="text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700">✏️ Bearbeiten</a>
            </div>`;
        }).join('');
        res.send(layout('Benutzer', `
            <div class="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-6">
                <p class="text-xs font-semibold text-blue-300 mb-1">🔑 Dienst-Schlüssel für AuraChat &amp; AuraPlan</p>
                <p class="text-[11px] text-slate-400 mb-2">Diesen Wert unverändert in AuraChat und AuraPlan eintragen (Admin Panel → jeweils bei "AuraDirect"), zusammen mit dieser Server-Adresse. Kein eigenes Erzeugen nötig, wurde automatisch erstellt.</p>
                <div class="flex items-center gap-2">
                    <input readonly id="service-key-field" value="${serviceKey || ''}" class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono" onclick="this.select()">
                    <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('service-key-field').value); this.textContent='✓ Kopiert';" class="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0">📋 Kopieren</button>
                </div>
            </div>
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-bold text-white">👥 Alle Benutzer</h2>
                <a href="/users/new" class="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium">+ Neuer lokaler Benutzer</a>
            </div>
            <div class="flex flex-col gap-2">${rowsHtml || '<div class="text-slate-500 text-sm">Noch keine Benutzer.</div>'}</div>
        `, 'users'));
    });
});

function userFormPage(title, user, error) {
    const access = user && user.accessMap ? user.accessMap : {};
    return layout(title, `
        <h2 class="text-sm font-bold text-white mb-4">${title}</h2>
        <form method="POST" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 max-w-lg">
            ${error ? `<div class="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-3 py-2 text-xs">${error}</div>` : ''}
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Vorname</label>
                    <input type="text" name="firstname" required value="${user ? user.firstname : ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                </div>
                <div>
                    <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Nachname</label>
                    <input type="text" name="lastname" required value="${user ? user.lastname : ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                </div>
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Benutzername</label>
                <input type="text" name="username" required value="${user ? user.username : ''}" ${user && user.source === 'ad' ? 'readonly' : ''} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white ${user && user.source === 'ad' ? 'opacity-60' : ''}">
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">E-Mail (optional)</label>
                <input type="email" name="email" value="${user && user.email ? user.email : ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            ${!user || user.source !== 'ad' ? `
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">${user ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort'}</label>
                <input type="password" name="password" ${user ? '' : 'required'} minlength="8" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>` : `<p class="text-xs text-slate-500">Passwort wird von Active Directory verwaltet.</p>`}

            <div class="border-t border-slate-800 pt-4">
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zugriff auf Produkte</p>
                <div class="flex flex-col gap-3">
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="aurachat_enabled" ${access.aurachat ? 'checked' : ''} class="w-4 h-4"> AuraChat
                        </label>
                        <select name="aurachat_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="user" ${access.aurachat === 'user' ? 'selected' : ''}>Benutzer</option>
                            <option value="admin" ${access.aurachat === 'admin' ? 'selected' : ''}>Administrator</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auraplan_enabled" ${access.auraplan ? 'checked' : ''} class="w-4 h-4"> AuraPlan
                        </label>
                        <select name="auraplan_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="employee" ${access.auraplan === 'employee' ? 'selected' : ''}>Mitarbeiter:in</option>
                            <option value="teamleiter" ${access.auraplan === 'teamleiter' ? 'selected' : ''}>Teamleiter:in / Kader</option>
                            <option value="admin" ${access.auraplan === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auradirect_enabled" ${access.auradirect ? 'checked' : ''} class="w-4 h-4"> AuraDirect
                        </label>
                        <select name="auradirect_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="admin" ${access.auradirect === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                        <span class="text-[10px] text-slate-500">einzige Rolle hier: Zugang zu diesem Admin Panel selbst</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auramail_enabled" ${access.auramail ? 'checked' : ''} class="w-4 h-4"> AuraMail
                        </label>
                        <select name="auramail_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="user" ${access.auramail === 'user' ? 'selected' : ''}>Person</option>
                            <option value="admin" ${access.auramail === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auraticket_enabled" ${access.auraticket ? 'checked' : ''} class="w-4 h-4"> AuraTicket
                        </label>
                        <select name="auraticket_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="agent" ${access.auraticket === 'agent' ? 'selected' : ''}>Agent:in</option>
                            <option value="admin" ${access.auraticket === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auraproxy_enabled" ${access.auraproxy ? 'checked' : ''} class="w-4 h-4"> AuraProxy
                        </label>
                        <select name="auraproxy_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="admin" ${access.auraproxy === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                        <span class="text-[10px] text-slate-500">einzige Rolle hier: Zugang zu AuraProxy selbst</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-slate-300 w-32">
                            <input type="checkbox" name="auracall_enabled" ${access.auracall ? 'checked' : ''} class="w-4 h-4"> AuraCall
                        </label>
                        <select name="auracall_role" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white">
                            <option value="admin" ${access.auracall === 'admin' ? 'selected' : ''}>Administrator:in</option>
                        </select>
                        <span class="text-[10px] text-slate-500">einzige Rolle hier: Zugang zur Verwaltung von AuraCall (Telefon)</span>
                    </div>
                </div>
            </div>

            ${user ? `<label class="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="active" ${user.active ? 'checked' : ''} class="w-4 h-4"> Konto aktiv</label>` : ''}
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition self-start px-6">Speichern</button>
        </form>

        ${user ? `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 max-w-lg mt-4">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">🛡️ Zwei-Faktor-Authentifizierung</p>
            <p class="text-[11px] text-slate-500 -mt-2">Gilt zentral für diese Person - dieselbe Einrichtung wirkt sowohl bei AuraChat als auch bei AuraPlan, kein separates Einrichten pro Produkt mehr nötig.</p>
            ${user.twofa_enabled ? `
                <p class="text-sm text-emerald-400">✓ Aktiviert</p>
                <form method="POST" action="/users/${user.id}/2fa/disable"><button class="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20">Zurücksetzen</button></form>
            ` : `
                <form method="POST" action="/users/${user.id}/2fa/setup" class="flex flex-col items-center gap-3">
                    <img src="/users/${user.id}/2fa/qr" alt="QR-Code" class="rounded-xl bg-white p-2">
                    <input type="text" name="code" inputmode="numeric" maxlength="6" placeholder="123456" required class="w-full max-w-xs text-center tracking-widest bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-xl text-sm transition px-6">Aktivieren</button>
                </form>
            `}
        </div>` : ''}
    `, 'users');
}

app.get('/users/new', requireSuperAdmin, (req, res) => res.send(userFormPage('Neuer Benutzer', null, null)));

app.post('/users/new', requireSuperAdmin, async (req, res) => {
    const { firstname, lastname, username, email, password } = req.body;
    if (!firstname || !lastname || !username || !password || password.length < 8) {
        return res.send(userFormPage('Neuer Benutzer', req.body, 'Vorname, Nachname, Benutzername und ein Passwort mit mind. 8 Zeichen sind erforderlich.'));
    }
    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, passwordHash, firstname, lastname, email, source) VALUES (?, ?, ?, ?, ?, 'local')`, [username.trim(), hash, firstname.trim(), lastname.trim(), email || null], async function (err) {
        if (err) return res.send(userFormPage('Neuer Benutzer', req.body, err.message.includes('UNIQUE') ? 'Dieser Benutzername ist bereits vergeben.' : err.message));
        const userId = this.lastID;
        await saveProductAccess(userId, req.body);
        res.redirect('/');
    });
});

app.get('/users/:id/edit', requireSuperAdmin, (req, res) => {
    db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], (err, user) => {
        if (err || !user) return res.status(404).send('Nicht gefunden.');
        db.all(`SELECT product, role FROM product_access WHERE userId = ? AND active = 1`, [user.id], (e, rows) => {
            user.accessMap = {};
            (rows || []).forEach(r => { user.accessMap[r.product] = r.role; });
            res.send(userFormPage(`Bearbeiten: ${user.firstname} ${user.lastname}`, user, null));
        });
    });
});

app.post('/users/:id/edit', requireSuperAdmin, async (req, res) => {
    const { firstname, lastname, username, email, password, active } = req.body;
    db.get(`SELECT * FROM users WHERE id = ?`, [req.params.id], async (err, existing) => {
        if (err || !existing) return res.status(404).send('Nicht gefunden.');
        let passwordHash = existing.passwordHash;
        if (existing.source !== 'ad' && password && password.trim()) {
            if (password.length < 8) return res.send(userFormPage('Bearbeiten', { ...existing, accessMap: {} }, 'Neues Passwort muss mindestens 8 Zeichen haben.'));
            passwordHash = await bcrypt.hash(password, 10);
        }
        db.run(`UPDATE users SET firstname = ?, lastname = ?, username = ?, email = ?, passwordHash = ?, active = ? WHERE id = ?`,
            [firstname, lastname, existing.source === 'ad' ? existing.username : username, email || null, passwordHash, active ? 1 : 0, existing.id],
            async (e) => {
                if (e) return res.status(500).send(e.message);
                await saveProductAccess(existing.id, req.body);
                res.redirect('/');
            });
    });
});

app.get('/users/:id/2fa/qr', requireSuperAdmin, async (req, res) => {
    db.get(`SELECT username FROM users WHERE id = ?`, [req.params.id], async (err, user) => {
        if (err || !user) return res.status(404).send('Nicht gefunden.');
        const sessionKey = `pendingTwofaSecret_user_${req.params.id}`;
        let secret = req.session[sessionKey];
        if (!secret) {
            secret = authenticator.generateSecret();
            req.session[sessionKey] = secret;
        }
        const otpauthUrl = authenticator.keyuri(user.username, 'AuraDirect', secret);
        const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
        const img = Buffer.from(qrDataUrl.split(',')[1], 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.send(img);
    });
});

app.post('/users/:id/2fa/setup', requireSuperAdmin, async (req, res) => {
    const sessionKey = `pendingTwofaSecret_user_${req.params.id}`;
    const secret = req.session[sessionKey];
    const ok = secret && authenticator.verify({ token: String(req.body.code || '').trim(), secret });
    if (!ok) return res.redirect(`/users/${req.params.id}/edit`);
    db.run(`UPDATE users SET twofa_secret = ?, twofa_enabled = 1 WHERE id = ?`, [secret, req.params.id], () => {
        delete req.session[sessionKey];
        res.redirect(`/users/${req.params.id}/edit`);
    });
});

app.post('/users/:id/2fa/disable', requireSuperAdmin, (req, res) => {
    db.run(`UPDATE users SET twofa_secret = NULL, twofa_enabled = 0 WHERE id = ?`, [req.params.id], () => {
        res.redirect(`/users/${req.params.id}/edit`);
    });
});

function saveProductAccess(userId, body) {
    const grants = [
        { product: 'aurachat', enabled: !!body.aurachat_enabled, role: body.aurachat_role || 'user' },
        { product: 'auraplan', enabled: !!body.auraplan_enabled, role: body.auraplan_role || 'employee' },
        { product: 'auradirect', enabled: !!body.auradirect_enabled, role: 'admin' },
        { product: 'auramail', enabled: !!body.auramail_enabled, role: body.auramail_role || 'user' },
        { product: 'auraticket', enabled: !!body.auraticket_enabled, role: body.auraticket_role || 'agent' },
        { product: 'auraproxy', enabled: !!body.auraproxy_enabled, role: 'admin' },
        { product: 'auracall', enabled: !!body.auracall_enabled, role: 'admin' }
    ];
    return Promise.all(grants.map(g => new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO product_access (userId, product, role, active) VALUES (?, ?, ?, ?)
             ON CONFLICT(userId, product) DO UPDATE SET role = excluded.role, active = excluded.active`,
            [userId, g.product, g.role, g.enabled ? 1 : 0],
            (err) => err ? reject(err) : resolve()
        );
    })));
}

// --- Active-Directory-Einstellungen ---
app.get('/ad-settings', requireSuperAdmin, async (req, res) => {
    const cfg = await getAdConfig();
    res.send(layout('Active Directory', `
        <h2 class="text-sm font-bold text-white mb-4">🔌 Active-Directory-Anbindung</h2>
        <form method="POST" action="/ad-settings" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 max-w-lg">
            ${req.query.saved ? '<div class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-2 text-xs">✓ Gespeichert.</div>' : ''}
            <label class="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" name="ad_enabled" ${cfg.ad_enabled ? 'checked' : ''} class="w-4 h-4"> Active Directory aktivieren
            </label>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Server-URL</label>
                <input type="text" name="ad_url" placeholder="ldap://dc.eurefirma.local:389" value="${cfg.ad_url || ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dienstkonto (Bind DN)</label>
                <input type="text" name="ad_bind_dn" placeholder="CN=svc-auradirect,OU=Service,DC=eurefirma,DC=local" value="${cfg.ad_bind_dn || ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dienstkonto-Passwort</label>
                <input type="password" name="ad_bind_password" placeholder="${cfg.ad_bind_password ? '••••••••' : ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
                <p class="text-[10px] text-slate-500 mt-1">Leer lassen, um das bestehende Passwort zu behalten.</p>
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Basis-DN (wo gesucht wird)</label>
                <input type="text" name="ad_base_dn" placeholder="OU=Benutzer,DC=eurefirma,DC=local" value="${cfg.ad_base_dn || ''}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Benutzer-Filter (zusätzlich zum Benutzernamen)</label>
                <input type="text" name="ad_user_filter" placeholder="(objectClass=user)" value="${cfg.ad_user_filter || '(objectClass=user)'}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <div>
                <label class="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Attribut für Benutzernamen</label>
                <input type="text" name="ad_username_attr" value="${cfg.ad_username_attr || 'sAMAccountName'}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white">
            </div>
            <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition self-start px-6">Speichern</button>
        </form>

        <div class="mt-6 flex gap-2">
            <form method="POST" action="/ad-settings/test"><button class="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">🔍 Verbindung testen</button></form>
            <form method="POST" action="/ad-settings/sync"><button class="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">🔄 Benutzer synchronisieren</button></form>
        </div>
        ${req.query.testResult ? `<div class="mt-3 text-xs ${req.query.testResult === 'ok' ? 'text-emerald-400' : 'text-red-400'}">${decodeURIComponent(req.query.testMessage || '')}</div>` : ''}
        ${req.query.syncResult ? `<div class="mt-3 text-xs ${req.query.syncResult === 'ok' ? 'text-emerald-400' : 'text-red-400'}">${decodeURIComponent(req.query.syncMessage || '')}</div>` : ''}
    `, 'ad'));
});

app.post('/ad-settings', requireSuperAdmin, async (req, res) => {
    await setSetting('ad_enabled', req.body.ad_enabled ? 'true' : 'false');
    await setSetting('ad_url', req.body.ad_url || '');
    await setSetting('ad_bind_dn', req.body.ad_bind_dn || '');
    if (req.body.ad_bind_password && req.body.ad_bind_password.trim()) await setSetting('ad_bind_password', req.body.ad_bind_password);
    await setSetting('ad_base_dn', req.body.ad_base_dn || '');
    await setSetting('ad_user_filter', req.body.ad_user_filter || '(objectClass=user)');
    await setSetting('ad_username_attr', req.body.ad_username_attr || 'sAMAccountName');
    res.redirect('/ad-settings?saved=1');
});

app.post('/ad-settings/test', requireSuperAdmin, async (req, res) => {
    const cfg = await getAdConfig();
    try {
        await new Promise((resolve, reject) => {
            const client = ldap.createClient({ url: cfg.ad_url, timeout: 8000, connectTimeout: 8000 });
            client.on('error', reject);
            client.bind(cfg.ad_bind_dn, cfg.ad_bind_password, (err) => {
                client.unbind();
                err ? reject(err) : resolve();
            });
        });
        res.redirect('/ad-settings?testResult=ok&testMessage=' + encodeURIComponent('✓ Verbindung und Dienstkonto-Anmeldung erfolgreich.'));
    } catch (err) {
        res.redirect('/ad-settings?testResult=fail&testMessage=' + encodeURIComponent('✗ ' + err.message));
    }
});

app.post('/ad-settings/sync', requireSuperAdmin, async (req, res) => {
    const cfg = await getAdConfig();
    try {
        const count = await new Promise((resolve, reject) => {
            const client = ldap.createClient({ url: cfg.ad_url, timeout: 8000, connectTimeout: 8000 });
            client.on('error', reject);
            client.bind(cfg.ad_bind_dn, cfg.ad_bind_password, (err) => {
                if (err) return reject(err);
                const entries = [];
                client.search(cfg.ad_base_dn, { filter: cfg.ad_user_filter, scope: 'sub' }, (err, sres) => {
                    if (err) return reject(err);
                    sres.on('searchEntry', (entry) => entries.push(entry.pojo || entry.object));
                    sres.on('error', reject);
                    sres.on('end', async () => {
                        client.unbind();
                        let imported = 0;
                        for (const entry of entries) {
                            const username = attrValue(entry, cfg.ad_username_attr);
                            const firstname = attrValue(entry, 'givenName') || username;
                            const lastname = attrValue(entry, 'sn') || '';
                            const email = attrValue(entry, 'mail');
                            if (!username) continue;
                            await new Promise((res2) => {
                                db.run(
                                    `INSERT INTO users (username, firstname, lastname, email, source) VALUES (?, ?, ?, ?, 'ad')
                                     ON CONFLICT(username) DO UPDATE SET firstname = excluded.firstname, lastname = excluded.lastname, email = excluded.email`,
                                    [username, firstname, lastname, email], () => { imported++; res2(); }
                                );
                            });
                        }
                        resolve(imported);
                    });
                });
            });
        });
        res.redirect('/ad-settings?syncResult=ok&syncMessage=' + encodeURIComponent(`✓ ${count} Benutzer synchronisiert. Zugriff pro Produkt bitte einzeln in der Benutzerliste zuteilen.`));
    } catch (err) {
        res.redirect('/ad-settings?syncResult=fail&syncMessage=' + encodeURIComponent('✗ ' + err.message));
    }
});

// --- Service-API: von AuraChat/AuraPlan aufgerufen ---
function requireServiceKey(req, res, next) {
    const provided = (req.headers['x-service-key'] || '').trim();
    if (!SERVICE_KEY || provided !== SERVICE_KEY) return res.status(401).json({ error: 'Ungültiger oder fehlender Dienst-Schlüssel.' });
    next();
}

// Für AuraMail (und künftige Produkte): Liste aller aktiven Personen zum Abgleich,
// damit dort automatisch passende Postfächer angelegt werden können. Bewusst read-only,
// keine Passwörter enthalten - nur zur Anzeige/zum Anlegen von Postfach-Einträgen.
app.get('/api/service/users', validateLimiter, requireServiceKey, (req, res) => {
    // Optional ?product=auramail: nur Personen, die für dieses Produkt freigeschaltet sind,
    // inklusive ihrer Rolle dort - damit ein Produkt (z.B. AuraMail) seine Benutzerliste
    // gezielt abgleichen kann, ohne dass sich alle erst einmal anmelden müssen.
    const product = req.query.product ? String(req.query.product).toLowerCase() : null;
    if (product && !/^[a-z]{3,20}$/.test(product)) return res.status(400).json({ error: 'Ungültiges Produkt.' });
    const done = (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    };
    if (product) {
        db.all(
            `SELECT u.username, u.firstname, u.lastname, u.email, pa.role
             FROM users u JOIN product_access pa ON pa.userId = u.id AND pa.product = ? AND pa.active = 1
             WHERE u.active = 1 ORDER BY u.lastname, u.firstname`, [product], done);
    } else {
        db.all(`SELECT username, firstname, lastname, email FROM users WHERE active = 1 ORDER BY lastname, firstname`, [], done);
    }
});

app.post('/api/auth/validate', validateLimiter, requireServiceKey, async (req, res) => {
    const { username, password, product, twofaCode } = req.body;
    // WICHTIG: wird VOR der Lizenzprüfung aufgezeichnet - sonst könnte eine (noch)
    // fehlende Lizenz nie durch "2 Produkte verbunden" behoben werden, da der allererste
    // Verbindungsversuch sonst schon hier abgewiesen würde, bevor er gezählt hat.
    recordProductConnection(product);

    const licenseInfo = await getStoredLicenseInfo();
    if (!licenseInfo.valid) return res.status(402).json({ valid: false, error: 'AuraDirect ist nicht lizenziert.' });

    if (!username || !password || !product) return res.status(400).json({ valid: false, error: 'Benutzername, Passwort und Produkt sind erforderlich.' });

    db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username.trim()], async (err, user) => {
        if (err || !user) return res.json({ valid: false });

        let credOk = false;
        let adFirstname = null, adLastname = null, adEmail = null;
        if (user.source === 'ad') {
            const cfg = await getAdConfig();
            if (!cfg.ad_enabled) return res.json({ valid: false, error: 'Active Directory ist deaktiviert.' });
            try {
                const result = await authenticateAgainstAd(cfg, username.trim(), password);
                credOk = result.valid;
                adFirstname = result.firstname; adLastname = result.lastname; adEmail = result.email;
            } catch { credOk = false; }
        } else {
            credOk = await bcrypt.compare(password, user.passwordHash || '').catch(() => false);
        }
        if (!credOk) return res.json({ valid: false });

        // Zentrale 2FA: gilt für die Person überall gleich, egal ob sie sich bei AuraChat
        // oder AuraPlan anmeldet - nur EIN Geheimnis, nicht pro Produkt separat.
        if (user.twofa_enabled) {
            const codeOk = user.twofa_secret && twofaCode && authenticator.verify({ token: String(twofaCode).trim(), secret: user.twofa_secret });
            if (!codeOk) return res.json({ valid: false, requires2fa: true });
        }

        db.get(`SELECT * FROM product_access WHERE userId = ? AND product = ? AND active = 1`, [user.id, product], (e, access) => {
            if (e || !access) return res.json({ valid: false, error: 'Kein Zugriff auf dieses Produkt.' });
            const firstname = adFirstname || user.firstname;
            const lastname = adLastname || user.lastname;
            res.json({ valid: true, name: `${firstname} ${lastname}`.trim(), firstname, lastname, email: adEmail || user.email, role: access.role, source: user.source });
        });
    });
});

// --- Eigener LDAP-Server (macht AuraDirect selbst zu einem Verzeichnisdienst, den
// beliebige andere LDAP-fähige Programme abfragen können - WLAN-Controller, VPN,
// GitLab, Proxmox, etc. - nicht nur AuraChat/AuraPlan über die REST-API oben) ---
const LDAP_PORT = process.env.LDAP_PORT || 389;
const LDAP_SUFFIX = 'dc=auradirect';

function dnForUsername(username) {
    return `uid=${username},ou=users,${LDAP_SUFFIX}`;
}
function usernameFromBindDn(dn) {
    const match = /uid=([^,]+)/i.exec(dn || '');
    return match ? match[1] : null;
}
function userToLdapEntry(user) {
    return {
        dn: dnForUsername(user.username),
        attributes: {
            objectClass: ['inetOrgPerson', 'person', 'top'],
            uid: user.username,
            cn: `${user.firstname} ${user.lastname}`.trim(),
            givenName: user.firstname,
            sn: user.lastname || user.firstname,
            mail: user.email || '',
        }
    };
}

const ldapServer = ldap.createServer();

// Anmeldeprüfung - Passwort wird nie im Verzeichnis gespeichert/preisgegeben, sondern
// bei jedem Bind live gegen die hinterlegte Quelle geprüft (lokal oder, bei per AD
// synchronisierten Konten, live gegen das eigentliche Active Directory).
ldapServer.bind(LDAP_SUFFIX, async (req, res, next) => {
    const username = usernameFromBindDn(req.dn.toString());
    if (!username) return next(new ldap.InvalidCredentialsError());

    db.get(`SELECT * FROM users WHERE username = ? AND active = 1`, [username], async (err, user) => {
        if (err || !user) return next(new ldap.InvalidCredentialsError());
        try {
            if (user.source === 'ad') {
                const cfg = await getAdConfig();
                if (!cfg.ad_enabled) return next(new ldap.InvalidCredentialsError());
                await authenticateAgainstAd(cfg, username, req.credentials);
            } else {
                const ok = await bcrypt.compare(req.credentials || '', user.passwordHash || '');
                if (!ok) return next(new ldap.InvalidCredentialsError());
            }
            res.end();
            return next();
        } catch {
            return next(new ldap.InvalidCredentialsError());
        }
    });
});

// Verzeichnis-Suche - bewusst ohne Anmeldung lesbar (nur unkritische Basis-Attribute:
// Name, Benutzername, E-Mail - nie Passwörter), wie in vielen internen Firmenverzeichnissen
// üblich. Die eigentliche Authentifizierung läuft immer über den Bind oben.
ldapServer.search(`ou=users,${LDAP_SUFFIX}`, (req, res, next) => {
    db.all(`SELECT * FROM users WHERE active = 1`, [], (err, rows) => {
        if (err) return next(new ldap.OperationsError(err.message));
        rows.forEach(user => {
            const entry = userToLdapEntry(user);
            if (!req.filter || req.filter.matches(entry.attributes)) res.send(entry);
        });
        res.end();
    });
});

ldapServer.listen(LDAP_PORT, () => {
    console.log(`AuraDirect LDAP-Server läuft auf Port ${LDAP_PORT} (Basis-DN: ${LDAP_SUFFIX})`);
});

app.listen(PORT, () => {
    console.log(`AuraDirect läuft auf http://localhost:${PORT}`);
});
