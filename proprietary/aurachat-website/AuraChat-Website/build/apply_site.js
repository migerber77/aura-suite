const fs = require('fs');
const path = require('path');
const { products, shared, DOWNLOADS, LANGS } = require('./content_new.js');

const SITE = process.env.SITE || '/home/claude/website/html';
const tPath = path.join(SITE, 'translations.js');
const hPath = path.join(SITE, 'index.html');

// ------------------------------------------------------------------ 1) translations.js
const tSrc = fs.readFileSync(tPath, 'utf-8');
const translations = new Function(tSrc + '; return translations;')();

for (const lang of LANGS) {
  const T = translations[lang];
  const S = shared[lang];
  T.nav.produkte = S.navProdukte;
  T.ecosystem = S.ecosystem;
  Object.assign(T.quickstart, S.quickstart);               // lead, step1-3, note, button
  T.features.commands = S.commands;
  Object.assign(T.features, S.newCards);                    // hotel, phone, screen
  T.features.memory.desc = S.memoryDesc;
  if (!T.features.ops.desc.endsWith(S.opsAdd)) T.features.ops.desc = T.features.ops.desc + S.opsAdd;   // wiederholbar: nicht doppelt anhängen
  T.integrations.phone.desc = S.phoneOld;
  T.features.integrations.desc = S.integrationsDesc;
  T.auradirect.hero.lead = S.auradirect.heroLead;
  T.auradirect.features.sso.desc = S.auradirect.ssoDesc;
  T.auradirect.pricing.included.sub = S.auradirect.includedSub;
  T.auradirect.pricing.standalone.li2 = S.auradirect.standaloneLi2;
  for (const key of Object.keys(products)) {
    const p = products[key][lang];
    T[key] = { nav: p.nav, hero: p.hero, features: p.features, pricing: p.pricing, downloads: JSON.parse(JSON.stringify(DOWNLOADS[lang])) };
    if (products[key].noQuickstart) delete T[key].downloads.quickstart;   // kein Schnellstart-Paket (AuraCall wird auf Anfrage bereitgestellt)
  }
}
fs.writeFileSync(tPath, 'const translations = ' + JSON.stringify(translations, null, 2) + ';\n', 'utf-8');

// ------------------------------------------------------------------ 2) index.html
let html = fs.readFileSync(hPath, 'utf-8');
const de = shared.de;
function must(cond, msg) { if (!cond) { throw new Error('HTML-Anker nicht gefunden: ' + msg); } }
function replaceOnce(src, from, to, msg) { must(src.includes(from), msg); return src.replace(from, () => to); }

// a) Navigation: AuraPlan + AuraDirect -> ein Link "Produkte"
html = replaceOnce(html,
  `        <a href="#auraplan-section" class="nav-link" data-i18n="auraplan.nav">AuraPlan</a>\n        <a href="#auradirect-section" class="nav-link" data-i18n="auradirect.nav">AuraDirect</a>\n`,
  `        <a href="#produkte" class="nav-link" data-i18n="nav.produkte">${de.navProdukte}</a>\n`, 'Navigation');

// b) Quickstart: Befehle, Hinweis, Button
{
  const m = html.match(/<div style="background:#0b1220;[\s\S]*?<\/p>\s*(?=\n\s*<div style="margin-top:36px;)/);
  must(m, 'Quickstart-Block');
  const box = 'background:#0b1220; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:20px 24px; max-width:640px; margin:0 auto; text-align:left; font-family:\'Courier New\',monospace; font-size:13px; color:#e2e8f0; overflow-x:auto;';
  const U = 'docker compose -p aurachat --env-file .env -f oci://docker.io/migerber77/aurachat:latest';
  const block = `<div style="${box}">
        <div style="color:#64748b;" data-i18n="quickstart.step1">${de.quickstart.step1}</div>
        <div>printf "SESSION_SECRET=%s\\nDISPOSITION_ENCRYPTION_KEY=%s\\n" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" &gt; .env</div>
        <div style="color:#64748b; margin-top:10px;" data-i18n="quickstart.step2">${de.quickstart.step2}</div>
        <div style="color:var(--cyan);">${U} up -d</div>
        <div style="color:#64748b; margin-top:10px;" data-i18n="quickstart.step3">${de.quickstart.step3}</div>
        <div>${U} pull &amp;&amp; ${U} up -d</div>
      </div>
      <p style="color:#94a3b8; font-size:13px; max-width:640px; margin:16px auto 0;" data-i18n="quickstart.note">${de.quickstart.note}</p>
      <p style="margin-top:16px;"><a href="downloads/aurachat-quickstart.zip" download class="btn btn-ghost" data-i18n="quickstart.button">${de.quickstart.button}</a></p>`;
  html = html.replace(m[0], () => block);
  html = html.replace(/(data-i18n="quickstart\.lead">)[^<]*(<)/, (_, a, b) => a + de.quickstart.lead + b);
}

// c) Funktionskarte "Chat- & Sprachbefehle" + neuer Text für Integrationen
html = replaceOnce(html,
  `<p data-i18n="features.whitelabel.desc">`,
  `<p data-i18n="features.whitelabel.desc">`, 'White-Label-Karte');
{
  const m = html.match(/(<h3 data-i18n="features\.whitelabel\.title">[\s\S]*?<\/p>\s*<\/div>)(\s*<\/div>)/);
  must(m, 'Funktionen-Grid-Ende');
  const card = `\n        <div class="card">\n          <div class="icon">🗣️</div>\n          <h3 data-i18n="features.commands.title">${de.commands.title}</h3>\n          <p data-i18n="features.commands.desc">${de.commands.desc}</p>\n        </div>`;
  html = html.replace(m[0], () => m[1] + card + m[2]);
  html = html.replace(/(data-i18n="features\.integrations\.desc">)[^<]*(<)/, (_, a, b) => a + de.integrationsDesc + b);
}

// c2) drei neue Funktionskarten (Hotel, Telefon, Bildschirm) nach "Chat- & Sprachbefehle"; Texte der alten Karten ergänzen
function setText(src, key, text) { const re = new RegExp('(data-i18n="' + key.replace(/\./g, '\\.') + '"[^>]*>)([^<]*)(<)'); must(re.test(src), 'Text ' + key); return src.replace(re, (_, a, _b, c) => a + text + c); }
{
  const N = de.newCards;
  const card = (icon, k, o) => `\n        <div class="card">\n          <div class="icon">${icon}</div>\n          <h3 data-i18n="features.${k}.title">${o.title}</h3>\n          <p data-i18n="features.${k}.desc">${o.desc}</p>\n        </div>`;
  const m = html.match(/(<h3 data-i18n="features\.commands\.title">[\s\S]*?<\/p>\s*<\/div>)(\s*<\/div>)/);
  must(m, 'Befehle-Karte');
  html = html.replace(m[0], () => m[1] + card('🏨', 'hotel', N.hotel) + card('☎️', 'phone', N.phone) + card('🖥️', 'screen', N.screen) + m[2]);
  html = setText(html, 'features.memory.desc', de.memoryDesc);
  html = html.replace(/(data-i18n="features\.ops\.desc">)([^<]*)(<)/, (_, a, b, c) => a + b + de.opsAdd + c);
  html = setText(html, 'integrations.phone.desc', de.phoneOld);
}

// d) AuraDirect: deutsche Standardtexte im HTML angleichen
html = html.replace(/(data-i18n="auradirect\.hero\.lead">)[^<]*(<)/, (_, a, b) => a + de.auradirect.heroLead + b);
html = html.replace(/(data-i18n="auradirect\.features\.sso\.desc">)[^<]*(<)/, (_, a, b) => a + de.auradirect.ssoDesc + b);
html = html.replace(/(data-i18n="auradirect\.pricing\.included\.sub">)[^<]*(<)/, (_, a, b) => a + de.auradirect.includedSub + b);
html = html.replace(/(data-i18n="auradirect\.pricing\.standalone\.li2">)[^<]*(<)/, (_, a, b) => a + de.auradirect.standaloneLi2 + b);

// e) Übersicht "Produkte"
const E = de.ecosystem;
const prodCard = (anchor, icon, key, nameKey, name, desc) => `
        <a class="card" href="#${anchor}" style="text-decoration:none; color:inherit; display:block;">
          <div class="icon">${icon}</div>
          <h3 data-i18n="${nameKey}">${name}</h3>
          <p data-i18n="ecosystem.${key}">${desc}</p>
          <p style="margin-top:12px; color:var(--cyan); font-size:13px; font-weight:600;" data-i18n="ecosystem.more">${E.more}</p>
        </a>`;
const overview = `<section id="produkte" style="border-top:1px solid var(--border);">
    <div class="wrap">
      <div class="section-head">
        <h2 data-i18n="ecosystem.heading">${E.heading}</h2>
        <p data-i18n="ecosystem.lead">${E.lead}</p>
      </div>
      <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); max-width:820px; margin:0 auto 36px;">
        <div class="card"><div class="icon">🧩</div><h3 data-i18n="ecosystem.apps.title">${E.apps.title}</h3><p data-i18n="ecosystem.apps.sub">${E.apps.sub}</p></div>
        <div class="card"><div class="icon">⚙️</div><h3 data-i18n="ecosystem.services.title">${E.services.title}</h3><p data-i18n="ecosystem.services.sub">${E.services.sub}</p></div>
      </div>
      <div class="grid3">${prodCard('auraplan-section', '📅', 'auraplan', 'auraplan.nav', 'AuraPlan', E.auraplan)}${prodCard('auradirect-section', '🔑', 'auradirect', 'auradirect.nav', 'AuraDirect', E.auradirect)}${prodCard('auramail-section', products.auramail.icon, 'auramail', 'auramail.nav', 'AuraMail', E.auramail)}${prodCard('auraticket-section', products.auraticket.icon, 'auraticket', 'auraticket.nav', 'AuraTicket', E.auraticket)}${prodCard('auraproxy-section', products.auraproxy.icon, 'auraproxy', 'auraproxy.nav', 'AuraProxy', E.auraproxy)}${prodCard('auracall-section', products.auracall.icon, 'auracall', 'auracall.nav', 'AuraCall', E.auracall)}
      </div>
    </div>
  </section>

  `;
must(html.includes('<section id="auraplan-section"'), 'AuraPlan-Abschnitt');
html = html.replace('<section id="auraplan-section"', () => overview + '<section id="auraplan-section"');

// f) drei Produktabschnitte vor "Bewertungen"
const FILES = {
  de: n => `${n}-Datenblatt.docx`, en: n => `${n}-Datasheet-EN.docx`, fr: n => `${n}-Fiche-produit-FR.docx`,
  it: n => `${n}-Scheda-prodotto-IT.docx`, es: n => `${n}-Ficha-producto-ES.docx`
};
const FLAGS = { de: '🇩🇪 DE', en: '🇬🇧 EN', fr: '🇫🇷 FR', it: '🇮🇹 IT', es: '🇪🇸 ES' };
function productSectionBase(key) {
  const p = products[key], d = p.de, k = key;
  const cards = [1, 2, 3, 4, 5, 6].map(i => `        <div class="card"><div class="icon">${p.cardIcons[i - 1]}</div><h3 data-i18n="${k}.features.f${i}.title">${d.features['f' + i].title}</h3><p data-i18n="${k}.features.f${i}.desc">${d.features['f' + i].desc}</p></div>`).join('\n');
  const links = LANGS.map(l => `          <a href="downloads/${FILES[l](p.file)}" download style="color:var(--cyan); font-size:13px; font-weight:600; text-decoration:none;">${FLAGS[l]}</a>`).join('\n');
  const li = (group, n) => d.pricing[group]['li' + n] ? `            <li data-i18n="${k}.pricing.${group}.li${n}">${d.pricing[group]['li' + n]}</li>` : '';
  return `<section id="${k}-section" style="border-top:1px solid var(--border);">
    <div class="wrap">
      <div class="section-head">
        <h2 data-i18n="${k}.hero.title">${d.hero.title}</h2>
        <p data-i18n="${k}.hero.lead">${d.hero.lead}</p>
      </div>
      <div class="section-head">
        <h3 data-i18n="${k}.features.heading">${d.features.heading}</h3>
      </div>
      <div class="grid3">
${cards}
      </div>
      <div class="pricing-grid" style="margin-top:40px; max-width:700px; margin-left:auto; margin-right:auto;">
        <div class="price-card popular">
          <span class="price-badge" data-i18n="pricing.popular">Beliebt</span>
          <h3 data-i18n="${k}.pricing.a.title">${d.pricing.a.title}</h3>
          <p class="price" data-i18n="${k}.pricing.a.price">${d.pricing.a.price}</p>
          <p class="sub" data-i18n="${k}.pricing.a.sub">${d.pricing.a.sub}</p>
          <ul>
${[1, 2, 3].map(n => li('a', n)).filter(Boolean).join('\n')}
          </ul>
        </div>
        <div class="price-card">
          <h3 data-i18n="${k}.pricing.b.title">${d.pricing.b.title}</h3>
          <p class="price" data-i18n="${k}.pricing.b.price">${d.pricing.b.price}</p>
          <p class="sub" data-i18n="${k}.pricing.b.sub">${d.pricing.b.sub}</p>
          <ul>
${[1, 2, 3].map(n => li('b', n)).filter(Boolean).join('\n')}
          </ul>
        </div>
      </div>
      <p class="price-note" data-i18n="${k}.pricing.note">${d.pricing.note}</p>
      <div class="card" style="margin-top:32px; max-width:420px; margin-left:auto; margin-right:auto;">
        <div class="icon">📄</div>
        <h3 data-i18n="${k}.downloads.sheet.title">${DOWNLOADS.de.sheet.title}</h3>
        <p data-i18n="${k}.downloads.sheet.desc">${DOWNLOADS.de.sheet.desc}</p>
        <div style="margin-top:14px; display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
${links}
        </div>
      </div>
      <div class="card" style="margin-top:16px; max-width:420px; margin-left:auto; margin-right:auto;">
        <div class="icon">🐳</div>
        <h3 data-i18n="${k}.downloads.quickstart.title">${DOWNLOADS.de.quickstart.title}</h3>
        <p data-i18n="${k}.downloads.quickstart.desc">${DOWNLOADS.de.quickstart.desc}</p>
        <a href="downloads/${p.zip}" download data-i18n="${k}.downloads.quickstart.button" style="display:inline-block; margin-top:14px; color:var(--cyan); font-size:13px; font-weight:600; text-decoration:none;">${DOWNLOADS.de.quickstart.button}</a>
      </div>
    </div>
  </section>

  `;
}
function productSection(key) {
  const out = productSectionBase(key);
  if (!products[key].noQuickstart) return out;
  const re = /<div class="card" style="margin-top:16px;[^"]*">\s*<div class="icon">🐳<\/div>[\s\S]*?<\/div>\s*(?=<\/div>\s*<\/section>)/;
  must(re.test(out), 'Schnellstart-Karte von ' + key);
  const tr = DOWNLOADS.de.trial;
  return out.replace(re, () => `<div class="card" style="margin-top:16px; max-width:420px; margin-left:auto; margin-right:auto;">
        <div class="icon">✉️</div>
        <h3 data-i18n="${key}.downloads.trial.title">${tr.title}</h3>
        <p data-i18n="${key}.downloads.trial.desc">${tr.desc}</p>
        <a href="#kontakt" data-i18n="${key}.downloads.trial.button" style="display:inline-block; margin-top:14px; color:var(--cyan); font-size:13px; font-weight:600; text-decoration:none;">${tr.button}</a>
      </div>
    `);
}
{
  const m = html.match(/<section[^>]*id="bewertungen"/);
  must(m, 'Bewertungen-Abschnitt');
  html = html.replace(m[0], () => productSection('auramail') + productSection('auraticket') + productSection('auraproxy') + productSection('auracall') + m[0]);
}
// g) Suchmaschinen-Angaben: Beschreibung und Merkmalsliste (nur, was sichtbar auf der Seite steht)
{
  const OLD = 'Selbst gehosteter KI-Assistent mit Avatar, Stimme und Gedächtnis. Anbindung an Ollama, Websuche, Microsoft 365. Kostenlos starten, eure Daten bleiben bei euch.';
  must(html.split(OLD).length - 1 === 4, 'Beschreibung (meta, og, twitter, JSON-LD: erwartet 4 Stellen)');
  html = html.split(OLD).join(shared.seo.de);
  const F = '        "E-Mail per IMAP oder Microsoft 365"';
  must(html.includes(F), 'Merkmalsliste');
  html = html.replace(F, F + ',\n        "Hotel-Anbindung an Apaleo für Mitarbeitende und Gäste",\n        "Telefon-Anbindung (AuraCall): Aura nimmt Anrufe an und ruft an",\n        "Kiosk-Ansicht in Quer- und Hochformat mit Drehung"');
}
// h) Der deutsche Text im HTML entspricht überall der deutschen Übersetzung (Suchmaschinen führen kein JavaScript aus und lesen nur das HTML;
//    bei AuraPlan/AuraDirect war er früher leer oder abgeschnitten). Nur Elemente mit reinem Text, nichts mit Unterelementen.
{
  const deT = new Function(fs.readFileSync(tPath, 'utf-8') + '; return translations;')().de;
  const get = (k) => k.split('.').reduce((n, part) => (n && typeof n === 'object') ? n[part] : undefined, deT);
  let n = 0;
  html = html.replace(/(<(\w+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/g, (all, open, tag, key, inner, close) => {
    const v = get(key); if (typeof v !== 'string' || /[<]/.test(v) || v === inner) return all; n++; return open + v + close;
  });
  console.log('Deutsche Texte im HTML angeglichen:', n);
}
fs.writeFileSync(hPath, html, 'utf-8');

// ------------------------------------------------------------------ 3) Prüfung: jeder Schlüssel in jeder Sprache?
const check = new Function(fs.readFileSync(tPath, 'utf-8') + '; return translations;')();
const keys = [...new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]))];
const missing = [];
for (const lang of LANGS) for (const k of keys) {
  let node = check[lang]; for (const part of k.split('.')) node = node && node[part];
  if (node === undefined) missing.push(`${lang}: ${k}`);
}
console.log('Textschlüssel im HTML:', keys.length, '| fehlend (in irgendeiner Sprache):', missing.length);
if (missing.length) console.log(missing.slice(0, 30).join('\n'));
const secs = [...html.matchAll(/<section[^>]*id="([^"]+)"/g)].map(m => m[1]);
console.log('Abschnitte:', secs.join(', '));
console.log('<section> offen/zu:', (html.match(/<section/g) || []).length, '/', (html.match(/<\/section>/g) || []).length, '| <div> offen/zu:', (html.match(/<div/g) || []).length, '/', (html.match(/<\/div>/g) || []).length);
