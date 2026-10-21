(function () {
    const backendUrl = '/api';
    let currentUser = null;
    let loginVia2faAuraDirect = false;
    let mailboxes = [];
    let currentMailboxId = null;
    let currentFolder = 'inbox';
    let currentMessageId = null;
    let currentMessageFrom = '';
    let currentMessageSubject = '';

    async function api(path, options = {}) {
        const res = await fetch(`${backendUrl}${path}`, {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            ...options
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen.');
        return data;
    }

    // --- Login ---
    const loginStepCredentials = document.getElementById('login-step-credentials');
    const loginStep2faSetup = document.getElementById('login-step-2fa-setup');
    const loginStep2fa = document.getElementById('login-step-2fa');
    const loginError = document.getElementById('login-error');

    function showLoginStep(step) {
        loginStepCredentials.classList.toggle('hidden', step !== 'credentials');
        loginStep2faSetup.classList.toggle('hidden', step !== '2fa-setup');
        loginStep2fa.classList.toggle('hidden', step !== '2fa');
    }

    loginStepCredentials.addEventListener('submit', async (e) => {
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
            if (data.requires2faSetup) {
                document.getElementById('twofa-qr-code').src = data.qrCodeDataUrl;
                showLoginStep('2fa-setup');
                return;
            }
            if (data.requires2fa) { showLoginStep('2fa'); loginVia2faAuraDirect = !!data.viaAuraDirect; return; }
            await completeLogin(data);
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
        }
    });

    document.getElementById('twofa-setup-confirm-btn').addEventListener('click', async () => {
        try {
            const data = await api('/login/2fa-setup', { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-setup-code').value }) });
            await completeLogin(data);
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
            showLoginStep('credentials');
        }
    });
    document.getElementById('twofa-confirm-btn').addEventListener('click', async () => {
        try {
            const endpoint = loginVia2faAuraDirect ? '/login/2fa-auradirect' : '/login/2fa';
            const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-code').value }) });
            await completeLogin(data);
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.remove('hidden');
            showLoginStep('credentials');
        }
    });

    async function completeLogin(data) {
        currentUser = { id: data.userId, username: data.username, firstname: data.firstname, role: data.role };
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-name').textContent = `${currentUser.firstname || currentUser.username}${currentUser.role === 'admin' ? ' · Admin' : ''}`;
        if (currentUser.role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        // Einheitliches Menü der Aura-Suite (aura-menu.js): Einstellungen und Admin Panel
        const isAdmin = currentUser.role === 'admin';
        window.AuraAppMenu = {
            logout: doLogout,
            settings: isAdmin ? () => openPanel('settings', 'mailconfig') : openPasswordModal,
            admin: isAdmin ? { users: () => openPanel('admin', 'users'), license: () => openPanel('admin', 'license'), api: () => openPanel('admin', 'security'), security: () => openPanel('admin', 'security'), system: () => openPanel('admin', 'backup') } : null
        };
        if (window.AuraMenuCtl) window.AuraMenuCtl.refresh();
        window.AuraPrivacy.check({ onLogout: doLogout });   // Datenschutzerklärung beim ersten Login (und nach jeder Änderung) bestätigen

        const licenseOk = await checkLicense();
        if (!licenseOk) return;

        await loadMailboxes();
    }

    async function checkLicense() {
        const info = await api('/license');
        if (info.valid) return true;
        document.getElementById('modal-license').classList.remove('hidden');
        if (currentUser.role === 'admin') {
            document.getElementById('license-modal-text').textContent = 'Für diese Installation ist keine gültige Lizenz vorhanden. Die Lizenz wird zentral in AuraControl eingetragen (Admin Panel → Lizenz) und kommt automatisch hierher (spätestens nach 15 Minuten).';
        }
        const recheck = document.getElementById('license-recheck-btn');
        if (recheck) recheck.onclick = () => location.reload();
        return false;
    }

    async function doLogout() {
        await api('/logout');
        location.reload();
    }
    window.AuraAppMenu = { logout: doLogout };   // schon vor der Anmeldung da; nach der Anmeldung kommen Einstellungen und Admin Panel dazu

    // --- Postfächer ---
    async function loadMailboxes() {
        mailboxes = await api('/mailboxes');
        const listEl = document.getElementById('mailbox-list');
        listEl.innerHTML = mailboxes.map(m => `
            <div class="mailbox-item" data-mailbox-id="${m.id}">
                <span>${m.type === 'shared' ? '👥' : '📥'}</span>
                <span class="truncate">${m.displayName || m.address}</span>
            </div>
        `).join('') || '<div class="text-xs text-slate-500 px-2">Noch keine Postfächer - im Admin Panel anlegen.</div>';
        listEl.querySelectorAll('.mailbox-item').forEach(el => {
            el.addEventListener('click', () => selectMailbox(parseInt(el.dataset.mailboxId, 10)));
        });
        if (mailboxes.length > 0 && !currentMailboxId) selectMailbox(mailboxes[0].id);
    }

    function selectMailbox(id) {
        currentMailboxId = id;
        document.querySelectorAll('.mailbox-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.mailboxId, 10) === id));
        loadMessages();
    }

    document.querySelectorAll('.folder-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFolder = btn.dataset.folder;
            document.querySelectorAll('.folder-btn').forEach(b => b.classList.toggle('active', b === btn));
            loadMessages();
        });
    });

    async function loadMessages() {
        if (!currentMailboxId) return;
        const messages = await api(`/mailboxes/${currentMailboxId}/messages?folder=${currentFolder}`);
        const listEl = document.getElementById('message-list');
        listEl.innerHTML = messages.map(m => `
            <div class="message-item ${!m.isRead ? 'unread' : ''}" data-message-id="${m.id}">
                <div class="flex items-center justify-between">
                    <span class="text-xs text-slate-300 truncate">${escapeHtml(m.fromName || m.fromAddress || m.toAddress || '')}</span>
                    <span class="text-[10px] text-slate-500 shrink-0 ml-2">${fmtDate(m.receivedAt)}</span>
                </div>
                <div class="message-item-subject text-xs text-slate-400 truncate">${escapeHtml(m.subject || '(kein Betreff)')}</div>
            </div>
        `).join('') || '<div class="text-xs text-slate-500 p-4 text-center">Keine Nachrichten.</div>';
        listEl.querySelectorAll('.message-item').forEach(el => {
            el.addEventListener('click', () => openMessage(parseInt(el.dataset.messageId, 10)));
        });
    }

    async function openMessage(id) {
        const msg = await api(`/messages/${id}`);
        currentMessageId = id;
        currentMessageFrom = msg.fromAddress;
        currentMessageSubject = msg.subject;
        document.getElementById('message-view-empty').classList.add('hidden');
        document.getElementById('message-view').classList.remove('hidden');
        document.getElementById('message-subject').textContent = msg.subject || '(kein Betreff)';
        document.getElementById('message-from').textContent = msg.fromName ? `${msg.fromName} <${msg.fromAddress}>` : msg.fromAddress;
        document.getElementById('message-to').textContent = msg.toAddress;
        document.getElementById('message-date').textContent = fmtDate(msg.receivedAt, true);
        document.getElementById('message-body').innerHTML = msg.bodyHtml ? sanitizeHtml(msg.bodyHtml) : escapeHtml(msg.bodyText || '');
        document.getElementById('message-attachments').innerHTML = (msg.attachments || []).map(a =>
            `<a href="/api/attachments/${a.id}" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">📎 ${escapeHtml(a.filename)}</a>`
        ).join('');
        loadMessages(); // Ungelesen-Status aktualisieren
    }

    document.getElementById('message-delete-btn').addEventListener('click', async () => {
        if (!currentMessageId || !confirm('Nachricht wirklich löschen?')) return;
        await api(`/messages/${currentMessageId}`, { method: 'DELETE' });
        document.getElementById('message-view').classList.add('hidden');
        document.getElementById('message-view-empty').classList.remove('hidden');
        loadMessages();
    });
    document.getElementById('message-reply-btn').addEventListener('click', () => {
        openCompose({ to: currentMessageFrom, subject: currentMessageSubject.startsWith('Re:') ? currentMessageSubject : `Re: ${currentMessageSubject}` });
    });

    // --- Verfassen ---
    function openCompose(prefill = {}) {
        const fromSelect = document.getElementById('compose-from');
        fromSelect.innerHTML = mailboxes.map(m => `<option value="${m.id}">${m.address}</option>`).join('');
        if (currentMailboxId) fromSelect.value = currentMailboxId;
        document.getElementById('compose-to').value = prefill.to || '';
        document.getElementById('compose-cc').value = '';
        document.getElementById('compose-subject').value = prefill.subject || '';
        document.getElementById('compose-body').value = '';
        document.getElementById('compose-error').classList.add('hidden');
        document.getElementById('modal-compose').classList.remove('hidden');
    }
    document.getElementById('compose-btn').addEventListener('click', () => openCompose());
    document.getElementById('compose-close-btn').addEventListener('click', () => document.getElementById('modal-compose').classList.add('hidden'));
    document.getElementById('compose-send-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('compose-error');
        errorEl.classList.add('hidden');
        const fromId = document.getElementById('compose-from').value;
        try {
            await api(`/mailboxes/${fromId}/send`, {
                method: 'POST',
                body: JSON.stringify({
                    to: document.getElementById('compose-to').value,
                    cc: document.getElementById('compose-cc').value,
                    subject: document.getElementById('compose-subject').value,
                    text: document.getElementById('compose-body').value
                })
            });
            document.getElementById('modal-compose').classList.add('hidden');
            if (parseInt(fromId, 10) === currentMailboxId && currentFolder === 'sent') loadMessages();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        }
    });

    // --- Passwort ändern ---
    function openPasswordModal() {
        document.getElementById('password-current').value = '';
        document.getElementById('password-new').value = '';
        document.getElementById('password-new-repeat').value = '';
        document.getElementById('password-error').classList.add('hidden');
        document.getElementById('password-success').classList.add('hidden');
        document.getElementById('modal-password').classList.remove('hidden');
        document.getElementById('modal-password').style.zIndex = '60';   // liegt auch dann OBEN, wenn das Admin Panel offen ist
        window.AuraPrefs.card(document.getElementById('password-prefs-card'));   // Darstellung (Dunkel/Hell/Automatisch)
    }
    document.getElementById('open-password-btn').addEventListener('click', openPasswordModal);
    document.getElementById('password-close-btn').addEventListener('click', () => document.getElementById('modal-password').classList.add('hidden'));
    document.getElementById('password-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('password-error');
        const successEl = document.getElementById('password-success');
        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');
        const current = document.getElementById('password-current').value;
        const next = document.getElementById('password-new').value;
        const repeat = document.getElementById('password-new-repeat').value;
        if (!current || !next) { errorEl.textContent = 'Bitte beide Passwort-Felder ausfüllen.'; errorEl.classList.remove('hidden'); return; }
        if (next !== repeat) { errorEl.textContent = 'Die Wiederholung stimmt nicht mit dem neuen Passwort überein.'; errorEl.classList.remove('hidden'); return; }
        if (next.length < 8) { errorEl.textContent = 'Das neue Passwort sollte mindestens 8 Zeichen haben.'; errorEl.classList.remove('hidden'); return; }
        try {
            await api('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
            successEl.textContent = '✓ Passwort geändert.';
            successEl.classList.remove('hidden');
            setTimeout(() => document.getElementById('modal-password').classList.add('hidden'), 1200);
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        }
    });

    // --- Admin Panel ---
    // Ein Fenster für zwei Menüpunkte: "Einstellungen" (Anpassungen des Produkts) und "Admin Panel" (Benutzer, Lizenz, Sicherheit, System)
    function openPanel(group, tab) {
        document.getElementById('modal-admin').classList.remove('hidden');
        document.getElementById('admin-modal-title').textContent = group === 'settings' ? '⚙️ Einstellungen' : '🛠️ Admin Panel';
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('hidden', b.dataset.group !== group));
        switchAdminTab(tab);
    }
    document.getElementById('admin-close-btn').addEventListener('click', () => document.getElementById('modal-admin').classList.add('hidden'));

    function switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.adminTab === tab));
        document.querySelectorAll('.admin-tab').forEach(el => el.classList.toggle('hidden', el.id !== `admin-tab-${tab}`));
        if (tab === 'mailconfig') loadMailConfig();
        if (tab === 'mailboxes') loadMailboxAdmin();
        if (tab === 'users') loadUserAdmin();
        if (tab === 'auradirect') loadAuraDirectSettings();
        if (tab === 'security') { loadSecuritySettings(); loadExternalApiKey(); }
        if (tab === 'license') loadLicenseAdminStatus();
        if (tab === 'privacy') window.AuraPrivacy.editor(document.getElementById('admin-privacy-editor'), {});
        if (tab === 'prefs') window.AuraPrefs.card(document.getElementById('admin-prefs-card'));
    }
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab)));

    // Mail-Anbindung
    async function loadMailConfig() {
        const cfg = await api('/admin/mail-config');
        document.getElementById('mail-mode-select').value = cfg.mode;
        document.getElementById('internal-domain').value = cfg.internal.domain || '';
        document.getElementById('internal-relay-host').value = cfg.internal.relayHost || '';
        document.getElementById('internal-relay-port').value = cfg.internal.relayPort || '';
        document.getElementById('internal-relay-username').value = cfg.internal.relayUsername || '';
        document.getElementById('o365-tenant-id').value = cfg.o365.tenantId || '';
        document.getElementById('o365-client-id').value = cfg.o365.clientId || '';
        document.getElementById('external-imap-host').value = cfg.external.imapHost || '';
        document.getElementById('external-imap-port').value = cfg.external.imapPort || '';
        document.getElementById('external-smtp-host').value = cfg.external.smtpHost || '';
        document.getElementById('external-smtp-port').value = cfg.external.smtpPort || '';
        applyMailModeVisibility();

        const boxes = await api('/mailboxes');
        document.getElementById('test-send-mailbox').innerHTML = boxes.map(m => `<option value="${m.id}">${m.address}</option>`).join('') || '<option value="">Keine Postfächer vorhanden</option>';
    }
    function applyMailModeVisibility() {
        const mode = document.getElementById('mail-mode-select').value;
        document.getElementById('mailconfig-internal').classList.toggle('hidden', mode !== 'internal');
        document.getElementById('mailconfig-o365').classList.toggle('hidden', mode !== 'o365');
        document.getElementById('mailconfig-external').classList.toggle('hidden', mode !== 'external');
        document.getElementById('new-mailbox-external-fields').classList.toggle('hidden', mode !== 'external');
    }
    document.getElementById('mail-mode-select').addEventListener('change', async (e) => {
        await api('/admin/mail-config/mode', { method: 'POST', body: JSON.stringify({ mode: e.target.value }) });
        applyMailModeVisibility();
    });
    document.getElementById('internal-save-btn').addEventListener('click', async () => {
        await api('/admin/mail-config/internal', {
            method: 'POST',
            body: JSON.stringify({
                domain: document.getElementById('internal-domain').value,
                relayHost: document.getElementById('internal-relay-host').value,
                relayPort: document.getElementById('internal-relay-port').value,
                relayUsername: document.getElementById('internal-relay-username').value,
                relayPassword: document.getElementById('internal-relay-password').value
            })
        });
        document.getElementById('internal-relay-password').value = '';
        alert('Gespeichert.');
    });
    document.getElementById('o365-save-btn').addEventListener('click', async () => {
        await api('/admin/mail-config/o365', {
            method: 'POST',
            body: JSON.stringify({
                tenantId: document.getElementById('o365-tenant-id').value,
                clientId: document.getElementById('o365-client-id').value,
                clientSecret: document.getElementById('o365-client-secret').value
            })
        });
        document.getElementById('o365-client-secret').value = '';
        alert('Gespeichert.');
    });
    document.getElementById('external-save-btn').addEventListener('click', async () => {
        await api('/admin/mail-config/external', {
            method: 'POST',
            body: JSON.stringify({
                imapHost: document.getElementById('external-imap-host').value,
                imapPort: document.getElementById('external-imap-port').value,
                smtpHost: document.getElementById('external-smtp-host').value,
                smtpPort: document.getElementById('external-smtp-port').value
            })
        });
        alert('Gespeichert.');
    });
    document.getElementById('mailconfig-test-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('mailconfig-test-result');
        resultEl.textContent = 'Teste...';
        resultEl.className = 'text-xs text-slate-400';
        resultEl.classList.remove('hidden');
        const result = await api('/admin/mail-config/test', { method: 'POST' });
        resultEl.textContent = (result.success ? '✓ ' : '✗ ') + result.message;
        resultEl.className = `text-xs ${result.success ? 'text-emerald-400' : 'text-red-400'}`;
    });
    document.getElementById('test-send-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('test-send-result');
        const mailboxId = document.getElementById('test-send-mailbox').value;
        const to = document.getElementById('test-send-to').value;
        if (!mailboxId || !to) { alert('Bitte Absender-Postfach und Empfänger-Adresse angeben.'); return; }
        resultEl.textContent = 'Wird gesendet...';
        resultEl.className = 'text-xs text-slate-400';
        resultEl.classList.remove('hidden');
        try {
            const result = await api('/admin/mail-config/test-send', { method: 'POST', body: JSON.stringify({ mailboxId, to }) });
            resultEl.textContent = '✓ ' + result.message;
            resultEl.className = 'text-xs text-emerald-400';
        } catch (err) {
            resultEl.textContent = '✗ ' + err.message;
            resultEl.className = 'text-xs text-red-400';
        }
    });

    // Postfächer (Admin)
    async function loadMailboxAdmin() {
        // Der Microsoft-365-Auswahlbereich ist nur sinnvoll, wenn dieser Modus aktiv ist
        try {
            const cfg = await api('/admin/mail-config');
            document.getElementById('o365-import-section').classList.toggle('hidden', cfg.mode !== 'o365');
        } catch { /* nicht kritisch */ }
        const users = await api('/admin/users');
        const ownerSelect = document.getElementById('new-mailbox-owner');
        ownerSelect.innerHTML = '<option value="">Kein:e Eigentümer:in</option>' + users.map(u => `<option value="${u.id}">${u.firstname} ${u.lastname} (${u.username})</option>`).join('');

        const list = await api('/mailboxes');
        document.getElementById('mailbox-admin-list').innerHTML = list.map(m => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                    <span class="text-sm text-white font-medium">${escapeHtml(m.displayName || m.address)}</span>
                    <span class="text-xs text-slate-500 ml-2">${m.address} · ${m.type === 'shared' ? 'geteilt' : 'persönlich'}${m.ownerUsername ? ' · ' + escapeHtml(m.ownerUsername) : (m.type === 'shared' ? '' : ' · <span class="text-amber-400">ohne Eigentümer:in</span>')}</span>
                </div>
                <div class="flex items-center gap-3">
                    <button data-mailbox-assign="${m.id}" data-mailbox-address="${escapeHtml(m.address)}" class="text-xs text-blue-400 hover:text-blue-300">Zuweisen</button>
                    <button data-mailbox-delete="${m.id}" class="text-xs text-red-400 hover:text-red-300">Löschen</button>
                </div>
            </div>
        `).join('') || '<div class="text-xs text-slate-500">Noch keine Postfächer.</div>';
        document.querySelectorAll('[data-mailbox-delete]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Postfach wirklich löschen? Nachrichten bleiben in der Datenbank, sind aber nicht mehr erreichbar.')) return;
                await api(`/admin/mailboxes/${btn.dataset.mailboxDelete}`, { method: 'DELETE' });
                loadMailboxAdmin();
                loadMailboxes();
            });
        });
        document.querySelectorAll('[data-mailbox-assign]').forEach(btn => {
            btn.addEventListener('click', () => openMailboxAssign(btn.dataset.mailboxAssign, btn.dataset.mailboxAddress));
        });
    }

    // --- Postfach zuweisen: Eigentümer:in + wer es zusätzlich nutzen darf ---
    async function openMailboxAssign(mailboxId, address) {
        const errorEl = document.getElementById('assign-error');
        errorEl.classList.add('hidden');
        try {
            const [users, current] = await Promise.all([api('/admin/users'), api(`/admin/mailboxes/${mailboxId}/assignment`)]);
            const label = (u) => `${escapeHtml(((u.firstname || '') + ' ' + (u.lastname || '')).trim() || u.username)} (${escapeHtml(u.username)})`;
            document.getElementById('assign-mailbox-id').value = mailboxId;
            document.getElementById('assign-title').textContent = `Zuweisen: ${address}`;
            document.getElementById('assign-owner').innerHTML = '<option value="">Niemand</option>' + users.map(u => `<option value="${u.id}" ${u.id === current.ownerUserId ? 'selected' : ''}>${label(u)}</option>`).join('');
            document.getElementById('assign-access-list').innerHTML = users.map(u => `
                <label class="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 cursor-pointer">
                    <input type="checkbox" data-assign-user="${u.id}" class="w-4 h-4 accent-blue-600" ${current.accessUserIds.includes(u.id) ? 'checked' : ''}> ${label(u)}
                </label>`).join('') || '<div class="text-xs text-slate-500">Noch keine Benutzer vorhanden. Zuerst im Reiter "AuraDirect" die Personen übernehmen.</div>';
            document.getElementById('modal-mailbox-assign').classList.remove('hidden');
        } catch (err) {
            alert(err.message);
        }
    }
    document.getElementById('assign-close-btn').addEventListener('click', () => document.getElementById('modal-mailbox-assign').classList.add('hidden'));
    document.getElementById('assign-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('assign-error');
        errorEl.classList.add('hidden');
        try {
            await api(`/admin/mailboxes/${document.getElementById('assign-mailbox-id').value}/assignment`, {
                method: 'PUT',
                body: JSON.stringify({
                    ownerUserId: document.getElementById('assign-owner').value || null,
                    accessUserIds: [...document.querySelectorAll('#assign-access-list input[data-assign-user]:checked')].map(cb => parseInt(cb.dataset.assignUser, 10))
                })
            });
            document.getElementById('modal-mailbox-assign').classList.add('hidden');
            loadMailboxAdmin();
            loadMailboxes();
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });
    // --- Microsoft 365: Konten laden, ankreuzen, übernehmen ---
    let o365Accounts = [];
    function renderO365Accounts() {
        const listEl = document.getElementById('o365-mailbox-list');
        listEl.innerHTML = o365Accounts.map((m, i) => `
            <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                <input type="checkbox" data-o365-index="${i}" class="w-4 h-4 accent-blue-600" ${m.alreadyAdded ? 'disabled' : ''}>
                <div class="flex-1 min-w-0">
                    <div class="text-xs text-white truncate">${escapeHtml(m.displayName || m.address)}</div>
                    <div class="text-[10px] text-slate-500 truncate">${escapeHtml(m.address)}${m.accountEnabled ? '' : ' · deaktiviertes Konto (oft ein geteiltes Postfach)'}</div>
                </div>
                ${m.alreadyAdded
                    ? '<span class="text-[10px] text-emerald-400 shrink-0">bereits angelegt</span>'
                    : `<select data-o365-type="${i}" class="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white shrink-0">
                           <option value="personal" ${m.accountEnabled ? 'selected' : ''}>Persönlich</option>
                           <option value="shared" ${m.accountEnabled ? '' : 'selected'}>Geteilt</option>
                       </select>`}
            </div>
        `).join('') || '<div class="text-xs text-slate-500">Keine Konten mit E-Mail-Adresse gefunden.</div>';
        const hasSelectable = o365Accounts.some(m => !m.alreadyAdded);
        document.getElementById('o365-import-btn').classList.toggle('hidden', !hasSelectable);
        document.getElementById('o365-select-all-wrap').classList.toggle('hidden', !hasSelectable);
        document.getElementById('o365-select-all').checked = false;
    }
    document.getElementById('o365-load-btn').addEventListener('click', async () => {
        const btn = document.getElementById('o365-load-btn');
        const errorEl = document.getElementById('o365-load-error');
        errorEl.classList.add('hidden');
        document.getElementById('o365-import-result').classList.add('hidden');
        btn.textContent = 'Lade...';
        try {
            o365Accounts = await api('/admin/o365/mailboxes');
            renderO365Accounts();
        } catch (err) {
            errorEl.textContent = '✗ ' + err.message;
            errorEl.classList.remove('hidden');
        } finally {
            btn.textContent = 'Konten aus Microsoft 365 laden';
        }
    });
    document.getElementById('o365-select-all').addEventListener('change', (e) => {
        document.querySelectorAll('#o365-mailbox-list input[data-o365-index]:not(:disabled)').forEach(cb => { cb.checked = e.target.checked; });
    });
    document.getElementById('o365-import-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('o365-import-result');
        const selected = [...document.querySelectorAll('#o365-mailbox-list input[data-o365-index]:checked')].map(cb => {
            const i = parseInt(cb.dataset.o365Index, 10);
            const typeSelect = document.querySelector(`#o365-mailbox-list select[data-o365-type="${i}"]`);
            return { address: o365Accounts[i].address, displayName: o365Accounts[i].displayName, type: typeSelect ? typeSelect.value : 'personal' };
        });
        if (selected.length === 0) { alert('Bitte zuerst mindestens ein Konto ankreuzen.'); return; }
        resultEl.textContent = 'Übernehme...';
        resultEl.className = 'text-xs text-slate-400';
        resultEl.classList.remove('hidden');
        try {
            const r = await api('/admin/o365/mailboxes/import', { method: 'POST', body: JSON.stringify({ mailboxes: selected }) });
            resultEl.textContent = `✓ ${r.created} Postfach/Postfächer angelegt${r.linked ? `, davon ${r.linked} automatisch einer Person zugeordnet` : ''}${r.skipped ? `, ${r.skipped} übersprungen (gab es schon)` : ''}.`;
            resultEl.className = 'text-xs text-emerald-400';
            o365Accounts = await api('/admin/o365/mailboxes');
            renderO365Accounts();
            loadMailboxAdmin();
            loadMailboxes();
        } catch (err) {
            resultEl.textContent = '✗ ' + err.message;
            resultEl.className = 'text-xs text-red-400';
        }
    });

    document.getElementById('new-mailbox-btn').addEventListener('click', async () => {
        try {
            await api('/admin/mailboxes', {
                method: 'POST',
                body: JSON.stringify({
                    address: document.getElementById('new-mailbox-address').value,
                    displayName: document.getElementById('new-mailbox-displayname').value,
                    type: document.getElementById('new-mailbox-type').value,
                    ownerUserId: document.getElementById('new-mailbox-owner').value || null,
                    externalUsername: document.getElementById('new-mailbox-username').value,
                    externalPassword: document.getElementById('new-mailbox-password').value
                })
            });
            document.getElementById('new-mailbox-address').value = '';
            document.getElementById('new-mailbox-displayname').value = '';
            loadMailboxAdmin();
            loadMailboxes();
        } catch (err) {
            alert(err.message);
        }
    });

    // Benutzer (Admin)
    async function loadUserAdmin() {
        const users = await api('/admin/users');
        document.getElementById('user-admin-list').innerHTML = users.map(u => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div>
                    <span class="text-sm text-white font-medium">${escapeHtml(u.firstname)} ${escapeHtml(u.lastname)}</span>
                    <span class="text-xs text-slate-500 ml-2">${u.username} · ${u.role === 'admin' ? 'Admin' : 'Person'}${u.source === 'auradirect' ? ' · AuraDirect' : ''}${!u.active ? ' · deaktiviert' : ''}</span>
                </div>
                <button data-user-toggle="${u.id}" data-active="${u.active}" class="text-xs ${u.active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}">${u.active ? 'Deaktivieren' : 'Aktivieren'}</button>
            </div>
        `).join('');
        document.querySelectorAll('[data-user-toggle]').forEach(btn => {
            btn.addEventListener('click', async () => {
                await api(`/admin/users/${btn.dataset.userToggle}`, { method: 'PUT', body: JSON.stringify({ active: btn.dataset.active !== '1' }) });
                loadUserAdmin();
            });
        });
    }
    // Neue Benutzer werden nicht mehr hier angelegt: das geschieht zentral in AuraDirect (kostenlos).
    // AuraDirect
    async function loadAuraDirectSettings() {
        const s = await api('/admin/auradirect');
        document.getElementById('auradirect-url-input').value = s.url || '';
        const statusEl = document.getElementById('auradirect-servicekey-status');
        statusEl.textContent = s.hasServiceKey ? '✓ Dienst-Schlüssel hinterlegt' : '✗ Noch kein Dienst-Schlüssel hinterlegt - Abgleich schlägt sonst mit "Status 401" fehl.';
        statusEl.className = s.hasServiceKey ? 'text-xs text-emerald-400' : 'text-xs text-amber-400';
    }
    document.getElementById('auradirect-save-btn').addEventListener('click', async () => {
        try {
            await api('/admin/auradirect', {
                method: 'POST',
                body: JSON.stringify({ url: document.getElementById('auradirect-url-input').value, serviceKey: document.getElementById('auradirect-servicekey-input').value })
            });
            document.getElementById('auradirect-servicekey-input').value = '';
            alert('Gespeichert.');
            loadAuraDirectSettings();
        } catch (err) {
            alert(err.message);
        }
    });
    document.getElementById('auradirect-sync-users-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('auradirect-sync-result');
        resultEl.textContent = 'Lese Personen aus AuraDirect...';
        resultEl.className = 'text-xs text-slate-400 mt-1';
        resultEl.classList.remove('hidden');
        try {
            const r = await api('/admin/auradirect/sync-users', { method: 'POST' });
            let msg = `✓ ${r.created} neu übernommen, ${r.updated} aktualisiert (${r.total} Person(en) in AuraDirect für AuraMail freigeschaltet).`;
            if (r.assigned) msg += ` ${r.assigned} Postfach/Postfächer anhand der E-Mail-Adresse automatisch zugeordnet.`;
            if (r.notEnabled && r.notEnabled.length) msg += ` ⚠️ In AuraDirect vorhanden, aber OHNE Häkchen "AuraMail" (deshalb nicht übernommen): ${r.notEnabled.join(', ')}. Dort bei der Person bearbeiten → Häkchen "AuraMail" → Speichern, dann hier nochmal.`;
            if (r.conflicts && r.conflicts.length) msg += ` Übersprungen, weil es lokal schon ein Konto mit diesem Namen gibt: ${r.conflicts.join(', ')}.`;
            if (r.notInDirect) msg += ` Hinweis: ${r.notInDirect} hier bekannte Person(en) sind in AuraDirect nicht mehr für AuraMail freigeschaltet (bleiben unverändert).`;
            resultEl.textContent = msg;
            resultEl.className = 'text-xs text-emerald-400 mt-1';
            loadUserAdmin();
        } catch (err) {
            resultEl.textContent = '✗ ' + err.message;
            resultEl.className = 'text-xs text-red-400 mt-1';
        }
    });
    document.getElementById('auradirect-sync-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('auradirect-sync-result');
        resultEl.textContent = 'Gleiche ab...';
        resultEl.className = 'text-xs text-slate-400 mt-1';
        resultEl.classList.remove('hidden');
        try {
            const result = await api('/admin/auradirect/sync', { method: 'POST' });
            resultEl.textContent = `✓ ${result.created} neu angelegt, ${result.skipped} bereits vorhanden (von ${result.total} Personen).`;
            resultEl.className = 'text-xs text-emerald-400 mt-1';
            loadMailboxAdmin();
            loadMailboxes();
        } catch (err) {
            resultEl.textContent = '✗ ' + err.message;
            resultEl.className = 'text-xs text-red-400 mt-1';
        }
    });

    // Sicherheit
    async function loadSecuritySettings() {
        const s = await api('/admin/security');
        document.getElementById('twofa-required-toggle').checked = s.twofaRequired;
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
        if (!confirm('Neuen Dienst-Schlüssel erzeugen? Der alte wird sofort ungültig - alle bestehenden Integrationen (z.B. AuraTicket) müssen aktualisiert werden.')) return;
        const res = await api('/admin/external-api-key/regenerate', { method: 'POST' });
        document.getElementById('external-api-key-field').value = res.key || '';
    });
    document.getElementById('twofa-required-toggle').addEventListener('change', async (e) => {
        await api('/admin/security', { method: 'POST', body: JSON.stringify({ twofaRequired: e.target.checked }) });
    });

    // Lizenz
    async function loadLicenseAdminStatus() {
        const info = await api('/license');
        const statusEl = document.getElementById('license-admin-status');
        if (info.licenseValid) {
            statusEl.textContent = `✓ Lizenziert für "${info.customer}"${info.expiresAt ? ' · gültig bis ' + fmtDateDisplay(info.expiresAt.slice(0, 10)) : ' · unbegrenzt'}`;
            statusEl.className = 'text-xs text-emerald-400 mb-3';
        } else if (info.trial) {
            statusEl.textContent = `⏳ Testphase aktiv - noch ${info.trialDaysRemaining} Tag(e). Danach braucht AuraMail eine Lizenz (Business Solo oder Business Advanced).`;
            statusEl.className = 'text-xs text-amber-400 mb-3';
        } else {
            statusEl.textContent = `✗ Keine gültige Lizenz (${info.error || 'unbekannt'}). AuraMail ist in Business Solo und Business Advanced enthalten.`;
            statusEl.className = 'text-xs text-red-400 mb-3';
        }
        if (info.licenseValid) statusEl.textContent += info.managedBy === 'auracontrol' ? ' · von AuraControl übertragen' : '';
        if (info.plan) statusEl.textContent += ' · ' + (info.plan === 'advanced' ? 'Business Advanced' : info.plan === 'solo' ? 'Business Solo' : 'Aura-Suite');
    }
    // Lizenz eintragen/entfernen gibt es hier nicht mehr: sie kommt aus AuraControl

    // Backup
    document.getElementById('backup-create-btn').addEventListener('click', () => { window.location.href = '/api/admin/backup'; });
    document.getElementById('backup-restore-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('backup-restore-file');
        const statusEl = document.getElementById('backup-restore-status');
        if (!fileInput.files[0]) { alert('Bitte zuerst eine Backup-Datei auswählen.'); return; }
        if (!confirm('Aktuelle Datenbank wirklich ersetzen?')) return;
        const formData = new FormData();
        formData.append('backup', fileInput.files[0]);
        statusEl.textContent = 'Wird wiederhergestellt...';
        statusEl.className = 'text-xs text-slate-400';
        statusEl.classList.remove('hidden');
        try {
            const res = await fetch('/api/admin/backup/restore', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            statusEl.textContent = '✓ ' + data.message;
            statusEl.className = 'text-xs text-emerald-400';
            setTimeout(() => location.reload(), 5000);
        } catch (err) {
            statusEl.textContent = '✗ ' + err.message;
            statusEl.className = 'text-xs text-red-400';
        }
    });

    // --- Hilfsfunktionen ---
    function escapeHtml(s) {
        const div = document.createElement('div');
        div.textContent = s || '';
        return div.innerHTML;
    }
    // Sehr einfache HTML-Bereinigung für angezeigte Nachrichten - entfernt Skripte/Event-
    // Handler. Für ernsthaften Schutz vor bösartigem HTML in E-Mails wäre eine ausgereifte
    // Bibliothek wie DOMPurify die robustere Wahl.
    function sanitizeHtml(html) {
        return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/ on\w+="[^"]*"/gi, '').replace(/ on\w+='[^']*'/gi, '');
    }
    function fmtDate(iso, full) {
        if (!iso) return '';
        const d = new Date(iso);
        return full ? d.toLocaleString('de-DE') : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }
    function fmtDateDisplay(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
    }
})();
