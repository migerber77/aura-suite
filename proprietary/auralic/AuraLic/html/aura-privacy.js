/* Datenschutzerklärung der Aura-Suite im Browser (gemeinsame Datei für alle Produkte, überall byte-gleich).
 *
 *   AuraPrivacy.check({ onLogout: fn, policyUrl: '/api/privacy-policy', acceptUrl: '/api/privacy-policy/accept', headers: { ... } })   (headers: optionale Kopfzeilen für jede Anfrage)
 *       Fragt den Server, ob die angemeldete Person die aktuelle Datenschutzerklärung schon bestätigt hat. Wenn nicht, legt sich ein Fenster über die Anwendung, das erst
 *       nach "Akzeptieren und weiter" (mit Häkchen) verschwindet; "Abmelden" ist immer möglich. Gibt ein Promise zurück (true = bestätigt oder nichts zu bestätigen).
 *   AuraPrivacy.editor(container, { policyUrl: '/api/privacy-policy', saveUrl: '/api/admin/privacy-policy' })
 *       Bearbeitungsfeld für Administratoren (Text ändern, speichern; danach müssen alle neu bestätigen).
 *
 * Der Text wird nur als Text angezeigt (nie als HTML); einfache Formatierung: "# Titel", "## Abschnitt", "- Punkt". Ohne Abhängigkeiten, ohne innerHTML, ohne Inline-Stile im Markup. */
(function () {
  'use strict';
  if (window.AuraPrivacy) return;
  function t(key, fallback) { return fallback; }   // deutscher Text ist die Quelle: aura-i18n.js übersetzt ihn (auch später eingefügte Texte)
  function el(tag, style, attrs) {
    var e = document.createElement(tag); if (style) Object.assign(e.style, style);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    return e;
  }
  var BTN = { border: 'none', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontFamily: 'inherit', fontWeight: '600', cursor: 'pointer' };
  var extraHeaders = {};   // z. B. { 'X-Requested-With': 'AuraCall' }: Kopfzeilen, die ein Produkt für Anfragen verlangt (opts.headers bei check/editor)
  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}, { headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders) })).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    });
  }
  function render(container, text) {
    while (container.firstChild) container.removeChild(container.firstChild);
    var list = null;
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var m;
      if ((m = /^- (.*)$/.exec(line))) { if (!list) { list = el('ul', { margin: '4px 0 8px 18px', padding: '0' }); container.appendChild(list); } list.appendChild(el('li', { margin: '2px 0' }, { text: m[1] })); return; }
      list = null;
      if ((m = /^# (.*)$/.exec(line))) container.appendChild(el('h2', { fontSize: '16px', margin: '0 0 8px', color: '#fff' }, { text: m[1] }));
      else if ((m = /^## (.*)$/.exec(line))) container.appendChild(el('h3', { fontSize: '13px', margin: '12px 0 4px', color: '#e2e8f0' }, { text: m[1] }));
      else if (line.trim()) container.appendChild(el('p', { margin: '0 0 8px' }, { text: line }));
    });
  }
  var shown = null;
  function check(opts) {
    opts = opts || {}; if (opts.headers && typeof opts.headers === 'object') extraHeaders = Object.assign({}, opts.headers);
    var policyUrl = opts.policyUrl || '/api/privacy-policy', acceptUrl = opts.acceptUrl || '/api/privacy-policy/accept';
    return api(policyUrl).then(function (r) {
      var p = r.data || {};
      if (!r.ok || p.accepted !== false) return true;            // bestätigt, oder nicht angemeldet, oder Fehler: nichts blockieren
      if (shown) return shown;
      shown = new Promise(function (resolve) {
        var overlay = el('div', { position: 'fixed', top: '0', right: '0', bottom: '0', left: '0', zIndex: '2147483000', background: 'rgba(2,6,23,.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }, { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('privacy.title', 'Datenschutzerklärung'), 'data-aura-privacy': 'overlay' });
        var box = el('div', { background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px', boxSizing: 'border-box', color: '#cbd5e1', fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.5' });
        box.appendChild(el('div', { fontWeight: '700', color: '#fff', fontSize: '14px', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }, { text: '🔒 ' + t('privacy.title', 'Datenschutzerklärung') }));
        var body = el('div', { overflowY: 'auto', paddingRight: '4px', flex: '1 1 auto', minHeight: '80px' }, { 'data-aura-privacy': 'text', 'data-i18n-skip': '', tabindex: '0' }); render(body, p.text); box.appendChild(body);
        var label = el('label', { display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12px' }); var cb = el('input', null, { type: 'checkbox', 'data-aura-privacy': 'check' }); label.appendChild(cb); label.appendChild(el('span', null, { text: t('privacy.read', 'Ich habe die Datenschutzerklärung gelesen und akzeptiere sie.') })); box.appendChild(label);
        var msg = el('div', { color: '#fca5a5', fontSize: '12px', display: 'none' }, { role: 'alert', 'data-aura-privacy': 'error' }); box.appendChild(msg);
        var row = el('div', { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' });
        var out = el('button', Object.assign({}, BTN, { background: '#1e293b', color: '#cbd5e1' }), { type: 'button', text: t('privacy.logout', 'Abmelden'), 'data-aura-privacy': 'logout' });
        var ok = el('button', Object.assign({}, BTN, { background: '#2563eb', color: '#fff', opacity: '.5', cursor: 'not-allowed' }), { type: 'button', text: t('privacy.accept', 'Akzeptieren und weiter'), disabled: 'disabled', 'data-aura-privacy': 'accept' });
        cb.addEventListener('change', function () { if (cb.checked) { ok.removeAttribute('disabled'); ok.style.opacity = '1'; ok.style.cursor = 'pointer'; } else { ok.setAttribute('disabled', 'disabled'); ok.style.opacity = '.5'; ok.style.cursor = 'not-allowed'; } });
        function done(v) { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); shown = null; resolve(v); }
        ok.addEventListener('click', function () {
          if (!cb.checked) return; ok.setAttribute('disabled', 'disabled');
          api(acceptUrl, { method: 'POST', body: JSON.stringify({ version: p.version }) }).then(function (a) {
            if (a.ok) return done(true);
            msg.textContent = (a.data && a.data.error) || t('privacy.error', 'Das Bestätigen hat nicht geklappt. Bitte erneut versuchen.'); msg.style.display = 'block'; ok.removeAttribute('disabled');
          }).catch(function () { msg.textContent = t('privacy.error', 'Das Bestätigen hat nicht geklappt. Bitte erneut versuchen.'); msg.style.display = 'block'; ok.removeAttribute('disabled'); });
        });
        out.addEventListener('click', function () { done(false); if (typeof opts.onLogout === 'function') { try { opts.onLogout(); } catch (e) { /* egal */ } } });
        row.appendChild(out); row.appendChild(ok); box.appendChild(row); overlay.appendChild(box);
        (document.body || document.documentElement).appendChild(overlay); cb.focus();
      });
      return shown;
    }).catch(function () { return true; });
  }
  function editor(container, opts) {
    opts = opts || {}; if (opts.headers && typeof opts.headers === 'object') extraHeaders = Object.assign({}, opts.headers); var policyUrl = opts.policyUrl || '/api/privacy-policy', saveUrl = opts.saveUrl || '/api/admin/privacy-policy';
    if (!container) return null; while (container.firstChild) container.removeChild(container.firstChild);
    var ta = el('textarea', { width: '100%', minHeight: '220px', boxSizing: 'border-box', background: '#020617', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: '10px', padding: '10px', fontSize: '12px', fontFamily: 'inherit' }, { spellcheck: 'false', 'data-aura-privacy': 'editor', 'aria-label': t('privacy.title', 'Datenschutzerklärung') });
    var status = el('div', { fontSize: '12px', color: '#94a3b8', minHeight: '16px' }, { 'data-aura-privacy': 'status', role: 'status' });
    var save = el('button', Object.assign({}, BTN, { background: '#2563eb', color: '#fff' }), { type: 'button', text: t('privacy.save', 'Speichern'), 'data-aura-privacy': 'save' });
    container.appendChild(ta); container.appendChild(status); container.appendChild(save);
    api(policyUrl).then(function (r) { if (r.ok) ta.value = r.data.text || ''; });
    save.addEventListener('click', function () {
      status.style.color = '#94a3b8'; status.textContent = '…';
      api(saveUrl, { method: 'POST', body: JSON.stringify({ text: ta.value }) }).then(function (r) {
        if (r.ok) { status.style.color = '#4ade80'; status.textContent = t('privacy.saved', 'Gespeichert. Alle Benutzer müssen die neue Fassung beim nächsten Mal bestätigen.'); if (typeof opts.onSaved === 'function') opts.onSaved(r.data); }
        else { status.style.color = '#f87171'; status.textContent = (r.data && r.data.error) || t('privacy.error', 'Speichern hat nicht geklappt.'); }
      }).catch(function () { status.style.color = '#f87171'; status.textContent = t('privacy.error', 'Speichern hat nicht geklappt.'); });
    });
    return { reload: function () { return api(policyUrl).then(function (r) { if (r.ok) ta.value = r.data.text || ''; }); } };
  }
  window.AuraPrivacy = Object.freeze({ check: check, editor: editor, version: 1 });
})();
