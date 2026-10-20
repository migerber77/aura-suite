let currentConfig = {
    host: localStorage.getItem('aurachat_host') || window.location.hostname || 'localhost',
    port: localStorage.getItem('aurachat_port') || '11434',
    model: localStorage.getItem('aurachat_model') || 'gemma4:e2b'
};

function updateServerEndpoints() {
    const serverDisplay = document.getElementById('server-display');
    const modelDisplay = document.getElementById('model-display');
    if (serverDisplay) serverDisplay.textContent = `${currentConfig.host}:${currentConfig.port}`;
    if (modelDisplay) modelDisplay.textContent = currentConfig.model;
}

function applyUserDesign() {
    const savedColor = localStorage.getItem('aurachat_accent') || '#2563eb';
    const savedBg = localStorage.getItem('aurachat_bg');
    const savedPanelColor = localStorage.getItem('aurachat_panel_color') || '#1e293b';
    const savedOpacity = localStorage.getItem('aurachat_opacity') || '90';
    const savedAvatar = localStorage.getItem('aurachat_avatar');
    const savedSpeechAvatar = localStorage.getItem('aurachat_speech_avatar');

    document.documentElement.style.setProperty('--accent-color', savedColor);
    
    let r = parseInt(savedPanelColor.slice(1, 3), 16) || 30;
    let g = parseInt(savedPanelColor.slice(3, 5), 16) || 41;
    let b = parseInt(savedPanelColor.slice(5, 7), 16) || 59;
    let alpha = parseInt(savedOpacity) / 100;

    document.documentElement.style.setProperty('--panel-bg-rgba', `rgba(${r}, ${g}, ${b}, ${alpha})`);

    const mainBody = document.getElementById('main-body');
    if (savedBg && mainBody) {
        mainBody.style.backgroundImage = `url('${savedBg}')`;
        mainBody.style.backgroundColor = 'transparent';
    } else if (mainBody) {
        mainBody.style.backgroundImage = 'none';
        mainBody.style.backgroundColor = '#0f172a';
    }

    const avatarImg = document.getElementById('avatar-image');
    if (avatarImg) {
        if (savedAvatar) {
            avatarImg.src = savedAvatar;
            avatarImg.setAttribute('data-default-src', savedAvatar);
        }
        if (savedSpeechAvatar) {
            avatarImg.setAttribute('data-speech-src', savedSpeechAvatar);
        }
    }
}

// Globale Klick-Steuerung für Menüs und Modals
document.addEventListener('click', (e) => {
    const menuBtn = document.getElementById('menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const modalSettings = document.getElementById('modal-settings');
    const modalDesign = document.getElementById('modal-design');
    const modalAbout = document.getElementById('modal-about');
    const modalVoice = document.getElementById('modal-voice');
    const modalAvatar = document.getElementById('modal-avatar-config');

    // 1. Hauptmenü umschalten
    if (menuBtn && (menuBtn === e.target || menuBtn.contains(e.target))) {
        e.stopPropagation();
        if (dropdownMenu) dropdownMenu.classList.toggle('hidden');
        return;
    }

    // 2. Modals öffnen
    if (e.target.closest('#open-settings')) {
        if (modalSettings) modalSettings.classList.remove('hidden');
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        document.getElementById('setting-host').value = currentConfig.host;
        document.getElementById('setting-port').value = currentConfig.port;
        document.getElementById('setting-model').value = currentConfig.model;
        document.getElementById('model-fetch-status').textContent = '';
        return;
    }
    if (e.target.closest('#open-voice')) {
        if (modalVoice) modalVoice.classList.remove('hidden');
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        populateVoices();
        const uiLangSelect = document.getElementById('ui-lang-select');
        if (uiLangSelect) uiLangSelect.value = localStorage.getItem('aurachat_lang') || 'de';
        return;
    }
    if (e.target.closest('#open-design')) {
        if (modalDesign) modalDesign.classList.remove('hidden');
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        return;
    }
    if (e.target.closest('#open-avatar-config')) {
        if (modalAvatar) modalAvatar.classList.remove('hidden');
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        document.getElementById('avatar-url-input').value = localStorage.getItem('aurachat_avatar') || 'images/face.gif';
        document.getElementById('avatar-speech-url-input').value = localStorage.getItem('aurachat_speech_avatar') || 'images/speech.gif';
        return;
    }
    if (e.target.closest('#open-about')) {
        if (modalAbout) modalAbout.classList.remove('hidden');
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        return;
    }

    // 3. Modals schließen
    if (['close-settings', 'close-design', 'close-voice', 'close-avatar-config', 'close-about'].includes(e.target.id) || 
        [modalSettings, modalDesign, modalVoice, modalAvatar, modalAbout].includes(e.target)) {
        if (e.target === modalSettings || e.target.id === 'close-settings') modalSettings.classList.add('hidden');
        if (e.target === modalDesign || e.target.id === 'close-design') modalDesign.classList.add('hidden');
        if (e.target === modalVoice || e.target.id === 'close-voice') modalVoice.classList.add('hidden');
        if (e.target === modalAvatar || e.target.id === 'close-avatar-config') modalAvatar.classList.add('hidden');
        if (e.target === modalAbout || e.target.id === 'close-about') modalAbout.classList.add('hidden');
        return;
    }

    // 4. Automatische Modellsuche bei Ollama (`/api/tags`)
    if (e.target.id === 'fetch-models-btn') {
        const statusEl = document.getElementById('model-fetch-status');
        const host = document.getElementById('setting-host').value.trim();
        const port = document.getElementById('setting-port').value.trim();
        statusEl.textContent = 'Suche Modelle auf Ollama...';
        
        fetch(`http://${host}:${port}/api/tags`)
            .then(res => res.json())
            .then(data => {
                if (data.models && data.models.length > 0) {
                    const modelNames = data.models.map(m => m.name);
                    document.getElementById('setting-model').value = modelNames[0];
                    statusEl.textContent = `Gefunden: ${modelNames.join(', ')}`;
                } else {
                    statusEl.textContent = 'Keine Modelle auf dem Server gefunden.';
                }
            })
            .catch(() => {
                statusEl.textContent = 'Verbindungsfehler zu Ollama (CORS oder falsche IP/Port).';
            });
        return;
    }

    // 5. Settings speichern
    if (e.target.id === 'save-settings') {
        currentConfig.host = document.getElementById('setting-host').value.trim() || 'localhost';
        currentConfig.port = document.getElementById('setting-port').value.trim() || '11434';
        currentConfig.model = document.getElementById('setting-model').value.trim() || 'gemma4:e2b';

        localStorage.setItem('aurachat_host', currentConfig.host);
        localStorage.setItem('aurachat_port', currentConfig.port);
        localStorage.setItem('aurachat_model', currentConfig.model);

        updateServerEndpoints();
        if (modalSettings) modalSettings.classList.add('hidden');
        return;
    }

    // 6. Sprache & Audio speichern (UI-Sprache + TTS-Stimme)
    if (e.target.id === 'save-voice') {
        const uiLangSelect = document.getElementById('ui-lang-select');
        if (uiLangSelect) {
            const selectedLang = uiLangSelect.value;
            localStorage.setItem('aurachat_lang', selectedLang);
            if (typeof applyUiLanguage === 'function') {
                applyUiLanguage();
            }
        }

        const voiceSelect = document.getElementById('voice-select');
        const voiceSpeed = document.getElementById('voice-speed').value;
        if (voiceSelect && voiceSelect.value !== "") {
            localStorage.setItem('aurachat_voice', voiceSelect.value);
            const voices = window.speechSynthesis.getVoices();
            if (voices[voiceSelect.value]) {
                localStorage.setItem('aurachat_selected_voice_name', voices[voiceSelect.value].name);
            }
        }
        localStorage.setItem('aurachat_speed', voiceSpeed);
        
        if (modalVoice) modalVoice.classList.add('hidden');
        
        // Seite neu laden, damit die Sprache sofort in allen UI-Elementen aktiv wird
        location.reload();
        return;
    }

    // 7. Design speichern
    if (e.target.id === 'save-design') {
        localStorage.setItem('aurachat_accent', document.getElementById('design-accent').value);
        localStorage.setItem('aurachat_panel_color', document.getElementById('design-panel-color').value);
        localStorage.setItem('aurachat_opacity', document.getElementById('design-opacity').value);
        const bgUrl = document.getElementById('design-bg-url').value.trim();
        if (bgUrl) localStorage.setItem('aurachat_bg', bgUrl);
        else localStorage.removeItem('aurachat_bg');

        applyUserDesign();
        if (modalDesign) modalDesign.classList.add('hidden');
        return;
    }

    // 8. Avatar speichern
    if (e.target.id === 'save-avatar-config') {
        const avatarUrl = document.getElementById('avatar-url-input').value.trim();
        const speechUrl = document.getElementById('avatar-speech-url-input').value.trim();
        
        if (avatarUrl) localStorage.setItem('aurachat_avatar', avatarUrl);
        else localStorage.removeItem('aurachat_avatar');

        if (speechUrl) localStorage.setItem('aurachat_speech_avatar', speechUrl);
        else localStorage.removeItem('aurachat_speech_avatar');

        applyUserDesign();
        if (modalAvatar) modalAvatar.classList.add('hidden');
        return;
    }

    // Dropdown bei Klick außerhalb schließen
    if (dropdownMenu && !dropdownMenu.contains(e.target) && menuBtn && !menuBtn.contains(e.target)) {
        dropdownMenu.classList.add('hidden');
    }
});

// Event-Listener für Datei-Uploads im Avatar-Modal
document.addEventListener('change', (e) => {
    if (e.target.id === 'upload-face-file' && e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
            document.getElementById('avatar-url-input').value = uploadEvent.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    }
    if (e.target.id === 'upload-speech-file' && e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
            document.getElementById('avatar-speech-url-input').value = uploadEvent.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

function populateVoices() {
    const select = document.getElementById('voice-select');
    if (!select || !window.speechSynthesis) return;
    
    let voices = window.speechSynthesis.getVoices();
    select.innerHTML = '';
    
    voices.forEach((voice, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (voice.name === localStorage.getItem('aurachat_selected_voice_name')) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
}

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
}

document.addEventListener('DOMContentLoaded', () => {
    updateServerEndpoints();
    applyUserDesign();
    if (typeof applyUiLanguage === 'function') applyUiLanguage();
    
    const opacityRange = document.getElementById('design-opacity');
    const opacityVal = document.getElementById('opacity-val');
    if (opacityRange && opacityVal) {
        opacityRange.addEventListener('input', () => opacityVal.textContent = opacityRange.value);
    }

    const speedRange = document.getElementById('voice-speed');
    const speedVal = document.getElementById('speed-val');
    if (speedRange && speedVal) {
        speedRange.addEventListener('input', () => speedVal.textContent = speedRange.value);
        speedRange.value = localStorage.getItem('aurachat_speed') || '1.0';
        speedVal.textContent = speedRange.value;
    }
});
