'use strict';
/* AuraCall - ein Telefongespräch von Anfang bis Ende.
 *
 * Ablauf: Begrüssen -> zuhören (Sprechpausen-Erkennung) -> Gesagtes erkennen (STT) -> Antwort von AuraChat Satz für Satz holen -> jeden Satz sofort vorlesen (TTS)
 * -> wieder zuhören. Dazu: Der Anrufer darf jederzeit dazwischenreden (Unterbrechen), bei langer Denkzeit sagt Aura "Einen Moment bitte", nach Stille fragt sie nach,
 * nach zu langer Dauer verabschiedet sie sich. Fällt ein Dienst aus, sagt sie das ehrlich und legt höflich auf (nie Stille oder Endlosschleife).
 *
 * Zeit: Die Sprechpausen-Erkennung zählt Audio-Stücke (je 20 ms Ton), Abspielen und Wartezeiten laufen nach der Uhr. "tickMs" ist die Wartezeit je 20-ms-Stück beim
 * Abspielen (im Betrieb 20 = Echtzeit; Tests setzen 1). */
const { EventEmitter } = require('events');
const A = require('./audio');
const { Vad } = require('./vad');
const { buildPrompt, cleanForSpeech } = require('./prompt');

const AUDIO_MS = 20;   // so viel Ton steckt in einem Stück
// Whisper erfindet bei Stille oder Rauschen gern solche Sätze (Trainingsreste von Videos): nicht als Gesprochenes behandeln
const HALLUCINATIONS = [/untertitel/i, /vielen dank f(ü|ue)rs zuschauen/i, /thank(s| you) for watching/i, /amara\.org/i, /copyright/i, /^[^\p{L}\p{N}]*$/u];   // letzte: nur Satzzeichen/Leeres (Unicode-bewusst: "Öl" und "Ä" sind Wörter)

const DEFAULTS = Object.freeze({
    company: 'unserem Haus', lang: 'de', knowledge: '', storeTranscripts: false,
    greetingIn: 'Guten Tag, hier ist Aura, die KI-Assistentin von {company}. Wie kann ich Ihnen helfen?',
    greetingOut: 'Guten Tag, hier ist Aura, die KI-Assistentin von {company}. Ich rufe Sie kurz an. Haben Sie einen Moment Zeit?',
    transcriptNotice: 'Das Gespräch wird als Text gespeichert.',
    phrases: Object.freeze({
        noUnderstand: 'Entschuldigung, das habe ich nicht verstanden. Können Sie das bitte wiederholen?',
        stillThere: 'Sind Sie noch da?',
        goodbye: 'Vielen Dank für Ihren Anruf. Auf Wiederhören.',
        techError: 'Entschuldigung, ich habe gerade ein technisches Problem. Bitte rufen Sie später noch einmal an. Auf Wiederhören.',
        timeLimit: 'Unsere Gesprächszeit ist leider zu Ende. Vielen Dank und auf Wiederhören.',
        filler: 'Einen Moment bitte.',
        unclearEnd: 'Leider verstehe ich Sie schlecht. Bitte rufen Sie später noch einmal an. Auf Wiederhören.'
    }),
    rate: 8000, tickMs: AUDIO_MS, lead: 5, gain: 1,
    vad: Object.freeze({ minRms: 350, startMs: 100, endSilenceMs: 700, minUtteranceMs: 250, maxUtteranceMs: 20000, preRollMs: 200 }),
    bargeInMs: 300,          // so lange muss der Anrufer sprechen, damit Aura verstummt (kürzer = Husten/"mhm", wird ignoriert)
    idlePromptMs: 8000, maxIdlePrompts: 2, maxCallMs: 600000,
    fillerAfterMs: 3500,     // so lange Denkzeit, dann "Einen Moment bitte"
    maxThinkMs: 60000,       // so lange wartet Aura höchstens auf die erste Antwort
    maxUnclear: 3, outboundWaitMs: 1500, outboundHelloMaxMs: 4000, drainMs: 300, retrySttOnce: true
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const fill = (t, vars) => String(t || '').replace(/\{(company)\}/g, (m, k) => vars[k] || '');
const cleanTranscript = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);

class CallSession extends EventEmitter {
    // conn: AudioSocket-Verbindung (sendAudio, hangup, close; Ereignisse audio, dtmf, hangup, close)
    // meta: { uuid, direction: 'in'|'out', caller, did, purpose }   aura: AuraClient   cache: Map für feste Sätze (optional, von allen Gesprächen geteilt)
    constructor({ conn, meta = {}, settings = {}, aura, cache } = {}) {
        super();
        this.conn = conn; this.meta = { direction: 'in', ...meta }; this.aura = aura; this.cache = cache || new Map();
        this.s = { ...DEFAULTS, ...settings, phrases: { ...DEFAULTS.phrases, ...(settings.phrases || {}) }, vad: { ...DEFAULTS.vad, ...(settings.vad || {}) } };
        this.frameBytes = A.frameBytesFor(this.s.rate, AUDIO_MS);
        this.vad = new Vad({ frameMs: AUDIO_MS, ...this.s.vad });
        this.bargeFrames = Math.max(0, Math.ceil((this.s.bargeInMs - this.s.vad.startMs) / AUDIO_MS));
        this.state = 'init'; this.turnId = 0; this.startedAt = Date.now(); this.ended = false; this.history = []; this.transcript = []; this.turns = 0;
        this.rest = Buffer.alloc(0); this.turn = null; this.queue = []; this.playing = null; this.epoch = 0; this.bargeCount = 0;
        this.unclear = 0; this.idlePrompts = 0; this.sttFailures = 0; this.preGreeting = false; this.timers = new Set(); this.endRequested = null;
        this.stats = { framesSent: 0, interrupts: 0, sttCalls: 0, chatCalls: 0, ttsCalls: 0 };
        conn.on('audio', (b) => this._onAudio(b));
        conn.on('dtmf', (d) => this.emit('dtmf', d));
        conn.on('hangup', () => this._finish('caller-hangup'));
        conn.on('close', () => this._finish('caller-hangup'));
    }

    // ---------- Hilfen ----------
    _timer(ms, fn) { const t = setTimeout(() => { this.timers.delete(t); if (!this.ended) fn(); }, ms); this.timers.add(t); return t; }
    _clear(t) { if (t) { clearTimeout(t); this.timers.delete(t); } }
    _setState(s) { if (this.state !== s && !this.ended) { this.state = s; this.emit('state', s); } }
    _log(who, text) { const t = cleanTranscript(text); if (t) this.transcript.push({ t: Date.now() - this.startedAt, who, text: t }); }
    get lang() { return this.s.lang; }
    get speaking() { return !!this.playing || this.queue.length > 0; }

    // ---------- Start ----------
    async start() {
        if (this.ended) return;
        this._timer(this.s.maxCallMs, () => this._endWith('timeLimit', 'max-duration'));
        const out = this.meta.direction === 'out';
        const greeting = fill(out ? this.s.greetingOut : this.s.greetingIn, { company: this.s.company }) + (this.s.storeTranscripts ? ' ' + this.s.transcriptNotice : '');
        if (out) {   // Angerufene sagen oft zuerst "Hallo?": kurz warten, damit Aura nicht drüberredet
            this._setState('waiting'); this.preGreeting = true;
            await new Promise((resolve) => { this._helloDone = resolve; this._timer(this.s.outboundWaitMs, () => { if (!this.vad.speaking) resolve(); }); this._timer(this.s.outboundHelloMaxMs, resolve); });
            this.preGreeting = false; if (this.ended) return;
        }
        this._setState('greeting');
        const ok = await this._say(greeting, { cache: true, log: 'aura', history: true });
        if (!ok && !this.ended && !this.endRequested && this.stats.ttsFailed) return this._finish('error:tts', { error: 'Die Sprachausgabe der Begrüssung ist fehlgeschlagen.' });
        this._listen();
    }

    _listen() {
        if (this.ended || this.endRequested) return;
        this._setState('listening'); this._clear(this.idleTimer);
        this.idleTimer = this._timer(this.s.idlePromptMs, () => this._onIdle());
    }
    async _onIdle() {
        if (this.state !== 'listening' || this.vad.speaking) return this._listen();
        if (this.idlePrompts >= this.s.maxIdlePrompts) return this._endWith('goodbye', 'idle-timeout');
        this.idlePrompts++; await this._say(this.s.phrases.stillThere, { cache: true, log: 'aura' }); this._listen();
    }

    // ---------- Ton von Asterisk ----------
    _onAudio(buf) {
        if (this.ended || !buf || !buf.length) return;
        this.rest = this.rest.length ? Buffer.concat([this.rest, buf]) : buf;
        while (this.rest.length >= this.frameBytes) { const f = this.rest.subarray(0, this.frameBytes); this.rest = this.rest.subarray(this.frameBytes); this._onFrame(f); if (this.ended) return; }
    }
    _onFrame(frame) {
        const ev = this.vad.push(frame);
        if (ev && ev.type === 'start') { this._clear(this.idleTimer); this.bargeCount = 0; this.bargeLock = false; }
        else if (!ev && this.vad.speaking && this.speaking && !this.bargeLock) {       // Anrufer redet, während Aura spricht: lange genug = unterbrechen
            this.bargeCount++; if (this.bargeCount >= this.bargeFrames) this._interrupt();
        }
        if (ev && (ev.type === 'end' || ev.type === 'discard')) { this.bargeCount = 0; if (this.preGreeting && this._helloDone) { const r = this._helloDone; this._helloDone = null; r(); } }
        if (ev && ev.type === 'end') this._onUtterance(ev.pcm);
        else if (ev && ev.type === 'discard' && this.state === 'listening') this._listen();
    }
    _interrupt() {
        if (!this.speaking) return;
        if (this.turn && !this.turn.speechStarted) {   // Es läuft nur der Füller ("Einen Moment bitte"): Füller stoppen, die Verarbeitung läuft WEITER. Redet der Anrufer weiter, wird beides zusammen ausgewertet; war es nur ein Husten, geht die Antwort ganz normal los.
            this.epoch++; this._cancelPlayback(); this.queue.forEach(q => q.resolve(false)); this.queue = []; this.turn.fillerDone = true; return;
        }
        this.bargeLock = true;   // bis zum nächsten Sprechbeginn nicht noch einmal (der Abspieler braucht ein paar Millisekunden, bis er das Verstummen bemerkt)
        this.stats.interrupts++; this.epoch++; this._cancelPlayback(); this.queue.forEach(q => q.resolve(false)); this.queue = [];
        if (this.turn) { this.turn.interrupted = true; this.turn.ac.abort(); }
        this.emit('interrupted');
    }

    // ---------- Gesagtes verarbeiten ----------
    _onUtterance(pcm) {
        if (this.ended || this.endRequested || this.preGreeting) return;
        this.idlePrompts = 0;
        if (this.turn && !this.turn.speechStarted) {            // Anrufer redet weiter, während Aura noch nachdenkt: beides zusammen auswerten
            const old = this.turn, prev = old.pcm; old.ac.abort(); old.superseded = true;
            // Der ersetzte Durchgang zählt nicht: sein Text steht gleich als Teil des zusammengelegten (sonst doppelt im Verlauf und im Protokoll)
            if (old.hist) { this.history = this.history.filter(h => h !== old.hist); this.turns = Math.max(0, this.turns - 1); }
            if (old.tr) this.transcript = this.transcript.filter(t => t !== old.tr);
            pcm = Buffer.concat([prev, A.silence(240, this.s.rate), pcm]);
        } else if (this.speaking) return;                      // kurzes Zwischenwort während Aura spricht ("mhm"): ignorieren
        this._runTurn(pcm);
    }

    async _runTurn(pcm) {
        const turn = { id: ++this.turnId, pcm, ac: new AbortController(), speechStarted: false, sentences: [], spoken: [], interrupted: false, superseded: false, end: false, llmDone: false, fillerDone: false };
        this.turn = turn; this._setState('thinking'); this._clear(this.idleTimer);
        const sig = turn.ac.signal, dead = () => this.ended || turn.superseded || turn.interrupted || (sig.aborted && !turn.timedOut);
        const fillerTimer = this._timer(this.s.fillerAfterMs, () => { if (!dead() && !turn.speechStarted && !turn.fillerDone) { turn.fillerDone = true; this._say(this.s.phrases.filler, { cache: true, log: false, filler: true }); } });
        const thinkTimer = this._timer(this.s.maxThinkMs, () => { if (!dead() && !turn.speechStarted) { turn.timedOut = true; turn.ac.abort(); } });
        try {
            // 1) Verstehen
            let text; this.stats.sttCalls++;
            try { text = await this.aura.transcribe(A.resample(pcm, this.s.rate, 16000), 16000, { language: this.lang, signal: sig }); this.sttFailures = 0; }
            catch (e) {
                if (turn.timedOut) return this._serviceFailed(Object.assign(new Error('Keine Antwort der Spracherkennung innerhalb der erlaubten Zeit'), { code: 'TIMEOUT' }), 'stt');
                if (dead()) return;
                if (!['AUTH', 'LICENSE', 'CONFIG'].includes(e.code) && this.s.retrySttOnce && !turn.retried) {   // einmal sofort wiederholen
                    turn.retried = true; this.stats.sttCalls++;
                    try { text = await this.aura.transcribe(A.resample(pcm, this.s.rate, 16000), 16000, { language: this.lang, signal: sig }); }
                    catch (e2) { if (turn.timedOut) return this._serviceFailed(Object.assign(new Error('Keine Antwort der Spracherkennung innerhalb der erlaubten Zeit'), { code: 'TIMEOUT' }), 'stt'); if (dead()) return; return this._serviceFailed(e2, 'stt'); }
                } else return this._serviceFailed(e, 'stt');
            }
            if (dead()) return;
            text = cleanTranscript(text);
            if (!text || HALLUCINATIONS.some(h => h.test(text))) return this._notUnderstood();
            this.unclear = 0; this.turns++; this._log('caller', text); turn.tr = this.transcript[this.transcript.length - 1];
            // 2) Antwort holen und satzweise vorlesen
            const prompt = buildPrompt({ company: this.s.company, knowledge: this.s.knowledge, history: this.history, userText: text, direction: this.meta.direction, purpose: this.meta.purpose, lang: this.lang });
            turn.hist = { who: 'caller', text }; this.history.push(turn.hist); this.stats.chatCalls++;
            const spokenDone = [];
            const onSentence = (raw) => {
                if (dead()) return;
                const c = cleanForSpeech(raw); if (c.end) turn.end = true;
                if (!c.text) return;
                turn.sentences.push(c.text);
                if (!turn.speechStarted) { turn.speechStarted = true; this._clear(fillerTimer); this._clear(thinkTimer); this._setState('speaking'); }
                this._say(c.text, { log: false, onDone: (ok) => { if (ok) spokenDone.push(c.text); } });
            };
            try { await this.aura.chatStream(prompt, { signal: sig, onSentence }); turn.llmDone = true; }
            catch (e) {
                if (turn.superseded) return;
                if (turn.interrupted) { /* Anrufer hat unterbrochen: bis hierher Gesprochenes zählt */ }
                else if (turn.timedOut) return this._serviceFailed(Object.assign(new Error('Keine Antwort von AuraChat innerhalb der erlaubten Zeit'), { code: 'TIMEOUT' }), 'chat');
                else if (!this.ended) { if (!turn.sentences.length) return this._serviceFailed(e, 'chat'); /* sonst: Teilantwort wurde schon gesprochen */ }
            }
            if (turn.superseded) return;
            if (!turn.sentences.length && !turn.interrupted && !this.ended) return this._notUnderstood();
            // 3) Warten, bis alles gesprochen ist (oder unterbrochen wurde)
            await this._flush();
            if (turn.superseded) return;
            if (spokenDone.length) { const said = spokenDone.join(' '); this.history.push({ who: 'aura', text: said }); this._log('aura', said); }
            if (this.ended || this.turn !== turn) return;          // inzwischen läuft ein neuer Durchgang (Anrufer hat unterbrochen): den nicht anfassen
            if (turn.end && !turn.interrupted) return this._endWith(null, 'ended-by-aura');
            this.turn = null; this._listen();
        } finally { this._clear(fillerTimer); this._clear(thinkTimer); if (this.turn === turn && (turn.superseded || turn.interrupted)) this.turn = null; }
    }
    async _notUnderstood() {
        this.turn = null; this.unclear++;
        if (this.unclear >= this.s.maxUnclear) return this._endWith('unclearEnd', 'unclear');
        await this._say(this.s.phrases.noUnderstand, { cache: true, log: 'aura' }); this._listen();
    }
    async _serviceFailed(err, where) {
        this.turn = null; this.lastError = `${where}: ${err.message}`;
        const fatal = ['AUTH', 'LICENSE', 'CONFIG'].includes(err.code);
        this.emit('service-error', { where, code: err.code, message: err.message });
        if (this.ended) return;
        if (!fatal && where === 'stt' && err.code !== 'TIMEOUT' && ++this.sttFailures < 2) { this._listen(); return; }   // einmaliger Aussetzer: nochmal zuhören; Zeitablauf (lange Stille der Gegenstelle) nie   // einmaliger Aussetzer beim Verstehen: nochmal zuhören
        return this._endWith('techError', `error:${where}${err.code ? ':' + String(err.code).toLowerCase() : ''}`, { error: err.message });
    }

    // ---------- Sprechen ----------
    // Einen Text vorlesen: sofort mit der Sprachausgabe beginnen (nächste Sätze werden schon erzeugt, während der aktuelle läuft), der Reihe nach abspielen.
    // Gibt ein Versprechen zurück: true = vollständig gespielt, false = unterbrochen/fehlgeschlagen/beendet.
    _say(text, { cache = false, log = false, history = false, filler = false, onDone } = {}) {
        if (this.ended) return Promise.resolve(false);
        return new Promise((resolve) => {
            const item = { text, filler, epoch: this.epoch, resolve: (ok) => { try { if (onDone) onDone(ok); } finally { resolve(ok); } }, pcm: null };
            item.pcm = this._synth(text, cache); item.pcm.catch(() => {});   // nicht als "unbehandelt" melden; Fehler wird beim Abspielen behandelt
            if (log) item.after = () => { this._log(log, text); if (history) this.history.push({ who: 'aura', text }); };
            this.queue.push(item); this._pump();
        });
    }
    async _synth(text, cacheable) {
        const key = `${this.lang}|${text}`;
        if (cacheable && this.cache.has(key)) return this.cache.get(key);
        const p = (async () => {
            this.stats.ttsCalls++;
            const r = await this.aura.synthesize(text, { lang: this.lang, signal: this.turn && this.turn.ac ? this.turn.ac.signal : undefined });
            let pcm = A.resample(r.pcm, r.rate, this.s.rate); if (this.s.gain !== 1) pcm = A.gain(pcm, this.s.gain); return pcm;
        })();
        if (cacheable) { this.cache.set(key, p); p.catch(() => this.cache.delete(key)); if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value); }
        return p;
    }
    async _pump() {
        if (this.playing || this.pumping) return; this.pumping = true;
        try {
            while (this.queue.length && !this.ended) {
                const item = this.queue.shift(); this.playing = item;
                if (item.epoch !== this.epoch) { this.playing = null; item.resolve(false); continue; }
                let pcm; try { pcm = await item.pcm; } catch (e) { this.stats.ttsFailed = (this.stats.ttsFailed || 0) + 1; this.emit('service-error', { where: 'tts', code: e.code, message: e.message }); this.playing = null; item.resolve(false); if (['AUTH', 'LICENSE', 'CONFIG'].includes(e.code)) this._finish('error:tts:' + String(e.code).toLowerCase(), { error: e.message }); continue; }
                if (item.epoch !== this.epoch || this.ended) { this.playing = null; item.resolve(false); continue; }
                this._setState(item.filler ? this.state : (this.state === 'greeting' ? 'greeting' : 'speaking'));
                const done = await this._playPcm(pcm, item.epoch);
                this.playing = null; if (done) { if (item.after) item.after(); this.emit('said', item.text, { filler: item.filler }); }
                item.resolve(done);
            }
        } finally { this.pumping = false; this.playing = null; if (this.queue.length && !this.ended) this._pump(); }
    }
    _cancelPlayback() { if (this.playCancel) this.playCancel(); }
    // Frames im Takt senden: erst "lead" Stück sofort (Puffer bei Asterisk), dann je eines pro tickMs
    async _playPcm(pcm, epoch) {
        let cancelled = false; this.playCancel = () => { cancelled = true; };
        const start = Date.now(); let i = 0;
        for (const f of A.frames(pcm, this.frameBytes)) {
            if (cancelled || this.ended || epoch !== this.epoch) return false;
            const wait = start + Math.max(0, i - this.s.lead) * this.s.tickMs - Date.now();
            if (wait > 0) await sleep(wait);
            if (cancelled || this.ended || epoch !== this.epoch) return false;
            if (this.conn.sendAudio(f) === false) return false; this.stats.framesSent++; i++;
        }
        this.playCancel = null; return true;
    }
    async _flush() { while ((this.queue.length || this.playing) && !this.ended) await sleep(Math.max(1, this.s.tickMs)); }

    // ---------- Beenden ----------
    // Verabschieden (optional Satz sagen), ausklingen lassen, auflegen
    async _endWith(phraseKey, outcome, extra = {}) {
        if (this.ended || this.endRequested) return; this.endRequested = outcome;
        if (this.turn) { this.turn.superseded = true; this.turn.ac.abort(); this.turn = null; }
        this.epoch++; this._cancelPlayback(); this.queue.forEach(q => q.resolve(false)); this.queue = []; this._clear(this.idleTimer);
        const phrase = phraseKey ? this.s.phrases[phraseKey] : null;
        if (phrase) await this._say(phrase, { cache: true, log: 'aura' });
        else await this._flush();
        if (this.ended) return;
        await sleep(this.s.drainMs + this.s.lead * this.s.tickMs);   // die letzten Töne im Puffer noch ausspielen lassen
        this._finish(outcome, extra, true);
    }
    _finish(outcome, extra = {}, hangup = false) {
        if (this.ended) return; this.ended = true; this.state = 'ended';
        for (const t of this.timers) clearTimeout(t); this.timers.clear();
        if (this.turn) { this.turn.ac.abort(); this.turn = null; }
        this._cancelPlayback(); this.queue.forEach(q => q.resolve(false)); this.queue = [];
        if (hangup) { try { this.conn.hangup(); } catch { /* schon weg */ } } else { try { this.conn.close(); } catch { /* schon weg */ } }
        this.emit('state', 'ended');
        this.emit('ended', { outcome: this.endRequested && outcome === 'caller-hangup' ? this.endRequested : outcome, durationMs: Date.now() - this.startedAt, turns: this.turns, transcript: this.s.storeTranscripts ? this.transcript : [], error: extra.error || this.lastError || null, stats: { ...this.stats } });
    }
    // Von aussen (z.B. Knopf "Auflegen" in der Verwaltung)
    hangup(reason = 'operator') { return this._endWith(null, reason); }
}
module.exports = { CallSession, DEFAULTS, HALLUCINATIONS };
