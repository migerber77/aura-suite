(function () {
    const backendUrl = '/api';
    let currentUser = null;
    let loginVia2faAuraDirect = false;
    let currentTicketId = null;
    let currentStatusFilter = '';
    let users = [];
    let currentCampaignId = null;

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
                body: JSON.stringify({ username: document.getElementById('login-username').value, password: document.getElementById('login-password').value })
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
            loginError.textContent = err.message; loginError.classList.remove('hidden'); showLoginStep('credentials');
        }
    });
    document.getElementById('twofa-confirm-btn').addEventListener('click', async () => {
        try {
            const endpoint = loginVia2faAuraDirect ? '/login/2fa-auradirect' : '/login/2fa';
            const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-code').value }) });
            await completeLogin(data);
        } catch (err) {
            loginError.textContent = err.message; loginError.classList.remove('hidden'); showLoginStep('credentials');
        }
    });

    async function completeLogin(data) {
        currentUser = { id: data.userId, username: data.username, firstname: data.firstname, role: data.role };
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-name').textContent = `${currentUser.firstname || currentUser.username}${currentUser.role === 'admin' ? ' · Admin' : ''}`;
        if (currentUser.role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));

        const licenseOk = await checkLicense();
        if (!licenseOk) return;

        await loadUsersForAssignment();
        await loadTickets();
    }

    async function checkLicense() {
        const info = await api('/license');
        if (info.valid) return true;
        document.getElementById('modal-license').classList.remove('hidden');
        if (currentUser.role === 'admin') {
            document.getElementById('license-modal-text').textContent = 'Für diese Installation ist keine gültige Lizenz hinterlegt. Bitte Lizenzschlüssel eintragen:';
            document.getElementById('license-modal-admin-form').classList.remove('hidden');
            document.getElementById('license-save-btn').onclick = async () => {
                const errorEl = document.getElementById('license-modal-error');
                errorEl.classList.add('hidden');
                try {
                    await api('/admin/license', { method: 'POST', body: JSON.stringify({ key: document.getElementById('license-key-input').value }) });
                    document.getElementById('modal-license').classList.add('hidden');
                    await loadTickets();
                } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
            };
        }
        return false;
    }
    document.getElementById('logout-btn').addEventListener('click', async (e) => { e.preventDefault(); await api('/logout'); location.reload(); });

    // --- Ansicht wechseln ---
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.getElementById('view-tickets').classList.toggle('hidden', btn.dataset.view !== 'tickets');
            document.getElementById('view-campaigns').classList.toggle('hidden', btn.dataset.view !== 'campaigns');
            if (btn.dataset.view === 'campaigns') loadCampaigns();
        });
    });

    // --- Tickets ---
    async function loadUsersForAssignment() {
        try {
            users = await api('/admin/users');
        } catch { users = []; } // nur Admins dürfen diese Liste laden - für Agenten bleibt sie leer, Zuweisungs-Dropdown bleibt dann einfach bei "nicht zugewiesen"
        const select = document.getElementById('ticket-assignee-select');
        select.innerHTML = '<option value="">Nicht zugewiesen</option>' + users.map(u => `<option value="${u.id}">${u.firstname} ${u.lastname}</option>`).join('');
    }

    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentStatusFilter = btn.dataset.status;
            document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
            loadTickets();
        });
    });

    const statusEmoji = { open: '🟢', pending: '🟡', resolved: '✅', closed: '⚫' };
    async function loadTickets() {
        const qs = currentStatusFilter ? `?status=${currentStatusFilter}` : '';
        const tickets = await api(`/tickets${qs}`);
        const listEl = document.getElementById('ticket-list');
        listEl.innerHTML = tickets.map(t => `
            <div class="ticket-item ${t.id === currentTicketId ? 'active' : ''}" data-ticket-id="${t.id}">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] text-slate-500">${t.number}</span>
                    <span class="text-[10px] text-slate-500">${statusEmoji[t.status] || ''}</span>
                </div>
                <div class="text-xs text-white truncate">${escapeHtml(t.subject)}</div>
                <div class="text-[11px] text-slate-500 truncate">${escapeHtml(t.requesterName || t.requesterEmail)}${t.assignedFirstname ? ' · ' + t.assignedFirstname : ''}</div>
            </div>
        `).join('') || '<div class="text-xs text-slate-500 p-4 text-center">Keine Tickets.</div>';
        listEl.querySelectorAll('.ticket-item').forEach(el => el.addEventListener('click', () => openTicket(parseInt(el.dataset.ticketId, 10))));
    }

    const directionLabel = { incoming: 'msg-incoming', outgoing: 'msg-outgoing', note: 'msg-note' };
    async function openTicket(id) {
        const ticket = await api(`/tickets/${id}`);
        currentTicketId = id;
        document.getElementById('ticket-view-empty').classList.add('hidden');
        document.getElementById('ticket-view').classList.remove('hidden');
        document.getElementById('ticket-number').textContent = ticket.number;
        document.getElementById('ticket-subject').textContent = ticket.subject;
        document.getElementById('ticket-requester').textContent = ticket.requesterName ? `${ticket.requesterName} <${ticket.requesterEmail}>` : ticket.requesterEmail;
        document.getElementById('ticket-status-select').value = ticket.status;
        document.getElementById('ticket-priority-select').value = ticket.priority;
        document.getElementById('ticket-assignee-select').value = ticket.assignedUserId || '';
        document.getElementById('ticket-messages').innerHTML = ticket.messages.map(m => `
            <div class="flex flex-col ${m.direction === 'outgoing' ? 'items-end' : 'items-start'}">
                <div class="msg-bubble ${directionLabel[m.direction] || 'msg-incoming'}">
                    ${m.direction === 'note' ? '<div class="text-[10px] mb-1 opacity-70">📝 Interne Notiz' + (m.authorFirstname ? ' · ' + m.authorFirstname : '') + '</div>' : ''}
                    ${escapeHtml(m.bodyText || '')}
                </div>
                <div class="text-[10px] text-slate-500 mt-1">${fmtDate(m.createdAt)}</div>
            </div>
        `).join('');
        loadTickets();
    }

    document.getElementById('ticket-status-select').addEventListener('change', (e) => updateTicket({ status: e.target.value }));
    document.getElementById('ticket-priority-select').addEventListener('change', (e) => updateTicket({ priority: e.target.value }));
    document.getElementById('ticket-assignee-select').addEventListener('change', (e) => updateTicket({ assignedUserId: e.target.value || null }));
    async function updateTicket(fields) {
        if (!currentTicketId) return;
        await api(`/tickets/${currentTicketId}`, { method: 'PUT', body: JSON.stringify(fields) });
        loadTickets();
    }

    document.getElementById('reply-send-btn').addEventListener('click', () => sendReply(false));
    document.getElementById('reply-note-btn').addEventListener('click', () => sendReply(true));
    async function sendReply(internalNote) {
        const errorEl = document.getElementById('reply-error');
        errorEl.classList.add('hidden');
        const bodyText = document.getElementById('reply-text').value.trim();
        if (!bodyText) return;
        try {
            await api(`/tickets/${currentTicketId}/reply`, { method: 'POST', body: JSON.stringify({ bodyText, internalNote }) });
            document.getElementById('reply-text').value = '';
            openTicket(currentTicketId);
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove('hidden');
        }
    }

    document.getElementById('new-ticket-btn').addEventListener('click', () => {
        ['subject', 'email', 'name', 'body'].forEach(f => document.getElementById(`new-ticket-${f}`).value = '');
        document.getElementById('new-ticket-error').classList.add('hidden');
        document.getElementById('modal-new-ticket').classList.remove('hidden');
    });
    document.getElementById('new-ticket-close-btn').addEventListener('click', () => document.getElementById('modal-new-ticket').classList.add('hidden'));
    document.getElementById('new-ticket-create-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('new-ticket-error');
        errorEl.classList.add('hidden');
        try {
            await api('/tickets', {
                method: 'POST',
                body: JSON.stringify({
                    subject: document.getElementById('new-ticket-subject').value,
                    requesterEmail: document.getElementById('new-ticket-email').value,
                    requesterName: document.getElementById('new-ticket-name').value,
                    bodyText: document.getElementById('new-ticket-body').value
                })
            });
            document.getElementById('modal-new-ticket').classList.add('hidden');
            loadTickets();
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Kampagnen ---
    const campaignStatusLabel = { draft: '📝 Entwurf', sending: '⏳ Wird gesendet...', sent: '✅ Gesendet' };
    async function loadCampaigns() {
        const campaigns = await api('/campaigns');
        document.getElementById('campaign-list').innerHTML = campaigns.map(c => `
            <div class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/50" data-campaign-id="${c.id}">
                <div>
                    <div class="text-sm text-white font-medium">${escapeHtml(c.name)}</div>
                    <div class="text-xs text-slate-500">${escapeHtml(c.subject)} · ${c.recipientCount} Empfänger:innen</div>
                </div>
                <div class="text-xs">${campaignStatusLabel[c.status] || c.status}${c.status !== 'draft' ? ` (${c.sentCount}✓ ${c.failedCount ? c.failedCount + '✗' : ''})` : ''}</div>
            </div>
        `).join('') || '<div class="text-xs text-slate-500">Noch keine Kampagnen.</div>';
        document.querySelectorAll('[data-campaign-id]').forEach(el => el.addEventListener('click', () => openCampaign(parseInt(el.dataset.campaignId, 10))));
    }
    async function openCampaign(id) {
        const c = await api(`/campaigns/${id}`);
        currentCampaignId = id;
        document.getElementById('campaign-detail-name').textContent = c.name;
        document.getElementById('campaign-detail-status').textContent = campaignStatusLabel[c.status] || c.status;
        document.getElementById('campaign-send-btn').classList.toggle('hidden', c.status !== 'draft' || currentUser.role !== 'admin');
        document.getElementById('campaign-detail-recipients').innerHTML = c.recipients.map(r =>
            `<div class="flex items-center justify-between border-b border-slate-800 py-1"><span>${escapeHtml(r.email)}</span><span class="${r.status === 'sent' ? 'text-emerald-400' : r.status === 'failed' ? 'text-red-400' : 'text-slate-500'}">${r.status}</span></div>`
        ).join('');
        document.getElementById('modal-campaign-detail').classList.remove('hidden');
    }
    document.getElementById('campaign-detail-close-btn').addEventListener('click', () => document.getElementById('modal-campaign-detail').classList.add('hidden'));
    document.getElementById('campaign-send-btn').addEventListener('click', async () => {
        if (!confirm('Kampagne jetzt wirklich an alle Empfänger:innen versenden?')) return;
        await api(`/campaigns/${currentCampaignId}/send`, { method: 'POST' });
        openCampaign(currentCampaignId);
        loadCampaigns();
    });

    document.getElementById('new-campaign-btn').addEventListener('click', () => {
        ['name', 'mailbox', 'subject', 'body'].forEach(f => document.getElementById(`new-campaign-${f}`).value = '');
        document.getElementById('new-campaign-file').value = '';
        document.getElementById('new-campaign-error').classList.add('hidden');
        document.getElementById('modal-new-campaign').classList.remove('hidden');
    });
    document.getElementById('new-campaign-close-btn').addEventListener('click', () => document.getElementById('modal-new-campaign').classList.add('hidden'));
    document.getElementById('new-campaign-create-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('new-campaign-error');
        errorEl.classList.add('hidden');
        const fileInput = document.getElementById('new-campaign-file');
        if (!fileInput.files[0]) { errorEl.textContent = 'Bitte eine Empfänger-CSV-Datei auswählen.'; errorEl.classList.remove('hidden'); return; }
        const formData = new FormData();
        formData.append('name', document.getElementById('new-campaign-name').value);
        formData.append('mailboxAddress', document.getElementById('new-campaign-mailbox').value);
        formData.append('subject', document.getElementById('new-campaign-subject').value);
        formData.append('bodyText', document.getElementById('new-campaign-body').value);
        formData.append('recipients', fileInput.files[0]);
        try {
            const res = await fetch('/api/campaigns', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            document.getElementById('modal-new-campaign').classList.add('hidden');
            loadCampaigns();
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Passwort ändern ---
    document.getElementById('change-password-btn').addEventListener('click', () => {
        ['current', 'new', 'new-repeat'].forEach(f => document.getElementById(`password-${f}`).value = '');
        document.getElementById('password-error').classList.add('hidden');
        document.getElementById('password-success').classList.add('hidden');
        document.getElementById('modal-password').classList.remove('hidden');
    });
    document.getElementById('password-close-btn').addEventListener('click', () => document.getElementById('modal-password').classList.add('hidden'));
    document.getElementById('password-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('password-error');
        const successEl = document.getElementById('password-success');
        errorEl.classList.add('hidden'); successEl.classList.add('hidden');
        const current = document.getElementById('password-current').value;
        const next = document.getElementById('password-new').value;
        const repeat = document.getElementById('password-new-repeat').value;
        if (!current || !next) { errorEl.textContent = 'Bitte beide Passwort-Felder ausfüllen.'; errorEl.classList.remove('hidden'); return; }
        if (next !== repeat) { errorEl.textContent = 'Die Wiederholung stimmt nicht überein.'; errorEl.classList.remove('hidden'); return; }
        if (next.length < 8) { errorEl.textContent = 'Das neue Passwort sollte mindestens 8 Zeichen haben.'; errorEl.classList.remove('hidden'); return; }
        try {
            await api('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
            successEl.textContent = '✓ Passwort geändert.'; successEl.classList.remove('hidden');
            setTimeout(() => document.getElementById('modal-password').classList.add('hidden'), 1200);
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Admin Panel ---
    document.getElementById('admin-panel-btn').addEventListener('click', () => {
        document.getElementById('modal-admin').classList.remove('hidden');
        switchAdminTab('auramail');
    });
    document.getElementById('admin-close-btn').addEventListener('click', () => document.getElementById('modal-admin').classList.add('hidden'));
    function switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.adminTab === tab));
        document.querySelectorAll('.admin-tab').forEach(el => el.classList.toggle('hidden', el.id !== `admin-tab-${tab}`));
        if (tab === 'auradirect') loadAuradirectConfig();
        if (tab === 'auramail') loadAuramailConfig();
        if (tab === 'users') loadUserAdmin();
        if (tab === 'security') { loadSecuritySettings(); loadExternalApiKey(); }
        if (tab === 'license') loadLicenseAdminStatus();
    }
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab)));

    async function loadAuradirectConfig() {
        const cfg = await api('/admin/auradirect-config');
        document.getElementById('auradirect-url-input').value = cfg.url || '';
        const statusEl = document.getElementById('auradirect-servicekey-status');
        statusEl.textContent = cfg.hasServiceKey ? '✓ Dienst-Schlüssel hinterlegt' : '✗ Noch kein Dienst-Schlüssel hinterlegt';
        statusEl.className = cfg.hasServiceKey ? 'text-xs text-emerald-400' : 'text-xs text-amber-400';
    }
    document.getElementById('auradirect-save-btn').addEventListener('click', async () => {
        try {
            await api('/admin/auradirect-config', {
                method: 'POST',
                body: JSON.stringify({ url: document.getElementById('auradirect-url-input').value, serviceKey: document.getElementById('auradirect-servicekey-input').value })
            });
            document.getElementById('auradirect-servicekey-input').value = '';
            alert('Gespeichert.');
            loadAuradirectConfig();
        } catch (err) { alert(err.message); }
    });

    async function loadAuramailConfig() {
        const cfg = await api('/admin/auramail-config');
        document.getElementById('auramail-url-input').value = cfg.url || '';
        document.getElementById('auramail-mailbox-input').value = cfg.mailboxAddress || '';
        const statusEl = document.getElementById('auramail-servicekey-status');
        statusEl.textContent = cfg.hasServiceKey ? '✓ Dienst-Schlüssel hinterlegt' : '✗ Noch kein Dienst-Schlüssel hinterlegt';
        statusEl.className = cfg.hasServiceKey ? 'text-xs text-emerald-400' : 'text-xs text-amber-400';
    }
    document.getElementById('auramail-save-btn').addEventListener('click', async () => {
        try {
            await api('/admin/auramail-config', {
                method: 'POST',
                body: JSON.stringify({
                    url: document.getElementById('auramail-url-input').value,
                    serviceKey: document.getElementById('auramail-servicekey-input').value,
                    mailboxAddress: document.getElementById('auramail-mailbox-input').value
                })
            });
            document.getElementById('auramail-servicekey-input').value = '';
            alert('Gespeichert.');
            loadAuramailConfig();
        } catch (err) { alert(err.message); }
    });
    document.getElementById('auramail-poll-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('auramail-poll-result');
        resultEl.textContent = 'Prüfe...'; resultEl.className = 'text-xs text-slate-400 mt-1'; resultEl.classList.remove('hidden');
        try {
            await api('/admin/auramail-config/poll-now', { method: 'POST' });
            resultEl.textContent = '✓ Geprüft.'; resultEl.className = 'text-xs text-emerald-400 mt-1';
            loadTickets();
        } catch (err) { resultEl.textContent = '✗ ' + err.message; resultEl.className = 'text-xs text-red-400 mt-1'; }
    });

    async function loadUserAdmin() {
        const list = await api('/admin/users');
        document.getElementById('user-admin-list').innerHTML = list.map(u => `
            <div class="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <div><span class="text-sm text-white font-medium">${escapeHtml(u.firstname)} ${escapeHtml(u.lastname)}</span>
                <span class="text-xs text-slate-500 ml-2">${u.username} · ${u.role === 'admin' ? 'Admin' : 'Agent:in'}${u.source === 'auradirect' ? ' · AuraDirect' : ''}${!u.active ? ' · deaktiviert' : ''}</span></div>
                <button data-user-toggle="${u.id}" data-active="${u.active}" class="text-xs ${u.active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}">${u.active ? 'Deaktivieren' : 'Aktivieren'}</button>
            </div>
        `).join('');
        document.querySelectorAll('[data-user-toggle]').forEach(btn => btn.addEventListener('click', async () => {
            await api(`/admin/users/${btn.dataset.userToggle}`, { method: 'PUT', body: JSON.stringify({ active: btn.dataset.active !== '1' }) });
            loadUserAdmin();
        }));
    }
    document.getElementById('new-user-btn').addEventListener('click', async () => {
        try {
            await api('/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    username: document.getElementById('new-user-username').value,
                    password: document.getElementById('new-user-password').value,
                    firstname: document.getElementById('new-user-firstname').value,
                    lastname: document.getElementById('new-user-lastname').value,
                    role: document.getElementById('new-user-role').value
                })
            });
            ['username', 'password', 'firstname', 'lastname'].forEach(f => document.getElementById(`new-user-${f}`).value = '');
            loadUserAdmin();
            loadUsersForAssignment();
        } catch (err) { alert(err.message); }
    });

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
        if (!confirm('Neuen Dienst-Schlüssel erzeugen? Der alte wird sofort ungültig - AuraChat muss aktualisiert werden.')) return;
        const res = await api('/admin/external-api-key/regenerate', { method: 'POST' });
        document.getElementById('external-api-key-field').value = res.key || '';
    });
    document.getElementById('twofa-required-toggle').addEventListener('change', async (e) => {
        await api('/admin/security', { method: 'POST', body: JSON.stringify({ twofaRequired: e.target.checked }) });
    });

    async function loadLicenseAdminStatus() {
        const info = await api('/license');
        const statusEl = document.getElementById('license-admin-status');
        if (info.licenseValid) {
            statusEl.textContent = `✓ Lizenziert für "${info.customer}"${info.expiresAt ? ' · gültig bis ' + fmtDateDisplay(info.expiresAt.slice(0, 10)) : ' · unbegrenzt'}`;
            statusEl.className = 'text-xs text-emerald-400 mb-3';
        } else if (info.freeTier) {
            statusEl.textContent = '✓ Kostenlose Stufe aktiv (bis 3 Agent:innen + 1 Admin) - für mehr wird eine Lizenz benötigt.';
            statusEl.className = 'text-xs text-emerald-400 mb-3';
        } else if (info.trial) {
            statusEl.textContent = `⏳ Testphase aktiv - noch ${info.trialDaysRemaining} Tag(e).`;
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
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });
    document.getElementById('license-admin-remove-btn').addEventListener('click', async () => {
        if (!confirm('Lizenz wirklich entfernen?')) return;
        await api('/admin/license/remove', { method: 'POST' });
        loadLicenseAdminStatus();
    });

    document.getElementById('backup-create-btn').addEventListener('click', () => { window.location.href = '/api/admin/backup'; });
    document.getElementById('backup-restore-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('backup-restore-file');
        const statusEl = document.getElementById('backup-restore-status');
        if (!fileInput.files[0]) { alert('Bitte zuerst eine Backup-Datei auswählen.'); return; }
        if (!confirm('Aktuelle Datenbank wirklich ersetzen?')) return;
        const formData = new FormData();
        formData.append('backup', fileInput.files[0]);
        statusEl.textContent = 'Wird wiederhergestellt...'; statusEl.className = 'text-xs text-slate-400'; statusEl.classList.remove('hidden');
        try {
            const res = await fetch('/api/admin/backup/restore', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            statusEl.textContent = '✓ ' + data.message; statusEl.className = 'text-xs text-emerald-400';
            setTimeout(() => location.reload(), 5000);
        } catch (err) { statusEl.textContent = '✗ ' + err.message; statusEl.className = 'text-xs text-red-400'; }
    });

    // --- Hilfsfunktionen ---
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s || ''; return div.innerHTML; }
    function fmtDate(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('de-DE'); }
    function fmtDateDisplay(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}.${m}.${y}`; }
})();
