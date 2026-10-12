// Mail-Backend-Abstraktion für AuraMail. Eine der drei Anbindungsarten ist global für die
// ganze Installation konfiguriert (Admin Panel → Mail-Anbindung):
//   - "internal": vereinfachter, selbst eingebauter Mailserver (smtp-server + nodemailer)
//   - "o365": Microsoft 365 / Exchange Online über die Microsoft-Graph-API
//   - "external": beliebiger anderer IMAP/SMTP-Anbieter (pro Postfach eigene Zugangsdaten)
//
// EHRLICHER HINWEIS: "internal" ist eine funktionierende, aber bewusst einfache Umsetzung -
// kein Ersatz für Postfix/Dovecot. Insbesondere die Zustellbarkeit beim Versand (SPF/DKIM/
// DMARC, IP-Reputation) liegt in der Verantwortung des Betreibers; ein Relay/Smarthost kann
// optional eingetragen werden und wird für den Produktivbetrieb empfohlen.

const nodemailer = require('nodemailer');
const dns = require('dns').promises;
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

module.exports = function createMailBackend({ db, getConfig, decryptCredential }) {

    async function getMailMode() {
        return (await getConfig('mail_mode')) || 'internal';
    }

    // --- Microsoft 365 / Graph-API ---
    async function getGraphToken() {
        const tenantId = await getConfig('o365_tenant_id');
        const clientId = await getConfig('o365_client_id');
        const clientSecret = await getConfig('o365_client_secret');
        if (!tenantId || !clientId || !clientSecret) throw new Error('Microsoft-365-Zugangsdaten sind nicht vollständig hinterlegt (Tenant-ID/Client-ID/Client-Secret).');

        const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                scope: 'https://graph.microsoft.com/.default',
                grant_type: 'client_credentials'
            })
        });
        if (!resp.ok) {
            // Microsoft nennt den genauen Grund im Antworttext (z.B. "AADSTS7000215: Invalid client
            // secret") - den zeigen wir an, statt nur den Statuscode. Enthält keine Geheimnisse.
            let detail = '', hint = '';
            try {
                const err = await resp.json();
                const text = String(err.error_description || err.error || '').split(/\r?\n/)[0].slice(0, 300);
                if (text) detail = `: ${text}`;
                if (/AADSTS7000215/.test(text)) hint = ' → Das Client-Secret stimmt nicht. Es muss der WERT sein (nicht die "Geheime Schlüssel-ID"), und er gehört zur selben App wie die Client-ID.';
                else if (/AADSTS7000222/.test(text)) hint = ' → Das Client-Secret ist abgelaufen. In Azure ein neues erstellen und den Wert eintragen.';
                else if (/AADSTS700016/.test(text)) hint = ' → Diese Client-ID gibt es in diesem Tenant nicht. Client-ID und Tenant-ID prüfen.';
                else if (/AADSTS90002|AADSTS900023/.test(text)) hint = ' → Die Tenant-ID ist ungültig oder unbekannt.';
            } catch { /* keine lesbare Antwort */ }
            throw new Error(`Microsoft-Anmeldung fehlgeschlagen (Status ${resp.status})${detail}${hint}`);
        }
        const data = await resp.json();
        return data.access_token;
    }

    // Listet die Konten/Postfächer aus dem Microsoft-365-Verzeichnis (Entra ID), damit sie im
    // Admin Panel angekreuzt statt von Hand eingetippt werden können. Braucht in der Azure-App
    // zusätzlich die Anwendungsberechtigung "User.Read.All" (mit Administratorzustimmung).
    // Geteilte Postfächer (z.B. info@) sind in Microsoft 365 ebenfalls Konten und erscheinen
    // hier - meist als deaktivierte Konten. Nicht enthalten: Verteilerlisten/Microsoft-365-
    // Gruppen (das sind keine Konten).
    async function listO365Mailboxes() {
        const token = await getGraphToken();
        let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,userType&$top=999';
        const results = [];
        for (let page = 0; page < 20 && url; page++) { // Obergrenze gegen Endlosschleifen: 20 x 999 Konten
            const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (resp.status === 403) throw new Error('Zugriff verweigert - in der Azure-App-Registrierung fehlt vermutlich die Anwendungsberechtigung "User.Read.All" (inklusive Administratorzustimmung erteilen).');
            if (!resp.ok) throw new Error(`Abruf der Konten aus Microsoft 365 fehlgeschlagen (Status ${resp.status}).`);
            const data = await resp.json();
            for (const u of data.value || []) {
                if (!u.mail) continue;                 // ohne E-Mail-Adresse kein Postfach
                if (u.userType === 'Guest') continue;  // Gäste haben kein Postfach in diesem Tenant
                results.push({
                    address: u.mail.toLowerCase(),
                    displayName: u.displayName || '',
                    accountEnabled: u.accountEnabled !== false
                });
            }
            url = data['@odata.nextLink'] || null;
        }
        return results.sort((a, b) => (a.displayName || a.address).localeCompare(b.displayName || b.address, 'de'));
    }

    async function sendViaGraph(mailboxAddress, { to, cc, subject, text, html, attachments }) {
        const token = await getGraphToken();
        const message = {
            subject,
            body: { contentType: html ? 'HTML' : 'Text', content: html || text || '' },
            toRecipients: (to || []).map(addr => ({ emailAddress: { address: addr } })),
            ccRecipients: (cc || []).map(addr => ({ emailAddress: { address: addr } })),
            attachments: (attachments || []).map(a => ({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: a.filename,
                contentType: a.contentType || 'application/octet-stream',
                contentBytes: a.content.toString('base64')
            }))
        };
        const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailboxAddress)}/sendMail`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, saveToSentItems: true })
        });
        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            throw new Error(`Versand über Microsoft 365 fehlgeschlagen (Status ${resp.status}): ${body}`);
        }
    }

    async function fetchNewViaGraph(mailboxAddress, sinceIso) {
        const token = await getGraphToken();
        const filter = sinceIso ? `&$filter=receivedDateTime ge ${sinceIso}` : '';
        const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailboxAddress)}/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc${filter}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) throw new Error(`Abruf über Microsoft 365 fehlgeschlagen (Status ${resp.status}).`);
        const data = await resp.json();
        return (data.value || []).map(m => ({
            messageId: m.internetMessageId,
            fromAddress: m.from?.emailAddress?.address || '',
            fromName: m.from?.emailAddress?.name || '',
            toAddress: (m.toRecipients || []).map(r => r.emailAddress.address).join(', '),
            subject: m.subject || '',
            bodyText: m.bodyPreview || '',
            bodyHtml: m.body?.contentType === 'html' ? m.body.content : null,
            receivedAt: m.receivedDateTime
        }));
    }

    // --- Externer IMAP/SMTP-Anbieter (pro Postfach eigene Zugangsdaten) ---
    async function getExternalSmtpTransport(mailbox) {
        const host = await getConfig('external_smtp_host');
        const port = parseInt((await getConfig('external_smtp_port')) || '587', 10);
        const secure = (await getConfig('external_smtp_secure')) === 'true';
        const password = decryptCredential(mailbox.externalPasswordEnc);
        return nodemailer.createTransport({
            host, port, secure,
            auth: { user: mailbox.externalUsername || mailbox.address, pass: password }
        });
    }

    async function sendViaExternal(mailbox, { to, cc, subject, text, html, attachments }) {
        const transport = await getExternalSmtpTransport(mailbox);
        await transport.sendMail({
            from: mailbox.address, to: (to || []).join(', '), cc: (cc || []).join(', '),
            subject, text, html,
            attachments: (attachments || []).map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
        });
    }

    async function fetchNewViaExternal(mailbox) {
        const host = await getConfig('external_imap_host');
        const port = parseInt((await getConfig('external_imap_port')) || '993', 10);
        const secure = (await getConfig('external_imap_secure')) !== 'false';
        const password = decryptCredential(mailbox.externalPasswordEnc);
        const client = new ImapFlow({
            host, port, secure,
            auth: { user: mailbox.externalUsername || mailbox.address, pass: password },
            logger: false
        });
        const results = [];
        await client.connect();
        try {
            const lock = await client.getMailboxLock('INBOX');
            try {
                // Nur ungelesene, neue Nachrichten holen - reicht für regelmässiges Abfragen
                for await (const msg of client.fetch({ seen: false }, { source: true, envelope: true })) {
                    const parsed = await simpleParser(msg.source);
                    results.push({
                        messageId: parsed.messageId,
                        inReplyTo: parsed.inReplyTo,
                        fromAddress: parsed.from?.value?.[0]?.address || '',
                        fromName: parsed.from?.value?.[0]?.name || '',
                        toAddress: (parsed.to?.value || []).map(a => a.address).join(', '),
                        subject: parsed.subject || '',
                        bodyText: parsed.text || '',
                        bodyHtml: parsed.html || null,
                        receivedAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
                        attachments: (parsed.attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType, content: a.content }))
                    });
                }
            } finally {
                lock.release();
            }
        } finally {
            await client.logout().catch(() => {});
        }
        return results;
    }

    // --- Interner (vereinfachter) Mailserver ---
    // Empfang läuft über einen separat gestarteten smtp-server-Listener (siehe
    // internalSmtpServer.js), der eingehende Post direkt in die Datenbank schreibt - dafür
    // ist hier keine "fetch"-Funktion nötig. Für den Versand: entweder direkt (Zustellung an
    // den MX-Server der Empfänger-Domain) oder über einen konfigurierten Relay/Smarthost.
    async function getRelayTransport() {
        const relayHost = await getConfig('internal_relay_host');
        if (!relayHost) return null;
        const relayPort = parseInt((await getConfig('internal_relay_port')) || '587', 10);
        const relayUser = await getConfig('internal_relay_username');
        const relayPassEnc = await getConfig('internal_relay_password_enc');
        return nodemailer.createTransport({
            host: relayHost, port: relayPort, secure: relayPort === 465,
            auth: relayUser ? { user: relayUser, pass: decryptCredential(relayPassEnc) } : undefined
        });
    }
    // Direkte Zustellung per MX-Auflösung, falls kein Relay eingetragen ist - moderne
    // nodemailer-Versionen haben die frühere "direct: true"-Option ersatzlos entfernt, ein
    // Versand ohne diese eigene Auflösung würde sonst versehentlich immer nur "localhost"
    // erreichen (siehe Fehler "ECONNREFUSED 127.0.0.1:587"). WICHTIG: braucht ausgehenden
    // Zugriff auf Port 25 - viele Hoster/Internetanbieter blockieren diesen standardmässig,
    // dann bleibt nur der Weg über einen Relay/Smarthost.
    async function sendDirectToMx(domain, message) {
        // Laut Mail-Standard (RFC 5321): hat eine Domain KEINE MX-Einträge, gilt sie
        // ersatzweise so, als würde ihre normale Adresse (A-Eintrag) selbst der Mailserver
        // sein - das ist kein Fehlerfall, sondern ausdrücklich vorgesehenes Verhalten.
        let targets;
        try {
            const records = await dns.resolveMx(domain);
            targets = records.sort((a, b) => a.priority - b.priority).map(r => r.exchange);
        } catch (mxErr) {
            if (mxErr.code === 'ENODATA' || mxErr.code === 'ENOTFOUND') {
                targets = [domain]; // Rückfall auf die Domain selbst, siehe oben
            } else {
                throw new Error(`MX-Auflösung für "${domain}" fehlgeschlagen: ${mxErr.message}`);
            }
        }
        let lastError;
        for (const target of targets) { // mehrere Ziele probieren, falls das bevorzugte gerade nicht antwortet
            try {
                const transport = nodemailer.createTransport({ host: target, port: 25, secure: false, tls: { rejectUnauthorized: false } });
                await transport.sendMail(message);
                return;
            } catch (err) {
                lastError = err;
            }
        }
        throw new Error(`Zustellung an "${domain}" fehlgeschlagen (${lastError?.message || 'unbekannter Fehler'}). Häufigste Ursache: ausgehender Port 25 ist bei eurem Hoster/Internetanbieter gesperrt - dann bitte einen Relay/Smarthost eintragen.`);
    }
    async function sendViaInternal(mailboxAddress, { to, cc, subject, text, html, attachments }) {
        const relayTransport = await getRelayTransport();
        const message = {
            from: mailboxAddress, to: (to || []).join(', '), cc: (cc || []).join(', '),
            subject, text, html,
            attachments: (attachments || []).map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
        };
        if (relayTransport) { await relayTransport.sendMail(message); return; }

        // Ohne Relay: pro Ziel-Domain einzeln per MX-Auflösung zustellen.
        const allRecipients = [...(to || []), ...(cc || [])];
        const domains = [...new Set(allRecipients.map(addr => addr.split('@')[1]).filter(Boolean))];
        if (domains.length === 0) throw new Error('Keine gültige Empfänger-Adresse angegeben.');
        for (const domain of domains) {
            await sendDirectToMx(domain, message);
        }
    }

    // --- Öffentliche Schnittstelle ---
    async function sendMail(mailbox, options) {
        const mode = await getMailMode();
        if (mode === 'o365') return sendViaGraph(mailbox.address, options);
        if (mode === 'external') return sendViaExternal(mailbox, options);
        return sendViaInternal(mailbox.address, options);
    }

    async function fetchNewMessages(mailbox, sinceIso) {
        const mode = await getMailMode();
        if (mode === 'o365') return fetchNewViaGraph(mailbox.address, sinceIso);
        if (mode === 'external') return fetchNewViaExternal(mailbox);
        return []; // "internal": kommt über den SMTP-Listener direkt rein, kein Abfragen nötig
    }

    async function testConnection() {
        const mode = await getMailMode();
        try {
            if (mode === 'o365') { await getGraphToken(); return { success: true, message: 'Verbindung zu Microsoft 365 erfolgreich (Token erhalten).' }; }
            if (mode === 'external') {
                const host = await getConfig('external_smtp_host');
                if (!host) return { success: false, message: 'Kein SMTP-Host hinterlegt.' };
                return { success: true, message: 'Grundkonfiguration vorhanden - vollständiger Test erfolgt beim ersten tatsächlichen Versand/Abruf eines Postfachs.' };
            }
            const relayHost = await getConfig('internal_relay_host');
            return {
                success: true,
                message: relayHost
                    ? `Interner Mailserver aktiv, Versand über Relay "${relayHost}".`
                    : 'Interner Mailserver aktiv, kein Relay eingetragen - Versand erfolgt per direkter MX-Auflösung (braucht offenen ausgehenden Port 25, sonst schlägt der Versand fehl).'
            };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }

    return { getMailMode, sendMail, fetchNewMessages, testConnection, listO365Mailboxes };
};
