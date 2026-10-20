/* Karte "Darstellung" (Dunkel/Hell/Automatisch) einhängen. Wartet bis die Seite fertig geladen ist: aura-prefs.js steht im <head>, die Karte braucht aber den Seitenrumpf. */
(function () {
  'use strict';
  function mount() { var box = document.getElementById('aura-prefs-card'); if (box && window.AuraPrefs) window.AuraPrefs.card(box); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
