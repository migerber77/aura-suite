/* Cockpit-Ansicht von AuraControl: Gesundheit des Servers (Ampel, Prozessor, Arbeitsspeicher, Speicherplatz, Docker-Container, Schwachstellen, Updates).
 * Übernommen aus dem früheren Cockpit-Reiter von AuraChat. Alle Texte kommen als Text in die Seite (textContent), NIE als HTML: Namen von Containern und Images
 * sowie Beschreibungen aus Schwachstellen-Berichten stammen nicht von uns. Die Daten holt /api/cockpit (nur für Angemeldete). */
(function () {
    'use strict';
    const view = document.getElementById('viewCockpit');
    const cockpitHeadline = document.getElementById('cockpit-headline');
    const cockpitUpdated = document.getElementById('cockpit-updated');
    const cockpitRefreshBtn = document.getElementById('cockpit-refresh-btn');
    const cockpitHostInfo = document.getElementById('cockpit-host-info');
    const cockpitErrorBox = document.getElementById('cockpit-error');
    const cockpitWarnings = document.getElementById('cockpit-warnings');
    const cockpitCards = document.getElementById('cockpit-cards');
    const cockpitContainers = document.getElementById('cockpit-containers');
    const cockpitDockerUsage = document.getElementById('cockpit-docker-usage');
    const cockpitVulns = document.getElementById('cockpit-vulns');
    const cockpitUpdates = document.getElementById('cockpit-updates');
    let cockpitTimer = null;
    let cockpitLoading = false;
    const COCKPIT_REFRESH_MS = 10000;

    // Alle Texte kommen als Text in die Seite (textContent), NIE als HTML: Namen von Containern und Images sowie
    // Beschreibungen aus Schwachstellen-Berichten stammen nicht von uns.
    function cockpitEl(tag, cls, text) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined && text !== null) e.textContent = text;
        return e;
    }
    const cockpitNum = (n) => String(n).replace('.', ',');
    function cockpitBytes(n) {
        if (n === null || n === undefined || !Number.isFinite(n)) return '–';
        const GB = 1024 ** 3, MB = 1024 ** 2;
        if (n >= GB) return cockpitNum(n / GB >= 10 ? Math.round(n / GB) : Math.round(n / GB * 10) / 10) + ' GB';
        if (n >= MB) return Math.round(n / MB) + ' MB';
        return Math.round(n / 1024) + ' KB';
    }
    function cockpitDuration(seconds) {
        if (!Number.isFinite(seconds)) return '–';
        const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60);
        return d > 0 ? `${d} Tage ${h} Std.` : (h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`);
    }
    function cockpitAgo(iso, now = Date.now()) {
        const t = Date.parse(iso);
        if (Number.isNaN(t)) return '–';
        const s = Math.max(0, Math.round((now - t) / 1000));
        if (s < 90) return 'gerade eben';
        if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
        if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
        return `vor ${Math.round(s / 86400)} Tagen`;
    }
    const COCKPIT_LEVEL_STYLE = {
        crit: { row: 'bg-red-500/10 border-red-500/30 text-red-300', dot: '🔴', bar: 'bg-red-500', text: 'text-red-400' },
        warn: { row: 'bg-amber-500/10 border-amber-500/30 text-amber-300', dot: '🟠', bar: 'bg-amber-500', text: 'text-amber-400' },
        ok: { row: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300', dot: '🟢', bar: 'bg-emerald-500', text: 'text-emerald-400' },
        info: { row: 'bg-slate-800/60 border-slate-700 text-slate-400', dot: 'ℹ️', bar: 'bg-slate-500', text: 'text-slate-400' }
    };
    const COCKPIT_RANK = { ok: 0, info: 0, warn: 1, crit: 2 };
    function cockpitAreaLevel(items, area) {
        return (items || []).filter(i => i.area === area).reduce((m, i) => (COCKPIT_RANK[i.level] > COCKPIT_RANK[m] ? i.level : m), 'ok');
    }

    // Kleiner Verlauf als Linie (SVG). Lücken (null) unterbrechen die Linie.
    function cockpitSparkline(values) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 24');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('class', 'w-full h-6');
        const n = values.length;
        if (n < 2) return svg;
        let segment = [];
        const flush = () => {
            if (segment.length >= 2) {
                const line = document.createElementNS(NS, 'polyline');
                line.setAttribute('points', segment.join(' '));
                line.setAttribute('fill', 'none');
                line.setAttribute('stroke', 'currentColor');
                line.setAttribute('stroke-width', '1.5');
                line.setAttribute('vector-effect', 'non-scaling-stroke');
                svg.appendChild(line);
            }
            segment = [];
        };
        values.forEach((v, i) => {
            if (typeof v !== 'number' || !Number.isFinite(v)) { flush(); return; }
            const x = Math.round(i / (n - 1) * 1000) / 10;
            const y = Math.round((23 - Math.min(100, Math.max(0, v)) / 100 * 22) * 10) / 10;
            segment.push(`${x},${y}`);
        });
        flush();
        return svg;
    }

    function cockpitCard(title, valueText, subText, percent, level, history) {
        const st = COCKPIT_LEVEL_STYLE[level] || COCKPIT_LEVEL_STYLE.ok;
        const card = cockpitEl('div', 'bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5');
        card.appendChild(cockpitEl('div', 'text-[10px] uppercase tracking-wider text-slate-500', title));
        card.appendChild(cockpitEl('div', `text-lg font-semibold ${st.text}`, valueText));
        if (subText) card.appendChild(cockpitEl('div', 'text-[10px] text-slate-500', subText));
        if (Number.isFinite(percent)) {
            const track = cockpitEl('div', 'h-1.5 bg-slate-800 rounded-full overflow-hidden');
            const bar = cockpitEl('div', `h-full ${st.bar}`);
            bar.style.width = Math.min(100, Math.max(0, percent)) + '%';
            track.appendChild(bar);
            card.appendChild(track);
        }
        if (history) { const w = cockpitEl('div', st.text); w.appendChild(cockpitSparkline(history)); card.appendChild(w); }
        return card;
    }

    function cockpitContainerState(c) {
        if (c.state === 'running') return c.health === 'unhealthy' ? 'crit' : (c.health === 'starting' ? 'warn' : 'ok');
        if (c.state === 'restarting' || c.state === 'dead') return 'crit';
        if (c.state === 'paused') return 'warn';
        const code = (String(c.status).match(/Exited \((\d+)\)/) || [])[1];
        return code !== undefined && code !== '0' ? 'crit' : 'info';
    }

    function cockpitClear(...els) { els.forEach(e => { if (e) e.innerHTML = ''; }); }

    function renderCockpit(data) {
        cockpitClear(cockpitWarnings, cockpitCards, cockpitContainers, cockpitVulns, cockpitUpdates, cockpitDockerUsage);
        if (cockpitHostInfo) cockpitHostInfo.textContent = '';
        if (!data || data.ok === false) {
            if (cockpitHeadline) cockpitHeadline.textContent = '⚠️ Cockpit nicht erreichbar';
            if (cockpitErrorBox) { cockpitErrorBox.textContent = ((data && data.error) || 'Unbekannter Fehler') + (data && data.hint ? '\n' + data.hint : ''); cockpitErrorBox.classList.remove('hidden'); }
            return;
        }
        if (cockpitErrorBox) { cockpitErrorBox.textContent = ''; cockpitErrorBox.classList.add('hidden'); }
        const snap = data.snapshot || {}, status = data.status || { level: 'ok', items: [] }, items = status.items || [], hist = data.history || [];
        const host = snap.host || {}, docker = snap.docker || {};

        // Ampel
        const crit = items.filter(i => i.level === 'crit').length, warn = items.filter(i => i.level === 'warn').length;
        if (cockpitHeadline) cockpitHeadline.textContent = status.level === 'crit' ? `🔴 ${crit} ${crit === 1 ? 'Problem' : 'Probleme'}${warn ? ` und ${warn} ${warn === 1 ? 'Hinweis' : 'Hinweise'}` : ''}` : (status.level === 'warn' ? `🟠 ${warn} ${warn === 1 ? 'Hinweis' : 'Hinweise'}` : '🟢 Alles in Ordnung');
        if (cockpitUpdated) cockpitUpdated.textContent = snap.generatedAt ? `Stand ${new Date(snap.generatedAt).toLocaleTimeString('de-DE')}` : '';
        if (cockpitHostInfo) cockpitHostInfo.textContent = [host.hostname, host.os, host.kernel ? 'Kernel ' + host.kernel : null, Number.isFinite(host.uptimeSeconds) ? 'läuft seit ' + cockpitDuration(host.uptimeSeconds) : null].filter(Boolean).join(' · ');
        items.forEach(i => {
            const st = COCKPIT_LEVEL_STYLE[i.level] || COCKPIT_LEVEL_STYLE.info;
            cockpitWarnings.appendChild(cockpitEl('div', `border rounded-lg px-2.5 py-1.5 text-[11px] ${st.row}`, `${st.dot} ${i.text}`));
        });

        // Karten: Prozessor, Arbeitsspeicher, Speicherplatz, Docker-Speicher
        const mem = host.memory || {}, disk = host.disk, usage = docker.usage;
        const series = (key) => hist.map(p => p[key]);
        cockpitCards.appendChild(cockpitCard('Prozessor', Number.isFinite(host.cpuPercent) ? cockpitNum(host.cpuPercent) + ' %' : '–', Array.isArray(host.load) ? `Last ${host.load.map(cockpitNum).join(' / ')} · ${host.cpuCount || '?'} Kerne` : '', host.cpuPercent, cockpitAreaLevel(items, 'cpu'), series('cpu')));
        cockpitCards.appendChild(cockpitCard('Arbeitsspeicher', mem.totalBytes ? cockpitNum(mem.percent) + ' %' : '–', mem.totalBytes ? `${cockpitBytes(mem.usedBytes)} von ${cockpitBytes(mem.totalBytes)}${mem.swapTotalBytes ? ` · Swap ${cockpitBytes(mem.swapUsedBytes)}` : ''}` : '', mem.percent, cockpitAreaLevel(items, 'ram'), series('ram')));
        cockpitCards.appendChild(cockpitCard('Speicherplatz', disk ? cockpitNum(disk.percent) + ' %' : '–', disk ? `${cockpitBytes(disk.freeBytes)} frei von ${cockpitBytes(disk.totalBytes)}` : 'nicht lesbar', disk ? disk.percent : null, cockpitAreaLevel(items, 'disk'), series('disk')));
        const dockerTotal = usage ? usage.imagesBytes + usage.containersBytes + usage.volumesBytes + usage.buildCacheBytes : null;
        cockpitCards.appendChild(cockpitCard('Docker belegt', dockerTotal !== null ? cockpitBytes(dockerTotal) : '–', docker.available ? `${docker.containersRunning} von ${docker.containersTotal} Container laufen · ${docker.imagesCount || 0} Images` : 'Docker nicht abfragbar', null, docker.available ? 'ok' : 'crit', null));

        // Container
        if (!docker.available) cockpitContainers.appendChild(cockpitEl('div', 'text-[11px] text-red-300', docker.error || 'Docker lässt sich nicht abfragen.'));
        else if (!(docker.containers || []).length) cockpitContainers.appendChild(cockpitEl('div', 'text-[11px] text-slate-500', 'Keine Container gefunden.'));
        (docker.containers || []).forEach(c => {
            const st = COCKPIT_LEVEL_STYLE[cockpitContainerState(c)];
            const row = cockpitEl('div', 'bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px]');
            row.appendChild(cockpitEl('span', '', st.dot));
            const mid = cockpitEl('div', 'flex-1 min-w-0');
            mid.appendChild(cockpitEl('div', 'text-white font-medium truncate', c.name));
            mid.appendChild(cockpitEl('div', 'text-[10px] text-slate-500 truncate', `${c.image} · ${c.status}`));
            row.appendChild(mid);
            const nums = cockpitEl('div', 'text-right text-[10px] text-slate-400 whitespace-nowrap');
            nums.appendChild(cockpitEl('div', '', Number.isFinite(c.cpuPercent) ? cockpitNum(c.cpuPercent) + ' % CPU' : ''));
            nums.appendChild(cockpitEl('div', '', Number.isFinite(c.memoryBytes) ? cockpitBytes(c.memoryBytes) : ''));
            row.appendChild(nums);
            cockpitContainers.appendChild(row);
        });
        if (usage) {
            cockpitDockerUsage.textContent = `Images ${cockpitBytes(usage.imagesBytes)} · Volumes ${cockpitBytes(usage.volumesBytes)} · Container ${cockpitBytes(usage.containersBytes)} · Zwischenspeicher vom Bauen ${cockpitBytes(usage.buildCacheBytes)}` + (usage.buildCacheReclaimableBytes > 0 ? ` (davon ${cockpitBytes(usage.buildCacheReclaimableBytes)} aufräumbar mit: docker builder prune -f)` : '');
        }

        // Schwachstellen
        const v = snap.vulnerabilities;
        if (!v || !v.configured) {
            cockpitVulns.appendChild(cockpitEl('div', 'text-[11px] text-slate-500', 'Der Scan ist nicht eingerichtet. Einmalig starten mit: docker compose --profile scan up -d (der Scanner „Trivy“ prüft dann täglich nachts alle Images dieses Servers).'));
        } else if (!(v.images || []).length) {
            cockpitVulns.appendChild(cockpitEl('div', 'text-[11px] text-slate-500', 'Noch kein lesbarer Bericht. Der erste Scan kann einige Minuten dauern (Trivy lädt zuerst seine Datenbank).'));
        } else {
            v.images.forEach(img => {
                const worst = img.counts.CRITICAL > 0 ? 'crit' : (img.counts.HIGH > 0 ? 'warn' : 'ok');
                const box = cockpitEl('details', 'bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px]');
                const sum = cockpitEl('summary', 'cursor-pointer flex items-center gap-2');
                sum.appendChild(cockpitEl('span', '', COCKPIT_LEVEL_STYLE[worst].dot));
                sum.appendChild(cockpitEl('span', 'flex-1 min-w-0 truncate text-white', img.image));
                sum.appendChild(cockpitEl('span', 'text-red-400', `K ${img.counts.CRITICAL}`));
                sum.appendChild(cockpitEl('span', 'text-amber-400', `H ${img.counts.HIGH}`));
                sum.appendChild(cockpitEl('span', 'text-slate-400', `M ${img.counts.MEDIUM}`));
                sum.appendChild(cockpitEl('span', 'text-slate-500', `N ${img.counts.LOW}`));
                box.appendChild(sum);
                box.appendChild(cockpitEl('div', 'text-[10px] text-slate-500 mt-1', `K kritisch · H hoch · M mittel · N niedrig · ${img.critFixable !== undefined ? `${img.critFixable} kritische und ${img.highFixable} hohe behebbar` : `${img.fixable} mit verfügbarer Korrektur`} · gescannt ${cockpitAgo(img.scannedAt)}`));
                (img.top || []).forEach(t => box.appendChild(cockpitEl('div', 'text-[10px] text-slate-400 mt-0.5', `${t.severity} · ${t.id} · ${t.pkg} ${t.installed}${t.fixed ? ' → ' + t.fixed : ''}${t.title ? ' – ' + t.title : ''}`)));
                cockpitVulns.appendChild(box);
            });
        }

        // Updates des Servers
        const u = snap.hostUpdates;
        if (!u || !u.configured) {
            cockpitUpdates.appendChild(cockpitEl('div', 'text-[11px] text-slate-500', 'Nicht eingerichtet. Einmalig auf dem Server ausführen: sudo bash cockpit/host/install-hostcheck.sh (prüft dann täglich auf offene Updates und „Neustart nötig“; es wird nichts installiert).'));
        } else {
            cockpitUpdates.appendChild(cockpitEl('div', 'text-[11px] text-slate-300', `${u.upgradable} Updates offen, davon ${u.securityUpgradable} Sicherheits-Updates${u.rebootRequired ? ' · Neustart nötig' : ''} · geprüft ${u.checkedAt ? cockpitAgo(u.checkedAt) : '–'}`));
            if ((u.packages || []).length) cockpitUpdates.appendChild(cockpitEl('div', 'text-[10px] text-slate-500', 'Sicherheits-Updates: ' + u.packages.map(p => `${p.name} ${p.version}`).join(', ')));
        }
    }

    async function loadCockpit() {
        if (cockpitLoading) return;
        cockpitLoading = true;
        if (cockpitRefreshBtn) cockpitRefreshBtn.disabled = true;
        try {
            const res = await fetch('/api/cockpit', { credentials: 'same-origin', headers: { 'X-Aura-Request': '1' } });
            const data = await res.json().catch(() => null);
            if (res.status === 401) { window.location.href = '/login'; return; }
            if (!res.ok) renderCockpit({ ok: false, error: (data && (data.error || data.detail)) || `Status ${res.status}`, hint: '' });
            else renderCockpit(data);
        } catch (err) {
            renderCockpit({ ok: false, error: 'AuraControl antwortet nicht (' + err.message + ').', hint: '' });
        } finally {
            cockpitLoading = false;
            if (cockpitRefreshBtn) cockpitRefreshBtn.disabled = false;
        }
    }
    const cockpitVisible = () => !!view && !view.classList.contains('hidden') && !document.hidden;
    function stopCockpitRefresh() { if (cockpitTimer) { clearInterval(cockpitTimer); cockpitTimer = null; } }
    function startCockpitRefresh() {
        stopCockpitRefresh();
        cockpitTimer = setInterval(() => { if (!cockpitVisible()) { stopCockpitRefresh(); return; } loadCockpit(); }, COCKPIT_REFRESH_MS);
    }
    if (cockpitRefreshBtn) cockpitRefreshBtn.addEventListener('click', loadCockpit);
    // Anzeige beim Öffnen der Ansicht laden und alle 10 Sekunden aktualisieren, solange sie sichtbar ist
    window.AuraCockpit = Object.freeze({ show: () => { loadCockpit(); startCockpitRefresh(); }, hide: stopCockpitRefresh, reload: loadCockpit });
})();
