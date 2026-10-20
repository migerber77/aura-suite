'use strict';
/* AuraCall - spricht mit AuraChat über dessen externe API (Authorization: Bearer <API-Schlüssel>):
 *   POST /api/v1/stt   Sprache -> Text        (Lizenzfunktion "telephony")
 *   POST /api/v1/tts   Text -> Sprache (WAV)  (Lizenzfunktion "telephony")
 *   POST /api/v1/chat  Frage -> Antwort, mit "stream": satzweise als NDJSON */
const { parseWav, buildWav, silence } = require('./audio');
const { splitSentences } = require('./prompt');

class AuraError extends Error { constructor(code, message, extra = {}) { super(message); this.name = 'AuraError'; this.code = code; Object.assign(this, extra); } }
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

class AuraClient {
    constructor({ baseUrl, apiKey, model, sttTimeoutMs = 20000, ttsTimeoutMs = 20000, chatIdleMs = 90000, fetchImpl } = {}) {
        let u; try { u = new URL(String(baseUrl || '')); } catch { throw new AuraError('CONFIG', 'Adresse von AuraChat fehlt oder ist ungültig (Beispiel: http://192.168.1.10:8091).'); }
        if (!/^https?:$/.test(u.protocol)) throw new AuraError('CONFIG', 'Die Adresse von AuraChat muss mit http:// oder https:// beginnen.');
        if (u.username || u.password) throw new AuraError('CONFIG', 'Die Adresse von AuraChat darf keinen Benutzernamen und kein Passwort enthalten (dafür gibt es den API-Schlüssel).');
        if (!apiKey || /[\r\n]/.test(String(apiKey))) throw new AuraError('CONFIG', 'API-Schlüssel fehlt (in AuraChat im Admin Panel unter "API" erzeugen).');
        this.base = u.origin + u.pathname.replace(/\/+$/, ''); this.key = String(apiKey).trim();
        this.model = typeof model === 'string' && /^[A-Za-z0-9._:\/-]{1,100}$/.test(model) ? model : undefined;   // Modell nur fürs Telefon (leer = das von AuraChat eingestellte)
        this.sttTimeoutMs = sttTimeoutMs; this.ttsTimeoutMs = ttsTimeoutMs; this.chatIdleMs = chatIdleMs; this.fetch = fetchImpl || fetch;
    }
    _headers(extra) { return { Authorization: `Bearer ${this.key}`, 'X-Client': 'AuraCall', ...extra }; }
    // headersOnly: das Zeitlimit gilt nur bis die Antwort BEGINNT (für Streams; danach gilt die Pause zwischen zwei Zeilen), sonst bis sie ganz da ist
    async _request(path, init, { timeoutMs, signal, headersOnly }) {
        const signals = []; let timer;
        if (headersOnly) { const t = new AbortController(); timer = setTimeout(() => t.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs); signals.push(t.signal); }
        else signals.push(AbortSignal.timeout(timeoutMs));
        if (signal) signals.push(signal);
        try { return await this.fetch(this.base + path, { ...init, signal: AbortSignal.any(signals) }); }
        catch (err) {
            if (signal && signal.aborted) throw new AuraError('ABORTED', 'Abgebrochen');
            if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) throw new AuraError('TIMEOUT', `AuraChat hat nicht innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden geantwortet.`);
            const c = err && err.cause, code = (c && (c.code || (c.errors && c.errors[0] && c.errors[0].code) || ((c.message || '').match(/\b(E[A-Z]{3,})\b/) || [])[1])) || (err && err.code) || (c && c.message ? String(c.message).slice(0, 60) : '');
            throw new AuraError('UNREACHABLE', `AuraChat ist unter ${this.base} nicht erreichbar${code ? ' (' + code + ')' : ''}.`);
        } finally { clearTimeout(timer); }
    }
    async _fail(res) {   // Fehlerantwort in einen verständlichen Fehler übersetzen
        let msg = ''; try { const t = await res.text(); try { msg = JSON.parse(t).error || t; } catch { msg = t; } } catch { /* ohne Text */ }
        msg = String(msg || '').replace(/\s+/g, ' ').slice(0, 300);
        if (res.status === 401) return new AuraError('AUTH', 'Der API-Schlüssel wurde von AuraChat nicht akzeptiert. Bitte in AuraChat einen neuen erzeugen.', { status: 401 });
        if (res.status === 402) return new AuraError('LICENSE', 'AuraChat verlangt dafür eine Premium-Lizenz mit der Funktion "Telefonie" (und "Externe API").' + (msg ? ' Meldung: ' + msg : ''), { status: 402 });
        if (res.status === 429) return new AuraError('RATE', 'AuraChat bremst gerade (zu viele Anfragen).', { status: 429 });
        return new AuraError('SERVER', `AuraChat meldet einen Fehler (${res.status})${msg ? ': ' + msg : ''}`, { status: res.status });
    }

    // Gesprochenes (slin16 mono) -> Text
    async transcribe(pcm, rate, { language, signal } = {}) {
        const form = new FormData(); form.append('file', new Blob([buildWav(pcm, rate)], { type: 'audio/wav' }), 'utterance.wav');
        if (/^[a-z]{2,3}$/.test(String(language || ''))) form.append('language', language);
        const res = await this._request('/api/v1/stt', { method: 'POST', headers: this._headers(), body: form }, { timeoutMs: this.sttTimeoutMs, signal });
        if (!res.ok) throw await this._fail(res);
        let data; try { data = await res.json(); } catch { throw new AuraError('BAD_RESPONSE', 'AuraChat hat keine verständliche Antwort der Spracherkennung geliefert.'); }
        return String((data && data.text) || '').replace(/\s+/g, ' ').trim();
    }
    // Text -> { pcm, rate } (WAV von AuraChat, hier gelesen)
    async synthesize(text, { lang, signal } = {}) {
        const res = await this._request('/api/v1/tts', { method: 'POST', headers: this._headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text, lang: lang || undefined, format: 'wav' }) }, { timeoutMs: this.ttsTimeoutMs, signal });
        if (!res.ok) throw await this._fail(res);
        const type = res.headers.get('content-type') || '';
        if (!/wav|wave/i.test(type)) throw new AuraError('BAD_RESPONSE', `Die Sprachausgabe von AuraChat liefert kein WAV (sondern "${type || 'unbekannt'}"). Bitte Piper (Wyoming) verwenden.`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_AUDIO_BYTES) throw new AuraError('BAD_RESPONSE', 'Die Sprachausgabe ist unerwartet gross.');
        try { return parseWav(buf); } catch (e) { throw new AuraError('BAD_RESPONSE', 'Die Sprachausgabe von AuraChat ist kein lesbares WAV: ' + e.message); }
    }
    // Antwort Satz für Satz. onSentence(text) für jeden fertigen Satz; gibt die ganze Antwort zurück.
    async chatStream(message, { signal, onSentence, maxTokens } = {}) {
        const ctl = new AbortController(), sigs = [ctl.signal]; if (signal) sigs.push(signal);   // ctl: bei Stille selbst abbrechen, damit AuraChat die Verbindung schliessen sieht
        const res = await this._request('/api/v1/chat', { method: 'POST', headers: this._headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ message, stream: true, ...(this.model ? { model: this.model } : {}), ...(maxTokens ? { max_tokens: maxTokens } : {}) }) }, { timeoutMs: this.chatIdleMs, signal: AbortSignal.any(sigs), headersOnly: true });
        if (!res.ok) throw await this._fail(res);
        const type = res.headers.get('content-type') || '';
        if (!/ndjson/i.test(type)) {   // älteres AuraChat ohne Streaming: ganze Antwort, selbst in Sätze zerlegt
            let data; try { data = await res.json(); } catch { throw new AuraError('BAD_RESPONSE', 'AuraChat hat keine verständliche Antwort geliefert.'); }
            const reply = String((data && data.reply) || ''); splitSentences(reply, true).sentences.forEach(s => onSentence && onSentence(s)); return reply;
        }
        let buf = '', reply = '', sentences = [], done = false, idle;
        const idleFail = (reject) => { clearTimeout(idle); idle = setTimeout(() => { reject(new AuraError('TIMEOUT', `AuraChat hat sich ${Math.round(this.chatIdleMs / 1000)} Sekunden lang nicht mehr gemeldet.`)); ctl.abort(); }, this.chatIdleMs); };
        const handleLine = (line) => {
            const t = line.trim(); if (!t) return; let o; try { o = JSON.parse(t); } catch { return; }
            if (o.error) throw new AuraError('SERVER', String(o.error).slice(0, 300));
            if (typeof o.sentence === 'string' && o.sentence.trim()) { sentences.push(o.sentence); if (onSentence) onSentence(o.sentence); }
            if (o.done) { done = true; reply = String(o.reply || sentences.join(' ')); }
        };
        await new Promise((resolve, reject) => {
            idleFail(reject);
            (async () => {
                try {
                    for await (const chunk of res.body) {
                        idleFail(reject); buf += Buffer.from(chunk).toString('utf-8'); let nl;
                        while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl); buf = buf.slice(nl + 1); handleLine(line); }
                        if (buf.length > 200000) throw new AuraError('BAD_RESPONSE', 'Zu lange Zeile in der Antwort von AuraChat.');
                    }
                    if (buf.trim()) handleLine(buf);
                    resolve();
                } catch (e) { reject(signal && signal.aborted ? new AuraError('ABORTED', 'Abgebrochen') : (e instanceof AuraError ? e : new AuraError('UNREACHABLE', 'Verbindung zu AuraChat mitten in der Antwort abgebrochen.'))); }
            })();
        }).finally(() => clearTimeout(idle));
        if (!done) { if (!sentences.length) throw new AuraError('BAD_RESPONSE', 'AuraChat hat die Antwort nicht zu Ende geschickt.'); reply = sentences.join(' '); }   // Teilantwort ist besser als nichts
        return reply;
    }
    // Prüft die drei Wege einzeln (für den Knopf "Verbindung testen"): { stt, tts, chat } je { ok, ms, error?: { code, message } }
    async check({ chat = true } = {}) {
        const step = async (fn) => { const t = Date.now(); try { const detail = await fn(); return { ok: true, ms: Date.now() - t, detail }; } catch (e) { return { ok: false, ms: Date.now() - t, error: { code: e.code || 'ERROR', message: e.message } }; } };
        const tts = await step(async () => { const r = await this.synthesize('Test.'); return `${r.rate} Hz`; });
        const stt = await step(async () => { await this.transcribe(silence(500, 16000), 16000); return 'ok'; });
        const ch = chat ? await step(async () => { const r = await this._request('/api/v1/chat', { method: 'POST', headers: this._headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ message: 'Antworte nur mit dem Wort Okay.', ...(this.model ? { model: this.model } : {}) }) }, { timeoutMs: 120000 }); if (!r.ok) throw await this._fail(r); const d = await r.json(); return String(d.reply || '').slice(0, 40); }) : null;
        return { ok: tts.ok && stt.ok && (!ch || ch.ok), tts, stt, chat: ch };
    }
}
module.exports = { AuraClient, AuraError };
