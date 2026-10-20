const translations = {
    de: {
        model_label: "Modell:",
        server_label: "Server:",
        speech_on: "Sprache: An",
        speech_off: "Sprache: Aus",
        status_connected: "Verbunden",
        status_ready: "Bereit",
        menu_settings: "Server & Modell Konfiguration",
        menu_voice: "Sprache & Audio (UI & TTS)",
        menu_design: "Design & Hintergrund",
        menu_avatar: "Avatar anpassen",
        menu_about: "Über AuraChat",
        assistant_live_label: "KI-Assistentin Aura (Live)",
        smileys_label: "Smileys:",
        send_btn: "Senden",
        label_ui_lang: "Oberflächen-Sprache",
        label_tts_voice: "Browser Sprachausgabe (TTS)",
        label_speed: "Sprechgeschwindigkeit",
        btn_cancel: "Abbrechen",
        btn_save: "Speichern",
        btn_close: "Schließen",
        about_desc: "Ein eleganter, direkt an Ollama angebundener KI-Chat mit Live-Avatar, Text-to-Speech und vollständiger Modulstruktur."
    },
    en: {
        model_label: "Model:",
        server_label: "Server:",
        speech_on: "Speech: On",
        speech_off: "Speech: Off",
        status_connected: "Connected",
        status_ready: "Ready",
        menu_settings: "Server & Model Configuration",
        menu_voice: "Language & Audio (UI & TTS)",
        menu_design: "Design & Background",
        menu_avatar: "Customize Avatar",
        menu_about: "About AuraChat",
        assistant_live_label: "AI Assistant Aura (Live)",
        smileys_label: "Smileys:",
        send_btn: "Send",
        label_ui_lang: "UI Language",
        label_tts_voice: "Browser Voice (TTS)",
        label_speed: "Speech Speed",
        btn_cancel: "Cancel",
        btn_save: "Save",
        btn_close: "Close",
        about_desc: "An elegant AI chat directly connected to Ollama with live avatar, text-to-speech, and modular structure."
    },
    fr: {
        model_label: "Modèle :",
        server_label: "Serveur :",
        speech_on: "Voix : Activée",
        speech_off: "Voix : Désactivée",
        status_connected: "Connecté",
        status_ready: "Prêt",
        menu_settings: "Configuration Serveur & Modèle",
        menu_voice: "Langue & Audio (UI & TTS)",
        menu_design: "Design & Arrière-plan",
        menu_avatar: "Personnaliser l'avatar",
        menu_about: "À propos de AuraChat",
        assistant_live_label: "Assistante IA Aura (En direct)",
        smileys_label: "Émojis :",
        send_btn: "Envoyer",
        label_ui_lang: "Langue de l'interface",
        label_tts_voice: "Voix du navigateur (TTS)",
        label_speed: "Vitesse de parole",
        btn_cancel: "Annuler",
        btn_save: "Enregistrer",
        btn_close: "Fermer",
        about_desc: "Un chat IA élégant directement connecté à Ollama avec avatar en direct, synthèse vocale et structure modulaire."
    },
    es: {
        model_label: "Modelo:",
        server_label: "Servidor:",
        speech_on: "Voz: Activada",
        speech_off: "Voz: Desactivada",
        status_connected: "Conectado",
        status_ready: "Listo",
        menu_settings: "Configuración de Servidor y Modelo",
        menu_voice: "Idioma y Audio (UI & TTS)",
        menu_design: "Diseño y Fondo",
        menu_avatar: "Personalizar Avatar",
        menu_about: "Acerca de AuraChat",
        assistant_live_label: "Asistente IA Aura (En vivo)",
        smileys_label: "Emojis:",
        send_btn: "Enviar",
        label_ui_lang: "Idioma de la interfaz",
        label_tts_voice: "Voz del navegador (TTS)",
        label_speed: "Velocidad de voz",
        btn_cancel: "Cancelar",
        btn_save: "Guardar",
        btn_close: "Cerrar",
        about_desc: "Un elegante chat de IA conectado directamente a Ollama con avatar en vivo, texto a voz y estructura modular."
    }
};

function applyUiLanguage() {
    let currentLang = localStorage.getItem('aurachat_lang');
    if (!currentLang || !translations[currentLang]) {
        currentLang = 'de';
        localStorage.setItem('aurachat_lang', 'de');
    }

    const dict = translations[currentLang] || translations['de'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.textContent = dict[key];
        }
    });

    const uiLangSelect = document.getElementById('ui-lang-select');
    if (uiLangSelect) {
        uiLangSelect.value = currentLang;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyUiLanguage();
});
