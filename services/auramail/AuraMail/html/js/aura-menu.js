/* Einheitliches Menü der Aura-Suite (gemeinsame Datei für alle Produkte, überall byte-gleich).
 *
 * Die Reihenfolge und die Namen sind HIER festgelegt, damit sie in jedem Produkt gleich sind:
 *   [⚙️ Einstellungen]  [🛠️ Admin Panel ▾]  [ℹ️ Über]  [Abmelden]
 * Admin Panel (nur für Admins) enthält immer in dieser Reihenfolge, soweit das Produkt den Bereich hat:
 *   👥 Benutzer · 🔑 Lizenz · 🔌 API · 🛡️ Sicherheit · 🖥️ System
 * "Einstellungen" ist für alles, womit man Funktionen des Produkts anpasst. Lizenz, API, Sicherheit, Benutzer und System gehören ins Admin Panel.
 *
 * Verwendung (VOR about.js laden: es hängt den Dialog "Über Aura-Suite" an den Knopf mit der Kennung "about-btn"):
 *   var ctl = AuraMenu.mount('aura-menu', {
 *     state: function () { return { settings: fn | null, admin: { license: fn, ... } | null }; },   // wird beim Einhängen und bei ctl.refresh() abgefragt
 *     logout: '/logout'  (Adresse, nur ein Pfad)  oder  function () { ... }
 *   });
 *   ctl.refresh();   // z. B. nach der Anmeldung, wenn feststeht, ob die Person Admin ist
 * Kürzer, wenn alles von Anfang an feststeht:  { settings: fn, admin: { ... }, logout: ... }
 * Der Über-Knopf bleibt bei refresh() derselbe Knopf (sonst ginge der Dialog verloren).
 *
 * Ohne Abhängigkeiten, ohne innerHTML, ohne eval, ohne Inline-Stile im Markup (Script-Quelle 'self' genügt). Texte kommen nur aus dieser Datei. */
(function () {
  'use strict';
  if (window.AuraMenu) return;
  var ADMIN_ORDER = ['users', 'license', 'api', 'security', 'system'];
  var ADMIN_ITEMS = { users: ['👥', 'Benutzer'], license: ['🔑', 'Lizenz'], api: ['🔌', 'API'], security: ['🛡️', 'Sicherheit'], system: ['🖥️', 'System'] };
  var BTN = { background: '#0f172a', color: '#cbd5e1', border: '1px solid #1e293b', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontFamily: 'inherit', fontWeight: '500', lineHeight: '1.2', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', boxSizing: 'border-box' };
  var HOVER = { background: '#1e293b', color: '#fff' }, NORMAL = { background: '#0f172a', color: '#cbd5e1' };

  function el(tag, style, attrs) {
    var e = document.createElement(tag); if (style) Object.assign(e.style, style);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    return e;
  }
  function styleLike(node) { // Hover und Fokus ohne CSS-Datei: nur über Stil-Zuweisung
    node.addEventListener('mouseenter', function () { Object.assign(node.style, HOVER); });
    node.addEventListener('mouseleave', function () { Object.assign(node.style, NORMAL); });
    node.addEventListener('focus', function () { node.style.outline = '2px solid #3b82f6'; node.style.outlineOffset = '1px'; });
    node.addEventListener('blur', function () { node.style.outline = 'none'; });
    return node;
  }
  function call(fn) { try { return fn(); } catch (e) { /* ein Fehler im Produkt darf das Menü nicht blockieren */ } }
  var instances = new WeakMap();

  function mount(target, cfg) {
    var host = typeof target === 'string' ? document.getElementById(target) : target;
    if (!host || host.nodeType !== 1) return null;
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    if (instances.has(host)) instances.get(host).destroy();
    while (host.firstChild) host.removeChild(host.firstChild);
    var nav = el('div', { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }, { role: 'navigation', 'aria-label': 'Aura-Menü', 'data-aura-menu': 'root' });
    var cleanups = [], cur = { settings: null, admin: null };
    var settingsBtn = null, wrap = null, adminBtn = null, menuEl = null, items = [], aboutBtn = null, logoutEl = null;

    function state() {
      var st = typeof cfg.state === 'function' ? call(cfg.state) : { settings: cfg.settings, admin: cfg.admin };
      st = st && typeof st === 'object' ? st : {};
      return { settings: typeof st.settings === 'function' ? st.settings : null, admin: st.admin && typeof st.admin === 'object' ? st.admin : null };
    }
    function closeMenu(returnFocus) {
      if (!menuEl) return; menuEl.style.display = 'none'; adminBtn.setAttribute('aria-expanded', 'false'); if (returnFocus) adminBtn.focus();
    }
    // Position: 6 px unter dem Knopf, rechtsbündig zu ihm, immer im sichtbaren Bereich
    function place() {
      if (!menuEl || !adminBtn || menuEl.style.display === 'none') return;
      var r = adminBtn.getBoundingClientRect(), w = menuEl.offsetWidth, vw = document.documentElement.clientWidth;
      menuEl.style.left = Math.min(Math.max(8, r.right - w), Math.max(8, vw - w - 8)) + 'px';
      menuEl.style.top = Math.round(r.bottom + 6) + 'px';
    }
    function openMenu(focusFirst) {
      if (!menuEl) return; menuEl.style.display = 'flex'; place(); adminBtn.setAttribute('aria-expanded', 'true'); if (focusFirst && items[0]) items[0].focus();
    }
    function ensureAdminWidget() {
      if (wrap) return;
      wrap = el('div', { position: 'relative', display: 'inline-block' });
      adminBtn = styleLike(el('button', BTN, { type: 'button', text: '🛠️ Admin Panel ▾', 'data-aura-menu': 'admin', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }));
      menuEl = el('div', { display: 'none', flexDirection: 'column', position: 'fixed', top: '0px', left: '0px', minWidth: '190px', maxWidth: 'calc(100vw - 16px)', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', padding: '6px', boxShadow: '0 12px 32px rgba(0,0,0,.5)', zIndex: '2147483000' }, { role: 'menu', 'aria-label': 'Admin Panel', 'data-aura-menu': 'admin-list' });
      adminBtn.addEventListener('click', function () { if (menuEl.style.display === 'none') openMenu(false); else closeMenu(false); });
      adminBtn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(true); } else if (e.key === 'Escape') closeMenu(false); });
      menuEl.addEventListener('keydown', function (e) {
        var i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
        else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
        else if (e.key === 'Tab') closeMenu(false);
      });
      var outside = function (e) { if (!wrap.contains(e.target) && !menuEl.contains(e.target)) closeMenu(false); };
      document.addEventListener('mousedown', outside); cleanups.push(function () { document.removeEventListener('mousedown', outside); });
      // Die Liste hängt im Seitenrumpf (nicht in der Kopfzeile): So überdeckt sie nichts, und nichts überdeckt sie, egal welche Ebenen (z-index), Unschärfe, Transformation oder overflow die Seite für ihre Kopfzeile setzt.
      document.body.appendChild(menuEl);
      var follow = function () { place(); };
      window.addEventListener('resize', follow); window.addEventListener('scroll', follow, true);
      cleanups.push(function () { window.removeEventListener('resize', follow); window.removeEventListener('scroll', follow, true); if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl); });
      wrap.appendChild(adminBtn);
    }
    function render() {
      cur = state();
      // Einstellungen
      if (cur.settings) {
        if (!settingsBtn) { settingsBtn = styleLike(el('button', BTN, { type: 'button', text: '⚙️ Einstellungen', 'data-aura-menu': 'settings' })); settingsBtn.addEventListener('click', function () { closeMenu(false); if (cur.settings) call(cur.settings); }); }
      } else if (settingsBtn) { if (settingsBtn.parentNode === nav) nav.removeChild(settingsBtn); settingsBtn = null; }
      // Admin Panel: Einträge nach der festen Reihenfolge, nur Funktionen
      var sections = cur.admin ? ADMIN_ORDER.filter(function (id) { return typeof cur.admin[id] === 'function'; }) : [];
      if (sections.length) {
        ensureAdminWidget();
        while (menuEl.firstChild) menuEl.removeChild(menuEl.firstChild);
        items = sections.map(function (id) {
          var it = styleLike(el('button', { background: 'transparent', color: '#cbd5e1', border: 'none', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%' }, { type: 'button', role: 'menuitem', tabindex: '-1', text: ADMIN_ITEMS[id][0] + ' ' + ADMIN_ITEMS[id][1], 'data-aura-menu-item': id }));
          it.addEventListener('click', function () { closeMenu(false); var f = cur.admin && cur.admin[id]; if (typeof f === 'function') call(f); });
          menuEl.appendChild(it); return it;
        });
      } else if (wrap) { closeMenu(false); while (menuEl.firstChild) menuEl.removeChild(menuEl.firstChild); if (wrap.parentNode === nav) nav.removeChild(wrap); items = []; }
      // feste Reihenfolge herstellen (appendChild verschiebt bestehende Knoten, deren Hörer bleiben erhalten)
      [settingsBtn, sections.length ? wrap : null, aboutBtn, logoutEl].forEach(function (n) { if (n) nav.appendChild(n); });
    }
    if (cfg.about !== false) aboutBtn = styleLike(el('button', BTN, { type: 'button', id: 'about-btn', text: 'ℹ️ Über', 'data-aura-menu': 'about' }));
    if (typeof cfg.logout === 'string' && /^\/[^\s]*$/.test(cfg.logout) && cfg.logout.indexOf('//') !== 0) logoutEl = styleLike(el('a', BTN, { href: cfg.logout, text: 'Abmelden', 'data-aura-menu': 'logout' }));
    else if (typeof cfg.logout === 'function') { logoutEl = styleLike(el('button', BTN, { type: 'button', text: 'Abmelden', 'data-aura-menu': 'logout' })); logoutEl.addEventListener('click', function () { call(cfg.logout); }); }
    render(); host.appendChild(nav);
    var api = { refresh: render, close: function () { closeMenu(false); }, destroy: function () { cleanups.forEach(function (f) { f(); }); cleanups = []; if (nav.parentNode === host) host.removeChild(nav); instances.delete(host); } };
    instances.set(host, api); return api;
  }
  window.AuraMenu = Object.freeze({ mount: mount, ADMIN_ORDER: ADMIN_ORDER.slice(), version: 3 });
})();
