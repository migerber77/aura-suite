// Nimmt eingehende Post entgegen, wenn AuraMail im "internal"-Modus als eigener Mailserver
// läuft. Bewusst einfach gehalten (siehe Hinweis in server.js) - kein Spam-Filter, keine
// Warteschlange, keine TLS-Zertifikatsprüfung für eingehende Verbindungen über das hier
// Gezeigte hinaus. Für ernsthaften Produktivbetrieb mit hohem Postaufkommen ist eine
// etablierte Lösung (Postfix/Dovecot) die robustere Wahl.

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

function startInternalSmtpServer({ db, getConfig, port }) {
    const server = new SMTPServer({
        secure: false, // TLS wird typischerweise vom vorgeschalteten Reverse-Proxy/Loadbalancer übernommen
        authOptional: true, // eingehende Post von aussen braucht keine Authentifizierung (wie bei jedem MX-Server)
        disabledCommands: ['AUTH'],
        onRcptTo(address, session, callback) {
            const recipient = address.address.toLowerCase();
            db.get(`SELECT id FROM mailboxes WHERE address = ? AND active = 1`, [recipient], (err, row) => {
                if (err || !row) return callback(new Error('550 Postfach nicht gefunden'));
                callback();
            });
        },
        onData(stream, session, callback) {
            simpleParser(stream, {}, (err, parsed) => {
                if (err) return callback(err);
                const recipients = session.envelope.rcptTo.map(r => r.address.toLowerCase());
                recipients.forEach(recipient => {
                    db.get(`SELECT id FROM mailboxes WHERE address = ? AND active = 1`, [recipient], (mErr, mailbox) => {
                        if (mErr || !mailbox) return; // sollte durch onRcptTo schon ausgeschlossen sein
                        db.run(
                            `INSERT INTO messages (mailboxId, folder, messageId, inReplyTo, fromAddress, fromName, toAddress, ccAddress, subject, bodyText, bodyHtml, receivedAt)
                             VALUES (?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                mailbox.id,
                                parsed.messageId || null,
                                parsed.inReplyTo || null,
                                parsed.from?.value?.[0]?.address || '',
                                parsed.from?.value?.[0]?.name || '',
                                recipient,
                                (parsed.cc?.value || []).map(a => a.address).join(', '),
                                parsed.subject || '(kein Betreff)',
                                parsed.text || '',
                                parsed.html || null,
                                (parsed.date || new Date()).toISOString()
                            ],
                            function (insertErr) {
                                if (insertErr || !this.lastID) return;
                                (parsed.attachments || []).forEach(a => {
                                    db.run(`INSERT INTO attachments (messageId, filename, contentType, data) VALUES (?, ?, ?, ?)`,
                                        [this.lastID, a.filename || 'anhang', a.contentType || 'application/octet-stream', a.content]);
                                });
                            }
                        );
                    });
                });
                callback();
            });
        }
    });

    server.on('error', (err) => console.error('[interner Mailserver] Fehler:', err.message));
    server.listen(port, () => console.log(`[interner Mailserver] Eingehende Post wird auf Port ${port} entgegengenommen.`));
    return server;
}

module.exports = { startInternalSmtpServer };
