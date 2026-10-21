/* Gemeinsames Wörterbuch der Aura-Suite (Deutsch → Englisch, Italienisch, Französisch, Spanisch). Gemeinsame Datei für alle Produkte, überall byte-gleich.
 * Erzeugt aus build_words.py; enthält die Texte der gemeinsamen Teile (Menü, Über-Dialog, Intro, Datenschutz, Darstellung, Sprache) und häufige Oberflächenwörter.
 * Gehört NACH aura-i18n.js in den <head>. Produktspezifische Wörterbücher (aura-i18n-<produkt>.js) ergänzen es. */
(function () {
  'use strict';
  if (!window.AuraI18n) return;
  window.AuraI18n.add({
 "⚙️ Einstellungen": {
  "en": "⚙️ Settings",
  "it": "⚙️ Impostazioni",
  "fr": "⚙️ Paramètres",
  "es": "⚙️ Ajustes"
 },
 "Einstellungen": {
  "en": "Settings",
  "it": "Impostazioni",
  "fr": "Paramètres",
  "es": "Ajustes"
 },
 "🛠️ Admin Panel ▾": {
  "en": "🛠️ Admin panel ▾",
  "it": "🛠️ Pannello di amministrazione ▾",
  "fr": "🛠️ Panneau d’administration ▾",
  "es": "🛠️ Panel de administración ▾"
 },
 "🛠️ Admin Panel": {
  "en": "🛠️ Admin panel",
  "it": "🛠️ Pannello di amministrazione",
  "fr": "🛠️ Panneau d’administration",
  "es": "🛠️ Panel de administración"
 },
 "Admin Panel": {
  "en": "Admin panel",
  "it": "Pannello di amministrazione",
  "fr": "Panneau d’administration",
  "es": "Panel de administración"
 },
 "ℹ️ Über": {
  "en": "ℹ️ About",
  "it": "ℹ️ Informazioni",
  "fr": "ℹ️ À propos",
  "es": "ℹ️ Acerca de"
 },
 "Abmelden": {
  "en": "Sign out",
  "it": "Esci",
  "fr": "Se déconnecter",
  "es": "Cerrar sesión"
 },
 "Aura-Menü": {
  "en": "Aura menu",
  "it": "Menu Aura",
  "fr": "Menu Aura",
  "es": "Menú Aura"
 },
 "👥 Benutzer": {
  "en": "👥 Users",
  "it": "👥 Utenti",
  "fr": "👥 Utilisateurs",
  "es": "👥 Usuarios"
 },
 "Benutzer": {
  "en": "Users",
  "it": "Utenti",
  "fr": "Utilisateurs",
  "es": "Usuarios"
 },
 "🔑 Lizenz": {
  "en": "🔑 License",
  "it": "🔑 Licenza",
  "fr": "🔑 Licence",
  "es": "🔑 Licencia"
 },
 "Lizenz": {
  "en": "License",
  "it": "Licenza",
  "fr": "Licence",
  "es": "Licencia"
 },
 "🔌 API": {
  "en": "🔌 API",
  "it": "🔌 API",
  "fr": "🔌 API",
  "es": "🔌 API"
 },
 "🛡️ Sicherheit": {
  "en": "🛡️ Security",
  "it": "🛡️ Sicurezza",
  "fr": "🛡️ Sécurité",
  "es": "🛡️ Seguridad"
 },
 "Sicherheit": {
  "en": "Security",
  "it": "Sicurezza",
  "fr": "Sécurité",
  "es": "Seguridad"
 },
 "🖥️ System": {
  "en": "🖥️ System",
  "it": "🖥️ Sistema",
  "fr": "🖥️ Système",
  "es": "🖥️ Sistema"
 },
 "System": {
  "en": "System",
  "it": "Sistema",
  "fr": "Système",
  "es": "Sistema"
 },
 "Über Aura-Suite": {
  "en": "About Aura Suite",
  "it": "Informazioni su Aura Suite",
  "fr": "À propos d’Aura Suite",
  "es": "Acerca de Aura Suite"
 },
 "Schließen": {
  "en": "Close",
  "it": "Chiudi",
  "fr": "Fermer",
  "es": "Cerrar"
 },
 "Schliessen": {
  "en": "Close",
  "it": "Chiudi",
  "fr": "Fermer",
  "es": "Cerrar"
 },
 "Anwendung": {
  "en": "Application",
  "it": "Applicazione",
  "fr": "Application",
  "es": "Aplicación"
 },
 "Version": {
  "en": "Version",
  "it": "Versione",
  "fr": "Version",
  "es": "Versión"
 },
 "Aktuelle Version": {
  "en": "Latest version",
  "it": "Versione più recente",
  "fr": "Dernière version",
  "es": "Última versión"
 },
 "wird beim nächsten Abgleich mit dem Lizenzserver übernommen": {
  "en": "will be taken over at the next sync with the licence server",
  "it": "verrà ripresa alla prossima sincronizzazione con il server delle licenze",
  "fr": "sera reprise lors de la prochaine synchronisation avec le serveur de licences",
  "es": "se aplicará en la próxima sincronización con el servidor de licencias"
 },
 "Update verfügbar": {
  "en": "Update available",
  "it": "Aggiornamento disponibile",
  "fr": "Mise à jour disponible",
  "es": "Actualización disponible"
 },
 "Stand": {
  "en": "As of",
  "it": "Aggiornato al",
  "fr": "En date du",
  "es": "Fecha"
 },
 "Hinweis": {
  "en": "Note",
  "it": "Nota",
  "fr": "Remarque",
  "es": "Nota"
 },
 "Die Versionsangaben sind gerade nicht verfügbar.": {
  "en": "The version information is currently unavailable.",
  "it": "Le informazioni sulla versione non sono disponibili al momento.",
  "fr": "Les informations de version ne sont pas disponibles pour le moment.",
  "es": "La información de versión no está disponible en este momento."
 },
 "Plattform": {
  "en": "Platform",
  "it": "Piattaforma",
  "fr": "Plateforme",
  "es": "Plataforma"
 },
 "Docker (selbst gehostet)": {
  "en": "Docker (self-hosted)",
  "it": "Docker (self-hosted)",
  "fr": "Docker (auto-hébergé)",
  "es": "Docker (autoalojado)"
 },
 "Programmiert von": {
  "en": "Developed by",
  "it": "Sviluppato da",
  "fr": "Développé par",
  "es": "Desarrollado por"
 },
 "Firma": {
  "en": "Company",
  "it": "Azienda",
  "fr": "Entreprise",
  "es": "Empresa"
 },
 "E-Mail": {
  "en": "Email",
  "it": "E-mail",
  "fr": "E-mail",
  "es": "Correo electrónico"
 },
 "Homepage": {
  "en": "Website",
  "it": "Sito web",
  "fr": "Site web",
  "es": "Sitio web"
 },
 "Überspringen": {
  "en": "Skip",
  "it": "Salta",
  "fr": "Passer",
  "es": "Omitir"
 },
 "Datenschutzerklärung": {
  "en": "Privacy policy",
  "it": "Informativa sulla privacy",
  "fr": "Politique de confidentialité",
  "es": "Política de privacidad"
 },
 "🔒 Datenschutzerklärung": {
  "en": "🔒 Privacy policy",
  "it": "🔒 Informativa sulla privacy",
  "fr": "🔒 Politique de confidentialité",
  "es": "🔒 Política de privacidad"
 },
 "Ich habe die Datenschutzerklärung gelesen und akzeptiere sie.": {
  "en": "I have read and accept the privacy policy.",
  "it": "Ho letto e accetto l’informativa sulla privacy.",
  "fr": "J’ai lu et j’accepte la politique de confidentialité.",
  "es": "He leído y acepto la política de privacidad."
 },
 "Akzeptieren und weiter": {
  "en": "Accept and continue",
  "it": "Accetta e continua",
  "fr": "Accepter et continuer",
  "es": "Aceptar y continuar"
 },
 "Das Bestätigen hat nicht geklappt. Bitte erneut versuchen.": {
  "en": "Confirmation failed. Please try again.",
  "it": "Conferma non riuscita. Riprova.",
  "fr": "La confirmation a échoué. Veuillez réessayer.",
  "es": "No se pudo confirmar. Inténtalo de nuevo."
 },
 "Speichern hat nicht geklappt.": {
  "en": "Saving failed.",
  "it": "Salvataggio non riuscito.",
  "fr": "L’enregistrement a échoué.",
  "es": "No se pudo guardar."
 },
 "Gespeichert. Alle Benutzer müssen die neue Fassung beim nächsten Mal bestätigen.": {
  "en": "Saved. All users must confirm the new version next time.",
  "it": "Salvato. Tutti gli utenti dovranno confermare la nuova versione al prossimo accesso.",
  "fr": "Enregistré. Tous les utilisateurs devront confirmer la nouvelle version la prochaine fois.",
  "es": "Guardado. Todos los usuarios deberán confirmar la nueva versión la próxima vez."
 },
 "📄 Datenschutzerklärung": {
  "en": "📄 Privacy policy",
  "it": "📄 Informativa sulla privacy",
  "fr": "📄 Politique de confidentialité",
  "es": "📄 Política de privacidad"
 },
 "📄 Datenschutz": {
  "en": "📄 Privacy",
  "it": "📄 Privacy",
  "fr": "📄 Confidentialité",
  "es": "📄 Privacidad"
 },
 "📄 Datenschutzerklärung bearbeiten": {
  "en": "📄 Edit privacy policy",
  "it": "📄 Modifica informativa sulla privacy",
  "fr": "📄 Modifier la politique de confidentialité",
  "es": "📄 Editar política de privacidad"
 },
 "🎨 Darstellung": {
  "en": "🎨 Appearance",
  "it": "🎨 Aspetto",
  "fr": "🎨 Apparence",
  "es": "🎨 Apariencia"
 },
 "Gilt für dieses Gerät und diesen Browser.": {
  "en": "Applies to this device and browser.",
  "it": "Vale per questo dispositivo e questo browser.",
  "fr": "S’applique à cet appareil et à ce navigateur.",
  "es": "Se aplica a este dispositivo y navegador."
 },
 "🌙 Dunkel": {
  "en": "🌙 Dark",
  "it": "🌙 Scuro",
  "fr": "🌙 Sombre",
  "es": "🌙 Oscuro"
 },
 "☀️ Hell": {
  "en": "☀️ Light",
  "it": "☀️ Chiaro",
  "fr": "☀️ Clair",
  "es": "☀️ Claro"
 },
 "🖥️ Automatisch (wie das Gerät)": {
  "en": "🖥️ Automatic (like the device)",
  "it": "🖥️ Automatico (come il dispositivo)",
  "fr": "🖥️ Automatique (comme l’appareil)",
  "es": "🖥️ Automático (como el dispositivo)"
 },
 "🌐 Sprache": {
  "en": "🌐 Language",
  "it": "🌐 Lingua",
  "fr": "🌐 Langue",
  "es": "🌐 Idioma"
 },
 "Sprache": {
  "en": "Language",
  "it": "Lingua",
  "fr": "Langue",
  "es": "Idioma"
 },
 "Darstellung": {
  "en": "Appearance",
  "it": "Aspetto",
  "fr": "Apparence",
  "es": "Apariencia"
 },
 "Anmelden": {
  "en": "Sign in",
  "it": "Accedi",
  "fr": "Se connecter",
  "es": "Iniciar sesión"
 },
 "Benutzername": {
  "en": "Username",
  "it": "Nome utente",
  "fr": "Nom d’utilisateur",
  "es": "Usuario"
 },
 "Passwort": {
  "en": "Password",
  "it": "Password",
  "fr": "Mot de passe",
  "es": "Contraseña"
 },
 "Benutzername oder Passwort falsch.": {
  "en": "Wrong username or password.",
  "it": "Nome utente o password errati.",
  "fr": "Nom d’utilisateur ou mot de passe incorrect.",
  "es": "Usuario o contraseña incorrectos."
 },
 "Aktuelles Passwort": {
  "en": "Current password",
  "it": "Password attuale",
  "fr": "Mot de passe actuel",
  "es": "Contraseña actual"
 },
 "Neues Passwort": {
  "en": "New password",
  "it": "Nuova password",
  "fr": "Nouveau mot de passe",
  "es": "Nueva contraseña"
 },
 "Neues Passwort wiederholen": {
  "en": "Repeat new password",
  "it": "Ripeti la nuova password",
  "fr": "Répéter le nouveau mot de passe",
  "es": "Repite la nueva contraseña"
 },
 "Passwort ändern": {
  "en": "Change password",
  "it": "Cambia password",
  "fr": "Changer le mot de passe",
  "es": "Cambiar contraseña"
 },
 "🔑 Passwort ändern": {
  "en": "🔑 Change password",
  "it": "🔑 Cambia password",
  "fr": "🔑 Changer le mot de passe",
  "es": "🔑 Cambiar contraseña"
 },
 "🔒 Passwort ändern": {
  "en": "🔒 Change password",
  "it": "🔒 Cambia password",
  "fr": "🔒 Changer le mot de passe",
  "es": "🔒 Cambiar contraseña"
 },
 "🔒 Eigenes Passwort ändern": {
  "en": "🔒 Change your own password",
  "it": "🔒 Cambia la tua password",
  "fr": "🔒 Changer votre mot de passe",
  "es": "🔒 Cambiar tu propia contraseña"
 },
 "🔒 Admin-Passwort ändern": {
  "en": "🔒 Change admin password",
  "it": "🔒 Cambia la password dell’amministratore",
  "fr": "🔒 Changer le mot de passe administrateur",
  "es": "🔒 Cambiar la contraseña de administrador"
 },
 "🔑 Passwort": {
  "en": "🔑 Password",
  "it": "🔑 Password",
  "fr": "🔑 Mot de passe",
  "es": "🔑 Contraseña"
 },
 "Zwei-Faktor-Authentifizierung": {
  "en": "Two-factor authentication",
  "it": "Autenticazione a due fattori",
  "fr": "Authentification à deux facteurs",
  "es": "Autenticación de dos factores"
 },
 "🛡️ Zwei-Faktor-Authentifizierung": {
  "en": "🛡️ Two-factor authentication",
  "it": "🛡️ Autenticazione a due fattori",
  "fr": "🛡️ Authentification à deux facteurs",
  "es": "🛡️ Autenticación de dos factores"
 },
 "Zwei-Faktor-Authentifizierung für alle Konten verlangen": {
  "en": "Require two-factor authentication for all accounts",
  "it": "Richiedi l’autenticazione a due fattori per tutti gli account",
  "fr": "Exiger l’authentification à deux facteurs pour tous les comptes",
  "es": "Exigir autenticación de dos factores para todas las cuentas"
 },
 "Zwei-Faktor-Anmeldung": {
  "en": "Two-factor sign-in",
  "it": "Accesso a due fattori",
  "fr": "Connexion à deux facteurs",
  "es": "Inicio de sesión de dos factores"
 },
 "QR-Code": {
  "en": "QR code",
  "it": "Codice QR",
  "fr": "Code QR",
  "es": "Código QR"
 },
 "Code aus deiner Authenticator-App:": {
  "en": "Code from your authenticator app:",
  "it": "Codice dalla tua app di autenticazione:",
  "fr": "Code de votre application d’authentification :",
  "es": "Código de tu aplicación de autenticación:"
 },
 "Code aus deiner Authenticator-App eingeben:": {
  "en": "Enter the code from your authenticator app:",
  "it": "Inserisci il codice dalla tua app di autenticazione:",
  "fr": "Saisissez le code de votre application d’authentification :",
  "es": "Introduce el código de tu aplicación de autenticación:"
 },
 "Code aus der Authenticator-App (oder ein Notfall-Code)": {
  "en": "Code from the authenticator app (or a recovery code)",
  "it": "Codice dell’app di autenticazione (o un codice di emergenza)",
  "fr": "Code de l’application d’authentification (ou un code de secours)",
  "es": "Código de la aplicación de autenticación (o un código de emergencia)"
 },
 "Code ist falsch oder abgelaufen.": {
  "en": "The code is wrong or has expired.",
  "it": "Il codice è errato o scaduto.",
  "fr": "Le code est incorrect ou a expiré.",
  "es": "El código es incorrecto o ha caducado."
 },
 "Code ist falsch. Neuen QR-Code laden und erneut versuchen.": {
  "en": "The code is wrong. Load a new QR code and try again.",
  "it": "Il codice è errato. Carica un nuovo codice QR e riprova.",
  "fr": "Le code est incorrect. Chargez un nouveau code QR et réessayez.",
  "es": "El código es incorrecto. Carga un nuevo código QR e inténtalo de nuevo."
 },
 "✓ Aktiviert - beim Login wird zusätzlich ein Code verlangt.": {
  "en": "✓ Enabled – a code is also required at sign-in.",
  "it": "✓ Attivata: all’accesso viene richiesto anche un codice.",
  "fr": "✓ Activée : un code est également demandé à la connexion.",
  "es": "✓ Activada: al iniciar sesión también se pide un código."
 },
 "Lizenzschlüssel hier einfügen": {
  "en": "Paste license key here",
  "it": "Incolla qui la chiave di licenza",
  "fr": "Collez la clé de licence ici",
  "es": "Pega aquí la clave de licencia"
 },
 "Lizenz entfernen": {
  "en": "Remove license",
  "it": "Rimuovi licenza",
  "fr": "Retirer la licence",
  "es": "Quitar licencia"
 },
 "Lizenz aktivieren": {
  "en": "Activate license",
  "it": "Attiva licenza",
  "fr": "Activer la licence",
  "es": "Activar licencia"
 },
 "Neuen Lizenzschlüssel eintragen": {
  "en": "Enter a new license key",
  "it": "Inserisci una nuova chiave di licenza",
  "fr": "Saisir une nouvelle clé de licence",
  "es": "Introducir una nueva clave de licencia"
 },
 "📁 Oder .lic-Datei auswählen": {
  "en": "📁 Or choose a .lic file",
  "it": "📁 Oppure scegli un file .lic",
  "fr": "📁 Ou choisissez un fichier .lic",
  "es": "📁 O elige un archivo .lic"
 },
 "💾 Backup": {
  "en": "💾 Backup",
  "it": "💾 Backup",
  "fr": "💾 Sauvegarde",
  "es": "💾 Copia de seguridad"
 },
 "Backup herunterladen": {
  "en": "Download backup",
  "it": "Scarica backup",
  "fr": "Télécharger la sauvegarde",
  "es": "Descargar copia de seguridad"
 },
 "Wiederherstellen": {
  "en": "Restore",
  "it": "Ripristina",
  "fr": "Restaurer",
  "es": "Restaurar"
 },
 "⚠️ Wiederherstellen": {
  "en": "⚠️ Restore",
  "it": "⚠️ Ripristina",
  "fr": "⚠️ Restaurer",
  "es": "⚠️ Restaurar"
 },
 "🔌 Externe API": {
  "en": "🔌 External API",
  "it": "🔌 API esterna",
  "fr": "🔌 API externe",
  "es": "🔌 API externa"
 },
 "Verbindung testen": {
  "en": "Test connection",
  "it": "Verifica connessione",
  "fr": "Tester la connexion",
  "es": "Probar conexión"
 },
 "📋 Kopieren": {
  "en": "📋 Copy",
  "it": "📋 Copia",
  "fr": "📋 Copier",
  "es": "📋 Copiar"
 },
 "Neu erzeugen (alter Schlüssel wird ungültig)": {
  "en": "Regenerate (the old key becomes invalid)",
  "it": "Rigenera (la vecchia chiave diventa non valida)",
  "fr": "Régénérer (l’ancienne clé devient invalide)",
  "es": "Regenerar (la clave anterior dejará de ser válida)"
 },
 "🗂️ AuraDirect": {
  "en": "🗂️ AuraDirect",
  "it": "🗂️ AuraDirect",
  "fr": "🗂️ AuraDirect",
  "es": "🗂️ AuraDirect"
 },
 "🗂️ AuraDirect (zentrale Benutzerverwaltung)": {
  "en": "🗂️ AuraDirect (central user management)",
  "it": "🗂️ AuraDirect (gestione centrale degli utenti)",
  "fr": "🗂️ AuraDirect (gestion centralisée des utilisateurs)",
  "es": "🗂️ AuraDirect (gestión central de usuarios)"
 },
 "AuraDirect (zentrale Benutzerverwaltung)": {
  "en": "AuraDirect (central user management)",
  "it": "AuraDirect (gestione centrale degli utenti)",
  "fr": "AuraDirect (gestion centralisée des utilisateurs)",
  "es": "AuraDirect (gestión central de usuarios)"
 },
 "Dienst-Schlüssel (aus AuraDirect → Benutzer)": {
  "en": "Service key (from AuraDirect → Users)",
  "it": "Chiave di servizio (da AuraDirect → Utenti)",
  "fr": "Clé de service (depuis AuraDirect → Utilisateurs)",
  "es": "Clave de servicio (de AuraDirect → Usuarios)"
 },
 "Dienst-Schlüssel (wie in AuraDirect)": {
  "en": "Service key (as in AuraDirect)",
  "it": "Chiave di servizio (come in AuraDirect)",
  "fr": "Clé de service (comme dans AuraDirect)",
  "es": "Clave de servicio (como en AuraDirect)"
 },
 "Speichern": {
  "en": "Save",
  "it": "Salva",
  "fr": "Enregistrer",
  "es": "Guardar"
 },
 "Abbrechen": {
  "en": "Cancel",
  "it": "Annulla",
  "fr": "Annuler",
  "es": "Cancelar"
 },
 "Bestätigen": {
  "en": "Confirm",
  "it": "Conferma",
  "fr": "Confirmer",
  "es": "Confirmar"
 },
 "Löschen": {
  "en": "Delete",
  "it": "Elimina",
  "fr": "Supprimer",
  "es": "Eliminar"
 },
 "Entfernen": {
  "en": "Remove",
  "it": "Rimuovi",
  "fr": "Retirer",
  "es": "Quitar"
 },
 "Hinzufügen": {
  "en": "Add",
  "it": "Aggiungi",
  "fr": "Ajouter",
  "es": "Añadir"
 },
 "Ändern": {
  "en": "Change",
  "it": "Modifica",
  "fr": "Modifier",
  "es": "Cambiar"
 },
 "✏️ Bearbeiten": {
  "en": "✏️ Edit",
  "it": "✏️ Modifica",
  "fr": "✏️ Modifier",
  "es": "✏️ Editar"
 },
 "Bearbeiten": {
  "en": "Edit",
  "it": "Modifica",
  "fr": "Modifier",
  "es": "Editar"
 },
 "Zurücksetzen": {
  "en": "Reset",
  "it": "Reimposta",
  "fr": "Réinitialiser",
  "es": "Restablecer"
 },
 "Zurück": {
  "en": "Back",
  "it": "Indietro",
  "fr": "Retour",
  "es": "Atrás"
 },
 "Weiter": {
  "en": "Continue",
  "it": "Continua",
  "fr": "Continuer",
  "es": "Continuar"
 },
 "Senden": {
  "en": "Send",
  "it": "Invia",
  "fr": "Envoyer",
  "es": "Enviar"
 },
 "Hochladen": {
  "en": "Upload",
  "it": "Carica",
  "fr": "Téléverser",
  "es": "Subir"
 },
 "Aktivieren": {
  "en": "Activate",
  "it": "Attiva",
  "fr": "Activer",
  "es": "Activar"
 },
 "Deaktivieren": {
  "en": "Deactivate",
  "it": "Disattiva",
  "fr": "Désactiver",
  "es": "Desactivar"
 },
 "Anlegen": {
  "en": "Create",
  "it": "Crea",
  "fr": "Créer",
  "es": "Crear"
 },
 "Neue Person anlegen": {
  "en": "Add new person",
  "it": "Aggiungi nuova persona",
  "fr": "Ajouter une nouvelle personne",
  "es": "Añadir nueva persona"
 },
 "Wird geladen…": {
  "en": "Loading…",
  "it": "Caricamento…",
  "fr": "Chargement…",
  "es": "Cargando…"
 },
 "Suchen": {
  "en": "Search",
  "it": "Cerca",
  "fr": "Rechercher",
  "es": "Buscar"
 },
 "Alle": {
  "en": "All",
  "it": "Tutti",
  "fr": "Tous",
  "es": "Todos"
 },
 "Name": {
  "en": "Name",
  "it": "Nome",
  "fr": "Nom",
  "es": "Nombre"
 },
 "Vorname": {
  "en": "First name",
  "it": "Nome",
  "fr": "Prénom",
  "es": "Nombre de pila"
 },
 "Nachname": {
  "en": "Last name",
  "it": "Cognome",
  "fr": "Nom de famille",
  "es": "Apellidos"
 },
 "Status": {
  "en": "Status",
  "it": "Stato",
  "fr": "Statut",
  "es": "Estado"
 },
 "Person": {
  "en": "Person",
  "it": "Persona",
  "fr": "Personne",
  "es": "Persona"
 },
 "Betreff": {
  "en": "Subject",
  "it": "Oggetto",
  "fr": "Objet",
  "es": "Asunto"
 },
 "Port": {
  "en": "Port",
  "it": "Porta",
  "fr": "Port",
  "es": "Puerto"
 },
 "Modell": {
  "en": "Model",
  "it": "Modello",
  "fr": "Modèle",
  "es": "Modelo"
 },
 "Normal": {
  "en": "Normal",
  "it": "Normale",
  "fr": "Normal",
  "es": "Normal"
 },
 "Ja": {
  "en": "Yes",
  "it": "Sì",
  "fr": "Oui",
  "es": "Sí"
 },
 "Nein": {
  "en": "No",
  "it": "No",
  "fr": "Non",
  "es": "No"
 },
 "Fehler": {
  "en": "Error",
  "it": "Errore",
  "fr": "Erreur",
  "es": "Error"
 },
 "Ich akzeptiere": {
  "en": "I accept",
  "it": "Accetto",
  "fr": "J’accepte",
  "es": "Acepto"
 },
 "Administrator:in": {
  "en": "Administrator",
  "it": "Amministratore/amministratrice",
  "fr": "Administrateur/administratrice",
  "es": "Administrador/a"
 },
 "Mitarbeiter:in": {
  "en": "Employee",
  "it": "Dipendente",
  "fr": "Employé(e)",
  "es": "Empleado/a"
 },
 "Teamleiter:in / Kader": {
  "en": "Team lead / management",
  "it": "Capo squadra / quadri",
  "fr": "Chef d’équipe / cadres",
  "es": "Jefe de equipo / directivos"
 },
 "Agent:in": {
  "en": "Agent",
  "it": "Operatore/operatrice",
  "fr": "Agent(e)",
  "es": "Agente"
 },
 "Deutsch": {
  "en": "German",
  "it": "Tedesco",
  "fr": "Allemand",
  "es": "Alemán"
 },
 "Englisch": {
  "en": "English",
  "it": "Inglese",
  "fr": "Anglais",
  "es": "Inglés"
 },
 "Italienisch": {
  "en": "Italian",
  "it": "Italiano",
  "fr": "Italien",
  "es": "Italiano"
 },
 "Französisch": {
  "en": "French",
  "it": "Francese",
  "fr": "Français",
  "es": "Francés"
 },
 "Spanisch": {
  "en": "Spanish",
  "it": "Spagnolo",
  "fr": "Espagnol",
  "es": "Español"
 },
 "Client-ID (Anwendungs-ID)": {
  "en": "Client ID (application ID)",
  "it": "ID client (ID applicazione)",
  "fr": "ID client (ID de l’application)",
  "es": "ID de cliente (ID de aplicación)"
 },
 "Schlüssel": {
  "en": "Key",
  "it": "Chiave",
  "fr": "Clé",
  "es": "Clave"
 },
 "Kopieren": {
  "en": "Copy",
  "it": "Copia",
  "fr": "Copier",
  "es": "Copiar"
 },
 "Herunterladen": {
  "en": "Download",
  "it": "Scarica",
  "fr": "Télécharger",
  "es": "Descargar"
 },
 "Aktiv": {
  "en": "Active",
  "it": "Attivo",
  "fr": "Actif",
  "es": "Activo"
 },
 "Inaktiv": {
  "en": "Inactive",
  "it": "Inattivo",
  "fr": "Inactif",
  "es": "Inactivo"
 },
 "Fertig": {
  "en": "Done",
  "it": "Fatto",
  "fr": "Terminé",
  "es": "Listo"
 },
 "Okay": {
  "en": "OK",
  "it": "OK",
  "fr": "OK",
  "es": "OK"
 },
 "Optional": {
  "en": "Optional",
  "it": "Facoltativo",
  "fr": "Facultatif",
  "es": "Opcional"
 },
 "Rolle": {
  "en": "Role",
  "it": "Ruolo",
  "fr": "Rôle",
  "es": "Rol"
 },
 "Datum": {
  "en": "Date",
  "it": "Data",
  "fr": "Date",
  "es": "Fecha"
 },
 "Uhrzeit": {
  "en": "Time",
  "it": "Ora",
  "fr": "Heure",
  "es": "Hora"
 },
 "Beschreibung": {
  "en": "Description",
  "it": "Descrizione",
  "fr": "Description",
  "es": "Descripción"
 },
 "Titel": {
  "en": "Title",
  "it": "Titolo",
  "fr": "Titre",
  "es": "Título"
 },
 "Aktionen": {
  "en": "Actions",
  "it": "Azioni",
  "fr": "Actions",
  "es": "Acciones"
 },
 "Ausgewählt": {
  "en": "Selected",
  "it": "Selezionato",
  "fr": "Sélectionné",
  "es": "Seleccionado"
 },
 "Dateien": {
  "en": "Files",
  "it": "File",
  "fr": "Fichiers",
  "es": "Archivos"
 },
 "Neu": {
  "en": "New",
  "it": "Nuovo",
  "fr": "Nouveau",
  "es": "Nuevo"
 },
 "Offen": {
  "en": "Open",
  "it": "Aperto",
  "fr": "Ouvert",
  "es": "Abierto"
 },
 "Erledigt": {
  "en": "Completed",
  "it": "Completato",
  "fr": "Terminé",
  "es": "Completado"
 },
 "Name ist erforderlich.": {
  "en": "Name is required.",
  "it": "Il nome è obbligatorio.",
  "fr": "Le nom est obligatoire.",
  "es": "El nombre es obligatorio."
 },
 "Benutzername und Passwort sind erforderlich.": {
  "en": "Username and password are required.",
  "it": "Nome utente e password sono obbligatori.",
  "fr": "Le nom d’utilisateur et le mot de passe sont obligatoires.",
  "es": "El usuario y la contraseña son obligatorios."
 },
 "Das Passwort muss mindestens 8 Zeichen lang sein.": {
  "en": "The password must be at least 8 characters long.",
  "it": "La password deve contenere almeno 8 caratteri.",
  "fr": "Le mot de passe doit comporter au moins 8 caractères.",
  "es": "La contraseña debe tener al menos 8 caracteres."
 },
 "Bitte zuerst das Passwort ändern.": {
  "en": "Please change the password first.",
  "it": "Cambia prima la password.",
  "fr": "Veuillez d’abord changer le mot de passe.",
  "es": "Cambia primero la contraseña."
 },
 "Nicht angemeldet.": {
  "en": "Not signed in.",
  "it": "Accesso non effettuato.",
  "fr": "Non connecté.",
  "es": "No has iniciado sesión."
 },
 "Die Seite wird neu geladen…": {
  "en": "The page is reloading…",
  "it": "La pagina viene ricaricata…",
  "fr": "La page se recharge…",
  "es": "La página se está recargando…"
 },
 "Gespeichert.": {
  "en": "Saved.",
  "it": "Salvato.",
  "fr": "Enregistré.",
  "es": "Guardado."
 },
 "✓ Gespeichert.": {
  "en": "✓ Saved.",
  "it": "✓ Salvato.",
  "fr": "✓ Enregistré.",
  "es": "✓ Guardado."
 },
 "Wirklich löschen?": {
  "en": "Really delete?",
  "it": "Eliminare davvero?",
  "fr": "Vraiment supprimer ?",
  "es": "¿Eliminar de verdad?"
 },
 "Neue Benutzer legst du zentral in AuraDirect an (kostenlos). Sie erscheinen hier nach ihrer ersten Anmeldung.": {
  "en": "Create new users centrally in AuraDirect (free). They appear here after their first sign-in.",
  "it": "Crea i nuovi utenti centralmente in AuraDirect (gratuito). Compaiono qui dopo il primo accesso.",
  "fr": "Créez les nouveaux utilisateurs de façon centralisée dans AuraDirect (gratuit). Ils apparaissent ici après leur première connexion.",
  "es": "Crea los nuevos usuarios de forma centralizada en AuraDirect (gratis). Aparecen aquí tras su primer inicio de sesión."
 },
 "Mit der kostenlosen Version genügt der Administrator. Für weitere Benutzer verbindest du AuraDirect.": {
  "en": "With the free version the administrator is enough. To add more users, connect AuraDirect.",
  "it": "Con la versione gratuita basta l’amministratore. Per altri utenti collega AuraDirect.",
  "fr": "Avec la version gratuite, l’administrateur suffit. Pour d’autres utilisateurs, connectez AuraDirect.",
  "es": "Con la versión gratuita basta el administrador. Para más usuarios, conecta AuraDirect."
 }
});
})();
