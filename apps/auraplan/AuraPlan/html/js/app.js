(function () {
    let currentUser = null;
    let allUsers = []; // für Dropdowns/Farben, auch als Nicht-Admin (Namen/Farben)
    let currentWeekStart = startOfWeek(new Date());

    const loginScreen = document.getElementById('login-screen');
    const appEl = document.getElementById('app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // --- Hilfsfunktionen ---
    function startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Woche beginnt Montag
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    function fmtDate(date) {
        return date.toISOString().slice(0, 10);
    }
    function fmtDateDisplay(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    }
    function fmtTime(isoString) {
        if (!isoString) return '–';
        return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    function hoursBetween(startIso, endIso) {
        if (!startIso || !endIso) return null;
        return ((new Date(endIso) - new Date(startIso)) / 3600000).toFixed(2);
    }
    async function api(path, options = {}) {
        const res = await fetch(`/api${path}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            ...options
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen.');
        return data;
    }

    // Liest eine hochgeladene .lic-Datei (reiner Text) und füllt das zugehörige
    // Textfeld damit - für beide Lizenz-Eingabestellen (Sperr-Fenster + Admin Panel) nutzbar.
    function wireLicenseFileInput(fileInputId, textareaId) {
        const fileInput = document.getElementById(fileInputId);
        if (!fileInput) return;
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { document.getElementById(textareaId).value = reader.result.trim(); };
            reader.readAsText(file);
        });
    }
    wireLicenseFileInput('license-key-file', 'license-key-input');
    wireLicenseFileInput('license-admin-key-file', 'license-admin-key-input');

    // --- Login/Logout ---
    const loginStepCredentials = document.getElementById('login-step-credentials');
    const loginStep2faSetup = document.getElementById('login-step-2fa-setup');
    const loginStep2fa = document.getElementById('login-step-2fa');
    let pending2faViaAuraDirect = false;

    function showLoginStep(step) {
        loginStepCredentials.classList.toggle('hidden', step !== 'credentials');
        loginStep2faSetup.classList.toggle('hidden', step !== '2fa-setup');
        loginStep2fa.classList.toggle('hidden', step !== '2fa');
    }

    async function handleLoginResult(data) {
        if (data.requires2faSetup) {
            document.getElementById('twofa-qr-code').src = data.qrCodeDataUrl;
            showLoginStep('2fa-setup');
            return;
        }
        if (data.requires2fa) {
            pending2faViaAuraDirect = !!data.viaAuraDirect;
            showLoginStep('2fa');
            return;
        }
        await boot();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        try {
            const data = await api('/login', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                })
            });
            await handleLoginResult(data);
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    document.getElementById('twofa-setup-confirm-btn').addEventListener('click', async () => {
        loginError.classList.add('hidden');
        try {
            await api('/login/2fa-setup', { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-setup-code').value }) });
            await boot();
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    document.getElementById('twofa-confirm-btn').addEventListener('click', async () => {
        loginError.classList.add('hidden');
        try {
            const endpoint = pending2faViaAuraDirect ? '/login/2fa-auradirect' : '/login/2fa';
            await api(endpoint, { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-code').value }) });
            await boot();
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    async function doLogout() {
        await api('/logout', { method: 'POST' });
        location.reload();
    }
    window.AuraAppMenu = { logout: doLogout };   // schon vor der Anmeldung da; nach der Anmeldung kommen Einstellungen und Admin Panel dazu

    // --- Navigation ---
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchAdminSubview(btn.dataset.subview));
    });
    function switchAdminSubview(subview) {
        // Einige Reiter sind "virtuell": sie zeigen nur einzelne Blöcke einer grösseren Ansicht (data-real, data-blocks)
        const btn = document.querySelector(`.admin-subnav-btn[data-subview="${subview}"]`);
        const real = (btn && btn.dataset.real) || subview;
        const blocks = btn && btn.dataset.blocks ? btn.dataset.blocks.split(',') : null;
        document.querySelectorAll('.admin-subview').forEach(s => s.classList.add('hidden'));
        document.getElementById('admin-subview-' + real).classList.remove('hidden');
        document.querySelectorAll('#admin-subview-sicherheit [data-block]').forEach(el => el.classList.toggle('hidden', !!blocks && !blocks.includes(el.dataset.block)));
        document.querySelectorAll('.admin-subnav-btn').forEach(b => b.classList.toggle('active', b.dataset.subview === subview));
        if (real === 'sicherheit') { loadSecuritySettings(); loadPrivacyPolicyEditor(); loadAuraDirectSettings(); loadAurachatServiceKey(); loadLicenseAdminStatus(); }
        if (real === 'zeitarten') { loadActivityTypesAdmin(); loadCostCentersAdmin(); }
        if (real === 'importexport') { loadExternalApiKey(); }
        if (real === 'darstellung') window.AuraPrefs.card(document.getElementById('admin-prefs-card'));
    }

    // Eine Ansicht für zwei Menüpunkte: "Einstellungen" (Anpassungen) und "Admin Panel" (Benutzer, Lizenz, API, Sicherheit, System)
    function openPanel(group, subview) {
        switchView('admin-mitarbeiter');
        document.querySelectorAll('.admin-subnav-btn').forEach(b => b.classList.toggle('hidden', b.dataset.group !== group));
        switchAdminSubview(subview);
    }

    async function loadActivityTypesAdmin() {
        const types = await api('/activity-types');
        const list = document.getElementById('activity-types-list');
        list.innerHTML = '';
        types.forEach(t => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2' + (t.active ? '' : ' opacity-50');
            row.innerHTML = `<span class="text-slate-300">${t.name}${!t.active ? ' (deaktiviert)' : ''}</span>`;
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700';
            toggleBtn.textContent = t.active ? 'Deaktivieren' : 'Aktivieren';
            toggleBtn.addEventListener('click', async () => {
                await api(`/admin/activity-types/${t.id}`, { method: 'PUT', body: JSON.stringify({ name: t.name, active: !t.active }) });
                loadActivityTypesAdmin();
            });
            row.appendChild(toggleBtn);
            list.appendChild(row);
        });
    }
    document.getElementById('activity-type-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('new-activity-type-name');
        if (!input.value.trim()) return;
        await api('/admin/activity-types', { method: 'POST', body: JSON.stringify({ name: input.value.trim() }) });
        input.value = '';
        loadActivityTypesAdmin();
    });

    async function loadCostCentersAdmin() {
        const centers = await api('/cost-centers');
        const list = document.getElementById('cost-centers-list');
        list.innerHTML = '';
        centers.forEach(c => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2' + (c.active ? '' : ' opacity-50');
            row.innerHTML = `<span class="text-slate-300">${c.name}${c.code ? ' (' + c.code + ')' : ''}${!c.active ? ' — deaktiviert' : ''}</span>`;
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700';
            toggleBtn.textContent = c.active ? 'Deaktivieren' : 'Aktivieren';
            toggleBtn.addEventListener('click', async () => {
                await api(`/admin/cost-centers/${c.id}`, { method: 'PUT', body: JSON.stringify({ name: c.name, code: c.code, active: !c.active }) });
                loadCostCentersAdmin();
            });
            row.appendChild(toggleBtn);
            list.appendChild(row);
        });
    }
    document.getElementById('cost-center-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-cost-center-name');
        if (!nameInput.value.trim()) return;
        await api('/admin/cost-centers', { method: 'POST', body: JSON.stringify({ name: nameInput.value.trim(), code: document.getElementById('new-cost-center-code').value.trim() }) });
        nameInput.value = '';
        document.getElementById('new-cost-center-code').value = '';
        loadCostCentersAdmin();
    });

    async function loadSecuritySettings() {
        const s = await api('/admin/security');
        document.getElementById('twofa-required-toggle').checked = !!s.twoFactorRequired;
    }
    async function loadAuraDirectSettings() {
        const s = await api('/admin/auradirect');
        document.getElementById('auradirect-url').value = s.url || '';
        document.getElementById('auradirect-key').placeholder = s.hasServiceKey ? '•••••••• (bereits gesetzt, leer lassen = unverändert)' : 'Dienst-Schlüssel (wie in AuraDirect)';
    }
    document.getElementById('auradirect-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('auradirect-status');
        try {
            await api('/admin/auradirect', {
                method: 'POST',
                body: JSON.stringify({ url: document.getElementById('auradirect-url').value.trim(), serviceKey: document.getElementById('auradirect-key').value.trim() })
            });
            document.getElementById('auradirect-key').value = '';
            statusEl.textContent = '✓ Gespeichert.';
            statusEl.className = 'text-xs mt-2 text-emerald-400';
            loadAuraDirectSettings();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs mt-2 text-red-400';
        }
    });

    async function loadLicenseAdminStatus() {
        const info = await api('/license');
        const statusEl = document.getElementById('license-admin-status');
        if (info.licenseValid) {
            statusEl.textContent = `✓ Lizenziert für "${info.customer}"${info.expiresAt ? ' · gültig bis ' + fmtDateDisplay(info.expiresAt.slice(0, 10)) : ' · unbegrenzt'}`;
            statusEl.className = 'text-xs text-emerald-400 mb-3';
        } else if (info.freeTier) {
            statusEl.textContent = `✓ Kostenlose Stufe aktiv (1 Benutzer: der Admin) - für weitere Konten wird eine Lizenz benötigt.`;
            statusEl.className = 'text-xs text-emerald-400 mb-3';
        } else if (info.trial) {
            statusEl.textContent = `⏳ Testphase aktiv - noch ${info.trialDaysRemaining} Tag(e). Danach ist eine gültige Lizenz erforderlich.`;
            statusEl.className = 'text-xs text-amber-400 mb-3';
        } else {
            statusEl.textContent = `✗ Keine gültige Lizenz (${info.error || 'unbekannt'})`;
            statusEl.className = 'text-xs text-red-400 mb-3';
        }
        document.getElementById('license-admin-remove-btn').classList.toggle('hidden', !info.licenseValid);
    }
    document.getElementById('license-admin-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('license-admin-error');
        errorEl.classList.add('hidden');
        try {
            await api('/admin/license', { method: 'POST', body: JSON.stringify({ key: document.getElementById('license-admin-key-input').value }) });
            document.getElementById('license-admin-key-input').value = '';
            loadLicenseAdminStatus();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        }
    });
    document.getElementById('license-admin-remove-btn').addEventListener('click', async () => {
        if (!confirm('Lizenz wirklich entfernen? Ohne gültige Lizenz (oder laufende Testphase) ist AuraPlan danach gesperrt.')) return;
        await api('/admin/license/remove', { method: 'POST' });
        loadLicenseAdminStatus();
    });

    async function loadAurachatServiceKey() {
        const s = await api('/admin/aurachat-service-key');
        document.getElementById('aurachat-service-key-field').value = s.key || '';
    }
    document.getElementById('aurachat-service-key-copy-btn').addEventListener('click', (e) => {
        const field = document.getElementById('aurachat-service-key-field');
        field.select();
        navigator.clipboard.writeText(field.value);
        e.target.textContent = '✓ Kopiert';
    });

    document.getElementById('twofa-required-toggle').addEventListener('change', async (e) => {
        const statusEl = document.getElementById('twofa-status');
        try {
            await api('/admin/security', { method: 'POST', body: JSON.stringify({ twoFactorRequired: e.target.checked }) });
            statusEl.textContent = '✓ Gespeichert.';
            statusEl.className = 'text-xs mt-2 text-emerald-400';
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs mt-2 text-red-400';
        }
    });

    async function loadPrivacyPolicyEditor() {
        const policy = await api('/privacy-policy');
        document.getElementById('privacy-policy-editor').value = policy.text;
    }
    document.getElementById('privacy-policy-save-btn').addEventListener('click', async () => {
        const statusEl = document.getElementById('privacy-policy-status');
        try {
            const result = await api('/admin/privacy-policy', { method: 'POST', body: JSON.stringify({ text: document.getElementById('privacy-policy-editor').value }) });
            statusEl.textContent = `✓ Gespeichert (Version ${result.version}). Alle müssen beim nächsten Login erneut zustimmen.`;
            statusEl.className = 'text-xs mt-2 text-emerald-400';
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs mt-2 text-red-400';
        }
    });
    function switchView(view) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('view-' + view).classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        if (view === 'zeiterfassung') { loadClockStatus(); loadTimeEntries(); loadManualEntryDropdowns(); }
        if (view === 'team-zeiten') { loadTeamZeiten(); }
        if (view === 'uebersicht') { switchOverviewTab(currentOverviewTab); }
        if (view === 'schichtplan') { renderWeek(); }
        if (view === 'ferien') { loadBalance(); loadAbsences(); }
        if (view === 'admin-mitarbeiter') { loadUsers(); switchAdminSubview('mitarbeiter'); }
    }

    // --- Boot ---
    async function boot() {
        try {
            currentUser = await api('/me');
        } catch {
            loginScreen.classList.remove('hidden');
            appEl.classList.add('hidden');
            showLoginStep('credentials');
            return;
        }
        loginScreen.classList.add('hidden');
        appEl.classList.remove('hidden');
        const roleLabel = currentUser.role === 'admin' ? ' · Admin' : (currentUser.role === 'teamleiter' ? ' · Teamleiter:in' : '');
        document.getElementById('user-name').textContent = `${currentUser.name}${roleLabel}`;
        if (currentUser.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }
        // Einheitliches Menü der Aura-Suite (aura-menu.js)
        const isAdmin = currentUser.role === 'admin';
        window.AuraAppMenu = {
            logout: doLogout,
            settings: isAdmin ? () => openPanel('settings', 'zeitarten') : openPasswordModal,
            admin: isAdmin ? { users: () => openPanel('admin', 'mitarbeiter'), license: () => openPanel('admin', 'lizenz'), api: () => openPanel('admin', 'api'), security: () => openPanel('admin', 'sicherheit'), system: () => openPanel('admin', 'backup') } : null
        };
        if (window.AuraMenuCtl) window.AuraMenuCtl.refresh();
        if (currentUser.role === 'admin' || currentUser.role === 'teamleiter') {
            document.querySelectorAll('.teamlead-or-admin-only').forEach(el => el.classList.remove('hidden'));
        }

        const licenseOk = await checkLicense();
        if (!licenseOk) return; // alles Weitere (Daten laden, Ansicht zeigen) macht ohne Lizenz keinen Sinn

        allUsers = await api('/users');
        await checkPrivacyPolicy();
        switchView('zeiterfassung');
    }

    async function checkLicense() {
        const info = await api('/license');
        if (info.valid) return true;
        document.getElementById('modal-license').classList.remove('hidden');
        const adminForm = document.getElementById('license-modal-admin-form');
        if (currentUser.role === 'admin') {
            document.getElementById('license-modal-text').textContent = 'Für diese Installation ist keine gültige Lizenz hinterlegt. Bitte Lizenzschlüssel eintragen:';
            adminForm.classList.remove('hidden');
            document.getElementById('license-save-btn').onclick = async () => {
                const errorEl = document.getElementById('license-modal-error');
                errorEl.classList.add('hidden');
                try {
                    await api('/admin/license', { method: 'POST', body: JSON.stringify({ key: document.getElementById('license-key-input').value }) });
                    document.getElementById('modal-license').classList.add('hidden');
                    await boot();
                } catch (err) {
                    errorEl.textContent = err.message;
                    errorEl.classList.remove('hidden');
                }
            };
        }
        return false;
    }

    async function checkPrivacyPolicy() {
        const policy = await api('/privacy-policy');
        if ((currentUser.privacy_accepted_version || 0) >= policy.version) return;
        document.getElementById('privacy-policy-text').textContent = policy.text;
        const modal = document.getElementById('modal-privacy');
        modal.classList.remove('hidden');
        document.getElementById('privacy-accept-btn').onclick = async () => {
            await api('/privacy-policy/accept', { method: 'POST' });
            currentUser.privacy_accepted_version = policy.version;
            modal.classList.add('hidden');
        };
    }

    // --- Zeiterfassung ---
    const clockBtn = document.getElementById('clock-btn');
    const clockStatusLabel = document.getElementById('clock-status-label');
    const clockSince = document.getElementById('clock-since');

    async function loadClockStatus() {
        const status = await api('/time/status');
        if (status.clockedIn) {
            clockBtn.textContent = '⏹ Ausstempeln';
            clockBtn.className = 'px-8 py-4 rounded-2xl font-bold text-lg transition clocked-in';
            clockStatusLabel.textContent = 'Du bist eingestempelt seit:';
            clockSince.textContent = fmtTime(status.entry.clockIn) + ' Uhr';
        } else {
            clockBtn.textContent = '▶ Einstempeln';
            clockBtn.className = 'px-8 py-4 rounded-2xl font-bold text-lg transition clocked-out';
            clockStatusLabel.textContent = 'Du bist aktuell nicht eingestempelt.';
            clockSince.textContent = '';
        }
    }
    clockBtn.addEventListener('click', async () => {
        const status = await api('/time/status');
        if (status.clockedIn) {
            clockBtn.disabled = true;
            try {
                const breakInput = prompt('Pause in Minuten (0, falls keine):', '0');
                if (breakInput === null) { clockBtn.disabled = false; return; }
                const breakMinutes = Math.max(0, parseInt(breakInput, 10) || 0);
                await api('/time/clock-out', { method: 'POST', body: JSON.stringify({ breakMinutes }) });
                await loadClockStatus();
                await loadTimeEntries();
            } catch (err) { alert(err.message); }
            clockBtn.disabled = false;
        } else {
            openClockInModal();
        }
    });

    async function openClockInModal() {
        const [types, centers] = await Promise.all([api('/activity-types'), api('/cost-centers')]);
        const typeSelect = document.getElementById('clockin-activity-type');
        typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        const defaultType = types.find(t => t.name === 'Arbeitszeit');
        if (defaultType) typeSelect.value = defaultType.id;
        document.getElementById('clockin-cost-center').innerHTML = '<option value="">— keine —</option>' + centers.map(c => `<option value="${c.id}">${c.name}${c.code ? ' (' + c.code + ')' : ''}</option>`).join('');
        document.getElementById('clockin-modal').classList.remove('hidden');
    }
    document.getElementById('clockin-cancel-btn').addEventListener('click', () => document.getElementById('clockin-modal').classList.add('hidden'));
    document.getElementById('clockin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('/time/clock-in', {
                method: 'POST',
                body: JSON.stringify({
                    activityTypeId: document.getElementById('clockin-activity-type').value,
                    costCenterId: document.getElementById('clockin-cost-center').value || null
                })
            });
            document.getElementById('clockin-modal').classList.add('hidden');
            await loadClockStatus();
            await loadTimeEntries();
        } catch (err) { alert(err.message); }
    });

    async function loadManualEntryDropdowns() {
        const [types, centers] = await Promise.all([api('/activity-types'), api('/cost-centers')]);
        const typeSelect = document.getElementById('manual-activity-type');
        typeSelect.innerHTML = types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        const defaultType = types.find(t => t.name === 'Arbeitszeit');
        if (defaultType) typeSelect.value = defaultType.id;
        document.getElementById('manual-cost-center').innerHTML = '<option value="">— keine —</option>' + centers.map(c => `<option value="${c.id}">${c.name}${c.code ? ' (' + c.code + ')' : ''}</option>`).join('');
        if (!document.getElementById('manual-date').value) document.getElementById('manual-date').value = fmtDate(new Date());
    }

    document.getElementById('manual-entry-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('manual-entry-status');
        statusEl.textContent = '';
        const date = document.getElementById('manual-date').value;
        const amFrom = document.getElementById('manual-am-from').value;
        const amTo = document.getElementById('manual-am-to').value;
        const pmFrom = document.getElementById('manual-pm-from').value;
        const pmTo = document.getElementById('manual-pm-to').value;
        const activityTypeId = document.getElementById('manual-activity-type').value;
        const costCenterId = document.getElementById('manual-cost-center').value || null;

        if (!date || (!amFrom || !amTo) && (!pmFrom || !pmTo)) {
            statusEl.textContent = 'Bitte Datum und mindestens einen vollständigen Zeitblock (Vormittag oder Nachmittag) angeben.';
            statusEl.className = 'text-xs text-red-400';
            return;
        }
        try {
            if (amFrom && amTo) {
                await api('/time/manual-entry', { method: 'POST', body: JSON.stringify({ date, clockIn: `${date}T${amFrom}`, clockOut: `${date}T${amTo}`, activityTypeId, costCenterId }) });
            }
            if (pmFrom && pmTo) {
                await api('/time/manual-entry', { method: 'POST', body: JSON.stringify({ date, clockIn: `${date}T${pmFrom}`, clockOut: `${date}T${pmTo}`, activityTypeId, costCenterId }) });
            }
            statusEl.textContent = '✓ Erfasst.';
            statusEl.className = 'text-xs text-emerald-400';
            e.target.reset();
            document.getElementById('manual-date').value = fmtDate(new Date());
            loadTimeEntries();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs text-red-400';
        }
    });

    document.getElementById('close-day-btn').addEventListener('click', async () => {
        if (!confirm('Heutigen Tag wirklich abschliessen? Danach ist kein weiteres Einstempeln mehr möglich, bis Teamleitung/Admin wieder öffnet.')) return;
        try {
            await api('/time/close-day', { method: 'POST' });
            alert('Tag abgeschlossen.');
            loadClockStatus();
        } catch (err) { alert(err.message); }
    });

    async function loadTimeEntries() {
        const entries = await api('/time/entries');
        const list = document.getElementById('time-entries-list');
        list.innerHTML = '';
        if (entries.length === 0) {
            list.innerHTML = '<div class="text-slate-500 text-xs">Noch keine Einträge.</div>';
            return;
        }
        entries.slice(0, 20).forEach(e => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5' + (e.deleted ? ' opacity-50' : '');
            const gross = e.clockOut ? (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000 : null;
            const net = gross !== null ? Math.max(0, gross - (e.breakMinutes || 0) / 60).toFixed(2) : null;
            const strike = e.deleted ? 'line-through' : '';
            row.innerHTML = `
                <span class="text-slate-300 ${strike}">${fmtDateDisplay(e.date)}</span>
                <span class="text-slate-400 ${strike}">${fmtTime(e.clockIn)} – ${e.clockOut ? fmtTime(e.clockOut) : '…'}</span>
                <span class="text-slate-600 text-xs ${strike}">${e.activityTypeName || ''}${e.costCenterName ? ' · ' + e.costCenterName : ''}</span>
                <span class="text-slate-600 text-xs ${strike}">${e.breakMinutes ? e.breakMinutes + ' Min. Pause' : ''}</span>
                <span class="text-slate-500 text-xs ${strike}">${net !== null ? net + ' Std. netto' : 'läuft'}</span>
                ${e.deleted ? '<span class="text-[10px] text-red-400">gelöscht</span>' : ''}
            `;
            list.appendChild(row);
        });
    }

    document.getElementById('export-csv-btn').addEventListener('click', () => {
        window.open('/api/time/entries/export', '_blank');
    });

    // --- Team-Zeiten (Teamleitung & Admin) ---
    async function loadTeamZeiten() {
        const select = document.getElementById('lock-user-select');
        select.innerHTML = '<option value="all">Alle Mitarbeitenden</option>' + allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        if (!document.getElementById('lock-date-input').value) document.getElementById('lock-date-input').value = fmtDate(new Date());

        const entries = await api('/time/entries/all');
        const list = document.getElementById('team-entries-list');
        list.innerHTML = '';
        if (entries.length === 0) { list.innerHTML = '<div class="text-slate-500 text-xs">Noch keine Einträge.</div>'; return; }

        entries.slice(0, 100).forEach(e => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex-wrap gap-2' + (e.deleted ? ' opacity-50' : '');
            const gross = e.clockOut ? (new Date(e.clockOut) - new Date(e.clockIn)) / 3600000 : null;
            const net = gross !== null ? Math.max(0, gross - (e.breakMinutes || 0) / 60).toFixed(2) : null;
            const strike = e.deleted ? 'line-through' : '';
            row.innerHTML = `
                <div class="flex items-center gap-3 ${strike}">
                    <span class="text-slate-200 font-medium">${e.userName}</span>
                    <span class="text-slate-400">${fmtDateDisplay(e.date)}</span>
                    <span class="text-slate-500 text-xs">${fmtTime(e.clockIn)} – ${e.clockOut ? fmtTime(e.clockOut) : '…'}</span>
                    <span class="text-slate-600 text-xs">${e.activityTypeName || ''}${e.costCenterName ? ' · ' + e.costCenterName : ''}</span>
                    <span class="text-slate-600 text-xs">${net !== null ? net + ' Std. netto' : ''}</span>
                </div>
                <div class="flex items-center gap-1.5 text-[11px]"></div>
            `;
            const actions = row.lastElementChild;
            if (e.deleted) {
                const restoreBtn = document.createElement('button');
                restoreBtn.className = 'px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20';
                restoreBtn.textContent = '↺ Wiederherstellen';
                restoreBtn.addEventListener('click', async () => { await api(`/time/entries/${e.id}/restore`, { method: 'POST' }); loadTeamZeiten(); });
                actions.appendChild(restoreBtn);
            } else {
                const editBtn = document.createElement('button');
                editBtn.className = 'px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700';
                editBtn.textContent = '✏️ Bearbeiten';
                editBtn.addEventListener('click', async () => {
                    const newClockIn = prompt('Beginn (JJJJ-MM-TTTHH:MM):', e.clockIn.slice(0, 16));
                    if (!newClockIn) return;
                    const newClockOut = prompt('Ende (leer lassen, falls noch offen):', e.clockOut ? e.clockOut.slice(0, 16) : '');
                    try {
                        await api(`/time/entries/${e.id}`, { method: 'PUT', body: JSON.stringify({ date: e.date, clockIn: newClockIn, clockOut: newClockOut || null, breakMinutes: e.breakMinutes, note: e.note, activityTypeId: e.activityTypeId, costCenterId: e.costCenterId }) });
                        loadTeamZeiten();
                    } catch (err) { alert(err.message); }
                });
                const delBtn = document.createElement('button');
                delBtn.className = 'px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20';
                delBtn.textContent = '🗑️ Löschen';
                delBtn.addEventListener('click', async () => {
                    if (!confirm('Eintrag löschen? Bleibt durchgestrichen sichtbar, wird nicht endgültig entfernt.')) return;
                    await api(`/time/entries/${e.id}`, { method: 'DELETE' });
                    loadTeamZeiten();
                });
                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
            }
            list.appendChild(row);
        });
    }

    async function lockOrUnlock(action, scope) {
        const statusEl = document.getElementById('lock-status');
        try {
            await api(`/time/${action}`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: document.getElementById('lock-user-select').value,
                    scope,
                    date: document.getElementById('lock-date-input').value
                })
            });
            statusEl.textContent = `✓ ${action === 'lock' ? 'Gesperrt' : 'Entsperrt'} (${scope === 'day' ? 'Tag' : 'Woche'}).`;
            statusEl.className = 'text-xs text-emerald-400';
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs text-red-400';
        }
    }
    document.getElementById('lock-day-btn').addEventListener('click', () => lockOrUnlock('lock', 'day'));
    document.getElementById('lock-week-btn').addEventListener('click', () => lockOrUnlock('lock', 'week'));
    document.getElementById('unlock-day-btn').addEventListener('click', () => lockOrUnlock('unlock', 'day'));
    document.getElementById('unlock-week-btn').addEventListener('click', () => lockOrUnlock('unlock', 'week'));

    // --- Schichtplan ---
    const weekLabel = document.getElementById('week-label');
    const shiftGrid = document.getElementById('shift-grid');
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    document.getElementById('week-prev').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); renderWeek(); });
    document.getElementById('week-next').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); renderWeek(); });

    async function renderWeek() {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekLabel.textContent = `${fmtDateDisplay(fmtDate(currentWeekStart))} – ${fmtDateDisplay(fmtDate(weekEnd))}`;

        const [shifts, availabilities] = await Promise.all([
            api(`/shifts?from=${fmtDate(currentWeekStart)}&to=${fmtDate(weekEnd)}`),
            api(`/availabilities?from=${fmtDate(currentWeekStart)}&to=${fmtDate(weekEnd)}`)
        ]);
        shiftGrid.innerHTML = '';
        for (let i = 0; i < 7; i++) {
            const day = new Date(currentWeekStart);
            day.setDate(day.getDate() + i);
            const dayStr = fmtDate(day);
            const dayShifts = shifts.filter(s => s.date === dayStr);
            const dayUnavailable = availabilities.filter(a => a.date === dayStr);

            const col = document.createElement('div');
            col.className = 'shift-day bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-1.5';
            const isToday = dayStr === fmtDate(new Date());
            col.innerHTML = `<div class="text-[10px] font-semibold ${isToday ? 'text-blue-400' : 'text-slate-500'} uppercase tracking-wider mb-1">${dayNames[i]} ${day.getDate()}.${day.getMonth() + 1}.</div>`;

            dayShifts.forEach(s => {
                const isOpen = !s.userId;
                const block = document.createElement('div');
                block.className = 'rounded-lg px-2 py-1.5 text-[11px]' + (isOpen ? ' border border-dashed border-slate-600' : ' cursor-pointer');
                if (isOpen) {
                    block.innerHTML = `<div class="font-semibold text-slate-400">🔓 Offen</div><div class="text-slate-500">${s.startTime}–${s.endTime}${s.role ? ' · ' + s.role : ''}</div>`;
                    if (currentUser.role !== 'admin') {
                        const claimBtn = document.createElement('button');
                        claimBtn.className = 'mt-1 w-full text-[10px] px-1.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white';
                        claimBtn.textContent = 'Übernehmen';
                        claimBtn.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            try { await api(`/shifts/${s.id}/claim`, { method: 'POST' }); renderWeek(); }
                            catch (err) { alert(err.message); }
                        });
                        block.appendChild(claimBtn);
                    }
                    if (currentUser.role === 'admin') block.addEventListener('click', () => openShiftModal(s));
                } else {
                    block.style.background = (s.userColor || '#3270FD') + '33';
                    block.style.borderLeft = `3px solid ${s.userColor || '#3270FD'}`;
                    block.innerHTML = `<div class="font-semibold text-white">${s.userName}</div><div class="text-slate-400">${s.startTime}–${s.endTime}${s.role ? ' · ' + s.role : ''}</div>`;
                    if (currentUser.role === 'admin') block.addEventListener('click', () => openShiftModal(s));
                }
                col.appendChild(block);
            });

            dayUnavailable.forEach(a => {
                const badge = document.createElement('div');
                badge.className = 'rounded-lg px-2 py-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-between gap-1';
                badge.innerHTML = `<span>🚫 ${a.userName}${a.note ? ': ' + a.note : ''}</span>`;
                if (a.userId === currentUser.id) {
                    const del = document.createElement('button');
                    del.className = 'text-red-400 hover:text-red-200';
                    del.textContent = '✕';
                    del.addEventListener('click', async () => { await api(`/availabilities/${a.id}`, { method: 'DELETE' }); renderWeek(); });
                    badge.appendChild(del);
                }
                col.appendChild(badge);
            });

            shiftGrid.appendChild(col);
        }
    }

    document.getElementById('add-availability-btn').addEventListener('click', async () => {
        const date = prompt('An welchem Tag kannst du nicht arbeiten? (JJJJ-MM-TT)', fmtDate(new Date()));
        if (!date) return;
        const note = prompt('Grund (optional):', '') || '';
        try {
            await api('/availabilities', { method: 'POST', body: JSON.stringify({ date, note }) });
            renderWeek();
        } catch (err) { alert(err.message); }
    });

    // Schicht-Modal
    const shiftModal = document.getElementById('shift-modal');
    const shiftForm = document.getElementById('shift-form');
    const shiftUserSelect = document.getElementById('shift-user');
    const shiftDeleteBtn = document.getElementById('shift-delete-btn');

    document.getElementById('add-shift-btn').addEventListener('click', () => openShiftModal(null));
    document.getElementById('shift-cancel-btn').addEventListener('click', () => shiftModal.classList.add('hidden'));

    function openShiftModal(shift) {
        shiftUserSelect.innerHTML = '<option value="">— Offen (niemandem zugewiesen) —</option>' + allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        document.getElementById('shift-modal-title').textContent = shift ? 'Schicht bearbeiten' : 'Schicht hinzufügen';
        document.getElementById('shift-id').value = shift ? shift.id : '';
        document.getElementById('shift-date').value = shift ? shift.date : fmtDate(new Date());
        document.getElementById('shift-start').value = shift ? shift.startTime : '';
        document.getElementById('shift-end').value = shift ? shift.endTime : '';
        document.getElementById('shift-role').value = shift ? (shift.role || '') : '';
        if (shift) shiftUserSelect.value = shift.userId;
        shiftDeleteBtn.classList.toggle('hidden', !shift);
        shiftModal.classList.remove('hidden');
    }

    shiftDeleteBtn.addEventListener('click', async () => {
        const id = document.getElementById('shift-id').value;
        if (!id || !confirm('Diese Schicht wirklich löschen?')) return;
        await api(`/shifts/${id}`, { method: 'DELETE' });
        shiftModal.classList.add('hidden');
        renderWeek();
    });

    shiftForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('shift-id').value;
        const payload = {
            userId: shiftUserSelect.value,
            date: document.getElementById('shift-date').value,
            startTime: document.getElementById('shift-start').value,
            endTime: document.getElementById('shift-end').value,
            role: document.getElementById('shift-role').value
        };
        try {
            if (id) {
                await api(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                await api('/shifts', { method: 'POST', body: JSON.stringify(payload) });
            }
            shiftModal.classList.add('hidden');
            renderWeek();
        } catch (err) {
            alert(err.message);
        }
    });

    // --- Ferien ---
    async function loadBalance() {
        const b = await api('/absences/balance');
        document.getElementById('balance-total').textContent = b.total;
        document.getElementById('balance-used').textContent = b.used;
        document.getElementById('balance-remaining').textContent = b.remaining;
    }

    async function loadAbsences() {
        const absences = await api('/absences');
        const list = document.getElementById('absences-list');
        list.innerHTML = '';
        if (absences.length === 0) {
            list.innerHTML = '<div class="text-slate-500 text-xs">Noch keine Anträge.</div>';
            return;
        }
        const canApprove = currentUser.role === 'admin' || currentUser.role === 'teamleiter';
        const typeLabels = { vacation: '🏖️ Ferien', sick: '🤒 Krankheit', other: '📌 Sonstiges' };
        const statusLabels = { pending: 'Offen', approved: 'Genehmigt', rejected: 'Abgelehnt' };
        absences.forEach(a => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex-wrap gap-2';
            const isOwn = a.userId === currentUser.id;
            row.innerHTML = `
                <div class="flex items-center gap-3">
                    ${canApprove ? `<span class="text-slate-300 font-medium">${a.userName}</span>` : ''}
                    <span class="text-slate-400">${typeLabels[a.type] || a.type}</span>
                    <span class="text-slate-500 text-xs">${fmtDateDisplay(a.startDate)} – ${fmtDateDisplay(a.endDate)}</span>
                    ${a.note ? `<span class="text-slate-600 text-xs italic">${a.note}</span>` : ''}
                    ${a.decisionNote ? `<span class="text-slate-600 text-xs italic">↳ ${a.decisionNote}${a.decidedByName ? ' (' + a.decidedByName + ')' : ''}</span>` : ''}
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold status-${a.status}">${statusLabels[a.status]}</span>
                    <span class="admin-actions"></span>
                    <span class="own-actions"></span>
                </div>
            `;
            const adminActions = row.querySelector('.admin-actions');
            if (canApprove && a.status === 'pending') {
                const approveBtn = document.createElement('button');
                approveBtn.className = 'text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20';
                approveBtn.textContent = '✓ Genehmigen';
                approveBtn.addEventListener('click', () => setAbsenceStatus(a.id, 'approved'));
                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'text-[11px] px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 ml-1';
                rejectBtn.textContent = '✕ Ablehnen';
                rejectBtn.addEventListener('click', () => {
                    const note = prompt('Grund für die Ablehnung (optional):', '') || '';
                    setAbsenceStatus(a.id, 'rejected', note);
                });
                adminActions.appendChild(approveBtn);
                adminActions.appendChild(rejectBtn);
            }
            const ownActions = row.querySelector('.own-actions');
            if (isOwn && a.status === 'pending' && !canApprove) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'text-[11px] px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700';
                cancelBtn.textContent = 'Zurückziehen';
                cancelBtn.addEventListener('click', async () => { await api(`/absences/${a.id}`, { method: 'DELETE' }); loadAbsences(); });
                ownActions.appendChild(cancelBtn);
            }
            list.appendChild(row);
        });
    }

    async function setAbsenceStatus(id, status, decisionNote) {
        await api(`/absences/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, decisionNote }) });
        loadAbsences();
        loadBalance();
    }

    document.getElementById('absence-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('absence-form-status');
        statusEl.textContent = '';
        try {
            await api('/absences', {
                method: 'POST',
                body: JSON.stringify({
                    startDate: document.getElementById('absence-start').value,
                    endDate: document.getElementById('absence-end').value,
                    type: document.getElementById('absence-type').value,
                    note: document.getElementById('absence-note').value
                })
            });
            statusEl.textContent = '✓ Antrag gestellt.';
            statusEl.className = 'text-xs text-emerald-400';
            e.target.reset();
            loadAbsences();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs text-red-400';
        }
    });

    // --- Passwort ändern ---
    const passwordModal = document.getElementById('password-modal');
    function openPasswordModal() {
        window.AuraPrefs.card(document.getElementById('password-prefs-card'));   // Darstellung (Dunkel/Hell/Automatisch)
        document.getElementById('password-form').reset();
        document.getElementById('password-form-status').textContent = '';
        passwordModal.classList.remove('hidden');
    }
    document.getElementById('open-password-btn').addEventListener('click', openPasswordModal);
    document.getElementById('password-cancel-btn').addEventListener('click', () => passwordModal.classList.add('hidden'));
    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('password-form-status');
        statusEl.textContent = '';
        try {
            await api('/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: document.getElementById('current-password-input').value,
                    newPassword: document.getElementById('new-password-input').value
                })
            });
            statusEl.textContent = '✓ Passwort geändert.';
            statusEl.className = 'text-xs text-emerald-400';
            setTimeout(() => passwordModal.classList.add('hidden'), 1200);
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'text-xs text-red-400';
        }
    });


    // --- Admin: Mitarbeiter ---
    async function loadUsers() {
        allUsers = await api('/users');
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        allUsers.forEach(u => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex-wrap gap-2';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background:${u.color}"></span>
                    <span class="text-slate-200 font-medium">${u.name}</span>
                    <span class="text-slate-500 text-xs">@${u.username}</span>
                    ${u.role === 'admin' ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Admin</span>' : ''}
                    ${u.role === 'teamleiter' ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Teamleiter:in</span>' : ''}
                    ${!u.active ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Inaktiv</span>' : ''}
                    <span class="text-slate-500 text-xs">${u.vacationDaysPerYear} Ferientage/Jahr</span>
                    <span class="text-slate-500 text-xs">${u.pensumPercent}% · ${u.weeklyHours} Std./Woche</span>
                </div>
                <div class="flex items-center gap-1.5 text-[11px]">
                    <button class="reset-pw px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700">🔑 Passwort</button>
                    <button class="reset-2fa px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700">🛡️ 2FA zurücksetzen</button>
                    <button class="toggle-active px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700">${u.active ? 'Deaktivieren' : 'Aktivieren'}</button>
                </div>
            `;
            row.querySelector('.reset-2fa').addEventListener('click', async () => {
                if (!confirm(`2FA für ${u.name} wirklich zurücksetzen? Muss danach beim nächsten Login neu eingerichtet werden.`)) return;
                await api(`/admin/users/${u.id}/reset-2fa`, { method: 'PUT' });
                alert('2FA zurückgesetzt.');
            });
            row.querySelector('.reset-pw').addEventListener('click', async () => {
                const pw = prompt(`Neues Passwort für ${u.name} (mind. 8 Zeichen):`);
                if (!pw) return;
                try {
                    await api(`/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: pw }) });
                    alert('Passwort geändert.');
                } catch (err) { alert(err.message); }
            });
            row.querySelector('.toggle-active').addEventListener('click', async () => {
                await api(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ ...u, active: !u.active }) });
                loadUsers();
            });
            list.appendChild(row);
        });
    }

    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('user-form-status');
        statusEl.textContent = '';
        try {
            await api('/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('new-user-name').value,
                    username: document.getElementById('new-user-username').value,
                    password: document.getElementById('new-user-password').value,
                    vacationDaysPerYear: parseFloat(document.getElementById('new-user-vacation').value),
                    pensumPercent: parseFloat(document.getElementById('new-user-pensum').value),
                    weeklyHours: parseFloat(document.getElementById('new-user-weekly-hours').value),
                    role: document.getElementById('new-user-role').value,
                    color: document.getElementById('new-user-color').value
                })
            });
            statusEl.textContent = '✓ Angelegt.';
            statusEl.className = 'col-span-2 text-xs text-emerald-400';
            e.target.reset();
            loadUsers();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'col-span-2 text-xs text-red-400';
        }
    });

    // --- Übersicht: eine Zeile pro Person (Arbeitszeiten / Schichtplan / Ferien) ---
    let currentOverviewTab = 'hours';
    let currentOverviewWeekStart = startOfWeek(new Date());

    document.querySelectorAll('.overview-subnav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchOverviewTab(btn.dataset.overviewTab));
    });
    document.getElementById('overview-week-prev').addEventListener('click', () => { currentOverviewWeekStart.setDate(currentOverviewWeekStart.getDate() - 7); loadOverview(); });
    document.getElementById('overview-week-next').addEventListener('click', () => { currentOverviewWeekStart.setDate(currentOverviewWeekStart.getDate() + 7); loadOverview(); });

    function switchOverviewTab(tab) {
        currentOverviewTab = tab;
        document.querySelectorAll('.overview-subnav-btn').forEach(b => b.classList.toggle('active', b.dataset.overviewTab === tab));
        document.getElementById('overview-week-nav').classList.toggle('hidden', tab === 'vacation');
        document.getElementById('vacation-timeline-wrap').classList.toggle('hidden', tab !== 'vacation');
        loadOverview();
        if (tab === 'vacation') renderVacationTimeline();
    }

    // --- Backup & Wiederherstellung ---
    document.getElementById('backup-create-btn').addEventListener('click', () => {
        window.location.href = '/api/admin/backup';
    });
    document.getElementById('backup-restore-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('backup-restore-file');
        const statusEl = document.getElementById('backup-restore-status');
        if (!fileInput.files[0]) { alert('Bitte zuerst eine Backup-Datei auswählen.'); return; }
        if (!confirm('Aktuelle Datenbank wirklich durch dieses Backup ersetzen? Das kann nicht rückgängig gemacht werden.')) return;
        const formData = new FormData();
        formData.append('backup', fileInput.files[0]);
        statusEl.textContent = 'Wird wiederhergestellt...';
        statusEl.className = 'text-xs text-slate-400 mt-2';
        statusEl.classList.remove('hidden');
        try {
            const res = await fetch('/api/admin/backup/restore', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            statusEl.textContent = '✓ ' + data.message + ' Seite lädt in 5 Sekunden neu...';
            statusEl.className = 'text-xs text-emerald-400 mt-2';
            setTimeout(() => location.reload(), 5000);
        } catch (err) {
            statusEl.textContent = '✗ ' + err.message;
            statusEl.className = 'text-xs text-red-400 mt-2';
        }
    });

    async function renderVacationTimeline() {
        const year = new Date().getFullYear();
        document.querySelector('#vacation-timeline-wrap h2').textContent = `Ganzjährige Übersicht ${year}`;
        const data = await api(`/overview/vacation-timeline?year=${year}`);

        const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        const daysInMonth = (m) => new Date(year, m + 1, 0).getDate();
        const todayStr = fmtDate(new Date());

        let headerHtml = '<tr><th class="sticky left-0 bg-slate-950 px-3 py-2 text-left text-[10px] text-slate-400 z-10" style="min-width:140px;">Person</th>';
        for (let m = 0; m < 12; m++) {
            headerHtml += `<th colspan="${daysInMonth(m)}" class="text-center text-[10px] text-slate-400 font-semibold border-l border-slate-800 py-1">${monthNames[m]}</th>`;
        }
        headerHtml += '</tr>';

        let bodyHtml = data.map(u => {
            let row = `<tr><td class="sticky left-0 bg-slate-900 px-3 py-1 text-xs text-slate-200 font-medium whitespace-nowrap z-10" style="min-width:140px;"><span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${u.color}"></span>${u.name}</td>`;
            for (let m = 0; m < 12; m++) {
                const dim = daysInMonth(m);
                for (let d = 1; d <= dim; d++) {
                    const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const range = u.ranges.find(r => dateStr >= r.startDate && dateStr <= r.endDate);
                    const isToday = dateStr === todayStr;
                    let style = 'width:6px;height:20px;';
                    if (range) style += `background:${u.color};opacity:${range.status === 'pending' ? 0.4 : 1};`;
                    row += `<td style="${style}" class="${isToday ? 'border-l-2 border-r-2 border-blue-400' : ''}" title="${dateStr}${range ? (range.status === 'pending' ? ' · beantragt' : ' · genehmigt') : ''}"></td>`;
                }
            }
            return row + '</tr>';
        }).join('') || `<tr><td class="px-3 py-4 text-slate-500 text-xs">Keine aktiven Mitarbeitenden.</td></tr>`;

        document.getElementById('vacation-timeline-table').innerHTML = `<thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody>`;
    }

    function roleBadge(role) {
        if (role === 'admin') return '<span class="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 ml-1">Admin</span>';
        if (role === 'teamleiter') return '<span class="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 ml-1">TL</span>';
        return '';
    }

    async function loadOverview() {
        const weekEnd = new Date(currentOverviewWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        document.getElementById('overview-week-label').textContent = `${fmtDateDisplay(fmtDate(currentOverviewWeekStart))} – ${fmtDateDisplay(fmtDate(weekEnd))}`;

        const head = document.getElementById('overview-table-head');
        const body = document.getElementById('overview-table-body');

        if (currentOverviewTab === 'hours') {
            const data = await api(`/overview/hours?from=${fmtDate(currentOverviewWeekStart)}&to=${fmtDate(weekEnd)}`);
            head.innerHTML = `<tr><th class="px-4 py-2.5">Person</th><th class="px-4 py-2.5">Std. diese Woche</th><th class="px-4 py-2.5">Status</th></tr>`;
            body.innerHTML = data.map(u => `
                <tr class="border-t border-slate-800">
                    <td class="px-4 py-2.5 text-slate-200 font-medium"><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:${u.color}"></span>${u.name}${roleBadge(u.role)}</td>
                    <td class="px-4 py-2.5 text-slate-300 font-mono">${u.hours.toFixed(2)} Std.</td>
                    <td class="px-4 py-2.5">${u.clockedIn ? '<span class="text-emerald-400 text-xs">● eingestempelt</span>' : '<span class="text-slate-500 text-xs">nicht eingestempelt</span>'}</td>
                </tr>`).join('') || `<tr><td class="px-4 py-4 text-slate-500 text-xs" colspan="3">Keine aktiven Mitarbeitenden.</td></tr>`;

        } else if (currentOverviewTab === 'shifts') {
            const data = await api(`/overview/shifts?from=${fmtDate(currentOverviewWeekStart)}&to=${fmtDate(weekEnd)}`);
            const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
            head.innerHTML = `<tr><th class="px-4 py-2.5">Person</th>${dayNames.map((d, i) => {
                const day = new Date(currentOverviewWeekStart); day.setDate(day.getDate() + i);
                return `<th class="px-1.5 py-2.5 text-center">${d} ${day.getDate()}.${day.getMonth() + 1}.</th>`;
            }).join('')}</tr>`;
            body.innerHTML = data.map(u => {
                const cells = [];
                for (let i = 0; i < 7; i++) {
                    const day = new Date(currentOverviewWeekStart);
                    day.setDate(day.getDate() + i);
                    const dayStr = fmtDate(day);
                    const dayShifts = u.shifts.filter(s => s.date === dayStr);
                    const blocks = dayShifts.map(s => `
                        <div class="rounded-md px-1.5 py-1 mb-1 text-[10px] leading-tight" style="background:${u.color}33;border-left:2px solid ${u.color}">
                            <div class="font-semibold text-white">${s.startTime}–${s.endTime}</div>
                            ${s.role ? `<div class="text-slate-400">${s.role}</div>` : ''}
                        </div>`).join('');
                    cells.push(`<td class="px-1 py-1.5 align-top min-w-[90px]">${blocks || ''}</td>`);
                }
                return `<tr class="border-t border-slate-800">
                    <td class="px-4 py-2.5 text-slate-200 font-medium whitespace-nowrap align-top"><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:${u.color}"></span>${u.name}${roleBadge(u.role)}</td>
                    ${cells.join('')}
                </tr>`;
            }).join('') || `<tr><td class="px-4 py-4 text-slate-500 text-xs" colspan="8">Keine aktiven Mitarbeitenden.</td></tr>`;

        } else if (currentOverviewTab === 'vacation') {
            const data = await api(`/overview/vacation`);
            head.innerHTML = `<tr><th class="px-4 py-2.5">Person</th><th class="px-4 py-2.5">Gesamt</th><th class="px-4 py-2.5">Genommen</th><th class="px-4 py-2.5">Verbleibend</th><th class="px-4 py-2.5">Offene Anträge</th></tr>`;
            body.innerHTML = data.map(u => `
                <tr class="border-t border-slate-800">
                    <td class="px-4 py-2.5 text-slate-200 font-medium"><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:${u.color}"></span>${u.name}${roleBadge(u.role)}</td>
                    <td class="px-4 py-2.5 text-slate-400">${u.total}</td>
                    <td class="px-4 py-2.5 text-amber-400">${u.used}</td>
                    <td class="px-4 py-2.5 text-emerald-400 font-semibold">${u.remaining}</td>
                    <td class="px-4 py-2.5 text-slate-400">${u.pending || ''}</td>
                </tr>`).join('') || `<tr><td class="px-4 py-4 text-slate-500 text-xs" colspan="5">Keine aktiven Mitarbeitenden.</td></tr>`;
        }
    }

    async function loadExternalApiKey() {
        const res = await api('/admin/external-api-key');
        document.getElementById('external-api-key-field').value = res.key || '';
    }
    document.getElementById('external-api-key-copy-btn').addEventListener('click', (e) => {
        const field = document.getElementById('external-api-key-field');
        field.select();
        navigator.clipboard.writeText(field.value);
        e.target.textContent = '✓ Kopiert';
        setTimeout(() => { e.target.textContent = '📋 Kopieren'; }, 2000);
    });
    document.getElementById('external-api-key-regenerate-btn').addEventListener('click', async () => {
        if (!confirm('Neuen API-Schlüssel erzeugen? Der alte Schlüssel wird sofort ungültig - alle bestehenden Integrationen müssen aktualisiert werden.')) return;
        const res = await api('/admin/external-api-key/regenerate', { method: 'POST' });
        document.getElementById('external-api-key-field').value = res.key || '';
    });

    function exportDateRange() {
        const from = document.getElementById('export-from').value;
        const to = document.getElementById('export-to').value;
        let qs = '';
        if (from) qs += `from=${from}`;
        if (to) qs += `${qs ? '&' : ''}to=${to}`;
        return qs ? `?${qs}` : '';
    }
    document.getElementById('export-employees-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/export/employees`;
    });
    document.getElementById('export-time-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/export/time-entries${exportDateRange()}`;
    });
    document.getElementById('export-shifts-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/export/shifts${exportDateRange()}`;
    });
    document.getElementById('export-absences-btn').addEventListener('click', () => {
        window.location.href = `/api/admin/export/absences${exportDateRange()}`;
    });

    document.getElementById('import-employees-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('import-employees-file');
        const statusEl = document.getElementById('import-employees-status');
        if (!fileInput.files[0]) { alert('Bitte zuerst eine CSV-Datei auswählen.'); return; }
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        statusEl.textContent = 'Wird importiert...';
        statusEl.className = 'text-xs text-slate-400 mt-2';
        statusEl.classList.remove('hidden');
        try {
            const res = await fetch('/api/admin/import/employees', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            let msg = `✓ ${data.created} neu angelegt, ${data.updated} aktualisiert.`;
            if (data.errors && data.errors.length) msg += ` ${data.errors.length} Zeile(n) übersprungen.`;
            statusEl.textContent = msg;
            statusEl.className = 'text-xs text-emerald-400 mt-2';
            fileInput.value = '';
            loadUsers();
        } catch (err) {
            statusEl.textContent = '✗ ' + err.message;
            statusEl.className = 'text-xs text-red-400 mt-2';
        }
    });

    boot();
})();
