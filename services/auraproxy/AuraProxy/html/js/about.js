/* Aura-Suite: Dialog "Über Aura-Suite". Dieselbe Datei steckt in allen Anwendungen (AuraChat hat einen eigenen Dialog).
 * Erwartet einen Knopf mit der Kennung "about-btn" und die Schnittstelle /api/version (nur für angemeldete Personen).
 * Alles wird als reiner Text gesetzt (textContent), nie als HTML. Die Stile werden über das Objektmodell gesetzt (style.xxx): das funktioniert auch mit
 * einer strengen Inhaltssicherheits-Richtlinie ohne Inline-Stile (AuraCall). */
(function () {
  'use strict';
  var btn = document.getElementById('about-btn'); if (!btn) return;
  var API = btn.getAttribute('data-about-api') || '/api/version';
  var VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/, overlay = null, opener = null;
  var T = { title: 'Über Aura-Suite', close: 'Schließen', app: 'Anwendung', version: 'Version', suite: 'Aura-Suite', latest: 'Aktuelle Version', update: 'Update verfügbar', date: 'Stand', note: 'Hinweis', unavailable: 'Die Versionsangaben sind gerade nicht verfügbar.', platformLabel: 'Plattform', platform: 'Docker (selbst gehostet)', by: 'Programmiert von', firm: 'Firma', mail: 'E-Mail', home: 'Homepage' };

  function el(tag, style, text) { var e = document.createElement(tag); if (style) Object.assign(e.style, style); if (text !== undefined && text !== null) e.textContent = String(text); return e; }
  function fmtDate(v) {   // JJJJ-MM-TT als TT.MM.JJJJ, ohne Datumsobjekt-Umweg (kein Weiterrollen unmöglicher Tage); unmöglich = ''
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); if (!m) return '';
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }
  var ver = function (v) { return typeof v === 'string' && VERSION_RE.test(v.trim()) ? 'v' + v.trim() : ''; };
  var ROW = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }, LABEL = { color: '#94a3b8', flex: 'none' }, VALUE = { color: '#e2e8f0', textAlign: 'right', wordBreak: 'break-word' };
  function row(parent, label, value, valueStyle) { var r = el('div', ROW), l = el('span', LABEL, label), v = el('span', Object.assign({}, VALUE, valueStyle || {})); if (value && value.nodeType) v.appendChild(value); else v.textContent = String(value); r.appendChild(l); r.appendChild(v); parent.appendChild(r); return r; }
  function link(href, text, newTab) { var a = el('a', { color: '#60a5fa', textDecoration: 'none' }, text); a.href = href; if (newTab) { a.target = '_blank'; a.rel = 'noopener'; } return a; }
  var MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '1px 8px', color: '#93c5fd' };
  var sep = function (p) { p.appendChild(el('div', { height: '1px', background: 'rgba(51,65,85,0.6)', margin: '2px 0' })); };

  function fill(box, d) {
    box.textContent = '';
    if (!d || typeof d !== 'object') { box.appendChild(el('div', { color: '#94a3b8' }, T.unavailable)); return; }
    var product = typeof d.product === 'string' ? d.product.trim().slice(0, 40) : '';
    if (product) row(box, '🧩 ' + T.app, product);
    var inst = ver(d.installed); if (inst) row(box, '📦 ' + T.version, inst, MONO);
    var suiteInst = ver(d.suiteInstalled); if (suiteInst) row(box, '🧱 ' + T.suite, suiteInst, MONO);
    var s = d.suite && typeof d.suite === 'object' ? d.suite : null, latest = s ? ver(s.version) : '';
    if (latest) {
      var wrap = el('span', { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }); wrap.appendChild(el('span', MONO, latest));
      if (d.updateAvailable === true) wrap.appendChild(el('span', { fontSize: '10px', padding: '1px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#fcd34d' }, T.update));
      row(box, '⬆️ ' + T.latest, wrap);
      var dt = fmtDate(s.date); if (dt) row(box, '🗓️ ' + T.date, dt);
      var note = typeof s.note === 'string' ? s.note.trim().slice(0, 120) : ''; if (note) row(box, '📝 ' + T.note, note);
    }
    if (!product && !inst) box.appendChild(el('div', { color: '#94a3b8' }, T.unavailable));
  }

  function close() { if (!overlay) return; overlay.remove(); overlay = null; document.removeEventListener('keydown', onKey, true); if (opener && typeof opener.focus === 'function') opener.focus(); }
  function onKey(e) {
    if (!overlay) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {   // Tab bleibt im Dialog
      var f = Array.prototype.slice.call(overlay.querySelectorAll('a[href], button')); if (!f.length) return;
      var i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }
  function open() {
    if (overlay) return; opener = document.activeElement;
    overlay = el('div', { position: 'fixed', top: '0', right: '0', bottom: '0', left: '0', zIndex: '2147483000', background: 'rgba(2,6,23,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' });
    overlay.setAttribute('data-about-overlay', '');
    var dlg = el('div', { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', maxHeight: '100%', overflow: 'auto', boxSizing: 'border-box', color: '#cbd5e1', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: '12px', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' });
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-labelledby', 'about-title');
    var head = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '12px' });
    var h = el('h3', { margin: '0', fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '0.02em' }, T.title); h.id = 'about-title';
    var x = el('button', { background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', fontWeight: '700', cursor: 'pointer', lineHeight: '1', padding: '0 4px' }, '×'); x.type = 'button'; x.setAttribute('aria-label', T.close); x.addEventListener('click', close);
    head.appendChild(h); head.appendChild(x); dlg.appendChild(head);
    var card = el('div', { background: 'rgba(2,6,23,0.6)', border: '1px solid rgba(30,41,59,0.8)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' });
    row(card, '👨‍💻 ' + T.by, 'Michel Gerber'); sep(card); row(card, '🏢 ' + T.firm, 'Gerber Backoffice Solutions'); sep(card);
    row(card, '✉️ ' + T.mail, link('mailto:info@gerber-backoffice-solutions.com', 'info@gerber-backoffice-solutions.com')); sep(card);
    row(card, '🌐 ' + T.home, link('http://gerber-backoffice-solutions.com', 'gerber-backoffice-solutions.com', true)); sep(card);
    var dyn = el('div', { display: 'flex', flexDirection: 'column', gap: '10px' }); dyn.setAttribute('data-about-dynamic', ''); card.appendChild(dyn); sep(card);
    row(card, '🐳 ' + T.platformLabel, T.platform);
    dlg.appendChild(card);
    var c = el('button', { width: '100%', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }, T.close); c.type = 'button'; c.addEventListener('click', close);
    dlg.appendChild(c); overlay.appendChild(dlg);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay); document.addEventListener('keydown', onKey, true); c.focus();
    var mine = overlay;
    fetch(API, { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (d) { if (overlay === mine) fill(dyn, d); });
  }
  btn.addEventListener('click', open);
})();
