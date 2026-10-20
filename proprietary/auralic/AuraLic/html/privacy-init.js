/* Datenschutzerklärung bestätigen (AuraLic): wird auf jeder angemeldeten Seite geladen, NACH aura-privacy.js. Abmelden schickt das Formular wie der normale Abmelden-Knopf. */
(function () {
  'use strict';
  if (!window.AuraPrivacy) return;
  window.AuraPrivacy.check({ onLogout: function () { var f = document.createElement('form'); f.method = 'POST'; f.action = '/logout'; document.body.appendChild(f); f.submit(); } });
})();
