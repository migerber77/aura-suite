/* Sprache der Aura-Suite (gemeinsame Datei für alle Produkte, überall byte-gleich).
 *
 * Deutsch ist die Quellsprache: Die Programme enthalten ihre Texte auf Deutsch. Diese Datei übersetzt sichtbare Texte (und placeholder, title, aria-label, alt) in
 * Englisch, Italienisch, Französisch oder Spanisch, auch für Texte, die erst später eingefügt werden (Beobachter). Bei "Deutsch" werden alle Texte zurückgesetzt.
 *
 *   AuraI18n.add({ 'Deutscher Text': { en: '…', it: '…', fr: '…', es: '…' }, 'Noch {} Tage': { … } })   Wörterbuch ergänzen; {} = beliebiger Teil (gleiche Zahl in jeder Sprache)
 *   AuraI18n.lang() / AuraI18n.set('en')   aktuelle Sprache lesen / umstellen (gespeichert im Browser, Schlüssel "aura_lang"; Standard: de)
 *   AuraI18n.onChange(fn)                  fn(lang) bei jeder Änderung (auch aus einem anderen Tab)
 *   AuraI18n.select(el)                    hängt die Sprachauswahl in el ein (die Karte "Darstellung" ruft das auf)
 *   AuraI18n.t(text)                       übersetzt einen deutschen Text sofort (für Meldungen, die ein Programm selbst zusammensetzt)
 * Nicht übersetzt werden: <script>, <style>, <textarea>, <code>, <pre>, Eingabefelder und alles in einem Element mit data-i18n-skip oder contenteditable (z. B. Chat-Nachrichten,
 * Tickets, E-Mails, Texte der Datenschutzerklärung). Übersetzt wird nur, was GANZ einem Eintrag im Wörterbuch entspricht (Leerraum am Rand bleibt erhalten).
 * Ohne Abhängigkeiten, ohne innerHTML, ohne Inline-Stile im Markup. */
(function () {
  'use strict';
  if (window.AuraI18n) return;
  var KEY = 'aura_lang', LANGS = { de: 'Deutsch', en: 'English', it: 'Italiano', fr: 'Français', es: 'Español' }, ORDER = ['de', 'en', 'it', 'fr', 'es'];
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'], SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, INPUT: 1, SELECT: 0 };
  var exact = Object.create(null), patterns = [], listeners = [], current = null, textSrc = new WeakMap(), attrSrc = new WeakMap(), mo = null, queue = [], scheduled = false, writing = false;

  var later = function (fn) { if (window.queueMicrotask) window.queueMicrotask(fn); else Promise.resolve().then(fn); };
  function stored() { try { var v = window.localStorage.getItem(KEY); return LANGS[v] ? v : null; } catch (e) { return null; } }
  function lang() { if (current === null) current = stored() || 'de'; return current; }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function add(map) {
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (src) {
      var tr = map[src]; if (!tr || typeof tr !== 'object') return;
      var clean = {}; ['en', 'it', 'fr', 'es'].forEach(function (l) { if (typeof tr[l] === 'string' && tr[l]) clean[l] = tr[l]; });
      if (src.indexOf('{}') >= 0) {
        var parts = src.split('{}'), rx = new RegExp('^' + parts.map(esc).join('(.+?)') + '$');
        patterns.push({ rx: rx, n: parts.length - 1, tr: clean });
      } else exact[src] = clean;
    });
    if (current !== null ? current !== 'de' : stored() && stored() !== 'de') fullLater();
  }
  var fullScheduled = false;
  function fullLater() { if (fullScheduled) return; fullScheduled = true; later(function () { fullScheduled = false; if (document.documentElement) applyAll(); }); }
  // übersetzt einen Text (ohne Leerraum am Rand) in die Sprache l; liefert null, wenn es keinen Eintrag gibt
  function lookup(text, l) {
    if (l === 'de') return null;
    var e = exact[text]; if (e && e[l]) return e[l];
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i], m = p.rx.exec(text);
      if (m && p.tr[l]) { var k = 0; return p.tr[l].replace(/\{\}/g, function () { return m[++k] !== undefined ? m[k] : ''; }); }
    }
    return null;
  }
  function t(text) { if (typeof text !== 'string') return text; var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text), r = lookup(m[2], lang()); return r === null ? text : m[1] + r + m[3]; }

  // Ausgenommen: Elemente mit data-i18n-skip oder contenteditable (samt Inhalt) und bestimmte Tags (Inhalt wird nicht übersetzt; placeholder & Co. schon)
  function flagged(n) { return n.nodeType === 1 && (n.hasAttribute('data-i18n-skip') || n.getAttribute('contenteditable') === 'true' || n.getAttribute('contenteditable') === ''); }
  function inFlagged(el) { for (var n = el; n && n.nodeType === 1; n = n.parentNode) if (flagged(n) || SKIP_TAGS[n.tagName] === 1) return true; return false; }
  function doText(node, l) {
    var cur = node.nodeValue, rec = textSrc.get(node), src;
    if (rec && cur === rec.out) src = rec.src; else src = cur;                 // sonst hat das Programm den Text neu gesetzt: das ist die neue Quelle
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(src); if (!m[2]) { if (rec) textSrc.delete(node); return; }
    var r = lookup(m[2], l), out = r === null ? src : m[1] + r + m[3];
    if (r === null && !rec) return;                                           // nichts zu tun, nichts merken
    textSrc.set(node, { src: src, out: out }); if (cur !== out) node.nodeValue = out;
  }
  function doAttrs(el, l) {
    var rec = attrSrc.get(el); if (!rec) rec = {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) { delete rec[a]; return; }
      var cur = el.getAttribute(a), r0 = rec[a], src = (r0 && cur === r0.out) ? r0.src : cur, m = /^(\s*)([\s\S]*?)(\s*)$/.exec(src);
      var r = m[2] ? lookup(m[2], l) : null, out = r === null ? src : m[1] + r + m[3];
      if (r === null && !r0) return;
      rec[a] = { src: src, out: out }; if (cur !== out) el.setAttribute(a, out);
    });
    if (Object.keys(rec).length) attrSrc.set(el, rec); else attrSrc.delete(el);
  }
  function walk(root, l) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && !inFlagged(root.parentNode)) doText(root, l); return; }
    if (root.nodeType === 1 && root.parentNode && inFlagged(root.parentNode)) return;      // Vorfahren prüfen wir nur einmal, danach beim Hinabsteigen nur das Element selbst
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    var stack = [root];
    while (stack.length) {
      var n = stack.pop();
      if (n.nodeType === 1) {
        if (flagged(n)) continue;
        if (n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') doAttrs(n, l);
        if (SKIP_TAGS[n.tagName] === 1) continue;
      }
      for (var c = n.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3) doText(c, l); else if (c.nodeType === 1) stack.push(c); }
    }
  }
  function applyAll() {
    writing = true; try { walk(document.documentElement, lang()); document.documentElement.setAttribute('lang', lang()); if (document.title !== undefined) { var tt = document.title; var rec = titleRec; var src = (rec && tt === rec.out) ? rec.src : tt, r = lookup((src || '').trim(), lang()); var out = r === null ? src : r; if (r !== null || rec) { titleRec = { src: src, out: out }; if (tt !== out) document.title = out; } } } finally { writing = false; }
    if (mo) mo.takeRecords();
  }
  var titleRec = null;
  function flush() {
    scheduled = false; var items = queue; queue = []; var l = lang();
    writing = true; try { items.forEach(function (n) { if (n.isConnected !== false) walk(n, l); }); } finally { writing = false; }
    if (mo) mo.takeRecords();
  }
  // Sofort nach dem Einfügen (Mikroaufgabe, noch vor dem nächsten Zeichnen), damit nie deutscher Text aufblitzt
  function schedule(n) { queue.push(n); if (!scheduled) { scheduled = true; later(flush); } }
  function startObserver() {
    if (mo || !window.MutationObserver) return;
    mo = new MutationObserver(function (recs) {
      if (writing) return;
      recs.forEach(function (r) {
        if (r.type === 'childList') r.addedNodes.forEach(function (n) { schedule(n); });
        else if (r.type === 'characterData') schedule(r.target);
        else if (r.type === 'attributes') schedule(r.target);
      });
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function fire() { listeners.slice().forEach(function (fn) { try { fn(lang()); } catch (e) { /* ein Hörer darf die anderen nicht stören */ } }); }
  function set(l) {
    if (!LANGS[l]) return false; current = l;
    try { window.localStorage.setItem(KEY, l); } catch (e) { /* gesperrter Speicher: gilt für diese Sitzung */ }
    applyAll(); syncSelects(); fire(); return true;
  }
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

  var selects = [];
  function syncSelects() { selects.forEach(function (s) { if (s.value !== lang()) s.value = lang(); }); selects = selects.filter(function (s) { return s.isConnected !== false; }); }
  function select(container) {
    if (!container || container.nodeType !== 1) return null;
    var wrap = document.createElement('div'); wrap.setAttribute('data-aura-i18n', 'language'); Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' });
    var id = 'aura-i18n-' + Math.floor(Math.random() * 1e9), label = document.createElement('label'); label.setAttribute('for', id); label.textContent = '🌐 Sprache'; Object.assign(label.style, { fontWeight: '600', color: '#fff' });
    var sel = document.createElement('select'); sel.id = id; sel.setAttribute('data-aura-i18n', 'select'); sel.setAttribute('aria-label', 'Sprache');
    Object.assign(sel.style, { background: '#020617', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit' });
    ORDER.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = LANGS[c]; o.setAttribute('lang', c); sel.appendChild(o); });
    sel.value = lang(); sel.addEventListener('change', function () { set(sel.value); });
    wrap.appendChild(label); wrap.appendChild(sel); container.appendChild(wrap); selects.push(sel); return sel;
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) { var v = stored(); if (v && v !== current) { current = v; applyAll(); syncSelects(); fire(); } } });
  startObserver();
  if (lang() !== 'de') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAll); applyAll(); }
  window.AuraI18n = Object.freeze({ add: add, lang: lang, set: set, onChange: onChange, select: select, t: t, languages: Object.assign({}, LANGS), version: 1 });
})();
