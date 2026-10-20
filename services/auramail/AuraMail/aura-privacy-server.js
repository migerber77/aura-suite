'use strict';
/* Datenschutzerklärung mit Bestätigung beim ersten Login (gemeinsames Modul der Aura-Suite, in AuraTicket, AuraMail und AuraProxy byte-gleich).
 *
 * Verhalten wie in AuraPlan, AuraChat und AuraDirect: Der Text steht in der Datenbank (Standardtext, von Administratoren änderbar), hat eine Versionsnummer, und jede Person
 * muss die AKTUELLE Version bestätigen, bevor sie die Anwendung benutzt. Ändert ein Admin den Text, steigt die Version und alle bestätigen neu.
 *
 *   GET  /api/privacy-policy           öffentlich: { text, version, accepted }  (accepted = true/false für Angemeldete, null ohne Sitzung)
 *   POST /api/privacy-policy/accept    angemeldet: bestätigt die aktuelle Version (mit { version } wird geprüft, dass die Person die aktuelle gesehen hat)
 *   POST /api/admin/privacy-policy     Admin: { text } speichert und erhöht die Version
 *
 * Verwendung:  require('./aura-privacy-server').register(app, { db, requireAuth, requireAdmin, getUserId: (req) => ..., defaultText });
 * Die Tabelle aura_privacy und die Spalte users.privacy_accepted_version werden bei Bedarf angelegt.
 * Ohne Benutzertabelle (z. B. AuraLic mit Hauptadministrator und Resellern): mode: 'identity'. Dann liefert getUserId eine Kennung als Text (z. B. 'superadmin' oder 'reseller:7')
 * und die Bestätigung steht in der Tabelle aura_privacy_accept (Kennung, Version). */

const MAX_TEXT = 50000;

// Hinweis auf die anonyme Rückmeldung an den Lizenzserver: gilt für alle Aura-Produkte und gehört in jede Datenschutzerklärung
const CHECKIN_NOTICE = [
    '## Rückmeldung an den Lizenzserver',
    '',
    'Diese Anwendung meldet sich alle 12 Stunden anonym beim Lizenzserver des Herstellers. Übermittelt werden nur: eine zufällige Installationskennung, der Produktname und die Version, der Lizenzzustand (Testphase, kostenlos, lizenziert, abgelaufen), die Zahl der Konten und, falls vorhanden, der Lizenzschlüssel. Es werden keine Namen, keine Inhalte und keine Zugangsdaten übermittelt. Die IP-Adresse wird beim Hersteller nicht gespeichert.',
].join('\n');

function register(app, opts) {
    const { db, requireAuth, requireAdmin, getUserId } = opts; const identity = opts.mode === 'identity';
    const defaultText = String(opts.defaultText || '');
    if (!app || !db || typeof requireAuth !== 'function' || typeof requireAdmin !== 'function' || typeof getUserId !== 'function') throw new Error('aura-privacy-server: app, db, requireAuth, requireAdmin und getUserId sind erforderlich.');

    db.run(`CREATE TABLE IF NOT EXISTS aura_privacy (id INTEGER PRIMARY KEY CHECK (id = 1), text TEXT, version INTEGER NOT NULL DEFAULT 1)`);
    db.run(`INSERT OR IGNORE INTO aura_privacy (id, text, version) VALUES (1, NULL, 1)`);
    if (identity) db.run(`CREATE TABLE IF NOT EXISTS aura_privacy_accept (identity TEXT PRIMARY KEY, version INTEGER NOT NULL)`);
    // Spalte für die bestätigte Version. Beim Start kann die Benutzertabelle noch nicht existieren (sie wird in einer eigenen Warteschlange angelegt): dann mehrmals neu versuchen.
    const ensureColumn = (attempt) => db.run(`ALTER TABLE users ADD COLUMN privacy_accepted_version INTEGER NOT NULL DEFAULT 0`, (err) => {
        if (err && /no such table/i.test(String(err.message)) && attempt < (opts.retries === undefined ? 40 : opts.retries)) setTimeout(() => ensureColumn(attempt + 1), opts.retryMs === undefined ? 250 : opts.retryMs);
        /* sonst: Spalte angelegt oder gibt es schon */
    });
    if (!identity) ensureColumn(0);

    const acceptedSql = identity ? `SELECT version AS v FROM aura_privacy_accept WHERE identity = ?` : `SELECT privacy_accepted_version AS v FROM users WHERE id = ?`;
    const policy = () => new Promise((resolve) => db.get(`SELECT text, version FROM aura_privacy WHERE id = 1`, [], (err, row) => resolve({ text: (row && row.text) || defaultText, version: (row && Number.isInteger(row.version) && row.version) || 1 })));

    app.get('/api/privacy-policy', async (req, res) => {
        const p = await policy();
        res.set('Cache-Control', 'no-store');
        const uid = getUserId(req);
        if (!uid) return res.json({ text: p.text, version: p.version, accepted: null });
        db.get(acceptedSql, [identity ? String(uid) : uid], (err, row) => res.json({ text: p.text, version: p.version, accepted: !!row && (row.v || 0) >= p.version }));
    });

    app.post('/api/privacy-policy/accept', requireAuth, async (req, res) => {
        const p = await policy();
        const seen = req.body && req.body.version;
        if (seen !== undefined && Number(seen) !== p.version) return res.status(409).json({ error: 'Die Datenschutzerklärung wurde inzwischen geändert. Bitte die Seite neu laden und die neue Fassung lesen.' });
        const uid = getUserId(req), save = identity ? [`INSERT INTO aura_privacy_accept (identity, version) VALUES (?, ?) ON CONFLICT(identity) DO UPDATE SET version = excluded.version`, [String(uid), p.version]] : [`UPDATE users SET privacy_accepted_version = ? WHERE id = ?`, [p.version, uid]];
        db.run(save[0], save[1], (err) => {
            if (err) return res.status(500).json({ error: 'Konnte nicht gespeichert werden.' });
            res.json({ success: true, version: p.version });
        });
    });

    app.post('/api/admin/privacy-policy', requireAuth, requireAdmin, async (req, res) => {
        const text = req.body && req.body.text;
        if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'Der Text darf nicht leer sein.' });
        if (text.length > MAX_TEXT) return res.status(400).json({ error: `Der Text ist zu lang (höchstens ${MAX_TEXT} Zeichen).` });
        const p = await policy();
        db.run(`UPDATE aura_privacy SET text = ?, version = ? WHERE id = 1`, [text, p.version + 1], (err) => {
            if (err) return res.status(500).json({ error: 'Konnte nicht gespeichert werden.' });
            res.json({ success: true, version: p.version + 1 });
        });
    });

    return { policy };
}

module.exports = { register, CHECKIN_NOTICE, MAX_TEXT };
