/* Hängt das einheitliche Menü der Aura-Suite ein (gemeinsame Datei für alle Produkte, überall byte-gleich).
 * Voraussetzung: aura-menu.js ist geladen, die Seite hat <div id="aura-menu"></div>.
 *
 * Zwei Arten, die Einträge festzulegen:
 *  1) Programme mit Skript (Einzelseiten): app.js setzt später window.AuraAppMenu und ruft AuraMenuCtl.refresh() auf:
 *       window.AuraAppMenu = { settings: fn | null, admin: { users: fn, license: fn, api: fn, security: fn, system: fn } | null, logout: fn };
 *  2) Programme, die ihre Seiten auf dem Server rendern: Adressen im Attribut data-menu (nur Pfade, die mit / beginnen):
 *       <div id="aura-menu" data-menu='{"settings":"/einstellungen","admin":{"users":"/","license":"/lizenz"}}' data-logout="/logout"></div>
 *     Abmelden: data-logout="/pfad" (Link) oder data-logout-post="/pfad" (schickt ein Formular per POST) oder AuraAppMenu.logout.
 * Diese Datei steht VOR about.js: das Menü (mit dem Über-Knopf) existiert, wenn about.js ihn sucht. */
(function () {
  'use strict';
  var host = document.getElementById('aura-menu');
  if (!host || !window.AuraMenu) return;
  function safePath(p) { return typeof p === 'string' && /^\/[^\s]*$/.test(p) && p.indexOf('//') !== 0 ? p : null; }
  function go(p) { return function () { window.location.assign(p); }; }
  var raw = host.getAttribute('data-menu');
  if (raw && !window.AuraAppMenu) {
    try {
      var m = JSON.parse(raw), h = {}, s = safePath(m && m.settings);
      if (s) h.settings = go(s);
      if (m && m.admin && typeof m.admin === 'object') {
        h.admin = {};
        ['users', 'license', 'api', 'security', 'system'].forEach(function (k) { var q = safePath(m.admin[k]); if (q) h.admin[k] = go(q); });
      }
      window.AuraAppMenu = h;
    } catch (e) { /* ungültige Angaben: kein Menü ausser Über und Abmelden */ }
  }
  var url = host.getAttribute('data-logout') || '', post = safePath(host.getAttribute('data-logout-post'));
  window.AuraMenuCtl = window.AuraMenu.mount(host, {
    state: function () { var a = window.AuraAppMenu || {}; return { settings: typeof a.settings === 'function' ? a.settings : null, admin: a.admin && typeof a.admin === 'object' ? a.admin : null }; },
    logout: url || (post ? function () { var f = document.createElement('form'); f.method = 'POST'; f.action = post; document.body.appendChild(f); f.submit(); } : function () { var a = window.AuraAppMenu || {}; if (typeof a.logout === 'function') a.logout(); })
  });
})();
