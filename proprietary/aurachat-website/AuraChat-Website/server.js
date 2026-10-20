const express = require('express');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

const PORT = process.env.PORT || 3001;
const ADMIN_TOKEN = process.env.REVIEWS_ADMIN_TOKEN || '';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'reviews.db'), (err) => {
    if (err) console.error('Fehler beim Öffnen der Datenbank:', err.message);
    else console.log('Mit Bewertungs-Datenbank verbunden.');
});
db.run('PRAGMA journal_mode = WAL;');

db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    rating INTEGER,
    comment TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)`);

const submitLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Zu viele Bewertungen von dieser Adresse - bitte später erneut versuchen.' } });

function requireAdminToken(req, res, next) {
    if (!ADMIN_TOKEN) return res.status(503).json({ error: 'Admin-Löschung ist nicht konfiguriert (REVIEWS_ADMIN_TOKEN fehlt).' });
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) return res.status(401).json({ error: 'Ungültiger Admin-Token.' });
    next();
}

app.get('/api/reviews', (req, res) => {
    db.all(`SELECT id, name, rating, comment, createdAt FROM reviews ORDER BY createdAt DESC LIMIT 200`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const count = rows.length;
        const average = count > 0 ? rows.reduce((sum, r) => sum + r.rating, 0) / count : 0;
        res.json({ reviews: rows, average: Math.round(average * 10) / 10, count });
    });
});

app.post('/api/reviews', submitLimiter, (req, res) => {
    const name = (req.body.name || '').trim().slice(0, 60);
    const rating = parseInt(req.body.rating, 10);
    const comment = (req.body.comment || '').trim().slice(0, 1000);
    // Honeypot-Feld: unsichtbar für echte Menschen, füllen nur Bots aus
    if ((req.body.website || '').trim()) return res.status(400).json({ error: 'Ungültige Anfrage.' });

    if (!name) return res.status(400).json({ error: 'Name ist erforderlich.' });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Bewertung muss zwischen 1 und 5 Sternen liegen.' });
    if (!comment) return res.status(400).json({ error: 'Kommentar ist erforderlich.' });

    db.run(`INSERT INTO reviews (name, rating, comment) VALUES (?, ?, ?)`, [name, rating, comment], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

// Nur zum Entfernen unangemessener Bewertungen - kein volles Admin-Panel, ein simpler
// gemeinsamer Token reicht für diesen einen Zweck.
app.delete('/api/reviews/:id', requireAdminToken, (req, res) => {
    db.run(`DELETE FROM reviews WHERE id = ?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Bewertung nicht gefunden.' });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`AuraChat-Webseite Bewertungs-Backend läuft auf http://localhost:${PORT}`);
});
