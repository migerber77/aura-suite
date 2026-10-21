(() => {
'use strict';
/* AuraCall - Verwaltungs-Oberfläche. Alle Texte kommen als reiner Text in die Seite (nie als HTML): so kann nichts eingeschleust werden. */
const $ = (s, r = document) => r.querySelector(s);

function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (k === 'class') el.className = v;
        else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) { if (kid === null || kid === undefined || kid === false) continue; el.append(kid instanceof Node ? kid : document.createTextNode(String(kid))); }
    return el;
}
// Kinder in ein Element setzen: Listen werden aufgelöst, leere Einträge (null/false) ausgelassen
// (der Browser-Befehl replaceChildren würde sonst aus null den Text "null" und aus einer Liste "[object ...]" machen)
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
async function api(method, url, body) {
    const res = await fetch(url, { method, credentials: 'same-origin', headers: { 'X-Requested-With': 'AuraCall', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch { /* keine Antwort */ }
    if (!res.ok) { const e = new Error((data && data.error) || ('Fehler ' + res.status)); e.status = res.status; e.data = data; throw e; }
    return data;
}
const OUTCOMES = { 'caller-hangup': 'Anrufer hat aufgelegt', 'ended-by-aura': 'Aura hat beendet', 'idle-timeout': 'Keine Antwort (Stille)', 'max-duration': 'Höchstdauer erreicht', unclear: 'Nicht verstanden', operator: 'Von Hand aufgelegt', rejected: 'Abgewiesen (belegt)', failed: 'Nicht zustande gekommen', active: 'läuft', dialing: 'wählt', abgebrochen: 'Abgebrochen (Neustart)', shutdown: 'Programm beendet' };
const outcomeText = (o) => OUTCOMES[o] || (String(o).startsWith('error:') ? 'Fehler (' + String(o).slice(6) + ')' : String(o));
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'medium' }) : '–');
const fmtDur = (ms) => { if (ms === null || ms === undefined) return '–'; const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let toastTimer = null;
function toast(msg, kind = 'ok') { const t = $('#toast'); t.className = 'toast alert ' + kind; t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), kind === 'error' ? 9000 : 4000); }
const errText = (e) => (e.data && Array.isArray(e.data.details) && e.data.details.length > 1 ? e.data.details.join(' ') : e.message);

// ---- Formulare aus einer Liste von Feldern ----
function field(def, value) {
    let input, get;
    if (def.type === 'checkbox') { input = h('input', { type: 'checkbox', checked: !!value, id: 'f-' + def.key }); get = () => input.checked; return { el: h('label', { class: 'check' }, input, def.label, def.hint ? h('span', { class: 'hint' }, def.hint) : null), get, input }; }
    if (def.type === 'select') { input = h('select', {}, def.options.map(([v, l]) => h('option', { value: v }, l))); input.value = value; get = () => input.value; }
    else if (def.type === 'textarea') { input = h('textarea', { rows: def.rows || 4, placeholder: def.placeholder || '' }); input.value = Array.isArray(value) ? value.join('\n') : (value || ''); get = () => (def.list ? input.value.split(/\n/).map(s => s.trim()).filter(Boolean) : input.value); }
    else { input = h('input', { type: def.type === 'password' ? 'password' : 'text', autocomplete: def.type === 'password' ? 'new-password' : 'off', placeholder: def.placeholder || '', inputmode: def.type === 'number' ? 'numeric' : null }); input.value = Array.isArray(value) ? value.join(', ') : (value === undefined || value === null ? '' : value); get = () => input.value.trim(); }
    input.id = 'f-' + def.key;
    return { el: h('label', {}, def.label, input, def.hint ? h('span', { class: 'hint' }, def.hint) : null), get, input };
}
function form(defs, values) { const fs = defs.map(d => ({ d, f: field(d, values[d.key]) })); return { els: fs.map(x => x.f.el), values: () => { const o = {}; for (const { d, f } of fs) { const v = f.get(); if (d.type === 'password' && v === '') continue; o[d.key] = v; } return o; } }; }

// ---- Bereiche ----
const TABS = [['overview', 'Übersicht'], ['calls', 'Anrufe'], ['out', 'Ausgehend'], ['trunk', 'Leitung'], ['aura', 'Aura'], ['security', 'Sicherheit'], ['license', 'Lizenz'], ['settings', 'Allgemein']];
// Einheitliches Menü der Aura-Suite: Hauptreiter = Alltag; "Einstellungen" (Menü) = Anpassungen; "Admin Panel" (Menü) = Lizenz und Sicherheit
const GROUPS = { main: ['overview', 'calls', 'out'], settings: ['trunk', 'aura', 'settings'], admin: ['license', 'security'] };
const groupOf = (tab) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(tab)) || 'main';
let tabsGroup = null;
function renderTabs(group) {
    tabsGroup = group; const label = Object.fromEntries(TABS);
    const ids = group === 'main' ? GROUPS.main : ['overview', ...GROUPS[group]];
    fill($('#tabs'), ...ids.map((id) => h('button', { type: 'button', 'data-tab': id, on: { click: () => show(id) } }, group !== 'main' && id === 'overview' ? '← Übersicht' : label[id])));
}
let current = 'overview', poll = null, user = null;

async function renderOverview(root) {
    const [st, cs, set] = await Promise.all([api('GET', '/api/status'), api('GET', '/api/calls?limit=8'), api('GET', '/api/settings')]);
    const reg = st.trunk.registration.state, regOk = reg === 'Registered' || reg === 'keine Anmeldung nötig';
    const tile = (title, dotKind, big, sub, extra) => h('div', { class: 'card tile' }, h('h3', {}, title), h('div', { class: 'big' }, h('span', { class: 'dot ' + dotKind }), big), h('div', { class: 'muted small' }, sub), extra);
    const checkAura = st.aurachat.lastCheck;
    const steps = [
        ['AuraChat verbinden (Adresse und API-Schlüssel eintragen und testen)', !!(st.aurachat.configured && checkAura && checkAura.ok)],
        ['Telefon-Leitung des Anbieters eintragen und einschalten', !!(set.trunk.enabled && set.trunk.host)],
        ['Leitung anwenden: Asterisk lädt die Einstellungen, der Anbieter nimmt die Anmeldung an', !!(st.trunk.enabled && !st.trunk.pending && regOk)],
        ['Aura einrichten (Firmenname, Begrüssung, Wissen)', !!set.general.company],
        ['Testanruf: die eigene Nummer anrufen und mit Aura sprechen', cs.total > 0]
    ];
    const allDone = steps.every(s => s[1]);
    fill(root, 
        h('div', { class: 'grid' },
            tile('Asterisk', st.asterisk.connected ? 'ok' : 'bad', st.asterisk.connected ? 'verbunden' : 'getrennt', st.asterisk.connected ? 'Version ' + (st.asterisk.version || '?') : (st.asterisk.problem || 'keine Verbindung')),
            tile('Leitung', !st.trunk.enabled ? '' : regOk ? 'ok' : 'warn', st.trunk.enabled ? reg : 'aus', st.trunk.host || 'noch nicht eingerichtet', st.trunk.pending ? h('div', { class: 'alert warn small' }, 'Änderungen noch nicht angewendet') : null),
            tile('AuraChat', !st.aurachat.configured ? '' : checkAura ? (checkAura.ok ? 'ok' : 'bad') : 'warn', !st.aurachat.configured ? 'nicht eingerichtet' : checkAura ? (checkAura.ok ? 'verbunden' : 'Problem') : 'noch nicht getestet', checkAura && !checkAura.ok ? ((checkAura.error && checkAura.error.message) || [checkAura.tts, checkAura.stt, checkAura.chat].filter(x => x && !x.ok).map(x => x.error.message).join(' ')) : (st.aurachat.warmup ? (st.aurachat.warmup.ok ? 'Modell vorbereitet ' + fmtTime(st.aurachat.warmup.at) + ' (' + Math.round(st.aurachat.warmup.ms / 100) / 10 + ' s)' : 'Aufwärmen fehlgeschlagen: ' + st.aurachat.warmup.error) : 'Sprache, Hören und Antworten'),
                st.aurachat.configured ? h('div', { class: 'row' }, h('button', { type: 'button', on: { click: async (ev) => { ev.target.disabled = true; try { await api('POST', '/api/aurachat/test'); } catch (e) { toast(e.message, 'error'); } load(); } } }, 'Verbindung testen')) : null),
            tile('Letzte 24 Stunden', '', st.calls.last24h.in + ' ein / ' + st.calls.last24h.out + ' aus', 'Gespräche')),
        allDone ? null : h('div', { class: 'card' }, h('h3', {}, 'Einrichtung'), h('ol', { class: 'steps' }, steps.map(([t, d]) => h('li', { class: d ? 'done' : 'todo' }, (d ? '✓ ' : '') + t)))),
        h('div', { class: 'card' }, h('h3', {}, 'Laufende Gespräche'),
            st.calls.active.length === 0 ? h('p', { class: 'muted' }, 'Zurzeit läuft kein Gespräch.') :
                h('table', {}, h('thead', {}, h('tr', {}, ['', 'Nummer', 'Zustand', 'Dauer', 'Wortwechsel', ''].map(x => h('th', {}, x)))),
                    h('tbody', {}, st.calls.active.map(c => h('tr', {}, h('td', {}, h('span', { class: 'pill ' + c.direction }, c.direction === 'in' ? 'ein' : 'aus')), h('td', {}, c.number), h('td', {}, c.state), h('td', {}, fmtDur(c.durationMs)), h('td', {}, c.turns),
                        h('td', {}, c.state === 'dialing' ? null : h('button', { class: 'danger', type: 'button', on: { click: async () => { try { await api('POST', '/api/calls/' + c.id + '/hangup'); toast('Aufgelegt.'); load(); } catch (e) { toast(e.message, 'error'); } } } }, 'Auflegen'))))))),
        h('div', { class: 'card' }, h('h3', {}, 'Letzte Anrufe'), callsTable(cs.items, true)));
}
function callsTable(items, compact) {
    if (!items.length) return h('p', { class: 'muted' }, 'Noch keine Anrufe.');
    return h('table', {}, h('thead', {}, h('tr', {}, ['Zeit', '', 'Nummer', 'Dauer', 'Ausgang', 'Wortwechsel'].map(x => h('th', {}, x)))),
        h('tbody', {}, items.map(c => h('tr', { class: 'click', tabindex: 0, on: { click: () => openCall(c.id), keydown: (e) => { if (e.key === 'Enter') openCall(c.id); } } },
            h('td', {}, fmtTime(c.startedAt)), h('td', {}, h('span', { class: 'pill ' + c.direction }, c.direction === 'in' ? 'ein' : 'aus')), h('td', {}, c.number || 'unbekannt'), h('td', {}, fmtDur(c.durationMs)), h('td', {}, outcomeText(c.outcome)), h('td', {}, c.turns)))));
}
async function openCall(id) {
    try {
        const c = await api('GET', '/api/calls/' + id);
        fill($('#modal-body'), h('h3', {}, (c.direction === 'in' ? 'Eingehender' : 'Ausgehender') + ' Anruf ' + (c.number || 'unbekannt')),
            h('p', { class: 'muted' }, fmtTime(c.startedAt) + ' · Dauer ' + fmtDur(c.durationMs) + ' · ' + outcomeText(c.outcome) + ' · ' + c.turns + ' Wortwechsel'),
            c.purpose ? h('p', {}, 'Anlass: ' + c.purpose) : null, c.error ? h('div', { class: 'alert warn' }, c.error) : null,
            c.transcript.length ? h('div', { class: 'chat' }, c.transcript.map(t => h('div', { class: 'bubble ' + t.who }, t.text))) : h('p', { class: 'hint' }, 'Kein Gesprächsprotokoll gespeichert (Einstellung "Gespräch als Text speichern" unter Aura).'),
            ['active', 'dialing'].includes(c.outcome) ? null : h('div', { class: 'row end' }, h('button', { class: 'danger', type: 'button', on: { click: async () => { if (!confirm('Diesen Anruf samt Protokoll endgültig löschen?')) return; try { await api('DELETE', '/api/calls/' + id); closeModal(); toast('Gelöscht.'); load(); } catch (e) { toast(e.message, 'error'); } } } }, 'Löschen')));
        $('#modal').classList.remove('hidden'); $('#modal-close').focus();
    } catch (e) { toast(e.message, 'error'); }
}
const closeModal = () => $('#modal').classList.add('hidden');

async function renderCalls(root) {
    let dir = '', loaded = [], total = 0;
    const holder = h('div', {}), more = h('button', { type: 'button' }, 'Mehr laden');
    const fetchMore = async (reset) => { if (reset) loaded = []; const r = await api('GET', `/api/calls?limit=50&offset=${loaded.length}${dir ? '&direction=' + dir : ''}`); loaded = loaded.concat(r.items); total = r.total; fill(holder, callsTable(loaded), h('p', { class: 'hint' }, loaded.length + ' von ' + total)); more.classList.toggle('hidden', loaded.length >= total); };
    const sel = h('select', { id: 'calls-filter', on: { change: () => { dir = sel.value; fetchMore(true); } } }, [['', 'Alle'], ['in', 'Eingehend'], ['out', 'Ausgehend']].map(([v, l]) => h('option', { value: v }, l)));
    more.addEventListener('click', () => fetchMore(false));
    fill(root, h('div', { class: 'card stack' }, h('div', { class: 'row' }, h('label', {}, 'Anzeigen', sel)), holder, more));
    await fetchMore(true);
}

async function renderOut(root) {
    const [set, sched] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/scheduled')]);
    const num = h('input', { id: 'out-number', placeholder: '+41 79 123 45 67', autocomplete: 'off' }), purpose = h('textarea', { id: 'out-purpose', rows: 3, placeholder: 'Worum geht es? Zum Beispiel: Rückfrage zur Buchung für den 12. Oktober.' }), when = h('input', { id: 'out-when', type: 'datetime-local' }), msg = h('div', { class: 'hidden' });
    const send = async (ev) => {
        ev.preventDefault(); msg.className = 'hidden';
        const body = { number: num.value, purpose: purpose.value }; if (when.value) body.when = new Date(when.value).toISOString();
        if (!confirm(when.value ? `Aura ruft ${num.value} am ${new Date(when.value).toLocaleString('de-CH')} an.\n\nFortfahren?` : `Aura ruft jetzt ${num.value} an. Dabei entstehen Telefonkosten.\n\nFortfahren?`)) return;
        try { const r = await api('POST', '/api/outbound', body); msg.className = 'alert ok'; msg.textContent = r.scheduled ? 'Der Anruf ist geplant.' : 'Aura wählt jetzt. Den Verlauf sehen Sie unter Übersicht.'; num.value = ''; purpose.value = ''; when.value = ''; if (r.scheduled) load(); }
        catch (e) { msg.className = 'alert error'; msg.textContent = e.message; }
    };
    fill(root, 
        set.limits.outboundEnabled ? null : h('div', { class: 'alert warn' }, 'Ausgehende Anrufe sind ausgeschaltet. Einschalten unter Einstellungen → Grenzen für ausgehende Anrufe.'),
        h('div', { class: 'card' }, h('h3', {}, 'Aura ruft an'),
            h('form', { class: 'stack', id: 'out-form', on: { submit: send } }, h('label', {}, 'Rufnummer', num), h('label', {}, 'Anlass (Aura erfährt ihn vor dem Gespräch)', purpose),
                h('label', {}, 'Zeitpunkt (leer = jetzt)', when), h('p', { class: 'hint' }, 'Erlaubt: ' + set.limits.outboundAllowedPrefixes.join(', ') + ' · nur ' + set.limits.outboundHours + ' Uhr · höchstens ' + set.limits.outboundPerDay + ' Anrufe in 24 Stunden. Aura nennt sich zu Beginn immer als KI.'),
                msg, h('div', { class: 'row end' }, h('button', { class: 'primary', type: 'submit' }, 'Anrufen')))),
        h('div', { class: 'card' }, h('h3', {}, 'Geplante Anrufe'), sched.items.filter(s => s.status === 'pending').length === 0 ? h('p', { class: 'muted' }, 'Keine geplanten Anrufe.') :
            h('table', {}, h('thead', {}, h('tr', {}, ['Zeit', 'Nummer', 'Anlass', ''].map(x => h('th', {}, x)))), h('tbody', {}, sched.items.filter(s => s.status === 'pending').map(s => h('tr', {}, h('td', {}, fmtTime(s.runAt)), h('td', {}, s.number), h('td', {}, s.purpose), h('td', {}, h('button', { type: 'button', on: { click: async () => { try { await api('DELETE', '/api/scheduled/' + s.id); load(); } catch (e) { toast(e.message, 'error'); } } } }, 'Löschen'))))))));
}

const TRUNK_FIELDS = [
    { key: 'enabled', type: 'checkbox', label: 'Leitung einschalten' },
    { key: 'host', label: 'Server des Anbieters', placeholder: 'sip.anbieter.ch', hint: 'Steht in den Zugangsdaten Ihres SIP-Anbieters.' },
    { key: 'port', label: 'Port', placeholder: '5060' }, { key: 'transport', type: 'select', label: 'Übertragung', options: [['udp', 'UDP (üblich)'], ['tcp', 'TCP']] },
    { key: 'username', label: 'Benutzername' }, { key: 'authUsername', label: 'Anmeldename (falls anders)' }, { key: 'password', type: 'password', label: 'Passwort', hint: 'Leer lassen = bisheriges behalten. Keine Zeichen ; und \\ .' },
    { key: 'register', type: 'checkbox', label: 'Beim Anbieter anmelden (Registrierung)', hint: 'Aus, wenn der Anbieter Ihre feste IP-Adresse freischaltet.' }, { key: 'expirationSec', label: 'Anmeldung erneuern alle (Sekunden)', placeholder: '600' },
    { key: 'defaultCountryCode', label: 'Landesvorwahl', placeholder: '41' }, { key: 'dialFormat', type: 'select', label: 'Nummern wählen als', options: [['e164plus', '+41791234567'], ['e164', '41791234567'], ['national', '0791234567']] },
    { key: 'callerIdName', label: 'Name beim Angerufenen' }, { key: 'callerIdOut', label: 'Eigene Nummer beim Angerufenen', placeholder: '+41 44 123 45 67' },
    { key: 'acceptAll', type: 'checkbox', label: 'Alle Anrufe der Leitung annehmen', hint: 'Aus = nur die unten genannten eigenen Nummern.' }, { key: 'dids', type: 'textarea', list: true, rows: 3, label: 'Eigene Rufnummern (eine pro Zeile)' },
    { key: 'keepaliveSec', label: 'Haltesignal an den Anbieter alle (Sekunden, 0 = aus)', placeholder: '0', hint: 'Bei Server hinter Router/Firewall: 25 eintragen. Hält den Weg für eingehende Anrufe offen; ohne dieses Signal vergisst die Firewall ihn nach etwa 60 Sekunden, und der Anbieter kommt nicht mehr durch (Ansage "bitte rufen Sie später an").' },
    { key: 'publicAddress', label: 'Öffentliche Adresse des Servers (nur bei NAT)', hint: 'Öffentliche IP oder Name, wenn der Server hinter einem Router steht.' }, { key: 'localNets', type: 'textarea', list: true, rows: 2, label: 'Heimnetz(e)', placeholder: '192.168.1.0/24' },
    { key: 'extraMatch', type: 'textarea', list: true, rows: 2, label: 'Weitere Server des Anbieters (Adresse oder Netz)', hint: 'Nur diese und der Server oben dürfen anrufen.' }
];
async function renderTrunk(root) {
    const set = await api('GET', '/api/settings'), st = await api('GET', '/api/status'); const t = { ...set.trunk }; const f = form(TRUNK_FIELDS, t);
    const pw = f.els.find(e => $('#f-password', e)); if (set.trunk.hasPassword) $('#f-password', pw).placeholder = '•••••••• (gespeichert)';
    const out = h('div', { class: 'hidden' }), prev = h('div', { class: 'hidden' });
    const save = async (apply) => { out.className = 'hidden'; try { await api('PUT', '/api/settings/trunk', f.values()); if (apply) { const r = await api('POST', '/api/trunk/apply'); toast(r.reloaded ? 'Angewendet: Asterisk hat die Einstellungen geladen.' : r.note, r.reloaded ? 'ok' : 'warn'); } else toast('Gespeichert. Noch nicht angewendet.'); load(); } catch (e) { out.className = 'alert error'; out.textContent = errText(e); } };
    const preview = async () => { out.className = 'hidden'; try { await api('PUT', '/api/settings/trunk', f.values()); const r = await api('GET', '/api/trunk/preview'); prev.className = ''; fill(prev, r.ok ? Object.entries(r.files).map(([n, c]) => h('div', {}, h('p', { class: 'hint' }, n), h('pre', {}, c))) : h('div', { class: 'alert error' }, r.errors.join(' '))); } catch (e) { out.className = 'alert error'; out.textContent = errText(e); } };   // Vorschau speichert zuerst (ohne anzuwenden), damit sie zeigt, was im Formular steht
    fill(root, h('div', { class: 'card stack' }, h('h3', {}, 'SIP-Leitung (Anbieter)'),
        h('p', { class: 'muted' }, 'Zustand: ' + (st.trunk.enabled ? st.trunk.registration.state : 'aus') + (st.trunk.pending ? ' · Änderungen noch nicht angewendet' : '')),
        h('div', { class: 'grid two' }, f.els), out,
        h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: preview } }, 'Speichern und Vorschau'), h('button', { type: 'button', on: { click: () => save(false) } }, 'Speichern'), h('button', { class: 'primary', type: 'button', on: { click: () => save(true) } }, 'Speichern und anwenden')), prev));
}

const AURA_FIELDS = [
    { key: 'company', label: 'Name des Hauses / der Firma', hint: 'Aura nennt ihn in der Begrüssung.' }, { key: 'lang', type: 'select', label: 'Sprache', options: [['de', 'Deutsch'], ['en', 'Englisch'], ['fr', 'Französisch'], ['it', 'Italienisch'], ['es', 'Spanisch']] },
    { key: 'greetingIn', type: 'textarea', rows: 3, label: 'Begrüssung bei eingehenden Anrufen', hint: 'Leer = Standardtext. Muss sagen, dass eine KI spricht. {company} wird durch den Namen ersetzt.' },
    { key: 'greetingOut', type: 'textarea', rows: 3, label: 'Begrüssung bei ausgehenden Anrufen', hint: 'Leer = Standardtext. Muss sagen, dass eine KI spricht.' },
    { key: 'knowledge', type: 'textarea', rows: 10, label: 'Wissen für Gespräche', hint: 'Öffnungszeiten, Preise, Frühstückszeiten, Anreise, häufige Fragen. Aura verwendet nur das, was hier steht (höchstens 6000 Zeichen).' },
    { key: 'storeTranscripts', type: 'checkbox', label: 'Gespräch als Text speichern', hint: 'Aus (Standard): es wird nichts vom Gespräch gespeichert. An: Aura sagt am Anfang, dass das Gespräch als Text gespeichert wird.' },
    { key: 'retentionDays', label: 'Anrufe aufbewahren (Tage)', placeholder: '30' }
];
const LIMIT_FIELDS = [
    { key: 'outboundEnabled', type: 'checkbox', label: 'Ausgehende Anrufe erlauben', hint: 'Standardmässig aus. Ausgehende Anrufe kosten Geld.' }, { key: 'outboundAllowedPrefixes', label: 'Erlaubte Länder (Vorwahlen)', placeholder: '+41, +49', hint: 'Nur dorthin darf Aura anrufen.' },
    { key: 'outboundHours', label: 'Erlaubte Zeit', placeholder: '08:00-20:00' }, { key: 'outboundPerDay', label: 'Höchstens so viele Anrufe in 24 Stunden' }, { key: 'outboundPerMinute', label: 'Höchstens so viele Anrufe pro Minute' }, { key: 'maxConcurrent', label: 'Gleichzeitige Gespräche', hint: 'Jedes Gespräch belastet den KI-Server.' }
];
const AUDIO_FIELDS = [
    { key: 'gain', label: 'Lautstärke von Aura', hint: '1 = unverändert, 0.3 bis 2.' }, { key: 'sensitivity', type: 'select', label: 'Empfindlichkeit des Zuhörens', options: [['normal', 'Normal'], ['laut', 'Laute Umgebung'], ['leise', 'Leise Leitung']] },
    { key: 'idlePromptSec', label: 'Nachfragen nach (Sekunden Stille)' }, { key: 'maxCallMin', label: 'Höchstdauer eines Gesprächs (Minuten)' }
];
// Erfolg als Einblendung (toast): der Bereich wird nach dem Speichern neu aufgebaut, eine Meldung im Bereich selbst wäre sofort weg
function saveCard(title, section, defs, values, note) {
    const f = form(defs, values), msg = h('div', { class: 'hidden' });
    const save = async () => { msg.className = 'hidden'; try { await api('PUT', '/api/settings/' + section, f.values()); toast('Gespeichert.'); load(); } catch (e) { msg.className = 'alert error'; msg.textContent = errText(e); } };
    return h('div', { class: 'card stack' }, h('h3', {}, title), note ? h('p', { class: 'muted' }, note) : null, h('div', { class: 'grid two' }, f.els), msg, h('div', { class: 'row end' }, h('button', { class: 'primary', type: 'button', on: { click: save } }, 'Speichern')));
}
async function renderAura(root) { const set = await api('GET', '/api/settings'); const v = { ...set.general }; fill(root, saveCard('Aura am Telefon', 'general', AURA_FIELDS, v)); const gi = $('#f-greetingIn', root), go = $('#f-greetingOut', root); gi.placeholder = set.defaults.greetingIn; go.placeholder = set.defaults.greetingOut; }

async function renderSettings(root) {
    const [set, audit] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/audit')]);
    const prefsBox = h('div', { id: 'prefs-card' }); setTimeout(() => window.AuraPrefs.card(prefsBox), 0);   // Darstellung (Dunkel/Hell/Automatisch)
    const chatF = form([{ key: 'url', label: 'Adresse von AuraChat', placeholder: 'http://192.168.1.10:8091', hint: 'So wie Sie AuraChat im Browser öffnen, ohne Pfad.' }, { key: 'model', label: 'Modell fürs Telefon (leer = das Modell von AuraChat)', placeholder: 'gemma4:12b', hint: 'Ein schnelleres Modell nur für Anrufe; der Chat in AuraChat bleibt unverändert.' }, { key: 'warmupMin', label: 'Modell aufwärmen alle ... Minuten (0 = aus)', placeholder: '4', hint: 'Hält den langen Anfang (Regeln und Wissen) im Speicher des KI-Servers, damit der erste Anruf nach einer Pause nicht 10 Sekunden wartet. Achtung: Solange das läuft, wird das Modell in Ollama nie entladen (jede Anfrage beginnt die Haltezeit neu). Zum Entladen auf 0 stellen.' }, { key: 'apiKey', type: 'password', label: 'API-Schlüssel', hint: 'In AuraChat im Admin Panel unter "API" erzeugen. Leer lassen = bisherigen behalten. Braucht die Premium-Funktionen "Externe API" und "Telefonie".' }], set.aurachat);
    if (set.aurachat.hasKey) $('#f-apiKey', chatF.els[3]).placeholder = '•••••••• (gespeichert)';
    const chatMsg = h('div', { class: 'hidden' });
    const saveChat = async (test) => { chatMsg.className = 'hidden'; try { await api('PUT', '/api/settings/aurachat', chatF.values()); if (test) { chatMsg.className = 'alert warn'; chatMsg.textContent = 'Teste die Verbindung (das kann bis zu zwei Minuten dauern, wenn das Modell erst geladen wird) …'; const r = await api('POST', '/api/aurachat/test'); const line = (n, x) => x ? `${n}: ${x.ok ? 'in Ordnung (' + x.ms + ' ms)' : x.error.message}` : ''; chatMsg.className = 'alert ' + (r.ok ? 'ok' : 'error'); chatMsg.textContent = r.error ? r.error.message : [line('Sprachausgabe', r.tts), line('Spracherkennung', r.stt), line('Antworten', r.chat)].filter(Boolean).join(' · '); } else { chatMsg.className = 'alert ok'; chatMsg.textContent = 'Gespeichert.'; } } catch (e) { chatMsg.className = 'alert error'; chatMsg.textContent = errText(e); } };
    const keyBox = h('div', { class: 'hidden' });
    const pw = { o: h('input', { id: 'pw2-old', type: 'password', autocomplete: 'current-password' }), n: h('input', { id: 'pw2-new', type: 'password', autocomplete: 'new-password' }) }, pwMsg = h('div', { class: 'hidden' });
    fill(root, 
        h('div', { class: 'card stack' }, prefsBox),
        h('div', { class: 'card stack' }, h('h3', {}, 'AuraChat'), h('div', { class: 'grid two' }, chatF.els), chatMsg, h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: () => saveChat(false) } }, 'Speichern'), h('button', { class: 'primary', type: 'button', on: { click: () => saveChat(true) } }, 'Speichern und testen'))),
        saveCard('Grenzen für ausgehende Anrufe und Gespräche', 'limits', LIMIT_FIELDS, set.limits),
        saveCard('Ton', 'audio', AUDIO_FIELDS, set.audio),
        h('div', { class: 'card stack' }, h('h3', {}, 'Schlüssel für andere Programme'), h('p', { class: 'muted' }, 'Damit ein anderes Programm (z.B. AuraChat) Aura anrufen lassen kann: Adresse /api/service/outbound mit "Authorization: Bearer <Schlüssel>". ' + (set.hasServiceKey ? 'Es gibt schon einen Schlüssel; ein neuer macht den alten ungültig.' : 'Es gibt noch keinen Schlüssel.')), keyBox,
            h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: async () => { if (set.hasServiceKey && !confirm('Der bisherige Schlüssel wird ungültig. Fortfahren?')) return; try { const r = await api('POST', '/api/service-key'); keyBox.className = 'alert warn'; fill(keyBox, h('div', {}, 'Der Schlüssel wird nur jetzt angezeigt. Bitte kopieren und sicher aufbewahren:'), h('code', { id: 'service-key' }, r.key)); } catch (e) { toast(e.message, 'error'); } } } }, 'Neuen Schlüssel erzeugen'))),
        h('div', { class: 'card stack' }, h('h3', {}, 'Passwort ändern'), h('div', { class: 'grid two' }, h('label', {}, 'Bisheriges Passwort', pw.o), h('label', {}, 'Neues Passwort', pw.n)), pwMsg,
            h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: async () => { pwMsg.className = 'hidden'; try { await api('POST', '/api/password', { oldPassword: pw.o.value, newPassword: pw.n.value }); pw.o.value = ''; pw.n.value = ''; pwMsg.className = 'alert ok'; pwMsg.textContent = 'Passwort geändert.'; } catch (e) { pwMsg.className = 'alert error'; pwMsg.textContent = e.message; } } } }, 'Passwort ändern'))),
        h('div', { class: 'card' }, h('h3', {}, 'Änderungsprotokoll'), h('table', {}, h('thead', {}, h('tr', {}, ['Zeit', 'Benutzer', 'Aktion', 'Einzelheiten'].map(x => h('th', {}, x)))), h('tbody', {}, audit.items.slice(0, 20).map(a => h('tr', {}, h('td', {}, fmtTime(a.at)), h('td', {}, a.user), h('td', {}, a.action), h('td', {}, a.detail)))))));
}

// ---- Zwei-Faktor-Anmeldung, Konten, AuraDirect, Datenschutz ----
// Der QR-Code kommt als Zeilen aus 0 und 1 vom Server; die Grafik wird hier aus Elementen gebaut (kein HTML wird eingesetzt).
function qrSvg(q) {
    const NS = 'http://www.w3.org/2000/svg', b = 4, n = q.size + 2 * b, mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };
    let d = ''; q.rows.forEach((row, y) => { let x = 0; while (x < q.size) { if (row[x] !== '1') { x++; continue; } let e = x; while (e < q.size && row[e] === '1') e++; d += `M${x + b},${y + b}h${e - x}v1h-${e - x}z`; x = e; } });
    const svg = mk('svg', { viewBox: `0 0 ${n} ${n}`, 'shape-rendering': 'crispEdges', role: 'img', 'aria-label': 'QR-Code zum Einrichten', class: 'qr-svg' });
    svg.append(mk('rect', { width: n, height: n, fill: '#fff' }), mk('path', { d, fill: '#000' })); return svg;
}
function showRecovery(box, codes, done) {
    const copy = async () => { try { await navigator.clipboard.writeText(codes.join('\n')); toast('Kopiert.'); } catch { toast('Kopieren geht hier nicht. Bitte die Codes markieren und von Hand kopieren.', 'warn'); } };
    fill(box, h('div', { class: 'alert ok' }, 'Die Zwei-Faktor-Anmeldung ist eingeschaltet.'), h('h3', {}, 'Ihre Notfall-Codes'),
        h('p', { class: 'muted' }, 'Falls das Handy fehlt oder kaputt ist, kommen Sie mit einem dieser Codes noch hinein. Jeder gilt nur einmal. Speichern Sie sie jetzt an einem sicheren Ort (zum Beispiel im Passwort-Manager oder ausgedruckt): Sie werden nur dieses eine Mal angezeigt.'),
        h('pre', { class: 'codes', id: 'recovery-codes' }, codes.join('\n')), h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: copy } }, 'Kopieren'), h('button', { class: 'primary', type: 'button', on: { click: done } }, 'Ich habe sie gespeichert')));
}
async function renderSetup2fa(box, done) {
    fill(box, h('p', { class: 'muted' }, 'Wird vorbereitet …'));
    let s; try { s = await api('POST', '/api/2fa/setup'); } catch (e) { fill(box, h('div', { class: 'alert error' }, errText(e))); return; }
    const code = h('input', { id: 's2-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 10, placeholder: '123456', spellcheck: 'false' }), msg = h('div', { class: 'hidden' });
    const confirmIt = async () => { msg.className = 'hidden'; try { const r = await api('POST', '/api/2fa/enable', { code: code.value }); user.twofaEnabled = true; user.mustSetup2fa = false; showRecovery(box, r.recoveryCodes, done); } catch (e) { msg.className = 'alert error'; msg.textContent = errText(e); } };
    code.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); confirmIt(); } });
    fill(box, h('ol', { class: 'steps' },
        h('li', {}, 'Auf dem Handy eine Authenticator-App öffnen (zum Beispiel Google Authenticator, Microsoft Authenticator, Aegis oder 1Password) und diesen QR-Code scannen:', qrSvg(s.qr), h('div', { class: 'muted small' }, 'Scannen geht nicht? Dieses Geheimnis in der App von Hand eintragen: ', h('code', { id: 's2-secret' }, s.secret))),
        h('li', {}, h('label', {}, 'Den 6-stelligen Code, den die App jetzt anzeigt, hier eingeben:', code))), msg,
        h('div', { class: 'row end' }, h('button', { class: 'primary', type: 'button', on: { click: confirmIt } }, 'Bestätigen und einschalten')));
    code.focus();
}
function showSetup2fa() { clearInterval(poll); screens('setup2fa'); renderSetup2fa($('#s2-body'), () => { showApp(); }); }
// Passwort + aktueller Code erneut verlangen, bevor etwas Sicherheitsrelevantes geändert wird
function reauthForm(intro, buttonLabel, onSubmit, danger) {
    const pw = h('input', { type: 'password', autocomplete: 'current-password', id: 'ra-pw' }), code = h('input', { autocomplete: 'one-time-code', id: 'ra-code', maxlength: 40, placeholder: '6-stelliger Code oder Notfall-Code', spellcheck: 'false' }), msg = h('div', { class: 'hidden' });
    const go = async () => { msg.className = 'hidden'; try { await onSubmit({ password: pw.value, code: code.value }); } catch (e) { msg.className = 'alert error'; msg.textContent = errText(e); } };
    return h('div', { class: 'stack' }, h('p', { class: 'muted' }, intro), h('div', { class: 'grid two' }, h('label', {}, 'Passwort', pw), h('label', {}, 'Code', code)), msg, h('div', { class: 'row end' }, h('button', { class: danger ? 'danger' : 'primary', type: 'button', on: { click: go } }, buttonLabel)));
}
const PRIVACY_FIELDS = [
    { key: 'controller', label: 'Verantwortliche Stelle (Name der Firma)', placeholder: 'Hotel Muster AG' },
    { key: 'address', label: 'Adresse', placeholder: 'Musterstrasse 1, 8000 Zürich' },
    { key: 'email', label: 'E-Mail für Datenschutzanfragen', placeholder: 'datenschutz@hotel-muster.ch' },
    { key: 'phone', label: 'Telefon', placeholder: '+41 44 123 45 67' },
    { key: 'dpo', label: 'Datenschutzverantwortliche Person (falls vorhanden)', placeholder: 'Name, Funktion' },
    { key: 'extra', label: 'Ergänzende Angaben (erscheinen am Ende der Erklärung)', type: 'textarea', rows: 6, hint: 'Zum Beispiel: Wird für die KI ein externer Dienst genutzt, hier den Dienst nennen. Leerzeilen trennen Absätze.' }];
async function renderSecurity(root) {
    const [tf, users, set] = await Promise.all([api('GET', '/api/2fa'), api('GET', '/api/users'), api('GET', '/api/settings')]);
    const body = h('div', { class: 'stack' }), own = h('div', { class: 'card stack' }, h('h3', {}, 'Zwei-Faktor-Anmeldung (Ihr Konto)'), body);
    if (user.source !== 'local') fill(body, h('p', { class: 'muted' }, 'Dieses Konto wird in AuraDirect verwaltet. Die Zwei-Faktor-Anmeldung stellen Sie dort ein; AuraCall fragt bei der Anmeldung AuraDirect.'));
    else if (tf.enabled) {
        const area = h('div', {});
        fill(body, h('div', { class: 'alert ok' }, `Eingeschaltet. Notfall-Codes übrig: ${tf.recoveryLeft}.`), h('div', { class: 'row' },
            h('button', { type: 'button', on: { click: () => fill(area, reauthForm('Neue Notfall-Codes erzeugen (die bisherigen werden ungültig). Bitte Passwort und einen aktuellen Code bestätigen:', 'Neue Codes erzeugen', async (v) => { const r = await api('POST', '/api/2fa/recovery', v); showRecovery(area, r.recoveryCodes, () => load()); })) } }, 'Neue Notfall-Codes'),
            h('button', { class: 'danger', type: 'button', on: { click: () => fill(area, reauthForm('Zwei-Faktor-Anmeldung ausschalten. Bitte Passwort und einen aktuellen Code bestätigen:', 'Ausschalten', async (v) => { await api('POST', '/api/2fa/disable', v); user.twofaEnabled = false; toast('Zwei-Faktor-Anmeldung ausgeschaltet.'); load(); }, true)) } }, 'Ausschalten')), area);
    } else fill(body, h('p', { class: 'muted' }, 'Nicht eingeschaltet. Mit der Zwei-Faktor-Anmeldung reicht ein gestohlenes Passwort allein nicht mehr aus.'), h('div', { class: 'row' }, h('button', { class: 'primary', type: 'button', on: { click: () => renderSetup2fa(body, () => load()) } }, 'Einrichten')));
    const rows = users.items.map(u => h('tr', {}, h('td', {}, u.username, u.displayName ? h('div', { class: 'muted small' }, u.displayName) : null), h('td', {}, u.source === 'local' ? 'lokal' : 'AuraDirect'), h('td', {}, u.source === 'local' ? (u.twofaEnabled ? 'ja' : 'nein') : 'in AuraDirect'), h('td', {}, fmtTime(u.lastLoginAt)),
        h('td', {}, h('div', { class: 'row' },
            u.source === 'local' && u.twofaEnabled && u.username !== user.username ? h('button', { type: 'button', on: { click: async () => { if (!confirm(`Zwei-Faktor-Anmeldung von "${u.username}" zurücksetzen? Die Person richtet sie bei der nächsten Anmeldung neu ein.`)) return; try { await api('POST', `/api/users/${u.id}/2fa/reset`); toast('Zurückgesetzt.'); load(); } catch (e) { toast(errText(e), 'error'); } } } }, '2FA zurücksetzen') : null,
            u.username !== user.username ? h('button', { class: 'danger', type: 'button', on: { click: async () => { if (!confirm(`Konto "${u.username}" aus AuraCall entfernen? Alle seine Anmeldungen enden.`)) return; try { await api('DELETE', `/api/users/${u.id}`); toast('Entfernt.'); load(); } catch (e) { toast(errText(e), 'error'); } } } }, 'Entfernen') : null))));
    const accounts = h('div', { class: 'card stack' }, h('h3', {}, 'Konten'), h('p', { class: 'muted' }, 'Wer sich anmelden darf. Den Zugriff einer Person aus AuraDirect entziehen Sie in AuraDirect; „Entfernen“ löscht hier nur das Konto und beendet seine Anmeldungen (es wird bei der nächsten erlaubten Anmeldung neu angelegt).'),
        h('table', {}, h('thead', {}, h('tr', {}, ['Konto', 'Herkunft', '2FA', 'Letzte Anmeldung', ''].map(x => h('th', {}, x)))), h('tbody', {}, rows)));
    const adF = form([{ key: 'enabled', type: 'checkbox', label: 'Anmeldung über AuraDirect erlauben' }, { key: 'url', label: 'Adresse von AuraDirect', placeholder: 'http://192.168.1.10:4000', hint: 'So wie Sie AuraDirect im Browser öffnen, ohne Pfad.' }, { key: 'serviceKey', type: 'password', label: 'Dienst-Schlüssel', hint: 'Steht in AuraDirect oben auf der Benutzerseite. Leer lassen = bisherigen behalten.' }], set.auradirect);
    if (set.auradirect.hasKey) $('#f-serviceKey', adF.els[2]).placeholder = '•••••••• (gespeichert)';
    const adMsg = h('div', { class: 'hidden' });
    const saveAd = async (test) => { adMsg.className = 'hidden'; try { await api('PUT', '/api/settings/auradirect', adF.values()); if (test) { adMsg.className = 'alert warn'; adMsg.textContent = 'Teste die Verbindung …'; const r = await api('POST', '/api/auradirect/test'); adMsg.className = 'alert ' + (r.ok ? 'ok' : 'error'); adMsg.textContent = r.message; } else toast('Gespeichert.'); } catch (e) { adMsg.className = 'alert error'; adMsg.textContent = errText(e); } };
    const directory = h('div', { class: 'card stack' }, h('h3', {}, 'AuraDirect (zentrale Benutzerverwaltung)'), h('p', { class: 'muted' }, 'Damit melden sich Personen mit ihrem AuraDirect-Konto an. In AuraDirect muss bei der Person „AuraCall“ aktiviert sein. Das Konto „admin“ bleibt immer lokal (Notzugang, funktioniert auch ohne AuraDirect).'), h('div', { class: 'grid two' }, adF.els), adMsg,
        h('div', { class: 'row end' }, h('button', { type: 'button', on: { click: () => saveAd(false) } }, 'Speichern'), h('button', { class: 'primary', type: 'button', on: { click: () => saveAd(true) } }, 'Speichern und testen')));
    const privacy = saveCard('Datenschutzerklärung', 'privacy', PRIVACY_FIELDS, set.privacy, 'Die Erklärung entsteht aus diesen Angaben und den Einstellungen von AuraCall (Aufbewahrung, Textspeicherung). Sie ist eine Vorlage: bitte prüfen und mit Ihrer Rechtsberatung abstimmen.');
    privacy.append(h('div', { class: 'row' }, h('a', { href: '/datenschutz?lang=de', target: '_blank', rel: 'noopener' }, 'Erklärung ansehen (Deutsch)'), h('a', { href: '/datenschutz?lang=en', target: '_blank', rel: 'noopener' }, 'View policy (English)')));
    fill(root, own,
        saveCard('Pflicht für alle', 'security', [{ key: 'twofaRequired', type: 'checkbox', label: 'Zwei-Faktor-Anmeldung für alle lokalen Konten vorschreiben', hint: 'Wer sie noch nicht hat, richtet sie beim nächsten Seitenaufruf ein (Sie selbst auch). Konten aus AuraDirect nutzen die Zwei-Faktor-Anmeldung von AuraDirect.' }], set.security),
        accounts, directory, privacy);
}

// ---- Lizenz ----
let licenseInfo = null;
const daysText = (n) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
function paintBanner() {
    const b = $('#license-banner'), l = licenseInfo; let msg = '', kind = 'warn';
    if (l && l.state === 'expired') { msg = 'Keine gültige Lizenz: Aura nimmt keine Anrufe an und wählt nicht. Die Lizenz wird zentral in AuraControl eingetragen und kommt automatisch hierher.'; kind = 'error'; }
    else if (l && l.state === 'trial') msg = `Testzeit: noch ${daysText(l.trialDaysRemaining)}. Danach braucht AuraCall eine Lizenz (Business Solo oder Business Advanced, in AuraControl eingetragen).`;
    else if (l && l.expiresSoon) msg = `Die Lizenz läuft in ${l.daysLeft} ${l.daysLeft === 1 ? 'Tag' : 'Tagen'} ab. Bitte rechtzeitig erneuern (in AuraControl).`;   // "in 5 Tagen" (Dativ), anders als "noch 5 Tage"
    b.className = msg ? 'banner alert ' + kind : 'banner hidden'; b.textContent = msg;
}
async function refreshLicense() { try { licenseInfo = await api('GET', '/api/license'); } catch { licenseInfo = null; } paintBanner(); }
async function renderLicense(root) {
    const l = await api('GET', '/api/license'); licenseInfo = l; paintBanner();
    const dt = (iso) => iso ? new Date(iso).toLocaleDateString('de-CH') : 'unbefristet';
    const status = l.state === 'licensed' ? h('div', { class: 'alert ok' }, `Lizenziert für ${l.customer || 'unbekannt'}. Gültig bis: ${dt(l.expiresAt)}${l.expiresSoon ? ` (noch ${daysText(l.daysLeft)})` : ''}.`)
        : l.state === 'trial' ? h('div', { class: 'alert warn' }, `Testzeit: noch ${daysText(l.trialDaysRemaining)}. Danach braucht AuraCall eine Lizenz (Business Solo oder Business Advanced), sonst nimmt Aura keine Anrufe mehr an.`)
        : h('div', { class: 'alert error' }, `${l.message} Aura nimmt derzeit keine Anrufe an und wählt nicht.`);
    const sy = l.sync || {}, lr = sy.lastResult;
    const syncText = !sy.enabled ? 'Abholen bei AuraControl ist abgeschaltet (LICENSE_SYNC_URL).' : !lr ? 'Wird kurz nach dem Start bei AuraControl abgeholt, danach alle 15 Minuten.' : (lr.ok ? `Zuletzt bei AuraControl abgeholt: ${fmtTime(Date.parse(lr.at))}.` : `AuraControl: ${lr.message || 'Fehler'} (${fmtTime(Date.parse(lr.at))}).`);
    const ck = l.checkin || {}, last = ck.lastResult;
    const checkin = h('p', { class: 'muted' }, last ? (last.success ? `Zuletzt erfolgreich: ${fmtTime(Date.parse(last.at))}.` : `Zuletzt fehlgeschlagen (${fmtTime(Date.parse(last.at))}): ${last.message}`) : 'Noch keine Rückmeldung seit dem Start (die erste folgt kurz nach dem Start).');
    fill(root,
        h('div', { class: 'card stack' }, h('h3', {}, 'Lizenz'), status, l.keyError && l.state !== 'licensed' ? h('div', { class: 'alert error' }, 'Hinterlegter Schlüssel: ' + l.keyError) : null,
            l.plan ? h('p', {}, (l.plan === 'advanced' ? 'Business Advanced' : l.plan === 'solo' ? 'Business Solo' : 'Aura-Suite') + ' · gilt für alle Aura-Produkte') : null,
            h('p', { class: 'muted' }, 'Die Lizenz der Aura-Suite wird zentral in AuraControl eingetragen (Admin Panel → Lizenz). AuraControl prüft sie beim Lizenzserver und überträgt sie automatisch hierher. Hier ist nichts einzutragen.'),
            h('p', { class: 'muted small' }, syncText)),
        h('div', { class: 'card stack' }, h('h3', {}, 'Rückmeldung beim Lizenzserver'), checkin, h('p', { class: 'muted small' }, 'Alle 12 Stunden werden nur der Lizenzschlüssel, eine zufällige Installationskennung, die Programmversion und die Zahl der Konten gesendet. Nie Anrufe, Rufnummern oder Gespräche.')));
}

const RENDER = { overview: renderOverview, calls: renderCalls, out: renderOut, trunk: renderTrunk, aura: renderAura, security: renderSecurity, license: renderLicense, settings: renderSettings };
async function load() { const root = $('#tab-' + current); try { await RENDER[current](root); } catch (e) { if (e.status === 401) return showLogin(); if (e.status === 403 && e.data && e.data.mustChange) return showPw(); if (e.status === 403 && e.data && e.data.mustSetup2fa) return showSetup2fa(); if (e.status === 402 && e.data && e.data.licenseRequired && current !== 'license') { refreshLicense(); return show('license'); } fill(root, h('div', { class: 'alert error' }, e.message)); } }
function show(tab) {
    current = tab; clearInterval(poll); if (groupOf(tab) !== tabsGroup) renderTabs(groupOf(tab));
    for (const [id] of TABS) $('#tab-' + id).classList.toggle('hidden', id !== tab);
    for (const b of $('#tabs').children) b.classList.toggle('active', b.dataset.tab === tab);
    refreshLicense(); load(); if (tab === 'overview') poll = setInterval(() => { if (!document.hidden) load(); }, 5000);
}
function screens(name) { for (const s of ['login', 'login2fa', 'pwchange', 'setup2fa', 'app']) $('#' + s).classList.toggle('hidden', s !== name); }
let loginStep2 = false, pendingLogin = null;   // zweiter Schritt der Anmeldung (Code) aktiv? Benutzername und Passwort nur für diesen Schritt im Speicher
function loginReset() { loginStep2 = false; pendingLogin = null; $('#login-code').value = ''; $('#login2fa-error').classList.add('hidden'); }
function showLogin() { clearInterval(poll); loginReset(); screens('login'); $('#login-pass').value = ''; $('#login-user').focus(); }
function afterLogin() { $('#login-pass').value = ''; loginReset(); if (user.mustChange) { $('#pw-old').value = ''; showPw(); } else if (user.mustSetup2fa) showSetup2fa(); else showApp(); }
function showPw(first = true) { clearInterval(poll); screens('pwchange'); $('#pw-intro').classList.toggle('hidden', !first); $('#pw-old').focus(); }
function showApp() {
    screens('app'); $('#who').textContent = user.username; show(current);
    // Datenschutzerklärung beim ersten Login (und nach jeder Änderung des Textes) bestätigen
    if (window.AuraPrivacy) window.AuraPrivacy.check({ headers: { 'X-Requested-With': 'AuraCall' }, onLogout: () => { if (window.AuraAppMenu && window.AuraAppMenu.logout) window.AuraAppMenu.logout(); } });
}

async function boot() {
    renderTabs('main');
    $('#modal-close').addEventListener('click', closeModal); $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    async function doLogout() { try { await api('POST', '/api/logout'); } catch { /* egal */ } user = null; showLogin(); }
    window.AuraAppMenu = { logout: doLogout, settings: () => show('trunk'), admin: { license: () => show('license'), security: () => show('security') } };
    if (window.AuraMenuCtl) window.AuraMenuCtl.refresh();
    // Anmeldung wie in allen Aura-Produkten: Schritt 1 Benutzername und Passwort, Schritt 2 (nur mit Zwei-Faktor) ein EIGENES Fenster für den Code
    $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const err = $('#login-error'); err.classList.add('hidden');
        try {
            const creds = { username: $('#login-user').value, password: $('#login-pass').value };
            const r = await api('POST', '/api/login', creds);
            if (r.requires2fa) { loginStep2 = true; pendingLogin = creds; $('#login-code').value = ''; $('#login2fa-error').classList.add('hidden'); screens('login2fa'); $('#login-code').focus(); return; }
            user = r.user; afterLogin(); if (r.usedRecovery !== undefined) toast(`Notfall-Code verwendet. Noch ${r.usedRecovery} übrig. Bitte bald neue erzeugen (Sicherheit).`, 'warn');
        } catch (x) { err.textContent = x.message; err.classList.remove('hidden'); }
    });
    $('#login2fa-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const err = $('#login2fa-error'); err.classList.add('hidden'); if (!pendingLogin) { showLogin(); return; }
        try {
            const r = await api('POST', '/api/login', { ...pendingLogin, code: $('#login-code').value.trim() });
            user = r.user; afterLogin(); if (r.usedRecovery !== undefined) toast(`Notfall-Code verwendet. Noch ${r.usedRecovery} übrig. Bitte bald neue erzeugen (Sicherheit).`, 'warn');
        } catch (x) { err.textContent = x.message; err.classList.remove('hidden'); $('#login-code').value = ''; $('#login-code').focus(); }
    });
    $('#login-back').addEventListener('click', () => { loginReset(); screens('login'); $('#login-pass').value = ''; $('#login-pass').focus(); });
    $('#s2-logout').addEventListener('click', async () => { try { await api('POST', '/api/logout'); } catch { /* egal */ } user = null; showLogin(); });
    $('#pw-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const err = $('#pw-error'); err.classList.add('hidden');
        if ($('#pw-new').value !== $('#pw-new2').value) { err.textContent = 'Die beiden neuen Passwörter sind nicht gleich.'; err.classList.remove('hidden'); return; }
        try { await api('POST', '/api/password', { oldPassword: $('#pw-old').value, newPassword: $('#pw-new').value }); for (const i of ['#pw-old', '#pw-new', '#pw-new2']) $(i).value = ''; user.mustChange = false; if (user.mustSetup2fa) showSetup2fa(); else showApp(); toast('Passwort geändert.'); }
        catch (x) { err.textContent = x.message; err.classList.remove('hidden'); }
    });
    try { const me = await api('GET', '/api/me'); user = me.user; if (user.mustChange) showPw(); else if (user.mustSetup2fa) showSetup2fa(); else showApp(); } catch { showLogin(); }
}
boot();
})();
