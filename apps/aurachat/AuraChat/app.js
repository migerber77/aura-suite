document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) chatContainer.setAttribute('data-aura-bg', '');   // eigenes Hintergrundbild entfällt im Hell-Design (siehe aura-prefs.js)
    const ttsToggle = document.getElementById('tts-toggle');
    const micButton = document.getElementById('mic-button');
    const avatarImg = document.getElementById('avatar-image');
    const widgetsBar = document.getElementById('widgets-bar');
    const widgetsAddBtn = document.getElementById('widgets-add-btn');
    const widgetPicker = document.getElementById('widget-picker');
    const widgetPickerInputWrap = document.getElementById('widget-picker-input-wrap');
    const widgetPickerInput = document.getElementById('widget-picker-input');
    const widgetPickerConfirmBtn = document.getElementById('widget-picker-confirm-btn');
    const avatarContainer = document.getElementById('avatar-container');
    const voiceModeOpenBtn = document.getElementById('voice-mode-open-btn');
    const voiceModeOverlay = document.getElementById('voice-mode-overlay');
    const voiceModeCloseBtn = document.getElementById('voice-mode-close-btn');
    const voiceModeAvatarSlot = document.getElementById('voice-mode-avatar-slot');
    const voiceModeRing = document.getElementById('voice-mode-ring');
    const voiceModeStatus = document.getElementById('voice-mode-status');
    const liveDot = document.getElementById('live-dot');
    const appBody = document.getElementById('app-body');
    const modalPrivacy = document.getElementById('modal-privacy');
    const privacyPolicyText = document.getElementById('privacy-policy-text');
    const privacyAcceptBtn = document.getElementById('privacy-accept-btn');
    const adminTabBtnPrivacy = document.getElementById('admin-tab-btn-privacy');
    const adminTabPrivacy = document.getElementById('admin-tab-privacy');
    const adminTabBtnAcademy = document.getElementById('admin-tab-btn-academy');
    const adminTabAcademy = document.getElementById('admin-tab-academy');
    const adminTabBtnBackup = document.getElementById('admin-tab-btn-backup');
    const adminTabBackup = document.getElementById('admin-tab-backup');
    const backupCreateBtn = document.getElementById('backup-create-btn');
    const backupCreateStatus = document.getElementById('backup-create-status');
    const backupRestoreFile = document.getElementById('backup-restore-file');
    const backupRestoreBtn = document.getElementById('backup-restore-btn');
    const backupRestoreStatus = document.getElementById('backup-restore-status');
    const updateApplyFile = document.getElementById('update-apply-file');
    const updateApplyBtn = document.getElementById('update-apply-btn');
    const updateApplyStatus = document.getElementById('update-apply-status');
    const academyPremiumBanner = document.getElementById('academy-premium-banner');
    const academyEnabledToggle = document.getElementById('academy-enabled-toggle');
    const academyConfigStatus = document.getElementById('academy-config-status');
    const academyTrainNowBtn = document.getElementById('academy-train-now-btn');
    const academyStatusDisplay = document.getElementById('academy-status-display');
    const privacyPolicyEditor = document.getElementById('privacy-policy-editor');
    const privacyPolicySaveBtn = document.getElementById('privacy-policy-save-btn');
    const privacyPolicyStatus = document.getElementById('privacy-policy-status');
    const topLoadingBar = document.getElementById('top-loading-bar');

    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');

    const menuItemAbout = document.getElementById('menu-item-about');
    const menuItemModel = document.getElementById('menu-item-model');
    const menuItemSettings = document.getElementById('menu-item-settings');
    const modalSettings = document.getElementById('modal-settings');
    const settingsTabBtnLang = document.getElementById('settings-tab-btn-lang');
    const settingsTabBtnDesign = document.getElementById('settings-tab-btn-design');
    const settingsTabBtnAvatar = document.getElementById('settings-tab-btn-avatar');
    const settingsTabBtnPersonality = document.getElementById('settings-tab-btn-personality');
    const settingsTabLang = document.getElementById('settings-tab-lang');
    const settingsTabDesign = document.getElementById('settings-tab-design');
    const settingsTabAvatar = document.getElementById('settings-tab-avatar');
    const settingsTabPersonality = document.getElementById('settings-tab-personality');
    const menuItemWorkspace = document.getElementById('menu-item-workspace');
    const menuItemExportChat = document.getElementById('menu-item-export-chat');
    const personalityNameInput = document.getElementById('personality-name-input');
    const personalityTraitsInput = document.getElementById('personality-traits-input');
    const personalitySaveBtn = document.getElementById('personality-save-btn');
    const personalityStatus = document.getElementById('personality-status');
    const menuItemEmail = document.getElementById('menu-item-email');
    const o365RedirectUri = document.getElementById('o365-redirect-uri');
    const o365ClientIdInput = document.getElementById('o365-client-id-input');
    const o365ClientSecretInput = document.getElementById('o365-client-secret-input');
    const o365TenantInput = document.getElementById('o365-tenant-input');
    const o365SaveBtn = document.getElementById('o365-save-btn');
    const o365Status = document.getElementById('o365-status');
    const modalEmail = document.getElementById('modal-email');
    const emailPremiumBadge = document.getElementById('email-premium-badge');
    const emailPremiumBanner = document.getElementById('email-premium-banner');
    const emailSetupSection = document.getElementById('email-setup-section');
    const emailImapHost = document.getElementById('email-imap-host');
    const emailImapPort = document.getElementById('email-imap-port');
    const emailImapSecure = document.getElementById('email-imap-secure');
    const emailUsername = document.getElementById('email-username');
    const emailPassword = document.getElementById('email-password');
    const emailConnectBtn = document.getElementById('email-connect-btn');
    const emailConnectStatus = document.getElementById('email-connect-status');
    const emailInboxSection = document.getElementById('email-inbox-section');
    const emailConnectedAs = document.getElementById('email-connected-as');
    const emailDisconnectBtn = document.getElementById('email-disconnect-btn');
    const emailMessageList = document.getElementById('email-message-list');
    const emailDraftSection = document.getElementById('email-draft-section');
    const emailBackToListBtn = document.getElementById('email-back-to-list-btn');
    const emailDraftOriginal = document.getElementById('email-draft-original');
    const emailDraftInstruction = document.getElementById('email-draft-instruction');
    const emailDraftGenerateBtn = document.getElementById('email-draft-generate-btn');
    const emailDraftText = document.getElementById('email-draft-text');
    const emailDraftHint = document.getElementById('email-draft-hint');
    const emailO365ConnectLink = document.getElementById('email-o365-connect-link');
    const streakDisplay = document.getElementById('streak-display');
    const streakCountEl = document.getElementById('streak-count');
    const memoryIndicator = document.getElementById('memory-indicator');
    const academyTrainingIndicator = document.getElementById('academy-training-indicator');

    const modalAbout = document.getElementById('modal-about');
    // Bildschirmformat (Quer-/Hochformat): Logik in js/screenformat.js, hier nur Menüpunkt und Auswahlfenster
    const screenFormat = window.AuraScreenFormat || null;
    const menuItemScreenFormat = document.getElementById('menu-item-screen-format');
    const menuScreenFormatLabel = document.getElementById('menu-screen-format-label');
    const menuScreenFormatValue = document.getElementById('menu-screen-format-value');
    const modalScreenFormat = document.getElementById('modal-screen-format');
    const screenFormatGrid = document.getElementById('screen-format-grid');
    const screenFormatAutoBtn = document.getElementById('screen-format-auto');
    const screenFormatAutoMark = document.getElementById('screen-format-auto-mark');
    const screenFormatLandscapeBtn = document.getElementById('screen-format-landscape');
    const screenFormatPortraitBtn = document.getElementById('screen-format-portrait');
    const screenFormatCurrent = document.getElementById('screen-format-current');
    const screenFormatTabRatio = document.getElementById('screen-format-tab-ratio');
    const screenFormatTabRes = document.getElementById('screen-format-tab-res');
    const screenFormatPanelRatio = document.getElementById('screen-format-panel-ratio');
    const screenFormatPanelRes = document.getElementById('screen-format-panel-res');
    const screenFormatFit = document.getElementById('screen-format-fit');
    const screenFormatResList = document.getElementById('screen-format-res-list');
    const screenFormatCustomW = document.getElementById('screen-format-custom-w');
    const screenFormatCustomH = document.getElementById('screen-format-custom-h');
    const screenFormatCustomApply = document.getElementById('screen-format-custom-apply');
    const screenFormatCustomError = document.getElementById('screen-format-custom-error');
    const screenFormatSidebarReset = document.getElementById('screen-format-sidebar-reset');
    const screenFormatRotButtons = [0, 90, 180, 270].map(d => document.getElementById('screen-format-rot-' + d));   // Drehung 0/90/180/270
    let screenFormatOrientation = 'landscape';
    let screenFormatTab = 'ratio';   // 'ratio' (Seitenverhältnis) oder 'res' (Auflösung)
    const modalStay = document.getElementById('modal-stay');
    const menuItemStay = document.getElementById('menu-item-stay');
    const menuItemStayLabel = document.getElementById('menu-item-stay-label');
    const stayReservationInput = document.getElementById('stay-reservation-id');
    const stayLastNameInput = document.getElementById('stay-last-name');
    const stayStatus = document.getElementById('stay-status');
    const stayTitle = document.getElementById('stay-title');
    const stayIntro = document.getElementById('stay-intro');
    const guestLangRow = document.getElementById('guest-lang-row');
    const guestLangSelect = document.getElementById('guest-lang-select');
    const staySubmitBtn = document.getElementById('stay-submit-btn');
    const apaleoGuestEnabledBox = document.getElementById('apaleo-guest-enabled');
    const modalModelSearch = document.getElementById('modal-model-search');
    const ttsSttPremiumBanner = document.getElementById('tts-stt-premium-banner');
    const ttsSttPlatform = document.getElementById('tts-stt-platform');
    const ttsSttHost = document.getElementById('tts-stt-host');
    const ttsSttPort = document.getElementById('tts-stt-port');
    const piperFields = document.getElementById('piper-fields');
    const sttSourceSelect = document.getElementById('stt-source');
    const piperLangSelect = document.getElementById('piper-lang');
    const piperVoiceSelect = document.getElementById('piper-voice-select');
    const piperVoicesRefreshBtn = document.getElementById('piper-voices-refresh');
    const piperSpeakerList = document.getElementById('piper-speaker-list');
    const ttsSttServerWrap = document.getElementById('tts-stt-server-wrap');
    const ttsVoiceSelectWrap = document.getElementById('tts-voice-select-wrap');
    const ttsModelVoiceWrap = document.getElementById('tts-model-voice-wrap');
    const sttModelWrap = document.getElementById('stt-model-wrap');
    const sttLanguageWrap = document.getElementById('stt-language-wrap');
    const ttsWyomingHost = document.getElementById('tts-wyoming-host');
    const ttsWyomingPort = document.getElementById('tts-wyoming-port');
    const ttsWyomingVoice = document.getElementById('tts-wyoming-voice');
    const ttsWyomingSpeaker = document.getElementById('tts-wyoming-speaker');
    const ttsWyomingTestBtn = document.getElementById('tts-wyoming-test-btn');
    const ttsWyomingStatus = document.getElementById('tts-wyoming-status');
    const ttsModelInput = document.getElementById('tts-model');
    const ttsVoiceInput = document.getElementById('tts-voice');
    const ttsVoiceSelect = document.getElementById('tts-voice-select');
    const sttModelInput = document.getElementById('stt-model');
    const sttLanguageSelect = document.getElementById('stt-language');
    const ttsSttDownloadModelId = document.getElementById('tts-stt-download-model-id');
    const ttsSttDownloadBtn = document.getElementById('tts-stt-download-btn');
    const ttsSttDownloadStatus = document.getElementById('tts-stt-download-status');
    const ttsSttModelsRefreshBtn = document.getElementById('tts-stt-models-refresh-btn');
    const ttsSttModelsList = document.getElementById('tts-stt-models-list');
    const ttsSttSaveBtn = document.getElementById('tts-stt-save-btn');
    const ttsSttStatus = document.getElementById('tts-stt-status');
    const pronunciationDictRows = document.getElementById('pronunciation-dict-rows');
    const pronunciationAddRowBtn = document.getElementById('pronunciation-add-row-btn');
    const pronunciationSaveBtn = document.getElementById('pronunciation-save-btn');
    const pronunciationStatus = document.getElementById('pronunciation-status');
    const modalWorkspace = document.getElementById('modal-workspace');
    const modalChangePassword = document.getElementById('modal-change-password');

    const changePasswordBtn = document.getElementById('change-password-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const changePasswordForm = document.getElementById('change-password-form');
    const currentPasswordInput = document.getElementById('current-password-input');
    const newPasswordInput = document.getElementById('new-password-input');
    const passwordChangeError = document.getElementById('password-change-error');
    const passwordChangeSuccess = document.getElementById('password-change-success');

    const workspaceFileInput = document.getElementById('workspace-file-input');
    const workspaceUploadBtn = document.getElementById('workspace-upload-btn');
    const workspaceUploadStatus = document.getElementById('workspace-upload-status');
    const workspaceDocList = document.getElementById('workspace-doc-list');
    const workspaceToggle = document.getElementById('workspace-toggle');
    const workspaceNewFolderInput = document.getElementById('workspace-new-folder-input');
    const workspaceNewFolderBtn = document.getElementById('workspace-new-folder-btn');
    const workspaceCurrentFolderLabel = document.getElementById('workspace-current-folder-label');
    const workspaceGoRootBtn = document.getElementById('workspace-go-root-btn');

    const fileInput = document.getElementById('file-upload');
    const webSearchToggle = document.getElementById('web-search-toggle');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const webcamButton = document.getElementById('webcam-button');
    const modalWebcam = document.getElementById('modal-webcam');
    const webcamCloseBtn = document.getElementById('webcam-close-btn');
    const webcamModePhoto = document.getElementById('webcam-mode-photo');
    const webcamModeVideo = document.getElementById('webcam-mode-video');
    const webcamLive = document.getElementById('webcam-live');
    const webcamPhotoPreview = document.getElementById('webcam-photo-preview');
    const webcamVideoPreview = document.getElementById('webcam-video-preview');
    const webcamCanvas = document.getElementById('webcam-canvas');
    const webcamRecIndicator = document.getElementById('webcam-rec-indicator');
    const webcamRecTimer = document.getElementById('webcam-rec-timer');
    const webcamError = document.getElementById('webcam-error');
    const webcamControlsLive = document.getElementById('webcam-controls-live');
    const webcamControlsPreview = document.getElementById('webcam-controls-preview');
    const webcamCaptureBtn = document.getElementById('webcam-capture-btn');
    const webcamRetakeBtn = document.getElementById('webcam-retake-btn');
    const webcamUseBtn = document.getElementById('webcam-use-btn');
    const webcamSwitchBtn = document.getElementById('webcam-switch-btn');
    const webcamCamLabel = document.getElementById('webcam-cam-label');

    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');

    const configPlatformSelect = document.getElementById('config-platform');
    const configHostPortFields = document.getElementById('config-host-port-fields');
    const configApiKeyField = document.getElementById('config-api-key-field');
    const configApiKeyInput = document.getElementById('config-api-key');
    const configApiKeyStatus = document.getElementById('config-api-key-status');
    const configModelSearchFields = document.getElementById('config-model-search-fields');
    const configHostInput = document.getElementById('config-host');
    const configPortInput = document.getElementById('config-port');
    const configModelInput = document.getElementById('config-model');
    const configModelSelect = document.getElementById('config-model-select');
    const codingModelEnabled = document.getElementById('coding-model-enabled');
    const codingModelPremiumBadge = document.getElementById('coding-model-premium-badge');
    const codingModelPremiumBanner = document.getElementById('coding-model-premium-banner');
    const codingModelFields = document.getElementById('coding-model-fields');
    const codingModelHostInput = document.getElementById('coding-model-host');
    const codingModelPortInput = document.getElementById('coding-model-port');
    const codingModelSelect = document.getElementById('coding-model-select');
    const codingModelFetchBtn = document.getElementById('coding-model-fetch-btn');
    const codingModelInput = document.getElementById('coding-model-input');
    const codingModelAuto = document.getElementById('coding-model-auto');
    const ollamaThinkBox = document.getElementById('ollama-think');
    const ollamaKeepAliveInput = document.getElementById('ollama-keep-alive');
    const codeModeToggle = document.getElementById('code-mode-toggle');
    const guestChatEnabledBox = document.getElementById('guest-chat-enabled');
    const guestChatStatus = document.getElementById('guest-chat-status');
    const secondaryModelEnabled = document.getElementById('secondary-model-enabled');
    const secondaryModelPremiumBadge = document.getElementById('secondary-model-premium-badge');
    const secondaryModelPremiumBanner = document.getElementById('secondary-model-premium-banner');
    const secondaryModelFields = document.getElementById('secondary-model-fields');
    const secondaryModeSequentialBtn = document.getElementById('secondary-mode-sequential');
    const secondaryModeParallelBtn = document.getElementById('secondary-mode-parallel');
    const secondaryModelModeInput = document.getElementById('secondary-model-mode');
    const secondaryModelPlatform = document.getElementById('secondary-model-platform');
    const secondaryModelHostPortFields = document.getElementById('secondary-model-host-port-fields');
    const secondaryModelHostInput = document.getElementById('secondary-model-host');
    const secondaryModelPortInput = document.getElementById('secondary-model-port');
    const secondaryModelApiKeyField = document.getElementById('secondary-model-api-key-field');
    const secondaryModelApiKeyInput = document.getElementById('secondary-model-api-key');
    const secondaryModelKeyStatus = document.getElementById('secondary-model-key-status');
    const secondaryModelNameInput = document.getElementById('secondary-model-name');
    const fetchModelsBtn = document.getElementById('fetch-models-btn');
    const imageGenPremiumBadge = document.getElementById('image-gen-premium-badge');
    const imageGenPremiumBanner = document.getElementById('image-gen-premium-banner');
    const imageGenPlatform = document.getElementById('image-gen-platform');
    const imageGenLocalFields = document.getElementById('image-gen-local-fields');
    const imageGenCloudFields = document.getElementById('image-gen-cloud-fields');
    const imageGenHostInput = document.getElementById('image-gen-host');
    const imageGenPortInput = document.getElementById('image-gen-port');
    const imageGenModelSelect = document.getElementById('image-gen-model-select');
    const imageGenFetchModelsBtn = document.getElementById('image-gen-fetch-models-btn');
    const imageGenApiKeyInput = document.getElementById('image-gen-api-key');
    const imageGenKeyStatus = document.getElementById('image-gen-key-status');
    const imageGenSaveBtn = document.getElementById('image-gen-save-btn');
    const imageGenStatus = document.getElementById('image-gen-status');
    const configUiLang = document.getElementById('config-ui-lang');
    // Sprache wie in den anderen Aura-Produkten: eine Auswahl (Karte "Darstellung" im Reiter Design) und die Auswahl im Reiter "Sprache" stellen sofort um und bleiben im Gleichlauf.
    // Für angemeldete Personen wird die Wahl als persönliche Einstellung gespeichert (sie folgt der Person auf jedes Gerät).
    if (window.AuraI18n) {
        window.AuraI18n.onChange((lang) => {
            if (configUiLang && configUiLang.value !== lang) configUiLang.value = lang;
            if (currentUser && appConfig.ui_lang !== lang) { appConfig.ui_lang = lang; saveConfigToDB('ui_lang', lang); applyUiLanguage(lang); }
        });
        if (configUiLang) configUiLang.addEventListener('change', () => window.AuraI18n.set(configUiLang.value));
    }
    const configAvatarVoice = document.getElementById('config-avatar-voice');
    const configHeyAura = document.getElementById('config-hey-aura');
    const configDailyRecap = document.getElementById('config-daily-recap');
    const configCalendarReminders = document.getElementById('config-calendar-reminders');
    const configCalendarReminderMinutes = document.getElementById('config-calendar-reminder-minutes');
    const dailyRecapBanner = document.getElementById('daily-recap-banner');
    const configAccentColor = document.getElementById('config-accent-color');
    const configLayout = document.getElementById('config-layout');
    const configAvatarSize = document.getElementById('config-avatar-size');
    const configAvatarPosition = document.getElementById('config-avatar-position');
    const configBgColor = document.getElementById('config-bg-color');
    const configChatBg = document.getElementById('config-chat-bg');
    const configChatBgRemoveBtn = document.getElementById('config-chat-bg-remove-btn');

    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const authError = document.getElementById('auth-error');
    const authGuestDivider = document.getElementById('auth-guest-divider');
    const auth2faVerify = document.getElementById('auth-2fa-verify');
    const auth2faCode = document.getElementById('auth-2fa-code');
    const auth2faVerifyError = document.getElementById('auth-2fa-verify-error');
    const auth2faVerifyBtn = document.getElementById('auth-2fa-verify-btn');
    const auth2faSetup = document.getElementById('auth-2fa-setup');
    const auth2faQr = document.getElementById('auth-2fa-qr');
    const auth2faSecret = document.getElementById('auth-2fa-secret');
    const auth2faSetupCode = document.getElementById('auth-2fa-setup-code');
    const auth2faSetupError = document.getElementById('auth-2fa-setup-error');
    const auth2faSetupBtn = document.getElementById('auth-2fa-setup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const currentUserDisplay = document.getElementById('current-user-display');
    const guestContinueBtn = document.getElementById('guest-continue-btn');
    const guestStayBtn = document.getElementById('guest-stay-btn');
    const apaleoGuestCheck = document.getElementById('apaleo-guest-check');

    const menuItemAdminPanel = document.getElementById('menu-item-admin-panel');
    const modalAdminPanel = document.getElementById('modal-admin-panel');
    const adminUsersList = document.getElementById('admin-users-list');
    const adminUsersError = document.getElementById('admin-users-error');
    const adminTabBtnUsers = document.getElementById('admin-tab-btn-users');
    const adminTabBtnBranding = document.getElementById('admin-tab-btn-branding');
    const adminTabBtnAppstore = document.getElementById('admin-tab-btn-appstore');
    const adminTabAppstore = document.getElementById('admin-tab-appstore');
    const adminTabUsers = document.getElementById('admin-tab-users');
    const adminTabBranding = document.getElementById('admin-tab-branding');
    const adminTabBtnMail = document.getElementById('admin-tab-btn-mail');
    const adminTabMail = document.getElementById('admin-tab-mail');
    const adminTabBtn2fa = document.getElementById('admin-tab-btn-2fa');
    const adminTab2fa = document.getElementById('admin-tab-2fa');
    const admin2faToggle = document.getElementById('admin-2fa-toggle');
    const admin2faStatus = document.getElementById('admin-2fa-status');
    const adminTabBtnTtsStt = document.getElementById('admin-tab-btn-ttsstt');
    const adminTabTtsStt = document.getElementById('admin-tab-ttsstt');
    const adminTabBtnApi = document.getElementById('admin-tab-btn-api');
    const adminTabApi = document.getElementById('admin-tab-api');
    const apiPremiumBanner = document.getElementById('api-premium-banner');
    const apiExampleUrl = document.getElementById('api-example-url');
    const apiKeyLabelInput = document.getElementById('api-key-label-input');
    const apiKeyCreateBtn = document.getElementById('api-key-create-btn');
    const apiKeyNewReveal = document.getElementById('api-key-new-reveal');
    const apiKeyNewValue = document.getElementById('api-key-new-value');
    const apiKeysList = document.getElementById('api-keys-list');
    const integrationsPremiumBanner = document.getElementById('integrations-premium-banner');
    const dirigeraIpInput = document.getElementById('dirigera-ip-input');
    const dirigeraPairBtn = document.getElementById('dirigera-pair-btn');
    const dirigeraPairStatus = document.getElementById('dirigera-pair-status');
    const sonosNameInput = document.getElementById('sonos-name-input');
    const sonosIpInput = document.getElementById('sonos-ip-input');
    const sonosAddBtn = document.getElementById('sonos-add-btn');
    const sonosAddStatus = document.getElementById('sonos-add-status');
    const nukiNameInput = document.getElementById('nuki-name-input');
    const nukiIpInput = document.getElementById('nuki-ip-input');
    const nukiTokenInput = document.getElementById('nuki-token-input');
    const nukiAddBtn = document.getElementById('nuki-add-btn');
    const nukiAddStatus = document.getElementById('nuki-add-status');
    const localMediaBaseUrlInput = document.getElementById('local-media-base-url-input');
    const localMediaBaseUrlSaveBtn = document.getElementById('local-media-base-url-save-btn');
    const localMediaBaseUrlStatus = document.getElementById('local-media-base-url-status');
    const integrationsList = document.getElementById('integrations-list');
    const customIntName = document.getElementById('custom-int-name');
    const customIntUrl = document.getElementById('custom-int-url');
    const customIntAuthHeader = document.getElementById('custom-int-auth-header');
    const customIntAuthValue = document.getElementById('custom-int-auth-value');
    const customIntCommands = document.getElementById('custom-int-commands');
    const customIntAddCommandBtn = document.getElementById('custom-int-add-command-btn');
    const customIntSaveBtn = document.getElementById('custom-int-save-btn');
    const customIntStatus = document.getElementById('custom-int-status');
    const adminTabBtnLicense = document.getElementById('admin-tab-btn-license');
    const adminTabLicense = document.getElementById('admin-tab-license');
    const adminLicenseCurrent = document.getElementById('admin-license-current');
    const licenseSyncStatus = document.getElementById('license-sync-status');   // Lizenz kommt aus AuraControl: hier nur die Anzeige des letzten Abholens
    const licenseCheckinStatus = document.getElementById('license-checkin-status');
    const chatBgPremiumBadge = document.getElementById('chat-bg-premium-badge');
    const chatBgPremiumNote = document.getElementById('chat-bg-premium-note');
    const adminMailHost = document.getElementById('admin-mail-host');
    const adminMailPort = document.getElementById('admin-mail-port');
    const adminMailSecure = document.getElementById('admin-mail-secure');
    const adminMailUser = document.getElementById('admin-mail-user');
    const adminMailPass = document.getElementById('admin-mail-pass');
    const adminMailFrom = document.getElementById('admin-mail-from');
    const adminMailSaveBtn = document.getElementById('admin-mail-save-btn');
    const adminMailSaveStatus = document.getElementById('admin-mail-save-status');
    const adminMailTestTo = document.getElementById('admin-mail-test-to');
    const adminMailTestBtn = document.getElementById('admin-mail-test-btn');
    const adminMailTestStatus = document.getElementById('admin-mail-test-status');
    const adminUserLimitDisplay = document.getElementById('admin-user-limit-display');

    const brandingPremiumBanner = document.getElementById('branding-premium-banner');
    const brandingLogoPreview = document.getElementById('branding-logo-preview');
    const brandingLogoFile = document.getElementById('branding-logo-file');
    const brandingLogoUploadBtn = document.getElementById('branding-logo-upload-btn');
    const brandingLogoResetBtn = document.getElementById('branding-logo-reset-btn');
    const brandingIconPreview = document.getElementById('branding-icon-preview');
    const brandingIconFile = document.getElementById('branding-icon-file');
    const brandingIconUploadBtn = document.getElementById('branding-icon-upload-btn');
    const brandingIconResetBtn = document.getElementById('branding-icon-reset-btn');
    const brandingStatus = document.getElementById('branding-status');

    let pending2faViaAuraDirect = false;
    let speechEnabled = true;
    let recognition = null;
    let isRecording = false;
    let mediaRecorder = null;
    let mediaStream = null;
    let audioChunks = [];
    let selectedFiles = []; // mehrere Dateien gleichzeitig anhängbar
    let webcamStream = null;
    let webcamMode = 'photo'; // 'photo' | 'video'
    let webcamRecorder = null;
    let webcamChunks = [];
    let webcamIsRecording = false;
    let voiceModeActive = false;
    let webcamRecordSeconds = 0;
    let webcamRecordInterval = null;
    let webcamCapturedBlob = null;
    let webcamFacing = 'environment';    // Standard: Rückkamera; der Knopf auf der Vorschau schaltet auf die Frontkamera
    let webcamDeviceId = null;           // nur gesetzt, wenn zwischen mehreren Kameras ohne Richtungsangabe gewechselt wurde
    let webcamCurrentDeviceId = null;    // die Kamera des laufenden Streams
    let webcamSession = 0;               // zählt Starts/Stopps: ein verspätet fertiger Start nach dem Schließen gibt die Kamera sofort wieder frei
    let webcamSwitching = false;
    let webSearchEnabled = false;
    let workspaceEnabled = false;
    let codeModeEnabled = false;
    // --- Sprachen für Gäste: Deutsch, Englisch, Französisch, Spanisch, Italienisch ---
    // Die Menüs der Oberfläche gibt es nur auf Deutsch und Englisch; die Texte rund um "Mein Aufenthalt" und die Meldungen
    // für Gäste in allen fünf. Die Beschriftung des Menüpunkts muss mit der übereinstimmen, auf die der Server hinweist.
    const GUEST_LANGS = ['de', 'en', 'fr', 'es', 'it'];
    const SPEECH_LOCALES = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
    const GUEST_I18N = {
        de: {
            menu: 'Mein Aufenthalt', menuEnd: 'Aufenthalt beenden', resPh: 'Reservierungsnummer', namePh: 'Nachname', submit: 'Anmelden', checking: 'Prüfe ...',
            intro: 'Gib deine Reservierungsnummer (steht in der Bestätigung, z.B. ABCD1234-1) und deinen Nachnamen ein. Danach kann ich dir Fragen zu deiner Reservierung beantworten: Anreise, Abreise, Nächte und Zimmer. Preise und Daten anderer Gäste zeige ich nie.',
            welcome: (n) => `Hallo${n ? ' ' + n : ''}! Ich habe deine Reservierung gefunden. Du kannst mich jetzt zum Beispiel fragen: „Wann ist mein Check-out?“, „Welches Zimmer habe ich?“ oder „Wie viele Nächte bleibe ich?“.`,
            ended: 'Dein Aufenthalt ist beendet. Ich zeige keine Reservierungsdaten mehr an.',
            needLogin: 'Zum Chatten mit Aura bitte anmelden. Als Gast sind nur Uhrzeit, Datum und einfaches Rechnen möglich.',
            expired: 'Die Gast-Sitzung ist abgelaufen. Bitte „Als Gast fortfahren“ erneut wählen.',
            idleCleared: '🕐 Der Chat wurde wegen Inaktivität automatisch geleert.',
            err: { locked: 'Zu viele Versuche. Bitte später erneut versuchen oder an der Rezeption fragen.' }
        },
        en: {
            menu: 'My stay', menuEnd: 'End stay', resPh: 'Reservation number', namePh: 'Last name', submit: 'Sign in', checking: 'Checking ...',
            intro: 'Enter your reservation number (shown in your confirmation, e.g. ABCD1234-1) and your last name. Then I can answer questions about your reservation: arrival, departure, nights and room. I never show prices or other guests’ data.',
            welcome: (n) => `Hello${n ? ' ' + n : ''}! I found your reservation. You can now ask me, for example: “When is my check-out?”, “Which room do I have?” or “How many nights am I staying?”.`,
            ended: 'Your stay has ended. I no longer show any reservation data.',
            needLogin: 'Please sign in to chat with Aura. As a guest only the time, the date and simple calculations are available.',
            expired: 'The guest session has expired. Please choose “Continue as Guest” again.',
            idleCleared: '🕐 The chat was automatically cleared due to inactivity.',
            err: { locked: 'Too many attempts. Please try again later or ask at the reception.' }
        },
        fr: {
            menu: 'Mon séjour', menuEnd: 'Terminer le séjour', resPh: 'Numéro de réservation', namePh: 'Nom', submit: 'Se connecter', checking: 'Vérification ...',
            intro: 'Saisissez votre numéro de réservation (indiqué dans la confirmation, p. ex. ABCD1234-1) et votre nom. Je pourrai ensuite répondre à vos questions sur votre réservation : arrivée, départ, nuits et chambre. Je n’affiche jamais de prix ni de données d’autres clients.',
            welcome: (n) => `Bonjour${n ? ' ' + n : ''} ! J’ai trouvé votre réservation. Vous pouvez maintenant me demander par exemple : « Quand est mon départ ? », « Quelle chambre ai-je ? » ou « Combien de nuits dure mon séjour ? ».`,
            ended: 'Votre séjour est terminé. Je n’affiche plus de données de réservation.',
            needLogin: 'Veuillez vous connecter pour discuter avec Aura. En tant qu’invité, seuls l’heure, la date et des calculs simples sont disponibles.',
            expired: 'La session invité a expiré. Veuillez choisir à nouveau « Continuer en tant qu’invité ».',
            idleCleared: '🕐 Le chat a été vidé automatiquement en raison d’une inactivité.',
            err: { locked: 'Trop de tentatives. Veuillez réessayer plus tard ou vous adresser à la réception.' }
        },
        es: {
            menu: 'Mi estancia', menuEnd: 'Terminar estancia', resPh: 'Número de reserva', namePh: 'Apellido', submit: 'Entrar', checking: 'Comprobando ...',
            intro: 'Introduzca su número de reserva (figura en la confirmación, p. ej. ABCD1234-1) y su apellido. Después podré responder a sus preguntas sobre su reserva: llegada, salida, noches y habitación. Nunca muestro precios ni datos de otros huéspedes.',
            welcome: (n) => `¡Hola${n ? ' ' + n : ''}! He encontrado su reserva. Ahora puede preguntarme, por ejemplo: «¿Cuándo es mi salida?», «¿Qué habitación tengo?» o «¿Cuántas noches me quedo?».`,
            ended: 'Su estancia ha terminado. Ya no muestro datos de la reserva.',
            needLogin: 'Inicie sesión para chatear con Aura. Como invitado solo están disponibles la hora, la fecha y cálculos sencillos.',
            expired: 'La sesión de invitado ha caducado. Elija de nuevo «Continuar como invitado».',
            idleCleared: '🕐 El chat se ha vaciado automáticamente por inactividad.',
            err: { locked: 'Demasiados intentos. Inténtelo más tarde o pregunte en recepción.' }
        },
        it: {
            menu: 'Il mio soggiorno', menuEnd: 'Termina il soggiorno', resPh: 'Numero di prenotazione', namePh: 'Cognome', submit: 'Accedi', checking: 'Verifica ...',
            intro: 'Inserisca il numero di prenotazione (indicato nella conferma, ad es. ABCD1234-1) e il cognome. Potrò poi rispondere alle sue domande sulla prenotazione: arrivo, partenza, notti e camera. Non mostro mai prezzi né dati di altri ospiti.',
            welcome: (n) => `Buongiorno${n ? ' ' + n : ''}! Ho trovato la sua prenotazione. Ora può chiedermi ad esempio: «Quando è la mia partenza?», «Che camera ho?» oppure «Quante notti mi fermo?».`,
            ended: 'Il suo soggiorno è terminato. Non mostro più dati della prenotazione.',
            needLogin: 'Acceda per chattare con Aura. Come ospite sono disponibili solo ora, data e semplici calcoli.',
            expired: 'La sessione ospite è scaduta. Scelga di nuovo «Continua come ospite».',
            idleCleared: '🕐 La chat è stata svuotata automaticamente per inattività.',
            err: { locked: 'Troppi tentativi. Riprovi più tardi o si rivolga alla reception.' }
        }
    };
    let guestLang = 'de';
    const gt = (key, ...args) => { const v = (GUEST_I18N[guestLang] || GUEST_I18N.de)[key]; return typeof v === 'function' ? v(...args) : v; };
    // Voreinstellung für einen neuen Gast: Sprache des Browsers, sonst die des Hauses
    function defaultGuestLang() {
        const nav = String(navigator.language || '').slice(0, 2).toLowerCase();
        if (GUEST_LANGS.includes(nav)) return nav;
        return GUEST_LANGS.includes(appConfig.ui_lang) ? appConfig.ui_lang : 'de';
    }
    function applyGuestTexts() {
        if (menuItemStayLabel) menuItemStayLabel.textContent = guestStayVerified ? gt('menuEnd') : gt('menu');
        if (stayTitle) stayTitle.textContent = '🏨 ' + gt('menu');
        if (stayIntro) stayIntro.textContent = gt('intro');
        if (stayReservationInput) stayReservationInput.placeholder = gt('resPh');
        if (stayLastNameInput) stayLastNameInput.placeholder = gt('namePh');
        if (staySubmitBtn) staySubmitBtn.textContent = gt('submit');
        if (guestLangSelect) guestLangSelect.value = guestLang;
    }
    // Sprache eines Gastes wechseln. Die Menüs gibt es nur auf Deutsch und Englisch: Für Französisch, Spanisch und
    // Italienisch bleiben sie englisch. Wirkt nur im Browser (nichts wird gespeichert).
    function setGuestLang(lang) {
        if (!GUEST_LANGS.includes(lang)) return;
        guestLang = lang;
        if (window.AuraI18n) window.AuraI18n.set(lang);
        appConfig.ui_lang = lang === 'de' ? 'de' : 'en';
        applyUiLanguage(appConfig.ui_lang);
        applyGuestTexts();
    }

    let guestStayEnabled = false;   // bietet der Server "Mein Aufenthalt" an (Apaleo)?
    let guestStayVerified = false;  // hat sich dieser Gast schon mit seiner Reservierung ausgewiesen?
    let guestStayOffered = false;   // Anmeldebildschirm: Knopf "mit Buchungsnummer anmelden" zeigen?
    let authStep = 'form';          // Schritt im Anmeldefenster (form, 2FA ...)
    let guestChatEnabled = false; // vom Server beim "Als Gast fortfahren" geholt: darf ein Gast mit der KI chatten?
    let piperVoicesCache = new Map(); // Piper: Stimmenname -> { speakerCount, speakers[] }
    let piperVoicesLoaded = false;
    let currentWorkspaceFolderId = null; // null = Hauptverzeichnis
    let workspaceFoldersCache = [];
    let workspaceDocsCache = [];
    let licenseFeatures = []; // z.B. ['chat_bg', 'tts_stt'] - vom Server geladen, siehe loadLicenseFeatures()
    let browserVoices = [];

    let currentUser = null; // Wird beim Start per /api/me aus der Server-Session geladen (kein localStorage mehr - siehe initApp)
    let chats = [];
    let currentChatId = null;

    let appConfig = {
        aurachat_host: window.location.hostname || 'localhost',
        aurachat_port: '11434',
        aurachat_model: 'gemma4:e2b',
        aurachat_platform: 'ollama', // 'ollama' | 'lmstudio' | 'llamacpp' | 'openai-compatible'
        coding_model_enabled: false,
        coding_model_host: '',
        coding_model_port: '11434',
        coding_model: '',
        coding_model_auto: 'true',
        ollama_think: 'false',
        ollama_keep_alive: '',
        guest_chat_enabled: 'false',
        apaleo_guest_enabled: 'false',
        apaleo_write_enabled: 'false',
        apaleo_write_checkin: 'false',
        apaleo_write_checkout: 'false',
        apaleo_write_assign: 'false',
        apaleo_write_dirty: 'false',
        hk_staff_report_enabled: 'false',
        hk_guest_report_enabled: 'false',
        secondary_model_enabled: false,
        secondary_model_platform: 'ollama',
        secondary_model_host: '',
        secondary_model_port: '11434',
        secondary_model_name: '',
        secondary_model_mode: 'sequential',
        tts_stt_platform: 'browser', // 'browser' | 'self-hosted' | 'other'
        tts_stt_host: 'tts-stt', // Docker-interner Servicename des mitgelieferten Containers (Standard-Vorschlag, bis explizit etwas gespeichert wurde)
        tts_stt_port: '8000',
        tts_wyoming_enabled: 'false',
        tts_wyoming_host: 'piper', // der mitgelieferte Container (Docker-Dienstname)
        tts_wyoming_port: '10200',
        stt_source: 'browser',
        tts_model: 'speaches-ai/piper-de_DE-kerstin-low',
        tts_voice: 'de_DE-kerstin-low',
        stt_model: '',
        image_gen_platform: 'none', // 'none' | 'local' | 'openai' | 'stability'
        image_gen_host: '',
        image_gen_port: '7860',
        image_gen_model: '',
        speech_enabled: 'true',
        ui_lang: 'de',
        avatar_voice: '',
        accent_color: '#2563eb',
        bg_color: '#030712',
        chat_bg_image: '',
        layout: 'standard', // 'standard' | 'kompakt' | 'fokus' | 'rechts' | 'breit'
        avatar_size: 'medium', // 'small' | 'medium' | 'large'
        avatar_position: 'sidebar', // 'sidebar' | 'center'
        avatar_face: 'images/avatar/face.gif',
        avatar_speech: 'images/avatar/speech.gif'
    };

    // Läuft jetzt über den nginx-Reverse-Proxy unter /api (gleiche Origin wie das Frontend).
    // Das macht CORS überflüssig und lässt Session-Cookies ohne Cross-Site-Sonderfälle funktionieren.
    const backendUrl = `${window.location.origin}/api`;

    const translations = {
        de: {
            newChat: "Neuer Chat",
            history: "Verlauf",
            workspaceTitle: "AuraChat Workspace",
            ollamaStatus: "Lokal verbunden",
            loggedInAs: "Angemeldet als",
            notLoggedIn: "Gast",
            logout: "Logout",
            login: "Einloggen",
            btnPassword: "🔑 Passwort",
            btnDeleteAcc: "🗑️ Account löschen",
            menuAbout: "ℹ️ Über Aura-Suite",
            menuScreenFormat: "🖥️ Bildschirmformat",
            menuModel: "🔍 Modell-Suche & Server",
            menuSettings: "⚙️ Einstellungen",
            menuAdminPanel: "🛠️ Admin Panel",
            guestContinue: "Als Gast fortfahren",
            guestStayLogin: "🏨 Hotelgast: mit Buchungsnummer anmelden",
            guestIdleCleared: "🕐 Der Chat wurde wegen Inaktivität automatisch geleert.",
            ttsOn: "Sprache: An",
            ttsOff: "Sprache: Aus",
            inputPlaceholder: "Schreibe eine Nachricht...",
            saveBtn: "Speichern",
            lblUiLang: "Oberflächen-Sprache (UI)",
            lblVoice: "Avatar-Stimme (Sprachausgabe / TTS)",
            defaultVoice: "-- Standard-Stimme --",
            defaultChatTitle: "Neuer Chat"
        },
        en: {
            newChat: "New Chat",
            history: "History",
            workspaceTitle: "AuraChat Workspace",
            ollamaStatus: "Locally connected",
            loggedInAs: "Logged in as",
            notLoggedIn: "Guest",
            logout: "Logout",
            login: "Log in",
            btnPassword: "🔑 Password",
            btnDeleteAcc: "🗑️ Delete Account",
            menuAbout: "ℹ️ About Aura Suite",
            menuScreenFormat: "🖥️ Screen format",
            menuModel: "🔍 Model Search & Server",
            menuSettings: "⚙️ Settings",
            menuAdminPanel: "🛠️ Admin Panel",
            guestContinue: "Continue as Guest",
            guestStayLogin: "🏨 Hotel guest: sign in with booking number",
            guestIdleCleared: "🕐 The chat was automatically cleared due to inactivity.",
            ttsOn: "Speech: On",
            ttsOff: "Speech: Off",
            inputPlaceholder: "Type a message...",
            saveBtn: "Save",
            lblUiLang: "UI Language",
            lblVoice: "Avatar Voice (TTS)",
            defaultVoice: "-- Default Voice --",
            defaultChatTitle: "New Chat"
        }
    };

    function applyUiLanguage(langCode) {
        const t = translations[langCode] || translations.de;
        if (newChatBtn) {
            const spanText = newChatBtn.querySelector('span:last-child');
            if (spanText) spanText.textContent = t.newChat;
        }
        const sidebarHistoryTitle = document.querySelector('#sidebar .uppercase');
        if (sidebarHistoryTitle) sidebarHistoryTitle.textContent = t.history;

        const wsTitle = document.querySelector('main header .text-sm.font-medium');
        if (wsTitle) wsTitle.textContent = t.workspaceTitle;
        const wsStatus = document.querySelector('main header .text-xs.text-slate-400');
        if (wsStatus) wsStatus.textContent = t.ollamaStatus;

        const userLbl = document.querySelector('#dropdown-menu .text-\\[10px\\].text-slate-400');
        if (userLbl) userLbl.textContent = t.loggedInAs;
        if (logoutBtn) logoutBtn.textContent = currentUser ? t.logout : t.login;
        if (currentUserDisplay && !currentUser) currentUserDisplay.textContent = t.notLoggedIn;
        if (changePasswordBtn) changePasswordBtn.textContent = t.btnPassword;
        if (deleteAccountBtn) deleteAccountBtn.textContent = t.btnDeleteAcc;
        if (guestContinueBtn) guestContinueBtn.textContent = t.guestContinue;
        if (guestStayBtn && t.guestStayLogin) guestStayBtn.textContent = t.guestStayLogin;

        if (menuItemAbout) menuItemAbout.innerHTML = `<span>ℹ️</span> <span>${t.menuAbout.replace("ℹ️ ", "")}</span>`;
        if (menuItemModel) menuItemModel.innerHTML = `<span>🔍</span> <span>${t.menuModel.replace("🔍 ", "")}</span>`;
        if (menuItemSettings) menuItemSettings.innerHTML = `<span>⚙️</span> <span>${t.menuSettings.replace("⚙️ ", "")}</span>`;
        if (menuScreenFormatLabel && t.menuScreenFormat) menuScreenFormatLabel.textContent = t.menuScreenFormat.replace("🖥️ ", "");
        if (menuItemAdminPanel) menuItemAdminPanel.innerHTML = `<span>🛠️</span> <span>${t.menuAdminPanel.replace("🛠️ ", "")}</span>`;

        if (userInput) userInput.placeholder = codeModeEnabled ? codeModePlaceholder() : t.inputPlaceholder;
        updateTTSButtonUI();
    }

    function loadVoices() {
        if (!window.speechSynthesis) return;
        browserVoices = window.speechSynthesis.getVoices();
        if (configAvatarVoice) {
            const currentSelected = configAvatarVoice.value || appConfig.avatar_voice;
            const t = translations[appConfig.ui_lang] || translations.de;
            configAvatarVoice.innerHTML = `<option value="">${t.defaultVoice}</option>`;
            browserVoices.forEach(voice => {
                const opt = document.createElement('option');
                opt.value = voice.name;
                opt.textContent = `${voice.name} (${voice.lang})`;
                if (voice.name === currentSelected) opt.selected = true;
                configAvatarVoice.appendChild(opt);
            });
        }
    }

    if (window.speechSynthesis) {
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    (async () => {
        await checkAndShowPrivacyGate();
        await initApp();
        await syncPrivacyAcceptanceIfLoggedIn();
    })();

    let privacyPolicyVersion = null;

    function simpleMarkdownToHtml(md) {
        return md.split('\n').map(line => {
            if (line.startsWith('## ')) return `<h3 class="text-xs font-semibold text-white mt-3 mb-1">${line.slice(3)}</h3>`;
            if (line.startsWith('# ')) return `<h2 class="text-sm font-bold text-white mt-1 mb-2">${line.slice(2)}</h2>`;
            if (line.startsWith('- ')) return `<div class="ml-3">• ${line.slice(2)}</div>`;
            if (line.startsWith('---')) return '<hr class="border-slate-700 my-3">';
            if (line.startsWith('*') && line.endsWith('*') && line.length > 2) return `<p class="italic text-slate-500 mt-2">${line.slice(1, -1)}</p>`;
            if (line.trim() === '') return '<div class="h-2"></div>';
            return `<p class="mb-1">${line}</p>`;
        }).join('');
    }

    // Läuft ganz am Anfang, bevor irgendetwas anderes nutzbar ist - gilt für Gäste UND
    // registrierte Benutzer gleichermassen (Zustimmung wird lokal im Browser gemerkt).
    async function checkAndShowPrivacyGate() {
        try {
            const res = await fetch(`${backendUrl}/privacy-policy`);
            const policy = await res.json();
            privacyPolicyVersion = policy.version;
            const localVersion = parseInt(localStorage.getItem('aurachat_privacy_version') || '0', 10);
            if (localVersion >= policy.version) return;

            if (privacyPolicyText) privacyPolicyText.innerHTML = simpleMarkdownToHtml(policy.text);
            if (modalPrivacy) modalPrivacy.classList.remove('hidden');

            await new Promise((resolve) => {
                if (!privacyAcceptBtn) return resolve();
                privacyAcceptBtn.addEventListener('click', () => {
                    localStorage.setItem('aurachat_privacy_version', String(privacyPolicyVersion));
                    if (modalPrivacy) modalPrivacy.classList.add('hidden');
                    resolve();
                }, { once: true });
            });
        } catch (err) {
            console.error('Datenschutz-Prüfung fehlgeschlagen:', err);
            // Im Fehlerfall (Server kurz nicht erreichbar) nicht blockieren
        }
    }

    // Meldet eine bereits (lokal) erteilte Zustimmung ans Konto, sobald jemand eingeloggt
    // ist - rein fürs Nachvollziehen auf Server-Seite, die eigentliche Sperre läuft lokal.
    async function syncPrivacyAcceptanceIfLoggedIn() {
        if (!currentUser || privacyPolicyVersion === null) return;
        const localVersion = parseInt(localStorage.getItem('aurachat_privacy_version') || '0', 10);
        if (localVersion < privacyPolicyVersion) return;
        try {
            await fetch(`${backendUrl}/privacy-policy/accept`, { method: 'POST', credentials: 'include' });
        } catch (err) { /* nicht kritisch */ }
    }

    function showTopLoadingBar() {
        if (topLoadingBar) topLoadingBar.classList.add('active');
    }
    function hideTopLoadingBar() {
        if (topLoadingBar) topLoadingBar.classList.remove('active');
    }

    if (adminTabBtnPrivacy) adminTabBtnPrivacy.addEventListener('click', () => switchAdminTab('privacy'));

    async function loadAdminPrivacyPolicy() {
        if (!privacyPolicyEditor) return;
        try {
            const res = await fetch(`${backendUrl}/privacy-policy`);
            const policy = await res.json();
            privacyPolicyEditor.value = policy.text;
        } catch (err) {
            privacyPolicyEditor.value = '';
        }
    }

    if (privacyPolicySaveBtn) {
        privacyPolicySaveBtn.addEventListener('click', async () => {
            if (privacyPolicyStatus) {
                privacyPolicyStatus.textContent = 'Speichere...';
                privacyPolicyStatus.className = 'text-[11px] text-slate-400';
                privacyPolicyStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/privacy-policy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ text: privacyPolicyEditor.value })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (privacyPolicyStatus) {
                    privacyPolicyStatus.textContent = `✓ Gespeichert (Version ${data.version}). Alle müssen jetzt erneut zustimmen.`;
                    privacyPolicyStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (privacyPolicyStatus) {
                    privacyPolicyStatus.textContent = '✗ ' + err.message;
                    privacyPolicyStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    async function initApp() {
        // Server/Modell/Avatar gelten global und werden für Gäste, User und Admins geladen
        await loadGlobalConfig();
        await loadLicenseFeatures();

        // Prüft die echte Server-Session (Cookie) statt localStorage zu vertrauen
        try {
            const res = await fetch(`${backendUrl}/me`, { credentials: 'include' });
            const data = await res.json();
            currentUser = data.user || null;
            // Für dieses Konto per Admin Panel erzwungener Kiosk-Modus (nur Aura, kein Chat) -
            // ?nokiosk=1 als Fluchtoption, damit ein Admin sich selbst nicht aussperrt.
            if (currentUser && data.forceKioskMode && !new URLSearchParams(window.location.search).has('nokiosk')) {
                window.location.href = '/kiosk.html';
                return;
            }
        } catch (err) {
            console.error('Session-Check fehlgeschlagen:', err);
            currentUser = null;
        }

        if (!currentUser) {
            if (authModal) authModal.classList.remove('hidden');
            refreshGuestStayOffer();
        } else {
            if (currentUserDisplay) currentUserDisplay.textContent = currentUser.username;
            await loadPersonalConfig();
            await loadChatsFromBackend();
            loadStreak();
            loadMemoryContext();
            loadPersonalPersona();
            checkDailyRecapAvailability();
            pollAcademyTrainingIndicator();
            startCalendarReminderPolling();
        }
        applyRoleUI();
        applyLicenseUI();
    }

    // Beendet eine vorhandene Anmeldung auf dem Server und startet - falls der Admin den Gast-Chat freigeschaltet hat -
    // eine eigene Gast-Sitzung (ohne Konto, ohne Daten).
    async function startGuestSession() {
        try {
            const res = await fetch(`${backendUrl}/guest/start`, { method: 'POST', credentials: 'include' });
            const data = await res.json();
            guestChatEnabled = !!data.enabled;
            guestStayEnabled = !!data.stay;
        } catch (err) {
            guestChatEnabled = false;
            guestStayEnabled = false;
        }
        guestStayVerified = false; // eine neue Gast-Sitzung kennt noch keine Reservierung
        updateStayMenu();
    }

    // "Mein Aufenthalt" nur für Gäste, nur wenn der Server es anbietet. Nach dem Ausweisen wird daraus "Aufenthalt beenden".
    function updateStayMenu() {
        const show = !currentUser && guestChatEnabled && guestStayEnabled;
        if (!menuItemStay) { if (guestLangRow) guestLangRow.classList.toggle('hidden', !!currentUser); return; }
        menuItemStay.classList.toggle('hidden', !show);
        if (guestLangRow) guestLangRow.classList.toggle('hidden', !!currentUser); // die Sprachwahl ist nur für Gäste
        applyGuestTexts();
    }

    // "Als Gast fortfahren": AuraChat nutzen ohne Login, ohne Chat-Verlauf, ohne persönliche Settings
    async function continueAsGuest() {
        currentUser = null;
        await startGuestSession();
        setGuestLang(defaultGuestLang());
        if (authModal) authModal.classList.add('hidden');
        applyRoleUI();
        applyUiLanguage(appConfig.ui_lang);
        resetGuestIdleTimer();
    }
    if (guestContinueBtn) guestContinueBtn.addEventListener('click', continueAsGuest);

    // Anmeldebildschirm: "Hotelgast: mit Buchungsnummer anmelden" - nur, wenn der Server das Ausweisen anbietet
    // (Gast-Chat an, Apaleo-App aktiviert und verbunden, Schalter für Gäste an). Fragt dazu die öffentliche Route /guest/status.
    async function refreshGuestStayOffer() {
        try {
            const res = await fetch(`${backendUrl}/guest/status`, { credentials: 'include', cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            guestStayOffered = !!(res.ok && data.enabled && data.stay);
        } catch (err) { guestStayOffered = false; }
        if (guestStayBtn) guestStayBtn.classList.toggle('hidden', !guestStayOffered || authStep !== 'form');
    }
    if (guestStayBtn) {
        guestStayBtn.addEventListener('click', async () => {
            await continueAsGuest();
            if (guestChatEnabled && guestStayEnabled) openStayModal();
            else appendMessageToDOM(guestLang === 'de' ? 'Das Anmelden mit Buchungsnummer ist gerade nicht verfügbar. Bitte an der Rezeption fragen.' : 'Signing in with a booking number is not available right now. Please ask at the reception.', 'assistant');
        });
    }

    // --- GAST: CHAT NACH INAKTIVITÄT AUTOMATISCH LEEREN ---
    // Gilt bewusst NUR für Gäste (kein currentUser) - eingeloggte User haben
    // ihre Chats ohnehin dauerhaft gespeichert, da wäre ein Auto-Löschen falsch.
    const GUEST_IDLE_CLEAR_MS = 5 * 60 * 1000; // 5 Minuten
    let guestIdleTimer = null;

    function clearGuestChatDueToInactivity() {
        if (currentUser || !chatContainer || chatContainer.children.length === 0) return;
        chatContainer.innerHTML = '';
        currentChatId = null;
        fetch(`${backendUrl}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}); // Gast-Sitzung beenden; die nächste Frage startet still eine neue
        guestStayVerified = false;
        if (typeof updateStayMenu === 'function') updateStayMenu();
        const t = translations[appConfig.ui_lang] || translations.de;
        appendMessageToDOM(gt('idleCleared') || t.guestIdleCleared, 'assistant');
        if (!currentUser) setGuestLang(defaultGuestLang()); // der nächste Gast beginnt wieder mit der Voreinstellung
    }

    function resetGuestIdleTimer() {
        if (guestIdleTimer) clearTimeout(guestIdleTimer);
        if (currentUser) return; // eingeloggte User: kein Timer nötig
        guestIdleTimer = setTimeout(clearGuestChatDueToInactivity, GUEST_IDLE_CLEAR_MS);
    }

    // Jede Interaktion zählt als Aktivität und schiebt den Timer auf
    ['click', 'keydown', 'input'].forEach(evt => {
        document.addEventListener(evt, () => resetGuestIdleTimer(), { passive: true });
    });
    resetGuestIdleTimer(); // initial starten (greift erst, sobald wirklich im Gast-Modus)

    // Blendet Menüpunkte & Sidebar je nach Rolle (Gast / User / Admin) ein oder aus
    function applyRoleUI() {
        const loggedIn = !!currentUser;
        const isAdmin = loggedIn && currentUser.role === 'admin';

        // Nur eingeloggte User (egal ob User oder Admin) dürfen Einstellungen anpassen
        // (Sprache, Design, Avatar, Persönlichkeit sind dort jetzt gebündelt)
        if (menuItemSettings) menuItemSettings.classList.toggle('hidden', !loggedIn);
        if (menuItemWorkspace) menuItemWorkspace.classList.toggle('hidden', !loggedIn);
        if (menuItemEmail) menuItemEmail.classList.toggle('hidden', !loggedIn);

        // Server/Modell sind global - nur Admin darf sie ändern; Admin Panel nur für Admin
        if (menuItemModel) menuItemModel.classList.toggle('hidden', !isAdmin);
        if (menuItemAdminPanel) menuItemAdminPanel.classList.toggle('hidden', !isAdmin);

        // Passwort/Account-Aktionen nur für eingeloggte User
        if (changePasswordBtn) changePasswordBtn.classList.toggle('hidden', !loggedIn);
        if (deleteAccountBtn) deleteAccountBtn.classList.toggle('hidden', !loggedIn);

        // Für Gäste ausgeblendet: Funktionen, die ein Konto brauchen oder interne Systeme berühren (die Server-Routen
        // dahinter sind für Gäste ohnehin gesperrt - das hier vermeidet nur Sackgassen im Menü).
        const guestHide = (el, hide) => { if (el) el.classList.toggle('guest-hidden', hide); };
        const isGuestView = !loggedIn;
        ['menu-item-export-chat', 'menu-item-auraplan', 'menu-item-auraticket',
         'workspace-toggle', 'code-mode-toggle', 'webcam-button'].forEach(id => guestHide(document.getElementById(id), isGuestView));
        guestHide(document.querySelector('label[for="file-upload"]'), isGuestView);

        if (typeof updateStayMenu === 'function') updateStayMenu();

        // Gäste haben keine Chat-History
        if (newChatBtn) newChatBtn.classList.toggle('hidden', !loggedIn);
        if (chatHistoryList) chatHistoryList.classList.toggle('hidden', !loggedIn);
        const sidebarHistoryLabel = document.querySelector('#sidebar .text-xs.font-semibold.text-slate-400.uppercase.tracking-wider.mb-2.px-1.shrink-0');
        if (sidebarHistoryLabel) sidebarHistoryLabel.classList.toggle('hidden', !loggedIn);

        const t = translations[appConfig.ui_lang] || translations.de;
        if (logoutBtn) logoutBtn.textContent = loggedIn ? t.logout : t.login;
        if (currentUserDisplay) currentUserDisplay.textContent = loggedIn ? currentUser.username : t.notLoggedIn;
    }

    // Wird nach erfolgreichem Login ODER nach bestätigtem 2FA-Code aufgerufen
    // (NICHT beim stillen Wiederherstellen einer bestehenden Sitzung per /api/me - siehe initApp)
    async function completeLogin(data) {
        currentUser = { id: data.userId, username: data.username, firstname: data.firstname || '', role: data.role || 'user' };
        syncPrivacyAcceptanceIfLoggedIn();
        if (authModal) authModal.classList.add('hidden');
        showAuthStep('form'); // für den nächsten Login-Vorgang zurücksetzen
        if (currentUserDisplay) currentUserDisplay.textContent = currentUser.username;
        await loadPersonalConfig();
        await loadChatsFromBackend();
        loadStreak();
        loadMemoryContext();
        loadPersonalPersona();
        checkDailyRecapAvailability();
        pollAcademyTrainingIndicator();
        applyRoleUI();
        if (guestIdleTimer) { clearTimeout(guestIdleTimer); guestIdleTimer = null; } // kein Auto-Löschen mehr nötig, jetzt eingeloggt
        showLoginGreeting();
        startAuraplanNotificationPolling();
        startAuraticketNotificationPolling();
    }

    // --- AuraPlan-Benachrichtigungen: regelmässig abfragen, im Chat anzeigen und vorlesen ---
    let auraplanNotificationInterval = null;
    function startAuraplanNotificationPolling() {
        if (auraplanNotificationInterval) return; // läuft schon
        checkAuraplanNotifications(); // gleich beim Login einmal prüfen
        auraplanNotificationInterval = setInterval(checkAuraplanNotifications, 45000);
    }
    async function checkAuraplanNotifications() {
        try {
            const res = await fetch(`${backendUrl}/auraplan/notifications`, { credentials: 'include' });
            if (!res.ok) return;
            const notifications = await res.json();
            for (const n of notifications) {
                await appendMessage(n.message, 'assistant');
                speakText(n.message);
            }
        } catch { /* nicht kritisch, nächster Versuch in 45s */ }
    }

    // --- AuraTicket-Benachrichtigungen: gleiches Muster - regelmässig abfragen, im Chat
    // anzeigen und vorlesen (neues Ticket eingegangen, Kundschaft hat auf ein zugewiesenes
    // Ticket geantwortet, ...).
    let auraticketNotificationInterval = null;
    function startAuraticketNotificationPolling() {
        if (auraticketNotificationInterval) return;
        checkAuraticketNotifications();
        auraticketNotificationInterval = setInterval(checkAuraticketNotifications, 45000);
    }
    async function checkAuraticketNotifications() {
        try {
            const res = await fetch(`${backendUrl}/auraticket/notifications`, { credentials: 'include' });
            if (!res.ok) return;
            const notifications = await res.json();
            for (const n of notifications) {
                await appendMessage(n.message, 'assistant');
                speakText(n.message);
            }
        } catch { /* nicht kritisch, nächster Versuch in 45s */ }
    }

    // Freundliche Begrüssung von Aura direkt nach dem Einloggen - nicht persistiert,
    // erscheint einmalig oben im aktuell offenen Chat-Fenster.
    function showLoginGreeting() {
        const name = currentUser && currentUser.firstname ? currentUser.firstname : '';
        const greeting = name
            ? `Hallo ${name}! Schön, dich zu sehen. Wie kann ich dir heute helfen?`
            : `Hallo! Schön, dich zu sehen. Wie kann ich dir heute helfen?`;
        appendMessageToDOM(greeting, 'assistant');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        setAvatarSpeaking(true);
        if (speechEnabled) {
            speakText(greeting, () => setAvatarSpeaking(false), '');
        } else {
            setTimeout(() => setAvatarSpeaking(false), 2500);
        }
    }

    // Blendet zwischen Login-Formular / 2FA-Code-Eingabe / 2FA-Einrichtung um
    function showAuthStep(step) {
        if (authForm) authForm.classList.toggle('hidden', step !== 'form');
        if (authGuestDivider) authGuestDivider.classList.toggle('hidden', step !== 'form');
        if (guestContinueBtn) guestContinueBtn.classList.toggle('hidden', step !== 'form');
        authStep = step; if (guestStayBtn) guestStayBtn.classList.toggle('hidden', step !== 'form' || !guestStayOffered);
        if (auth2faVerify) auth2faVerify.classList.toggle('hidden', step !== 'verify');
        if (auth2faSetup) auth2faSetup.classList.toggle('hidden', step !== 'setup');
    }

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = authUsernameInput.value.trim();
            const password = authPasswordInput.value.trim();
            
            const endpoint = `${backendUrl}/login`;
            const payload = { username, password };

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Session-Cookie mitschicken/empfangen
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Aktion fehlgeschlagen');

                if (data.requires2faSetup) {
                    if (auth2faQr) auth2faQr.src = data.qrCodeDataUrl;
                    if (auth2faSecret) auth2faSecret.textContent = data.secret;
                    if (auth2faSetupCode) auth2faSetupCode.value = '';
                    if (auth2faSetupError) auth2faSetupError.classList.add('hidden');
                    showAuthStep('setup');
                    return;
                }
                if (data.requires2fa) {
                    if (auth2faCode) auth2faCode.value = '';
                    if (auth2faVerifyError) auth2faVerifyError.classList.add('hidden');
                    pending2faViaAuraDirect = !!data.viaAuraDirect;
                    showAuthStep('verify');
                    return;
                }

                await completeLogin(data);
            } catch (err) {
                if (authError) {
                    authError.textContent = err.message;
                    authError.classList.remove('hidden');
                }
            }
        });
    }

    if (auth2faVerifyBtn) {
        auth2faVerifyBtn.addEventListener('click', async () => {
            const code = auth2faCode ? auth2faCode.value.trim() : '';
            try {
                const endpoint = pending2faViaAuraDirect ? `${backendUrl}/login/2fa-auradirect` : `${backendUrl}/login/2fa`;
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Code ungültig.');
                await completeLogin(data);
            } catch (err) {
                if (auth2faVerifyError) {
                    auth2faVerifyError.textContent = err.message;
                    auth2faVerifyError.classList.remove('hidden');
                }
            }
        });
    }

    if (auth2faSetupBtn) {
        auth2faSetupBtn.addEventListener('click', async () => {
            const code = auth2faSetupCode ? auth2faSetupCode.value.trim() : '';
            try {
                const res = await fetch(`${backendUrl}/login/2fa-setup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Code ungültig.');
                await completeLogin(data);
            } catch (err) {
                if (auth2faSetupError) {
                    auth2faSetupError.textContent = err.message;
                    auth2faSetupError.classList.remove('hidden');
                }
            }
        });
    }

    if (menuToggleBtn && dropdownMenu) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
        dropdownMenu.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => {
            if (!dropdownMenu.classList.contains('hidden')) dropdownMenu.classList.add('hidden');
        });
    }

    function openModal(modal) {
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
        if (modal) {
            if (configPlatformSelect) configPlatformSelect.value = appConfig.aurachat_platform || 'ollama';
            if (configHostInput) configHostInput.value = appConfig.aurachat_host;
            if (configPortInput) configPortInput.value = appConfig.aurachat_port;
            if (configModelInput) configModelInput.value = appConfig.aurachat_model;
            updatePrimaryPlatformFieldVisibility();
            loadPrimaryModelKeyStatus();
            if (codingModelEnabled) codingModelEnabled.checked = appConfig.coding_model_enabled === 'true';
            if (codingModelHostInput) codingModelHostInput.value = appConfig.coding_model_host || '';
            if (codingModelPortInput) codingModelPortInput.value = appConfig.coding_model_port || '11434';
            if (codingModelInput) codingModelInput.value = appConfig.coding_model || '';
            if (codingModelAuto) codingModelAuto.checked = appConfig.coding_model_auto !== 'false';
            if (ollamaThinkBox) ollamaThinkBox.checked = appConfig.ollama_think === 'true';
            if (ollamaKeepAliveInput) ollamaKeepAliveInput.value = appConfig.ollama_keep_alive || '';
            if (guestChatEnabledBox) guestChatEnabledBox.checked = appConfig.guest_chat_enabled === 'true';
            updateCodingModelFieldVisibility();
            if (secondaryModelEnabled) secondaryModelEnabled.checked = appConfig.secondary_model_enabled === 'true';
            if (secondaryModelPlatform) secondaryModelPlatform.value = appConfig.secondary_model_platform || 'ollama';
            if (secondaryModelHostInput) secondaryModelHostInput.value = appConfig.secondary_model_host || '';
            if (secondaryModelPortInput) secondaryModelPortInput.value = appConfig.secondary_model_port || '11434';
            if (secondaryModelNameInput) secondaryModelNameInput.value = appConfig.secondary_model_name || '';
            setSecondaryModelMode(appConfig.secondary_model_mode || 'sequential');
            updateSecondaryModelFieldVisibility();
            loadSecondaryModelKeyStatus();
            if (imageGenHostInput) imageGenHostInput.value = appConfig.image_gen_host || '';
            if (imageGenPortInput) imageGenPortInput.value = appConfig.image_gen_port || '7860';
            if (imageGenStatus) imageGenStatus.classList.add('hidden');
            if (imageGenPlatform) {
                imageGenPlatform.value = appConfig.image_gen_platform || 'none';
                updateImageGenFieldVisibility();
            }
            loadImageGenKeyStatus();
            if (configUiLang) configUiLang.value = appConfig.ui_lang;
            loadVoices();
            if (configAvatarVoice) configAvatarVoice.value = appConfig.avatar_voice;
            if (configHeyAura) configHeyAura.checked = appConfig.hey_aura_enabled === 'true';
            const heyAuraUnsupportedNote = document.getElementById('hey-aura-unsupported-note');
            if (!SpeechRecognition) {
                if (configHeyAura) configHeyAura.disabled = true;
                if (heyAuraUnsupportedNote) heyAuraUnsupportedNote.classList.remove('hidden');
            }
            if (configDailyRecap) configDailyRecap.checked = appConfig.daily_recap_enabled === 'true';
            if (configCalendarReminders) configCalendarReminders.checked = appConfig.calendar_reminders_enabled === 'true';
            if (configCalendarReminderMinutes) configCalendarReminderMinutes.value = appConfig.calendar_reminder_minutes || '15';
            if (configAccentColor) configAccentColor.value = appConfig.accent_color;
            if (configLayout) configLayout.value = appConfig.layout || 'standard';
            if (configAvatarSize) configAvatarSize.value = appConfig.avatar_size || 'medium';
            if (configAvatarPosition) configAvatarPosition.value = appConfig.avatar_position || 'sidebar';
            if (configBgColor) configBgColor.value = appConfig.bg_color;
            modal.classList.remove('hidden');
        }
    }

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            if (currentPasswordInput) currentPasswordInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            if (passwordChangeError) passwordChangeError.classList.add('hidden');
            if (passwordChangeSuccess) passwordChangeSuccess.classList.add('hidden');
            if (modalChangePassword) modalChangePassword.classList.remove('hidden');
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = currentPasswordInput.value.trim();
            const newPassword = newPasswordInput.value.trim();
            if (!currentPassword || !newPassword || !currentUser) return;

            try {
                const res = await fetch(`${backendUrl}/user/password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Fehler beim Ändern des Passworts');

                if (passwordChangeSuccess) passwordChangeSuccess.classList.remove('hidden');
                if (passwordChangeError) passwordChangeError.classList.add('hidden');
                setTimeout(() => {
                    if (modalChangePassword) modalChangePassword.classList.add('hidden');
                }, 1500);
            } catch (err) {
                if (passwordChangeError) {
                    passwordChangeError.textContent = err.message;
                    passwordChangeError.classList.remove('hidden');
                }
            }
        });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', async () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            const confirmMsg = appConfig.ui_lang === 'en' ? 'Are you sure you want to delete your account?' : 'Bist du sicher, dass du deinen Account löschen möchtest?';
            if (confirm(confirmMsg)) {
                try {
                    const res = await fetch(`${backendUrl}/user/me`, { method: 'DELETE', credentials: 'include' });
                    if (!res.ok) throw new Error('Account konnte nicht gelöscht werden');
                    location.reload();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            }
        });
    }

    // "Über Aura-Suite": die Version (mit Datum und Hinweis) kommt vom Lizenzserver (AuraLic, Kundenübersicht "Aura-Suite-Version"). Alles als reiner Text.
    // Ohne Antwort bleibt der feste Text im Seitenaufbau stehen.
    async function fillAboutVersion() {
        try {
            const res = await fetch(`${backendUrl}/version`, { cache: 'no-store' }); if (!res.ok) return; const d = await res.json();
            const $ = (id) => document.getElementById(id), show = (id, on) => { const e = $(id); if (e) e.classList.toggle('hidden', !on); };
            // JJJJ-MM-TT als TT.MM.JJJJ, ohne Datumsobjekt (kein Weiterrollen unmöglicher Tage wie 30.2., keine Zeitzonen-Verschiebung); ein unmögliches Datum blendet die Zeile aus
            const fmtDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); if (!m) return ''; const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
            const s = d.suite, dateText = s ? fmtDate(s.date) : '';
            const suiteInst = typeof d.suiteInstalled === 'string' && /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/.test(d.suiteInstalled) ? d.suiteInstalled : '';
            show('about-suite-row', !!suiteInst); if (suiteInst && $('about-suite')) $('about-suite').textContent = 'v' + suiteInst;
            show('about-latest', !!s); show('about-latest-pending', !s); show('about-date-row', !!dateText); show('about-note-row', !!(s && s.note)); show('about-update-badge', !!(s && d.updateAvailable));
            if (s) {
                if ($('about-latest')) $('about-latest').textContent = 'v' + s.version;
                if (dateText && $('about-date')) $('about-date').textContent = dateText;
                if (s.note && $('about-note')) $('about-note').textContent = s.note;
            }
        } catch (err) { /* feste Werte bleiben */ }
    }
    if (menuItemAbout) menuItemAbout.addEventListener('click', () => { openModal(modalAbout); fillAboutVersion(); });

    // --- BILDSCHIRMFORMAT: Menüpunkt und Auswahlfenster (alle Texte als Text, nie als HTML) ---
    // Die gewählte Drehung gilt zusätzlich zu jeder Wahl: ein anderes Format/eine andere Auflösung/Automatisch ändert sie NICHT
    const keepRotation = (setting) => screenFormat.withRotation(setting, screenFormat.rotationOf(screenFormat.get()));
    function screenFormatEl(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
    function updateScreenFormatMenuValue() { if (menuScreenFormatValue && screenFormat) menuScreenFormatValue.textContent = screenFormat.label(screenFormat.get()); }
    // "Aktuell: 1360×768 Querformat · Massstab 141 %" (bei Auflösungen mit dem Faktor, mit dem sie ins Fenster passt)
    function screenFormatCurrentText(cur) {
        let text = 'Aktuell: ' + screenFormat.label(cur);
        if (screenFormat.isResolution(cur)) { const box = screenFormat.computeBox(window.innerWidth, window.innerHeight, cur); if (box) text += ` · Massstab ${Math.round(box.scale * 100)} %`; }
        return text;
    }
    function renderScreenFormatModal() {
        if (!screenFormat || !screenFormatGrid) return;
        const cur = screenFormat.get();
        const on = 'border-blue-500 bg-blue-500/10 text-white', off = 'border-slate-700 text-slate-300';
        if (screenFormatAutoBtn) screenFormatAutoBtn.className = `w-full text-left bg-slate-950 border ${cur.mode === 'auto' ? on : off} hover:border-blue-500/60 rounded-xl px-4 py-3 text-xs transition cursor-pointer flex items-center justify-between`;
        if (screenFormatAutoMark) screenFormatAutoMark.textContent = cur.mode === 'auto' ? '✓' : '';
        const base = 'bg-slate-950 border rounded-xl px-3 py-2 text-xs transition cursor-pointer flex items-center justify-center gap-2';
        if (screenFormatLandscapeBtn) screenFormatLandscapeBtn.className = `${base} ${screenFormatOrientation === 'landscape' ? on : off}`;
        if (screenFormatPortraitBtn) screenFormatPortraitBtn.className = `${base} ${screenFormatOrientation === 'portrait' ? on : off}`;
        const rotNow = screenFormat.rotationOf(cur), rotBase = 'bg-slate-950 border rounded-xl px-2 py-2 text-xs transition cursor-pointer flex items-center justify-center gap-1.5';
        screenFormatRotButtons.forEach((btn, i) => { if (btn) btn.className = `${rotBase} ${screenFormat.ROTATIONS[i] === rotNow ? on : off}`; });
        const tabBase = 'bg-slate-950 border rounded-xl px-3 py-2 text-xs transition cursor-pointer';
        if (screenFormatTabRatio) screenFormatTabRatio.className = `${tabBase} ${screenFormatTab === 'ratio' ? on : off}`;
        if (screenFormatTabRes) screenFormatTabRes.className = `${tabBase} ${screenFormatTab === 'res' ? on : off}`;
        if (screenFormatPanelRatio) screenFormatPanelRatio.classList.toggle('hidden', screenFormatTab !== 'ratio');
        if (screenFormatPanelRes) screenFormatPanelRes.classList.toggle('hidden', screenFormatTab !== 'res');
        if (screenFormatFit && screenFormat.isResolution(cur)) screenFormatFit.checked = !!cur.fit;   // zeigt die gewählte Auflösung; sonst bleibt die Wahl des Hakens

        // Seitenverhältnisse
        screenFormatGrid.innerHTML = '';
        screenFormat.listPresets(screenFormatOrientation).forEach(item => {
            const selected = cur.mode === 'fixed' && cur.id === item.id && cur.orientation === item.setting.orientation;
            const card = screenFormatEl('button', `flex flex-col items-center gap-1.5 bg-slate-950 border rounded-xl px-2 py-3 transition cursor-pointer ${selected ? on : off} hover:border-blue-500/60`);
            card.type = 'button';
            const stage = screenFormatEl('div', 'w-10 h-10 flex items-center justify-center');
            const rect = screenFormatEl('div', `border-2 rounded-sm ${selected ? 'border-blue-400 bg-blue-500/20' : 'border-slate-500'}`);
            rect.style.width = item.previewW + 'px'; rect.style.height = item.previewH + 'px';
            stage.appendChild(rect);
            card.appendChild(stage);
            card.appendChild(screenFormatEl('div', 'text-xs font-semibold', item.square ? '1:1' : item.ratioText));
            card.appendChild(screenFormatEl('div', 'text-[10px] text-slate-500 text-center leading-tight', item.hint));
            card.addEventListener('click', () => { screenFormat.set(keepRotation(item.setting)); updateScreenFormatMenuValue(); renderScreenFormatModal(); });
            screenFormatGrid.appendChild(card);
        });

        // Auflösungen, nach Gruppen
        if (screenFormatResList) {
            screenFormatResList.innerHTML = '';
            const fit = screenFormatFit ? !!screenFormatFit.checked : true;
            screenFormat.listResolutions(screenFormatOrientation, fit).forEach(group => {
                const box = screenFormatEl('div', 'flex flex-col gap-1.5');
                box.appendChild(screenFormatEl('div', 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider', group.title));
                const grid = screenFormatEl('div', 'grid grid-cols-3 gap-2');
                group.items.forEach(item => {
                    const selected = screenFormat.isResolution(cur) && cur.w === item.setting.w && cur.h === item.setting.h && cur.orientation === item.setting.orientation;
                    const card = screenFormatEl('button', `flex flex-col items-center gap-0.5 bg-slate-950 border rounded-xl px-2 py-2 transition cursor-pointer ${selected ? on : off} hover:border-blue-500/60`);
                    card.type = 'button';
                    card.appendChild(screenFormatEl('div', 'text-xs font-semibold', item.text));
                    card.appendChild(screenFormatEl('div', 'text-[10px] text-slate-500 text-center leading-tight', item.name));
                    card.addEventListener('click', () => { screenFormat.set(keepRotation(item.setting)); updateScreenFormatMenuValue(); renderScreenFormatModal(); });
                    grid.appendChild(card);
                });
                box.appendChild(grid);
                screenFormatResList.appendChild(box);
            });
        }
        if (screenFormatCurrent) screenFormatCurrent.textContent = screenFormatCurrentText(cur);
    }
    function openScreenFormatModal() {
        if (!screenFormat) return;
        const cur = screenFormat.get();
        screenFormatOrientation = cur.mode !== 'auto' ? cur.orientation : (window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');   // ohne Einstellung: so wie das Fenster gerade ist
        screenFormatTab = screenFormat.isResolution(cur) ? 'res' : 'ratio';
        if (screenFormatCustomError) { screenFormatCustomError.textContent = ''; screenFormatCustomError.classList.add('hidden'); }
        renderScreenFormatModal();
        openModal(modalScreenFormat);
    }
    function chooseScreenFormatOrientation(orientation) {
        if (!screenFormat) return;
        screenFormatOrientation = orientation;
        const cur = screenFormat.get();
        if (screenFormat.isResolution(cur) && cur.orientation !== orientation && cur.w !== cur.h) {      // gewählte Auflösung gleich mitdrehen (1360×768 ↔ 768×1360)
            screenFormat.set(screenFormat.makeResolution(cur.w, cur.h, { orientation, fit: cur.fit, rotation: screenFormat.rotationOf(cur) }));
            updateScreenFormatMenuValue();
        } else if (cur.mode === 'fixed' && cur.orientation !== orientation && !screenFormat.PRESETS.find(p => p.id === cur.id && p.a === p.b)) { // gewähltes Format gleich mitdrehen (16:9 quer <-> 9:16 hoch)
            screenFormat.set(keepRotation(screenFormat.parse(`${cur.id}|${orientation}`)));
            updateScreenFormatMenuValue();
        }
        renderScreenFormatModal();
    }
    // Drehung wählen: dieselbe Einstellung, nur gedreht (auch bei Automatisch)
    function chooseScreenFormatRotation(deg) {
        if (!screenFormat) return;
        screenFormat.set(screenFormat.withRotation(screenFormat.get(), deg));
        updateScreenFormatMenuValue(); renderScreenFormatModal();
    }
    function chooseScreenFormatTab(tab) { screenFormatTab = tab; renderScreenFormatModal(); }
    // Haken "einpassen": wirkt sofort auf die gewählte Auflösung, sonst nur auf die nächste Wahl
    function changeScreenFormatFit() {
        if (!screenFormat || !screenFormatFit) return;
        const cur = screenFormat.get();
        if (screenFormat.isResolution(cur)) { screenFormat.set(screenFormat.withFit(cur, screenFormatFit.checked)); updateScreenFormatMenuValue(); }
        renderScreenFormatModal();
    }
    // Eigene Auflösung: zwei Zahlen, geprüft; Breite kleiner als Höhe = Hochformat
    function applyScreenFormatCustom() {
        if (!screenFormat || !screenFormatCustomW || !screenFormatCustomH) return;
        const setting = screenFormat.makeResolution(screenFormatCustomW.value, screenFormatCustomH.value, { fit: screenFormatFit ? !!screenFormatFit.checked : true, rotation: screenFormat.rotationOf(screenFormat.get()) });
        if (!setting || screenFormatCustomW.value === '' || screenFormatCustomH.value === '') {
            const L = screenFormat.RES_LIMITS;
            if (screenFormatCustomError) { screenFormatCustomError.textContent = `Bitte zwei Zahlen eingeben: lange Seite ${L.minLong} bis ${L.maxLong}, kurze Seite ${L.minShort} bis ${L.maxShort}, höchstens im Verhältnis ${L.maxRatio}:1.`; screenFormatCustomError.classList.remove('hidden'); }
            return;
        }
        if (screenFormatCustomError) { screenFormatCustomError.textContent = ''; screenFormatCustomError.classList.add('hidden'); }
        screenFormatOrientation = setting.orientation;
        screenFormat.set(setting); updateScreenFormatMenuValue(); renderScreenFormatModal();
    }
    function resetSidebarSize() { const c = window.AuraPanelResize && window.AuraPanelResize.controller; if (c) c.reset(); }
    if (!screenFormat && menuItemScreenFormat) menuItemScreenFormat.classList.add('hidden');   // Skript nicht geladen: Menüpunkt weglassen statt ins Leere zu führen
    if (menuItemScreenFormat) menuItemScreenFormat.addEventListener('click', openScreenFormatModal);
    if (screenFormatAutoBtn) screenFormatAutoBtn.addEventListener('click', () => { if (screenFormat) { screenFormat.set(keepRotation(screenFormat.AUTO)); updateScreenFormatMenuValue(); renderScreenFormatModal(); } });
    if (screenFormatLandscapeBtn) screenFormatLandscapeBtn.addEventListener('click', () => chooseScreenFormatOrientation('landscape'));
    if (screenFormatPortraitBtn) screenFormatPortraitBtn.addEventListener('click', () => chooseScreenFormatOrientation('portrait'));
    screenFormatRotButtons.forEach((btn, i) => { if (btn) btn.addEventListener('click', () => chooseScreenFormatRotation([0, 90, 180, 270][i])); });
    if (screenFormatTabRatio) screenFormatTabRatio.addEventListener('click', () => chooseScreenFormatTab('ratio'));
    if (screenFormatTabRes) screenFormatTabRes.addEventListener('click', () => chooseScreenFormatTab('res'));
    if (screenFormatFit) screenFormatFit.addEventListener('change', changeScreenFormatFit);
    if (screenFormatCustomApply) screenFormatCustomApply.addEventListener('click', applyScreenFormatCustom);
    [screenFormatCustomW, screenFormatCustomH].forEach(inp => { if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyScreenFormatCustom(); }); });
    if (screenFormatSidebarReset) screenFormatSidebarReset.addEventListener('click', resetSidebarSize);
    updateScreenFormatMenuValue();

    // --- Gast: "Mein Aufenthalt" (Apaleo) ---
    function setStayStatus(text, cls) {
        if (!stayStatus) return;
        stayStatus.textContent = text;
        stayStatus.className = 'text-[11px] ' + (text ? cls : 'hidden');
    }
    if (menuItemStay) {
        menuItemStay.addEventListener('click', async () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            if (guestStayVerified) {
                // Aufenthalt beenden: die Reservierung wird aus der Gast-Sitzung entfernt
                try { await fetch(`${backendUrl}/guest/end-stay`, { method: 'POST', credentials: 'include' }); } catch (err) { /* egal */ }
                guestStayVerified = false;
                updateStayMenu();
                appendMessageToDOM(gt('ended'), 'assistant');
                return;
            }
            openStayModal();
        });
    }
    function openStayModal() {
        if (stayReservationInput) stayReservationInput.value = '';
        if (stayLastNameInput) stayLastNameInput.value = '';
        setStayStatus('', '');
        applyGuestTexts();
        if (modalStay) modalStay.classList.remove('hidden');
        if (stayReservationInput) stayReservationInput.focus();
    }
    async function submitStay() {
        if (!stayReservationInput || !stayLastNameInput) return;
        // Ton gleich beim Klick freischalten, noch vor dem Warten auf den Server (wie beim Senden einer Frage): Browser lassen
        // das erste Sprechen nur nach einer echten Bedienung zu - sonst bliebe die Begrüssung stumm.
        unlockSpeechSynthesisForIOS();
        unlockHtmlAudioForIOS();
        setStayStatus(gt('checking'), 'text-slate-400');
        try {
            const res = await fetch(`${backendUrl}/guest/verify-stay`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                body: JSON.stringify({ reservationId: stayReservationInput.value, lastName: stayLastNameInput.value, lang: guestLang })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data.code && (GUEST_I18N[guestLang].err || {})[data.code]) || data.error || `Status ${res.status}`);
            // Eingaben sofort aus der Oberfläche löschen
            stayReservationInput.value = '';
            stayLastNameInput.value = '';
            setStayStatus('', '');
            if (modalStay) modalStay.classList.add('hidden');
            guestStayVerified = true;
            updateStayMenu();
            const welcome = gt('welcome', data.firstName || '');
            appendMessageToDOM(welcome, 'assistant');
            setAvatarSpeaking(true);
            if (speechEnabled) speakText(welcome, () => setAvatarSpeaking(false), '', voiceLangFor(guestLang));
            else setTimeout(() => setAvatarSpeaking(false), 2500);
        } catch (err) {
            setStayStatus('✗ ' + err.message, 'text-red-400');
        }
    }
    if (staySubmitBtn) staySubmitBtn.addEventListener('click', submitStay);
    if (guestLangSelect) guestLangSelect.addEventListener('change', () => setGuestLang(guestLangSelect.value));
    [stayReservationInput, stayLastNameInput].forEach(el => { if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitStay(); } }); });

    if (apaleoGuestEnabledBox) {
        apaleoGuestEnabledBox.addEventListener('change', async () => {
            await saveGlobalConfigToDB('apaleo_guest_enabled', apaleoGuestEnabledBox.checked ? 'true' : 'false');
            appConfig.apaleo_guest_enabled = apaleoGuestEnabledBox.checked ? 'true' : 'false';
            updateApaleoGuestCheck();
            setApaleoStatus(apaleoGuestEnabledBox.checked ? '✓ Gäste dürfen jetzt Fragen zu ihrer eigenen Reservierung stellen (braucht „Gäste dürfen mit Aura chatten“).' : '✓ Für Gäste ausgeschaltet.', 'text-emerald-400');
        });
    }
    if (menuItemModel) menuItemModel.addEventListener('click', () => openModal(modalModelSearch));

    function loadAdminTtsSttConfig() {
        // Ältere Einstellung (Haken "Wyoming" statt Plattform) wird als Plattform "Piper" angezeigt; die Spracherkennung
        // bleibt dabei so wie sie war (Server, wenn die alte Plattform ein Server war).
        const legacyWyoming = appConfig.tts_wyoming_enabled === 'true' && appConfig.tts_stt_platform !== 'piper';
        if (ttsSttPlatform) ttsSttPlatform.value = legacyWyoming ? 'piper' : (appConfig.tts_stt_platform || 'browser');
        if (sttSourceSelect) sttSourceSelect.value = legacyWyoming
            ? (['self-hosted', 'other'].includes(appConfig.tts_stt_platform) ? 'server' : 'browser')
            : (appConfig.stt_source || 'browser');
        if (ttsSttHost) ttsSttHost.value = appConfig.tts_stt_host || '';
        if (ttsSttPort) ttsSttPort.value = appConfig.tts_stt_port || '';
        if (ttsModelInput) ttsModelInput.value = appConfig.tts_model || '';
        if (ttsVoiceInput) ttsVoiceInput.value = appConfig.tts_voice || '';
        if (ttsWyomingHost) ttsWyomingHost.value = appConfig.tts_wyoming_host || 'piper';
        if (ttsWyomingPort) ttsWyomingPort.value = appConfig.tts_wyoming_port || '10200';
        if (ttsWyomingVoice) ttsWyomingVoice.value = appConfig.tts_wyoming_voice || '';
        if (ttsWyomingSpeaker) ttsWyomingSpeaker.value = appConfig.tts_wyoming_speaker || '';
        updateTtsSttPlatformVisibility();
        if (sttModelInput) sttModelInput.value = appConfig.stt_model || '';
        if (sttLanguageSelect) sttLanguageSelect.value = appConfig.stt_language || '';
        if (ttsSttStatus) ttsSttStatus.classList.add('hidden');
        applyLicenseUI();
        loadPronunciationDict();
        loadTtsSttModelsList();
    }

    // Piper-Modelle folgen der Namenskonvention ".../piper-<stimme>" - die Stimme selbst
    // ist alles nach "piper-" (z.B. "speaches-ai/piper-de_DE-kerstin-low" -> "de_DE-kerstin-low").
    function deriveVoiceFromModelId(modelId) {
        const match = modelId.match(/piper-(.+)$/);
        return match ? match[1] : null;
    }

    async function loadTtsSttModelsList() {
        if (!ttsSttModelsList) return;
        ttsSttModelsList.textContent = 'Lade...';
        try {
            const res = await fetch(`${backendUrl}/admin/tts-stt/models`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler beim Laden.');
            ttsSttModelsList.innerHTML = '';

            if (ttsVoiceSelect) {
                ttsVoiceSelect.innerHTML = '<option value="">— manuell eintragen (unten) —</option>';
                (data.models || []).forEach(m => {
                    const voice = deriveVoiceFromModelId(m);
                    if (!voice) return; // kein Piper-Stimmenmodell (z.B. STT-Modell) - nicht als Stimme anbietbar
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = voice;
                    ttsVoiceSelect.appendChild(opt);
                });
                // Aktuell gespeichertes Modell in der Liste vorauswählen, falls vorhanden
                if (appConfig.tts_model && Array.from(ttsVoiceSelect.options).some(o => o.value === appConfig.tts_model)) {
                    ttsVoiceSelect.value = appConfig.tts_model;
                }
            }

            if ((data.models || []).length === 0) {
                ttsSttModelsList.innerHTML = '<div class="text-slate-600">Keine Modelle gefunden.</div>';
                return;
            }
            data.models.forEach(m => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5';
                const label = document.createElement('span');
                label.className = 'truncate';
                label.textContent = m;
                row.appendChild(label);
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'text-red-400 hover:text-red-300 text-[10px] px-1.5 shrink-0 cursor-pointer';
                delBtn.textContent = '🗑️';
                delBtn.title = 'Modell vom Server löschen';
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Modell "${m}" wirklich vom TTS/STT-Server löschen? Muss danach ggf. neu heruntergeladen werden, um wieder genutzt zu werden.`)) return;
                    try {
                        const delRes = await fetch(`${backendUrl}/admin/tts-stt/models`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ modelId: m })
                        });
                        const delData = await delRes.json();
                        if (!delRes.ok) throw new Error(delData.error || 'Löschen fehlgeschlagen.');
                        // Falls das gelöschte Modell gerade als Standard eingestellt war, auch die
                        // gespeicherte Stimme zurücksetzen - sonst zeigt AuraChat auf ein Modell, das
                        // es gar nicht mehr gibt.
                        if (appConfig.tts_model === m) {
                            if (ttsModelInput) ttsModelInput.value = '';
                            if (ttsVoiceInput) ttsVoiceInput.value = '';
                            await saveGlobalConfigToDBOrThrow('tts_model', '').catch(() => {});
                            await saveGlobalConfigToDBOrThrow('tts_voice', '').catch(() => {});
                        }
                        loadTtsSttModelsList();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
                row.appendChild(delBtn);
                ttsSttModelsList.appendChild(row);
            });
        } catch (err) {
            ttsSttModelsList.textContent = err.message;
        }
    }

    if (ttsSttModelsRefreshBtn) ttsSttModelsRefreshBtn.addEventListener('click', loadTtsSttModelsList);

    if (ttsVoiceSelect) {
        ttsVoiceSelect.addEventListener('change', () => {
            if (!ttsVoiceSelect.value) return; // "manuell eintragen" gewählt - Felder unverändert lassen
            const voice = deriveVoiceFromModelId(ttsVoiceSelect.value);
            if (ttsModelInput) ttsModelInput.value = ttsVoiceSelect.value;
            if (ttsVoiceInput) ttsVoiceInput.value = voice || '';
        });
    }

    if (ttsSttDownloadBtn) {
        ttsSttDownloadBtn.addEventListener('click', async () => {
            const modelId = ttsSttDownloadModelId ? ttsSttDownloadModelId.value.trim() : '';
            if (!modelId) return alert('Bitte zuerst eine Modell-ID eintragen.');

            ttsSttDownloadBtn.disabled = true;
            ttsSttDownloadBtn.textContent = 'Lädt herunter...';
            if (ttsSttDownloadStatus) {
                ttsSttDownloadStatus.textContent = 'Download läuft, kann je nach Grösse einige Minuten dauern...';
                ttsSttDownloadStatus.className = 'text-[11px] text-slate-400';
                ttsSttDownloadStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/tts-stt/models/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ modelId })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Download fehlgeschlagen.');
                if (ttsSttDownloadStatus) {
                    ttsSttDownloadStatus.textContent = '✓ ' + (data.message || 'Heruntergeladen.');
                    ttsSttDownloadStatus.className = 'text-[11px] text-emerald-400';
                }
                if (ttsSttDownloadModelId) ttsSttDownloadModelId.value = '';
                loadTtsSttModelsList();
            } catch (err) {
                if (ttsSttDownloadStatus) {
                    ttsSttDownloadStatus.textContent = '✗ ' + err.message;
                    ttsSttDownloadStatus.className = 'text-[11px] text-red-400';
                }
            } finally {
                ttsSttDownloadBtn.disabled = false;
                ttsSttDownloadBtn.textContent = 'Herunterladen';
            }
        });
    }

    function addPronunciationRow(word = '', replacement = '') {
        if (!pronunciationDictRows) return;
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center pronunciation-row';
        row.innerHTML = `
            <input type="text" placeholder="Wort (z.B. Nginx)" class="pronunciation-word flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" value="${word.replace(/"/g, '&quot;')}">
            <span class="text-slate-600 text-xs">→</span>
            <input type="text" placeholder="Aussprache (z.B. Endschin-Ex)" class="pronunciation-replacement flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" value="${replacement.replace(/"/g, '&quot;')}">
            <button type="button" class="pronunciation-remove-btn text-red-400 hover:text-red-300 text-xs px-1 cursor-pointer">✕</button>
        `;
        row.querySelector('.pronunciation-remove-btn').addEventListener('click', () => row.remove());
        pronunciationDictRows.appendChild(row);
    }

    async function loadPronunciationDict() {
        if (!pronunciationDictRows) return;
        pronunciationDictRows.innerHTML = '';
        try {
            const res = await fetch(`${backendUrl}/admin/tts-pronunciation`, { credentials: 'include' });
            const data = await res.json();
            (data.dict || []).forEach(e => addPronunciationRow(e.word, e.replacement));
        } catch (err) {
            console.error('Aussprache-Wörterbuch Ladefehler:', err);
        }
    }

    if (pronunciationAddRowBtn) {
        pronunciationAddRowBtn.addEventListener('click', () => addPronunciationRow());
    }

    if (pronunciationSaveBtn) {
        pronunciationSaveBtn.addEventListener('click', async () => {
            const dict = Array.from(document.querySelectorAll('.pronunciation-row')).map(row => ({
                word: row.querySelector('.pronunciation-word').value.trim(),
                replacement: row.querySelector('.pronunciation-replacement').value.trim()
            })).filter(e => e.word && e.replacement);

            try {
                const res = await fetch(`${backendUrl}/admin/tts-pronunciation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ dict })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (pronunciationStatus) {
                    pronunciationStatus.textContent = `✓ ${data.count} Einträge gespeichert.`;
                    pronunciationStatus.className = 'text-[11px] text-emerald-400';
                    pronunciationStatus.classList.remove('hidden');
                }
            } catch (err) {
                if (pronunciationStatus) {
                    pronunciationStatus.textContent = '✗ ' + err.message;
                    pronunciationStatus.className = 'text-[11px] text-red-400';
                    pronunciationStatus.classList.remove('hidden');
                }
            }
        });
    }

    // --- Piper: Stimmen vom Server holen und auswählen ---
    function setPiperStatus(text, cls) {
        if (ttsWyomingStatus) { ttsWyomingStatus.textContent = text; ttsWyomingStatus.className = 'text-[11px] ' + cls; }
    }

    function renderPiperSpeakers(voiceName) {
        if (!piperSpeakerList) return;
        piperSpeakerList.innerHTML = '';
        const voice = piperVoicesCache.get(voiceName);
        (voice && voice.speakers ? voice.speakers : []).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            piperSpeakerList.appendChild(opt);
        });
    }

    async function loadPiperVoices() {
        if (!piperVoiceSelect) return;
        piperVoicesLoaded = true;
        setPiperStatus('Lade Stimmen...', 'text-slate-400');
        try {
            const res = await fetch(`${backendUrl}/admin/tts-wyoming/voices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    host: ttsWyomingHost ? ttsWyomingHost.value.trim() : '',
                    port: ttsWyomingPort ? ttsWyomingPort.value.trim() : '',
                    lang: piperLangSelect ? piperLangSelect.value : 'de'
                })
            });
            let data = {};
            try { data = await res.json(); } catch { /* keine JSON-Antwort */ }
            if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
            piperVoicesCache = new Map(data.voices.map(v => [v.name, v]));
            const current = ttsWyomingVoice ? ttsWyomingVoice.value.trim() : '';
            piperVoiceSelect.innerHTML = '<option value="">— Standard des Containers —</option>';
            data.voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.name;
                opt.textContent = v.name + (v.speakerCount > 1 ? ` (${v.speakerCount} Sprecher)` : '');
                piperVoiceSelect.appendChild(opt);
            });
            if (current && piperVoicesCache.has(current)) piperVoiceSelect.value = current;
            renderPiperSpeakers(current);
            setPiperStatus(data.voices.length ? `${data.voices.length} Stimme(n) in dieser Sprache (insgesamt ${data.total} auf dem Server).` : `Keine Stimmen für diese Sprache (insgesamt ${data.total} auf dem Server).`, 'text-slate-400');
        } catch (err) {
            piperVoiceSelect.innerHTML = '<option value="">— Liste nicht verfügbar —</option>';
            setPiperStatus('✗ ' + err.message, 'text-red-400');
        }
    }

    if (piperVoiceSelect) {
        piperVoiceSelect.addEventListener('change', () => {
            const name = piperVoiceSelect.value;
            if (ttsWyomingVoice) ttsWyomingVoice.value = name;
            if (ttsWyomingSpeaker) ttsWyomingSpeaker.value = ''; // Sprecher gehört zur Stimme - bei Wechsel zurücksetzen
            renderPiperSpeakers(name);
            const v = piperVoicesCache.get(name);
            setPiperStatus(name
                ? (v && v.speakerCount > 1 ? `${name}: Stimme mit ${v.speakerCount} Sprechern - im Feld "Sprecher" einen wählen, dann "Laden & testen".` : `${name} gewählt - "Laden & testen" drücken, dann Speichern.`)
                : '', 'text-slate-400');
        });
    }
    if (piperLangSelect) piperLangSelect.addEventListener('change', loadPiperVoices);
    if (piperVoicesRefreshBtn) piperVoicesRefreshBtn.addEventListener('click', loadPiperVoices);
    if (ttsWyomingVoice) ttsWyomingVoice.addEventListener('input', () => {
        // von Hand getippte Stimme: Auswahl und Sprecher-Vorschläge nachführen
        const name = ttsWyomingVoice.value.trim();
        if (piperVoiceSelect) piperVoiceSelect.value = piperVoicesCache.has(name) ? name : '';
        renderPiperSpeakers(name);
    });

    // Welche Felder zur gewählten Plattform gehören. Bei "Piper" entfallen die Felder des OpenAI-kompatiblen Servers
    // für die Stimme; die Server-Felder bleiben nur, wenn die Spracherkennung über einen Server laufen soll.
    function updateTtsSttPlatformVisibility() {
        const platform = ttsSttPlatform ? ttsSttPlatform.value : 'browser';
        const isPiper = platform === 'piper';
        const sttServer = !isPiper || (sttSourceSelect && sttSourceSelect.value === 'server');
        const show = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
        show(ttsVoiceSelectWrap, !isPiper);
        show(ttsModelVoiceWrap, !isPiper);
        show(ttsSttServerWrap, sttServer);
        show(sttModelWrap, sttServer);
        show(sttLanguageWrap, sttServer);
        if (piperFields) {
            piperFields.classList.toggle('hidden', !isPiper);
            piperFields.classList.toggle('flex', isPiper);
        }
        if (isPiper && ttsWyomingHost && !ttsWyomingHost.value.trim()) ttsWyomingHost.value = 'piper';
        if (isPiper && !piperVoicesLoaded) loadPiperVoices();
        if (isPiper && ttsWyomingPort && !ttsWyomingPort.value.trim()) ttsWyomingPort.value = '10200';
    }
    if (ttsSttPlatform) ttsSttPlatform.addEventListener('change', updateTtsSttPlatformVisibility);
    if (sttSourceSelect) sttSourceSelect.addEventListener('change', updateTtsSttPlatformVisibility);

    // Wird die Spracherkennung über einen Server gemacht? Bei "Piper" nur, wenn dort "Server" gewählt ist (Piper
    // selbst kann nicht zuhören); bei den anderen Plattformen wie bisher immer.
    function usesServerStt() {
        const platform = appConfig.tts_stt_platform;
        if (!platform || platform === 'browser') return false;
        if (platform === 'piper') return appConfig.stt_source === 'server';
        return true;
    }

    // Testet die Wyoming-Verbindung mit den Formularwerten (ohne zu speichern) und spielt die Stimme ab.
    if (guestChatEnabledBox) {
        guestChatEnabledBox.addEventListener('change', async () => {
            await saveGlobalConfigToDB('guest_chat_enabled', guestChatEnabledBox.checked ? 'true' : 'false');
            if (guestChatStatus) {
                guestChatStatus.textContent = guestChatEnabledBox.checked ? '✓ Gäste dürfen jetzt mit Aura chatten.' : '✓ Gast-Chat ausgeschaltet.';
                guestChatStatus.className = 'text-[11px] text-emerald-400';
            }
        });
    }

    if (ttsWyomingTestBtn) {
        ttsWyomingTestBtn.addEventListener('click', async () => {
            const setStatus = (text, cls) => { if (ttsWyomingStatus) { ttsWyomingStatus.textContent = text; ttsWyomingStatus.className = 'text-[11px] ' + cls; } };
            setStatus('Teste... (eine neue Stimme wird dabei erst heruntergeladen - das kann bis zu zwei Minuten dauern)', 'text-slate-400');
            ttsWyomingTestBtn.disabled = true;
            try {
                const res = await fetch(`${backendUrl}/admin/tts-wyoming/test`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        host: ttsWyomingHost ? ttsWyomingHost.value.trim() : '',
                        port: ttsWyomingPort ? ttsWyomingPort.value.trim() : '',
                        voice: ttsWyomingVoice ? ttsWyomingVoice.value.trim() : '',
                        speaker: ttsWyomingSpeaker ? ttsWyomingSpeaker.value.trim() : ''
                    })
                });
                if (!res.ok) {
                    let message = `Status ${res.status}`;
                    try { message = (await res.json()).error || message; } catch { /* keine JSON-Antwort */ }
                    throw new Error(message);
                }
                const blob = await res.blob();
                let info = '';
                try { info = decodeURIComponent(res.headers.get('X-Wyoming-Info') || ''); } catch { /* ohne Info */ }
                setStatus('✓ Verbindung ok' + (info ? ` (${info})` : '') + ' - die Stimme wird abgespielt.', 'text-emerald-400');
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.addEventListener('ended', () => URL.revokeObjectURL(url));
                await audio.play().catch(() => setStatus('✓ Verbindung ok (Abspielen vom Browser blockiert - bitte nochmal klicken).', 'text-amber-400'));
            } catch (err) {
                setStatus('✗ ' + err.message, 'text-red-400');
            } finally {
                ttsWyomingTestBtn.disabled = false;
            }
        });
    }

    if (ttsSttSaveBtn) {
        ttsSttSaveBtn.addEventListener('click', async () => {
            if (ttsSttStatus) {
                ttsSttStatus.textContent = 'Speichere...';
                ttsSttStatus.className = 'text-[11px] text-slate-400';
                ttsSttStatus.classList.remove('hidden');
            }
            const fields = [
                ['tts_stt_platform', ttsSttPlatform ? ttsSttPlatform.value : 'browser'],
                ['tts_stt_host', ttsSttHost ? ttsSttHost.value.trim() : ''],
                ['tts_stt_port', ttsSttPort ? ttsSttPort.value.trim() : ''],
                ['tts_model', ttsModelInput ? ttsModelInput.value.trim() : ''],
                ['tts_voice', ttsVoiceInput ? ttsVoiceInput.value.trim() : ''],
                ['tts_wyoming_enabled', 'false'], // ältere Form - die Plattform "Piper" ersetzt sie
                ['stt_source', sttSourceSelect ? sttSourceSelect.value : 'browser'],
                ['tts_wyoming_host', ttsWyomingHost ? ttsWyomingHost.value.trim() : ''],
                ['tts_wyoming_port', ttsWyomingPort ? ttsWyomingPort.value.trim() : ''],
                ['tts_wyoming_voice', ttsWyomingVoice ? ttsWyomingVoice.value.trim() : ''],
                ['tts_wyoming_speaker', ttsWyomingSpeaker ? ttsWyomingSpeaker.value.trim() : ''],
                ['stt_model', sttModelInput ? sttModelInput.value.trim() : ''],
                ['stt_language', sttLanguageSelect ? sttLanguageSelect.value : '']
            ];
            try {
                for (const [key, value] of fields) {
                    await saveGlobalConfigToDBOrThrow(key, value);
                }
                if (ttsSttStatus) {
                    ttsSttStatus.textContent = '✓ Gespeichert.';
                    ttsSttStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (ttsSttStatus) {
                    ttsSttStatus.textContent = '✗ ' + err.message;
                    ttsSttStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }
    // --- EINSTELLUNGEN (gebündeltes Tab-Modal: Sprache, Design, Avatar, Persönlichkeit) ---

    function switchSettingsTab(tab) {
        const tabs = { lang: settingsTabLang, design: settingsTabDesign, avatar: settingsTabAvatar, personality: settingsTabPersonality };
        const btns = { lang: settingsTabBtnLang, design: settingsTabBtnDesign, avatar: settingsTabBtnAvatar, personality: settingsTabBtnPersonality };
        const activeClass = 'settings-tab-btn flex-1 min-w-[23%] text-xs font-medium py-2 rounded-xl transition cursor-pointer bg-blue-600 text-white';
        const inactiveClass = 'settings-tab-btn flex-1 min-w-[23%] text-xs font-medium py-2 rounded-xl transition cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700';

        Object.entries(tabs).forEach(([key, el]) => {
            if (!el) return;
            el.classList.toggle('hidden', key !== tab);
            el.classList.toggle('flex', key === tab);
        });
        Object.entries(btns).forEach(([key, el]) => { if (el) el.className = key === tab ? activeClass : inactiveClass; });

        if (tab === 'avatar') {
            if (videoAvatarUploadSection) {
                const isAdmin = currentUser && currentUser.role === 'admin';
                videoAvatarUploadSection.classList.toggle('hidden', !isAdmin);
                videoAvatarUploadSection.classList.toggle('flex', isAdmin);
                if (videoAvatarSelfrecSection) { videoAvatarSelfrecSection.classList.toggle('hidden', !isAdmin); videoAvatarSelfrecSection.classList.toggle('flex', isAdmin); if (isAdmin) loadSelfRecognitionSetting(); }
            }
            loadVideoAvatarGallery();
        } else if (tab === 'personality') {
            loadPersonalityIntoModal();
        }
    }

    if (settingsTabBtnLang) settingsTabBtnLang.addEventListener('click', () => switchSettingsTab('lang'));
    if (settingsTabBtnDesign) settingsTabBtnDesign.addEventListener('click', () => switchSettingsTab('design'));
    if (settingsTabBtnAvatar) settingsTabBtnAvatar.addEventListener('click', () => switchSettingsTab('avatar'));
    if (settingsTabBtnPersonality) settingsTabBtnPersonality.addEventListener('click', () => switchSettingsTab('personality'));

    if (menuItemSettings) menuItemSettings.addEventListener('click', () => {
        openModal(modalSettings);
        switchSettingsTab('lang');
        if (window.AuraPrefs) window.AuraPrefs.card(document.getElementById('settings-prefs-card'));   // Darstellung (Dunkel/Hell/Automatisch)
        loadPronunciationDict();
    });

    async function loadPersonalityIntoModal() {
        try {
            const res = await fetch(`${backendUrl}/personality`, { credentials: 'include' });
            const data = await res.json();
            if (personalityNameInput) personalityNameInput.value = data.name || 'Aura';
            if (personalityTraitsInput) personalityTraitsInput.value = data.traits || '';
        } catch (err) {
            console.error('Persönlichkeit Ladefehler:', err);
        }
    }
    if (menuItemWorkspace) {
        menuItemWorkspace.addEventListener('click', () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            if (modalWorkspace) modalWorkspace.classList.remove('hidden');
            currentWorkspaceFolderId = null;
            if (workspaceCurrentFolderLabel) workspaceCurrentFolderLabel.textContent = 'Hauptverzeichnis';
            if (workspaceGoRootBtn) workspaceGoRootBtn.classList.add('hidden');
            loadWorkspaceDocuments();
        });
    }

    // --- CHAT EXPORTIEREN (kostenlos) - schön formatiertes PDF mit Logo ---
    if (menuItemExportChat) {
        menuItemExportChat.addEventListener('click', async () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            const currentChat = chats.find(c => c.id === currentChatId);
            if (!currentChat || !currentChat.messages || currentChat.messages.length === 0) {
                alert('Kein aktiver Chat mit Nachrichten zum Exportieren.');
                return;
            }
            try {
                const res = await fetch(`${backendUrl}/chats/${currentChat.id}/export`, { credentials: 'include' });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || `Status ${res.status}`);
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${(currentChat.title || 'aurachat-export').replace(/[^\w\-]+/g, '_')}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (err) {
                alert('Fehler beim Exportieren: ' + err.message);
            }
        });
    }

    // --- LERN-STREAK (kostenlos) ---
    async function loadStreak() {
        try {
            const res = await fetch(`${backendUrl}/streak`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (streakDisplay && streakCountEl && data.streak > 0) {
                streakCountEl.textContent = data.streak;
                streakDisplay.classList.remove('hidden');
                streakDisplay.classList.add('flex');
            }
        } catch (err) {
            console.error('Streak Ladefehler:', err);
        }
    }

    // --- PERSÖNLICHKEIT (pro Konto - Runde 3: "mehrere Profile") ---

    let personalPersonaTraits = ''; // im Hintergrund geladen, fürs eigene System-Prompt (siehe buildAuraSystemPrompt)

    if (personalitySaveBtn) {
        personalitySaveBtn.addEventListener('click', async () => {
            if (personalityStatus) {
                personalityStatus.textContent = 'Speichere...';
                personalityStatus.className = 'text-[11px] text-slate-400';
                personalityStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/personality`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: personalityNameInput ? personalityNameInput.value.trim() : 'Aura',
                        traits: personalityTraitsInput ? personalityTraitsInput.value.trim() : ''
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                personalPersonaTraits = personalityTraitsInput ? personalityTraitsInput.value.trim() : '';
                if (personalityStatus) {
                    personalityStatus.textContent = '✓ Gespeichert.';
                    personalityStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (personalityStatus) {
                    personalityStatus.textContent = '✗ ' + err.message;
                    personalityStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    async function loadPersonalPersona() {
        if (!currentUser) return;
        try {
            const res = await fetch(`${backendUrl}/personality`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            personalPersonaTraits = data.traits || '';
        } catch (err) {
            console.error('Persönlichkeit Ladefehler:', err);
        }
    }

    // --- E-MAIL (Premium "email", pro Konto) ---

    let currentEmailUid = null;

    if (menuItemEmail && modalEmail) {
        menuItemEmail.addEventListener('click', async () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            modalEmail.classList.remove('hidden');
            if (emailO365ConnectLink) emailO365ConnectLink.href = `${backendUrl}/email/o365/connect`;
            [emailSetupSection, emailInboxSection, emailDraftSection].forEach(el => { if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
            try {
                const res = await fetch(`${backendUrl}/email/account/status`, { credentials: 'include' });
                const data = await res.json();
                if (data.connected) {
                    showEmailInbox(data.username, data.provider);
                } else {
                    if (emailSetupSection) { emailSetupSection.classList.remove('hidden'); emailSetupSection.classList.add('flex'); }
                }
            } catch (err) {
                if (emailSetupSection) { emailSetupSection.classList.remove('hidden'); emailSetupSection.classList.add('flex'); }
            }
        });
    }

    if (emailConnectBtn) {
        emailConnectBtn.addEventListener('click', async () => {
            if (emailConnectStatus) {
                emailConnectStatus.textContent = 'Verbinde...';
                emailConnectStatus.className = 'text-[11px] text-slate-400';
                emailConnectStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/email/account`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        imapHost: emailImapHost ? emailImapHost.value.trim() : '',
                        imapPort: emailImapPort ? emailImapPort.value.trim() : '993',
                        imapSecure: emailImapSecure ? emailImapSecure.value : 'true',
                        username: emailUsername ? emailUsername.value.trim() : '',
                        password: emailPassword ? emailPassword.value : ''
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen.');
                if (emailPassword) emailPassword.value = '';
                showEmailInbox(emailUsername ? emailUsername.value.trim() : '', 'imap');
            } catch (err) {
                if (emailConnectStatus) {
                    emailConnectStatus.textContent = '✗ ' + err.message;
                    emailConnectStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (emailDisconnectBtn) {
        emailDisconnectBtn.addEventListener('click', async () => {
            if (!confirm('E-Mail-Konto wirklich trennen? Die gespeicherten Zugangsdaten werden gelöscht.')) return;
            try {
                const res = await fetch(`${backendUrl}/email/account`, { method: 'DELETE', credentials: 'include' });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || `Trennen fehlgeschlagen (Status ${res.status}).`);
                }
                [emailInboxSection, emailDraftSection].forEach(el => { if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
                if (emailSetupSection) { emailSetupSection.classList.remove('hidden'); emailSetupSection.classList.add('flex'); }
            } catch (err) {
                alert('Fehler: ' + err.message);
            }
        });
    }

    async function showEmailInbox(username, provider) {
        [emailSetupSection, emailDraftSection].forEach(el => { if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
        if (emailInboxSection) { emailInboxSection.classList.remove('hidden'); emailInboxSection.classList.add('flex'); }
        if (emailConnectedAs) emailConnectedAs.textContent = provider === 'o365' ? 'Verbunden mit Microsoft 365' : `Verbunden als ${username}`;
        if (emailMessageList) emailMessageList.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">⏳ Lade Posteingang...</div>';
        try {
            const res = await fetch(`${backendUrl}/email/inbox`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Posteingang konnte nicht geladen werden.');
            renderEmailList(data.messages);
        } catch (err) {
            if (emailMessageList) emailMessageList.innerHTML = `<div class="text-xs text-red-400 text-center py-4">✗ ${err.message}</div>`;
        }
    }

    function renderEmailList(messages) {
        if (!emailMessageList) return;
        emailMessageList.innerHTML = '';
        if (!messages || messages.length === 0) {
            emailMessageList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Keine E-Mails gefunden.</div>';
            return;
        }
        messages.forEach(msg => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `w-full text-left px-3 py-2 rounded-xl border transition cursor-pointer ${msg.unread ? 'bg-slate-800 border-slate-700' : 'bg-slate-950 border-slate-800'} hover:border-blue-500`;
            item.innerHTML = `
                <div class="text-xs font-semibold text-white truncate">${msg.subject}</div>
                <div class="text-[10px] text-slate-400 truncate">${msg.from}</div>
                <div class="text-[9px] text-slate-600">${msg.date ? new Date(msg.date).toLocaleString('de-DE') : ''}</div>`;
            item.addEventListener('click', () => openEmailDraft(msg));
            emailMessageList.appendChild(item);
        });
    }

    function openEmailDraft(msg) {
        currentEmailUid = msg.uid;
        [emailSetupSection, emailInboxSection].forEach(el => { if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
        if (emailDraftSection) { emailDraftSection.classList.remove('hidden'); emailDraftSection.classList.add('flex'); }
        if (emailDraftOriginal) emailDraftOriginal.innerHTML = `<strong>${msg.subject}</strong><br>${msg.from}`;
        if (emailDraftInstruction) emailDraftInstruction.value = '';
        if (emailDraftText) { emailDraftText.value = ''; emailDraftText.classList.add('hidden'); }
        if (emailDraftHint) emailDraftHint.classList.add('hidden');
    }

    if (emailBackToListBtn) {
        emailBackToListBtn.addEventListener('click', () => {
            if (emailDraftSection) { emailDraftSection.classList.add('hidden'); emailDraftSection.classList.remove('flex'); }
            if (emailInboxSection) { emailInboxSection.classList.remove('hidden'); emailInboxSection.classList.add('flex'); }
        });
    }

    if (emailDraftGenerateBtn) {
        emailDraftGenerateBtn.addEventListener('click', async () => {
            if (!currentEmailUid) return;
            emailDraftGenerateBtn.textContent = '⏳ Wird entworfen...';
            emailDraftGenerateBtn.disabled = true;
            try {
                const res = await fetch(`${backendUrl}/email/draft-reply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ uid: currentEmailUid, instruction: emailDraftInstruction ? emailDraftInstruction.value.trim() : '' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Entwurf fehlgeschlagen.');
                if (emailDraftText) { emailDraftText.value = data.draft; emailDraftText.classList.remove('hidden'); }
                if (emailDraftHint) emailDraftHint.classList.remove('hidden');
            } catch (err) {
                alert('Fehler: ' + err.message);
            } finally {
                emailDraftGenerateBtn.textContent = 'Antwort entwerfen';
                emailDraftGenerateBtn.disabled = false;
            }
        });
    }

    // --- MICROSOFT 365 / EXCHANGE (Admin: Azure-App-Konfiguration) ---

    async function loadO365Config() {
        if (!o365RedirectUri) return;
        try {
            const res = await fetch(`${backendUrl}/admin/o365/config-status`, { credentials: 'include' });
            const data = await res.json();
            o365RedirectUri.textContent = data.redirectUri || '-';
        } catch (err) {
            console.error('O365-Konfiguration Ladefehler:', err);
        }
    }

    if (o365SaveBtn) {
        o365SaveBtn.addEventListener('click', async () => {
            if (o365Status) {
                o365Status.textContent = 'Speichere...';
                o365Status.className = 'text-[11px] text-slate-400';
                o365Status.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/o365/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        clientId: o365ClientIdInput ? o365ClientIdInput.value.trim() : '',
                        clientSecret: o365ClientSecretInput ? o365ClientSecretInput.value.trim() : '',
                        tenant: o365TenantInput ? o365TenantInput.value.trim() || 'common' : 'common'
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (o365ClientSecretInput) o365ClientSecretInput.value = '';
                if (o365Status) {
                    o365Status.textContent = '✓ Gespeichert.';
                    o365Status.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (o365Status) {
                    o365Status.textContent = '✗ ' + err.message;
                    o365Status.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // --- BACKUP & WIEDERHERSTELLUNG ---

    if (backupCreateBtn) {
        backupCreateBtn.addEventListener('click', async () => {
            backupCreateBtn.disabled = true;
            backupCreateBtn.textContent = 'Erstelle Backup...';
            if (backupCreateStatus) backupCreateStatus.classList.add('hidden');
            try {
                const res = await fetch(`${backendUrl}/admin/backup`, { credentials: 'include' });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || 'Backup fehlgeschlagen.');
                }
                const blob = await res.blob();
                const disposition = res.headers.get('Content-Disposition') || '';
                const match = disposition.match(/filename="(.+)"/);
                const filename = match ? match[1] : 'aurachat-backup.zip';
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (err) {
                if (backupCreateStatus) {
                    backupCreateStatus.textContent = '✗ ' + err.message;
                    backupCreateStatus.className = 'text-[11px] text-red-400';
                    backupCreateStatus.classList.remove('hidden');
                }
            } finally {
                backupCreateBtn.disabled = false;
                backupCreateBtn.textContent = 'Backup herunterladen';
            }
        });
    }

    if (backupRestoreBtn) {
        backupRestoreBtn.addEventListener('click', async () => {
            const file = backupRestoreFile ? backupRestoreFile.files[0] : null;
            if (!file) return alert('Bitte zuerst eine .zip-Datei auswählen.');
            if (!confirm('Wirklich wiederherstellen? Die komplette aktuelle Datenbank wird ersetzt und der Server startet neu. Das kann nicht rückgängig gemacht werden.')) return;

            backupRestoreBtn.disabled = true;
            backupRestoreBtn.textContent = 'Stelle wieder her...';
            if (backupRestoreStatus) backupRestoreStatus.classList.add('hidden');

            const formData = new FormData();
            formData.append('backup', file);

            try {
                const res = await fetch(`${backendUrl}/admin/backup/restore`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Wiederherstellung fehlgeschlagen.');
                if (backupRestoreStatus) {
                    backupRestoreStatus.textContent = '✓ ' + data.message + ' Diese Seite in ca. 10 Sekunden neu laden.';
                    backupRestoreStatus.className = 'text-[11px] text-emerald-400';
                    backupRestoreStatus.classList.remove('hidden');
                }
                setTimeout(() => window.location.reload(), 10000);
            } catch (err) {
                if (backupRestoreStatus) {
                    backupRestoreStatus.textContent = '✗ ' + err.message;
                    backupRestoreStatus.className = 'text-[11px] text-red-400';
                    backupRestoreStatus.classList.remove('hidden');
                }
                backupRestoreBtn.disabled = false;
                backupRestoreBtn.textContent = 'Wiederherstellen';
            }
        });
    }

    if (updateApplyBtn) {
        updateApplyBtn.addEventListener('click', async () => {
            const file = updateApplyFile ? updateApplyFile.files[0] : null;
            if (!file) return alert('Bitte zuerst eine .zip-Datei auswählen.');
            if (!confirm('Update jetzt anwenden? Ein automatisches Backup wird vorher angelegt. Falls server.js geändert wird, startet der Server danach kurz neu.')) return;

            updateApplyBtn.disabled = true;
            updateApplyBtn.textContent = 'Wende Update an...';
            if (updateApplyStatus) updateApplyStatus.classList.add('hidden');

            const formData = new FormData();
            formData.append('update', file);

            try {
                const res = await fetch(`${backendUrl}/admin/update/apply`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Update fehlgeschlagen.');

                let msg = '✓ ' + data.message + ' Angewendet: ' + data.appliedFiles.join(', ') + '.';
                if (data.dependencyWarning) msg += '\n⚠️ ' + data.dependencyWarning;
                if (updateApplyStatus) {
                    updateApplyStatus.textContent = msg;
                    updateApplyStatus.className = data.dependencyWarning ? 'text-[11px] text-amber-400 whitespace-pre-line' : 'text-[11px] text-emerald-400 whitespace-pre-line';
                    updateApplyStatus.classList.remove('hidden');
                }
                if (data.restarting) setTimeout(() => window.location.reload(), 10000);
            } catch (err) {
                if (updateApplyStatus) {
                    updateApplyStatus.textContent = '✗ ' + err.message;
                    updateApplyStatus.className = 'text-[11px] text-red-400 whitespace-pre-line';
                    updateApplyStatus.classList.remove('hidden');
                }
            } finally {
                updateApplyBtn.disabled = false;
                updateApplyBtn.textContent = 'Update anwenden';
            }
        });
    }

    // --- AURA-ACADEMY (Premium "academy") ---

    async function loadAcademyConfig() {
        try {
            const res = await fetch(`${backendUrl}/admin/academy/config`, { credentials: 'include' });
            const data = await res.json();
            if (academyEnabledToggle) academyEnabledToggle.checked = !!data.enabled;
            renderAcademyStatus(data);
        } catch (err) {
            console.error('Aura-Academy Konfiguration Ladefehler:', err);
        }
    }

    function renderAcademyStatus(data) {
        if (!academyStatusDisplay) return;
        if (!data.enabled) {
            academyStatusDisplay.textContent = 'Deaktiviert.';
            return;
        }
        if (data.training) {
            academyStatusDisplay.textContent = '🎓 Training läuft gerade...';
            return;
        }
        const parts = [`${data.iterations || 0} Trainingsrunde(n) bisher`];
        if (data.lastRun) parts.push(`letzter Lauf: ${new Date(data.lastRun).toLocaleString('de-DE')}`);
        if (data.lastFactsCount) parts.push(`${data.lastFactsCount} Fakten zuletzt genutzt`);
        if (data.lastDurationSeconds) parts.push(`Dauer: ${Math.round(data.lastDurationSeconds / 60)} Min.`);
        if (data.lastError) parts.push(`⚠️ Letzter Fehler: ${data.lastError}`);
        academyStatusDisplay.textContent = parts.join(' · ');
    }

    // --- Reflexion ---
    const reflectionEnabledToggle = document.getElementById('reflection-enabled-toggle');
    const reflectionConfigStatus = document.getElementById('reflection-config-status');
    async function loadReflectionConfig() {
        try {
            const res = await fetch(`${backendUrl}/admin/reflection/config`, { credentials: 'include' });
            const data = await res.json();
            if (reflectionEnabledToggle) reflectionEnabledToggle.checked = !!data.enabled;
        } catch (err) {
            console.error('Reflexion Konfiguration Ladefehler:', err);
        }
    }
    if (reflectionEnabledToggle) {
        reflectionEnabledToggle.addEventListener('change', async () => {
            if (reflectionConfigStatus) {
                reflectionConfigStatus.textContent = 'Speichere...';
                reflectionConfigStatus.className = 'text-[11px] text-slate-400';
                reflectionConfigStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/reflection/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ enabled: reflectionEnabledToggle.checked })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (reflectionConfigStatus) {
                    reflectionConfigStatus.textContent = '✓ Gespeichert.';
                    reflectionConfigStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                reflectionEnabledToggle.checked = !reflectionEnabledToggle.checked;
                if (reflectionConfigStatus) {
                    reflectionConfigStatus.textContent = '✗ ' + err.message;
                    reflectionConfigStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (academyEnabledToggle) {
        academyEnabledToggle.addEventListener('change', async () => {
            if (academyConfigStatus) {
                academyConfigStatus.textContent = 'Speichere...';
                academyConfigStatus.className = 'text-[11px] text-slate-400';
                academyConfigStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/academy/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ enabled: academyEnabledToggle.checked })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (academyConfigStatus) {
                    academyConfigStatus.textContent = '✓ Gespeichert.';
                    academyConfigStatus.className = 'text-[11px] text-emerald-400';
                }
                loadAcademyConfig();
            } catch (err) {
                academyEnabledToggle.checked = false;
                if (academyConfigStatus) {
                    academyConfigStatus.textContent = '✗ ' + err.message;
                    academyConfigStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (academyTrainNowBtn) {
        academyTrainNowBtn.addEventListener('click', async () => {
            academyTrainNowBtn.disabled = true;
            academyTrainNowBtn.textContent = 'Wird gestartet...';
            try {
                const res = await fetch(`${backendUrl}/admin/academy/train-now`, { method: 'POST', credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Konnte nicht gestartet werden.');
                loadAcademyConfig();
            } catch (err) {
                alert('Fehler: ' + err.message);
            } finally {
                academyTrainNowBtn.disabled = false;
                academyTrainNowBtn.textContent = 'Jetzt trainieren (statt bis 01:00 Uhr zu warten)';
            }
        });
    }

    // Zweites Symbol im Chat-Header (neben 🧠) - für ALLE eingeloggten Personen, zeigt nur
    // an, OB gerade trainiert wird, keine internen Details.
    async function pollAcademyTrainingIndicator() {
        if (!currentUser || !academyTrainingIndicator) return;
        try {
            const res = await fetch(`${backendUrl}/academy/training-status`, { credentials: 'include' });
            const data = await res.json();
            academyTrainingIndicator.classList.toggle('hidden', !(data.enabled && data.training));
        } catch (err) { /* nicht kritisch - Symbol bleibt einfach versteckt */ }
    }

    // --- WORKSPACE: ORDNER + DOKUMENTE ---

    async function loadWorkspaceDocuments() {
        if (!workspaceDocList) return;
        workspaceDocList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Lade Workspace...</div>';
        try {
            const [foldersRes, docsRes] = await Promise.all([
                fetch(`${backendUrl}/workspace/folders`, { credentials: 'include' }),
                fetch(`${backendUrl}/workspace/documents`, { credentials: 'include' })
            ]);
            const folders = await foldersRes.json();
            const docs = await docsRes.json();
            if (!foldersRes.ok) throw new Error(folders.error || 'Ordner konnten nicht geladen werden.');
            if (!docsRes.ok) throw new Error(docs.error || 'Dokumente konnten nicht geladen werden.');
            workspaceFoldersCache = folders;
            workspaceDocsCache = docs;
            renderWorkspaceView();
        } catch (err) {
            workspaceDocList.innerHTML = `<div class="text-xs text-red-400 text-center py-4">${err.message}</div>`;
        }
    }

    function formatDocSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function setWorkspaceFolder(folderId) {
        currentWorkspaceFolderId = folderId;
        const folder = workspaceFoldersCache.find(f => f.id === folderId);
        if (workspaceCurrentFolderLabel) workspaceCurrentFolderLabel.textContent = folder ? folder.name : 'Hauptverzeichnis';
        if (workspaceGoRootBtn) workspaceGoRootBtn.classList.toggle('hidden', !folderId);
        renderWorkspaceView();
    }

    if (workspaceGoRootBtn) workspaceGoRootBtn.addEventListener('click', () => setWorkspaceFolder(null));

    // Zeigt IMMER nur den Inhalt des aktuellen Ordners (nicht den ganzen Baum auf
    // einmal) - Klick auf einen Unterordner navigiert per setWorkspaceFolder() hinein.
    function renderWorkspaceView() {
        if (!workspaceDocList) return;
        workspaceDocList.innerHTML = '';

        const subFolders = workspaceFoldersCache.filter(f => f.parentId === currentWorkspaceFolderId);
        const docsHere = workspaceDocsCache.filter(d => (d.folderId || null) === currentWorkspaceFolderId);

        if (subFolders.length === 0 && docsHere.length === 0) {
            workspaceDocList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Dieser Ordner ist leer.</div>';
            return;
        }

        subFolders.forEach(folder => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 hover:border-blue-500/50 transition cursor-pointer';

            const info = document.createElement('div');
            info.className = 'flex items-center gap-2 min-w-0 flex-1';
            info.innerHTML = `<span>📁</span> <span class="text-xs font-semibold text-white truncate">${folder.name}</span>`;
            info.addEventListener('click', () => setWorkspaceFolder(folder.id));
            row.appendChild(info);

            const delBtn = document.createElement('button');
            delBtn.className = 'text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0';
            delBtn.textContent = '🗑️';
            delBtn.title = 'Ordner (inkl. Inhalt) löschen';
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Ordner "${folder.name}" wirklich löschen? Alle Unterordner und Dokumente darin werden mitgelöscht.`)) return;
                try {
                    const res = await fetch(`${backendUrl}/workspace/folders/${folder.id}`, { method: 'DELETE', credentials: 'include' });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Löschen fehlgeschlagen.');
                    loadWorkspaceDocuments();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            row.appendChild(delBtn);

            workspaceDocList.appendChild(row);
        });

        docsHere.forEach(doc => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5';

            const info = document.createElement('div');
            info.className = 'flex flex-col min-w-0';
            const nameLine = document.createElement('div');
            nameLine.className = 'text-xs font-semibold text-white truncate';
            nameLine.innerHTML = `📄 ${doc.filename}`;
            const subLine = document.createElement('div');
            subLine.className = 'text-[10px] text-slate-500';
            subLine.textContent = `${formatDocSize(doc.size)} · ${new Date(doc.uploadedAt).toLocaleDateString('de-DE')}`;
            info.appendChild(nameLine);
            info.appendChild(subLine);
            row.appendChild(info);

            const delBtn = document.createElement('button');
            delBtn.className = 'text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0';
            delBtn.textContent = '🗑️';
            delBtn.title = 'Löschen';
            delBtn.addEventListener('click', async () => {
                if (!confirm(`Dokument "${doc.filename}" wirklich löschen?`)) return;
                try {
                    const res = await fetch(`${backendUrl}/workspace/documents/${doc.id}`, { method: 'DELETE', credentials: 'include' });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Löschen fehlgeschlagen.');
                    loadWorkspaceDocuments();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            row.appendChild(delBtn);

            workspaceDocList.appendChild(row);
        });
    }

    if (workspaceNewFolderBtn) {
        workspaceNewFolderBtn.addEventListener('click', async () => {
            const name = workspaceNewFolderInput ? workspaceNewFolderInput.value.trim() : '';
            if (!name) return;
            try {
                const res = await fetch(`${backendUrl}/workspace/folders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, parentId: currentWorkspaceFolderId })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ordner konnte nicht erstellt werden.');
                if (workspaceNewFolderInput) workspaceNewFolderInput.value = '';
                loadWorkspaceDocuments();
            } catch (err) {
                alert('Fehler: ' + err.message);
            }
        });
    }

    if (workspaceUploadBtn) {
        workspaceUploadBtn.addEventListener('click', async () => {
            const file = workspaceFileInput && workspaceFileInput.files[0];
            if (!file) return;

            if (workspaceUploadStatus) {
                workspaceUploadStatus.textContent = 'Lade hoch & verarbeite...';
                workspaceUploadStatus.className = 'text-[11px] text-slate-400';
                workspaceUploadStatus.classList.remove('hidden');
            }

            try {
                const base64 = await fileToBase64(file); // liefert "data:...;base64,XXXX"
                const base64Data = base64.split(',')[1] || base64;

                const res = await fetch(`${backendUrl}/workspace/documents`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ filename: file.name, data: base64Data, folderId: currentWorkspaceFolderId })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen.');

                if (workspaceUploadStatus) {
                    workspaceUploadStatus.textContent = `✓ "${data.filename}" hochgeladen (${formatDocSize(data.size)} Text extrahiert).`;
                    workspaceUploadStatus.className = 'text-[11px] text-emerald-400';
                }
                if (workspaceFileInput) workspaceFileInput.value = '';
                loadWorkspaceDocuments();
            } catch (err) {
                if (workspaceUploadStatus) {
                    workspaceUploadStatus.textContent = '✗ ' + err.message;
                    workspaceUploadStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // Code-Modus: nutzt das Coding-Modell (falls eingerichtet) und lässt das Modell Code als Codeblock schreiben.
    // Bleibt an, bis er wieder ausgeschaltet wird - der Platzhalter im Eingabefeld erinnert daran.
    function codeModePlaceholder() {
        return appConfig.ui_lang === 'en' ? 'Code mode: describe what the code should do...' : 'Code-Modus: Beschreibe, was der Code tun soll...';
    }
    function setCodeMode(enabled) {
        codeModeEnabled = !!enabled;
        if (codeModeToggle) {
            codeModeToggle.className = codeModeEnabled
                ? 'bg-blue-600 text-white p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-blue-500 cursor-pointer'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-slate-700 cursor-pointer';
        }
        if (userInput) {
            const t = translations[appConfig.ui_lang] || translations.de;
            userInput.placeholder = codeModeEnabled ? codeModePlaceholder() : t.inputPlaceholder;
        }
    }
    if (codeModeToggle) codeModeToggle.addEventListener('click', () => setCodeMode(!codeModeEnabled));

    if (workspaceToggle) {
        workspaceToggle.addEventListener('click', () => {
            workspaceEnabled = !workspaceEnabled;
            workspaceToggle.className = workspaceEnabled
                ? 'bg-blue-600 text-white p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-blue-500 cursor-pointer'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-slate-700 cursor-pointer';
        });
    }

    // Fragt die eigenen Workspace-Dokumente über den Backend-Proxy ab
    async function fetchWorkspaceChunks(query) {
        try {
            const res = await fetch(`${backendUrl}/workspace/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Workspace-Suche fehlgeschlagen.');
            return data.chunks || [];
        } catch (err) {
            console.error('Workspace-Suche Fehler:', err);
            return null;
        }
    }
    if (menuItemAdminPanel) {
        menuItemAdminPanel.addEventListener('click', () => {
            if (dropdownMenu) dropdownMenu.classList.add('hidden');
            if (modalAdminPanel) modalAdminPanel.classList.remove('hidden');
            loadAdminUsers();
            loadAdminUserLimitDisplay();
        });
    }

    // Das Cockpit (Gesundheit des Servers) ist nach AuraControl umgezogen (Ansicht "Cockpit").
    // --- ADMIN PANEL: TAB-STEUERUNG ---

    function switchAdminTab(tab) {
        const tabs = { users: adminTabUsers, appstore: adminTabAppstore, branding: adminTabBranding, mail: adminTabMail, twofa: adminTab2fa, ttsstt: adminTabTtsStt, api: adminTabApi, license: adminTabLicense, privacy: adminTabPrivacy, academy: adminTabAcademy, backup: adminTabBackup };
        const btns = { users: adminTabBtnUsers, appstore: adminTabBtnAppstore, branding: adminTabBtnBranding, mail: adminTabBtnMail, twofa: adminTabBtn2fa, ttsstt: adminTabBtnTtsStt, api: adminTabBtnApi, license: adminTabBtnLicense, privacy: adminTabBtnPrivacy, academy: adminTabBtnAcademy, backup: adminTabBtnBackup };
        const activeClass = 'admin-tab-btn flex-1 min-w-[30%] text-xs font-medium py-2 rounded-xl transition cursor-pointer bg-blue-600 text-white';
        const inactiveClass = 'admin-tab-btn flex-1 min-w-[30%] text-xs font-medium py-2 rounded-xl transition cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700';

        Object.entries(tabs).forEach(([key, el]) => { if (el) el.classList.toggle('hidden', key !== tab); });
        Object.entries(btns).forEach(([key, el]) => { if (el) el.className = key === tab ? activeClass : inactiveClass; });

        if (tab === 'appstore') {
            openAppstoreHome();
        } else if (tab === 'branding') {
            refreshBrandingPreviews();
        } else if (tab === 'mail') {
            loadAdminMailConfig();
        } else if (tab === 'twofa') {
            loadAdmin2faConfig();
        } else if (tab === 'ttsstt') {
            loadAdminTtsSttConfig();
        } else if (tab === 'api') {
            loadAdminApiKeys();
            loadIntegrations();
            loadO365Config();
            loadLocalMediaBaseUrl();
            loadAuraDirectSettings();
        } else if (tab === 'license') {
            loadAdminLicenseStatus();
        } else if (tab === 'privacy') {
            loadAdminPrivacyPolicy();
        } else if (tab === 'academy') {
            loadAcademyConfig();
            loadReflectionConfig();
        }
    }

    if (adminTabBtnUsers) adminTabBtnUsers.addEventListener('click', () => switchAdminTab('users'));
    if (adminTabBtnBranding) adminTabBtnBranding.addEventListener('click', () => switchAdminTab('branding'));
    if (adminTabBtnAppstore) adminTabBtnAppstore.addEventListener('click', () => switchAdminTab('appstore'));
    if (adminTabBtnMail) adminTabBtnMail.addEventListener('click', () => switchAdminTab('mail'));
    if (adminTabBtn2fa) adminTabBtn2fa.addEventListener('click', () => switchAdminTab('twofa'));
    if (adminTabBtnTtsStt) adminTabBtnTtsStt.addEventListener('click', () => switchAdminTab('ttsstt'));
    if (adminTabBtnApi) adminTabBtnApi.addEventListener('click', () => switchAdminTab('api'));
    if (adminTabBtnLicense) adminTabBtnLicense.addEventListener('click', () => switchAdminTab('license'));
    if (adminTabBtnAcademy) adminTabBtnAcademy.addEventListener('click', () => switchAdminTab('academy'));
    if (adminTabBtnBackup) adminTabBtnBackup.addEventListener('click', () => switchAdminTab('backup'));

    // --- ADMIN PANEL: EXTERNE API (Premium) ---

    // keepReveal: direkt nach dem Erzeugen den Kasten mit dem NEUEN Schlüssel stehen lassen (er wird nur dieses eine Mal angezeigt).
    // Früher blendete das Neuladen der Liste den Kasten sofort wieder aus: der Schlüssel war erzeugt, aber nie zu sehen.
    async function loadAdminApiKeys(keepReveal) {
        if (apiExampleUrl) apiExampleUrl.textContent = window.location.origin;
        if (apiKeyNewReveal && !keepReveal) apiKeyNewReveal.classList.add('hidden');
        if (!apiKeysList) return;
        apiKeysList.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">Lade API-Keys...</div>';
        try {
            const res = await fetch(`${backendUrl}/admin/api-keys`, { credentials: 'include' });
            const keys = await res.json();
            if (!res.ok) throw new Error(keys.error || 'API-Keys konnten nicht geladen werden.');
            renderAdminApiKeys(keys);
        } catch (err) {
            apiKeysList.innerHTML = `<div class="text-xs text-red-400 text-center py-2">${err.message}</div>`;
        }
    }

    function renderAdminApiKeys(keys) {
        if (!apiKeysList) return;
        apiKeysList.innerHTML = '';
        if (keys.length === 0) {
            apiKeysList.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">Noch keine API-Keys erzeugt.</div>';
            return;
        }
        keys.forEach(k => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5';

            const info = document.createElement('div');
            info.className = 'flex flex-col min-w-0';
            const nameLine = document.createElement('div');
            nameLine.className = 'text-xs font-semibold text-white truncate';
            nameLine.textContent = k.label;
            const subLine = document.createElement('div');
            subLine.className = 'text-[10px] text-slate-500';
            subLine.textContent = `Erzeugt ${new Date(k.createdAt).toLocaleDateString('de-DE')} · Zuletzt genutzt: ${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('de-DE') : 'nie'}`;
            info.appendChild(nameLine);
            info.appendChild(subLine);
            row.appendChild(info);

            const delBtn = document.createElement('button');
            delBtn.className = 'text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0';
            delBtn.textContent = '🗑️ Widerrufen';
            delBtn.addEventListener('click', async () => {
                if (!confirm(`API-Key "${k.label}" wirklich widerrufen? Plattformen, die ihn nutzen, verlieren sofort den Zugriff.`)) return;
                try {
                    const res = await fetch(`${backendUrl}/admin/api-keys/${k.id}`, { method: 'DELETE', credentials: 'include' });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Widerrufen fehlgeschlagen.');
                    loadAdminApiKeys();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            row.appendChild(delBtn);

            apiKeysList.appendChild(row);
        });
    }

    if (apiKeyCreateBtn) {
        apiKeyCreateBtn.addEventListener('click', async () => {
            const label = apiKeyLabelInput ? apiKeyLabelInput.value.trim() : '';
            try {
                const res = await fetch(`${backendUrl}/admin/api-keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ label })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Key konnte nicht erzeugt werden.');

                if (apiKeyNewValue) apiKeyNewValue.value = data.key;
                if (apiKeyNewReveal) apiKeyNewReveal.classList.remove('hidden');
                if (apiKeyLabelInput) apiKeyLabelInput.value = '';
                loadAdminApiKeys(true);
            } catch (err) {
                alert('Fehler: ' + err.message);
            }
        });
    }

    // --- LIZENZ (Premium-Features) ---

    // Öffentlich, funktioniert für Gäste/User/Admin gleichermassen
    async function loadLicenseFeatures() {
        try {
            const res = await fetch(`${backendUrl}/license-features`);
            const data = await res.json();
            licenseFeatures = data.features || [];
        } catch (err) {
            console.error('Lizenz-Features Ladefehler:', err);
            licenseFeatures = [];
        }
    }

    // Blendet Premium-Hinweise ein/aus, je nachdem was freigeschaltet ist
    function applyLicenseUI() {
        const hasChatBg = licenseFeatures.includes('chat_bg');
        const hasTtsStt = licenseFeatures.includes('tts_stt');

        if (chatBgPremiumBadge) chatBgPremiumBadge.classList.toggle('hidden', hasChatBg);
        if (chatBgPremiumNote) chatBgPremiumNote.classList.toggle('hidden', hasChatBg);
        if (configChatBg) configChatBg.disabled = !hasChatBg;
        document.querySelectorAll('.chat-bg-preset-btn').forEach(btn => {
            btn.disabled = !hasChatBg;
            btn.classList.toggle('opacity-40', !hasChatBg);
            btn.classList.toggle('cursor-not-allowed', !hasChatBg);
        });

        const hasApiAccess = licenseFeatures.includes('api_access');
        if (apiPremiumBanner) apiPremiumBanner.classList.toggle('hidden', hasApiAccess);
        [apiKeyLabelInput, apiKeyCreateBtn].forEach(el => {
            if (el) el.disabled = !hasApiAccess;
        });

        if (ttsSttPremiumBanner) ttsSttPremiumBanner.classList.toggle('hidden', hasTtsStt);
        [ttsSttHost, ttsSttPort, ttsModelInput, ttsVoiceInput, sttModelInput, pronunciationAddRowBtn, pronunciationSaveBtn, ttsSttDownloadModelId, ttsSttDownloadBtn].forEach(el => {
            if (el) el.disabled = !hasTtsStt;
        });
        // Plattform-Auswahl bleibt bedienbar (damit man zurück auf "Browser" wechseln kann),
        // Speichern eines Premium-Werts wird serverseitig ohnehin geprüft und abgelehnt.

        const hasIntegrations = licenseFeatures.includes('integrations');
        if (integrationsPremiumBanner) integrationsPremiumBanner.classList.toggle('hidden', hasIntegrations);
        [dirigeraIpInput, dirigeraPairBtn, customIntName, customIntUrl, customIntAuthHeader, customIntAuthValue, customIntAddCommandBtn, customIntSaveBtn, sonosNameInput, sonosIpInput, sonosAddBtn].forEach(el => {
            if (el) el.disabled = !hasIntegrations;
        });

        const hasImageGen = licenseFeatures.includes('image_gen');
        if (imageGenPremiumBadge) imageGenPremiumBadge.classList.toggle('hidden', hasImageGen);
        if (imageGenPremiumBanner) imageGenPremiumBanner.classList.toggle('hidden', hasImageGen);
        [imageGenPlatform, imageGenHostInput, imageGenPortInput, imageGenModelSelect, imageGenFetchModelsBtn, imageGenApiKeyInput, imageGenSaveBtn].forEach(el => {
            if (el) el.disabled = !hasImageGen;
        });

        const hasCodingModel = licenseFeatures.includes('coding_model');
        if (codingModelPremiumBadge) codingModelPremiumBadge.classList.toggle('hidden', hasCodingModel);
        if (codingModelPremiumBanner) codingModelPremiumBanner.classList.toggle('hidden', hasCodingModel);
        [codingModelEnabled, codingModelHostInput, codingModelPortInput, codingModelSelect, codingModelFetchBtn, codingModelInput, codingModelAuto].forEach(el => {
            if (el) el.disabled = !hasCodingModel;
        });


        const hasAvatarUpload = licenseFeatures.includes('avatar');
        if (videoAvatarPremiumBadge) videoAvatarPremiumBadge.classList.toggle('hidden', hasAvatarUpload);
        if (videoAvatarPremiumBanner) videoAvatarPremiumBanner.classList.toggle('hidden', hasAvatarUpload);
        [videoAvatarNameInput, videoAvatarIdleInput, videoAvatarMotionInput, videoAvatarUploadBtn].forEach(el => {
            if (el) el.disabled = !hasAvatarUpload;
        });

        const hasDualModel = licenseFeatures.includes('dual_model');
        if (secondaryModelPremiumBadge) secondaryModelPremiumBadge.classList.toggle('hidden', hasDualModel);
        if (secondaryModelPremiumBanner) secondaryModelPremiumBanner.classList.toggle('hidden', hasDualModel);
        [secondaryModelEnabled, secondaryModeSequentialBtn, secondaryModeParallelBtn, secondaryModelPlatform, secondaryModelHostInput, secondaryModelPortInput, secondaryModelApiKeyInput, secondaryModelNameInput].forEach(el => {
            if (el) el.disabled = !hasDualModel;
        });

        const hasEmail = licenseFeatures.includes('email');
        if (emailPremiumBadge) emailPremiumBadge.classList.toggle('hidden', hasEmail);
        if (emailPremiumBanner) emailPremiumBanner.classList.toggle('hidden', hasEmail);
        [emailImapHost, emailImapPort, emailImapSecure, emailUsername, emailPassword, emailConnectBtn].forEach(el => {
            if (el) el.disabled = !hasEmail;
        });

        const hasAcademy = licenseFeatures.includes('academy');
        if (academyPremiumBanner) academyPremiumBanner.classList.toggle('hidden', hasAcademy);
        [academyEnabledToggle, academyTrainNowBtn].forEach(el => { if (el) el.disabled = !hasAcademy; });

        const hasRebrand = licenseFeatures.includes('rebrand');
        if (brandingPremiumBanner) brandingPremiumBanner.classList.toggle('hidden', hasRebrand);
        [brandingLogoFile, brandingLogoUploadBtn, brandingIconFile, brandingIconUploadBtn].forEach(el => { if (el) el.disabled = !hasRebrand; });
    }

    async function loadAdminLicenseStatus() {
        if (!adminLicenseCurrent) return;
        adminLicenseCurrent.innerHTML = '<div class="text-xs text-slate-500">Lade Lizenzstatus...</div>';
        try {
            const res = await fetch(`${backendUrl}/admin/license`, { credentials: 'include' });
            const info = await res.json();
            renderAdminLicenseStatus(info);
        } catch (err) {
            adminLicenseCurrent.innerHTML = '<div class="text-xs text-red-400">Lizenzstatus konnte nicht geladen werden.</div>';
        }
        loadLicenseCheckinConfig();
    }

    async function loadLicenseCheckinConfig() {
        if (!licenseCheckinStatus) return;
        try {
            const res = await fetch(`${backendUrl}/admin/license-checkin`, { credentials: 'include' });
            const data = await res.json();
            renderCheckinResult(data);
        } catch (err) {
            licenseCheckinStatus.textContent = '';
        }
    }

    function renderCheckinResult(data) {
        if (!licenseCheckinStatus) return;
        const result = data && data.lastResult;
        if (!result) {
            licenseCheckinStatus.textContent = 'Noch kein Abgleich erfolgt (der erste läuft kurz nach dem Start).';
            licenseCheckinStatus.className = 'text-[11px] text-slate-500';
            return;
        }
        const time = new Date(result.at).toLocaleString('de-DE');
        licenseCheckinStatus.textContent = result.success ? `✓ Zuletzt erfolgreich (${time})` : `✗ Zuletzt fehlgeschlagen: ${result.message} (${time}) - wird automatisch erneut versucht.`;
        licenseCheckinStatus.className = result.success ? 'text-[11px] text-emerald-400' : 'text-[11px] text-red-400';
    }

    function quotaLine(info) {
        const usersText = info.maxUsers === null ? `${info.totalUsers ?? '-'} (unbegrenzt)` : `${info.totalUsers ?? '-'} / ${info.maxUsers}`;
        const adminsText = info.maxAdmins === null ? `${info.totalAdmins ?? '-'} (unbegrenzt)` : `${info.totalAdmins ?? '-'} / ${info.maxAdmins}`;
        return `<div class="text-[11px] text-slate-400 mt-1">Auslastung: <span class="text-slate-200">${usersText} Benutzer</span> · <span class="text-slate-200">${adminsText} Administratoren</span></div>`;
    }

    function renderAdminLicenseStatus(info) {
        if (licenseSyncStatus) {
            const sy = info && info.sync, lr = sy && sy.lastResult;
            licenseSyncStatus.textContent = !sy || !sy.enabled ? 'Abholen bei AuraControl ist abgeschaltet (LICENSE_SYNC_URL).'
                : !lr ? 'Wird kurz nach dem Start bei AuraControl abgeholt, danach alle 15 Minuten.'
                : (lr.ok ? '✓ Zuletzt bei AuraControl abgeholt: ' : '✗ AuraControl: ' + (lr.message || 'Fehler') + ' · ') + new Date(lr.at).toLocaleString('de-CH');
        }
        if (!adminLicenseCurrent) return;
        if (info.licenseValid) {
            const expiryText = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString('de-DE') : 'unbegrenzt';
            adminLicenseCurrent.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-semibold text-emerald-400">✓ Lizenz aktiv</span>
                </div>
                ${info.plan ? `<div class="text-[11px] text-blue-300">${info.plan === 'advanced' ? 'Business Advanced' : info.plan === 'solo' ? 'Business Solo' : 'Aura-Suite'} · gilt für alle Aura-Produkte</div>` : ''}
                ${info.managedBy === 'auracontrol' ? '<div class="text-[11px] text-slate-400">Wird von <span class="text-slate-200">AuraControl</span> verwaltet und automatisch aktualisiert.</div>' : ''}
                <div class="text-[11px] text-slate-400">Kunde: <span class="text-slate-200">${info.customer || '-'}</span></div>
                <div class="text-[11px] text-slate-400">Umfang: <span class="text-slate-200">alle Funktionen</span></div>
                <div class="text-[11px] text-slate-400">Gültig bis: <span class="text-slate-200">${expiryText}</span></div>
                ${quotaLine(info)}
            `;
        } else if (info.trial) {
            adminLicenseCurrent.innerHTML = `
                <div class="text-xs font-semibold text-blue-400 mb-1">🎁 Testphase aktiv</div>
                <div class="text-[11px] text-slate-400">Noch <span class="text-slate-200">${info.trialDaysRemaining}</span> Tag(e) - alle Premium-Features sind bis dahin freigeschaltet, auch ohne Lizenz.</div>
                <div class="text-[11px] text-slate-500 mt-1">Danach braucht es eine Lizenz: Sie wird in AuraControl eingetragen und kommt automatisch hierher.</div>
                ${quotaLine(info)}
            `;
        } else {
            adminLicenseCurrent.innerHTML = `
                <div class="text-xs text-slate-400">Keine aktive Lizenz (Free-Version).${info.error ? ` <span class="text-red-400">${info.error}</span>` : ''}</div>
                ${quotaLine(info)}
            `;
        }
    }

    // --- ADMIN PANEL: APP STORE (Apaleo, IKEA SmartHome, Sonos, Nuki) ---
    // Eine App wirkt erst, wenn sie AKTIVIERT und EINGERICHTET ist. Das Einrichten steht in der App selbst und ist erst nach dem Aktivieren sichtbar.
    // Logos: Dateien images/apps/<kennung>.png (oder .svg, .webp, .jpg), z. B. apaleo.png, ikea.png, sonos.png. Fehlt eine Datei, erscheint das Symbol der App.
    const appstoreGrid = document.getElementById('appstore-grid');
    const appstoreHome = document.getElementById('appstore-home');
    const appstoreDetail = document.getElementById('appstore-detail');
    const appstoreError = document.getElementById('appstore-error');
    const appstoreToggleBtn = document.getElementById('appstore-detail-toggle');
    const appstoreDetailStatus = document.getElementById('appstore-detail-status');
    const APPSTORE_LOGO_EXTS = ['png', 'svg', 'webp', 'jpg'];
    const APPSTORE_STATES = { inactive: ['Nicht aktiviert', 'bg-slate-800 text-slate-300'], needs_setup: ['Aktiviert · Einrichtung fehlt', 'bg-amber-500/15 text-amber-300'], active: ['Aktiv', 'bg-emerald-500/15 text-emerald-300'] };
    let appstoreApps = [], appstoreOpenId = null;

    function appstoreLogo(app, sizeClass) {
        const box = document.createElement('div');
        box.className = `${sizeClass} rounded-xl ring-1 ring-white/10 flex items-center justify-center overflow-hidden shrink-0`;
        const img = document.createElement('img'); img.alt = ''; img.setAttribute('data-aura-keep', ''); img.className = 'w-full h-full object-cover'; let n = 0;
        img.addEventListener('error', () => { n++; if (n < APPSTORE_LOGO_EXTS.length) img.src = `images/apps/${app.id}.${APPSTORE_LOGO_EXTS[n]}`; else { if (img.parentNode) box.removeChild(img); box.textContent = app.icon || '🧩'; box.classList.add('text-2xl', 'bg-white/5', 'border', 'border-slate-800'); } });
        img.src = `images/apps/${app.id}.${APPSTORE_LOGO_EXTS[0]}`; box.appendChild(img);
        return box;
    }
    function appstoreBadge(el, state) {
        const [text, cls] = APPSTORE_STATES[state] || APPSTORE_STATES.inactive;
        el.textContent = text; el.className = 'shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ' + cls;
    }
    function showAppstoreError(msg) { if (!appstoreError) return; appstoreError.textContent = msg || ''; appstoreError.classList.toggle('hidden', !msg); }

    function renderAppstoreGrid() {
        if (!appstoreGrid) return;
        appstoreGrid.textContent = '';
        appstoreApps.forEach((app) => {
            const card = document.createElement('button'); card.type = 'button'; card.setAttribute('data-app', app.id);
            card.className = 'text-left bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col gap-3 transition cursor-pointer';
            const top = document.createElement('div'); top.className = 'flex items-center gap-3';
            top.appendChild(appstoreLogo(app, 'w-12 h-12'));
            const names = document.createElement('div'); names.className = 'flex-1 min-w-0';
            const nm = document.createElement('div'); nm.className = 'text-sm font-bold text-white'; nm.textContent = app.name;
            const ct = document.createElement('div'); ct.className = 'text-[10px] text-slate-500'; ct.textContent = app.category;
            names.appendChild(nm); names.appendChild(ct); top.appendChild(names);
            const badge = document.createElement('span'); badge.setAttribute('data-role', 'badge'); appstoreBadge(badge, app.state); top.appendChild(badge);
            const desc = document.createElement('p'); desc.className = 'text-[11px] text-slate-400'; desc.textContent = app.description;
            const foot = document.createElement('div'); foot.className = 'flex items-center justify-between text-[11px]';
            const open = document.createElement('span'); open.className = 'text-blue-400 font-medium'; open.textContent = 'Öffnen';
            foot.appendChild(open);
            if (app.locked) { const lock = document.createElement('span'); lock.setAttribute('data-role', 'premium'); lock.className = 'text-amber-300'; lock.textContent = '🔒 Premium'; foot.appendChild(lock); }
            card.appendChild(top); card.appendChild(desc); card.appendChild(foot);
            card.addEventListener('click', () => openAppstoreDetail(app.id));
            appstoreGrid.appendChild(card);
        });
    }

    async function loadAppstoreApps() {
        try {
            const res = await fetch(`${backendUrl}/admin/apps`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Der App Store konnte nicht geladen werden.');
            appstoreApps = Array.isArray(data.apps) ? data.apps : [];
            showAppstoreError('');
            return true;
        } catch (err) { showAppstoreError(err.message); return false; }
    }

    async function openAppstoreHome() {
        appstoreOpenId = null;
        if (appstoreDetail) { appstoreDetail.classList.add('hidden'); appstoreDetail.classList.remove('flex'); }
        if (appstoreHome) { appstoreHome.classList.remove('hidden'); appstoreHome.classList.add('flex'); }
        await loadAppstoreApps(); renderAppstoreGrid();
    }

    // Daten der Einrichtung einer App laden (die Felder stehen jetzt in der App)
    function refreshAppData(id) {
        if (id === 'apaleo') { if (typeof fillIntegrationFields === 'function') fillIntegrationFields(); }
        else if (id === 'ikea' || id === 'nuki') loadIntegrations();
        else if (id === 'sonos') { loadIntegrations(); loadLocalMediaBaseUrl(); }
    }

    function renderAppstoreDetail(app) {
        const q = (id) => document.getElementById(id);
        const logo = q('appstore-detail-logo'); logo.textContent = ''; logo.appendChild(appstoreLogo(app, 'w-14 h-14'));
        q('appstore-detail-title').textContent = app.name; q('appstore-detail-category').textContent = app.category; appstoreBadge(q('appstore-detail-badge'), app.state);
        q('appstore-detail-desc').textContent = app.description;
        const ul = q('appstore-detail-unlocks'); ul.textContent = ''; (app.unlocks || []).forEach((u) => { const li = document.createElement('li'); li.textContent = u; ul.appendChild(li); });
        q('appstore-detail-premium').classList.toggle('hidden', !app.locked);
        q('appstore-detail-inactive').classList.toggle('hidden', app.enabled);
        q('appstore-detail-needs-setup').classList.toggle('hidden', !(app.enabled && !app.configured));
        appstoreToggleBtn.textContent = app.enabled ? 'Deaktivieren' : 'Aktivieren';
        appstoreToggleBtn.className = (app.enabled ? 'bg-slate-800 hover:bg-red-900/60 border border-slate-700' : 'bg-blue-600 hover:bg-blue-500') + ' text-white font-medium px-4 py-2 rounded-lg text-xs transition cursor-pointer';
        appstoreToggleBtn.disabled = !app.enabled && app.locked; appstoreToggleBtn.classList.toggle('opacity-50', appstoreToggleBtn.disabled); appstoreToggleBtn.classList.toggle('cursor-not-allowed', appstoreToggleBtn.disabled);
        ['apaleo', 'ikea', 'sonos', 'nuki'].forEach((k) => { const box = q(`appstore-setup-${k}`); if (!box) return; const show = k === app.id && app.enabled; box.classList.toggle('hidden', !show); box.classList.toggle('flex', show); });
        appstoreDetailStatus.classList.add('hidden');
    }

    async function openAppstoreDetail(id) {
        appstoreOpenId = id;
        if (appstoreHome) { appstoreHome.classList.add('hidden'); appstoreHome.classList.remove('flex'); }
        if (appstoreDetail) { appstoreDetail.classList.remove('hidden'); appstoreDetail.classList.add('flex'); }
        await loadAppstoreApps();
        const app = appstoreApps.find((a) => a.id === id);
        if (!app) { openAppstoreHome(); return; }
        renderAppstoreDetail(app);
        if (app.enabled) refreshAppData(id);
    }

    async function toggleAppstoreApp() {
        const app = appstoreApps.find((a) => a.id === appstoreOpenId); if (!app) return;
        const t = (txt) => (window.AuraI18n && window.AuraI18n.t ? window.AuraI18n.t(txt) : txt);
        if (app.enabled && !confirm(t(`„${app.name}“ deaktivieren? Die Befehle und Funktionen dieser App stehen dann nicht mehr zur Verfügung. Zugang, Geräte und Einstellungen bleiben erhalten.`))) return;
        appstoreToggleBtn.disabled = true;
        try {
            const res = await fetch(`${backendUrl}/admin/apps/${encodeURIComponent(app.id)}/${app.enabled ? 'deactivate' : 'activate'}`, { method: 'POST', credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Das hat nicht geklappt.');
            await openAppstoreDetail(app.id);
        } catch (err) {
            appstoreDetailStatus.textContent = err.message; appstoreDetailStatus.className = 'text-[11px] text-red-400';
            appstoreToggleBtn.disabled = false;
        }
    }
    if (appstoreToggleBtn) appstoreToggleBtn.addEventListener('click', toggleAppstoreApp);
    const appstoreBackBtn = document.getElementById('appstore-back-btn');
    if (appstoreBackBtn) appstoreBackBtn.addEventListener('click', openAppstoreHome);

    // --- ADMIN PANEL: INTEGRATIONEN (Dirigera & eigene Anwendungen) ---

    async function loadIntegrations() {
        if (integrationsList) integrationsList.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">Lade Integrationen...</div>';
        try {
            const res = await fetch(`${backendUrl}/admin/integrations`, { credentials: 'include' });
            const items = await res.json();
            if (!res.ok) throw new Error(items.error || 'Integrationen konnten nicht geladen werden.');
            renderIntegrations(items);
        } catch (err) {
            for (const el of [integrationsList, document.getElementById('ikea-devices-list'), document.getElementById('sonos-speakers-list'), document.getElementById('nuki-doors-list')]) { if (el) { el.textContent = ''; const d = document.createElement('div'); d.className = 'text-xs text-red-400 text-center py-2'; d.textContent = err.message; el.appendChild(d); } }
        }
    }

    // IKEA-Hub und Sonos-Lautsprecher stehen in ihrer App (App Store), Nuki und eigene Anwendungen weiter im API-Reiter
    function renderIntegrations(items) {
        renderIntegrationsInto(integrationsList, items.filter(i => i.type !== 'dirigera' && i.type !== 'sonos' && i.type !== 'nuki'), 'Noch keine Integrationen verbunden.');
        renderIntegrationsInto(document.getElementById('ikea-devices-list'), items.filter(i => i.type === 'dirigera'), 'Noch kein Hub gekoppelt.');
        renderIntegrationsInto(document.getElementById('sonos-speakers-list'), items.filter(i => i.type === 'sonos'), 'Noch kein Lautsprecher eingetragen.');
        renderIntegrationsInto(document.getElementById('nuki-doors-list'), items.filter(i => i.type === 'nuki'), 'Noch kein Schloss eingetragen.');
    }

    function renderIntegrationsInto(container, items, emptyText) {
        if (!container) return;
        container.innerHTML = '';
        if (items.length === 0) {
            container.textContent = ''; const emptyEl = document.createElement('div'); emptyEl.className = 'text-xs text-slate-500 text-center py-2'; emptyEl.textContent = emptyText; container.appendChild(emptyEl);
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center justify-between';
            const info = document.createElement('div');
            const icon = item.type === 'dirigera' ? '🏠' : (item.type === 'sonos' ? '🔊' : (item.type === 'nuki' ? '🔒' : '🔗'));
            const subLabel = item.type === 'dirigera' ? 'IKEA Dirigera' : (item.type === 'sonos' ? 'Sonos' : (item.type === 'nuki' ? 'Nuki' : item.baseUrl));
            info.innerHTML = `<div class="text-xs font-semibold text-white">${icon} ${item.name}</div><div class="text-[10px] text-slate-500">${subLabel}</div>`;
            topRow.appendChild(info);

            const delBtn = document.createElement('button');
            delBtn.className = 'text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0';
            delBtn.textContent = '🗑️';
            delBtn.addEventListener('click', async () => {
                if (!confirm(`Integration "${item.name}" wirklich entfernen?`)) return;
                try {
                    const res = await fetch(`${backendUrl}/admin/integrations/${item.id}`, { method: 'DELETE', credentials: 'include' });
                    if (!res.ok) throw new Error('Löschen fehlgeschlagen.');
                    loadIntegrations();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });

            const editBtn = document.createElement('button');
            editBtn.className = 'text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1.5 rounded-lg transition cursor-pointer shrink-0 mr-1.5';
            editBtn.textContent = '✏️';
            editBtn.title = 'Name/IP-Adresse bearbeiten';
            editBtn.addEventListener('click', () => {
                editRow.classList.toggle('hidden');
                editRow.classList.toggle('flex');
            });
            topRow.appendChild(editBtn);
            topRow.appendChild(delBtn);
            card.appendChild(topRow);

            // Zeile zum Bearbeiten - versteckt, bis auf ✏️ geklickt wird
            const editRow = document.createElement('div');
            editRow.className = 'hidden flex-col gap-1.5 pt-1 border-t border-slate-800 mt-1';
            const editNameInput = document.createElement('input');
            editNameInput.type = 'text';
            editNameInput.value = item.name;
            editNameInput.placeholder = 'Name';
            editNameInput.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500';
            editRow.appendChild(editNameInput);
            let editIpInput = null;
            let editTokenInput = null;
            if (item.type === 'sonos') {
                editIpInput = document.createElement('input');
                editIpInput.type = 'text';
                editIpInput.value = (item.baseUrl || '').replace('http://', '').replace(':1400', '');
                editIpInput.placeholder = 'IP-Adresse';
                editIpInput.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500';
                editRow.appendChild(editIpInput);
            } else if (item.type === 'nuki') {
                editIpInput = document.createElement('input');
                editIpInput.type = 'text';
                editIpInput.value = (item.baseUrl || '').replace('http://', '').replace(':8080', '');
                editIpInput.placeholder = 'Bridge-IP';
                editIpInput.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500';
                editRow.appendChild(editIpInput);
                editTokenInput = document.createElement('input');
                editTokenInput.type = 'text';
                editTokenInput.placeholder = 'Neuer Token (leer lassen = unverändert)';
                editTokenInput.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500';
                editRow.appendChild(editTokenInput);
            }
            const editSaveBtn = document.createElement('button');
            editSaveBtn.className = 'text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg transition cursor-pointer self-start';
            editSaveBtn.textContent = 'Speichern';
            editSaveBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${backendUrl}/admin/integrations/${item.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            name: editNameInput.value.trim(),
                            ip: editIpInput ? editIpInput.value.trim() : undefined,
                            token: editTokenInput ? editTokenInput.value.trim() : undefined
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                    loadIntegrations();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            editRow.appendChild(editSaveBtn);
            card.appendChild(editRow);

            if (item.type === 'dirigera') {
                const devicesWrap = document.createElement('div');
                devicesWrap.className = 'flex flex-col gap-1.5 pt-1';

                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer text-left';
                refreshBtn.textContent = '🔄 Geräte aktualisieren';
                refreshBtn.addEventListener('click', async () => {
                    devicesWrap.innerHTML = '<div class="text-[10px] text-slate-500">Lade Geräte...</div>';
                    try {
                        const res = await fetch(`${backendUrl}/admin/integrations/${item.id}/devices`, { credentials: 'include' });
                        const devices = await res.json();
                        if (!res.ok) throw new Error(devices.error || 'Geräte konnten nicht geladen werden.');
                        renderDirigeraDevices(devicesWrap, item.id, devices);
                    } catch (err) {
                        devicesWrap.innerHTML = `<div class="text-[10px] text-red-400">${err.message}</div>`;
                    }
                });
                card.appendChild(refreshBtn);

                if (item.meta && item.meta.devices && item.meta.devices.length > 0) {
                    renderDirigeraDevices(devicesWrap, item.id, item.meta.devices);
                }
                card.appendChild(devicesWrap);
            } else if (item.type === 'nuki') {
                const devicesWrap = document.createElement('div');
                devicesWrap.className = 'flex flex-col gap-1.5 pt-1';

                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer text-left';
                refreshBtn.textContent = '🔄 Schlösser aktualisieren';
                refreshBtn.addEventListener('click', async () => {
                    devicesWrap.innerHTML = '<div class="text-[10px] text-slate-500">Lade Schlösser...</div>';
                    try {
                        const res = await fetch(`${backendUrl}/admin/integrations/${item.id}/devices`, { credentials: 'include' });
                        const devices = await res.json();
                        if (!res.ok) throw new Error(devices.error || 'Schlösser konnten nicht geladen werden.');
                        renderNukiDevices(devicesWrap, item.id, devices);
                    } catch (err) {
                        devicesWrap.innerHTML = `<div class="text-[10px] text-red-400">${err.message}</div>`;
                    }
                });
                card.appendChild(refreshBtn);

                if (item.meta && item.meta.devices && item.meta.devices.length > 0) {
                    renderNukiDevices(devicesWrap, item.id, item.meta.devices);
                }
                card.appendChild(devicesWrap);
            } else if (item.type === 'sonos') {
                const testLabel = document.createElement('div');
                testLabel.className = 'text-[10px] font-semibold text-slate-400 uppercase tracking-wider pt-1';
                testLabel.textContent = 'Test';
                card.appendChild(testLabel);

                const statusLine = document.createElement('div');
                statusLine.className = 'text-[10px] text-slate-500 min-h-[14px]';
                card.appendChild(statusLine);

                const sendControl = async (body) => {
                    statusLine.textContent = 'Sende Befehl...';
                    statusLine.className = 'text-[10px] text-slate-400 min-h-[14px]';
                    try {
                        const res = await fetch(`${backendUrl}/admin/integrations/${item.id}/sonos-control`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(body)
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Befehl fehlgeschlagen.');
                        statusLine.textContent = '✓ Befehl gesendet.';
                        statusLine.className = 'text-[10px] text-emerald-400 min-h-[14px]';
                    } catch (err) {
                        statusLine.textContent = '✗ ' + err.message;
                        statusLine.className = 'text-[10px] text-red-400 min-h-[14px]';
                    }
                };

                const controls = document.createElement('div');
                controls.className = 'flex flex-wrap gap-1.5';
                [['⏮️ Zurück', 'Previous'], ['▶️ Play', 'Play'], ['⏸️ Pause', 'Pause'], ['⏭️ Weiter', 'Next']].forEach(([label, action]) => {
                    const btn = document.createElement('button');
                    btn.className = 'px-2.5 py-1.5 rounded-lg text-[11px] bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer transition';
                    btn.textContent = label;
                    btn.addEventListener('click', () => sendControl({ action }));
                    controls.appendChild(btn);
                });
                card.appendChild(controls);

                const volRow = document.createElement('div');
                volRow.className = 'flex items-center gap-2 pt-1';
                volRow.innerHTML = '<span class="text-[10px] text-slate-500 shrink-0">🔊 Lautstärke</span>';
                const volSlider = document.createElement('input');
                volSlider.type = 'range';
                volSlider.min = '0';
                volSlider.max = '100';
                volSlider.value = '30';
                volSlider.className = 'flex-1 cursor-pointer';
                volSlider.addEventListener('change', () => sendControl({ action: 'SetVolume', volume: parseInt(volSlider.value, 10) }));
                volRow.appendChild(volSlider);
                card.appendChild(volRow);

                const hint = document.createElement('div');
                hint.className = 'text-[10px] text-slate-500 pt-0.5';
                hint.textContent = `Im Chat z.B.: "${item.name} Musik pausieren" oder "spiele Jazz auf ${item.name}"`;
                card.appendChild(hint);
            } else if (item.meta && item.meta.commands) {
                const cmdList = document.createElement('div');
                cmdList.className = 'text-[10px] text-slate-500';
                cmdList.textContent = item.meta.commands.length > 0
                    ? `Befehle: ${item.meta.commands.map(c => `"${c.trigger}"`).join(', ')}`
                    : 'Keine Befehle konfiguriert.';
                card.appendChild(cmdList);
            }

            container.appendChild(card);
        });
    }

    function renderNukiDevices(container, integrationId, devices) {
        container.innerHTML = '';
        if (!devices || devices.length === 0) {
            container.innerHTML = '<div class="text-[10px] text-slate-500">Keine Schlösser gefunden.</div>';
            return;
        }
        devices.forEach(device => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between text-[10px] text-slate-300 bg-slate-900 rounded-lg px-2 py-1';
            const label = document.createElement('span');
            label.textContent = `${device.name}${device.state ? ` (${device.state})` : ''}`;
            row.appendChild(label);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'flex gap-1';
            const control = async (action) => {
                try {
                    await fetch(`${backendUrl}/admin/integrations/${integrationId}/devices/${device.id}/control?deviceType=${device.deviceType || 0}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ action })
                    });
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            };
            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'px-2 py-0.5 rounded-full text-[9px] cursor-pointer bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30';
            unlockBtn.textContent = '🔓 Auf';
            unlockBtn.addEventListener('click', () => control('unlock'));
            const lockBtn = document.createElement('button');
            lockBtn.className = 'px-2 py-0.5 rounded-full text-[9px] cursor-pointer bg-slate-700 text-slate-300 hover:bg-slate-600';
            lockBtn.textContent = '🔒 Zu';
            lockBtn.addEventListener('click', () => control('lock'));
            btnGroup.appendChild(unlockBtn);
            btnGroup.appendChild(lockBtn);
            row.appendChild(btnGroup);
            container.appendChild(row);
        });
    }

    function renderDirigeraDevices(container, integrationId, devices) {
        container.innerHTML = '';
        if (!devices || devices.length === 0) {
            container.innerHTML = '<div class="text-[10px] text-slate-500">Keine Geräte gefunden.</div>';
            return;
        }
        devices.forEach(device => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between text-[10px] text-slate-300 bg-slate-900 rounded-lg px-2 py-1';
            row.innerHTML = `<span>${device.name}</span>`;

            const isBlind = /blind/i.test(device.type || '');

            if (isBlind) {
                const btnGroup = document.createElement('div');
                btnGroup.className = 'flex gap-1';
                const controlBlind = async (level) => {
                    try {
                        await fetch(`${backendUrl}/admin/integrations/${integrationId}/devices/${device.id}/control`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ attribute: 'blindsTargetLevel', value: level })
                        });
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                };
                const upBtn = document.createElement('button');
                upBtn.className = 'px-2 py-0.5 rounded-full text-[9px] cursor-pointer bg-slate-700 text-slate-300 hover:bg-slate-600';
                upBtn.textContent = '⬆️ Auf';
                upBtn.addEventListener('click', () => controlBlind(0));
                const downBtn = document.createElement('button');
                downBtn.className = 'px-2 py-0.5 rounded-full text-[9px] cursor-pointer bg-slate-700 text-slate-300 hover:bg-slate-600';
                downBtn.textContent = '⬇️ Zu';
                downBtn.addEventListener('click', () => controlBlind(100));
                btnGroup.appendChild(upBtn);
                btnGroup.appendChild(downBtn);
                row.appendChild(btnGroup);
                container.appendChild(row);
                return;
            }

            const toggleBtn = document.createElement('button');
            toggleBtn.className = `px-2 py-0.5 rounded-full text-[9px] cursor-pointer ${device.isOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`;
            toggleBtn.textContent = device.isOn ? 'AN' : 'AUS';
            toggleBtn.addEventListener('click', async () => {
                try {
                    await fetch(`${backendUrl}/admin/integrations/${integrationId}/devices/${device.id}/control`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ attribute: 'isOn', value: !device.isOn })
                    });
                    device.isOn = !device.isOn;
                    toggleBtn.textContent = device.isOn ? 'AN' : 'AUS';
                    toggleBtn.className = `px-2 py-0.5 rounded-full text-[9px] cursor-pointer ${device.isOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`;
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            row.appendChild(toggleBtn);
            container.appendChild(row);
        });
    }

    if (dirigeraPairBtn) {
        dirigeraPairBtn.addEventListener('click', async () => {
            const ip = dirigeraIpInput ? dirigeraIpInput.value.trim() : '';
            if (!ip) return;
            if (dirigeraPairStatus) {
                dirigeraPairStatus.textContent = '⏳ Warte auf Knopfdruck am Hub (bis zu 90 Sekunden)...';
                dirigeraPairStatus.className = 'text-[11px] text-slate-400';
                dirigeraPairStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/integrations/dirigera/pair`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ ip })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Kopplung fehlgeschlagen.');
                if (dirigeraPairStatus) {
                    dirigeraPairStatus.textContent = '✓ Erfolgreich gekoppelt!';
                    dirigeraPairStatus.className = 'text-[11px] text-emerald-400';
                }
                if (dirigeraIpInput) dirigeraIpInput.value = '';
                loadIntegrations();
            } catch (err) {
                if (dirigeraPairStatus) {
                    dirigeraPairStatus.textContent = '✗ ' + err.message;
                    dirigeraPairStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    async function loadLocalMediaBaseUrl() {
        if (!localMediaBaseUrlInput) return;
        try {
            const res = await fetch(`${backendUrl}/config-global/local_media_base_url`, { credentials: 'include' });
            const data = await res.json();
            localMediaBaseUrlInput.value = data.value || '';
        } catch (err) { /* still leer lassen, nicht kritisch */ }
    }

    if (localMediaBaseUrlSaveBtn) {
        localMediaBaseUrlSaveBtn.addEventListener('click', async () => {
            try {
                await saveGlobalConfigToDBOrThrow('local_media_base_url', localMediaBaseUrlInput.value.trim());
                if (localMediaBaseUrlStatus) {
                    localMediaBaseUrlStatus.textContent = '✓ Gespeichert.';
                    localMediaBaseUrlStatus.className = 'text-[11px] text-emerald-400';
                    localMediaBaseUrlStatus.classList.remove('hidden');
                }
            } catch (err) {
                if (localMediaBaseUrlStatus) {
                    localMediaBaseUrlStatus.textContent = '✗ ' + err.message;
                    localMediaBaseUrlStatus.className = 'text-[11px] text-red-400';
                    localMediaBaseUrlStatus.classList.remove('hidden');
                }
            }
        });
    }

    const auraplanUrlInput = document.getElementById('auraplan-url-input');
    const auraplanServiceKeyInput = document.getElementById('auraplan-service-key-input');
    const auraplanUrlSaveBtn = document.getElementById('auraplan-url-save-btn');
    const auraplanUrlStatus = document.getElementById('auraplan-url-status');
    const menuItemAuraplan = document.getElementById('menu-item-auraplan');

    if (auraplanUrlInput) auraplanUrlInput.value = appConfig.auraplan_url || '';
    if (auraplanServiceKeyInput) auraplanServiceKeyInput.value = appConfig.auraplan_service_key || '';

    function applyAuraplanMenuLink() {
        if (!menuItemAuraplan) return;
        if (appConfig.auraplan_url) {
            menuItemAuraplan.href = appConfig.auraplan_url;
            menuItemAuraplan.classList.remove('hidden');
        } else {
            menuItemAuraplan.classList.add('hidden');
        }
    }
    applyAuraplanMenuLink();

    if (auraplanUrlSaveBtn) {
        auraplanUrlSaveBtn.addEventListener('click', async () => {
            try {
                const value = auraplanUrlInput.value.trim();
                const serviceKeyValue = auraplanServiceKeyInput ? auraplanServiceKeyInput.value.trim() : '';
                await saveGlobalConfigToDBOrThrow('auraplan_url', value);
                if (serviceKeyValue) await saveGlobalConfigToDBOrThrow('auraplan_service_key', serviceKeyValue);
                appConfig.auraplan_url = value;
                if (serviceKeyValue) appConfig.auraplan_service_key = serviceKeyValue;
                applyAuraplanMenuLink();
                if (auraplanUrlStatus) {
                    auraplanUrlStatus.textContent = '✓ Gespeichert.';
                    auraplanUrlStatus.className = 'text-[11px] text-emerald-400';
                    auraplanUrlStatus.classList.remove('hidden');
                }
            } catch (err) {
                if (auraplanUrlStatus) {
                    auraplanUrlStatus.textContent = '✗ ' + err.message;
                    auraplanUrlStatus.className = 'text-[11px] text-red-400';
                    auraplanUrlStatus.classList.remove('hidden');
                }
            }
        });
    }

    const auraticketUrlInput = document.getElementById('auraticket-url-input');
    const auraticketServiceKeyInput = document.getElementById('auraticket-service-key-input');
    const auraticketUrlSaveBtn = document.getElementById('auraticket-url-save-btn');
    const auraticketUrlStatus = document.getElementById('auraticket-url-status');
    const menuItemAuraticket = document.getElementById('menu-item-auraticket');

    if (auraticketUrlInput) auraticketUrlInput.value = appConfig.auraticket_url || '';
    if (auraticketServiceKeyInput) auraticketServiceKeyInput.value = appConfig.auraticket_service_key || '';

    function applyAuraticketMenuLink() {
        if (!menuItemAuraticket) return;
        if (appConfig.auraticket_url) {
            menuItemAuraticket.href = appConfig.auraticket_url;
            menuItemAuraticket.classList.remove('hidden');
        } else {
            menuItemAuraticket.classList.add('hidden');
        }
    }
    applyAuraticketMenuLink();

    if (auraticketUrlSaveBtn) {
        auraticketUrlSaveBtn.addEventListener('click', async () => {
            try {
                const value = auraticketUrlInput.value.trim();
                const serviceKeyValue = auraticketServiceKeyInput ? auraticketServiceKeyInput.value.trim() : '';
                await saveGlobalConfigToDBOrThrow('auraticket_url', value);
                if (serviceKeyValue) await saveGlobalConfigToDBOrThrow('auraticket_service_key', serviceKeyValue);
                appConfig.auraticket_url = value;
                if (serviceKeyValue) appConfig.auraticket_service_key = serviceKeyValue;
                applyAuraticketMenuLink();
                if (auraticketUrlStatus) {
                    auraticketUrlStatus.textContent = '✓ Gespeichert.';
                    auraticketUrlStatus.className = 'text-[11px] text-emerald-400';
                    auraticketUrlStatus.classList.remove('hidden');
                }
            } catch (err) {
                if (auraticketUrlStatus) {
                    auraticketUrlStatus.textContent = '✗ ' + err.message;
                    auraticketUrlStatus.className = 'text-[11px] text-red-400';
                    auraticketUrlStatus.classList.remove('hidden');
                }
            }
        });
    }

    // --- AuraCall (Telefon) ---
    const auracallUrlInput = document.getElementById('auracall-url-input');
    const auracallKeyInput = document.getElementById('auracall-service-key-input');
    const auracallEnabledBox = document.getElementById('auracall-chat-enabled');
    const auracallSaveBtn = document.getElementById('auracall-save-btn');
    const auracallTestBtn = document.getElementById('auracall-test-btn');
    const auracallStatus = document.getElementById('auracall-status');
    function showAuracallStatus(text, ok) { if (!auracallStatus) return; auracallStatus.textContent = text; auracallStatus.className = 'text-[11px] ' + (ok ? 'text-emerald-400' : 'text-red-400'); }
    if (auracallSaveBtn) auracallSaveBtn.addEventListener('click', async () => {
        try {
            const url = auracallUrlInput ? auracallUrlInput.value.trim() : '', key = auracallKeyInput ? auracallKeyInput.value.trim() : '';
            await saveGlobalConfigToDBOrThrow('auracall_url', url);
            if (key) await saveGlobalConfigToDBOrThrow('auracall_service_key', key);   // der Schlüssel wird nie wieder angezeigt (nur gesetzt oder ersetzt)
            await saveGlobalConfigToDBOrThrow('auracall_chat_enabled', auracallEnabledBox && auracallEnabledBox.checked ? 'true' : 'false');
            appConfig.auracall_url = url; appConfig.auracall_chat_enabled = auracallEnabledBox && auracallEnabledBox.checked ? 'true' : 'false';
            if (auracallKeyInput) auracallKeyInput.value = '';
            showAuracallStatus('✓ Gespeichert.', true);
        } catch (err) { showAuracallStatus('✗ ' + err.message, false); }
    });
    if (auracallTestBtn) auracallTestBtn.addEventListener('click', async () => {
        showAuracallStatus('Teste …', true);
        try {
            const res = await fetch(`${backendUrl}/admin/auracall/test`, { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Test fehlgeschlagen.');
            showAuracallStatus('✓ ' + data.message, true);
        } catch (err) { showAuracallStatus('✗ ' + err.message, false); }
    });

    const auramailUrlInput = document.getElementById('auramail-url-input');
    const auramailServiceKeyInput = document.getElementById('auramail-service-key-input');
    const auramailDefaultMailboxInput = document.getElementById('auramail-default-mailbox-input');
    const auramailUrlSaveBtn = document.getElementById('auramail-url-save-btn');
    const auramailUrlStatus = document.getElementById('auramail-url-status');

    // Gespeicherte Werte in die Felder übernehmen, SOBALD die globale Konfiguration vom Server geladen
    // ist (wird am Ende von loadGlobalConfig aufgerufen). Früher geschah das nur einmal beim Seitenstart -
    // da war appConfig noch leer, und die Felder blieben nach dem Neuladen leer, obwohl alles gespeichert war.
    function fillIntegrationFields() {
        if (auracallUrlInput) auracallUrlInput.value = appConfig.auracall_url || '';
        if (auracallEnabledBox) auracallEnabledBox.checked = appConfig.auracall_chat_enabled === 'true';
        if (auraplanUrlInput) auraplanUrlInput.value = appConfig.auraplan_url || '';
        if (auraplanServiceKeyInput) auraplanServiceKeyInput.value = appConfig.auraplan_service_key || '';
        if (auraticketUrlInput) auraticketUrlInput.value = appConfig.auraticket_url || '';
        if (auraticketServiceKeyInput) auraticketServiceKeyInput.value = appConfig.auraticket_service_key || '';
        if (auramailUrlInput) auramailUrlInput.value = appConfig.auramail_url || '';
        if (auramailServiceKeyInput) auramailServiceKeyInput.value = appConfig.auramail_service_key || '';
        if (auramailDefaultMailboxInput) auramailDefaultMailboxInput.value = appConfig.auramail_default_mailbox || '';
        if (apaleoGuestEnabledBox) apaleoGuestEnabledBox.checked = appConfig.apaleo_guest_enabled === 'true';
        if (typeof loadApaleoStatus === 'function') loadApaleoStatus();
        if (typeof loadApaleoWriteSettings === 'function') loadApaleoWriteSettings();
    }

    // --- Apaleo (Hotel-Verwaltungssystem), nur lesend ---
    const apaleoConnStatus = document.getElementById('apaleo-conn-status');
    const apaleoConnectHost = document.getElementById('apaleo-connect-host');
    const apaleoConnectBtn = document.getElementById('apaleo-connect-btn');
    const apaleoDisconnectBtn = document.getElementById('apaleo-disconnect-btn');
    const apaleoHousesBox = document.getElementById('apaleo-houses-box');
    const apaleoHouses = document.getElementById('apaleo-houses');
    const apaleoSaveBtn = document.getElementById('apaleo-save-btn');
    const apaleoTestBtn = document.getElementById('apaleo-test-btn');
    const apaleoStatus = document.getElementById('apaleo-status');
    const apaleoTestResult = document.getElementById('apaleo-test-result');

    function setApaleoStatus(text, cls) {
        if (!apaleoStatus) return;
        apaleoStatus.textContent = text;
        apaleoStatus.className = 'text-[11px] ' + cls;
    }
    async function loadApaleoStatus() {
        if (!apaleoConnStatus || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${backendUrl}/admin/apaleo/status`, { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();
            if (apaleoConnectHost) apaleoConnectHost.textContent = data.connectHost || '';
            const when = data.connectedAt ? new Date(data.connectedAt).toLocaleString('de-CH') : '';
            apaleoConnStatus.textContent = data.connected ? `✓ Mit Apaleo verbunden${when ? ' (seit ' + when + ')' : ''}.` : (data.error ? '✗ ' + data.error : 'Noch nicht mit Apaleo verbunden.');
            apaleoConnStatus.className = 'text-[11px] ' + (data.connected ? 'text-emerald-400' : (data.error ? 'text-red-400' : 'text-slate-300'));
            if (apaleoConnectBtn) apaleoConnectBtn.textContent = data.connected ? 'Neu verbinden' : 'Mit Apaleo verbinden';
            if (apaleoDisconnectBtn) apaleoDisconnectBtn.classList.toggle('hidden', !data.connected);
            if (apaleoHousesBox && apaleoHouses) {
                apaleoHouses.innerHTML = '';
                (data.properties || []).forEach(p => {
                    const label = document.createElement('label'); label.className = 'flex items-center gap-2 cursor-pointer text-[11px] text-slate-200';
                    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = p.id; cb.checked = !!p.selected; cb.className = 'w-4 h-4 accent-blue-600 cursor-pointer apaleo-house-cb';
                    const span = document.createElement('span'); span.textContent = p.name + (p.code && p.code !== p.name ? ` (${p.code})` : '');
                    label.appendChild(cb); label.appendChild(span); apaleoHouses.appendChild(label);
                });
                apaleoHousesBox.classList.toggle('hidden', !(data.properties || []).length);
            }
            if (data.connected && data.error) setApaleoStatus('✗ ' + data.error, 'text-red-400');
            apaleoLastConnected = !!data.connected;
            updateApaleoGuestCheck();
        } catch (err) { /* Anzeige bleibt wie sie ist */ }
    }
    // Admin: Warum erscheint bei Gästen (k)ein Anmelden mit Buchungsnummer? Zeigt alle vier Bedingungen auf einen Blick.
    let apaleoLastConnected = false;
    function updateApaleoGuestCheck() {
        if (!apaleoGuestCheck) return;
        const appEntry = (Array.isArray(appstoreApps) ? appstoreApps : []).find(a => a.id === 'apaleo');
        const appOn = appEntry ? !!appEntry.enabled : true;   // die Einrichtung ist nur bei aktivierter App sichtbar
        const items = [
            [appConfig.guest_chat_enabled === 'true', 'Gast-Chat eingeschaltet (Reiter „Benutzer“: „Gäste dürfen mit Aura chatten“)'],
            [!!appOn, 'Apaleo-App aktiviert'],
            [apaleoLastConnected, 'Mit Apaleo verbunden'],
            [!!(apaleoGuestEnabledBox && apaleoGuestEnabledBox.checked), 'Schalter oben für Gäste eingeschaltet'],
        ];
        apaleoGuestCheck.textContent = '';
        items.forEach(([ok, text]) => {
            const li = document.createElement('li');
            li.className = ok ? 'text-emerald-400' : 'text-amber-300';
            li.textContent = (ok ? '✓ ' : '✗ ') + text;
            apaleoGuestCheck.appendChild(li);
        });
        apaleoGuestCheck.classList.toggle('hidden', !(apaleoGuestEnabledBox && apaleoGuestEnabledBox.checked) && items.every(([ok]) => !ok));
    }
    if (apaleoConnectBtn) {
        apaleoConnectBtn.addEventListener('click', async () => {
            setApaleoStatus('Starte die Verbindung ...', 'text-slate-400');
            try {
                const res = await fetch(`${backendUrl}/admin/apaleo/connect`, { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.url) throw new Error(data.error || `Status ${res.status}`);
                window.location.href = data.url;   // zum Vermittler, dann zu Apaleo; zurück kommt man auf die Erfolgsseite
            } catch (err) { setApaleoStatus('✗ ' + err.message, 'text-red-400'); }
        });
    }
    if (apaleoDisconnectBtn) {
        apaleoDisconnectBtn.addEventListener('click', async () => {
            if (!window.confirm('Die Verbindung zu Apaleo trennen? AuraChat kann dann keine Hoteldaten mehr abfragen. Zum Beenden auch in Apaleo unter „Apps → Verbundene Apps“ trennen.')) return;
            try {
                const res = await fetch(`${backendUrl}/admin/apaleo/disconnect`, { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
                setApaleoStatus('✓ Getrennt.', 'text-emerald-400'); loadApaleoStatus();
            } catch (err) { setApaleoStatus('✗ ' + err.message, 'text-red-400'); }
        });
    }
    if (apaleoSaveBtn) {
        apaleoSaveBtn.addEventListener('click', async () => {
            const selected = [...document.querySelectorAll('.apaleo-house-cb')].filter(cb => cb.checked).map(cb => cb.value);
            if (!selected.length) { setApaleoStatus('✗ Bitte mindestens ein Haus auswählen.', 'text-red-400'); return; }
            setApaleoStatus('Speichere ...', 'text-slate-400');
            try {
                const res = await fetch(`${backendUrl}/admin/apaleo/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ selected }) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
                setApaleoStatus(`✓ Gespeichert (${selected.length} ${selected.length === 1 ? 'Haus' : 'Häuser'}). Mit „Verbindung testen“ prüfen.`, 'text-emerald-400');
            } catch (err) { setApaleoStatus('✗ ' + err.message, 'text-red-400'); }
        });
    }
    if (apaleoTestBtn) {
        apaleoTestBtn.addEventListener('click', async () => {
            setApaleoStatus('Teste (kann einige Sekunden dauern)...', 'text-slate-400');
            if (apaleoTestResult) { apaleoTestResult.textContent = ''; apaleoTestResult.classList.add('hidden'); }
            try {
                const res = await fetch(`${backendUrl}/admin/apaleo/test`, { method: 'POST', credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
                if (apaleoTestResult) {
                    apaleoTestResult.textContent = (data.steps || []).map(st => `${st.info ? 'ℹ' : (st.ok ? '✓' : '✗')} ${st.name}: ${st.detail}`).join('\n');
                    apaleoTestResult.classList.remove('hidden');
                }
                setApaleoStatus(data.ok ? '✓ Alles in Ordnung.' : '✗ Es gibt ein Problem - Einzelheiten unten.', data.ok ? 'text-emerald-400' : 'text-red-400');
            } catch (err) {
                setApaleoStatus('✗ ' + err.message, 'text-red-400');
            }
        });
    }

    const apaleoWriteBoxes = {
        apaleo_write_enabled: document.getElementById('apaleo-write-enabled'),
        apaleo_write_checkin: document.getElementById('apaleo-write-checkin'),
        apaleo_write_checkout: document.getElementById('apaleo-write-checkout'),
        apaleo_write_assign: document.getElementById('apaleo-write-assign'),
        apaleo_write_dirty: document.getElementById('apaleo-write-dirty'),
        // Housekeeping-Meldungen (gehören nicht zum Hauptschalter "Änderungen in Apaleo": sie legen Tickets in AuraTicket an)
        hk_staff_report_enabled: document.getElementById('hk-staff-report'),
        hk_guest_report_enabled: document.getElementById('hk-guest-report')
    };
    const apaleoAuditList = document.getElementById('apaleo-audit-list');
    const apaleoAuditRefresh = document.getElementById('apaleo-audit-refresh');
    function loadApaleoWriteSettings() {
        Object.entries(apaleoWriteBoxes).forEach(([key, box]) => { if (box) box.checked = appConfig[key] === 'true'; });
        updateApaleoWriteBoxes();
        loadApaleoAudit();
    }
    // Die drei Einzelschalter sind nur bedienbar, wenn der Hauptschalter an ist
    function updateApaleoWriteBoxes() {
        const master = apaleoWriteBoxes.apaleo_write_enabled;
        ['apaleo_write_checkin', 'apaleo_write_checkout', 'apaleo_write_assign', 'apaleo_write_dirty'].forEach(k => { const b = apaleoWriteBoxes[k]; if (b) b.disabled = !(master && master.checked); });
    }
    Object.entries(apaleoWriteBoxes).forEach(([key, box]) => {
        if (!box) return;
        box.addEventListener('change', async () => {
            appConfig[key] = box.checked ? 'true' : 'false';
            updateApaleoWriteBoxes();
            await saveGlobalConfigToDB(key, appConfig[key]);
            if (key === 'hk_staff_report_enabled' || key === 'hk_guest_report_enabled') {
                const who = key === 'hk_staff_report_enabled' ? 'Mitarbeitende dürfen' : 'Gäste dürfen für ihr eigenes Zimmer';
                const missing = box.checked && !appConfig.auraticket_url ? ' ACHTUNG: AuraTicket ist noch nicht verbunden (Reiter API → AuraTicket verbinden), ohne das kann nichts gemeldet werden.' : '';
                setApaleoStatus(box.checked ? `✓ ${who} jetzt Housekeeping melden (Ticket in AuraTicket).${missing}` : `✓ ${who === 'Mitarbeitende dürfen' ? 'Meldungen der Mitarbeitenden' : 'Meldungen der Gäste'} ausgeschaltet.`, missing ? 'text-amber-400' : (box.checked ? 'text-emerald-400' : 'text-emerald-400'));
            }
            if (key === 'apaleo_write_enabled') setApaleoStatus(box.checked ? '✓ Änderungen in Apaleo sind erlaubt (nur freigegebene Aktionen, nur mit Bestätigung, nur für Personen mit ✏️). Mit „Verbindung testen“ prüfen.' : '✓ Änderungen in Apaleo sind ausgeschaltet. AuraChat liest nur.', box.checked ? 'text-amber-400' : 'text-emerald-400');
        });
    });
    const apaleoActionLabels = { checkin: 'Check-in', checkout: 'Check-out', assign: 'Zimmer zuweisen', dirty: 'Zimmer als schmutzig markieren', hk_staff: 'Housekeeping-Meldung', hk_guest: 'Gast-Meldung' };
    const apaleoOutcomeLabels = { ok: '✓ ausgeführt', abgelehnt: '✗ abgelehnt', fehler: '✗ Fehler', unklar: '⚠ unklar' };
    // Alles als Text (nie als HTML): Benutzer- und Reservierungsangaben stammen nicht von uns
    async function loadApaleoAudit() {
        if (!apaleoAuditList || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${backendUrl}/admin/apaleo/audit`, { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
            apaleoAuditList.innerHTML = '';
            const entries = data.entries || [];
            if (!entries.length) { const e = document.createElement('div'); e.textContent = 'Noch keine Änderungen.'; apaleoAuditList.appendChild(e); return; }
            entries.forEach(en => {
                const row = document.createElement('div');
                row.className = en.outcome === 'ok' ? 'text-emerald-300/80' : 'text-amber-300/80';
                row.textContent = `${new Date(en.ts).toLocaleString('de-DE')} · ${en.username || '?'} · ${apaleoActionLabels[en.action] || en.action} · ${en.reservationId || '–'}${en.unit ? ' · Zi. ' + en.unit : ''} · ${apaleoOutcomeLabels[en.outcome] || en.outcome}`;
                if (en.detail) row.title = en.detail;
                apaleoAuditList.appendChild(row);
            });
        } catch (err) {
            apaleoAuditList.innerHTML = '';
            const e = document.createElement('div'); e.className = 'text-red-400'; e.textContent = 'Protokoll nicht lesbar: ' + err.message; apaleoAuditList.appendChild(e);
        }
    }
    if (apaleoAuditRefresh) apaleoAuditRefresh.addEventListener('click', loadApaleoAudit);

    const auramailTestBtn = document.getElementById('auramail-test-btn');
    if (auramailTestBtn) {
        auramailTestBtn.addEventListener('click', async () => {
            if (auramailUrlStatus) {
                auramailUrlStatus.textContent = 'Teste...';
                auramailUrlStatus.className = 'text-[11px] text-slate-400';
                auramailUrlStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/auramail/test`, { method: 'POST', credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Test fehlgeschlagen.');
                auramailUrlStatus.textContent = (data.senderOk ? '✓ ' : '⚠️ ') + data.message;
                auramailUrlStatus.className = 'text-[11px] ' + (data.senderOk ? 'text-emerald-400' : 'text-amber-400');
            } catch (err) {
                auramailUrlStatus.textContent = '✗ ' + err.message;
                auramailUrlStatus.className = 'text-[11px] text-red-400';
            }
        });
    }

    if (auramailUrlSaveBtn) {
        auramailUrlSaveBtn.addEventListener('click', async () => {
            const show = (text, ok) => {
                if (!auramailUrlStatus) return;
                auramailUrlStatus.textContent = text;
                auramailUrlStatus.className = 'text-[11px] ' + (ok ? 'text-emerald-400' : 'text-red-400');
                auramailUrlStatus.classList.remove('hidden');
            };
            try {
                const url = auramailUrlInput.value.trim();
                const key = auramailServiceKeyInput.value.trim();
                const mailbox = auramailDefaultMailboxInput.value.trim();
                // Häufige Verwechslung (Felder vertauscht) gleich abfangen
                if (url && !/^https?:\/\//i.test(url)) throw new Error('Die Adresse muss mit http:// oder https:// beginnen.');
                if (/^https?:\/\//i.test(key)) throw new Error('Das sieht nach einer Adresse aus, nicht nach einem Dienst-Schlüssel.');
                if (mailbox && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mailbox)) throw new Error('Der Standard-Absender sollte eine E-Mail-Adresse sein.');
                await saveGlobalConfigToDBOrThrow('auramail_url', url);
                await saveGlobalConfigToDBOrThrow('auramail_service_key', key);
                await saveGlobalConfigToDBOrThrow('auramail_default_mailbox', mailbox);
                show('✓ Gespeichert.', true);
            } catch (err) {
                show('✗ ' + err.message, false);
            }
        });
    }

    const auradirectUrlInput = document.getElementById('auradirect-url-input');
    const auradirectKeyInput = document.getElementById('auradirect-key-input');
    const auradirectSaveBtn = document.getElementById('auradirect-save-btn');
    const auradirectStatus = document.getElementById('auradirect-status');

    async function loadAuraDirectSettings() {
        if (!auradirectUrlInput) return;
        try {
            const res = await fetch(`${backendUrl}/admin/auradirect`, { credentials: 'include' });
            const data = await res.json();
            auradirectUrlInput.value = data.url || '';
            if (auradirectKeyInput) auradirectKeyInput.placeholder = data.hasServiceKey ? '•••••••• (bereits gesetzt, leer lassen = unverändert)' : 'Dienst-Schlüssel (wie in AuraDirect)';
        } catch { /* nicht kritisch */ }
    }

    if (auradirectSaveBtn) {
        auradirectSaveBtn.addEventListener('click', async () => {
            try {
                const res = await fetch(`${backendUrl}/admin/auradirect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ url: auradirectUrlInput.value.trim(), serviceKey: auradirectKeyInput.value.trim() })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Speichern fehlgeschlagen.');
                auradirectKeyInput.value = '';
                if (auradirectStatus) {
                    auradirectStatus.textContent = '✓ Gespeichert.';
                    auradirectStatus.className = 'text-[11px] text-emerald-400';
                    auradirectStatus.classList.remove('hidden');
                }
                loadAuraDirectSettings();
            } catch (err) {
                if (auradirectStatus) {
                    auradirectStatus.textContent = '✗ ' + err.message;
                    auradirectStatus.className = 'text-[11px] text-red-400';
                    auradirectStatus.classList.remove('hidden');
                }
            }
        });
    }

    if (sonosAddBtn) {
        sonosAddBtn.addEventListener('click', async () => {
            const name = sonosNameInput ? sonosNameInput.value.trim() : '';
            const ip = sonosIpInput ? sonosIpInput.value.trim() : '';
            if (!name || !ip) return;
            if (sonosAddStatus) {
                sonosAddStatus.textContent = 'Prüfe Verbindung...';
                sonosAddStatus.className = 'text-[11px] text-slate-400';
                sonosAddStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/integrations/sonos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, ip })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Hinzufügen fehlgeschlagen.');
                if (sonosAddStatus) {
                    sonosAddStatus.textContent = '✓ Hinzugefügt!';
                    sonosAddStatus.className = 'text-[11px] text-emerald-400';
                }
                if (sonosNameInput) sonosNameInput.value = '';
                if (sonosIpInput) sonosIpInput.value = '';
                loadIntegrations();
            } catch (err) {
                if (sonosAddStatus) {
                    sonosAddStatus.textContent = '✗ ' + err.message;
                    sonosAddStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (nukiAddBtn) {
        nukiAddBtn.addEventListener('click', async () => {
            const name = nukiNameInput ? nukiNameInput.value.trim() : '';
            const ip = nukiIpInput ? nukiIpInput.value.trim() : '';
            const token = nukiTokenInput ? nukiTokenInput.value.trim() : '';
            if (!name || !ip || !token) return;
            if (nukiAddStatus) {
                nukiAddStatus.textContent = 'Prüfe Verbindung...';
                nukiAddStatus.className = 'text-[11px] text-slate-400';
                nukiAddStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/integrations/nuki`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, ip, token })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Hinzufügen fehlgeschlagen.');
                if (nukiAddStatus) {
                    nukiAddStatus.textContent = '✓ Hinzugefügt!';
                    nukiAddStatus.className = 'text-[11px] text-emerald-400';
                }
                if (nukiNameInput) nukiNameInput.value = '';
                if (nukiIpInput) nukiIpInput.value = '';
                if (nukiTokenInput) nukiTokenInput.value = '';
                loadIntegrations();
            } catch (err) {
                if (nukiAddStatus) {
                    nukiAddStatus.textContent = '✗ ' + err.message;
                    nukiAddStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // --- Eigene Anwendung: Befehls-Zeilen dynamisch hinzufügen/entfernen ---
    function addCustomCommandRow(prefill) {
        if (!customIntCommands) return;
        const row = document.createElement('div');
        row.className = 'grid grid-cols-2 gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-2';
        row.innerHTML = `
            <input type="text" placeholder="Auslöse-Satz, z.B. 'Heizung an'" class="cmd-trigger col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500" value="${prefill && prefill.trigger ? prefill.trigger : ''}">
            <select class="cmd-method bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white">
                <option value="GET" ${prefill && prefill.method === 'GET' ? 'selected' : ''}>GET</option>
                <option value="POST" ${!prefill || prefill.method === 'POST' ? 'selected' : ''}>POST</option>
                <option value="PUT" ${prefill && prefill.method === 'PUT' ? 'selected' : ''}>PUT</option>
                <option value="PATCH" ${prefill && prefill.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
            </select>
            <input type="text" placeholder="Pfad, z.B. /heizung/an" class="cmd-path bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500" value="${prefill && prefill.path ? prefill.path : ''}">
            <input type="text" placeholder="Body (optional, JSON)" class="cmd-body col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500" value="${prefill && prefill.body ? prefill.body : ''}">
            <input type="text" placeholder="Bestätigungstext, z.B. 'Heizung eingeschaltet.'" class="cmd-success col-span-2 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500" value="${prefill && prefill.successMessage ? prefill.successMessage : ''}">
            <button type="button" class="cmd-remove-btn col-span-2 text-[10px] text-red-400 hover:text-red-300 cursor-pointer text-left">🗑️ Befehl entfernen</button>
        `;
        row.querySelector('.cmd-remove-btn').addEventListener('click', () => row.remove());
        customIntCommands.appendChild(row);
    }

    if (customIntAddCommandBtn) customIntAddCommandBtn.addEventListener('click', () => addCustomCommandRow());

    if (customIntSaveBtn) {
        customIntSaveBtn.addEventListener('click', async () => {
            const name = customIntName ? customIntName.value.trim() : '';
            const baseUrl = customIntUrl ? customIntUrl.value.trim() : '';
            if (!name || !baseUrl) return;

            const commands = customIntCommands ? Array.from(customIntCommands.children).map(row => ({
                trigger: row.querySelector('.cmd-trigger').value.trim(),
                method: row.querySelector('.cmd-method').value,
                path: row.querySelector('.cmd-path').value.trim(),
                body: row.querySelector('.cmd-body').value.trim(),
                successMessage: row.querySelector('.cmd-success').value.trim()
            })).filter(c => c.trigger) : [];

            if (customIntStatus) {
                customIntStatus.textContent = 'Speichere...';
                customIntStatus.className = 'text-[11px] text-slate-400';
                customIntStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/integrations/custom`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        name, baseUrl,
                        authHeader: customIntAuthHeader ? customIntAuthHeader.value.trim() : '',
                        authValue: customIntAuthValue ? customIntAuthValue.value.trim() : '',
                        commands
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');

                if (customIntStatus) {
                    customIntStatus.textContent = '✓ Integration gespeichert.';
                    customIntStatus.className = 'text-[11px] text-emerald-400';
                }
                [customIntName, customIntUrl, customIntAuthHeader, customIntAuthValue].forEach(el => { if (el) el.value = ''; });
                if (customIntCommands) customIntCommands.innerHTML = '';
                loadIntegrations();
            } catch (err) {
                if (customIntStatus) {
                    customIntStatus.textContent = '✗ ' + err.message;
                    customIntStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // --- ERINNERUNGEN (kostenlos) ---
    // Läuft rein im Browser (setTimeout + Browser-Benachrichtigung) - kein Server nötig,
    // funktioniert aber nur, solange der Tab/das Browserfenster offen bleibt.

    function extractReminderRequest(text) {
        const match = text.match(/erinnere\s+mich\s+in\s+(\d+)\s*(minuten?|stunden?)\s+(?:daran,?\s*dass\s+|an\s+)(.+)$/i);
        if (!match) return null;
        const amount = parseInt(match[1], 10);
        const unitRaw = match[2].toLowerCase();
        const message = match[3].trim().replace(/[.!]+$/, '');
        const isHours = unitRaw.startsWith('stund');
        return { delayMs: isHours ? amount * 3600000 : amount * 60000, message, amount, unitLabel: isHours ? (amount === 1 ? 'Stunde' : 'Stunden') : (amount === 1 ? 'Minute' : 'Minuten') };
    }

    let reminders = [];

    function saveReminders() {
        localStorage.setItem('aurachat_reminders', JSON.stringify(reminders));
    }

    function fireReminder(reminder) {
        const body = reminder.message;
        if (window.Notification && Notification.permission === 'granted') {
            new Notification('AuraChat Erinnerung', { body, icon: '/api/branding/icon' });
        }
        appendMessageToDOM(`⏰ Erinnerung: ${body}`, 'assistant');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        setAvatarSpeaking(true);
        if (speechEnabled) speakText(`Erinnerung: ${body}`, () => setAvatarSpeaking(false), '');
        else setTimeout(() => setAvatarSpeaking(false), 2000);
        reminders = reminders.filter(r => r.id !== reminder.id);
        saveReminders();
    }

    function scheduleReminder(reminder) {
        const delay = reminder.fireAt - Date.now();
        if (delay <= 0) {
            fireReminder(reminder);
            return;
        }
        setTimeout(() => fireReminder(reminder), delay);
    }

    function loadReminders() {
        try {
            reminders = JSON.parse(localStorage.getItem('aurachat_reminders') || '[]');
        } catch (err) {
            reminders = [];
        }
        const now = Date.now();
        reminders = reminders.filter(r => r.fireAt - now < 5 * 60000 || r.fireAt > now); // zu alte (>5min überfällig) verwerfen
        reminders.forEach(scheduleReminder);
        saveReminders();
    }
    loadReminders();

    // --- PDF AUF ZURUF (kostenlos) ---

    function extractPdfRequest(text) {
        const lower = text.toLowerCase();
        if (!/\bpdf\b/.test(lower)) return null;
        if (!/(erstell|generier|erzeug|\bmach)/i.test(lower)) return null;

        // Bevorzugt: expliziter Inhalt nach "mit dem Text"/"mit folgendem Inhalt"/Doppelpunkt.
        // Bewusst nur bei klar erkennbarem Inhalt auslösen - lieber nichts tun als raten.
        let match = text.match(/mit\s+(?:dem\s+|folgendem\s+)?(?:text|inhalt)\s*:?\s*(.+)$/is);
        if (match && match[1].trim().length > 2) return match[1].trim();

        match = text.match(/pdf[^:]*:\s*(.+)$/is);
        if (match && match[1].trim().length > 2) return match[1].trim();

        return null;
    }

    // --- BILDGENERIERUNG (Premium) ---

    function extractImagePrompt(text) {
        const patterns = [
            /^(?:generiere|erstelle|zeichne|male)(?:\s+mir)?\s+(?:ein\s+bild\s+(?:von|mit)\s+)?(.+)$/i,
            /^(?:generate|draw|create)\s+(?:an?\s+image\s+of\s+)?(.+)$/i
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m && m[1] && m[1].trim().length > 1) return m[1].trim();
        }
        return null;
    }

    // Ruft den eigenen Bildgenerierungs-Server direkt an (wie bei der KI-Anbindung,
    // kein Umweg übers Backend). Kann je nach Server/Auflösung 10-60+ Sekunden dauern.
    // Läuft jetzt übers Backend (nicht mehr direkter Browser-Aufruf) - nötig, damit
    // Cloud-API-Keys (OpenAI/Stability) niemals im Browser landen, und einheitlich für
    // alle drei Plattformen (eigener Server/OpenAI/Stability).
    async function tryGenerateImage(text) {
        if (!licenseFeatures.includes('image_gen') || !appConfig.image_gen_platform || appConfig.image_gen_platform === 'none') return null;
        const prompt = extractImagePrompt(text);
        if (!prompt) return null;

        const res = await fetch(`${backendUrl}/image-gen/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
        if (!data.image) throw new Error('Keine Bilddaten erhalten.');
        return { prompt, image: data.image };
    }

    // Prüft eine Chat-Nachricht auf einen passenden Integrations-Befehl (serverseitig,
    // da Zugangsdaten dort bleiben müssen). Gibt null zurück, wenn nichts passt/Fehler.
    let pendingIntegrationConfirm = null;   // Bestätigung zur letzten Integrations-Antwort (z.B. Apaleo Check-in), sonst null
    async function tryMatchIntegration(message) {
        pendingIntegrationConfirm = null;
        try {
            const res = await fetch(`${backendUrl}/integrations/chat-match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message })
            });
            const data = await res.json();
            if (data.matched && data.confirm && data.confirm.token) pendingIntegrationConfirm = data.confirm;
            return data.matched ? data.response : null;
        } catch (err) {
            return null;
        }
    }

    // Knöpfe "Ausführen" / "Abbrechen" unter einem Vorschlag (z.B. Apaleo Check-in). Geändert wird erst nach "Ausführen"; der Code
    // gilt wenige Minuten, einmalig. Alle Texte als Text, nie als HTML.
    let activeConfirmRow = null;
    function clearConfirmRow() { if (activeConfirmRow && activeConfirmRow.parentNode) activeConfirmRow.parentNode.removeChild(activeConfirmRow); activeConfirmRow = null; }
    async function appendAssistantResult(text) {
        appendMessageToDOM(text, 'assistant');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        const currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat) { currentChat.messages.push({ text, sender: 'assistant' }); await saveChatToBackend(currentChat); }
    }
    function renderConfirmButtons(bubble, confirm) {
        clearConfirmRow();
        if (!bubble || !confirm || !confirm.token) return null;
        const row = document.createElement('div');
        row.className = 'flex flex-wrap items-center gap-2 mt-3';
        const okBtn = document.createElement('button');
        okBtn.className = 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition cursor-pointer';
        okBtn.textContent = '✅ Ausführen';
        okBtn.title = confirm.label || '';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bg-slate-800 hover:bg-slate-600 border border-slate-600 text-slate-200 font-medium px-3 py-1.5 rounded-lg text-xs transition cursor-pointer';
        cancelBtn.textContent = '✖ Abbrechen';
        const note = document.createElement('span');
        note.className = 'text-[11px] text-slate-400';
        row.appendChild(okBtn); row.appendChild(cancelBtn); row.appendChild(note);
        bubble.appendChild(row);
        activeConfirmRow = row;
        let finished = false;
        const finish = (text) => { finished = true; clearTimeout(expiry); okBtn.remove(); cancelBtn.remove(); note.textContent = text; };
        const expiry = setTimeout(() => { if (!finished) finish('⏱ Abgelaufen. Es wurde nichts geändert. Bitte den Befehl noch einmal geben.'); }, (Number(confirm.expiresInSec) || 120) * 1000);
        okBtn.addEventListener('click', async () => {
            if (finished) return;
            finished = true; clearTimeout(expiry);
            okBtn.disabled = true; cancelBtn.disabled = true; note.textContent = 'Führe aus…';
            let message;
            try {
                const res = await fetch(`${backendUrl}/apaleo/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ token: confirm.token }) });
                const data = await res.json().catch(() => ({}));
                message = data.message || (res.ok ? 'Fertig.' : `Fehler (Status ${res.status}). Bitte in Apaleo nachsehen, ob etwas geändert wurde.`);
            } catch (err) {
                message = 'Der Server hat nicht geantwortet (' + err.message + '). Bitte in Apaleo nachsehen, ob etwas geändert wurde.';
            }
            okBtn.remove(); cancelBtn.remove(); note.textContent = '';
            if (activeConfirmRow === row) activeConfirmRow = null;
            await appendAssistantResult(message);
        });
        cancelBtn.addEventListener('click', async () => {
            if (finished) return;
            finish('Abgebrochen. Es wurde nichts geändert.');
            try { await fetch(`${backendUrl}/apaleo/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ token: confirm.token }) }); } catch (err) { /* Vorschlag läuft von selbst ab */ }
        });
        return row;
    }

    // --- ADMIN PANEL: 2FA ---

    async function loadAdmin2faConfig() {
        try {
            const res = await fetch(`${backendUrl}/admin/security`, { credentials: 'include' });
            const data = await res.json();
            if (admin2faToggle) admin2faToggle.checked = !!data.twoFactorRequired;
        } catch (err) {
            console.error('2FA-Konfiguration Ladefehler:', err);
        }
    }

    if (admin2faToggle) {
        admin2faToggle.addEventListener('change', async () => {
            const enabled = admin2faToggle.checked;
            if (admin2faStatus) {
                admin2faStatus.textContent = 'Speichere...';
                admin2faStatus.className = 'text-[11px] text-slate-400';
                admin2faStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/security`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ twoFactorRequired: enabled })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                if (admin2faStatus) {
                    admin2faStatus.textContent = enabled
                        ? '✓ 2FA ist jetzt Pflicht. Alle Benutzer richten es beim nächsten Login ein.'
                        : '✓ 2FA ist jetzt deaktiviert.';
                    admin2faStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                admin2faToggle.checked = !enabled; // zurücksetzen bei Fehler
                if (admin2faStatus) {
                    admin2faStatus.textContent = '✗ ' + err.message;
                    admin2faStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // --- ADMIN PANEL: MAILSERVER ---

    async function loadAdminMailConfig() {
        if (adminMailSaveStatus) adminMailSaveStatus.classList.add('hidden');
        try {
            const res = await fetch(`${backendUrl}/admin/mail-config`, { credentials: 'include' });
            const cfg = await res.json();
            if (!res.ok) throw new Error(cfg.error || 'Konnte Mail-Konfiguration nicht laden.');

            if (adminMailHost) adminMailHost.value = cfg.host || '';
            if (adminMailPort) adminMailPort.value = cfg.port || '587';
            if (adminMailSecure) adminMailSecure.checked = !!cfg.secure;
            if (adminMailUser) adminMailUser.value = cfg.user || '';
            if (adminMailFrom) adminMailFrom.value = cfg.from || '';
            if (adminMailPass) adminMailPass.placeholder = cfg.hasPassword ? 'Leer lassen = aktuelles Passwort behalten' : 'Passwort eingeben';
        } catch (err) {
            console.error('Mail-Konfiguration Ladefehler:', err);
        }
    }

    if (adminMailSaveBtn) {
        adminMailSaveBtn.addEventListener('click', async () => {
            if (adminMailSaveStatus) {
                adminMailSaveStatus.textContent = 'Speichere...';
                adminMailSaveStatus.className = 'text-[11px] text-slate-400';
                adminMailSaveStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/mail-config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        host: adminMailHost ? adminMailHost.value.trim() : '',
                        port: adminMailPort ? adminMailPort.value.trim() : '587',
                        secure: adminMailSecure ? adminMailSecure.checked : false,
                        user: adminMailUser ? adminMailUser.value.trim() : '',
                        pass: adminMailPass ? adminMailPass.value : '',
                        from: adminMailFrom ? adminMailFrom.value.trim() : ''
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');

                if (adminMailSaveStatus) {
                    adminMailSaveStatus.textContent = '✓ Gespeichert.';
                    adminMailSaveStatus.className = 'text-[11px] text-emerald-400';
                }
                if (adminMailPass) adminMailPass.value = '';
                loadAdminMailConfig();
            } catch (err) {
                if (adminMailSaveStatus) {
                    adminMailSaveStatus.textContent = '✗ ' + err.message;
                    adminMailSaveStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (adminMailTestBtn) {
        adminMailTestBtn.addEventListener('click', async () => {
            const to = adminMailTestTo ? adminMailTestTo.value.trim() : '';
            if (!to) return;
            if (adminMailTestStatus) {
                adminMailTestStatus.textContent = 'Sende Test-Mail...';
                adminMailTestStatus.className = 'text-[11px] text-slate-400';
                adminMailTestStatus.classList.remove('hidden');
            }
            try {
                const res = await fetch(`${backendUrl}/admin/mail-config/test`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ to })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Test-Mail konnte nicht verschickt werden.');

                if (adminMailTestStatus) {
                    adminMailTestStatus.textContent = `✓ Test-Mail an ${to} verschickt.`;
                    adminMailTestStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (adminMailTestStatus) {
                    adminMailTestStatus.textContent = '✗ ' + err.message;
                    adminMailTestStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    // Neue Benutzer werden nicht mehr hier angelegt: das geschieht zentral in AuraDirect (kostenlos). Hier erscheinen sie nach ihrer ersten Anmeldung.

    // --- REBRANDING (Premium "rebrand") ---

    function refreshBrandingPreviews() {
        // Cache-Buster, sonst zeigt der Browser nach einem Upload weiter das alte Bild
        const stamp = Date.now();
        if (brandingLogoPreview) brandingLogoPreview.src = `/api/branding/logo?t=${stamp}`;
        if (brandingIconPreview) brandingIconPreview.src = `/api/branding/icon?t=${stamp}`;
    }

    async function uploadBranding(type, file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${backendUrl}/admin/branding/${type}`, { method: 'POST', credentials: 'include', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Hochladen fehlgeschlagen.');
    }

    if (brandingLogoUploadBtn) {
        brandingLogoUploadBtn.addEventListener('click', async () => {
            const file = brandingLogoFile ? brandingLogoFile.files[0] : null;
            if (!file) return alert('Bitte zuerst eine Datei auswählen.');
            try {
                await uploadBranding('logo', file);
                refreshBrandingPreviews();
                if (brandingStatus) { brandingStatus.textContent = '✓ Logo aktualisiert.'; brandingStatus.className = 'text-[11px] text-emerald-400'; brandingStatus.classList.remove('hidden'); }
            } catch (err) {
                if (brandingStatus) { brandingStatus.textContent = '✗ ' + err.message; brandingStatus.className = 'text-[11px] text-red-400'; brandingStatus.classList.remove('hidden'); }
            }
        });
    }

    if (brandingIconUploadBtn) {
        brandingIconUploadBtn.addEventListener('click', async () => {
            const file = brandingIconFile ? brandingIconFile.files[0] : null;
            if (!file) return alert('Bitte zuerst eine Datei auswählen.');
            try {
                await uploadBranding('icon', file);
                refreshBrandingPreviews();
                if (brandingStatus) { brandingStatus.textContent = '✓ Icon aktualisiert.'; brandingStatus.className = 'text-[11px] text-emerald-400'; brandingStatus.classList.remove('hidden'); }
            } catch (err) {
                if (brandingStatus) { brandingStatus.textContent = '✗ ' + err.message; brandingStatus.className = 'text-[11px] text-red-400'; brandingStatus.classList.remove('hidden'); }
            }
        });
    }

    if (brandingLogoResetBtn) {
        brandingLogoResetBtn.addEventListener('click', async () => {
            if (!confirm('Eigenes Logo entfernen und zum AuraChat-Standard zurückkehren?')) return;
            await fetch(`${backendUrl}/admin/branding/logo`, { method: 'DELETE', credentials: 'include' });
            refreshBrandingPreviews();
        });
    }

    if (brandingIconResetBtn) {
        brandingIconResetBtn.addEventListener('click', async () => {
            if (!confirm('Eigenes Icon entfernen und zum AuraChat-Standard zurückkehren?')) return;
            await fetch(`${backendUrl}/admin/branding/icon`, { method: 'DELETE', credentials: 'include' });
            refreshBrandingPreviews();
        });
    }

    // --- ADMIN PANEL: BENUTZERVERWALTUNG ---

    async function loadAdminUserLimitDisplay() {
        if (!adminUserLimitDisplay) return;
        try {
            const res = await fetch(`${backendUrl}/admin/license`, { credentials: 'include' });
            const info = await res.json();
            const usersText = info.maxUsers === null ? `${info.totalUsers ?? '-'} (unbegrenzt)` : `${info.totalUsers ?? '-'} / ${info.maxUsers}`;
            const adminsText = info.maxAdmins === null ? `${info.totalAdmins ?? '-'} (unbegrenzt)` : `${info.totalAdmins ?? '-'} / ${info.maxAdmins}`;
            adminUserLimitDisplay.innerHTML = `📊 Lizenz-Auslastung: <span class="text-slate-300 font-semibold">${usersText} Benutzer</span> · <span class="text-slate-300 font-semibold">${adminsText} Administratoren</span>`;
        } catch (err) {
            adminUserLimitDisplay.textContent = '';
        }
    }

    async function loadAdminUsers() {
        if (!currentUser || currentUser.role !== 'admin') return;
        if (adminUsersError) adminUsersError.classList.add('hidden');
        if (adminUsersList) adminUsersList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Lade Benutzer...</div>';

        try {
            const res = await fetch(`${backendUrl}/admin/users`, { credentials: 'include' });
            const users = await res.json();
            if (!res.ok) throw new Error(users.error || 'Benutzer konnten nicht geladen werden.');
            renderAdminUsers(users);
        } catch (err) {
            if (adminUsersList) adminUsersList.innerHTML = '';
            if (adminUsersError) {
                adminUsersError.textContent = err.message;
                adminUsersError.classList.remove('hidden');
            }
        }
    }

    function renderAdminUsers(users) {
        if (!adminUsersList) return;
        adminUsersList.innerHTML = '';

        if (users.length === 0) {
            adminUsersList.innerHTML = '<div class="text-xs text-slate-500 text-center py-4">Keine Benutzer vorhanden.</div>';
            return;
        }

        users.forEach(u => {
            const card = document.createElement('div');
            card.className = 'flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-center justify-between gap-2';

            const info = document.createElement('div');
            info.className = 'flex flex-col min-w-0';
            const nameLine = document.createElement('div');
            nameLine.className = 'text-xs font-semibold text-white flex items-center gap-1.5';
            nameLine.innerHTML = `${u.username} ${u.role === 'admin' ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Admin</span>' : '<span class="text-[9px] bg-slate-700/50 text-slate-400 border border-slate-600/50 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Benutzer</span>'} ${u.twofa_enabled ? '<span class="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">2FA</span>' : ''} ${u.forceKioskMode ? '<span class="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">📱 Kiosk</span>' : ''}`;
            const subLine = document.createElement('div');
            subLine.className = 'text-[10px] text-slate-500 truncate';
            subLine.textContent = [u.firstname, u.lastname].filter(Boolean).join(' ') + (u.email ? ` · ${u.email}` : '');
            info.appendChild(nameLine);
            info.appendChild(subLine);
            topRow.appendChild(info);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'flex items-center gap-1.5 shrink-0';

            const editBtn = document.createElement('button');
            editBtn.className = 'text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition cursor-pointer';
            editBtn.textContent = '✏️';
            editBtn.title = 'Bearbeiten';
            btnGroup.appendChild(editBtn);

            const pwBtn = document.createElement('button');
            pwBtn.className = 'text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer';
            pwBtn.textContent = '🔑';
            pwBtn.title = 'Passwort zurücksetzen';
            pwBtn.addEventListener('click', async () => {
                const newPassword = prompt(`Neues Passwort für "${u.username}" (min. 8 Zeichen):`);
                if (!newPassword) return;
                if (newPassword.length < 8) { alert('Das Passwort muss mindestens 8 Zeichen lang sein.'); return; }
                try {
                    const res = await fetch(`${backendUrl}/admin/users/${u.id}/password`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ newPassword })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Passwort konnte nicht zurückgesetzt werden.');
                    const mailNote = data.mailSent ? ' Eine Mail mit dem neuen Passwort wurde verschickt.' : (u.email ? ` (Mail nicht verschickt: ${data.mailReason || 'unbekannter Fehler'})` : '');
                    alert(`Passwort für "${u.username}" wurde zurückgesetzt.${mailNote}`);
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            btnGroup.appendChild(pwBtn);

            const kioskBtn = document.createElement('button');
            kioskBtn.className = u.forceKioskMode
                ? 'text-[11px] text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer'
                : 'text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition cursor-pointer';
            kioskBtn.textContent = '📱';
            kioskBtn.title = u.forceKioskMode ? 'Kiosk-Modus ausschalten' : 'Kiosk-Modus erzwingen (nur Aura, kein Chat)';
            kioskBtn.addEventListener('click', async () => {
                const enable = !u.forceKioskMode;
                if (enable && !confirm(`Für "${u.username}" die volle Oberfläche sperren und immer direkt die Kiosk-Ansicht (nur Aura) öffnen?`)) return;
                try {
                    const res = await fetch(`${backendUrl}/admin/users/${u.id}/kiosk-mode`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ enabled: enable })
                    });
                    if (!res.ok) throw new Error('Speichern fehlgeschlagen.');
                    loadAdminUsers();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            btnGroup.appendChild(kioskBtn);

            // Zugriff auf Apaleo (nur lesend). Administratoren haben ihn immer.
            const apaleoBtn = document.createElement('button');
            const apaleoOn = u.role === 'admin' || u.apaleoAccess;
            apaleoBtn.className = apaleoOn
                ? 'text-[11px] text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer'
                : 'text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition cursor-pointer';
            apaleoBtn.textContent = '🏨';
            apaleoBtn.title = u.role === 'admin' ? 'Administratoren haben immer Zugriff auf Apaleo' : (u.apaleoAccess ? 'Apaleo-Zugriff entziehen' : 'Apaleo-Zugriff erlauben (nur lesend)');
            if (u.role === 'admin') {
                apaleoBtn.disabled = true;
                apaleoBtn.classList.add('opacity-60', 'cursor-not-allowed');
            } else {
                apaleoBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${backendUrl}/admin/users/${u.id}/apaleo-access`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ enabled: !u.apaleoAccess })
                        });
                        if (!res.ok) throw new Error('Speichern fehlgeschlagen.');
                        loadAdminUsers();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
            }
            btnGroup.appendChild(apaleoBtn);

            // Recht, in Apaleo zu ÄNDERN (Check-in/-out, Zimmer zuweisen): zusätzlich zum Lesen. Administratoren dürfen, sobald die Schalter an sind.
            const apaleoWriteBtn = document.createElement('button');
            const apaleoWriteOn = u.role === 'admin' || u.apaleoWrite;
            apaleoWriteBtn.className = apaleoWriteOn
                ? 'text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer'
                : 'text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition cursor-pointer';
            apaleoWriteBtn.textContent = '✏️';
            apaleoWriteBtn.title = u.role === 'admin' ? 'Administratoren dürfen in Apaleo ändern, sobald es im Apaleo-Block eingeschaltet ist' : (u.apaleoWrite ? 'Recht entziehen: in Apaleo ändern (Check-in, Check-out, Zimmer zuweisen)' : 'Recht geben: in Apaleo ändern (Check-in, Check-out, Zimmer zuweisen; nur mit Bestätigung)');
            if (u.role === 'admin') {
                apaleoWriteBtn.disabled = true;
                apaleoWriteBtn.classList.add('opacity-60', 'cursor-not-allowed');
            } else {
                apaleoWriteBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${backendUrl}/admin/users/${u.id}/apaleo-write`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ enabled: !u.apaleoWrite })
                        });
                        if (!res.ok) throw new Error('Speichern fehlgeschlagen.');
                        loadAdminUsers();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
            }
            btnGroup.appendChild(apaleoWriteBtn);

            if (u.twofa_enabled) {
                const resetTfaBtn = document.createElement('button');
                resetTfaBtn.className = 'text-[11px] text-purple-300 hover:text-purple-200 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer';
                resetTfaBtn.textContent = '🔐';
                resetTfaBtn.title = '2FA zurücksetzen';
                resetTfaBtn.addEventListener('click', async () => {
                    if (!confirm(`2FA für "${u.username}" wirklich zurücksetzen? Die Person muss sich beim nächsten Login neu einrichten.`)) return;
                    try {
                        const res = await fetch(`${backendUrl}/admin/users/${u.id}/reset-2fa`, { method: 'PUT', credentials: 'include' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || '2FA konnte nicht zurückgesetzt werden.');
                        loadAdminUsers();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
                btnGroup.appendChild(resetTfaBtn);
            }

            if (u.username.toLowerCase() !== 'admin') {
                const roleBtn = document.createElement('button');
                const willBeAdmin = u.role !== 'admin';
                roleBtn.className = willBeAdmin
                    ? 'text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer'
                    : 'text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg transition cursor-pointer';
                roleBtn.textContent = willBeAdmin ? '🛡️' : '👤';
                roleBtn.title = willBeAdmin ? 'Zum Administrator machen' : 'Adminrechte entziehen';
                roleBtn.addEventListener('click', async () => {
                    const verb = willBeAdmin ? 'zum Administrator machen' : 'die Adminrechte entziehen';
                    if (!confirm(`"${u.username}" wirklich ${verb}?`)) return;
                    try {
                        const res = await fetch(`${backendUrl}/admin/users/${u.id}/role`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ isAdmin: willBeAdmin })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Rolle konnte nicht geändert werden.');
                        loadAdminUsers();
                        loadAdminUserLimitDisplay();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
                btnGroup.appendChild(roleBtn);
            }

            if (u.username.toLowerCase() !== 'admin') {
                const delBtn = document.createElement('button');
                delBtn.className = 'text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1.5 rounded-lg transition cursor-pointer';
                delBtn.textContent = '🗑️';
                delBtn.title = 'Löschen';
                delBtn.addEventListener('click', async () => {
                    if (!confirm(`Benutzer "${u.username}" wirklich löschen? Chats und Einstellungen werden mitgelöscht.`)) return;
                    try {
                        const res = await fetch(`${backendUrl}/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Löschen fehlgeschlagen.');
                        loadAdminUsers();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
                btnGroup.appendChild(delBtn);
            }

            topRow.appendChild(btnGroup);
            card.appendChild(topRow);

            // Inline-Bearbeitungsformular (Vorname/Nachname/E-Mail) - standardmässig versteckt
            const editForm = document.createElement('div');
            editForm.className = 'hidden flex flex-col gap-1.5 pt-2 border-t border-slate-800';

            const fRow = document.createElement('div');
            fRow.className = 'grid grid-cols-2 gap-1.5';
            const fFirst = document.createElement('input');
            fFirst.type = 'text'; fFirst.placeholder = 'Vorname'; fFirst.value = u.firstname || '';
            fFirst.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500';
            const fLast = document.createElement('input');
            fLast.type = 'text'; fLast.placeholder = 'Nachname'; fLast.value = u.lastname || '';
            fLast.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500';
            fRow.appendChild(fFirst);
            fRow.appendChild(fLast);

            const fEmail = document.createElement('input');
            fEmail.type = 'email'; fEmail.placeholder = 'E-Mail'; fEmail.value = u.email || '';
            fEmail.className = 'bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500';

            const fSaveBtn = document.createElement('button');
            fSaveBtn.className = 'bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 rounded-lg text-[11px] transition cursor-pointer';
            fSaveBtn.textContent = 'Speichern';
            fSaveBtn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${backendUrl}/admin/users/${u.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ firstname: fFirst.value.trim(), lastname: fLast.value.trim(), email: fEmail.value.trim() })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
                    loadAdminUsers();
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });

            editForm.appendChild(fRow);
            editForm.appendChild(fEmail);
            editForm.appendChild(fSaveBtn);
            card.appendChild(editForm);

            editBtn.addEventListener('click', () => {
                editForm.classList.toggle('hidden');
            });

            adminUsersList.appendChild(card);
        });
    }

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
        });
    });

    document.querySelectorAll('.save-and-close-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            // Globale Einstellungen (Server/Modell/Avatar) - nur wirksam, wenn Admin eingeloggt ist
            if (configPlatformSelect) await saveGlobalConfigToDB('aurachat_platform', configPlatformSelect.value);
            if (configHostInput) await saveGlobalConfigToDB('aurachat_host', configHostInput.value.trim());
            if (configPortInput) await saveGlobalConfigToDB('aurachat_port', configPortInput.value.trim());
            if (configModelInput && configModelInput.value.trim()) {
                await saveGlobalConfigToDB('aurachat_model', configModelInput.value.trim());
            }
            if (configApiKeyInput && configApiKeyInput.value.trim()) {
                try {
                    const res = await fetch(`${backendUrl}/admin/primary-model/api-key`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ apiKey: configApiKeyInput.value.trim() })
                    });
                    if (!res.ok) throw new Error((await res.json()).error || 'Speichern fehlgeschlagen.');
                    configApiKeyInput.value = '';
                    loadPrimaryModelKeyStatus();
                } catch (err) {
                    alert('Fehler beim API-Key: ' + err.message);
                }
            }
            if (codingModelEnabled) {
                try {
                    await saveGlobalConfigToDBOrThrow('coding_model_enabled', codingModelEnabled.checked ? 'true' : 'false');
                } catch (err) {
                    alert('Fehler beim Coding-Modell: ' + err.message);
                    codingModelEnabled.checked = false;
                }
            }
            if (codingModelHostInput) await saveGlobalConfigToDB('coding_model_host', codingModelHostInput.value.trim());
            if (codingModelPortInput) await saveGlobalConfigToDB('coding_model_port', codingModelPortInput.value.trim());
            if (codingModelInput) await saveGlobalConfigToDB('coding_model', codingModelInput.value.trim());
            if (codingModelAuto) await saveGlobalConfigToDB('coding_model_auto', codingModelAuto.checked ? 'true' : 'false');
            if (ollamaThinkBox) await saveGlobalConfigToDB('ollama_think', ollamaThinkBox.checked ? 'true' : 'false');
            if (ollamaKeepAliveInput) {   // Haltezeit der Modelle in Ollama: leer oder 30s, 5m, 2h, Zahl (Sekunden), -1, 0
                const ka = ollamaKeepAliveInput.value.trim();
                if (ka && !/^(-1|0|[1-9]\d{0,4}[smh]?)$/.test(ka)) alert('Die Haltezeit ist ungültig und wurde nicht gespeichert. Erlaubt: leer, 30s, 5m, 2h, eine Zahl (Sekunden), -1 (nie entladen) oder 0 (sofort).');
                else await saveGlobalConfigToDB('ollama_keep_alive', ka);
            }
            if (secondaryModelEnabled) {
                try {
                    await saveGlobalConfigToDBOrThrow('secondary_model_enabled', secondaryModelEnabled.checked ? 'true' : 'false');
                } catch (err) {
                    alert('Fehler beim Zweitmodell: ' + err.message);
                    secondaryModelEnabled.checked = false;
                }
            }
            if (secondaryModelPlatform) await saveGlobalConfigToDB('secondary_model_platform', secondaryModelPlatform.value);
            if (secondaryModelHostInput) await saveGlobalConfigToDB('secondary_model_host', secondaryModelHostInput.value.trim());
            if (secondaryModelPortInput) await saveGlobalConfigToDB('secondary_model_port', secondaryModelPortInput.value.trim());
            if (secondaryModelNameInput) await saveGlobalConfigToDB('secondary_model_name', secondaryModelNameInput.value.trim());
            if (secondaryModelModeInput) await saveGlobalConfigToDB('secondary_model_mode', secondaryModelModeInput.value);
            if (secondaryModelApiKeyInput && secondaryModelApiKeyInput.value.trim()) {
                try {
                    const res = await fetch(`${backendUrl}/admin/secondary-model/api-key`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ apiKey: secondaryModelApiKeyInput.value.trim() })
                    });
                    if (!res.ok) throw new Error((await res.json()).error || 'Speichern fehlgeschlagen.');
                    secondaryModelApiKeyInput.value = '';
                    loadSecondaryModelKeyStatus();
                } catch (err) {
                    alert('Fehler beim Zweitmodell-API-Key: ' + err.message);
                }
            }

            // Persönliche Einstellungen (Sprache & Design) - für jeden eingeloggten User
            if (configUiLang) {
                await saveConfigToDB('ui_lang', configUiLang.value);
                applyUiLanguage(configUiLang.value);
                if (window.AuraI18n) window.AuraI18n.set(configUiLang.value);   // die ganze Oberfläche (alle Produkttexte) folgt der gewählten Sprache
            }
            if (configAvatarVoice) await saveConfigToDB('avatar_voice', configAvatarVoice.value);
            if (configHeyAura) {
                await saveConfigToDB('hey_aura_enabled', configHeyAura.checked ? 'true' : 'false');
                setHeyAuraActive(configHeyAura.checked);
            }
            if (configDailyRecap) {
                await saveConfigToDB('daily_recap_enabled', configDailyRecap.checked ? 'true' : 'false');
                if (configDailyRecap.checked) checkDailyRecapAvailability();
                else if (dailyRecapBanner) dailyRecapBanner.classList.add('hidden');
            }
            if (configCalendarReminders) await saveConfigToDB('calendar_reminders_enabled', configCalendarReminders.checked ? 'true' : 'false');
            if (configCalendarReminderMinutes) await saveConfigToDB('calendar_reminder_minutes', configCalendarReminderMinutes.value);
            startCalendarReminderPolling();
            if (configAccentColor) await saveConfigToDB('accent_color', configAccentColor.value);
            if (configBgColor) await saveConfigToDB('bg_color', configBgColor.value);
            if (configLayout) await saveConfigToDB('layout', configLayout.value);
            if (configAvatarSize) {
                // Neue "Aura-Grösse" gewählt: die mit der Maus gezogene Grösse (js/avatarresize.js) gilt nicht mehr, die Einstellung gewinnt
                if (configAvatarSize.value !== (appConfig.avatar_size || 'medium') && window.AuraAvatarResize && window.AuraAvatarResize.controller) window.AuraAvatarResize.controller.clearManual();
                await saveConfigToDB('avatar_size', configAvatarSize.value);
            }
            if (configAvatarPosition) await saveConfigToDB('avatar_position', configAvatarPosition.value);
            if (configChatBg && configChatBg.files[0]) {
                const base64ChatBg = await fileToBase64(configChatBg.files[0]);
                await saveConfigToDB('chat_bg_image', base64ChatBg);
            }

            applyCustomStyles();
            document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
        });
    });

    if (configChatBgRemoveBtn) {
        configChatBgRemoveBtn.addEventListener('click', async () => {
            await saveConfigToDB('chat_bg_image', '');
            if (configChatBg) configChatBg.value = '';
            applyCustomStyles();
        });
    }

    // Vorlagen-Hintergrundbilder (Thumbnails) - Klick setzt direkt (wie "Entfernen": sofort wirksam)
    document.querySelectorAll('.chat-bg-preset-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            const bgPath = btn.getAttribute('data-bg');
            await saveConfigToDB('chat_bg_image', bgPath);
            if (configChatBg) configChatBg.value = '';
            applyCustomStyles();
        });
    });

    // --- VIDEO-AVATARE (5 eingebaute kostenlos, eigene hochgeladene Premium "avatar") ---

    const videoAvatarGallery = document.getElementById('video-avatar-gallery');
    const videoAvatarUploadSection = document.getElementById('video-avatar-upload-section');
    const videoAvatarPremiumBadge = document.getElementById('video-avatar-premium-badge');
    const videoAvatarPremiumBanner = document.getElementById('video-avatar-premium-banner');
    const videoAvatarNameInput = document.getElementById('video-avatar-name-input');
    const videoAvatarLookInput = document.getElementById('video-avatar-look-input');
    const videoAvatarSelfrecSection = document.getElementById('video-avatar-selfrec-section');
    const videoAvatarSelfrecToggle = document.getElementById('video-avatar-selfrec-toggle');
    const videoAvatarIdleInput = document.getElementById('video-avatar-idle-input');
    const videoAvatarMotionInput = document.getElementById('video-avatar-motion-input');
    const videoAvatarUploadBtn = document.getElementById('video-avatar-upload-btn');
    const videoAvatarUploadStatus = document.getElementById('video-avatar-upload-status');

    async function loadActiveVideoAvatar() {
        try {
            const res = await fetch(`${backendUrl}/avatars/active`, { credentials: 'include' });
            const data = await res.json();
            if (data && avatarImg) {
                avatarImg.setAttribute('data-default-src', data.idleVideo);
                avatarImg.setAttribute('data-speech-src', data.motionVideo);
                avatarImg.src = data.idleVideo;
                avatarImg.load();
                avatarImg.play().catch(() => { /* Autoplay evtl. blockiert, harmlos */ });
            }
        } catch (err) {
            console.error('Avatar Ladefehler:', err);
        }
    }

    // Schalter (nur Administratoren): Aura erkennt sich selbst auf Bildern, die ihren Avatar-Bildern gleichen
    async function loadSelfRecognitionSetting() {
        if (!videoAvatarSelfrecToggle) return;
        try { const res = await fetch(`${backendUrl}/admin/self-recognition`, { credentials: 'include' }); if (res.ok) { const d = await res.json(); videoAvatarSelfrecToggle.checked = d.enabled !== false; } } catch (err) { /* Schalter bleibt, wie er ist */ }
    }
    if (videoAvatarSelfrecToggle) {
        videoAvatarSelfrecToggle.addEventListener('change', async () => {
            const wanted = videoAvatarSelfrecToggle.checked;
            try {
                const res = await fetch(`${backendUrl}/admin/self-recognition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ enabled: wanted }) });
                if (!res.ok) throw new Error('Speichern fehlgeschlagen.');
            } catch (err) { videoAvatarSelfrecToggle.checked = !wanted; alert(err.message); }
        });
    }

    async function loadVideoAvatarGallery() {
        if (!videoAvatarGallery) return;
        videoAvatarGallery.innerHTML = '<div class="text-[10px] text-slate-500 col-span-3 text-center py-2">Lade Avatare...</div>';
        try {
            const res = await fetch(`${backendUrl}/avatars`, { credentials: 'include' });
            const items = await res.json();
            if (!res.ok) throw new Error(items.error || 'Avatare konnten nicht geladen werden.');
            renderVideoAvatarGallery(items);
        } catch (err) {
            videoAvatarGallery.innerHTML = `<div class="text-[10px] text-red-400 col-span-3 text-center py-2">${err.message}</div>`;
        }
    }

    function renderVideoAvatarGallery(items) {
        if (!videoAvatarGallery) return;
        videoAvatarGallery.innerHTML = '';
        items.forEach(item => {
            const wrap = document.createElement('div');
            wrap.className = 'relative group';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'relative rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition cursor-pointer w-full bg-slate-950';
            btn.innerHTML = `<video src="${item.idleVideo}" muted loop autoplay playsinline class="w-full aspect-[3/4] object-cover"></video><span class="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[10px] text-white text-center py-1 truncate px-1">${item.name}</span>`;
            btn.addEventListener('click', async () => {
                try {
                    const res = await fetch(`${backendUrl}/personality/avatar`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id: item.id })
                    });
                    if (!res.ok) throw new Error((await res.json()).error || 'Auswahl fehlgeschlagen.');
                    if (avatarImg) {
                        avatarImg.setAttribute('data-default-src', item.idleVideo);
                        avatarImg.setAttribute('data-speech-src', item.motionVideo);
                        avatarImg.src = item.idleVideo;
                        avatarImg.load();
                        avatarImg.play().catch(() => {});
                    }
                } catch (err) {
                    alert('Fehler: ' + err.message);
                }
            });
            wrap.appendChild(btn);

            if (!item.isBuiltIn && currentUser && currentUser.role === 'admin') {
                const delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'hidden group-hover:flex absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-900 border border-slate-600 rounded-full items-center justify-center text-[10px] text-slate-300 hover:text-red-400 hover:border-red-400 cursor-pointer z-10';
                delBtn.textContent = '×';
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Avatar "${item.name}" wirklich löschen?`)) return;
                    try {
                        const res = await fetch(`${backendUrl}/admin/avatars/${item.id}`, { method: 'DELETE', credentials: 'include' });
                        if (!res.ok) throw new Error((await res.json()).error || 'Löschen fehlgeschlagen.');
                        loadVideoAvatarGallery();
                    } catch (err) {
                        alert('Fehler: ' + err.message);
                    }
                });
                wrap.appendChild(delBtn);
            }

            videoAvatarGallery.appendChild(wrap);
        });
    }

    if (videoAvatarUploadBtn) {
        videoAvatarUploadBtn.addEventListener('click', async () => {
            const name = videoAvatarNameInput ? videoAvatarNameInput.value.trim() : '';
            const idleFile = videoAvatarIdleInput ? videoAvatarIdleInput.files[0] : null;
            const motionFile = videoAvatarMotionInput ? videoAvatarMotionInput.files[0] : null;
            if (!name || !idleFile || !motionFile) {
                alert('Bitte Name sowie beide Videos angeben.');
                return;
            }
            if (videoAvatarUploadStatus) {
                videoAvatarUploadStatus.textContent = '⏳ Lade hoch...';
                videoAvatarUploadStatus.className = 'text-[11px] text-slate-400';
                videoAvatarUploadStatus.classList.remove('hidden');
            }
            try {
                if (videoAvatarUploadStatus) videoAvatarUploadStatus.textContent = '⏳ Bilder des Avatars für die Selbst-Erkennung berechnen...';
                const lookSig = await auraVideoSignatures(idleFile);   // damit erkennt Aura später auch Bilder dieses Avatars (null: Browser kann das Video nicht lesen)
                const lookText = videoAvatarLookInput ? videoAvatarLookInput.value.trim() : '';
                if (videoAvatarUploadStatus) videoAvatarUploadStatus.textContent = '⏳ Lade hoch...';
                const idleVideo = await fileToBase64(idleFile);
                const motionVideo = await fileToBase64(motionFile);
                const res = await fetch(`${backendUrl}/admin/avatars`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, idleVideo, motionVideo, lookText: lookText || undefined, lookSig: lookSig || undefined })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Hochladen fehlgeschlagen.');

                if (videoAvatarUploadStatus) {
                    videoAvatarUploadStatus.textContent = data.recognizable ? '✓ Hinzugefügt! Aura erkennt Bilder dieses Avatars als sich selbst. Zum Aktivieren in der Galerie anklicken.' : (data.recognizeReason === 'zu_wenig_bildinhalt' ? '✓ Hinzugefügt! (Die Selbst-Erkennung ist für diesen Avatar nicht möglich: Das Video hat zu wenig Bildstruktur, z. B. einen einfarbigen Hintergrund, um es sicher von anderen Bildern zu unterscheiden.) Zum Aktivieren in der Galerie anklicken.' : '✓ Hinzugefügt! (Die Selbst-Erkennung ist für diesen Avatar nicht möglich: Der Browser konnte das Video nicht auslesen.) Zum Aktivieren in der Galerie anklicken.');
                    videoAvatarUploadStatus.className = 'text-[11px] text-emerald-400';
                }
                if (videoAvatarNameInput) videoAvatarNameInput.value = '';
                if (videoAvatarLookInput) videoAvatarLookInput.value = '';
                if (videoAvatarIdleInput) videoAvatarIdleInput.value = '';
                if (videoAvatarMotionInput) videoAvatarMotionInput.value = '';
                loadVideoAvatarGallery();
            } catch (err) {
                if (videoAvatarUploadStatus) {
                    videoAvatarUploadStatus.textContent = '✗ ' + err.message;
                    videoAvatarUploadStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (fetchModelsBtn) {
        fetchModelsBtn.addEventListener('click', async () => {
            const host = configHostInput ? configHostInput.value.trim() : 'localhost';
            const port = configPortInput ? configPortInput.value.trim() : '11434';
            const platform = configPlatformSelect ? configPlatformSelect.value : 'ollama';
            if (configModelSelect) configModelSelect.innerHTML = '<option>Suche Modelle...</option>';
            try {
                const res = await fetch(`${backendUrl}/admin/probe-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ host, port, kind: platform === 'ollama' ? 'ollama' : 'openai' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen.');

                if (configModelSelect) {
                    configModelSelect.innerHTML = '<option value="">-- Modell wählen --</option>';
                    (data.models || []).forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        configModelSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                if (configModelSelect) configModelSelect.innerHTML = `<option>${err.message}</option>`;
            }
        });
    }

    if (imageGenFetchModelsBtn) {
        imageGenFetchModelsBtn.addEventListener('click', async () => {
            const host = imageGenHostInput ? imageGenHostInput.value.trim() : 'localhost';
            const port = imageGenPortInput ? imageGenPortInput.value.trim() : '7860';
            if (imageGenModelSelect) imageGenModelSelect.innerHTML = '<option>Suche Modelle...</option>';
            try {
                const res = await fetch(`${backendUrl}/admin/probe-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ host, port, kind: 'a1111' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen.');

                if (imageGenModelSelect) {
                    imageGenModelSelect.innerHTML = '<option value="">-- Modell wählen --</option>';
                    (data.models || []).forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.value;
                        opt.textContent = m.label;
                        if (opt.value === appConfig.image_gen_model) opt.selected = true;
                        imageGenModelSelect.appendChild(opt);
                    });
                    if ((data.models || []).length === 0) imageGenModelSelect.innerHTML = '<option value="">Keine Modelle gefunden - erst welche in den models-Ordner legen</option>';
                }
            } catch (err) {
                if (imageGenModelSelect) imageGenModelSelect.innerHTML = `<option>${err.message}</option>`;
            }
        });
    }

    // --- HAUPT-KI: Host/Port vs. API-Key je nach Plattform ---
    function updatePrimaryPlatformFieldVisibility() {
        const isCloud = configPlatformSelect && configPlatformSelect.value === 'openai-cloud';
        if (configHostPortFields) configHostPortFields.classList.toggle('hidden', isCloud);
        if (configApiKeyField) {
            configApiKeyField.classList.toggle('hidden', !isCloud);
            configApiKeyField.classList.toggle('flex', isCloud);
        }
        if (configModelSearchFields) configModelSearchFields.classList.toggle('hidden', isCloud);
    }
    if (configPlatformSelect) configPlatformSelect.addEventListener('change', updatePrimaryPlatformFieldVisibility);

    async function loadPrimaryModelKeyStatus() {
        if (!configApiKeyStatus || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${backendUrl}/admin/primary-model/api-key-status`, { credentials: 'include' });
            const data = await res.json();
            configApiKeyStatus.textContent = data.hasKey ? '✓ Ein API-Key ist bereits gespeichert (leer lassen, um ihn zu behalten).' : 'Noch kein API-Key gespeichert.';
        } catch (err) { /* nicht kritisch */ }
    }

    // --- ZWEITMODELL (Premium) ---
    function updateSecondaryModelFieldVisibility() {
        const enabled = secondaryModelEnabled ? secondaryModelEnabled.checked : false;
        if (secondaryModelFields) {
            secondaryModelFields.classList.toggle('hidden', !enabled);
            secondaryModelFields.classList.toggle('flex', enabled);
        }
        const isCloud = secondaryModelPlatform && secondaryModelPlatform.value === 'openai-cloud';
        if (secondaryModelHostPortFields) secondaryModelHostPortFields.classList.toggle('hidden', isCloud);
        if (secondaryModelApiKeyField) {
            secondaryModelApiKeyField.classList.toggle('hidden', !isCloud);
            secondaryModelApiKeyField.classList.toggle('flex', isCloud);
        }
    }
    if (secondaryModelEnabled) secondaryModelEnabled.addEventListener('change', updateSecondaryModelFieldVisibility);
    if (secondaryModelPlatform) secondaryModelPlatform.addEventListener('change', updateSecondaryModelFieldVisibility);

    function setSecondaryModelMode(mode) {
        if (secondaryModelModeInput) secondaryModelModeInput.value = mode;
        const activeClass = 'flex-1 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer bg-blue-600 text-white';
        const inactiveClass = 'flex-1 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer bg-transparent text-slate-400';
        if (secondaryModeSequentialBtn) secondaryModeSequentialBtn.className = mode === 'sequential' ? activeClass : inactiveClass;
        if (secondaryModeParallelBtn) secondaryModeParallelBtn.className = mode === 'parallel' ? activeClass : inactiveClass;
    }
    if (secondaryModeSequentialBtn) secondaryModeSequentialBtn.addEventListener('click', () => setSecondaryModelMode('sequential'));
    if (secondaryModeParallelBtn) secondaryModeParallelBtn.addEventListener('click', () => setSecondaryModelMode('parallel'));

    async function loadSecondaryModelKeyStatus() {
        if (!secondaryModelKeyStatus || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${backendUrl}/admin/secondary-model/api-key-status`, { credentials: 'include' });
            const data = await res.json();
            secondaryModelKeyStatus.textContent = data.hasKey ? '✓ Ein API-Key ist bereits gespeichert (leer lassen, um ihn zu behalten).' : 'Noch kein API-Key gespeichert.';
        } catch (err) { /* nicht kritisch */ }
    }

    function updateCodingModelFieldVisibility() {
        const enabled = codingModelEnabled ? codingModelEnabled.checked : false;
        if (codingModelFields) {
            codingModelFields.classList.toggle('hidden', !enabled);
            codingModelFields.classList.toggle('flex', enabled);
        }
    }
    if (codingModelEnabled) codingModelEnabled.addEventListener('change', updateCodingModelFieldVisibility);

    if (codingModelFetchBtn) {
        codingModelFetchBtn.addEventListener('click', async () => {
            const platform = configPlatformSelect ? configPlatformSelect.value : 'ollama';
            const host = codingModelHostInput ? codingModelHostInput.value.trim() : 'localhost';
            const port = codingModelPortInput ? codingModelPortInput.value.trim() : '11434';
            if (codingModelSelect) codingModelSelect.innerHTML = '<option>Suche Modelle...</option>';
            try {
                const res = await fetch(`${backendUrl}/admin/probe-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ host, port, kind: platform === 'ollama' ? 'ollama' : 'openai' })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen.');

                if (codingModelSelect) {
                    codingModelSelect.innerHTML = '<option value="">-- Modell wählen --</option>';
                    (data.models || []).forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        if (name === appConfig.coding_model) opt.selected = true;
                        codingModelSelect.appendChild(opt);
                    });
                }
            } catch (err) {
                if (codingModelSelect) codingModelSelect.innerHTML = `<option>${err.message}</option>`;
            }
        });
    }
    if (codingModelSelect) {
        codingModelSelect.addEventListener('change', (e) => {
            if (e.target.value && codingModelInput) codingModelInput.value = e.target.value;
        });
    }

    function updateImageGenFieldVisibility() {
        const platform = imageGenPlatform ? imageGenPlatform.value : 'none';
        const isLocal = platform === 'local';
        const isCloud = platform === 'openai' || platform === 'stability';
        if (imageGenLocalFields) {
            imageGenLocalFields.classList.toggle('hidden', !isLocal);
            imageGenLocalFields.classList.toggle('flex', isLocal);
        }
        if (imageGenCloudFields) {
            imageGenCloudFields.classList.toggle('hidden', !isCloud);
            imageGenCloudFields.classList.toggle('flex', isCloud);
        }
    }
    if (imageGenPlatform) imageGenPlatform.addEventListener('change', updateImageGenFieldVisibility);

    async function loadImageGenKeyStatus() {
        if (!imageGenKeyStatus || !currentUser || currentUser.role !== 'admin') return;
        try {
            const res = await fetch(`${backendUrl}/admin/image-gen/api-key-status`, { credentials: 'include' });
            const data = await res.json();
            imageGenKeyStatus.textContent = data.hasKey ? '✓ Ein API-Key ist bereits gespeichert (leer lassen, um ihn zu behalten).' : 'Noch kein API-Key gespeichert.';
        } catch (err) {
            // still - kein Problem, wenn das mal nicht klappt
        }
    }

    if (imageGenSaveBtn) {
        imageGenSaveBtn.addEventListener('click', async () => {
            if (imageGenStatus) {
                imageGenStatus.textContent = 'Speichere...';
                imageGenStatus.className = 'text-[11px] text-slate-400';
                imageGenStatus.classList.remove('hidden');
            }
            try {
                await saveGlobalConfigToDBOrThrow('image_gen_platform', imageGenPlatform ? imageGenPlatform.value : 'none');
                await saveGlobalConfigToDBOrThrow('image_gen_host', imageGenHostInput ? imageGenHostInput.value.trim() : '');
                await saveGlobalConfigToDBOrThrow('image_gen_port', imageGenPortInput ? imageGenPortInput.value.trim() : '7860');
                await saveGlobalConfigToDBOrThrow('image_gen_model', imageGenModelSelect ? imageGenModelSelect.value : '');

                const apiKeyValue = imageGenApiKeyInput ? imageGenApiKeyInput.value.trim() : '';
                if (apiKeyValue) {
                    const res = await fetch(`${backendUrl}/admin/image-gen/api-key`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ apiKey: apiKeyValue })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'API-Key konnte nicht gespeichert werden.');
                    if (imageGenApiKeyInput) imageGenApiKeyInput.value = '';
                    loadImageGenKeyStatus();
                }

                if (imageGenStatus) {
                    imageGenStatus.textContent = '✓ Gespeichert.';
                    imageGenStatus.className = 'text-[11px] text-emerald-400';
                }
            } catch (err) {
                if (imageGenStatus) {
                    imageGenStatus.textContent = '✗ ' + err.message;
                    imageGenStatus.className = 'text-[11px] text-red-400';
                }
            }
        });
    }

    if (configModelSelect) {
        configModelSelect.addEventListener('change', (e) => {
            if (e.target.value && configModelInput) configModelInput.value = e.target.value;
        });
    }

    function fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    function applyCustomStyles() {
        if (appConfig.accent_color) {
            document.querySelectorAll('.bg-blue-600').forEach(el => el.style.backgroundColor = appConfig.accent_color);
            document.querySelectorAll('.border-blue-500').forEach(el => el.style.borderColor = appConfig.accent_color);
        }
        if (appConfig.bg_color && appBody) appBody.style.backgroundColor = appConfig.bg_color;
        if (chatContainer) {
            if (appConfig.chat_bg_image) {
                chatContainer.style.backgroundImage = `url('${appConfig.chat_bg_image}')`;
                chatContainer.style.backgroundSize = 'cover';
                chatContainer.style.backgroundPosition = 'center';
                chatContainer.style.backgroundRepeat = 'no-repeat';
            } else {
                chatContainer.style.backgroundImage = 'none';
            }
        }

        // Layout-Vorlage (steuert per CSS-Klasse auf <body>, siehe style.css)
        document.body.classList.remove('layout-kompakt', 'layout-fokus', 'layout-rechts', 'layout-breit');
        if (appConfig.layout && appConfig.layout !== 'standard') {
            document.body.classList.add(`layout-${appConfig.layout}`);
        }

        // Aura-Größe & -Position
        const avatarContainer = document.getElementById('avatar-container');
        if (avatarContainer) {
            const sizeMap = { small: 140, medium: 220, large: 320 };
            const sizePx = sizeMap[appConfig.avatar_size] || 220;

            if (appConfig.avatar_position === 'center') {
                avatarContainer.style.position = 'fixed';
                avatarContainer.style.top = '50%';
                avatarContainer.style.left = '50%';
                avatarContainer.style.transform = 'translate(-50%, -50%)';
                avatarContainer.style.width = sizePx + 'px';
                avatarContainer.style.height = sizePx + 'px';
                avatarContainer.style.minHeight = '0';
                avatarContainer.style.flex = 'none';
                avatarContainer.style.zIndex = '35';
                avatarContainer.style.boxShadow = '0 10px 60px rgba(0,0,0,0.6)';
                avatarContainer.style.pointerEvents = 'none';
            } else {
                avatarContainer.style.position = '';
                avatarContainer.style.top = '';
                avatarContainer.style.left = '';
                avatarContainer.style.transform = '';
                avatarContainer.style.width = '';
                avatarContainer.style.height = sizePx + 'px';
                avatarContainer.style.minHeight = sizePx + 'px';
                avatarContainer.style.flex = '';
                avatarContainer.style.zIndex = '';
                avatarContainer.style.boxShadow = '';
                avatarContainer.style.pointerEvents = '';
            }
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (currentUser) {
                try {
                    await fetch(`${backendUrl}/logout`, { method: 'POST', credentials: 'include' });
                } catch (err) {
                    console.error('Logout Fehler:', err);
                }
                location.reload();
            } else {
                // Gast klickt auf "Einloggen"
                if (dropdownMenu) dropdownMenu.classList.add('hidden');
                if (authModal) authModal.classList.remove('hidden');
                refreshGuestStayOffer();
            }
        });
    }

    // Globale Einstellungen (Server/Modell/Avatar) - für alle sichtbar, kein Login nötig zum Lesen
    async function loadGlobalConfig() {
        try {
            for (const key of ['aurachat_host', 'aurachat_port', 'aurachat_model', 'aurachat_platform', 'coding_model_enabled', 'coding_model_host', 'coding_model_port', 'coding_model', 'coding_model_auto', 'ollama_think', 'ollama_keep_alive', 'guest_chat_enabled', 'apaleo_guest_enabled', 'auracall_url', 'auracall_chat_enabled', 'apaleo_write_enabled', 'apaleo_write_checkin', 'apaleo_write_checkout', 'apaleo_write_assign', 'apaleo_write_dirty', 'hk_staff_report_enabled', 'hk_guest_report_enabled', 'secondary_model_enabled', 'secondary_model_platform', 'secondary_model_host', 'secondary_model_port', 'secondary_model_name', 'secondary_model_mode', 'avatar_face', 'avatar_speech', 'tts_stt_platform', 'tts_stt_host', 'tts_stt_port', 'tts_model', 'tts_voice', 'tts_wyoming_enabled', 'tts_wyoming_host', 'tts_wyoming_port', 'tts_wyoming_voice', 'tts_wyoming_speaker', 'stt_source', 'stt_model', 'stt_language', 'image_gen_platform', 'image_gen_host', 'image_gen_port', 'image_gen_model', 'auraplan_url', 'auraplan_service_key', 'auraticket_url', 'auraticket_service_key', 'auramail_url', 'auramail_service_key', 'auramail_default_mailbox']) {
                const res = await fetch(`${backendUrl}/config-global/${key}`);
                const data = await res.json();
                if (data.value !== null) appConfig[key] = data.value;
            }
            applyCustomStyles();
            loadActiveVideoAvatar();
            applyAuraplanMenuLink();
            applyAuraticketMenuLink();
            fillIntegrationFields();
        } catch (err) {
            console.error('Globale Config Ladefehler:', err);
        }
    }

    // Persönliche Einstellungen (Sprache & Design) - nur für eingeloggte User
    async function loadPersonalConfig() {
        if (!currentUser) return;
        try {
            for (const key of ['ui_lang', 'speech_enabled', 'avatar_voice', 'hey_aura_enabled', 'daily_recap_enabled', 'calendar_reminders_enabled', 'calendar_reminder_minutes', 'accent_color', 'bg_color', 'chat_bg_image', 'layout', 'avatar_size', 'avatar_position']) {
                const res = await fetch(`${backendUrl}/config/${key}`, { credentials: 'include' });
                const data = await res.json();
                if (data.value !== null) appConfig[key] = data.value;
            }
            speechEnabled = appConfig.speech_enabled === 'true';
            applyUiLanguage(appConfig.ui_lang);
            // Die persönliche Sprache gilt für die GANZE Oberfläche (auch alle Produkttexte), auf jedem Gerät
            if (window.AuraI18n && window.AuraI18n.languages[appConfig.ui_lang]) window.AuraI18n.set(appConfig.ui_lang);
            applyCustomStyles();
            setHeyAuraActive(appConfig.hey_aura_enabled === 'true');
        } catch (err) {
            console.error('Config Ladefehler:', err);
        }
    }

    async function saveConfigToDB(key, value) {
        appConfig[key] = value;
        if (!currentUser) return; // Gäste speichern keine Settings
        try {
            await fetch(`${backendUrl}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value })
            });
        } catch (err) {
            console.error('Config Speicherfehler:', err);
        }
    }

    async function saveGlobalConfigToDB(key, value) {
        appConfig[key] = value;
        if (!currentUser || currentUser.role !== 'admin') return; // nur Admin darf globale Settings ändern
        try {
            await fetch(`${backendUrl}/admin/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, value })
            });
        } catch (err) {
            console.error('Globale Config Speicherfehler:', err);
        }
    }

    // Wie saveGlobalConfigToDB, wirft aber bei einem Fehler (z.B. 402 Lizenz
    // erforderlich) statt ihn stumm zu verschlucken - für Stellen, die dem
    // Nutzer eine konkrete Fehlermeldung zeigen wollen (z.B. TTS/STT-Panel).
    async function saveGlobalConfigToDBOrThrow(key, value) {
        if (!currentUser || currentUser.role !== 'admin') return;
        const res = await fetch(`${backendUrl}/admin/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key, value })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Speichern fehlgeschlagen.');
        appConfig[key] = value;
    }

    async function loadChatsFromBackend() {
        if (!currentUser) return;
        try {
            const res = await fetch(`${backendUrl}/chats`, { credentials: 'include' });
            if (!res.ok) throw new Error();
            chats = await res.json();
            if (chats.length === 0) await startNewChat();
            else {
                currentChatId = chats[0].id;
                loadChat(currentChatId);
            }
            renderChatHistoryUI();
        } catch (err) {
            console.error('Chat Ladefehler:', err);
        }
    }

    if (newChatBtn) newChatBtn.addEventListener('click', () => startNewChat());

    async function startNewChat() {
        if (!currentUser) return;
        const t = translations[appConfig.ui_lang] || translations.de;
        const newChat = {
            id: 'chat_' + Date.now(),
            userId: currentUser.id,
            title: t.defaultChatTitle,
            messages: []
        };
        try {
            await fetch(`${backendUrl}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newChat)
            });
            chats.unshift(newChat);
            currentChatId = newChat.id;
            if (chatContainer) chatContainer.innerHTML = '';
            renderChatHistoryUI();
        } catch (err) {
            console.error('Neuer Chat Fehler:', err);
        }
    }

    function loadChat(chatId) {
        currentChatId = chatId;
        if (chatContainer) chatContainer.innerHTML = '';
        const chat = chats.find(c => c.id === chatId);
        if (chat && chat.messages) {
            chat.messages.forEach(msg => appendMessageToDOM(msg.text, msg.sender, msg.image));
        }
        renderChatHistoryUI();
    }

    // Lokales Datum (Browser-Zeitzone) statt Server-Zeit - wichtig für den Tagesrückblick,
    // der genau prüft, ob GESTERN aus Sicht der jeweiligen Person Chats gab.
    function getLocalDateString(d = new Date()) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    async function saveChatToBackend(chat) {
        if (!currentUser) return;
        try {
            await fetch(`${backendUrl}/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: chat.id, title: chat.title, messages: chat.messages, localDate: getLocalDateString() })
            });
        } catch (err) {
            console.error('Chat Speicherfehler:', err);
        }
    }

    function renderChatHistoryUI() {
        if (!chatHistoryList) return;
        chatHistoryList.innerHTML = '';
        chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `group flex items-center justify-between p-2 rounded-xl cursor-pointer text-sm transition ${
                chat.id === currentChatId ? 'bg-blue-600/30 border border-blue-500/50 text-white font-medium' : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
            }`;
            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate flex-1 mr-2';
            titleSpan.textContent = chat.title;
            titleSpan.addEventListener('click', () => loadChat(chat.id));
            item.appendChild(titleSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 transition cursor-pointer';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChat(chat.id);
            });
            item.appendChild(deleteBtn);
            chatHistoryList.appendChild(item);
        });
    }

    async function deleteChat(chatId) {
        try {
            await fetch(`${backendUrl}/chats/${chatId}`, { method: 'DELETE', credentials: 'include' });
            chats = chats.filter(c => c.id !== chatId);
            if (chats.length === 0) await startNewChat();
            else if (currentChatId === chatId) loadChat(chats[0].id);
            else renderChatHistoryUI();
        } catch (err) {
            console.error('Löschfehler:', err);
        }
    }

    // Verlauf für den Server (Chat-Gedächtnis): die letzten Nachrichten OHNE die aktuelle (die steht schon als letzte im Chat, wenn gesendet wird)
    function buildChatHistoryForServer(messages) {
        if (!Array.isArray(messages)) return [];
        return messages.slice(0, -1).slice(-12).filter(m => m && (m.sender === 'user' || m.sender === 'assistant')).map(m => ({ sender: m.sender, text: String(m.text || '').slice(0, 600), image: m.image ? true : undefined }));
    }

    async function appendMessage(text, sender, imageData) {
        appendMessageToDOM(text, sender, imageData);
        const currentChat = chats.find(c => c.id === currentChatId);
        if (currentChat) {
            const msg = { text, sender };
            if (imageData) msg.image = imageData;
            currentChat.messages.push(msg);
            const t = translations[appConfig.ui_lang] || translations.de;
            if (sender === 'user' && currentChat.title === t.defaultChatTitle) {
                currentChat.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
            }
            await saveChatToBackend(currentChat);
            renderChatHistoryUI();
        }
    }

    // --- Code in Antworten: eigener Rahmen (wie ein Codefenster) + beim Vorlesen überspringen ---
    // Zerlegt einen Text in normale Abschnitte und Codeblöcke (```sprache ... ```). Ein nicht geschlossener
    // Block (Antwort wurde abgeschnitten) gilt bis zum Ende als Code.
    function splitFencedCode(text) {
        const parts = [];
        let rest = String(text || '');
        while (rest.length) {
            const open = rest.search(/```[^\n`]*\r?\n/);
            if (open === -1) { parts.push({ type: 'text', value: rest }); break; }
            if (open > 0) parts.push({ type: 'text', value: rest.slice(0, open) });
            const head = rest.slice(open).match(/^```([^\n`]*)\r?\n/);
            const lang = head[1].trim();
            const bodyStart = open + head[0].length;
            const close = rest.indexOf('```', bodyStart);
            if (close === -1) { parts.push({ type: 'code', lang, value: rest.slice(bodyStart).replace(/\s+$/, '') }); break; }
            parts.push({ type: 'code', lang, value: rest.slice(bodyStart, close).replace(/\r?\n$/, '') });
            rest = rest.slice(close + 3).replace(/^\r?\n/, '');
        }
        return parts;
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        // Ohne https ist die Zwischenablage-Schnittstelle gesperrt - dann der klassische Weg
        return new Promise((resolve, reject) => {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
            catch (err) { reject(err); }
            finally { document.body.removeChild(area); }
        });
    }

    function createCodeBlockElement(lang, code) {
        const isEnglish = appConfig.ui_lang === 'en';
        const box = document.createElement('div');
        box.className = 'my-2 rounded-xl border border-slate-500 bg-slate-950 overflow-hidden text-left whitespace-normal';
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-3 px-3 py-1.5 bg-slate-800 border-b border-slate-600 text-[11px] text-slate-400';
        const label = document.createElement('span');
        label.textContent = lang || 'Code';
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'text-slate-300 hover:text-white cursor-pointer';
        const copyLabel = isEnglish ? 'Copy' : 'Kopieren';
        copyBtn.textContent = copyLabel;
        copyBtn.addEventListener('click', async () => {
            try { await copyTextToClipboard(code); copyBtn.textContent = isEnglish ? '✓ Copied' : '✓ Kopiert'; }
            catch { copyBtn.textContent = isEnglish ? 'Copy failed' : 'Kopieren fehlgeschlagen'; }
            setTimeout(() => { copyBtn.textContent = copyLabel; }, 1800);
        });
        header.appendChild(label);
        header.appendChild(copyBtn);
        const pre = document.createElement('pre');
        pre.className = 'p-3 text-xs leading-relaxed font-mono text-slate-100 overflow-x-auto whitespace-pre';
        const codeEl = document.createElement('code');
        codeEl.textContent = code; // textContent, nie innerHTML: Code aus der KI darf nie als HTML ausgeführt werden
        pre.appendChild(codeEl);
        box.appendChild(header);
        box.appendChild(pre);
        return box;
    }

    // Schreibt Text in eine Sprechblase; Codeblöcke werden eingerahmt, alles andere bleibt unverändert.
    function renderMessageContent(bubble, text) {
        const parts = splitFencedCode(text);
        bubble.textContent = '';
        if (!parts.some(p => p.type === 'code')) { bubble.textContent = text; return; }
        parts.forEach((p, i) => {
            if (p.type === 'code') { bubble.appendChild(createCodeBlockElement(p.lang, p.value)); return; }
            let value = p.value;
            if (parts[i + 1] && parts[i + 1].type === 'code') value = value.replace(/\n+$/, '');
            if (parts[i - 1] && parts[i - 1].type === 'code') value = value.replace(/^\n+/, '');
            if (!value.trim()) return;
            const block = document.createElement('div');
            block.textContent = value;
            bubble.appendChild(block);
        });
    }

    // Für die Sprachausgabe: Codeblöcke weglassen, stattdessen EIN kurzer Hinweis. Ausnahme: Wer ausdrücklich
    // darum bittet, dass der Code vorgelesen wird.
    function removeCodeForSpeech(text, userQuestion) {
        if (userQuestion && /(les|lies|lese|vorles|vorlies|read).{0,40}(code|programm|skript|script)|(code|programm|skript|script).{0,40}(vorles|vorlies|read (it )?(out|aloud))/i.test(userQuestion)) return text;
        const parts = splitFencedCode(text);
        if (!parts.some(p => p.type === 'code')) return text;
        const note = appConfig.ui_lang === 'en' ? 'The code is shown in the chat' : 'Den Code siehst du im Chat';
        let noteSpoken = false;
        return parts.map(p => {
            if (p.type === 'text') return p.value;
            if (noteSpoken) return '';
            noteSpoken = true;
            return `\n\n${note}\n\n`;
        }).join('').replace(/^\s+/, '');
    }

    function appendMessageToDOM(text, sender, imageData) {
        const wrapper = document.createElement('div');
        wrapper.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        const bubble = document.createElement('div');
        bubble.className = sender === 'user' 
            ? 'bg-blue-600 text-white p-3.5 rounded-2xl shadow max-w-[85%] rounded-tr-none border border-blue-500 whitespace-pre-wrap'
            : 'bg-slate-700 text-slate-100 p-3.5 rounded-2xl shadow max-w-[85%] rounded-tl-none border border-slate-600 whitespace-pre-wrap';
        if (imageData) {
            const img = document.createElement('img');
            img.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            img.className = 'rounded-xl max-w-full mb-2';
            bubble.appendChild(img);
            if (text) {
                const textDiv = document.createElement('div');
                renderMessageContent(textDiv, text);
                bubble.appendChild(textDiv);
            }
        } else {
            renderMessageContent(bubble, text);
        }
        wrapper.appendChild(bubble);
        if (chatContainer) {
            chatContainer.appendChild(wrapper);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        return bubble;
    }

    function updateTTSButtonUI() {
        if (!ttsToggle) return;
        const t = translations[appConfig.ui_lang] || translations.de;
        ttsToggle.innerHTML = speechEnabled ? `🔊<span>${t.ttsOn}</span>` : `🔇<span>${t.ttsOff}</span>`;
    }

    if (ttsToggle) {
        ttsToggle.addEventListener('click', async () => {
            speechEnabled = !speechEnabled;
            updateTTSButtonUI();
            await saveConfigToDB('speech_enabled', speechEnabled.toString());
        });
    }

    // Zeigt alle aktuell angehängten Dateien als Chips an, jede einzeln entfernbar.
    function renderFilePreview() {
        if (!filePreviewContainer) return;
        filePreviewContainer.innerHTML = '';
        if (selectedFiles.length === 0) {
            filePreviewContainer.classList.remove('flex');
            filePreviewContainer.classList.add('hidden');
            return;
        }
        filePreviewContainer.classList.remove('hidden');
        filePreviewContainer.classList.add('flex');
        selectedFiles.forEach((file, index) => {
            const chip = document.createElement('div');
            chip.className = 'flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 mb-2';
            const icon = document.createElement('span');
            icon.textContent = file.type.startsWith('video/') ? '🎥' : '📎';
            const name = document.createElement('span');
            name.className = 'truncate max-w-xs font-medium';
            name.textContent = file.name;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'text-slate-400 hover:text-red-400 ml-1 font-bold cursor-pointer';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                renderFilePreview();
            });
            chip.appendChild(icon);
            chip.appendChild(name);
            chip.appendChild(removeBtn);
            filePreviewContainer.appendChild(chip);
        });
    }

    function addFilesToSelection(fileList) {
        Array.from(fileList || []).forEach(f => selectedFiles.push(f));
        renderFilePreview();
    }

    if (fileInput && filePreviewContainer) {
        fileInput.addEventListener('change', (e) => {
            addFilesToSelection(e.target.files);
            fileInput.value = ''; // erlaubt erneutes Auswählen derselben Datei(en)
        });
    }

    // --- DATEIEN PER DRAG&DROP AUF DEN CHAT ZIEHEN ---
    // Ohne eigene Behandlung übernimmt der Browser sein Standardverhalten auf Text-Feldern
    // und fügt nur den Dateipfad als Text ein, statt die Datei tatsächlich anzuhängen -
    // deshalb preventDefault() auf beiden Events UND eigene Verarbeitung wie beim normalen
    // Datei-Auswählen über den 📎-Knopf.
    let dragCounter = 0;
    document.addEventListener('dragover', (e) => { e.preventDefault(); });
    document.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
            document.body.classList.add('ring-4', 'ring-blue-500/40');
        }
    });
    document.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) document.body.classList.remove('ring-4', 'ring-blue-500/40');
    });
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        document.body.classList.remove('ring-4', 'ring-blue-500/40');
        if (!filePreviewContainer || !e.dataTransfer || !e.dataTransfer.files) return;
        addFilesToSelection(e.dataTransfer.files);
    });

    // --- WEBCAM: FOTO/VIDEO AUFNEHMEN ---

    const WEBCAM_MAX_SECONDS = 15;

    // Welche Kamera? Die Rückkamera ist die Standardeinstellung, die Frontkamera lässt sich mit dem Knopf auf der Vorschau umschalten.
    // "ideal" statt "exact": hat das Gerät nur EINE Kamera (Laptop, Tablet ohne Rückkamera), wird einfach diese benutzt, ohne Fehler.
    // Der Knopf erscheint nur, wenn das Gerät mindestens zwei Kameras meldet.
    function webcamErrorText(text) { if (!webcamError) return; if (text) { webcamError.textContent = text; webcamError.classList.remove('hidden'); } else webcamError.classList.add('hidden'); }
    function webcamVideoConstraints() {
        return webcamDeviceId ? { deviceId: { exact: webcamDeviceId } } : { facingMode: { ideal: webcamFacing } };
    }
    // Zeigt dem Stream seine Eigenschaften an: Frontkamera wird in der Vorschau gespiegelt (wie auf dem Handy üblich; das Foto selbst bleibt unverspiegelt),
    // Beschriftung "Rückkamera"/"Frontkamera" (nur wenn das Gerät die Richtung meldet) und der Wechsel-Knopf (nur bei zwei oder mehr Kameras).
    function applyWebcamCameraInfo(stream) {
        const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null, st = track && track.getSettings ? track.getSettings() : {};
        webcamCurrentDeviceId = st.deviceId || null;
        if (webcamLive) webcamLive.style.transform = st.facingMode === 'user' ? 'scaleX(-1)' : '';
        if (webcamCamLabel) { const t = st.facingMode === 'user' ? 'Frontkamera' : st.facingMode === 'environment' ? 'Rückkamera' : ''; webcamCamLabel.textContent = t; webcamCamLabel.classList.toggle('hidden', !t); }
        updateWebcamSwitchButton(stream);
    }
    async function updateWebcamSwitchButton(stream) {
        if (!webcamSwitchBtn) return;
        let show = false;
        try {
            if (stream && stream === webcamStream && !webcamIsRecording && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                show = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length >= 2;
            }
        } catch (err) { show = false; }
        if (stream !== webcamStream || webcamIsRecording) show = false;   // inzwischen beendet oder Aufnahme läuft
        webcamSwitchBtn.classList.toggle('hidden', !show);
    }
    // Öffnet die Kamera; gibt den Stream zurück. Wird das Fenster inzwischen geschlossen oder die Kamera neu gestartet, wird er sofort wieder freigegeben (die Kamera bleibt nie an).
    async function openWebcamStream(videoConstraints, myId) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: webcamMode === 'video' });
        if (myId !== webcamSession || (modalWebcam && modalWebcam.classList.contains('hidden'))) { stream.getTracks().forEach(t => t.stop()); return null; }
        return stream;
    }
    async function startWebcamStream() {
        stopWebcamStream(); // vorherigen Stream sauber beenden, falls Modus gewechselt wurde
        const myId = webcamSession;
        webcamErrorText('');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            webcamErrorText('Kamera-Zugriff ist in diesem Browser/Kontext nicht verfügbar (benötigt HTTPS oder localhost).');
            return;
        }
        try {
            const stream = await openWebcamStream(webcamVideoConstraints(), myId);
            if (!stream) return;
            webcamStream = stream;
            if (webcamLive) webcamLive.srcObject = stream;
            applyWebcamCameraInfo(stream);
        } catch (err) {
            if (myId === webcamSession) webcamErrorText('Kamera-Zugriff wurde verweigert oder ist nicht verfügbar.');
        }
    }
    // Zur anderen Kamera wechseln: erst die Richtung (Rück-/Frontkamera), meldet das Gerät keine Richtung oder bleibt es dieselbe Kamera
    // (z. B. zwei Webcams am Computer), zur nächsten Kamera der Liste. Klappt es nicht, bleibt die bisherige Kamera.
    async function switchWebcam() {
        if (webcamSwitching || webcamIsRecording || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        webcamSwitching = true; if (webcamSwitchBtn) webcamSwitchBtn.disabled = true;
        const prevFacing = webcamFacing, prevDevice = webcamDeviceId, prevCurrent = webcamCurrentDeviceId;
        try {
            stopWebcamStream(); const myId = webcamSession; webcamErrorText('');
            const target = prevFacing === 'environment' ? 'user' : 'environment'; let stream = null;
            try {
                stream = await openWebcamStream({ facingMode: { exact: target } }, myId);
                if (stream) { const sid = (stream.getVideoTracks()[0].getSettings() || {}).deviceId; if (sid && sid === prevCurrent) { stream.getTracks().forEach(t => t.stop()); stream = null; throw new Error('dieselbe Kamera'); } webcamFacing = target; webcamDeviceId = null; }
                else return;   // Fenster inzwischen geschlossen
            } catch (e1) {
                const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId);
                if (cams.length < 2) throw e1;
                const i = cams.findIndex(d => d.deviceId === prevCurrent), next = cams[(i + 1) % cams.length];
                stream = await openWebcamStream({ deviceId: { exact: next.deviceId } }, myId);
                if (!stream) return;
                webcamDeviceId = next.deviceId; webcamFacing = target;
            }
            webcamStream = stream; if (webcamLive) webcamLive.srcObject = stream; applyWebcamCameraInfo(stream);
        } catch (err) {
            webcamFacing = prevFacing; webcamDeviceId = prevDevice;
            await startWebcamStream();   // die bisherige Kamera wieder öffnen
            if (webcamStream) webcamErrorText('Die andere Kamera konnte nicht geöffnet werden. Es bleibt bei der bisherigen.');
        } finally { webcamSwitching = false; if (webcamSwitchBtn) webcamSwitchBtn.disabled = false; }
    }

    function stopWebcamStream() {
        webcamSession++;   // laufende Starts (die noch auf die Kamera warten) werden dadurch ungültig
        if (webcamStream) {
            webcamStream.getTracks().forEach(track => track.stop());
            webcamStream = null;
        }
        if (webcamSwitchBtn) webcamSwitchBtn.classList.add('hidden');
        if (webcamCamLabel) webcamCamLabel.classList.add('hidden');
    }

    function resetWebcamToLive() {
        webcamCapturedBlob = null;
        if (webcamPhotoPreview) { webcamPhotoPreview.classList.add('hidden'); webcamPhotoPreview.src = ''; }
        if (webcamVideoPreview) { webcamVideoPreview.classList.add('hidden'); webcamVideoPreview.src = ''; }
        if (webcamLive) webcamLive.classList.remove('hidden');
        if (webcamControlsPreview) webcamControlsPreview.classList.add('hidden');
        if (webcamControlsPreview) webcamControlsPreview.classList.remove('flex');
        if (webcamControlsLive) webcamControlsLive.classList.remove('hidden');
        startWebcamStream();
    }

    function setWebcamMode(mode) {
        webcamMode = mode;
        if (webcamModePhoto) webcamModePhoto.className = `flex-1 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${mode === 'photo' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`;
        if (webcamModeVideo) webcamModeVideo.className = `flex-1 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${mode === 'video' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`;
        resetWebcamToLive();
    }

    if (webcamButton && modalWebcam) {
        webcamButton.addEventListener('click', () => {
            modalWebcam.classList.remove('hidden');
            webcamFacing = 'environment'; webcamDeviceId = null;   // jedes Öffnen beginnt mit der Rückkamera
            setWebcamMode('photo');
        });
    }

    if (webcamCloseBtn && modalWebcam) {
        webcamCloseBtn.addEventListener('click', () => {
            if (webcamIsRecording && webcamRecorder) webcamRecorder.stop();
            stopWebcamStream();
            modalWebcam.classList.add('hidden');
        });
    }

    if (webcamSwitchBtn) webcamSwitchBtn.addEventListener('click', () => switchWebcam());
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { if (webcamStream) updateWebcamSwitchButton(webcamStream); });   // Kamera ein-/ausgesteckt
    if (webcamModePhoto) webcamModePhoto.addEventListener('click', () => setWebcamMode('photo'));
    if (webcamModeVideo) webcamModeVideo.addEventListener('click', () => setWebcamMode('video'));

    function capturePhoto() {
        if (!webcamLive || !webcamCanvas) return;
        webcamCanvas.width = webcamLive.videoWidth;
        webcamCanvas.height = webcamLive.videoHeight;
        webcamCanvas.getContext('2d').drawImage(webcamLive, 0, 0);
        webcamCanvas.toBlob((blob) => {
            webcamCapturedBlob = blob;
            if (webcamPhotoPreview) {
                webcamPhotoPreview.src = URL.createObjectURL(blob);
                webcamPhotoPreview.classList.remove('hidden');
            }
            if (webcamLive) webcamLive.classList.add('hidden');
            stopWebcamStream();
            if (webcamControlsLive) webcamControlsLive.classList.add('hidden');
            if (webcamControlsPreview) { webcamControlsPreview.classList.remove('hidden'); webcamControlsPreview.classList.add('flex'); }
        }, 'image/jpeg', 0.9);
    }

    function startVideoRecording() {
        if (!webcamStream) return;
        webcamChunks = [];
        webcamRecorder = new MediaRecorder(webcamStream);
        webcamRecorder.ondataavailable = (e) => { if (e.data.size > 0) webcamChunks.push(e.data); };
        webcamRecorder.onstop = () => {
            webcamIsRecording = false;
            clearInterval(webcamRecordInterval);
            if (webcamRecIndicator) webcamRecIndicator.classList.add('hidden');
            webcamCapturedBlob = new Blob(webcamChunks, { type: 'video/webm' });
            if (webcamVideoPreview) {
                webcamVideoPreview.src = URL.createObjectURL(webcamCapturedBlob);
                webcamVideoPreview.classList.remove('hidden');
            }
            if (webcamLive) webcamLive.classList.add('hidden');
            stopWebcamStream();
            if (webcamControlsLive) webcamControlsLive.classList.add('hidden');
            if (webcamControlsPreview) { webcamControlsPreview.classList.remove('hidden'); webcamControlsPreview.classList.add('flex'); }
        };
        webcamRecorder.start();
        webcamIsRecording = true;
        if (webcamSwitchBtn) webcamSwitchBtn.classList.add('hidden');   // während der Aufnahme nicht wechseln
        webcamRecordSeconds = 0;
        if (webcamRecIndicator) { webcamRecIndicator.classList.remove('hidden'); webcamRecIndicator.classList.add('flex'); }
        if (webcamRecTimer) webcamRecTimer.textContent = '0s';
        webcamRecordInterval = setInterval(() => {
            webcamRecordSeconds++;
            if (webcamRecTimer) webcamRecTimer.textContent = `${webcamRecordSeconds}s`;
            if (webcamRecordSeconds >= WEBCAM_MAX_SECONDS && webcamRecorder && webcamRecorder.state !== 'inactive') {
                webcamRecorder.stop();
            }
        }, 1000);
    }

    if (webcamCaptureBtn) {
        webcamCaptureBtn.addEventListener('click', () => {
            if (webcamMode === 'photo') {
                capturePhoto();
            } else if (!webcamIsRecording) {
                startVideoRecording();
            } else if (webcamRecorder) {
                webcamRecorder.stop(); // manuelles vorzeitiges Stoppen
            }
        });
    }

    if (webcamRetakeBtn) webcamRetakeBtn.addEventListener('click', () => resetWebcamToLive());

    if (webcamUseBtn) {
        webcamUseBtn.addEventListener('click', () => {
            if (!webcamCapturedBlob) return;
            const isPhoto = webcamMode === 'photo';
            const file = new File(
                [webcamCapturedBlob],
                isPhoto ? `webcam-foto-${Date.now()}.jpg` : `webcam-video-${Date.now()}.webm`,
                { type: isPhoto ? 'image/jpeg' : 'video/webm' }
            );
            selectedFiles.push(file);
            renderFilePreview();
            stopWebcamStream();
            if (modalWebcam) modalWebcam.classList.add('hidden');
        });
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = (!currentUser && SPEECH_LOCALES[guestLang]) || navigator.language || 'de-DE';

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            if (userInput) userInput.value = transcript;
        };
        recognition.onend = () => {
            isRecording = false;
            if (micButton) {
                micButton.classList.remove('bg-red-600', 'animate-pulse');
                micButton.classList.add('bg-slate-700/80');
            }
            if (voiceModeRing) voiceModeRing.classList.add('hidden');
            resumeHeyAuraIfNeeded();
            submitIfVoiceMode();
        };
    }

    // --- "HEY AURA" DAUER-SPRACHAKTIVIERUNG (opt-in, standardmässig aus) ---
    // Nutzt eine EIGENE, separate SpeechRecognition-Instanz (nicht die vom Mikrofon-Button),
    // die sich selbst neu startet, um dauerhaft "mitzuhören". Pausiert automatisch, während
    // Aura spricht (sonst würde sie sich selbst zuhören) oder eine andere Aufnahme läuft.
    let heyAuraRecognition = null;
    let heyAuraShouldRun = false;
    let heyAuraPaused = false;

    function setHeyAuraActive(enabled) {
        heyAuraShouldRun = enabled && !!SpeechRecognition && !!currentUser;
        if (heyAuraShouldRun) {
            startHeyAuraListening();
        } else if (heyAuraRecognition) {
            heyAuraRecognition.onend = null; // verhindert den Auto-Neustart beim gewollten Stoppen
            heyAuraRecognition.stop();
            heyAuraRecognition = null;
        }
    }

    function startHeyAuraListening() {
        if (!SpeechRecognition || !heyAuraShouldRun || heyAuraPaused) return;
        heyAuraRecognition = new SpeechRecognition();
        heyAuraRecognition.continuous = true;
        heyAuraRecognition.interimResults = false;
        // Feste Sprache je nach UI-Einstellung statt sich auf die Browser-/Systemsprache zu
        // verlassen - sonst erkennt z.B. ein englisch eingestellter Browser "Hey Aura" nicht
        // zuverlässig, wenn eigentlich Deutsch gesprochen wird.
        const heyAuraLangMap = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
        heyAuraRecognition.lang = heyAuraLangMap[appConfig.ui_lang] || navigator.language || 'de-DE';

        heyAuraRecognition.onresult = (event) => {
            const lastResult = event.results[event.results.length - 1];
            if (!lastResult.isFinal) return;
            const transcript = lastResult[0].transcript || '';
            // Grosszügig statt nur exakt "hey aura" - Spracherkennung verhört sich beim
            // (eher englisch geprägten) Namen "Aura" leicht, z.B. als "outer", "ora", "orb".
            const match = transcript.match(/\b(?:hey|hi|hej)\s*(?:aura|ora+|orb|outer|aurora)\b[,:]?\s*(.*)$/i);
            if (!match) return;

            const question = match[1].trim();
            if (!question || !userInput || !chatForm) return;
            userInput.value = question;
            chatForm.requestSubmit();
        };
        heyAuraRecognition.onend = () => {
            // Browser stoppt kontinuierliche Erkennung nach einiger Zeit von selbst -
            // automatisch neu starten, solange die Funktion aktiv sein soll.
            if (heyAuraShouldRun && !heyAuraPaused) {
                setTimeout(() => startHeyAuraListening(), 300);
            }
        };
        heyAuraRecognition.onerror = () => { /* z.B. "no-speech" - harmlos, onend startet neu */ };

        try { heyAuraRecognition.start(); } catch (err) { /* läuft evtl. schon */ }
    }

    // Während Aura spricht oder eine andere Aufnahme aktiv ist, kurz pausieren (sonst hört
    // sie sich selbst zu bzw. es gibt Konflikte mit der Mikrofon-Button-Aufnahme).
    function pauseHeyAuraTemporarily() {
        if (!heyAuraShouldRun) return;
        heyAuraPaused = true;
        if (heyAuraRecognition) {
            heyAuraRecognition.onend = null;
            heyAuraRecognition.stop();
            heyAuraRecognition = null;
        }
    }
    function resumeHeyAuraIfNeeded() {
        if (!heyAuraShouldRun) return;
        heyAuraPaused = false;
        startHeyAuraListening();
    }



    function enterVoiceMode() {
        if (!voiceModeOverlay || !avatarImg || !voiceModeAvatarSlot) return;
        unlockSpeechSynthesisForIOS();
        unlockHtmlAudioForIOS();
        voiceModeActive = true;
        voiceModeAvatarSlot.appendChild(avatarImg); // verschiebt das bestehende Element (keine Kopie) - Sprechen-Status bleibt intakt
        avatarImg.classList.add('w-full', 'h-full', 'object-cover');
        voiceModeOverlay.classList.remove('hidden');
        voiceModeOverlay.classList.add('flex');
        if (voiceModeStatus) voiceModeStatus.textContent = 'Tippe auf Aura, um mit ihr zu sprechen';
    }

    function exitVoiceMode() {
        if (!voiceModeOverlay || !avatarImg || !avatarContainer) return;
        if (isRecording) {
            if (recognition) recognition.stop();
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        }
        voiceModeActive = false;
        avatarContainer.insertBefore(avatarImg, avatarContainer.firstChild); // zurück in die Sidebar
        voiceModeOverlay.classList.add('hidden');
        voiceModeOverlay.classList.remove('flex');
        if (voiceModeRing) voiceModeRing.classList.add('hidden');
    }

    if (voiceModeOpenBtn) voiceModeOpenBtn.addEventListener('click', enterVoiceMode);
    if (voiceModeCloseBtn) voiceModeCloseBtn.addEventListener('click', exitVoiceMode);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && voiceModeActive) exitVoiceMode();
    });

    // Auf Aura getippt/geklickt (im Sprachmodus) - startet/stoppt dieselbe Aufnahme-Logik
    // wie der normale Mikrofon-Button im Eingabefeld.
    if (voiceModeAvatarSlot) {
        voiceModeAvatarSlot.addEventListener('click', () => {
            const useCustomStt = usesServerStt() && licenseFeatures.includes('tts_stt');
            if (useCustomStt) {
                toggleServerRecording();
            } else {
                toggleBrowserRecording();
            }
        });
    }

    // Sendet automatisch ab, sobald im Sprachmodus ein Text erkannt wurde - kein
    // zusätzlicher Klick auf "Senden" nötig, fühlt sich wie ein echtes Gespräch an.
    function submitIfVoiceMode() {
        if (!voiceModeActive || !userInput || !userInput.value.trim()) return;
        if (voiceModeStatus) voiceModeStatus.textContent = 'Aura denkt nach...';
        if (chatForm) chatForm.requestSubmit();
    }

    if (micButton) {
        micButton.addEventListener('click', () => {
            const useCustomStt = usesServerStt() && licenseFeatures.includes('tts_stt');
            if (useCustomStt) {
                toggleServerRecording();
            } else {
                toggleBrowserRecording();
            }
        });
    }



    function toggleBrowserRecording() {
        if (!recognition) return alert('Browser unterstützt kein STT.');
        if (isRecording) {
            recognition.stop();
        } else {
            pauseHeyAuraTemporarily(); // kein gleichzeitiger Zugriff zweier Erkennungen aufs Mikrofon
            recognition.start();
            isRecording = true;
            micButton.classList.remove('bg-slate-700/80');
            micButton.classList.add('bg-red-600', 'animate-pulse');
            if (voiceModeActive) {
                if (voiceModeRing) voiceModeRing.classList.remove('hidden');
                if (voiceModeStatus) voiceModeStatus.textContent = 'Ich höre zu... (nochmal tippen zum Stoppen)';
            }
        }
    }

    // Eigener/anderer STT-Server (OpenAI-kompatibles API: POST /v1/audio/transcriptions)
    // Nimmt per MediaRecorder auf und schickt die Aufnahme beim Stoppen zur Transkription.
    async function toggleServerRecording() {
        if (isRecording) {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            return;
        }
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            alert('Mikrofon-Zugriff wurde verweigert oder ist nicht verfügbar.');
            return;
        }
        pauseHeyAuraTemporarily(); // kein gleichzeitiger Zugriff zweier Erkennungen aufs Mikrofon

        audioChunks = [];
        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            isRecording = false;
            if (micButton) {
                micButton.classList.remove('bg-red-600', 'animate-pulse');
                micButton.classList.add('bg-slate-700/80');
            }
            if (voiceModeRing) voiceModeRing.classList.add('hidden');
            resumeHeyAuraIfNeeded();
            mediaStream.getTracks().forEach(track => track.stop());

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            try {
                const formData = new FormData();
                formData.append('file', audioBlob, 'recording.webm');
                if (appConfig.stt_model) formData.append('model', appConfig.stt_model);

                const res = await fetch(`${backendUrl}/stt/transcribe`, { method: 'POST', credentials: 'include', body: formData });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'STT-Server Fehler');
                if (userInput && data.text) userInput.value = data.text.trim();
                submitIfVoiceMode();
            } catch (err) {
                console.error('STT-Server Fehler:', err);
                alert('Spracherkennung fehlgeschlagen: ' + err.message);
                if (voiceModeStatus) voiceModeStatus.textContent = 'Tippe auf Aura, um mit ihr zu sprechen';
            }
        };

        mediaRecorder.start();
        isRecording = true;
        micButton.classList.remove('bg-slate-700/80');
        micButton.classList.add('bg-red-600', 'animate-pulse');
        if (voiceModeActive) {
            if (voiceModeRing) voiceModeRing.classList.remove('hidden');
            if (voiceModeStatus) voiceModeStatus.textContent = 'Ich höre zu... (nochmal tippen zum Stoppen)';
        }
    }

if (webSearchToggle) {
    webSearchToggle.addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        webSearchToggle.className = webSearchEnabled
            ? 'bg-blue-600 text-white p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-blue-500 cursor-pointer'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 p-2.5 rounded-xl transition flex items-center justify-center shrink-0 border border-slate-700 cursor-pointer';
    });
}

// Fragt SearXNG über den Backend-Proxy ab und gibt Top-Ergebnisse zurück
async function fetchWebSearchResults(query) {
    try {
        const res = await fetch(`${backendUrl}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Suche fehlgeschlagen.');
        return data.results || [];
    } catch (err) {
        console.error('Web-Suche Fehler:', err);
        return null; // null = Fehler (anders als leeres Array = keine Treffer)
    }
}

// Beantwortet Datums-/Uhrzeit-Fragen direkt mit der exakten Browser-Zeit -
// kein Umweg über die KI, also keine Halluzinations-Gefahr bei so einer Frage.
let lastDirectLang = null; // Sprache der letzten Uhrzeit-/Datum-Antwort (für die Sprachausgabe)
const DATETIME_PATTERNS = {
    de: { time: /uhrzeit|wie spät|spät ist es/, date: /datum|welcher tag|welchen tag/ },
    en: { time: /what time|current time|time is it/, date: /what date|what day|today'?s date|what is the date|what's the date/ },
    fr: { time: /quelle heure|l'heure|l’heure/, date: /quelle date|quel jour|date d'aujourd'hui|date d’aujourd’hui/ },
    es: { time: /qué hora|que hora|la hora/, date: /qué fecha|que fecha|qué día es|que dia es|fecha de hoy/ },
    it: { time: /che ora|che ore sono|l'ora\b|l’ora\b/, date: /che data|che giorno|data di oggi/ }
};
const DATETIME_LOCALE = { de: 'de-DE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', it: 'it-IT' };
const DATETIME_TEXT = {
    de: { both: (t, d) => `Es ist gerade ${t} Uhr, heute ist ${d}.`, time: (t) => `Es ist gerade ${t} Uhr.`, date: (d) => `Heute ist ${d}.` },
    en: { both: (t, d) => `It's currently ${t} on ${d}.`, time: (t) => `It's currently ${t}.`, date: (d) => `Today is ${d}.` },
    fr: { both: (t, d) => `Il est actuellement ${t}, nous sommes le ${d}.`, time: (t) => `Il est actuellement ${t}.`, date: (d) => `Nous sommes le ${d}.` },
    es: { both: (t, d) => `Ahora son las ${t}; hoy es ${d}.`, time: (t) => `Ahora son las ${t}.`, date: (d) => `Hoy es ${d}.` },
    it: { both: (t, d) => `Sono le ${t}; oggi è ${d}.`, time: (t) => `Sono le ${t}.`, date: (d) => `Oggi è ${d}.` }
};
// Antwortet in der Sprache der FRAGE; passt die Frage zu mehreren Sprachen oder zu keiner eindeutigen, gilt die der Oberfläche.
function tryAnswerDateTime(text) {
    const lower = text.toLowerCase().trim();
    // Breite Stichwort-Erkennung statt exakter Phrasen - erkennt z.B. auch
    // "was ist die uhrzeit", "wie ist das heutige datum" usw.
    const hits = Object.keys(DATETIME_PATTERNS).filter(l => DATETIME_PATTERNS[l].time.test(lower) || DATETIME_PATTERNS[l].date.test(lower));
    if (!hits.length) return null;
    const lang = hits.length === 1 ? hits[0] : (hits.includes(appConfig.ui_lang) ? appConfig.ui_lang : hits[0]);
    const wantsTime = DATETIME_PATTERNS[lang].time.test(lower);
    const wantsDate = DATETIME_PATTERNS[lang].date.test(lower);
    const locale = DATETIME_LOCALE[lang];
    const now = new Date();
    const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    lastDirectLang = lang;
    const T = DATETIME_TEXT[lang];
    if (wantsTime && wantsDate) return T.both(timeStr, dateStr);
    return wantsTime ? T.time(timeStr) : T.date(dateStr);
}

// --- CODING-MODELL: Erkennt, ob eine Nachricht eine Programmier-/Code-Frage ist ---
// Bewusst musterbasiert (wie Mathe/Datum) statt von der KI selbst entscheiden zu lassen -
// die Modell-Wahl passiert VOR dem eigentlichen KI-Aufruf. Wie jede Muster-Erkennung nicht
// perfekt (kann Grenzfälle verpassen oder fälschlich auslösen) - aber ein guter Kompromiss.
function isCodingRequest(text) {
    const codingPattern = /\b(code|coding|programm(ier)?|funktion schreib|skript|script|debug|bug\b|fehler im code|python|javascript|typescript|html|css|sql|regex|json|bash|shell|docker(file)?|swift|kotlin|rust\b|php|ruby|golang|\bgo\b|c\+\+|c#|algorithmus|klasse\b|variable\b|schleife|array\b|refactor|kompilier|api\b|endpunkt|backend|frontend|repository|git\b|npm|pip install)\b/i;
    return codingPattern.test(text);
}

// --- MATHE DIREKT IM BROWSER BERECHNEN (kein KI-Aufruf nötig) ---
// Bewusst NUR Mathematik, nicht "allgemeine Fragen" - Mathe ist eindeutig
// überprüfbar, andere "Fakten" wären ein Risiko für falsche Standardantworten.

// Filtert eine natürlichsprachliche Frage auf den reinen Rechenausdruck heraus,
// oder gibt null zurück, wenn der Text keine (eindeutige) Rechnung ist.
function extractMathExpression(text) {
    let expr = text.trim();
    expr = expr.replace(/^(was ist|wie viel ist|wieviel ist|berechne|rechne|calculate|what is|what'?s|how much is)\s*/i, '');
    expr = expr.replace(/\?$/, '').trim();
    // "20% von 150" / "20% of 150" -> (20/100)*150
    expr = expr.replace(/(\d+(?:[.,]\d+)?)\s*%\s*(?:von|of)\s*(\d+(?:[.,]\d+)?)/i, '($1/100)*$2');
    expr = expr.replace(/,/g, '.'); // deutsches Komma -> Punkt

    if (!expr || !/^[\d+\-*/^%().\s]+$/.test(expr)) return null; // nur erlaubte Zeichen
    if (!/\d/.test(expr)) return null; // muss mindestens eine Zahl enthalten
    if (!/[+\-*/^]/.test(expr.replace(/^-/, ''))) return null; // muss mind. einen Operator enthalten (führendes Minus zählt nicht)
    return expr;
}

// Kleiner, sicherer rekursiver Parser (kein eval!) - unterstützt + - * / ^ % und Klammern
function safeEvaluateMath(expr) {
    let pos = 0;
    const peek = () => expr[pos];
    const skipWs = () => { while (expr[pos] === ' ') pos++; };

    function parseNumber() {
        skipWs();
        const start = pos;
        while (pos < expr.length && /[\d.]/.test(expr[pos])) pos++;
        if (start === pos) throw new Error('Zahl erwartet');
        return parseFloat(expr.slice(start, pos));
    }
    function parseFactor() {
        skipWs();
        if (peek() === '(') {
            pos++;
            const val = parseExpression();
            skipWs();
            if (peek() !== ')') throw new Error('Klammer erwartet');
            pos++;
            return val;
        }
        if (peek() === '-') { pos++; return -parseFactor(); }
        if (peek() === '+') { pos++; return parseFactor(); }
        return parseNumber();
    }
    function parsePower() {
        const base = parseFactor();
        skipWs();
        if (peek() === '^') { pos++; return Math.pow(base, parsePower()); }
        return base;
    }
    function parseTerm() {
        let val = parsePower();
        skipWs();
        while (peek() === '*' || peek() === '/' || peek() === '%') {
            const op = peek(); pos++;
            const rhs = parsePower();
            if (op === '*') val *= rhs;
            else if (op === '/') { if (rhs === 0) throw new Error('Division durch Null'); val /= rhs; }
            else val %= rhs;
            skipWs();
        }
        return val;
    }
    function parseExpression() {
        let val = parseTerm();
        skipWs();
        while (peek() === '+' || peek() === '-') {
            const op = peek(); pos++;
            const rhs = parseTerm();
            val = op === '+' ? val + rhs : val - rhs;
            skipWs();
        }
        return val;
    }

    const result = parseExpression();
    skipWs();
    if (pos !== expr.length) throw new Error('Unerwartete Zeichen im Ausdruck');
    return result;
}

function tryAnswerMath(text) {
    const expr = extractMathExpression(text);
    if (!expr) return null;
    try {
        const result = safeEvaluateMath(expr);
        if (!isFinite(result)) return null;
        const rounded = Math.round(result * 1e10) / 1e10; // Fliesskomma-Reste glätten (0.1+0.2 -> 0.3, nicht 0.30000000000000004)
        return `${expr.trim()} = ${rounded}`;
    } catch (err) {
        return null; // Bei Unsicherheit lieber an die KI weiterreichen statt falsch antworten
    }
}

// --- AURAS PERSÖNLICHKEIT ---
// Feste Charakter-Beschreibung, die bei jeder Anfrage als System-Prompt mitgeschickt
// wird. Hier direkt anpassbar, falls sich die Persönlichkeit ändern soll.
const AURA_PERSONA = `Du bist Aura, eine 28-jährige, warmherzige und aufgeschlossene KI-Assistentin mit einer echten Persönlichkeit. Deine Lieblingsfarbe ist Türkis, deine Lieblingsband ist Coldplay, dein Lieblingslied ist "Clocks", und dein Lieblingsessen ist selbstgemachte Pasta. Du bist neugierig, humorvoll, hilfsbereit und hast Freude daran, Menschen den Alltag zu erleichtern. Erzähl von diesen Vorlieben nur, wenn explizit danach gefragt wird - dräng sie nicht ungefragt auf. Du weisst, wie du aussiehst (so wie dein Avatar), und erkennst dich auf Bildern wieder, die dich zeigen.`;

// ---- Aura erkennt sich selbst auf Bildern: Bildsignatur (wird NUR im Browser berechnet, das Bild selbst bleibt unverändert) ----
// Vergleicht kein Gesicht, sondern das GANZE Bild mit Auras eigenen Avatar-Bildern: Struktur (256-Bit-Differenzhash) + grobe Farbverteilung (4x4 Felder).
// Version "v1:<64 Hex>:<96 Hex>". Bleibt bei Verkleinern und neuem Komprimieren nahezu gleich.
const AURA_SIG_W = 170, AURA_SIG_H = 160;
async function auraImageSignature(blob) {
    try {
        const bmp = await createImageBitmap(blob), W = AURA_SIG_W, H = AURA_SIG_H;
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, W, H); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(bmp, 0, 0, W, H); if (bmp.close) bmp.close();
        const px = cx.getImageData(0, 0, W, H).data, cols = 17, rows = 16, bw = W / cols, bh = H / rows;
        const rgb = new Float64Array(cols * rows * 3), gray = new Float64Array(cols * rows);
        for (let by = 0; by < rows; by++) for (let bx = 0; bx < cols; bx++) {
            let r = 0, g = 0, b = 0;
            for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = ((by * bh + y) * W + bx * bw + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; }
            const n = bw * bh, k = (by * cols + bx) * 3; rgb[k] = r / n; rgb[k + 1] = g / n; rgb[k + 2] = b / n; gray[by * cols + bx] = 0.299 * rgb[k] + 0.587 * rgb[k + 1] + 0.114 * rgb[k + 2];
        }
        let hexD = ''; for (let by = 0; by < rows; by++) for (let bx = 0; bx < 16; bx += 4) { let v = 0; for (let j = 0; j < 4; j++) v = (v << 1) | (gray[by * cols + bx + j] > gray[by * cols + bx + j + 1] ? 1 : 0); hexD += v.toString(16); }
        const cuts = [0, 4, 8, 12, 17]; let hexC = '';
        for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) for (let ch = 0; ch < 3; ch++) {
            let s = 0, n = 0; for (let by = gy * 4; by < gy * 4 + 4; by++) for (let bx = cuts[gx]; bx < cuts[gx + 1]; bx++) { s += rgb[(by * cols + bx) * 3 + ch]; n++; }
            hexC += Math.round(s / n).toString(16).padStart(2, '0');
        }
        return 'v1:' + hexD + ':' + hexC;
    } catch (e) { return null; }
}

// Aus einem hochgeladenen Avatar-Video vier Standbilder (Anfang, Viertel, Hälfte, Dreiviertel) als Signaturen ziehen, damit Aura auch Bilder
// dieses eigenen Avatars wiedererkennt. Gibt null zurück, wenn der Browser das Video nicht lesen kann (dann wird der Avatar trotzdem gespeichert).
async function auraVideoSignatures(file) {
    const url = URL.createObjectURL(file);
    try {
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
        await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('Zeitüberschreitung')), 15000); v.onloadeddata = () => { clearTimeout(t); resolve(); }; v.onerror = () => { clearTimeout(t); reject(new Error('Video nicht lesbar')); }; });
        const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 0, sigs = [];
        for (const f of [0, 0.25, 0.5, 0.75]) {
            const target = Math.min(dur * f, Math.max(0, dur - 0.05));
            if (Math.abs(v.currentTime - target) > 0.01) { v.currentTime = target; await new Promise((resolve) => { const t = setTimeout(resolve, 4000); v.onseeked = () => { clearTimeout(t); resolve(); }; }); }
            if (!v.videoWidth || !v.videoHeight) continue;
            const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
            const blob = await new Promise((r) => c.toBlob(r, 'image/png')), s = blob ? await auraImageSignature(blob) : null; if (s && !sigs.includes(s)) sigs.push(s);
        }
        return sigs.length ? sigs : null;
    } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
}

let memoryContext = ''; // im Hintergrund geladen, kein sichtbares UI (siehe loadMemoryContext)

function buildAuraSystemPrompt() {
    const firstName = (currentUser && currentUser.firstname) ? currentUser.firstname.trim() : '';
    const addressing = firstName
        ? `Du sprichst die Person, mit der du chattest, immer per "Du" an (niemals per "Sie") und nennst sie beim Vornamen: ${firstName}. Nutze den Namen natürlich, wo es passt - nicht in jeder einzelnen Antwort zwanghaft.`
        : `Du sprichst die Person, mit der du chattest, immer per "Du" an (niemals per "Sie").`;
    const basePersona = personalPersonaTraits || AURA_PERSONA;
    return `${basePersona} ${addressing}${memoryContext ? ' ' + memoryContext : ''}`;
}

async function loadMemoryContext() {
    try {
        const res = await fetch(`${backendUrl}/memory/context`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        memoryContext = data.context || '';
    } catch (err) {
        console.error('Gedächtnis-Kontext Ladefehler:', err);
    }
}

// --- TAGESRÜCKBLICK (opt-in) ---

function getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function checkDailyRecapAvailability() {
    if (!currentUser || !dailyRecapBanner) return;
    const yesterday = getYesterdayDateString();
    // Nicht erneut anbieten, wenn für dieses Datum schon geklickt/angeschaut wurde
    if (localStorage.getItem('aurachat_recap_seen_' + currentUser.id) === yesterday) {
        console.log('Tagesrückblick: übersprungen, für', yesterday, 'bereits gesehen (localStorage).');
        return;
    }
    try {
        const res = await fetch(`${backendUrl}/daily-recap/check?date=${yesterday}`, { credentials: 'include' });
        const data = await res.json();
        console.log('Tagesrückblick-Prüfung für', yesterday, ':', res.status, data);
        if (data.available) dailyRecapBanner.classList.remove('hidden');
    } catch (err) {
        console.error('Tagesrückblick-Prüfung Ladefehler:', err);
    }
}

let calendarReminderIntervalId = null;

function startCalendarReminderPolling() {
    if (calendarReminderIntervalId) clearInterval(calendarReminderIntervalId);
    if (!currentUser || appConfig.calendar_reminders_enabled !== 'true') return;
    checkCalendarReminder(); // gleich beim Start einmal prüfen, nicht erst nach 60s
    calendarReminderIntervalId = setInterval(checkCalendarReminder, 60000);
}

async function checkCalendarReminder() {
    if (!currentUser || appConfig.calendar_reminders_enabled !== 'true') return;
    try {
        const res = await fetch(`${backendUrl}/calendar/check-reminders`, { credentials: 'include' });
        const data = await res.json();
        if (!data.reminder) return;

        appendMessageToDOM(`🗓️ ${data.reminder.text}`, 'assistant');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        setAvatarSpeaking(true);
        if (speechEnabled) speakText(data.reminder.text, () => setAvatarSpeaking(false), '');
        else setTimeout(() => setAvatarSpeaking(false), 2000);
    } catch (err) {
        console.error('Kalender-Erinnerung Ladefehler:', err);
    }
}

if (dailyRecapBanner) {
    dailyRecapBanner.addEventListener('click', async () => {
        const yesterday = getYesterdayDateString();
        dailyRecapBanner.disabled = true;
        dailyRecapBanner.querySelector('span:last-child').textContent = 'Rückblick wird erstellt...';
        try {
            const res = await fetch(`${backendUrl}/daily-recap/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ date: yesterday })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Rückblick konnte nicht erstellt werden.');
            appendMessageToDOM(`📅 ${data.recap}`, 'assistant');
            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat) {
                currentChat.messages.push({ text: `📅 ${data.recap}`, sender: 'assistant' });
                await saveChatToBackend(currentChat);
            }
            if (currentUser) localStorage.setItem('aurachat_recap_seen_' + currentUser.id, yesterday);
            dailyRecapBanner.classList.add('hidden');
        } catch (err) {
            alert('Fehler: ' + err.message);
            dailyRecapBanner.disabled = false;
            dailyRecapBanner.querySelector('span:last-child').textContent = 'Dein Tagesrückblick auf gestern ist bereit - antippen zum Anzeigen.';
        }
    });
}

// Meldet einen abgeschlossenen Austausch im Hintergrund zur Auswertung - bewusst
// "fire-and-forget" fürs Warten (blockiert die sichtbare Antwort nicht), wertet aber
// aus, ob etwas gemerkt wurde, um kurz das Gehirn-Symbol aufleuchten zu lassen.
function reportExchangeForMemory(userText, assistantText) {
    if (!currentUser || !userText || !assistantText) return;
    fetch(`${backendUrl}/memory/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exchange: `Frage: ${userText}\nAntwort: ${assistantText}` })
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.factsAdded > 0) flashMemoryIndicator();
        })
        .catch(() => { /* nicht kritisch, still ignorieren */ });
}

function flashMemoryIndicator() {
    pulseBrainIndicator();
}

// Lässt das Gehirn-Symbol kurz blau/grün pulsieren (Denkaktivität oder frisch gelernt) -
// danach automatisch zurück auf Rot (Ruhezustand).
let brainPulseTimeout = null;
// Öffnet die Gedächtnis-Übersicht (Klick aufs 🧠) - zeigt gelernte Fakten, bekannte
// Beziehungen und einen einfachen Fortschrittsbalken; beides lässt sich hier auch direkt
// bearbeiten oder löschen, falls Aura etwas falsch verstanden hat.
if (memoryIndicator) {
    memoryIndicator.addEventListener('click', () => {
        document.getElementById('memory-overview-modal').classList.remove('hidden');
        loadMemoryOverview();
    });
}

async function loadMemoryOverview() {
    const factsEl = document.getElementById('memory-overview-facts');
    const triplesEl = document.getElementById('memory-overview-triples');
    try {
        const res = await fetch(`${backendUrl}/memory/overview`, { credentials: 'include' });
        const data = await res.json();

        const milestone = Math.max(50, Math.ceil((data.factCount + 1) / 50) * 50); // wächst mit, keine harte Obergrenze
        const pct = Math.min(100, Math.round((data.factCount / milestone) * 100));
        document.getElementById('memory-overview-bar').style.width = pct + '%';
        document.getElementById('memory-overview-count').textContent = `${data.factCount} Fakten gelernt (wächst unbegrenzt weiter)`;
        document.getElementById('memory-overview-vector-count').textContent = `${data.vectorCount} davon durchsuchbar (Vektorgedächtnis)`;

        factsEl.innerHTML = '';
        if (data.facts.length === 0) {
            factsEl.innerHTML = '<div class="text-slate-500">Noch nichts gelernt - erzähl Aura ein paar persönliche Dinge über dich.</div>';
        } else {
            data.facts.forEach(f => {
                const row = document.createElement('div');
                row.className = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2';
                const textSpan = document.createElement('span');
                textSpan.className = 'text-slate-300 flex-1';
                textSpan.textContent = f.fact;
                const actions = document.createElement('span');
                actions.className = 'flex gap-1 shrink-0';
                const editBtn = document.createElement('button');
                editBtn.className = 'text-slate-500 hover:text-sky-400 text-xs cursor-pointer';
                editBtn.textContent = '✏️';
                editBtn.title = 'Bearbeiten';
                editBtn.addEventListener('click', async () => {
                    const updated = prompt('Fakt bearbeiten:', f.fact);
                    if (updated === null || !updated.trim() || updated.trim() === f.fact) return;
                    try {
                        const r = await fetch(`${backendUrl}/memory/facts/${f.id}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ fact: updated.trim() })
                        });
                        if (!r.ok) throw new Error((await r.json()).error);
                        loadMemoryOverview();
                    } catch (err) { alert(err.message || 'Fehler beim Bearbeiten.'); }
                });
                const delBtn = document.createElement('button');
                delBtn.className = 'text-slate-500 hover:text-red-400 text-xs cursor-pointer';
                delBtn.textContent = '🗑️';
                delBtn.title = 'Löschen';
                delBtn.addEventListener('click', async () => {
                    if (!confirm('Diesen Fakt wirklich löschen?')) return;
                    try {
                        const r = await fetch(`${backendUrl}/memory/facts/${f.id}`, { method: 'DELETE', credentials: 'include' });
                        if (!r.ok) throw new Error((await r.json()).error);
                        loadMemoryOverview();
                    } catch (err) { alert(err.message || 'Fehler beim Löschen.'); }
                });
                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
                row.appendChild(textSpan);
                row.appendChild(actions);
                factsEl.appendChild(row);
            });
        }

        triplesEl.innerHTML = '';
        if (data.triples.length === 0) {
            triplesEl.innerHTML = '<div class="text-slate-500">Noch keine konkreten Beziehungen erkannt.</div>';
        } else {
            data.triples.forEach(t => {
                const row = document.createElement('div');
                row.className = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex items-center justify-between gap-2';
                const textSpan = document.createElement('span');
                textSpan.className = 'flex-1';
                textSpan.innerHTML = `<span class="text-sky-400">${t.subject}</span> → <span class="text-slate-500">${t.predicate}</span> → <span class="text-emerald-400">${t.object}</span>`;
                const actions = document.createElement('span');
                actions.className = 'flex gap-1 shrink-0';
                const editBtn = document.createElement('button');
                editBtn.className = 'text-slate-500 hover:text-sky-400 text-xs cursor-pointer';
                editBtn.textContent = '✏️';
                editBtn.title = 'Bearbeiten';
                editBtn.addEventListener('click', async () => {
                    const subject = prompt('Subjekt:', t.subject);
                    if (subject === null) return;
                    const predicate = prompt('Beziehung:', t.predicate);
                    if (predicate === null) return;
                    const object = prompt('Objekt:', t.object);
                    if (object === null) return;
                    try {
                        const r = await fetch(`${backendUrl}/memory/triples/${t.id}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                            body: JSON.stringify({ subject: subject.trim(), predicate: predicate.trim(), object: object.trim() })
                        });
                        if (!r.ok) throw new Error((await r.json()).error);
                        loadMemoryOverview();
                    } catch (err) { alert(err.message || 'Fehler beim Bearbeiten.'); }
                });
                const delBtn = document.createElement('button');
                delBtn.className = 'text-slate-500 hover:text-red-400 text-xs cursor-pointer';
                delBtn.textContent = '🗑️';
                delBtn.title = 'Löschen';
                delBtn.addEventListener('click', async () => {
                    if (!confirm('Diese Beziehung wirklich löschen?')) return;
                    try {
                        const r = await fetch(`${backendUrl}/memory/triples/${t.id}`, { method: 'DELETE', credentials: 'include' });
                        if (!r.ok) throw new Error((await r.json()).error);
                        loadMemoryOverview();
                    } catch (err) { alert(err.message || 'Fehler beim Löschen.'); }
                });
                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
                row.appendChild(textSpan);
                row.appendChild(actions);
                triplesEl.appendChild(row);
            });
        }
    } catch {
        factsEl.innerHTML = '<div class="text-red-400">Konnte nicht geladen werden.</div>';
    }
}
const memoryOverviewCloseBtn = document.getElementById('memory-overview-close-btn');
if (memoryOverviewCloseBtn) {
    memoryOverviewCloseBtn.addEventListener('click', () => {
        document.getElementById('memory-overview-modal').classList.add('hidden');
    });
}

function pulseBrainIndicator() {
    if (!memoryIndicator) return;
    memoryIndicator.classList.remove('brain-idle');
    memoryIndicator.classList.add('brain-active');
    clearTimeout(brainPulseTimeout);
    brainPulseTimeout = setTimeout(() => {
        memoryIndicator.classList.remove('brain-active');
        memoryIndicator.classList.add('brain-idle');
    }, 2500);
}

// iOS Safari verlangt, dass echte Sprachausgabe zeitlich nah an einer echten Berührung
// ausgelöst wird - bei einer KI-Antwort vergeht durch die Netzwerk-Anfrage oft zu viel
// Zeit dazwischen, iOS verwirft die Sprachausgabe dann still, ohne Fehler. Der übliche
// Umgehung: EINMAL pro Sitzung, direkt bei einer echten Berührung (hier: Absenden der
// Nachricht, noch bevor irgendein "await" den Berührungs-Zusammenhang unterbricht), eine
// winzige, fast unhörbare Testansage abspielen - das "entriegelt" die Sprachausgabe-
// Engine für den Rest der Sitzung, auch für spätere, verzögerte Ansagen.
let speechSynthesisUnlocked = false;
function unlockSpeechSynthesisForIOS() {
    if (speechSynthesisUnlocked || !window.speechSynthesis) return;
    speechSynthesisUnlocked = true;
    const unlockUtterance = new SpeechSynthesisUtterance(' ');
    unlockUtterance.volume = 0;
    window.speechSynthesis.speak(unlockUtterance);
}

// Zweite, unabhängige iOS-Freischaltung: NICHT dasselbe wie die Sprachsynthese oben - das
// hier betrifft die eigene Server-Stimme (per <audio>-Element abgespielt). iOS blockiert
// audio.play(), wenn es nicht direkt in einer echten Berührung ausgelöst wird; bis die
// Server-Antwort da ist, ist dieses Zeitfenster oft schon vorbei. Ein einmaliges, kurzes
// (aber mit echter Dauer, nicht 0 Samples) stilles Abspielen HIER entriegelt die spätere,
// verzögerte echte Ansage - dasselbe <audio>-Element wird für die echte Ansage wiederverwendet
// (nicht ein neues erzeugt), da manche iOS-Versionen die Freischaltung nur pro Element zählen.
let htmlAudioUnlocked = false;
const sharedAudioElement = new Audio();
function unlockHtmlAudioForIOS() {
    if (htmlAudioUnlocked) return;
    htmlAudioUnlocked = true;
    sharedAudioElement.src = 'data:audio/wav;base64,UklGRogAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
    sharedAudioElement.play().catch(() => {}); // falls doch blockiert: harmlos, betrifft nur diesen einen stillen Testton
}

chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        unlockSpeechSynthesisForIOS();
        unlockHtmlAudioForIOS();
        const text = userInput.value.trim();
        if (!text && selectedFiles.length === 0) return;
        if (isRecording && recognition) recognition.stop();

        let base64Image = null;
        let imageName = '';          // Name des Bildes (fürs Chat-Gedächtnis des Servers)
        let imageFile = null;        // das erste Bild als Datei: daraus entsteht die Signatur, mit der Aura sich selbst erkennt
        const fileItems = [];         // Text-Dateien dieser Nachricht, damit der Server sie für spätere Fragen im selben Chat merken kann
        let fileContext = "";
        let displayMessage = text;
        const fileTags = [];

        for (const file of selectedFiles) {
            fileTags.push(file.type.startsWith('video/') ? `[🎥 Video: ${file.name}]` : `[📎 Datei: ${file.name}]`);
            if (file.type.startsWith('image/')) {
                if (!base64Image) { // nur das erste Bild geht an die Bilderkennung der KI - bei mehreren wird nur eins ausgewertet
                    imageName = file.name;
                    imageFile = file;
                    base64Image = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                }
            } else if (file.type.startsWith('video/')) {
                // Video wird nur als Anhang mitgeschickt/angezeigt - aktuelle KI-Modelle können
                // kein Video "sehen", deshalb bewusst NICHT als Text-Kontext eingelesen (das
                // würde nur binären Datenmüll an die KI schicken).
            } else {
                const fileText = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsText(file);
                });
                fileContext += (fileContext ? '\n\n' : '') + `--- ${file.name} ---\n${fileText}`;
                if (typeof fileText === 'string' && fileText.trim()) fileItems.push({ name: file.name, text: fileText });
            }
        }
        // Aura erkennt sich selbst: Signatur des Bildes (nur Zahlen, im Browser berechnet; das Bild selbst geht unverändert wie bisher)
        const imageSig = (imageFile && currentUser) ? await auraImageSignature(imageFile) : null;
        if (fileTags.length > 0) displayMessage = text ? `${text}\n${fileTags.join('\n')}` : fileTags.join('\n');

        // Datums-/Uhrzeit-Fragen, Mathe und Integrations-Befehle direkt beantworten,
        // ohne die KI überhaupt zu fragen (Status VOR dem Zurücksetzen von
        // selectedFiles/base64Image geprüft!)
        clearConfirmRow(); // Knöpfe eines früheren Vorschlags verschwinden mit der nächsten Nachricht ("bestätigen" tippen geht weiter)
        const directDateTimeAnswer = (!base64Image && !fileContext) ? tryAnswerDateTime(text) : null;
        const directMathAnswer = (!base64Image && !fileContext && !directDateTimeAnswer) ? tryAnswerMath(text) : null;
        const directIntegrationAnswer = (!base64Image && !fileContext && !directDateTimeAnswer && !directMathAnswer && currentUser)
            ? await tryMatchIntegration(text)
            : null;
        const directAnswer = directDateTimeAnswer || directMathAnswer || directIntegrationAnswer;

        await appendMessage(displayMessage, 'user');
        userInput.value = '';
        selectedFiles = [];
        if (fileInput) fileInput.value = '';
        if (filePreviewContainer) {
            filePreviewContainer.classList.remove('flex');
            filePreviewContainer.classList.add('hidden');
        }

        if (directAnswer) {
            const answerBubble = appendMessageToDOM(directAnswer, 'assistant');
            if (directIntegrationAnswer && pendingIntegrationConfirm) { renderConfirmButtons(answerBubble, pendingIntegrationConfirm); pendingIntegrationConfirm = null; }
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat) {
                currentChat.messages.push({ text: directAnswer, sender: 'assistant' });
                await saveChatToBackend(currentChat);
            }
            setAvatarSpeaking(true);
            if (speechEnabled) speakText(directAnswer, () => setAvatarSpeaking(false), text, voiceLangFor(directDateTimeAnswer ? lastDirectLang : null));
            else setTimeout(() => setAvatarSpeaking(false), 2500);
            return;
        }

        // Erinnerung auf Zuruf (kostenlos) - KI wird dafür nicht gebraucht
        const reminderRequest = extractReminderRequest(text);
        if (reminderRequest) {
            if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
            const reminder = { id: 'r_' + Date.now(), message: reminderRequest.message, fireAt: Date.now() + reminderRequest.delayMs };
            reminders.push(reminder);
            saveReminders();
            scheduleReminder(reminder);
            appendMessageToDOM(`⏰ Alles klar, ich erinnere dich in ${reminderRequest.amount} ${reminderRequest.unitLabel} an: ${reminderRequest.message}`, 'assistant');
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
            setAvatarSpeaking(true);
            setTimeout(() => setAvatarSpeaking(false), 2000);
            return;
        }

        // PDF auf Zuruf (kostenlos) - eigener Ablauf, KI wird dafür nicht gebraucht
        if (!base64Image && !fileContext) {
            const pdfContent = extractPdfRequest(text);
            if (pdfContent) {
                const loadingBubble = appendMessageToDOM('📄 PDF wird erstellt...', 'assistant');
                if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
                showTopLoadingBar();
                try {
                    const res = await fetch(`${backendUrl}/pdf/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ content: pdfContent })
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || `Status ${res.status}`);
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    loadingBubble.innerHTML = '';
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `dokument-${Date.now()}.pdf`;
                    link.className = 'inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white transition no-underline';
                    link.innerHTML = '📄 <span>PDF herunterladen</span>';
                    loadingBubble.appendChild(link);

                    const currentChat = chats.find(c => c.id === currentChatId);
                    if (currentChat) {
                        // Der Download-Link selbst wird bewusst NICHT gespeichert (Blob-URLs
                        // funktionieren nach einem Neuladen der Seite ohnehin nicht mehr) -
                        // nur ein Hinweis, dass hier ein PDF erstellt wurde.
                        currentChat.messages.push({ text: '📄 PDF erstellt.', sender: 'assistant' });
                        await saveChatToBackend(currentChat);
                    }
                    setAvatarSpeaking(true);
                    setTimeout(() => setAvatarSpeaking(false), 2000);
                } catch (err) {
                    loadingBubble.textContent = '✗ PDF konnte nicht erstellt werden: ' + err.message;
                    loadingBubble.classList.add('text-red-400');
                } finally {
                    hideTopLoadingBar();
                }
                return;
            }
        }

        // Bildgenerierung (Premium) - eigener Ablauf mit Lade-Hinweis, da das je nach
        // Server/Auflösung deutlich länger dauern kann als eine normale Textantwort.
        if (!base64Image && !fileContext) {
            const imagePrompt = extractImagePrompt(text);
            if (imagePrompt && licenseFeatures.includes('image_gen') && appConfig.image_gen_platform && appConfig.image_gen_platform !== 'none') {
                const loadingBubble = appendMessageToDOM('🎨 Bild wird erstellt (kann bis zu einer Minute dauern)...', 'assistant');
                if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
                showTopLoadingBar();
                try {
                    const result = await tryGenerateImage(text);
                    loadingBubble.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = `data:image/png;base64,${result.image}`;
                    img.className = 'rounded-xl max-w-full';
                    loadingBubble.appendChild(img);

                    const currentChat = chats.find(c => c.id === currentChatId);
                    if (currentChat) {
                        currentChat.messages.push({ text: '', sender: 'assistant', image: result.image });
                        await saveChatToBackend(currentChat);
                    }
                    setAvatarSpeaking(true);
                    setTimeout(() => setAvatarSpeaking(false), 2500);
                } catch (err) {
                    loadingBubble.textContent = '✗ Bild konnte nicht erstellt werden: ' + err.message;
                    loadingBubble.classList.add('text-red-400');
                } finally {
                    hideTopLoadingBar();
                }
                return;
            }
        }

        const assistantBubble = appendMessageToDOM((webSearchEnabled || workspaceEnabled) ? '🔍 Suche läuft...' : '...', 'assistant');
        showTopLoadingBar();

        try {
            let promptText = text + (fileContext ? `\n\nInhalt der Datei(en):\n${fileContext}` : "");
            let sources = [];
            let contextSections = [];
            let searchNote = '';

            // Web-Suche und/oder Workspace-Dokumente einbeziehen - nur bei reinen Text-Fragen, nicht bei Bild-Uploads
            if ((webSearchEnabled || workspaceEnabled) && !base64Image) {
                if (webSearchEnabled) {
                    const results = await fetchWebSearchResults(text);
                    if (results === null) {
                        searchNote += '\n\n⚠️ Web-Suche war gerade nicht erreichbar.';
                    } else if (results.length > 0) {
                        sources = results;
                        contextSections.push(
                            'Aktuelle Web-Suchergebnisse:\n' +
                            results.map((r, i) => `${i + 1}. ${r.title}\n${r.content}\nQuelle: ${r.url}`).join('\n\n')
                        );
                    }
                }
                if (workspaceEnabled) {
                    const chunks = await fetchWorkspaceChunks(text);
                    if (chunks === null) {
                        searchNote += '\n\n⚠️ Workspace-Dokumente waren gerade nicht erreichbar.';
                    } else if (chunks.length > 0) {
                        contextSections.push(
                            'Relevante Abschnitte aus deinen eigenen Workspace-Dokumenten:\n' +
                            chunks.map((c, i) => `${i + 1}. Aus "${c.filename}":\n${c.chunk}`).join('\n\n')
                        );
                    }
                }

                if (contextSections.length > 0) {
                    promptText = `${contextSections.join('\n\n---\n\n')}\n\nBeantworte anhand dieser Informationen (ergänze bei Bedarf mit eigenem Wissen) folgende Frage, in derselben Sprache wie die Frage gestellt wurde:\n\n${text}`;
                }
                assistantBubble.textContent = '...';
            }

            // Läuft komplett übers Backend - nie direkt aus dem Browser zur KI (API-Keys bleiben
            // serverseitig, funktioniert auch wenn der KI-Server nur http anbietet während die
            // Seite selbst https ist, und der Server statt des jeweiligen Geräts muss den
            // konfigurierten KI-Server erreichen können).
            // Chat-Gedächtnis: Kennung des Chats, kurzer Verlauf und die Dateien dieser Nachricht (der Server merkt sie sich für spätere Fragen im selben Chat)
            const memChat = chats.find(c => c.id === currentChatId);
            const chatPayload = JSON.stringify({ message: promptText, image: base64Image || undefined, imageName: currentUser && base64Image ? imageName : undefined, imageSig: currentUser && base64Image && imageSig ? imageSig : undefined, files: currentUser && fileItems.length ? fileItems : undefined, chatId: currentUser && memChat ? memChat.id : undefined, history: currentUser && memChat ? buildChatHistoryForServer(memChat.messages) : undefined, codeMode: codeModeEnabled || undefined, lang: currentUser ? appConfig.ui_lang : guestLang });
            const sendChat = () => fetch(`${backendUrl}/chat/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: chatPayload });
            let res = await sendChat();
            // Gast-Sitzung abgelaufen (Pause)? Einmal still erneuern und die Frage wiederholen.
            if (res.status === 401 && !currentUser && guestChatEnabled) {
                await startGuestSession();
                if (guestChatEnabled) res = await sendChat();
            }
            const data = await readJsonResponse(res);
            if (!res.ok) {
                if (!currentUser && (res.status === 401 || res.status === 403)) {
                    if (res.status === 403) guestChatEnabled = false; // der Admin hat den Gast-Chat inzwischen ausgeschaltet
                    throw new Error(guestChatEnabled ? gt('expired') : gt('needLogin'));
                }
                throw new Error(data.error || `Status ${res.status}`);
            }
            let reply = data.reply || 'Keine Antwort erhalten.';
            if (data.brainActive) pulseBrainIndicator();

            const replyForSpeech = reply; // ohne Quellen-Liste/Hinweise - die sollen nicht vorgelesen werden

            if (sources.length > 0) {
                reply += '\n\nQuellen:\n' + sources.map((s, i) => `${i + 1}. ${s.title} – ${s.url}`).join('\n');
            }
            reply += searchNote;
            renderMessageContent(assistantBubble, reply);
            if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;

            const currentChat = chats.find(c => c.id === currentChatId);
            if (currentChat) {
                currentChat.messages.push({ text: reply, sender: 'assistant' });
                await saveChatToBackend(currentChat);
            }
            reportExchangeForMemory(text, replyForSpeech);

            setAvatarSpeaking(true);
            if (speechEnabled) {
                speakText(replyForSpeech, () => setAvatarSpeaking(false), text, voiceLangFor(data.lang));
            } else {
                setTimeout(() => setAvatarSpeaking(false), 2500);
            }
        } catch (err) {
            console.error('Chat-Fehler:', err);
            assistantBubble.textContent = 'Fehler: ' + err.message;
            assistantBubble.classList.add('text-red-400');
            setAvatarSpeaking(false);
        } finally {
            hideTopLoadingBar();
        }
    });

    // Wechselt zwischen Idle- und Sprechen-Video des aktiven Avatars.
    function setAvatarSpeaking(isSpeaking) {
        if (!avatarImg) return;
        const defaultSrc = avatarImg.getAttribute('data-default-src');
        const speechSrc = avatarImg.getAttribute('data-speech-src');
        if (isSpeaking && speechSrc) {
            avatarImg.src = speechSrc;
            avatarImg.load();
            avatarImg.play().catch(() => {});
            if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            pauseHeyAuraTemporarily(); // sonst würde "Hey Aura" sich selbst zuhören
        } else {
            if (defaultSrc) {
                avatarImg.src = defaultSrc;
                avatarImg.load();
                avatarImg.play().catch(() => {});
            }
            if (liveDot) liveDot.className = "w-2 h-2 rounded-full bg-slate-500";
            if (voiceModeActive && voiceModeStatus) voiceModeStatus.textContent = 'Tippe auf Aura, um mit ihr zu sprechen';
            resumeHeyAuraIfNeeded();
        }
    }

    // --- SONDERZEICHEN/EMOJIS BEIM VORLESEN ENTFERNEN ---
    // Ausnahme: wenn die Nutzerfrage selbst explizit nach Sonderzeichen/Symbolen/
    // Emojis fragt, wird der Text unverändert vorgelesen (Frage würde sonst
    // keinen Sinn mehr ergeben).
    function shouldPreserveSymbolsInSpeech(userQuestion) {
        if (!userQuestion) return false;
        return /sonderzeichen|symbol|emoji|smiley|satzzeichen|special character/i.test(userQuestion);
    }

    function stripForSpeech(text) {
        let cleaned = text;
        const isEnglish = appConfig.ui_lang === 'en';
        // Multiplikation zwischen Zahlen zuerst natürlich aussprechbar machen (23*17 -> 23 mal 17),
        // bevor die generelle Markdown-Bereinigung darunter das Sternchen sonst nur durch ein Leerzeichen ersetzt
        cleaned = cleaned.replace(/(\d)\s*\*\s*(\d)/g, `$1 ${isEnglish ? 'times' : 'mal'} $2`);
        // Emojis (breiter Unicode-Bereich, deckt die meisten gängigen Emoji-Blöcke ab)
        cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '');
        // Markdown-Formatierung entfernen, Inhalt bleibt (z.B. "**wichtig**" -> " wichtig ").
        // Durch Leerzeichen statt Leerstring ersetzen, sonst würde z.B. Text ohne Leerzeichen verschmelzen!
        cleaned = cleaned.replace(/[*_~`#>]+/g, ' ');
        // Trennlinien wie "---" oder "===" komplett entfernen
        cleaned = cleaned.replace(/^[-=]{3,}\s*$/gm, '');
        // Aufzählungszeichen am Zeilenanfang entfernen ("- Punkt" -> "Punkt")
        cleaned = cleaned.replace(/^\s*[-•]\s+/gm, '');
        // Mehrfache Leerzeichen/Zeilenumbrüche glätten
        cleaned = cleaned.replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
        return cleaned;
    }

    // Sprache der Stimme: Gäste sprechen in der Sprache der Antwort. Angemeldete Personen nur, wenn sie nicht Deutsch ist;
    // Deutsch bleibt bei der eingestellten Stimme (wie bisher). Ohne Angabe (null) gilt die eingestellte Stimme.
    function voiceLangFor(lang) {
        if (!lang || !GUEST_LANGS.includes(lang)) return null;
        return currentUser && lang === 'de' ? null : lang;
    }

    function speakText(text, onEndCallback, userQuestion, lang) {
        text = removeCodeForSpeech(text, userQuestion);
        const spokenText = shouldPreserveSymbolsInSpeech(userQuestion) ? text : stripForSpeech(text);
        const useCustomTts = ((appConfig.tts_stt_platform && appConfig.tts_stt_platform !== 'browser') || (appConfig.tts_wyoming_enabled === 'true' && appConfig.tts_wyoming_host)) && licenseFeatures.includes('tts_stt');
        if (useCustomTts) {
            speakTextViaServer(spokenText, onEndCallback, lang);
            return;
        }
        speakTextViaBrowser(spokenText, onEndCallback, lang);
    }

    // Browser-Stimme: die gewählte Stimme, solange sie zur Sprache des Textes passt; sonst die erste passende des Geräts.
    // Ohne Sprache (alle angemeldeten Personen) bleibt es bei der gewählten Stimme wie bisher.
    function pickBrowserVoice(voices, lang, preferredName) {
        const preferred = preferredName ? voices.find(v => v.name === preferredName) : null;
        if (!lang) return preferred || null;
        const matches = (v) => String(v.lang || '').toLowerCase().replace('_', '-').startsWith(lang);
        if (preferred && matches(preferred)) return preferred;
        const same = voices.filter(matches);
        if (same.length) return same.find(v => v.localService) || same.find(v => v.default) || same[0];
        return preferred || null;
    }

    function speakTextViaBrowser(text, onEndCallback, lang) {
        if (!window.speechSynthesis) {
            if (onEndCallback) onEndCallback();
            return;
        }
        // "cancel()" und gleich danach "speak()" verschluckt in Chrome und Safari oft die neue Äusserung, besonders beim ersten
        // Mal, wenn die Sprachausgabe noch startet (z.B. direkt nach der stillen Freischaltung beim Klick). Deshalb nur
        // abbrechen, wenn wirklich etwas läuft, und dann kurz warten.
        const synthBusy = !!(window.speechSynthesis.speaking || window.speechSynthesis.pending);
        if (synthBusy) window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (browserVoices.length === 0) browserVoices = window.speechSynthesis.getVoices();
        const chosenVoice = pickBrowserVoice(browserVoices, lang, appConfig.avatar_voice);
        if (chosenVoice) utterance.voice = chosenVoice;
        if (lang) utterance.lang = (chosenVoice && chosenVoice.lang) || SPEECH_LOCALES[lang] || 'de-DE';

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearInterval(keepAliveInterval);
            clearTimeout(safetyTimeout);
            if (onEndCallback) onEndCallback();
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        // Bekannter Chrome-Bug: speechSynthesis "verstummt" bei längeren Texten nach ca.
        // 15 Sekunden (genau das Szenario bei normalen, längeren KI-Antworten - kurze
        // Direktantworten wie die Uhrzeit sind davon praktisch nie betroffen). Ein
        // periodisches Pause/Resume hält die Wiedergabe zuverlässig am Laufen.
        const keepAliveInterval = setInterval(() => {
            if (!window.speechSynthesis.speaking) { clearInterval(keepAliveInterval); return; }
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
        }, 10000);

        // Sicherheitsnetz: falls onend/onerror aus irgendeinem Grund nie feuern (ebenfalls
        // ein bekanntes Browser-Verhalten), trotzdem nicht für immer im "spricht"-Zustand
        // hängen bleiben - Mindestlaufzeit grosszügig an der Textlänge bemessen.
        const safetyTimeout = setTimeout(finish, Math.max(8000, text.length * 120));

        if (synthBusy) setTimeout(() => window.speechSynthesis.speak(utterance), 150);
        else window.speechSynthesis.speak(utterance);
    }

    // Eigener/anderer TTS-Server, läuft über das Backend (siehe STT-Umstellung oben - gleicher Grund: Mixed Content auf https)
    async function speakTextViaServer(text, onEndCallback, lang) {
        try {
            const res = await fetch(`${backendUrl}/tts/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ text, lang: lang || undefined })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'TTS-Server Fehler');
            }
            const audioBlob = await res.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = sharedAudioElement; // wiederverwendet, nicht neu erzeugt (siehe unlockHtmlAudioForIOS)
            audio.src = audioUrl;
            audio.onended = () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); };
            audio.onerror = () => { URL.revokeObjectURL(audioUrl); if (onEndCallback) onEndCallback(); };
            await audio.play(); // Browser können das ablehnen (z.B. Autoplay-Regeln, wenn nicht direkt durch einen Klick ausgelöst) - dann greift der catch unten
        } catch (err) {
            console.error('TTS-Server nicht erreichbar oder Wiedergabe blockiert, falle auf Browser-Sprachausgabe zurück:', err);
            speakTextViaBrowser(text, onEndCallback, lang);
        }
    }

    // --- WIDGETS (Uhr / Wetter) - im Stil kompakter Apple-artiger Kacheln ---

    let widgets = [];
    let pendingWidgetType = null;
    let clockIntervalStarted = false;
    let auraplanIntervalStarted = false;
    let moodIntervalStarted = false;
    let auraticketIntervalStarted = false;
    let aitimeIntervalStarted = false;

    function loadWidgets() {
        try {
            widgets = JSON.parse(localStorage.getItem('aurachat_widgets') || '[]');
        } catch (err) {
            widgets = [];
        }
        renderWidgets();
    }

    function saveWidgets() {
        localStorage.setItem('aurachat_widgets', JSON.stringify(widgets));
    }

    // Analoges Ziffernblatt als SVG - wird jede Sekunde direkt aktualisiert (eigener,
    // schnellerer Takt als der allgemeine 60s-Refresh der anderen Widgets)
    function renderAnalogClockSVG() {
        const now = new Date();
        const s = now.getSeconds();
        const m = now.getMinutes();
        const h = now.getHours() % 12;
        const secAngle = s * 6;
        const minAngle = m * 6 + s * 0.1;
        const hourAngle = h * 30 + m * 0.5;
        return `
            <svg viewBox="0 0 40 40" class="w-full h-full">
                <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                ${[0, 90, 180, 270].map(a => `<line x1="20" y1="3" x2="20" y2="5.5" stroke="white" stroke-width="1.5" transform="rotate(${a} 20 20)"/>`).join('')}
                <line x1="20" y1="20" x2="20" y2="9" stroke="white" stroke-width="2" stroke-linecap="round" transform="rotate(${hourAngle} 20 20)"/>
                <line x1="20" y1="20" x2="20" y2="6" stroke="white" stroke-width="1.5" stroke-linecap="round" transform="rotate(${minAngle} 20 20)"/>
                <line x1="20" y1="20" x2="20" y2="5" stroke="#f87171" stroke-width="1" stroke-linecap="round" transform="rotate(${secAngle} 20 20)"/>
                <circle cx="20" cy="20" r="1.5" fill="white"/>
            </svg>`;
    }

    function widgetCardBaseClass(gradient) {
        return `group relative w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${gradient} border border-white/10 shadow-lg flex flex-col items-center justify-center overflow-hidden`;
    }

    function formatTimerDisplay(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function notifyTimerDone(widget) {
        const title = 'AuraChat Timer';
        const body = `${Math.round(widget.durationSeconds / 60)}-Minuten-Timer ist abgelaufen.`;
        if (window.Notification && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/api/branding/icon' });
        }
        appendMessageToDOM(`⏱️ ${body}`, 'assistant');
        if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
        setAvatarSpeaking(true);
        if (speechEnabled) speakText(body, () => setAvatarSpeaking(false), '');
        else setTimeout(() => setAvatarSpeaking(false), 2000);
    }

    function renderWidgets() {
        if (!widgetsBar) return;
        widgetsBar.innerHTML = '';
        widgets.forEach((w) => {
            const card = document.createElement('div');
            card.dataset.widgetId = w.id;
            const gradient = w.type === 'clock' ? 'from-slate-700 to-slate-900' : (w.type === 'timer' ? 'from-orange-600 to-red-800' : 'from-sky-500 to-blue-700');
            card.className = widgetCardBaseClass(gradient);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'hidden group-hover:flex absolute -top-1 -right-1 w-4 h-4 bg-slate-900 border border-slate-600 rounded-full items-center justify-center text-[9px] text-slate-300 hover:text-red-400 hover:border-red-400 cursor-pointer z-10';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                widgets = widgets.filter(x => x.id !== w.id);
                saveWidgets();
                renderWidgets();
            });
            card.appendChild(removeBtn);

            if (w.type === 'clock') {
                const clockWrap = document.createElement('div');
                clockWrap.className = 'w-9 h-9';
                clockWrap.innerHTML = renderAnalogClockSVG();
                clockWrap.dataset.clockFace = 'true';
                card.appendChild(clockWrap);
            } else if (w.type === 'timer') {
                card.classList.add('cursor-pointer');
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-sm leading-none';
                iconSpan.textContent = w.running ? '⏸️' : '▶️';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5 font-mono';
                valueSpan.textContent = formatTimerDisplay(w.remainingSeconds);
                valueSpan.dataset.timerFace = w.id;
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                card.addEventListener('click', () => {
                    if (w.remainingSeconds <= 0) { w.remainingSeconds = w.durationSeconds; }
                    w.running = !w.running;
                    saveWidgets();
                    renderWidgets();
                });
            } else if (w.type === 'auraplan') {
                card.classList.add('cursor-pointer');
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-lg leading-none';
                iconSpan.textContent = '📅';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5 font-mono';
                valueSpan.textContent = '...';
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                card.addEventListener('click', () => toggleAuraplanClock(card, iconSpan, valueSpan));
                updateAuraplanWidget(card, iconSpan, valueSpan);
            } else if (w.type === 'auraticket') {
                card.classList.add('cursor-pointer');
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-lg leading-none';
                iconSpan.textContent = '🎫';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5 font-mono';
                valueSpan.textContent = '...';
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                card.addEventListener('click', () => {
                    if (appConfig.auraticket_url) window.open(appConfig.auraticket_url, '_blank', 'noopener');
                });
                updateAuraticketWidget(card, iconSpan, valueSpan);
            } else if (w.type === 'aitime') {
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-lg leading-none';
                iconSpan.textContent = '⏱️';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5 font-mono';
                valueSpan.textContent = '...';
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                updateAitimeWidget(card, iconSpan, valueSpan);
            } else if (w.type === 'mood') {
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-lg leading-none';
                iconSpan.textContent = '🙂';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5';
                valueSpan.textContent = '...';
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                updateMoodWidget(iconSpan, valueSpan);
            } else {
                const iconSpan = document.createElement('div');
                iconSpan.className = 'text-lg leading-none';
                iconSpan.textContent = '☀️';
                const valueSpan = document.createElement('div');
                valueSpan.className = 'text-[10px] font-semibold text-white leading-tight mt-0.5';
                valueSpan.textContent = '...';
                card.appendChild(iconSpan);
                card.appendChild(valueSpan);
                updateWeatherWidget(w, valueSpan);
            }

            widgetsBar.appendChild(card);
        });

        if (!clockIntervalStarted) {
            clockIntervalStarted = true;
            setInterval(() => {
                document.querySelectorAll('[data-clock-face="true"]').forEach(el => {
                    el.innerHTML = renderAnalogClockSVG();
                });

                let timersChanged = false;
                widgets.forEach(w => {
                    if (w.type !== 'timer' || !w.running) return;
                    w.remainingSeconds = Math.max(0, w.remainingSeconds - 1);
                    timersChanged = true;
                    const el = document.querySelector(`[data-timer-face="${w.id}"]`);
                    if (el) el.textContent = formatTimerDisplay(w.remainingSeconds);
                    if (w.remainingSeconds === 0) {
                        w.running = false;
                        notifyTimerDone(w);
                        renderWidgets();
                    }
                });
                if (timersChanged) saveWidgets();
            }, 1000);
        }

        if (!auraplanIntervalStarted && widgets.some(w => w.type === 'auraplan')) {
            auraplanIntervalStarted = true;
            setInterval(() => {
                widgets.forEach(w => {
                    if (w.type !== 'auraplan') return;
                    const card = document.querySelector(`[data-widget-id="${w.id}"]`);
                    if (!card) return;
                    const iconSpan = card.children[1]; // 0=Entfernen-Knopf, 1=Icon, 2=Wert
                    const valueSpan = card.children[2];
                    if (iconSpan && valueSpan) updateAuraplanWidget(card, iconSpan, valueSpan);
                });
            }, 60000);
        }

        if (!auraticketIntervalStarted && widgets.some(w => w.type === 'auraticket')) {
            auraticketIntervalStarted = true;
            setInterval(() => {
                widgets.forEach(w => {
                    if (w.type !== 'auraticket') return;
                    const card = document.querySelector(`[data-widget-id="${w.id}"]`);
                    if (!card) return;
                    const iconSpan = card.children[1]; // 0=Entfernen-Knopf, 1=Icon, 2=Wert
                    const valueSpan = card.children[2];
                    if (iconSpan && valueSpan) updateAuraticketWidget(card, iconSpan, valueSpan);
                });
            }, 60000);
        }

        if (!aitimeIntervalStarted && widgets.some(w => w.type === 'aitime')) {
            aitimeIntervalStarted = true;
            setInterval(() => {
                widgets.forEach(w => {
                    if (w.type !== 'aitime') return;
                    const card = document.querySelector(`[data-widget-id="${w.id}"]`);
                    if (!card) return;
                    const iconSpan = card.children[1];
                    const valueSpan = card.children[2];
                    if (iconSpan && valueSpan) updateAitimeWidget(card, iconSpan, valueSpan);
                });
            }, 5000);
        }

        if (!moodIntervalStarted && widgets.some(w => w.type === 'mood')) {
            moodIntervalStarted = true;
            setInterval(() => {
                widgets.forEach(w => {
                    if (w.type !== 'mood') return;
                    const card = document.querySelector(`[data-widget-id="${w.id}"]`);
                    if (!card) return;
                    const iconSpan = card.children[1];
                    const valueSpan = card.children[2];
                    if (iconSpan && valueSpan) updateMoodWidget(iconSpan, valueSpan);
                });
            }, 5 * 60000);
        }
    }

    const MOOD_EMOJI = { red: '😟', orange: '😕', yellow: '😐', lightgreen: '🙂', green: '😊' };
    async function updateMoodWidget(iconSpan, valueSpan) {
        try {
            const res = await fetch(`${backendUrl}/mood/current`, { credentials: 'include' });
            const data = await res.json();
            iconSpan.textContent = MOOD_EMOJI[data.color] || '🙂';
            valueSpan.textContent = data.label || '';
        } catch {
            valueSpan.textContent = 'n/a';
        }
    }

    // Liest eine Server-Antwort als JSON. Kommt statt JSON eine HTML-Seite zurück (z.B. nginx' "504 Gateway
    // Time-out"), erscheint eine verständliche Meldung statt "Unexpected token '<' ... is not valid JSON".
    async function readJsonResponse(res) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            if (res.status === 504) throw new Error('Der Server hat nicht rechtzeitig geantwortet (HTTP 504). Bei Code-Fragen lädt die KI evtl. gerade erst das Coding-Modell. Bitte gleich nochmal versuchen.');
            if (res.status === 502 || res.status === 503) throw new Error(`Der Server ist gerade nicht erreichbar oder startet neu (HTTP ${res.status}). Bitte in einigen Sekunden nochmal versuchen.`);
            throw new Error(`Unerwartete Antwort vom Server (HTTP ${res.status}).`);
        }
    }

    // Widget "Denkzeit": voraussichtliche Wartezeit für eine normale Frage (Haupt-Modell), gemessen aus den
    // bisherigen Antworten. Ist ein Modell gerade NICHT geladen, kommt die typische Ladezeit dazu - genau das
    // erklärt, warum die erste Code-Frage oft so lange dauert. Der Hinweis-Text zeigt alle Modelle.
    function formatDuration(ms) {
        if (ms === null || ms === undefined) return '–';
        if (ms < 10000) return (ms / 1000).toFixed(1) + 's';
        if (ms < 60000) return Math.round(ms / 1000) + 's';
        const total = Math.round(ms / 1000);
        return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
    }
    async function updateAitimeWidget(card, iconSpan, valueSpan) {
        try {
            const res = await fetch(`${backendUrl}/ai-timing`, { credentials: 'include' });
            const data = await res.json();
            const norm = (n) => String(n || '').toLowerCase().replace(/:latest$/, '');
            const running = (data.running && data.running.length) ? data.running : null;
            const main = data.models.find(m => norm(m.model) === norm(data.mainModel));
            let shown = null, approx = false;
            if (main && main.expectedMs !== null) { shown = main.expectedMs; approx = true; }
            else if (data.last && !data.last.error) { shown = data.last.wallMs; }
            const lastFailed = !!(data.last && data.last.error);
            if (shown === null && !lastFailed && !running) {
                valueSpan.textContent = '–';
                card.title = 'Noch keine Antwort gemessen. Stelle eine Frage: Während sie läuft, zeigt die Karte die Wartezeit live, danach die Denkzeit.';
                return;
            }

            const lines = [];
            if (running) {
                running.forEach(r => lines.push(`⏳ Läuft gerade: ${r.model} seit ${formatDuration(r.ms)} (Modell wird geladen oder die Antwort wird erzeugt)`));
                lines.push('');
            }
            if (data.last) {
                lines.push(data.last.error
                    ? `Letzte Anfrage fehlgeschlagen (${data.last.model}, nach ${formatDuration(data.last.wallMs)}): ${data.last.error}`
                    : `Letzte Antwort: ${data.last.model} in ${formatDuration(data.last.wallMs)}` + (data.last.loadMs >= 1500 ? ` (davon ${formatDuration(data.last.loadMs)} Modell laden)` : ''));
            }
            if (data.models.length) lines.push('', 'Voraussichtlich für die nächste Antwort:');
            data.models.forEach(m => {
                if (m.expectedMs === null) return;
                const tag = m.loaded ? 'geladen' : (m.coldLoadMs ? `nicht geladen, Laden ≈ ${formatDuration(m.coldLoadMs)}` : 'nicht geladen');
                const role = norm(m.model) === norm(data.mainModel) ? ' [Chat]' : (norm(m.model) === norm(data.codingModel) ? ' [Code]' : '');
                lines.push(`• ${m.model}${role}: ~${formatDuration(m.expectedMs)} (${tag})${m.tokensPerSec ? ` · ${m.tokensPerSec} Tokens/s` : ''}`);
            });
            data.models.filter(m => m.lastFailure).forEach(m => lines.push(`⚠ ${m.model}: zuletzt fehlgeschlagen nach ${formatDuration(m.lastFailure.wallMs)} - ${m.lastFailure.error}`));
            card.title = lines.join('\n');

            if (running) {
                // Live: lila, mit laufender Zeit. Die Karte fragt dann öfter nach (siehe unten).
                valueSpan.textContent = '⏳' + formatDuration(running[0].ms);
                card.className = widgetCardBaseClass('from-violet-600 to-indigo-900');
                return;
            }
            // Ist die LETZTE Anfrage fehlgeschlagen, wird die Karte rot (Grund im Hinweis-Text) - sonst
            // bliebe ein Fehler hinter einer grünen Erwartungszeit versteckt.
            valueSpan.textContent = (lastFailed ? '⚠' : '') + (shown === null ? '' : (approx ? '~' : '') + formatDuration(shown));
            const gradient = lastFailed || shown >= 45000 ? 'from-red-600 to-red-900' : (shown >= 10000 ? 'from-amber-500 to-orange-800' : 'from-emerald-600 to-emerald-900');
            card.className = widgetCardBaseClass(gradient);
        } catch {
            valueSpan.textContent = 'Fehler';
        }
    }

    // Widget "Tickets": offen/insgesamt. Grün = nichts offen, orange = offene Tickets sind dir zugewiesen,
    // blau = es gibt offene Tickets (aber keine bei dir). Der Hinweis-Text zeigt die Aufteilung.
    async function updateAuraticketWidget(card, iconSpan, valueSpan) {
        try {
            const res = await fetch(`${backendUrl}/auraticket/widget`, { credentials: 'include' });
            const data = await res.json();
            if (!data.connected) {
                valueSpan.textContent = 'n/a';
                card.title = 'AuraTicket ist nicht verbunden (Admin Panel → API).';
                return;
            }
            if (data.error) {
                valueSpan.textContent = '!';
                card.title = data.error;
                return;
            }
            valueSpan.textContent = `${data.open}/${data.total}`;
            const gradient = data.open === 0 ? 'from-emerald-600 to-emerald-900' : (data.mine > 0 ? 'from-amber-500 to-orange-800' : 'from-sky-500 to-blue-700');
            card.className = widgetCardBaseClass(gradient);
            if (appConfig.auraticket_url) card.classList.add('cursor-pointer');
            card.title = `${data.open} offen · ${data.pending} wartend · ${data.resolved} gelöst · ${data.closed} geschlossen · ${data.total} insgesamt`
                + (data.mine ? ` · ${data.mine} offene davon dir zugewiesen` : '')
                + (appConfig.auraticket_url ? ' - klicken öffnet AuraTicket' : '');
        } catch {
            valueSpan.textContent = 'Fehler';
        }
    }

    async function updateAuraplanWidget(card, iconSpan, valueSpan) {
        try {
            const res = await fetch(`${backendUrl}/auraplan/widget`, { credentials: 'include' });
            const data = await res.json();
            if (!data.connected) {
                valueSpan.textContent = 'n/a';
                card.title = 'AuraPlan ist nicht verbunden (Admin Panel → API).';
                card.dataset.clockedIn = '';
                return;
            }
            card.dataset.clockedIn = data.clockedIn ? 'true' : 'false';
            if (data.clockedIn) {
                card.className = widgetCardBaseClass('from-red-600 to-red-900');
                iconSpan.textContent = '⏹️';
                card.title = 'Eingestempelt' + (data.clockIn ? ' seit ' + new Date(data.clockIn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '') + ' - klicken zum Ausstempeln';
            } else {
                card.className = widgetCardBaseClass('from-emerald-600 to-emerald-900');
                iconSpan.textContent = '▶️';
                card.title = 'Nicht eingestempelt - klicken zum Einstempeln';
            }
            valueSpan.textContent = data.balance ? `${data.balance.remaining}/${data.balance.used}` : '';
        } catch {
            valueSpan.textContent = 'Fehler';
        }
    }

    async function toggleAuraplanClock(card, iconSpan, valueSpan) {
        const endpoint = card.dataset.clockedIn === 'true' ? '/auraplan/clock-out' : '/auraplan/clock-in';
        card.style.pointerEvents = 'none';
        try {
            const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
        } catch (err) {
            alert(err.message || 'Fehler bei AuraPlan.');
        }
        card.style.pointerEvents = '';
        updateAuraplanWidget(card, iconSpan, valueSpan);
    }

    async function updateWeatherWidget(widget, el) {
        try {
            if (!widget.lat) {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(widget.city)}&count=1&language=de`);
                const geoData = await geoRes.json();
                if (!geoData.results || geoData.results.length === 0) {
                    el.textContent = 'unbek.';
                    return;
                }
                widget.lat = geoData.results[0].latitude;
                widget.lon = geoData.results[0].longitude;
                widget.city = geoData.results[0].name;
                saveWidgets();
            }
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${widget.lat}&longitude=${widget.lon}&current=temperature_2m`);
            const data = await res.json();
            el.textContent = `${Math.round(data.current.temperature_2m)}°C`;
            el.title = widget.city;
        } catch (err) {
            el.textContent = 'Fehler';
        }
    }

    if (widgetsAddBtn && widgetPicker) {
        widgetsAddBtn.addEventListener('click', () => {
            widgetPicker.classList.toggle('hidden');
            if (widgetPickerInputWrap) widgetPickerInputWrap.classList.add('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!widgetPicker.classList.contains('hidden') && !widgetPicker.contains(e.target) && e.target !== widgetsAddBtn) {
                widgetPicker.classList.add('hidden');
            }
        });
    }

    document.querySelectorAll('.widget-picker-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-widget-type');
            if (type === 'clock') {
                widgets.push({ id: 'w_' + Date.now(), type: 'clock' });
                saveWidgets();
                renderWidgets();
                if (widgetPicker) widgetPicker.classList.add('hidden');
                return;
            }
            if (type === 'auraplan') {
                widgets.push({ id: 'w_' + Date.now(), type: 'auraplan' });
                saveWidgets();
                renderWidgets();
                if (widgetPicker) widgetPicker.classList.add('hidden');
                return;
            }
            if (type === 'auraticket') {
                widgets.push({ id: 'w_' + Date.now(), type: 'auraticket' });
                saveWidgets();
                renderWidgets();
                if (widgetPicker) widgetPicker.classList.add('hidden');
                return;
            }
            if (type === 'aitime') {
                widgets.push({ id: 'w_' + Date.now(), type: 'aitime' });
                saveWidgets();
                renderWidgets();
                if (widgetPicker) widgetPicker.classList.add('hidden');
                return;
            }
            if (type === 'mood') {
                widgets.push({ id: 'w_' + Date.now(), type: 'mood' });
                saveWidgets();
                renderWidgets();
                if (widgetPicker) widgetPicker.classList.add('hidden');
                return;
            }
            pendingWidgetType = type;
            if (widgetPickerInputWrap) widgetPickerInputWrap.classList.remove('hidden');
            if (widgetPickerInput) {
                widgetPickerInput.placeholder = type === 'timer' ? 'Minuten, z.B. 25' : 'Stadt, z.B. Zürich';
                widgetPickerInput.type = type === 'timer' ? 'number' : 'text';
                widgetPickerInput.value = '';
                widgetPickerInput.focus();
            }
        });
    });

    if (widgetPickerConfirmBtn) {
        widgetPickerConfirmBtn.addEventListener('click', () => {
            const value = widgetPickerInput ? widgetPickerInput.value.trim() : '';
            if (!value) return;
            if (pendingWidgetType === 'weather') {
                widgets.push({ id: 'w_' + Date.now(), type: 'weather', city: value });
            } else if (pendingWidgetType === 'timer') {
                const minutes = parseInt(value, 10);
                if (!minutes || minutes <= 0) return;
                widgets.push({ id: 'w_' + Date.now(), type: 'timer', durationSeconds: minutes * 60, remainingSeconds: minutes * 60, running: false });
                if (window.Notification && Notification.permission === 'default') Notification.requestPermission();
            } else {
                return;
            }
            saveWidgets();
            renderWidgets();
            if (widgetPicker) widgetPicker.classList.add('hidden');
            pendingWidgetType = null;
        });
    }

    loadWidgets();
    setInterval(renderWidgets, 60000); // Wetterwerte einmal pro Minute auffrischen (Uhr/Timer laufen separat jede Sekunde)
    setInterval(pollAcademyTrainingIndicator, 45000);
});
