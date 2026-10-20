/* Darstellung und Sprache der Aura-Suite (gemeinsame Datei für alle Produkte, überall byte-gleich).
 *
 * Hell/Dunkel/Automatisch: Alle Produkte sind für Dunkel gebaut. Das Hell-Design kehrt die Farben der ganzen Seite um (Filter invert + hue-rotate auf <html>); Bilder und Videos
 * werden zurückgedreht, damit sie natürlich aussehen. Stellen, die dabei nicht umgekehrt werden sollen (z. B. ein Foto in einem Rahmen), bekommen das Attribut data-aura-keep;
 * Elemente mit einem Hintergrundbild, das im Hell-Design wegfallen soll, das Attribut data-aura-bg.
 *
 * Einbindung (in den <head>, synchron, damit nichts im falschen Design aufblitzt):   <script src="/pfad/aura-prefs.js"></script>
 *   AuraPrefs.get()        'dark' | 'light' | 'auto'  (gespeichert im Browser, Schlüssel "aura_theme"; Standard: dark, wie bisher)
 *   AuraPrefs.effective()  'dark' | 'light'  (bei auto nach der Einstellung des Geräts)
 *   AuraPrefs.set(mode)    stellt um und speichert
 *   AuraPrefs.onChange(fn) fn(mode, effective) bei jeder Änderung (auch aus einem anderen Tab und wenn das Gerät umschaltet)
 *   AuraPrefs.card(el, { language: false })   baut die Karte "Darstellung" (Dunkel / Hell / Automatisch, dazu die Sprachauswahl, wenn aura-i18n.js geladen ist; language:false lässt sie weg) in el; mehrere Karten bleiben im Gleichlauf
 * Ohne Abhängigkeiten, ohne innerHTML, ohne Inline-Stile im Markup (Script-Quelle 'self' genügt: Stile werden über CSSOM gesetzt). */
(function () {
  'use strict';
  if (window.AuraPrefs) return;
  var KEY = 'aura_theme', MODES = ['dark', 'light', 'auto'], FILTER = 'invert(1) hue-rotate(180deg)';
  var mq = null; try { mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null; } catch (e) { mq = null; }
  var memory = null, listeners = [], cards = [], sheetDone = false;

  function stored() { try { var v = window.localStorage.getItem(KEY); return MODES.indexOf(v) >= 0 ? v : null; } catch (e) { return null; } }
  function get() { var v = stored(); return v || (MODES.indexOf(memory) >= 0 ? memory : 'dark'); }
  function effective() { var m = get(); return m === 'auto' ? (mq && mq.matches ? 'light' : 'dark') : m; }
  function t(key, fallback) { return fallback; }   // deutscher Text ist die Quelle: aura-i18n.js übersetzt ihn (auch später eingefügte Texte)
  function el(tag, style, attrs) {
    var e = document.createElement(tag); if (style) Object.assign(e.style, style);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    return e;
  }
  // Rückdrehung für Medien und Ausnahmen: über CSSOM (eine "konstruierbare" Stilvorlage ist durch eine strenge Sicherheitsrichtlinie nicht blockiert), sonst als <style>
  var RULES = [
    'html[data-theme="light"] img, html[data-theme="light"] video, html[data-theme="light"] picture, html[data-theme="light"] [data-aura-keep], html[data-theme="light"] [data-aura-intro="overlay"] { filter: ' + FILTER + '; }',
    'html[data-theme="light"] [data-aura-keep] img, html[data-theme="light"] [data-aura-keep] video, html[data-theme="light"] [data-aura-intro="overlay"] video, html[data-theme="light"] [data-aura-intro="overlay"] img { filter: none; }',
    'html[data-theme="light"] [data-aura-bg] { background-image: none !important; }'   // Elemente mit eigenem Hintergrundbild (data-aura-bg): im Hell-Design ohne das Bild, sonst würde es mit umgekehrt
  ];
  function ensureSheet() {
    if (sheetDone) return; sheetDone = true;
    try { var s = new window.CSSStyleSheet(); RULES.forEach(function (r) { s.insertRule(r, s.cssRules.length); }); document.adoptedStyleSheets = Array.prototype.slice.call(document.adoptedStyleSheets || []).concat([s]); return; } catch (e) { /* ältere Browser */ }
    try { var st = document.createElement('style'); st.setAttribute('data-aura-prefs', ''); st.textContent = RULES.join('\n'); (document.head || document.documentElement).appendChild(st); } catch (e2) { /* ohne Rückdrehung bleibt das Hell-Design lesbar */ }
  }
  function apply() {
    var de = document.documentElement, eff = effective();
    de.setAttribute('data-theme', eff);
    if (eff === 'light') {
      ensureSheet(); de.style.filter = FILTER;
    } else { de.style.filter = ''; }
  }
  function fire() { var m = get(), e = effective(); listeners.slice().forEach(function (fn) { try { fn(m, e); } catch (x) { /* ein Hörer darf die anderen nicht stören */ } }); cards.forEach(function (c) { c.sync(); }); }
  function set(mode) {
    if (MODES.indexOf(mode) < 0) return false; memory = mode;
    try { window.localStorage.setItem(KEY, mode); } catch (e) { /* gesperrter Speicher: gilt nur für diese Sitzung */ }
    apply(); fire(); return true;
  }
  function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }
  if (mq) { var on = function () { if (get() === 'auto') { apply(); fire(); } }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) { apply(); fire(); } });
  apply();

  var uid = 0;
  function card(container, opts) {
    if (!container || container.nodeType !== 1) return null;
    while (container.firstChild) container.removeChild(container.firstChild);
    var id = 'aura-prefs-' + (++uid), box = el('fieldset', { border: '1px solid #1e293b', borderRadius: '12px', padding: '14px', margin: '0', minWidth: '0', color: '#cbd5e1', fontFamily: 'inherit', fontSize: '13px' }, { 'data-aura-prefs': 'card' });
    var legend = el('legend', { padding: '0 6px', fontWeight: '700', color: '#fff' }, { text: '🎨 ' + t('prefs.appearance', 'Darstellung') }); box.appendChild(legend);
    box.appendChild(el('p', { margin: '0 0 8px', color: '#94a3b8', fontSize: '12px' }, { text: t('prefs.appearance.help', 'Gilt für dieses Gerät und diesen Browser.') }));
    var group = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' }, { role: 'radiogroup', 'aria-label': t('prefs.appearance', 'Darstellung') }), radios = {};
    [['dark', '🌙 ' + t('prefs.dark', 'Dunkel')], ['light', '☀️ ' + t('prefs.light', 'Hell')], ['auto', '🖥️ ' + t('prefs.auto', 'Automatisch (wie das Gerät)')]].forEach(function (o) {
      var label = el('label', { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px' }), input = el('input', null, { type: 'radio', name: id, value: o[0], 'data-aura-prefs': 'theme-' + o[0] });
      input.addEventListener('change', function () { if (input.checked) set(o[0]); });
      label.appendChild(input); label.appendChild(el('span', null, { text: o[1] })); group.appendChild(label); radios[o[0]] = input;
    });
    box.appendChild(group); container.appendChild(box);
    var inst = { sync: function () { var m = get(); Object.keys(radios).forEach(function (k) { radios[k].checked = (k === m); }); }, el: box };
    cards = cards.filter(function (c) { return c.el.isConnected !== false; }); cards.push(inst); inst.sync();
    if (!opts || opts.language !== false) { try { if (window.AuraI18n && typeof window.AuraI18n.select === 'function') window.AuraI18n.select(box); } catch (e) { /* ohne Sprachauswahl */ } }
    return inst;
  }
  window.AuraPrefs = Object.freeze({ get: get, effective: effective, set: set, onChange: onChange, card: card, version: 1 });
})();
