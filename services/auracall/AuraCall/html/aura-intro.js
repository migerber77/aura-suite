/* Start-Intro der Aura-Suite (gemeinsame Datei für alle Produkte, überall byte-gleich).
 *
 * Einbindung (in den <head>, ohne defer/async, damit sich das Intro sofort über die Seite legt und nichts aufblitzt):
 *   <script src="/pfad/aura-intro.js" data-video="/pfad/aurasuite-intro"></script>
 * data-video = Pfad zum Video OHNE Endung; erwartet werden  <pfad>.webm  (VP9) und  <pfad>.mp4  (H.264); der Browser nimmt, was er abspielen kann.
 *
 * Verhalten: spielt einmal pro Browser-Sitzung (sessionStorage "aura_intro_seen"), stumm, mit Knopf "Überspringen" (auch Klick, Esc, Enter, Leertaste).
 * Blockiert die App nie: bei Ladefehler, verweigertem Autoplay oder nach 8 s verschwindet es von selbst.
 * Kein Intro: in eingebetteten Fenstern (iframe), bei "weniger Bewegung" im Betriebssystem, bei ?nointro in der Adresse und in automatisierten Browsern (navigator.webdriver: Tests, Überwachung).
 * Ohne Abhängigkeiten, ohne innerHTML, ohne Inline-Stile im Markup (Script-Quelle 'self' und media-src 'self' genügen). */
(function () {
  'use strict';
  if (window.AuraIntro) return;
  var KEY = 'aura_intro_seen', MAX_MS = 8000, FADE_MS = 400, BG = '#03060f';
  var MASK = 'radial-gradient(closest-side, #000 82%, rgba(0,0,0,0) 100%)'; // weicher Rand: das Video verschmilzt mit dem Hintergrund
  var tag = document.currentScript, base = (tag && tag.getAttribute('data-video')) || '';

  function seen() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* Speicher gesperrt: dann eben bei jedem Laden */ } }
  function pathOk(p) { return typeof p === 'string' && p.length < 200 && /^\/?[A-Za-z0-9_.\-\/]+$/.test(p) && p.indexOf('//') < 0 && p.indexOf('..') < 0; }
  function suppressed() {
    try {
      if (window.top !== window.self) return true;
      if (navigator.webdriver === true) return true;
      if (/[?&]nointro(&|=|$)/.test(location.search)) return true;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { /* im Zweifel zeigen */ }
    return false;
  }
  function el(tag, style, attrs) {
    var e = document.createElement(tag); if (style) Object.assign(e.style, style);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    return e;
  }
  function label() { return 'Überspringen'; }   // deutscher Text ist die Quelle: aura-i18n.js übersetzt ihn

  var overlay = null, timer = null, done = false, keyHandler = null;
  function remove() {
    if (keyHandler) { document.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }
  function dismiss(immediate) {
    if (done) return; done = true; mark(); clearTimeout(timer);
    if (!overlay) return;
    var o = overlay;
    if (immediate) { remove(); return; }
    o.style.opacity = '0'; setTimeout(function () { if (overlay === o) remove(); }, FADE_MS);
  }
  function show() {
    if (overlay || done || seen() || suppressed() || !pathOk(base)) return;
    overlay = el('div', { position: 'fixed', top: '0', right: '0', bottom: '0', left: '0', zIndex: '2147483600', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: '1', transition: 'opacity ' + FADE_MS + 'ms ease' }, { role: 'dialog', 'aria-label': 'Aura Suite', 'data-aura-intro': 'overlay' });
    var wrap = el('div', { width: 'min(512px, 82vw, 82vh)', aspectRatio: '1 / 1', position: 'relative' });
    var video = el('video', { width: '100%', height: '100%', display: 'block', objectFit: 'cover', background: BG, webkitMaskImage: MASK, maskImage: MASK }, { 'data-aura-intro': 'video', tabindex: '-1', 'aria-hidden': 'true' });
    video.muted = true; video.defaultMuted = true; video.playsInline = true; video.autoplay = true; video.loop = false; video.preload = 'auto'; video.disablePictureInPicture = true;
    var webm = el('source', null, { src: base + '.webm', type: 'video/webm; codecs="vp9"' }), mp4 = el('source', null, { src: base + '.mp4', type: 'video/mp4' });
    video.appendChild(webm); video.appendChild(mp4);
    mp4.addEventListener('error', function () { dismiss(true); });          // beide Formate nicht ladbar/abspielbar: einfach weiter zur App
    video.addEventListener('error', function () { dismiss(true); });
    video.addEventListener('ended', function () { dismiss(false); });
    wrap.appendChild(video); overlay.appendChild(wrap);
    var skip = el('button', { position: 'absolute', right: '24px', bottom: '24px', background: 'rgba(15,23,42,.7)', color: '#94a3b8', border: '1px solid #334155', borderRadius: '999px', padding: '8px 16px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer' }, { type: 'button', text: label(), 'data-aura-intro': 'skip' });
    skip.addEventListener('mouseenter', function () { skip.style.color = '#fff'; }); skip.addEventListener('mouseleave', function () { skip.style.color = '#94a3b8'; });
    skip.addEventListener('click', function (e) { e.stopPropagation(); dismiss(false); });
    overlay.appendChild(skip);
    overlay.addEventListener('click', function () { dismiss(false); });
    keyHandler = function (e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); dismiss(false); } };
    document.addEventListener('keydown', keyHandler, true);
    // Sofort über die Seite legen (auch wenn <body> noch nicht existiert): so blitzt die App nicht kurz auf
    (document.body || document.documentElement).appendChild(overlay);
    timer = setTimeout(function () { dismiss(false); }, MAX_MS);       // Sicherheitsnetz
    var p = video.play(); if (p && typeof p.catch === 'function') p.catch(function () { dismiss(true); }); // Autoplay verweigert: nicht festhängen
  }
  window.AuraIntro = Object.freeze({ skip: function () { dismiss(false); }, version: 1 });
  show();
})();
