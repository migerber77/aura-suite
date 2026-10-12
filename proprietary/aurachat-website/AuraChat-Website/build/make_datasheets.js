const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, HeadingLevel, LevelFormat, Footer, PageNumber
} = require('docx');
const { products, LANGS } = require('./content_new.js');

const OUT = process.env.OUT || '/home/claude/website/html/downloads';
const ONLY = process.argv[2] || '';   // z.B. "auracall": nur dieses Produkt erzeugen (die anderen Datenblätter bleiben unverändert)
const FONT = 'Calibri', ACCENT = '1F4E79', HEAD_FILL = 'DCE6F1', W = 9638;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const plain = s => String(s).replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');

const FILES = {
  de: n => `${n}-Datenblatt.docx`, en: n => `${n}-Datasheet-EN.docx`, fr: n => `${n}-Fiche-produit-FR.docx`,
  it: n => `${n}-Scheda-prodotto-IT.docx`, es: n => `${n}-Ficha-producto-ES.docx`
};
const LABEL = {
  de: { sheet: 'Datenblatt', features: 'Funktionen', licensing: 'Lizenzmodell', quick: 'Schnellstart', needs: 'Voraussetzung', ui: 'Web-Oberfläche', login: 'Erste Anmeldung', loginVal: 'admin / admin (bitte sofort ändern)', pkg: 'Das Quickstart-Paket findet ihr auf der Website im Bereich des jeweiligen Produkts.', docker: 'Docker mit Docker Compose.' },
  en: { sheet: 'Datasheet', features: 'Features', licensing: 'Licensing', quick: 'Quick start', needs: 'Requirements', ui: 'Web interface', login: 'First login', loginVal: 'admin / admin (change immediately)', pkg: 'You will find the quickstart package on the website, in the section of the respective product.', docker: 'Docker with Docker Compose.' },
  fr: { sheet: 'Fiche produit', features: 'Fonctionnalités', licensing: 'Modèle de licence', quick: 'Démarrage rapide', needs: 'Prérequis', ui: 'Interface web', login: 'Première connexion', loginVal: 'admin / admin (à changer immédiatement)', pkg: 'Le paquet de démarrage rapide se trouve sur le site web, dans la section du produit concerné.', docker: 'Docker avec Docker Compose.' },
  it: { sheet: 'Scheda prodotto', features: 'Funzionalità', licensing: 'Modello di licenza', quick: 'Avvio rapido', needs: 'Requisiti', ui: 'Interfaccia web', login: 'Primo accesso', loginVal: 'admin / admin (da cambiare subito)', pkg: 'Il pacchetto Quickstart si trova sul sito web, nella sezione del rispettivo prodotto.', docker: 'Docker con Docker Compose.' },
  es: { sheet: 'Ficha de producto', features: 'Funciones', licensing: 'Modelo de licencia', quick: 'Inicio rápido', needs: 'Requisitos', ui: 'Interfaz web', login: 'Primer acceso', loginVal: 'admin / admin (cambiar de inmediato)', pkg: 'El paquete de inicio rápido está en el sitio web, en la sección de cada producto.', docker: 'Docker con Docker Compose.' }
};
// produktspezifische Voraussetzungen
const NEEDS = {
  auramail: {
    de: 'Für den Empfang aus dem Internet im Modus „eigener Mailserver“ muss Port 25 extern auf Port 2525 weitergeleitet werden. Mit Microsoft 365 oder IMAP/SMTP nicht nötig.',
    en: 'To receive mail from the internet in “own mail server” mode, forward external port 25 to port 2525. Not needed with Microsoft 365 or IMAP/SMTP.',
    fr: 'Pour recevoir du courrier depuis Internet en mode « serveur de messagerie propre », rediriger le port externe 25 vers le port 2525. Inutile avec Microsoft 365 ou IMAP/SMTP.',
    it: 'Per ricevere posta da Internet in modalità «server di posta proprio» inoltrare la porta esterna 25 alla porta 2525. Non necessario con Microsoft 365 o IMAP/SMTP.',
    es: 'Para recibir correo desde Internet en modo «servidor de correo propio», redirige el puerto externo 25 al puerto 2525. No es necesario con Microsoft 365 o IMAP/SMTP.'
  },
  auraticket: {
    de: 'Für E-Mail-zu-Ticket und den Versand von Antworten wird AuraMail benötigt (Dienst-Schlüssel im Admin Panel eintragen).',
    en: 'AuraMail is required for email-to-ticket and for sending replies (enter its service key in the admin panel).',
    fr: "AuraMail est nécessaire pour la conversion e-mail en ticket et l'envoi des réponses (saisir sa clé de service dans le panneau d'administration).",
    it: "AuraMail è necessario per la conversione e-mail in ticket e per l'invio delle risposte (inserire la sua chiave di servizio nel pannello di amministrazione).",
    es: 'Se necesita AuraMail para convertir correos en tickets y enviar respuestas (introducir su clave de servicio en el panel de administración).'
  },
  auraproxy: {
    de: 'Die Ports 80 und 443 müssen frei und von aussen erreichbar sein. Port 80 bleibt auch für andere Ports für die Let\'s-Encrypt-Prüfung offen. Die Verwaltungsoberfläche (Port 3500) nicht öffentlich freigeben.',
    en: 'Ports 80 and 443 must be free and reachable from outside. Port 80 also stays open for the Let\'s Encrypt check when using other ports. Do not expose the management interface (port 3500) publicly.',
    fr: "Les ports 80 et 443 doivent être libres et accessibles depuis l'extérieur. Le port 80 reste aussi ouvert pour la vérification Let's Encrypt avec d'autres ports. Ne pas exposer l'interface d'administration (port 3500) publiquement.",
    it: "Le porte 80 e 443 devono essere libere e raggiungibili dall'esterno. La porta 80 resta aperta anche per la verifica di Let's Encrypt con altre porte. Non esporre pubblicamente l'interfaccia di gestione (porta 3500).",
    es: 'Los puertos 80 y 443 deben estar libres y accesibles desde fuera. El puerto 80 permanece abierto también para la comprobación de Let\'s Encrypt con otros puertos. No expongas públicamente la interfaz de administración (puerto 3500).'
  }
};

NEEDS.auracall = {
  de: 'AuraChat mit den Premium-Funktionen „Externe API“ und „Telefonie“, ein SIP-Anbieter mit Rufnummer. Vom Anbieter erreichbar sein müssen UDP 5060 (SIP) und UDP 10000–10100 (Ton); die Verwaltung (Port 8110) nicht öffentlich freigeben.',
  en: 'AuraChat with the premium features “External API” and “Telephony”, and a SIP provider with a phone number. The provider must be able to reach UDP 5060 (SIP) and UDP 10000–10100 (audio); do not expose the management interface (port 8110) publicly.',
  fr: "AuraChat avec les fonctions Premium « API externe » et « Téléphonie », et un opérateur SIP avec un numéro. L'opérateur doit pouvoir joindre UDP 5060 (SIP) et UDP 10000–10100 (audio) ; ne pas exposer publiquement l'interface d'administration (port 8110).",
  it: "AuraChat con le funzioni Premium «API esterna» e «Telefonia», e un provider SIP con un numero. Il provider deve poter raggiungere UDP 5060 (SIP) e UDP 10000–10100 (audio); non esporre pubblicamente l'interfaccia di gestione (porta 8110).",
  es: 'AuraChat con las funciones Premium «API externa» y «Telefonía», y un proveedor SIP con un número. El proveedor debe poder alcanzar UDP 5060 (SIP) y UDP 10000–10100 (audio); no expongas públicamente la interfaz de administración (puerto 8110).'
};
const run = (t, o = {}) => new TextRun({ text: plain(t), font: FONT, size: 21, ...o });
const para = (t, o = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...o, children: [run(t, o.run || {})] });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 300, after: 130 }, children: [new TextRun({ text: plain(t), font: FONT, bold: true, size: 28, color: ACCENT })] });
const code = t => new Paragraph({ spacing: { after: 40 }, shading: { fill: 'F2F2F2', type: ShadingType.CLEAR, color: 'auto' }, children: [new TextRun({ text: t, font: 'Courier New', size: 19 })] });
function cell(paras, width, fill) {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: BORDERS, shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: paras });
}

function build(key, lang) {
  const p = products[key], d = p[lang], L = LABEL[lang];
  const kids = [];
  kids.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: p.file, font: FONT, bold: true, size: 48, color: ACCENT })] }));
  kids.push(new Paragraph({ spacing: { after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 } }, children: [new TextRun({ text: L.sheet, font: FONT, size: 24, color: '595959' })] }));
  kids.push(para(d.hero.title, { run: { bold: true, size: 26 } }));
  kids.push(para(d.hero.lead));

  kids.push(h1(L.features));
  kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [3000, 6638], rows: [1, 2, 3, 4, 5, 6].map(i => {
    const f = d.features['f' + i];
    return new TableRow({ cantSplit: true, children: [cell([new Paragraph({ children: [run(f.title, { bold: true })] })], 3000, HEAD_FILL), cell([new Paragraph({ children: [run(f.desc)] })], 6638)] });
  }) }));

  kids.push(h1(L.licensing));
  const priceCell = (g, fill) => {
    const c = d.pricing[g];
    const items = [1, 2, 3].filter(n => c['li' + n]).map(n => new Paragraph({ spacing: { after: 40 }, children: [run(c['li' + n])] }));
    return cell([
      new Paragraph({ spacing: { after: 40 }, children: [run(c.title, { bold: true, size: 24, color: ACCENT })] }),
      new Paragraph({ spacing: { after: 40 }, children: [run(c.price, { bold: true, size: 32 })] }),
      new Paragraph({ spacing: { after: 100 }, children: [run(c.sub, { color: '595959' })] }),
      ...items
    ], 4819, fill);
  };
  kids.push(new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [4819, 4819], rows: [new TableRow({ cantSplit: true, children: [priceCell('a', 'EEF4FB'), priceCell('b')] })] }));
  kids.push(para(d.pricing.note, { spacing: { before: 100, after: 120 }, run: { size: 18, color: '7F7F7F' } }));

  kids.push(h1(L.quick));
  const c = lang === 'fr' ? ' :' : ':';
  kids.push(para(`${L.needs}${c} ${L.docker} ${NEEDS[key][lang]}`));
  const name = p.file.toLowerCase();
  if (p.noQuickstart) {   // AuraCall: kein fertiges Hub-Paket; Bereitstellung auf Anfrage, Einrichtung mit setup.sh
    kids.push(code(`unzip ${p.file}.zip -d ${name} && cd ${name}`));
    kids.push(code('./setup.sh'));
    kids.push(code('docker compose build && docker compose up -d'));
    kids.push(para(`${L.ui}${c} http://<Server-IP>:${p.port}   ·   ${L.login}${c} ${p.loginVal[lang]}`, { spacing: { before: 120, after: 80 } }));
  } else {
    kids.push(code(`unzip ${p.zip} -d ${name} && cd ${name}`));
    kids.push(code('cp .env.example .env && nano .env'));
    kids.push(code('docker compose up -d'));
    kids.push(para(`${L.ui}${c} http://<Server-IP>:${p.port}   ·   ${L.login}${c} ${L.loginVal}`, { spacing: { before: 120, after: 80 } }));
    kids.push(para(L.pkg, { run: { color: '595959' } }));
  }

  return new Document({
    creator: 'Gerber Backoffice Solutions', title: `${p.file} – ${L.sheet}`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: `${p.file} · Gerber Backoffice Solutions · `, font: FONT, size: 18, color: '7F7F7F' }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '7F7F7F' })
      ] })] }) },
      children: kids
    }]
  });
}

(async () => {
  let n = 0;
  for (const key of Object.keys(products).filter(k => !ONLY || k === ONLY)) for (const lang of LANGS) {
    const buf = await Packer.toBuffer(build(key, lang));
    fs.writeFileSync(`${OUT}/${FILES[lang](products[key].file)}`, buf);
    n++;
  }
  console.log('Datenblätter erzeugt:', n);
})();
