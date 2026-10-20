/* Editor für die Datenschutzerklärung (nur Hauptadministrator, Seite /privacy-policy-edit).
 * Wartet bis die Seite fertig geladen ist: aura-privacy.js steht am Seitenende und ist beim Lesen dieses Skripts noch nicht geladen. */
(function () {
  'use strict';
  function mount() { var box = document.getElementById('admin-privacy-editor'); if (box && window.AuraPrivacy) window.AuraPrivacy.editor(box, {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
