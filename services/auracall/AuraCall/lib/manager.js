'use strict';
/* AuraCall - die Schaltzentrale: verbindet Asterisk (AMI + AudioSocket), die Datenbank, AuraChat und die Gespräche.
 * Hier stehen auch alle Sicherungen für ausgehende Anrufe (sie kosten Geld und sind ein klassisches Ziel für Missbrauch). */
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { CallSession } = require('./call-session');
const { AuraClient, AuraError } = require('./aura-client');
const phone = require('./phone');
const ast = require('./asterisk-config');
const S = require('./settings');
const { sha256 } = require('./db');
const A = require('./audio');
const { buildPrompt } = require('./prompt');

class ManagerError extends Error { constructor(code, message) { super(message); this.code = code; } }
const TEMPORARY = new Set(['HOURS', 'LIMIT', 'NOT_READY', 'BUSY']);   // Gründe, bei denen ein geplanter Anruf später noch einmal versucht wird
// Bedeutung der Zahl in "OriginateResponse" (Asterisk-Steuerzeichen; Beste Annahme, unbekannte Zahlen werden mit ihrem Code gezeigt)
const REASONS = { 0: 'Verbindung nicht zustande gekommen', 1: 'Gegenstelle hat aufgelegt', 3: 'keine Antwort', 4: 'angenommen', 5: 'besetzt', 8: 'Leitung überlastet oder Nummer nicht erreichbar' };
const trunkName = 'auracall-trunk';

class Manager extends EventEmitter {
    constructor({ db, ami, audio, confDir, audioHost = '127.0.0.1', audioPort = 9092, audioRate = 8000, now = () => Date.now(), logger = console.log, makeClient, sessionOverrides = {}, timing = {}, licenseOk = () => true, licenseText = () => '' } = {}) {
        super();
        this.db = db; this.ami = ami; this.audio = audio; this.confDir = confDir; this.audioHost = audioHost; this.audioPort = audioPort; this.audioRate = audioRate;
        this.licenseOk = licenseOk; this.licenseText = licenseText;
        this.now = now; this.log = logger; this.makeClient = makeClient || ((o) => new AuraClient(o)); this.sessionOverrides = sessionOverrides;
        this.t = { regPollMs: 30000, schedulerMs: 15000, retentionMs: 3600000, metaWaitMs: 1200, originateTimeoutMs: 45000, connectGraceMs: 15000, scheduledGraceMs: 2 * 3600000, warmCheckMs: 30000, warmStartMs: 20000, warmAfterSaveMs: 2500, ...timing };
        this.sessions = new Map(); this.meta = new Map(); this.pendingOut = new Map(); this.cache = new Map(); this.timers = []; this.clientCache = null;
        this.reg = { state: 'unbekannt', at: 0 }; this.lastCheck = null; this.warm = null; this.warmTimer = null; this.outboundTimes = []; this.needsReload = false;
    }

    // ---------- Einstellungen ----------
    settings() {
        const g = (k) => ({ ...S.DEFAULTS[k], ...(this.db.getSetting(k, {}) || {}) });
        return { general: g('general'), limits: g('limits'), audio: g('audio'), aurachat: g('aurachat'), security: g('security'), auradirect: g('auradirect'), privacy: g('privacy'), trunk: this.db.getSetting('trunk', null) || ast.validateTrunk({}).value };
    }
    publicSettings() {
        const s = this.settings(), t = { ...s.trunk }; const hasPw = !!t.password; delete t.password;
        return { general: s.general, limits: s.limits, audio: s.audio, aurachat: S.maskAurachat(s.aurachat), security: s.security, auradirect: S.maskAuradirect(s.auradirect), privacy: s.privacy, trunk: { ...t, hasPassword: hasPw }, hasServiceKey: !!this.db.getSetting('serviceKeyHash', null), defaults: { greetingIn: require('./call-session').DEFAULTS.greetingIn, greetingOut: require('./call-session').DEFAULTS.greetingOut } };
    }
    // section: general | limits | audio | aurachat | trunk
    saveSettings(section, input, user = '') {
        const cur = this.settings(); let r;
        if (section === 'general') r = S.validateGeneral(input, cur.general);
        else if (section === 'limits') r = S.validateLimits(input, cur.limits);
        else if (section === 'audio') r = S.validateAudio(input, cur.audio);
        else if (section === 'aurachat') r = S.validateAurachat(input, cur.aurachat);
        else if (section === 'security') r = S.validateSecurity(input, cur.security);
        else if (section === 'auradirect') r = S.validateAuradirect(input, cur.auradirect);
        else if (section === 'privacy') r = S.validatePrivacy(input, cur.privacy);
        else if (section === 'trunk') {
            // Wie bei allen Bereichen: neue Angaben mit den bestehenden mischen. Abgeleitete Felder (Absender = Benutzer bzw. Server) nicht festhalten, sonst blieben sie bei einer Änderung von Benutzer oder Server veraltet.
            const base = { ...cur.trunk }; if (base.fromUser === base.username) delete base.fromUser; if (base.fromDomain === base.host) delete base.fromDomain; delete base.password;
            r = ast.validateTrunk({ ...base, ...input }, { keepPassword: cur.trunk.password });
        }
        else throw new ManagerError('SECTION', 'Unbekannter Bereich.');
        if (!r.ok) return r;
        this.db.setSetting(section, r.value);
        if (['general', 'audio', 'aurachat'].includes(section)) { this.cache.clear(); this.scheduleWarmUp(this.t.warmAfterSaveMs); }   // andere Texte/Stimme/Modell: die gemerkten Sätze und der Modell-Anfang passen nicht mehr; gleich neu vorbereiten   // gemerkte Sprachausgabe passt evtl. nicht mehr (Sprache, Lautstärke)
        this.clientCache = null;
        if (section === 'trunk') { this.reg = { state: 'unbekannt', at: 0 }; this.pollRegistration().catch(() => {}); }   // Zustand sofort neu abfragen (sonst gälte bis zum nächsten Abgleich der alte)
        this.db.audit(user, 'settings:' + section, section === 'aurachat' ? `Adresse ${r.value.url}` : section === 'auradirect' ? `${r.value.enabled ? 'an' : 'aus'}, Adresse ${r.value.url}` : section === 'security' ? `2FA für alle ${r.value.twofaRequired ? 'vorgeschrieben' : 'nicht vorgeschrieben'}` : section === 'trunk' ? `Leitung ${r.value.host}${r.value.enabled ? '' : ' (aus)'}` : Object.keys(input).join(', '));
        return r;
    }
    aura() {
        const a = this.settings().aurachat; const k = `${a.url}|${a.apiKey}|${a.model}`;
        if (this.clientCache && this.clientCache.k === k) return this.clientCache.c;
        const c = this.makeClient({ baseUrl: a.url, apiKey: a.apiKey, model: a.model }); this.clientCache = { k, c }; return c;
    }
    async checkAurachat() { let res; try { res = await this.aura().check(); } catch (e) { res = { ok: false, error: { code: e.code || 'ERROR', message: e.message } }; } this.lastCheck = { ...res, at: this.now() }; return this.lastCheck; }

    // ---------- Dienst-Schlüssel (für Aufrufe von aussen, z.B. aus AuraChat) ----------
    rotateServiceKey(user = '') { const key = 'acs_' + crypto.randomBytes(24).toString('base64url'); this.db.setSetting('serviceKeyHash', sha256(key)); this.db.setSetting('serviceKeyAt', this.now()); this.db.audit(user, 'service-key', 'neu erzeugt'); return key; }
    serviceKeyCheck(token) { const h = this.db.getSetting('serviceKeyHash', null); if (!h || typeof token !== 'string' || token.length > 200) return false; const a = Buffer.from(sha256(token)), b = Buffer.from(h); return a.length === b.length && crypto.timingSafeEqual(a, b); }

    // ---------- Leitung anwenden ----------
    trunkFiles() {
        const t = this.settings().trunk, v = ast.validateTrunk(t);
        if (!v.ok) return { v, files: null };
        // Ausgeschaltete Leitung: leere PJSIP-Datei (damit Asterisk den alten Eintrag wirklich entfernt), der Dialplan bleibt (harmlos)
        const files = v.value.enabled ? ast.renderAll(v.value, { audioHost: this.audioHost, audioPort: this.audioPort })
            : { 'pjsip_auracall.conf': '; AuraCall: Leitung ausgeschaltet - keine Einträge.\n', 'extensions_auracall.conf': ast.renderDialplan(v.value, { audioHost: this.audioHost, audioPort: this.audioPort }) };
        return { v, files };
    }
    filesHash(files) { return files ? sha256(Object.keys(files).sort().map(k => k + files[k]).join('\n')) : ''; }
    async applyTrunk(user = '') {
        const { v, files } = this.trunkFiles(); if (!v.ok) throw new ManagerError('INVALID', 'Die Leitungs-Einstellungen sind nicht gültig: ' + v.errors.join(' '));
        ast.writeFiles(this.confDir, files); this.db.setSetting('trunkAppliedHash', this.filesHash(files));
        let reloaded = false, note = '';
        if (this.ami.connected) { try { await this.ami.reload(); reloaded = true; this.needsReload = false; } catch (e) { note = 'Dateien geschrieben, aber Asterisk konnte nicht neu laden: ' + e.message; this.needsReload = true; } }
        else { note = 'Dateien geschrieben. Asterisk ist gerade nicht verbunden und liest sie beim nächsten Start oder Neuladen.'; this.needsReload = true; }
        this.db.audit(user, 'trunk:apply', reloaded ? 'geschrieben und neu geladen' : note);
        if (reloaded) setTimeout(() => this.pollRegistration().catch(() => {}), 3000).unref();
        return { ok: true, files: Object.keys(files), reloaded, note };
    }
    trunkPending() {
        const { files } = this.trunkFiles(), applied = this.db.getSetting('trunkAppliedHash', '');
        if (!files || (!applied && !this.settings().trunk.enabled)) return false;   // nie eingerichtet und aus: nichts auszustehen
        return this.filesHash(files) !== applied;
    }
    // Abfrage des Anmeldezustands; läuft eine, kann ein Anruf-Auslöser darauf warten (siehe placeCall)
    pollRegistration() { const p = this._pollRegistration().finally(() => { if (this.regPoll === p) this.regPoll = null; }); this.regPoll = p; return p; }
    async _pollRegistration() {
        const t = this.settings().trunk;
        if (!t.enabled) { this.reg = { state: 'aus', at: this.now() }; return this.reg; }
        if (!t.register) { this.reg = { state: 'keine Anmeldung nötig', at: this.now() }; return this.reg; }
        if (!this.ami.connected) { this.reg = { state: 'unbekannt', at: this.now(), note: 'Asterisk nicht verbunden' }; return this.reg; }
        try { const regs = await this.ami.registrations(); const r = regs.find(x => x.name === 'auracall-reg'); this.reg = { state: r ? r.status : 'nicht geladen', at: this.now() }; }
        catch (e) { this.reg = { state: 'unbekannt', at: this.now(), note: e.message }; }
        return this.reg;
    }
    trunkReady() { const t = this.settings().trunk; if (!t.enabled) return 'Die Leitung ist nicht eingeschaltet.'; if (!this.ami.connected) return 'Asterisk ist nicht verbunden.'; if (t.register && this.reg.state !== 'Registered') return `Die Leitung ist nicht angemeldet (Zustand: ${this.reg.state}).`; return null; }

    // ---------- Status ----------
    activeCalls() { const out = []; for (const [uuid, s] of this.sessions) out.push({ id: s.callId, uuid, direction: s.direction, number: s.number, state: s.session.state, durationMs: this.now() - s.startedAt, turns: s.session.turns }); for (const [uuid, p] of this.pendingOut) out.push({ id: p.callId, uuid, direction: 'out', number: p.e164, state: 'dialing', durationMs: this.now() - p.startedAt, turns: 0 }); return out; }
    status() {
        const s = this.settings(), since = this.now() - 86400000;
        return {
            asterisk: { connected: !!this.ami.connected, version: this.ami.version || null, problem: this.ami.connected ? null : (this.ami.lastProblem || null) },
            trunk: { enabled: !!s.trunk.enabled, host: s.trunk.host || '', registration: this.reg, pending: this.trunkPending(), ready: this.trunkReady() === null },
            aurachat: { configured: !!(s.aurachat.url && s.aurachat.apiKey), lastCheck: this.lastCheck, model: s.aurachat.model || '', warmup: this.warm },
            audioSocket: { port: this.audioPort, active: this.audio ? this.audio.conns.size : 0 },
            calls: { active: this.activeCalls(), last24h: { in: this.db.countCallsSince(since, 'in'), out: this.db.countCallsSince(since, 'out') } },
            limits: { maxConcurrent: s.limits.maxConcurrent, outboundEnabled: s.limits.outboundEnabled, outboundPerDay: s.limits.outboundPerDay }
        };
    }

    // ---------- Aufwärmen ----------
    // Zwei Dinge, die den ERSTEN Anruf nach einer Pause sonst Sekunden kosten:
    //  1. Das KI-Modell: Ollama merkt sich den Anfang des langen Textes (Regeln + Wissen) und liest ihn nicht neu, solange Anfragen mit demselben Anfang kommen.
    //     Eine winzige Anfrage (1 Wort Antwort) alle paar Minuten hält ihn im Speicher.
    //  2. Die festen Sätze (Begrüssung, "nicht verstanden", "Einen Moment bitte" ...): im Voraus sprechen lassen und merken.
    scheduleWarmUp(ms) { clearTimeout(this.warmTimer); this.warmTimer = setTimeout(() => this.warmUp({ speech: true }).catch(() => {}), ms); this.warmTimer.unref(); }
    warmEnabled() { const s = this.settings(); return !!(s.aurachat.url && s.aurachat.apiKey && s.trunk.enabled); }
    async warmTick() {   // regelmässig: nur wenn gerade kein Gespräch läuft und der letzte Anlauf lange genug her ist
        const s = this.settings(), every = (s.aurachat.warmupMin || 0) * 60000;
        if (!every || !this.warmEnabled() || this.sessions.size || this.pendingOut.size) return;
        if (this.warm && this.now() - this.warm.at < every) return;
        await this.warmUp({ speech: false });
    }
    async warmUp({ speech = false } = {}) {
        if (!this.warmEnabled() || this.warming) return this.warm; this.warming = true;
        const s = this.settings(), t0 = Date.now(); let aura; const res = { at: this.now(), ok: true, ms: 0, error: null, phrases: 0 };
        try {
            aura = this.aura();
            const { DEFAULTS } = require('./call-session'), sess = this._sessionSettings();
            // 1) Modell: gleiche Form wie eine echte Antwort (gleicher Anfang), aber höchstens 1 Wort Antwort
            const prompt = buildPrompt({ company: sess.company, knowledge: sess.knowledge, history: [], userText: 'Hallo', direction: 'in', lang: sess.lang });
            await aura.chatStream(prompt, { maxTokens: 1, onSentence() {} });
            // 2) feste Sätze vorbereiten (nur nach Änderungen und beim Start, nicht alle paar Minuten)
            if (speech) {
                // GENAU die Texte, die ein Gespräch später spricht (gleiche Ersetzung der Firma, gleicher Speicher-Hinweis), sonst würden sie nie wiederverwendet
                const note = sess.storeTranscripts ? ' ' + DEFAULTS.transcriptNotice : '', fillCo = (t) => String(t).replace(/\{company\}/g, sess.company);
                const texts = [fillCo(sess.greetingIn) + note, fillCo(sess.greetingOut) + note, ...Object.values({ ...DEFAULTS.phrases })];
                for (const text of texts) {
                    const key = `${sess.lang}|${text}`; if (this.cache.has(key)) continue;
                    const r = await aura.synthesize(text, { lang: sess.lang }); let pcm = A.resample(r.pcm, r.rate, sess.rate); if (sess.gain !== 1) pcm = A.gain(pcm, sess.gain);
                    if (!this.cache.has(key)) this.cache.set(key, Promise.resolve(pcm)); res.phrases++;
                }
            }
        } catch (e) { res.ok = false; res.error = e.message; this.log('Aufwärmen fehlgeschlagen: ' + e.message); }
        res.ms = Date.now() - t0; this.warm = res; this.warming = false; return res;
    }

    // ---------- Start/Stop ----------
    start() {
        this.db.markStaleCalls(this.now()); this.db.purgeSessions(this.now());
        this.ami.on('userevent', (name, e) => this._onUserEvent(name, e));
        this.ami.on('event', (e) => { if (e.Event === 'OriginateResponse' && e.ActionID) this._onOriginateResponse(e); });
        this.ami.on('connected', async () => { this.log('Asterisk verbunden' + (this.ami.version ? ' (Version ' + this.ami.version + ')' : '')); if (this.needsReload) { try { await this.ami.reload(); this.needsReload = false; } catch { /* beim nächsten Mal */ } } await this.pollRegistration(); });
        this.ami.on('disconnected', () => this.log('Asterisk getrennt'));
        this.ami.on('problem', (m) => this.log('Asterisk: ' + m));
        this.audio.on('connection', (c) => this._onConnection(c).catch((e) => { this.log('Fehler bei neuem Anruf: ' + e.message); try { c.close(); } catch { /* weg */ } }));
        this.audio.on('problem', (m) => this.log('AudioSocket: ' + m));
        const every = (ms, fn) => { const t = setInterval(() => { Promise.resolve().then(fn).catch((e) => this.log('Fehler (Zeitgeber): ' + e.message)); }, ms); t.unref(); this.timers.push(t); };
        every(this.t.warmCheckMs, () => this.warmTick());
        this.scheduleWarmUp(this.t.warmStartMs);
        every(this.t.regPollMs, () => this.pollRegistration()); every(this.t.schedulerMs, () => this.runScheduler()); every(this.t.retentionMs, () => this.retention());
        this.retention();
        // beim Start die Leitungsdateien bereitstellen (damit ein später gestartetes Asterisk sie findet); neu laden erst, wenn Asterisk verbunden ist
        try { const { files } = this.trunkFiles(); if (files && this.settings().trunk.enabled && this.filesHash(files) !== this.db.getSetting('trunkAppliedHash', '')) { ast.writeFiles(this.confDir, files); this.db.setSetting('trunkAppliedHash', this.filesHash(files)); this.needsReload = true; } } catch (e) { this.log('Leitungsdateien konnten nicht geschrieben werden: ' + e.message); }
    }
    stop() { for (const t of this.timers) clearInterval(t); this.timers = []; clearTimeout(this.warmTimer); for (const p of this.pendingOut.values()) clearTimeout(p.timer); for (const { session } of this.sessions.values()) session.hangup('shutdown').catch(() => {}); }
    retention() { const days = this.settings().general.retentionDays; const n = this.db.purgeCalls(this.now() - days * 86400000); this.db.purgeSessions(this.now()); for (const [k, v] of this.meta) if (this.now() - v.at > 120000) this.meta.delete(k); return n; }

    // ---------- Eingehend und Verbindung von Asterisk ----------
    _onUserEvent(name, e) {
        const uuid = String(e.Uuid || '').toLowerCase(); if (!uuid) return;
        if (name === 'AuraCallIn') this.meta.set(uuid, { caller: phone.normalizeCaller(e.Caller, this.settings().trunk.defaultCountryCode), did: String(e.Did || '').slice(0, 30), channel: String(e.Channel || '').slice(0, 100), at: this.now() });
        else if (name === 'AuraCallOut') { const p = this.pendingOut.get(uuid); if (p) p.channel = String(e.Channel || '').slice(0, 100); }
    }
    _sessionSettings() {
        const s = this.settings(), { DEFAULTS } = require('./call-session'), preset = S.SENSITIVITY[s.audio.sensitivity] || S.SENSITIVITY.normal;
        return { company: s.general.company || DEFAULTS.company, lang: s.general.lang, knowledge: s.general.knowledge, storeTranscripts: s.general.storeTranscripts, greetingIn: s.general.greetingIn || DEFAULTS.greetingIn, greetingOut: s.general.greetingOut || DEFAULTS.greetingOut,
            gain: s.audio.gain, idlePromptMs: s.audio.idlePromptSec * 1000, maxCallMs: s.audio.maxCallMin * 60000, rate: this.audioRate, vad: { minRms: preset.minRms, endSilenceMs: preset.endSilenceMs }, ...this.sessionOverrides };
    }
    async _onConnection(conn) {
        const uuid = conn.uuid.toLowerCase(); let pending = this.pendingOut.get(uuid), meta = this.meta.get(uuid);
        if (!pending && !meta) { const until = this.now() + this.t.metaWaitMs; while (!meta && this.now() < until && !conn.closed) { await new Promise(r => setTimeout(r, 40)); meta = this.meta.get(uuid); } }   // die Angaben zum Anruf (UserEvent) können knapp nach der Verbindung eintreffen
        if (conn.closed) { if (pending) this._failPending(uuid, 'Anruf wurde sofort beendet'); return; }
        const lim = this.settings().limits;
        // Ohne gültige Lizenz nimmt Aura keine Anrufe an und führt keine aus: sofort auflegen und im Anrufprotokoll vermerken
        if (!this.licenseOk()) { this.log('Anruf abgewiesen: keine gültige Lizenz'); this.db.insertCall({ uuid, direction: pending ? 'out' : 'in', number: pending ? pending.e164 : (meta ? meta.caller : 'unbekannt'), did: meta && meta.did, startedAt: this.now(), outcome: pending ? 'error:license' : 'rejected', source: 'license', error: 'Keine gültige Lizenz' }); this.meta.delete(uuid); conn.hangup(); if (pending) this._failPending(uuid, 'Keine gültige Lizenz', true); return; }
        if (!pending && this.sessions.size >= lim.maxConcurrent) { this.log(`Anruf abgewiesen: schon ${this.sessions.size} Gespräche`); this.db.insertCall({ uuid, direction: 'in', number: meta ? meta.caller : 'unbekannt', did: meta && meta.did, startedAt: this.now(), outcome: 'rejected', source: 'busy' }); this.meta.delete(uuid); conn.hangup(); return; }
        let aura; try { aura = this.aura(); } catch (e) { this.log('AuraChat nicht eingerichtet: ' + e.message); this.db.insertCall({ uuid, direction: pending ? 'out' : 'in', number: pending ? pending.e164 : meta && meta.caller, startedAt: this.now(), outcome: 'error:config', error: e.message }); conn.hangup(); if (pending) this._failPending(uuid, e.message, true); return; }
        const direction = pending ? 'out' : 'in', number = pending ? pending.e164 : (meta ? meta.caller : 'unbekannt'); let callId;
        if (pending) { clearTimeout(pending.timer); callId = pending.callId; this.db.updateCall(callId, { answeredAt: this.now() }); this.pendingOut.delete(uuid); }
        else callId = this.db.insertCall({ uuid, direction: 'in', number, did: meta && meta.did, startedAt: this.now(), answeredAt: this.now(), outcome: 'active' });
        this.meta.delete(uuid);
        const session = new CallSession({ conn, meta: { uuid, direction, caller: number, did: meta && meta.did, purpose: pending && pending.purpose }, settings: this._sessionSettings(), aura, cache: this.cache });
        const rec = { session, callId, direction, number, startedAt: this.now(), channel: (meta && meta.channel) || (pending && pending.channel) || '' }; this.sessions.set(uuid, rec);
        session.on('service-error', (e) => this.log(`Dienstfehler im Gespräch ${callId} (${e.where}): ${e.message}`));
        session.on('ended', (r) => {
            this.sessions.delete(uuid);
            this.db.updateCall(callId, { endedAt: this.now(), durationMs: r.durationMs, outcome: r.outcome, turns: r.turns, error: r.error || null });
            if (r.transcript && r.transcript.length) this.db.addTranscript(callId, r.transcript);
            this.log(`Gespräch ${callId} beendet: ${r.outcome} (${Math.round(r.durationMs / 1000)} s, ${r.turns} Wortwechsel)`); this.emit('call-ended', { id: callId, ...r });
        });
        session.start().catch((e) => { this.log('Fehler beim Start des Gesprächs: ' + e.message); try { conn.close(); } catch { /* weg */ } });
        this.emit('call-started', { id: callId, uuid, direction, number });
    }
    hangupCall(id) { for (const rec of this.sessions.values()) if (rec.callId === Number(id)) { rec.session.hangup('operator'); return true; } return false; }

    // ---------- Ausgehend ----------
    // Prüft ALLE Bedingungen und löst den Anruf aus. Wirft ManagerError(code, Text), wenn etwas nicht stimmt.
    async placeCall({ number, purpose = '', user = '', source = 'manual', skipHours = false } = {}) {
        if (!this.licenseOk()) throw new ManagerError('LICENSE', this.licenseText());
        const s = this.settings(), lim = s.limits, cc = s.trunk.defaultCountryCode || '41';
        if (!lim.outboundEnabled) throw new ManagerError('DISABLED', 'Ausgehende Anrufe sind ausgeschaltet (Einstellungen → Grenzen).');
        const e164 = phone.normalizeNumber(number, cc); if (!e164) throw new ManagerError('NUMBER', 'Das ist keine gültige Rufnummer. Beispiel: +41 79 123 45 67 oder 079 123 45 67.');
        const blocked = phone.blockedReason(e164); if (blocked) throw new ManagerError('BLOCKED', `Diese Nummer ist gesperrt: ${blocked}.`);
        if (!phone.isAllowed(e164, lim.outboundAllowedPrefixes)) throw new ManagerError('COUNTRY', `Anrufe in dieses Land sind nicht erlaubt (erlaubt: ${lim.outboundAllowedPrefixes.join(', ') || 'keine Vorwahl eingetragen'}). Das lässt sich unter Einstellungen → Grenzen ändern.`);
        const text = String(purpose || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim(); if (text.length > 400) throw new ManagerError('PURPOSE', 'Der Anlass ist zu lang (höchstens 400 Zeichen).');
        if (!skipHours && !S.inOutboundHours(new Date(this.now()), lim.outboundHours, s.general.timezone)) throw new ManagerError('HOURS', `Ausserhalb der erlaubten Zeit für ausgehende Anrufe (${lim.outboundHours}, Zeitzone ${s.general.timezone}).`);
        if (this.regPoll) { try { await this.regPoll; } catch { /* Zustand bleibt unbekannt */ } }   // eben erst die Leitung geändert: auf die laufende Abfrage warten, statt kurz fälschlich abzulehnen
        const notReady = this.trunkReady(); if (notReady) throw new ManagerError('NOT_READY', notReady);
        if (!s.aurachat.url || !s.aurachat.apiKey) throw new ManagerError('CONFIG', 'AuraChat ist noch nicht eingerichtet (Einstellungen → AuraChat).');
        if (this.sessions.size + this.pendingOut.size >= lim.maxConcurrent) throw new ManagerError('BUSY', `Es laufen schon ${this.sessions.size + this.pendingOut.size} Gespräche (erlaubt: ${lim.maxConcurrent}).`);
        const nowTs = this.now(); this.outboundTimes = this.outboundTimes.filter(t => t > nowTs - 60000);
        if (this.outboundTimes.length >= lim.outboundPerMinute) throw new ManagerError('LIMIT', `Zu viele Anrufe in kurzer Zeit (erlaubt: ${lim.outboundPerMinute} pro Minute).`);
        if (this.db.countCallsSince(nowTs - 86400000, 'out') >= lim.outboundPerDay) throw new ManagerError('LIMIT', `Das Tageslimit für ausgehende Anrufe ist erreicht (${lim.outboundPerDay} in 24 Stunden).`);
        const uuid = crypto.randomUUID(), dial = phone.formatForDial(e164, s.trunk.dialFormat, cc);
        const callId = this.db.insertCall({ uuid, direction: 'out', number: e164, purpose: text, startedAt: nowTs, outcome: 'dialing', source });
        const pending = { callId, e164, purpose: text, startedAt: nowTs, channel: '', timer: null }; this.pendingOut.set(uuid, pending); this.outboundTimes.push(nowTs);
        pending.timer = setTimeout(() => this._failPending(uuid, 'Keine Rückmeldung von Asterisk'), this.t.originateTimeoutMs + this.t.connectGraceMs); pending.timer.unref();
        try {
            await this.ami.originate({ channel: `PJSIP/${dial}@${trunkName}`, context: 'auracall-out', exten: 's', callerId: s.trunk.callerIdOut ? `"${s.trunk.callerIdName || 'Aura'}" <${s.trunk.callerIdOut}>` : undefined, variables: { AURACALL_UUID: uuid }, timeoutMs: this.t.originateTimeoutMs, actionId: uuid });
        } catch (e) { this._failPending(uuid, 'Asterisk hat den Anruf abgelehnt: ' + e.message); throw new ManagerError('ASTERISK', 'Asterisk hat den Anruf nicht angenommen: ' + e.message); }
        this.db.audit(user, 'outbound', `${phone.maskNumber(e164)} (${source})`); this.log(`Ausgehender Anruf ${callId} an ${phone.maskNumber(e164)}`);
        return { id: callId, uuid, number: e164 };
    }
    _failPending(uuid, reason, already) { const p = this.pendingOut.get(uuid); if (!p) return; clearTimeout(p.timer); this.pendingOut.delete(uuid); if (!already) this.db.updateCall(p.callId, { endedAt: this.now(), outcome: 'failed', error: reason }); this.log(`Ausgehender Anruf ${p.callId} fehlgeschlagen: ${reason}`); this.emit('call-failed', { id: p.callId, reason }); }
    _onOriginateResponse(e) {
        const uuid = String(e.ActionID).toLowerCase(), p = this.pendingOut.get(uuid); if (!p) return;
        if (/^failure$/i.test(e.Response)) { const code = Number(e.Reason); this._failPending(uuid, REASONS[code] || `Fehler (Code ${e.Reason})`); }
        else { clearTimeout(p.timer); p.timer = setTimeout(() => this._failPending(uuid, 'Der Angerufene hat abgenommen, aber die Verbindung zu Aura kam nicht zustande'), this.t.connectGraceMs); p.timer.unref(); }
    }
    // Geplante Anrufe
    scheduleCall({ number, purpose = '', runAt, user = '' }) {
        const s = this.settings(), cc = s.trunk.defaultCountryCode || '41', e164 = phone.normalizeNumber(number, cc);
        if (!e164) throw new ManagerError('NUMBER', 'Das ist keine gültige Rufnummer.');
        const b = phone.blockedReason(e164); if (b) throw new ManagerError('BLOCKED', `Diese Nummer ist gesperrt: ${b}.`);
        if (!phone.isAllowed(e164, s.limits.outboundAllowedPrefixes)) throw new ManagerError('COUNTRY', 'Anrufe in dieses Land sind nicht erlaubt.');
        const t = Number(runAt); if (!Number.isFinite(t) || t < this.now() - 60000 || t > this.now() + 90 * 86400000) throw new ManagerError('TIME', 'Der Zeitpunkt muss in der Zukunft liegen (höchstens 90 Tage).');
        const text = String(purpose || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 400);
        const id = this.db.addScheduled({ number: e164, purpose: text, runAt: t, createdBy: user }); this.db.audit(user, 'schedule', `${phone.maskNumber(e164)} für ${new Date(t).toISOString()}`); return { id, number: e164, runAt: t };
    }
    async runScheduler() {
        for (const sc of this.db.dueScheduled(this.now())) {
            try { const r = await this.placeCall({ number: sc.number, purpose: sc.purpose, user: sc.createdBy, source: 'scheduled' }); this.db.markScheduled(sc.id, 'dialing', null, r.id); }
            catch (e) {
                if (e instanceof ManagerError && TEMPORARY.has(e.code) && this.now() < sc.runAt + this.t.scheduledGraceMs) continue;   // später nochmal (zu früh am Tag, zu viele Gespräche, Leitung noch nicht bereit ...)
                this.db.markScheduled(sc.id, 'failed', e instanceof ManagerError && TEMPORARY.has(e.code) ? 'Zu spät: ' + e.message : e.message);
            }
        }
    }
}
module.exports = { Manager, ManagerError, REASONS };
