'use strict';
/* Datenschutzerklärung (Deutsch/Englisch), erzeugt aus den tatsächlichen Einstellungen von AuraCall (Aufbewahrungsdauer, Speicherung von Gesprächstexten, AuraDirect ...),
 * damit sie nie etwas anderes sagt, als das Programm tut. Alle Angaben der verantwortlichen Stelle werden maskiert (nie als HTML ausgegeben).
 * HINWEIS: Das ist eine Vorlage. Die verantwortliche Stelle prüft sie und ergänzt, was für ihren Betrieb zutrifft (siehe README). Keine Rechtsberatung. */
const UPDATED = { de: 'Oktober 2026', en: 'October 2026' };
const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// Mehrzeiliger Text der verantwortlichen Stelle: Absätze bei Leerzeilen, einfache Zeilenumbrüche als <br>; alles maskiert
const paragraphs = (t) => String(t || '').split(/\r?\n\s*\r?\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x).replace(/\r?\n/g, '<br>')}</p>`).join('\n');
const ul = (items) => `<ul>\n${items.map(i => `<li>${i}</li>`).join('\n')}\n</ul>`;

function facts(settings, opts = {}) {
    const g = settings.general || {}, p = settings.privacy || {};
    return { checkin: !!opts.checkin, c: p, days: Number(g.retentionDays) || 30, store: g.storeTranscripts === true, directory: !!(settings.auradirect && settings.auradirect.enabled), required2fa: !!(settings.security && settings.security.twofaRequired), company: g.company || '' };
}
function controllerBlock(d, L) {
    const c = d.c, lines = [];
    const name = c.controller || d.company;
    lines.push(name ? `<strong>${esc(name)}</strong>` : `<em>${L.missing}</em>`);
    if (c.address) lines.push(esc(c.address));
    if (c.email) lines.push(`${L.email}: <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`);
    if (c.phone) lines.push(`${L.phone}: ${esc(c.phone)}`);
    if (c.dpo) lines.push(`${L.dpo}: ${esc(c.dpo)}`);
    return `<p class="controller">${lines.join('<br>')}</p>`;
}
const TEXT = {
    de: {
        title: 'Datenschutzerklärung', sub: 'AuraCall – Telefon-Assistentin „Aura“', updated: 'Stand', missing: '[Verantwortliche Stelle noch nicht eingetragen: in AuraCall unter Einstellungen → Datenschutz ausfüllen]', email: 'E-Mail', phone: 'Telefon', dpo: 'Datenschutz-Kontakt', lang: 'Sprache', print: 'Drucken',
        sections: (d, ctl) => [
            ['1. Wer ist verantwortlich?', `<p>Verantwortlich für die Bearbeitung Ihrer Personendaten im Zusammenhang mit unserem Telefonservice ist:</p>\n${ctl}`],
            ['2. Was ist AuraCall?', `<p>AuraCall verbindet unsere Telefonanlage mit der Assistentin „Aura“. Wenn Sie uns anrufen, nimmt Aura den Anruf entgegen und beantwortet Ihre Fragen. Manchmal ruft Aura im Auftrag unserer Mitarbeitenden jemanden an, zum Beispiel um eine Nachricht auszurichten.</p>\n<p><strong>Aura ist eine künstliche Intelligenz, keine Person.</strong> Sie sagt das zu Beginn jedes Gesprächs. Sie können das Gespräch jederzeit beenden und uns über die oben genannten Kontaktangaben direkt erreichen.</p>`],
            ['3. Welche Daten bearbeiten wir bei einem Anruf?', ul([
                `<strong>Verbindungsdaten:</strong> die Rufnummer (bei Ihrem Anruf Ihre Nummer, bei unserem Anruf die angerufene Nummer), der Zeitpunkt, die Dauer und das Ergebnis des Anrufs (zum Beispiel beendet, nicht verstanden oder abgewiesen).`,
                `<strong>Gesprochener Inhalt:</strong> Was Sie sagen, wird in Echtzeit in Text umgewandelt (Spracherkennung), von der KI beantwortet und als Sprache wiedergegeben. <strong>Tonaufnahmen werden weder von AuraCall noch von AuraChat gespeichert</strong>; der Ton wird nur für die Umwandlung in Text verwendet.`,
                d.store ? `<strong>Gesprächstext:</strong> Das Gespräch wird als Text gespeichert (was Sie und Aura gesagt haben). Darauf weist Aura Sie zu Beginn des Gesprächs hin.` : `<strong>Gesprächstext:</strong> Der Text des Gesprächs wird nach dem Anruf nicht gespeichert.`,
                `<strong>Anlass bei unseren Anrufen:</strong> Wenn wir Sie anrufen, ist zusätzlich der Auftrag gespeichert, den Aura ausrichten soll.`,
                `<strong>Ihre eigenen Angaben:</strong> Alles, was Sie im Gespräch nennen (zum Beispiel Ihren Namen oder Reservierungswünsche), verwendet Aura, um zu antworten. Bitte nennen Sie nur, was für Ihr Anliegen nötig ist.`])],
            ['4. Wofür und auf welcher Grundlage?', `<p>Wir bearbeiten die Daten, um Anrufe anzunehmen und zu beantworten, Anfragen zu bearbeiten, den Telefonservice sicher und störungsfrei zu betreiben (Begrenzungen, Fehlersuche, Schutz vor Missbrauch)${d.store ? ' und um Auskünfte nachvollziehen zu können' : ''}.</p>\n<p>Wir stützen uns auf unser berechtigtes Interesse an einem erreichbaren und sicheren Telefonservice und, wo Sie etwas anfragen oder buchen, auf die Anbahnung oder Abwicklung eines Vertrags. Die Bearbeitung erfolgt nach Treu und Glauben und verhältnismässig (Schweizer Datenschutzgesetz, DSG). Soweit die EU-Datenschutz-Grundverordnung gilt, sind das Art. 6 Abs. 1 lit. b und f DSGVO.</p>`],
            ['5. Wer erhält die Daten?', ul([
                `<strong>Unser Telefonanbieter</strong> vermittelt die Anrufe und kennt dabei Rufnummern und Zeitpunkte. Dafür gilt seine eigene Datenschutzerklärung. Bearbeitet er Daten im Ausland, richtet sich das nach dieser Erklärung.`,
                `<strong>KI-Verarbeitung:</strong> Spracherkennung, Antwort und Sprachausgabe laufen über die Software AuraChat, die wir selbst betreiben. Gesprächsinhalte werden dafür nicht an weitere Dritte weitergegeben, ausser dies steht unten unter «Ergänzende Angaben».`,
                `Wir verwenden Gespräche <strong>nicht zum Trainieren von KI-Modellen</strong>, verkaufen keine Daten und geben sie nicht zu Werbezwecken weiter.`,
                `Dienstleister für Betrieb und Wartung unserer IT haben nur im Rahmen ihres Auftrags Zugang.`])],
            ['6. Wie lange bewahren wir die Daten auf?', ul([
                `Die Anrufliste (Rufnummer, Zeitpunkt, Dauer, Ergebnis)${d.store ? ' und die Gesprächstexte' : ''} bleibt <strong>${d.days} ${d.days === 1 ? 'Tag' : 'Tage'}</strong> erhalten und wird danach automatisch gelöscht. Einzelne Anrufe können wir auf Anfrage früher löschen.`,
                `Das Änderungsprotokoll der Verwaltung (wer wann welche Einstellung geändert hat, mit IP-Adresse) behält die letzten 2000 Einträge.`])],
            ['7. Ihre Rechte', `<p>Sie können Auskunft über Ihre Daten verlangen, sie berichtigen oder löschen lassen, der Bearbeitung widersprechen oder sie einschränken lassen, und (soweit anwendbar) Ihre Daten in einem gängigen Format erhalten. Schreiben Sie dazu an die Kontaktadresse oben und nennen Sie Ihre Rufnummer und den ungefähren Zeitpunkt des Anrufs, damit wir Ihre Anrufe finden.</p>\n<p>Sie können sich bei der Aufsichtsbehörde beschweren: in der Schweiz beim Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB, www.edoeb.admin.ch), in der EU bei der zuständigen Datenschutzbehörde an Ihrem Wohnort.</p>`],
            ['8. Verwaltung von AuraCall (für Mitarbeitende)', ul([
                `Für die Anmeldung speichert AuraCall Benutzername, das Passwort nur als Prüfwert (nicht lesbar) und, falls eingerichtet, das Geheimnis der Zwei-Faktor-Anmeldung verschlüsselt.`,
                d.directory ? `Die Anmeldung läuft über <strong>AuraDirect</strong>, die zentrale Benutzerverwaltung: Benutzername und Passwort werden zur Prüfung dorthin gesendet und von AuraCall <strong>nicht gespeichert</strong>; AuraCall speichert nur Benutzername, Namen und Anmeldezeit.` : `Die Anmeldung kann auch über <strong>AuraDirect</strong> (zentrale Benutzerverwaltung) erfolgen; dann werden Benutzername und Passwort nur zur Prüfung dorthin gesendet und nicht gespeichert.`,
                `AuraCall setzt <strong>ein einziges Cookie</strong> („auracall_sid“): Es hält Ihre Anmeldung 12 Stunden aufrecht, ist nur dafür nötig und wird nicht zur Verfolgung verwendet. Es gibt keine Analyse- oder Werbewerkzeuge und keine Inhalte von fremden Servern.`,
                d.required2fa ? `Für alle lokalen Konten ist die Zwei-Faktor-Anmeldung vorgeschrieben.` : `Die Zwei-Faktor-Anmeldung steht zur Verfügung.`,
                ...(d.checkin ? [`<strong>Lizenz:</strong> Die Software meldet sich alle 12 Stunden beim Lizenzserver ihres Herstellers. Übermittelt werden nur der Lizenzschlüssel, eine zufällige Installationskennung, die Programmversion und die Zahl der Konten (dabei sieht der Lizenzserver die Internetadresse dieses Servers). Anrufe, Rufnummern und Gesprächsinhalte werden dabei <strong>nicht</strong> übermittelt.`] : [])])],
            ['9. Datensicherheit', ul([
                `Der Zugang zur Verwaltung ist durch Anmeldung geschützt; nach mehreren Fehlversuchen wird ein Konto vorübergehend gesperrt.`,
                `Die Steuerung der Telefonanlage ist nur auf dem eigenen Rechner erreichbar, nicht aus dem Netzwerk.`,
                `Anrufe sind Telefonie wie üblich: Die Verbindung zwischen Telefonanbieter und unserem Server ist nach heutigem Stand <strong>nicht zusätzlich verschlüsselt</strong>.`])],
            ['10. Änderungen', `<p>Wir passen diese Erklärung an, wenn sich der Telefonservice oder die Rechtslage ändert. Es gilt die jeweils hier veröffentlichte Fassung.</p>`]
        ],
        extra: 'Ergänzende Angaben'
    },
    en: {
        title: 'Privacy Policy', sub: 'AuraCall – telephone assistant "Aura"', updated: 'Last updated', missing: '[Controller not entered yet: fill in under Settings → Privacy in AuraCall]', email: 'Email', phone: 'Phone', dpo: 'Privacy contact', lang: 'Language', print: 'Print',
        sections: (d, ctl) => [
            ['1. Who is responsible?', `<p>The party responsible for processing your personal data in connection with our telephone service is:</p>\n${ctl}`],
            ['2. What is AuraCall?', `<p>AuraCall connects our phone system with the assistant "Aura". When you call us, Aura answers the call and responds to your questions. Sometimes Aura calls someone on behalf of our staff, for example to pass on a message.</p>\n<p><strong>Aura is an artificial intelligence, not a person.</strong> She says so at the start of every call. You can end the call at any time and reach us directly using the contact details above.</p>`],
            ['3. What data do we process during a call?', ul([
                `<strong>Connection data:</strong> the phone number (your number if you call us, the number called if we call you), the time, the duration and the outcome of the call (for example ended, not understood or rejected).`,
                `<strong>What is said:</strong> What you say is converted to text in real time (speech recognition), answered by the AI and played back as speech. <strong>Neither AuraCall nor AuraChat stores audio recordings</strong>; the sound is used only for the conversion to text.`,
                d.store ? `<strong>Call transcript:</strong> The conversation is stored as text (what you and Aura said). Aura tells you so at the start of the call.` : `<strong>Call transcript:</strong> The text of the conversation is not stored after the call.`,
                `<strong>Purpose of our calls:</strong> If we call you, the task Aura is to carry out is stored as well.`,
                `<strong>What you tell us:</strong> Anything you say during the call (for example your name or booking wishes) is used by Aura to reply. Please mention only what is needed for your request.`])],
            ['4. Why, and on what basis?', `<p>We process the data to answer calls, handle enquiries, and run the telephone service securely and reliably (limits, troubleshooting, protection against misuse)${d.store ? ' and to be able to trace the information given' : ''}.</p>\n<p>We rely on our legitimate interest in an accessible and secure telephone service and, where you enquire or book, on preparing or performing a contract. Processing is carried out in good faith and proportionately (Swiss Federal Act on Data Protection, FADP). Where the EU General Data Protection Regulation applies, this is Art. 6(1)(b) and (f) GDPR.</p>`],
            ['5. Who receives the data?', ul([
                `<strong>Our telephone provider</strong> connects the calls and sees phone numbers and times. Its own privacy policy applies. If it processes data abroad, that policy governs.`,
                `<strong>AI processing:</strong> Speech recognition, replies and speech output run through the AuraChat software, which we operate ourselves. Call content is not passed on to other third parties for this purpose unless stated below under "Additional information".`,
                `We <strong>do not use calls to train AI models</strong>, we do not sell data and we do not pass it on for advertising.`,
                `IT service providers have access only within the scope of their assignment.`])],
            ['6. How long do we keep the data?', ul([
                `The call list (number, time, duration, outcome)${d.store ? ' and the call transcripts' : ''} is kept for <strong>${d.days} ${d.days === 1 ? 'day' : 'days'}</strong> and then deleted automatically. On request we can delete individual calls earlier.`,
                `The administration change log (who changed which setting and when, with IP address) keeps the latest 2000 entries.`])],
            ['7. Your rights', `<p>You may request access to your data, have it corrected or deleted, object to or restrict its processing and, where applicable, receive your data in a common format. Write to the contact address above and give your phone number and the approximate time of the call so that we can find your calls.</p>\n<p>You may lodge a complaint with the supervisory authority: in Switzerland the Federal Data Protection and Information Commissioner (FDPIC, www.edoeb.admin.ch), in the EU the competent data protection authority where you live.</p>`],
            ['8. AuraCall administration (for staff)', ul([
                `For sign-in, AuraCall stores the user name, the password only as a check value (not readable) and, if set up, the two-factor secret in encrypted form.`,
                d.directory ? `Sign-in runs through <strong>AuraDirect</strong>, the central user management: user name and password are sent there for checking and are <strong>not stored</strong> by AuraCall; AuraCall stores only the user name, the name and the sign-in time.` : `Sign-in can also run through <strong>AuraDirect</strong> (central user management); user name and password are then sent there only for checking and not stored.`,
                `AuraCall sets <strong>a single cookie</strong> ("auracall_sid"): it keeps you signed in for 12 hours, is needed only for that and is not used for tracking. There are no analytics or advertising tools and no content from third-party servers.`,
                d.required2fa ? `Two-factor sign-in is mandatory for all local accounts.` : `Two-factor sign-in is available.`,
                ...(d.checkin ? [`<strong>Licence:</strong> The software reports to its manufacturer's licence server every 12 hours. Only the licence key, a random installation ID, the program version and the number of accounts are sent (the licence server sees the internet address of this server). Calls, phone numbers and call content are <strong>not</strong> sent.`] : [])])],
            ['9. Data security', ul([
                `Access to the administration is protected by sign-in; after several failed attempts an account is locked temporarily.`,
                `The phone-system control interface is reachable only on the local machine, not from the network.`,
                `Calls are ordinary telephony: the connection between the telephone provider and our server is, as things stand, <strong>not additionally encrypted</strong>.`])],
            ['10. Changes', `<p>We adapt this policy when the telephone service or the legal situation changes. The version published here applies.</p>`]
        ],
        extra: 'Additional information'
    }
};
function renderPrivacy(settings, { lang = 'de', checkin = false } = {}) {
    const l = lang === 'en' ? 'en' : 'de', L = TEXT[l], d = facts(settings, { checkin }), ctl = controllerBlock(d, L);
    const body = L.sections(d, ctl).map(([h, html]) => `<section>\n<h2>${esc(h)}</h2>\n${html}\n</section>`).join('\n');
    const extra = d.c.extra ? `<section>\n<h2>${L.extra}</h2>\n${paragraphs(d.c.extra)}\n</section>` : '';
    const other = l === 'de' ? ['en', 'English'] : ['de', 'Deutsch'];
    return `<!DOCTYPE html>
<html lang="${l}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(L.title)} – AuraCall</title>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/style.css">
</head>
<body class="doc-page">
<main class="doc card">
<header class="doc-head">
<img class="logo-screen" src="/logo-full.png" alt="AuraCall" width="1200" height="291">
<img class="logo-print" src="/logo-full-light.png" alt="AuraCall" width="1200" height="291">
<nav class="noprint small" aria-label="${esc(L.lang)}"><a href="/datenschutz?lang=${other[0]}" hreflang="${other[0]}">${other[1]}</a></nav>
</header>
<h1>${esc(L.title)}</h1>
<p class="muted">${esc(L.sub)} · ${esc(L.updated)}: ${esc(UPDATED[l])}</p>
${body}
${extra}
</main>
</body>
</html>
`;
}
// Sprache: ?lang=de|en, sonst nach dem Browser (Accept-Language), sonst Deutsch
const pickLang = (query, req) => { const q = String((query && query.lang) || '').toLowerCase(); if (q === 'en' || q === 'de') return q; const al = String((req && req.headers && req.headers['accept-language']) || '').toLowerCase(); return /^\s*en\b/.test(al) ? 'en' : 'de'; };
module.exports = { renderPrivacy, pickLang, esc, paragraphs, facts, UPDATED };
