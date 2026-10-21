(function () {
    const backendUrl = '/api';
    let currentUser = null;
    let loginVia2faAuraDirect = false;

    async function api(path, options = {}) {
        const res = await fetch(`${backendUrl}${path}`, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...options });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen.');
        return data;
    }

    // Hinweis auf der Anmeldeseite, falls AuraDirect eingerichtet ist
    fetch('/api/public/info').then(r => r.json()).then(info => {
        if (info && info.auradirectEnabled) document.getElementById('login-auradirect-hint').classList.remove('hidden');
    }).catch(() => {});

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
            const data = await api('/login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('login-username').value, password: document.getElementById('login-password').value }) });
            if (data.requires2faSetup) { document.getElementById('twofa-qr-code').src = data.qrCodeDataUrl; showLoginStep('2fa-setup'); return; }
            if (data.requires2fa) { showLoginStep('2fa'); loginVia2faAuraDirect = !!data.viaAuraDirect; return; }
            await completeLogin(data);
        } catch (err) { loginError.textContent = err.message; loginError.classList.remove('hidden'); }
    });
    document.getElementById('twofa-setup-confirm-btn').addEventListener('click', async () => {
        try { const data = await api('/login/2fa-setup', { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-setup-code').value }) }); await completeLogin(data); }
        catch (err) { loginError.textContent = err.message; loginError.classList.remove('hidden'); showLoginStep('credentials'); }
    });
    document.getElementById('twofa-confirm-btn').addEventListener('click', async () => {
        try {
            const endpoint = loginVia2faAuraDirect ? '/login/2fa-auradirect' : '/login/2fa';
            const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ code: document.getElementById('twofa-code').value }) });
            await completeLogin(data);
        } catch (err) { loginError.textContent = err.message; loginError.classList.remove('hidden'); showLoginStep('credentials'); }
    });

    async function completeLogin(data) {
        currentUser = data;
        // Einheitliches Menü der Aura-Suite (aura-menu.js): AuraProxy hat keine Rollen, alle Angemeldeten verwalten
        window.AuraAppMenu = { logout: doLogout, settings: () => openPanel('settings'), admin: { users: () => openPanel('users'), security: () => openPanel('security'), system: () => openPanel('system') } };
        if (window.AuraMenuCtl) window.AuraMenuCtl.refresh();
        window.AuraPrivacy.check({ onLogout: doLogout });   // Datenschutzerklärung beim ersten Login (und nach jeder Änderung) bestätigen
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('user-name').textContent = currentUser.firstname || currentUser.username;
        loadAvailablePorts();
        loadDomains();
        loadCertificates();
        loadCa();
        checkCaddyStatus();
    }
    async function doLogout() { await api('/logout'); location.reload(); }
    window.AuraAppMenu = { logout: doLogout };   // schon vor der Anmeldung da; nach der Anmeldung kommt das Admin Panel dazu

    async function checkCaddyStatus() {
        const { reachable } = await api('/domains/caddy-status');
        const el = document.getElementById('caddy-status');
        el.textContent = reachable ? '🟢 Caddy erreichbar' : '🔴 Caddy nicht erreichbar';
        el.className = reachable ? 'text-xs text-emerald-400' : 'text-xs text-red-400';
    }

    // --- Domain-Zuordnungen ---
    async function loadAvailablePorts() {
        const { ports } = await api('/domains/available-ports');
        document.getElementById('new-domain-port').innerHTML = ports.map(p => `<option value="${p}">${p}${p === 443 ? ' (Standard HTTPS)' : ''}</option>`).join('');
    }
    async function loadDomains() {
        const domains = await api('/domains');
        document.getElementById('domain-list').innerHTML = domains.map(d => `
            <div class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                    <div class="text-sm text-white font-medium">${escapeHtml(d.domain)}<span class="text-slate-500 font-normal">:${d.externalPort}</span></div>
                    <div class="text-xs text-slate-500">→ ${escapeHtml(d.targetHost)}:${d.targetPort} · ${d.hasCustomCert ? '🔒 Eigenes Zertifikat' : (d.tlsMode === 'internal' ? '🏛️ Intern (eigene CA)' : '🌐 Let\'s Encrypt')}</div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs ${d.active ? 'text-emerald-400' : 'text-slate-500'}">${d.active ? '● aktiv' : '○ pausiert'}</span>
                    ${d.hasCustomCert
                        ? `<button data-remove-cert="${d.id}" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 hover:bg-slate-700">🔒 Eigenes Zertifikat ✕</button>`
                        : `<button data-upload-cert="${d.id}" data-domain-name="${escapeHtml(d.domain)}" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">🔒 Zertifikat</button>`}
                    <button data-edit="${d.id}" data-domain="${escapeHtml(d.domain)}" data-port="${d.externalPort}" data-target-host="${escapeHtml(d.targetHost)}" data-target-port="${d.targetPort}" data-tls="${d.tlsMode === 'internal' ? 'internal' : 'auto'}" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">Bearbeiten</button>
                    <button data-toggle="${d.id}" data-active="${d.active}" class="text-xs px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">${d.active ? 'Pausieren' : 'Aktivieren'}</button>
                    <button data-delete="${d.id}" class="text-xs px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20">Löschen</button>
                </div>
            </div>
        `).join('') || '<div class="text-xs text-slate-500">Noch keine Domain-Zuordnungen.</div>';
        document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openEditDomain(btn.dataset)));
        document.querySelectorAll('[data-upload-cert]').forEach(btn => btn.addEventListener('click', () => openUploadCert(btn.dataset.uploadCert, btn.dataset.domainName)));
        document.querySelectorAll('[data-remove-cert]').forEach(btn => btn.addEventListener('click', async () => {
            if (!confirm('Eigenes Zertifikat entfernen? Caddy holt danach bei Bedarf automatisch ein neues über Let\'s Encrypt.')) return;
            try { await api(`/domains/${btn.dataset.removeCert}/certificate`, { method: 'DELETE' }); loadDomains(); loadCertificates(); }
            catch (err) { alert(err.message); }
        }));
        document.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
            await api(`/domains/${btn.dataset.toggle}`, { method: 'PUT', body: JSON.stringify({ active: btn.dataset.active !== '1' }) });
            loadDomains();
        }));
        document.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
            if (!confirm('Diese Zuordnung wirklich löschen?')) return;
            await api(`/domains/${btn.dataset.delete}`, { method: 'DELETE' });
            loadDomains();
        }));
    }
    document.getElementById('new-domain-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('new-domain-error');
        errorEl.classList.add('hidden');
        try {
            const added = await api('/domains', {
                method: 'POST',
                body: JSON.stringify({
                    domain: document.getElementById('new-domain').value,
                    externalPort: document.getElementById('new-domain-port').value,
                    targetHost: document.getElementById('new-domain-target-host').value,
                    targetPort: document.getElementById('new-domain-target-port').value,
                    tlsMode: document.getElementById('new-domain-tls').value
                })
            });
            ['new-domain', 'new-domain-target-host', 'new-domain-target-port'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('new-domain-tls').dataset.touched = ''; setTlsHint();
            if (added.warning) { errorEl.textContent = '⚠️ ' + added.warning; errorEl.classList.remove('hidden'); }
            loadDomains(); loadCa(); setTimeout(loadCertificates, 4000);
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Zuordnung bearbeiten ---
    async function openEditDomain(data) {
        const { ports } = await api('/domains/available-ports');
        document.getElementById('edit-domain-port').innerHTML = ports.map(p => `<option value="${p}">${p}${p === 443 ? ' (Standard HTTPS)' : ''}</option>`).join('');
        document.getElementById('edit-domain-id').value = data.edit;
        document.getElementById('edit-domain-domain').value = data.domain;
        document.getElementById('edit-domain-port').value = data.port;
        document.getElementById('edit-domain-target-host').value = data.targetHost;
        document.getElementById('edit-domain-target-port').value = data.targetPort;
        document.getElementById('edit-domain-tls').value = data.tls === 'internal' ? 'internal' : 'auto';
        document.getElementById('edit-domain-error').classList.add('hidden');
        document.getElementById('modal-edit-domain').classList.remove('hidden');
    }
    document.getElementById('edit-domain-close-btn').addEventListener('click', () => document.getElementById('modal-edit-domain').classList.add('hidden'));
    document.getElementById('edit-domain-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('edit-domain-error');
        errorEl.classList.add('hidden');
        try {
            const saved = await api(`/domains/${document.getElementById('edit-domain-id').value}`, {
                method: 'PUT',
                body: JSON.stringify({
                    domain: document.getElementById('edit-domain-domain').value,
                    externalPort: document.getElementById('edit-domain-port').value,
                    targetHost: document.getElementById('edit-domain-target-host').value,
                    targetPort: document.getElementById('edit-domain-target-port').value,
                    tlsMode: document.getElementById('edit-domain-tls').value
                })
            });
            document.getElementById('modal-edit-domain').classList.add('hidden');
            if (saved.warning) alert(saved.warning);
            loadDomains(); loadCa();
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Zertifikatsmodus: Vorschlag je nach Name (so, wie es der Server beim Speichern auch entscheidet) ---
    const INTERNAL_TLDS = ['local', 'lan', 'internal', 'intranet', 'home', 'corp', 'localdomain', 'localhost', 'test', 'invalid', 'example'];
    function looksInternal(d) {
        d = String(d || '').trim().toLowerCase(); if (!d) return false;
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d) || d.includes(':')) return true;
        if (!d.includes('.')) return true;
        return INTERNAL_TLDS.includes(d.split('.').pop()) || d.endsWith('.home.arpa') || d.endsWith('.fritz.box');
    }
    function setTlsHint() {
        const sel = document.getElementById('new-domain-tls'), hint = document.getElementById('new-domain-tls-hint'), d = document.getElementById('new-domain').value;
        hint.textContent = !d.trim() ? '' : (looksInternal(d) ? 'Das ist ein interner Name: Let\'s Encrypt kann dafür kein Zertifikat ausstellen, empfohlen ist „Intern“.' : 'Öffentliche Domain: der Name muss per DNS auf diesen Server zeigen (Port 80 und 443 erreichbar), dann holt AuraProxy das Zertifikat von Let\'s Encrypt.');
        if (!sel.dataset.touched) sel.value = looksInternal(d) ? 'internal' : 'auto';
    }
    document.getElementById('new-domain').addEventListener('input', setTlsHint);
    document.getElementById('new-domain-tls').addEventListener('change', (e) => { e.target.dataset.touched = '1'; });
    // --- Eigene Zertifizierungsstelle ---
    async function loadCa() {
        const status = document.getElementById('ca-status'), actions = document.getElementById('ca-actions');
        try {
            const ca = await api('/ca');
            if (ca.available) {
                status.textContent = `Aktiv. Gültig bis ${new Date(ca.validTo).toLocaleDateString('de-DE')}. Fingerabdruck (SHA-256): ${ca.fingerprint256}`;
                actions.classList.remove('hidden');
            } else {
                status.textContent = 'Noch nicht vorhanden: Sie entsteht automatisch, sobald das erste interne Zertifikat ausgestellt wird (lege dazu eine Domain mit „Intern“ an).';
                actions.classList.add('hidden');
            }
        } catch (err) { status.textContent = ''; actions.classList.add('hidden'); }
    }
    // --- Zertifikate ---
    async function loadCertificates() {
        const certs = await api('/certificates');
        document.getElementById('certificate-list').innerHTML = certs.map(c => {
            const expiresText = c.expiresAt ? `gültig bis ${new Date(c.expiresAt).toLocaleDateString('de-DE')}` : 'Ablaufdatum unbekannt';
            const soon = c.expiresAt && (new Date(c.expiresAt) - Date.now()) < 14 * 24 * 60 * 60 * 1000;
            return `
            <div class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                    <div class="text-sm text-white font-medium">${escapeHtml(c.domain)}</div>
                    <div class="text-xs ${soon ? 'text-amber-400' : 'text-slate-500'}">${c.issuer} · ${expiresText}${soon ? ' ⚠️ läuft bald ab' : ''}</div>
                </div>
                ${(c.type === 'automatic' || c.type === 'internal') ? `<button data-delete-cert="${escapeHtml(c.domain)}" class="text-xs px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20">Löschen</button>` : ''}
            </div>`;
        }).join('') || '<div class="text-xs text-slate-500">Noch keine Zertifikate ausgestellt.</div>';
        document.querySelectorAll('[data-delete-cert]').forEach(btn => btn.addEventListener('click', async () => {
            if (!confirm(`Zertifikat für "${btn.dataset.deleteCert}" wirklich löschen? Caddy stellt bei Bedarf automatisch ein neues aus.`)) return;
            try { await api(`/certificates/${encodeURIComponent(btn.dataset.deleteCert)}`, { method: 'DELETE' }); loadCertificates(); }
            catch (err) { alert(err.message); }
        }));
    }
    function openUploadCert(domainId, domainName) {
        document.getElementById('upload-cert-domain-id').value = domainId;
        document.getElementById('upload-cert-title').textContent = `🔒 Eigenes Zertifikat für ${domainName}`;
        document.getElementById('upload-cert-file').value = '';
        document.getElementById('upload-key-file').value = '';
        document.getElementById('upload-cert-error').classList.add('hidden');
        document.getElementById('modal-upload-cert').classList.remove('hidden');
    }
    document.getElementById('upload-cert-close-btn').addEventListener('click', () => document.getElementById('modal-upload-cert').classList.add('hidden'));
    document.getElementById('upload-cert-save-btn').addEventListener('click', async () => {
        const errorEl = document.getElementById('upload-cert-error');
        errorEl.classList.add('hidden');
        const certFile = document.getElementById('upload-cert-file').files[0];
        const keyFile = document.getElementById('upload-key-file').files[0];
        if (!certFile || !keyFile) { errorEl.textContent = 'Bitte beide Dateien auswählen.'; errorEl.classList.remove('hidden'); return; }
        const formData = new FormData();
        formData.append('cert', certFile);
        formData.append('key', keyFile);
        try {
            const res = await fetch(`/api/domains/${document.getElementById('upload-cert-domain-id').value}/certificate`, { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            document.getElementById('modal-upload-cert').classList.add('hidden');
            loadDomains();
            loadCertificates();
        } catch (err) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    });

    // --- Einstellungen ---
    // Admin Panel: ein Fenster, das je nach Menüpunkt EINEN Bereich zeigt (Benutzer, Sicherheit, Lizenz, System)
    const PANEL_TITLES = { users: '👥 Benutzer', security: '🛡️ Sicherheit', system: '🖥️ System', privacy: '📄 Datenschutzerklärung' };
    function openPanel(section) {
        // "settings" = Einstellungen: Darstellung und Datenschutzerklärung zusammen; alle anderen Bereiche gehören zum Admin Panel (je einer)
        const shown = section === 'settings' ? ['appearance', 'privacy'] : [section];
        document.getElementById('modal-settings').classList.remove('hidden');
        document.getElementById('settings-modal-title').textContent = section === 'settings' ? '⚙️ Einstellungen' : '🛠️ Admin Panel — ' + PANEL_TITLES[section];
        document.querySelectorAll('[data-panel-section]').forEach(el => el.classList.toggle('hidden', !shown.includes(el.dataset.panelSection)));
        if (section === 'users') loadAuradirectConfig();
        if (section === 'settings') { window.AuraPrefs.card(document.getElementById('admin-prefs-card')); window.AuraPrivacy.editor(document.getElementById('admin-privacy-editor'), {}); }
    }
    document.getElementById('settings-close-btn').addEventListener('click', () => document.getElementById('modal-settings').classList.add('hidden'));

    async function loadAuradirectConfig() {
        const cfg = await api('/admin/auradirect-config');
        document.getElementById('auradirect-url-input').value = cfg.url || '';
        const statusEl = document.getElementById('auradirect-servicekey-status');
        statusEl.textContent = cfg.hasServiceKey ? '✓ Dienst-Schlüssel hinterlegt' : '✗ Noch kein Dienst-Schlüssel hinterlegt';
        statusEl.className = cfg.hasServiceKey ? 'text-xs text-emerald-400' : 'text-xs text-amber-400';
    }
    document.getElementById('auradirect-save-btn').addEventListener('click', async () => {
        try {
            await api('/admin/auradirect-config', { method: 'POST', body: JSON.stringify({ url: document.getElementById('auradirect-url-input').value, serviceKey: document.getElementById('auradirect-servicekey-input').value }) });
            document.getElementById('auradirect-servicekey-input').value = '';
            alert('Gespeichert.');
            loadAuradirectConfig();
        } catch (err) { alert(err.message); }
    });

    document.getElementById('auradirect-test-btn').addEventListener('click', async () => {
        const resultEl = document.getElementById('auradirect-test-result');
        resultEl.textContent = 'Teste...';
        resultEl.className = 'text-xs text-slate-400';
        resultEl.classList.remove('hidden');
        try {
            const res = await api('/admin/auradirect-config/test', { method: 'POST' });
            resultEl.textContent = '✓ ' + res.message;
            resultEl.className = 'text-xs text-emerald-400';
        } catch (err) {
            resultEl.textContent = '✗ ' + err.message;
            resultEl.className = 'text-xs text-red-400';
        }
    });

    document.getElementById('password-save-btn').addEventListener('click', async () => {
        const statusEl = document.getElementById('password-status');
        statusEl.classList.add('hidden');
        try {
            await api('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: document.getElementById('password-current').value, newPassword: document.getElementById('password-new').value }) });
            document.getElementById('password-current').value = ''; document.getElementById('password-new').value = '';
            statusEl.textContent = '✓ Passwort geändert.'; statusEl.className = 'text-xs text-emerald-400'; statusEl.classList.remove('hidden');
        } catch (err) { statusEl.textContent = '✗ ' + err.message; statusEl.className = 'text-xs text-red-400'; statusEl.classList.remove('hidden'); }
    });

    document.getElementById('backup-create-btn').addEventListener('click', () => { window.location.href = '/api/admin/backup'; });
    document.getElementById('backup-restore-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('backup-restore-file');
        const statusEl = document.getElementById('backup-restore-status');
        if (!fileInput.files[0]) { alert('Bitte zuerst eine Backup-Datei auswählen.'); return; }
        if (!confirm('Aktuelle Datenbank wirklich ersetzen?')) return;
        const formData = new FormData(); formData.append('backup', fileInput.files[0]);
        statusEl.textContent = 'Wird wiederhergestellt...'; statusEl.className = 'text-xs text-slate-400'; statusEl.classList.remove('hidden');
        try {
            const res = await fetch('/api/admin/backup/restore', { method: 'POST', credentials: 'include', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fehler.');
            statusEl.textContent = '✓ ' + data.message; statusEl.className = 'text-xs text-emerald-400';
            setTimeout(() => location.reload(), 5000);
        } catch (err) { statusEl.textContent = '✗ ' + err.message; statusEl.className = 'text-xs text-red-400'; }
    });

    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s || ''; return div.innerHTML; }
    function fmtDateDisplay(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}.${m}.${y}`; }
})();
