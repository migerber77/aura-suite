'use strict';
/* AuraCall - AMI (Asterisk Manager Interface): so steuern wir Asterisk. Textprotokoll über TCP: Zeilen "Name: Wert", Nachrichten enden mit einer Leerzeile.
 * Hier: anmelden, Befehle mit Antwort (auch Listen), Ereignisse empfangen, bei Verbindungsabbruch selbst wieder verbinden.
 * SICHERHEIT: Zeilenumbrüche in Werten würden eigene Befehle einschleusen (Header-Injektion) - deshalb wird jeder Wert vor dem Senden geprüft. */
const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const CRLF = '\r\n';
function checkHeader(name, value) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) throw new Error(`AMI: ungültiger Name "${String(name).slice(0, 30)}"`);
    const v = String(value);
    if (/[\r\n\0]/.test(v)) throw new Error(`AMI: Zeilenumbruch oder Nullzeichen im Wert von "${name}" ist nicht erlaubt`);
    return v;
}
function encodeAction(name, params, actionId) {
    let s = `Action: ${checkHeader('Action', name)}${CRLF}ActionID: ${checkHeader('ActionID', actionId)}${CRLF}`;
    for (const [k, v] of Object.entries(params || {})) {
        if (v === undefined || v === null) continue;
        for (const one of Array.isArray(v) ? v : [v]) s += `${checkHeader(k, k) && k}: ${checkHeader(k, one)}${CRLF}`;   // Liste = mehrfach derselbe Name (z.B. Variable)
    }
    return s + CRLF;
}
// Eine Nachricht (Zeilen) in ein Objekt; wiederholte Namen werden zu einer Liste
function parseMessage(text) {
    const m = {};
    for (const line of text.split(/\r?\n/)) {
        const i = line.indexOf(':'); if (i <= 0) continue;
        const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
        if (k in m) m[k] = Array.isArray(m[k]) ? [...m[k], v] : [m[k], v]; else m[k] = v;
    }
    return m;
}
class MessageParser {
    constructor(maxBuffered = 1 << 20) { this.buf = ''; this.max = maxBuffered; this.bannerDone = false; }
    push(chunk) {
        this.buf += chunk.toString('utf-8');
        if (this.buf.length > this.max) throw new Error('AMI: zu viele unvollständige Daten');
        const out = [];
        if (!this.bannerDone) {
            const nl = this.buf.indexOf('\n'); if (nl < 0) return out;
            const banner = this.buf.slice(0, nl).trim(); this.buf = this.buf.slice(nl + 1); this.bannerDone = true; out.push({ _banner: banner });
        }
        let idx;
        while ((idx = this.buf.search(/\r?\n\r?\n/)) >= 0) {
            const m = /\r?\n\r?\n/.exec(this.buf.slice(idx)); const text = this.buf.slice(0, idx); this.buf = this.buf.slice(idx + m[0].length);
            if (text.trim()) out.push(parseMessage(text));
        }
        return out;
    }
}

class Ami extends EventEmitter {
    constructor({ host = '127.0.0.1', port = 5038, username, secret, connectTimeoutMs = 5000, pingMs = 20000, pingTimeoutMs = 8000, actionTimeoutMs = 10000, reconnectMinMs = 1000, reconnectMaxMs = 30000 } = {}) {
        super(); Object.assign(this, { host, port, username, secret, connectTimeoutMs, pingMs, pingTimeoutMs, actionTimeoutMs, reconnectMinMs, reconnectMaxMs });
        this.socket = null; this.connected = false; this.stopped = true; this.pending = new Map(); this.backoff = reconnectMinMs; this.version = null; this.lastProblem = null;
    }
    start() { this.stopped = false; this._connect(); }
    stop() { this.stopped = true; clearTimeout(this._retry); clearInterval(this._pinger); if (this.socket) this.socket.destroy(); this._failPending(new Error('AMI beendet')); }
    problem(msg) { this.lastProblem = msg; this.emit('problem', msg); }
    _connect() {
        if (this.stopped) return;
        const s = net.createConnection({ host: this.host, port: this.port }); this.socket = s; const parser = new MessageParser(); let loggedIn = false;
        s.setNoDelay(true); s.setTimeout(this.connectTimeoutMs, () => { if (!loggedIn) s.destroy(new Error('Zeitüberschreitung beim Verbinden')); });
        s.on('data', (d) => {
            let msgs; try { msgs = parser.push(d); } catch (e) { return s.destroy(e); }
            for (const m of msgs) {
                if (m._banner !== undefined) {
                    if (!/^Asterisk Call Manager/i.test(m._banner)) { this.problem(`Das ist kein Asterisk-Manager (Antwort: "${m._banner.slice(0, 40)}")`); return s.destroy(); }
                    this.version = (m._banner.match(/\/(\S+)/) || [])[1] || null;
                    this._send('Login', { Username: this.username, Secret: this.secret }, { timeoutMs: this.connectTimeoutMs }).then(() => {
                        loggedIn = true; s.setTimeout(0); this.connected = true; this.backoff = this.reconnectMinMs; this.lastProblem = null; this._startPing(); this.emit('connected');
                    }, (e) => { this.problem('Anmeldung bei Asterisk abgelehnt: ' + e.message); s.destroy(); });
                    continue;
                }
                this._dispatch(m);
            }
        });
        s.on('error', (e) => { if (!this.connected || this.lastProblem === null) this.problem(`Keine Verbindung zu Asterisk (${this.host}:${this.port}): ${e.message}`); });
        s.on('close', () => {
            const was = this.connected; this.connected = false; clearInterval(this._pinger); this._failPending(new Error('Verbindung zu Asterisk beendet'));
            if (was) this.emit('disconnected');
            if (!this.stopped) { this._retry = setTimeout(() => this._connect(), this.backoff); this.backoff = Math.min(this.reconnectMaxMs, this.backoff * 2); }
        });
    }
    _startPing() {
        clearInterval(this._pinger);
        this._pinger = setInterval(() => { this._send('Ping', {}, { timeoutMs: this.pingTimeoutMs }).catch(() => { this.problem('Asterisk antwortet nicht mehr (Ping)'); if (this.socket) this.socket.destroy(); }); }, this.pingMs);
        this._pinger.unref();
    }
    _failPending(err) { for (const [id, p] of this.pending) { clearTimeout(p.timer); p.reject(err); } this.pending.clear(); }
    _dispatch(m) {
        const id = m.ActionID, p = id ? this.pending.get(id) : null;
        // ERST nach "Event" schauen: manche Ereignisse (z.B. OriginateResponse) tragen selbst eine Zeile "Response:" und wären sonst für die Antwort auf einen Befehl gehalten worden
        if (m.Event !== undefined) {
            if (p && p.collect) {
                if (/^Complete$/i.test(String(m.EventList || ''))) { clearTimeout(p.timer); this.pending.delete(id); return p.resolve({ response: p.response, events: p.events }); }
                p.events.push(m);
            }
            this.emit('event', m);
            if (m.Event === 'UserEvent' && m.UserEvent) this.emit('userevent', m.UserEvent, m);
            return;
        }
        if (m.Response !== undefined) {
            if (!p) return;
            if (/^Error$/i.test(m.Response)) { clearTimeout(p.timer); this.pending.delete(id); return p.reject(Object.assign(new Error(m.Message || 'Asterisk meldet einen Fehler'), { response: m })); }
            p.response = m;
            if (p.collect && /start/i.test(String(m.EventList || ''))) return;   // Liste folgt: Ereignisse sammeln
            clearTimeout(p.timer); this.pending.delete(id); return p.resolve({ response: m, events: p.events });
        }
    }
    _send(name, params, { collect = false, timeoutMs = this.actionTimeoutMs, actionId } = {}) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.destroyed || (!this.connected && name !== 'Login')) return reject(new Error('Keine Verbindung zu Asterisk'));
            const id = actionId || crypto.randomUUID(); let data;
            if (this.pending.has(id)) return reject(new Error('AMI: ActionID wird schon benutzt'));
            try { data = encodeAction(name, params, id); } catch (e) { return reject(e); }
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Asterisk hat auf "${name}" nicht geantwortet`)); }, timeoutMs);
            this.pending.set(id, { resolve, reject, collect, events: [], timer, response: null });
            this.socket.write(data);
        });
    }
    action(name, params, opts) { return this._send(name, params, opts); }

    // ---- Befehle ----
    // Anruf auslösen: Asterisk wählt "channel" und führt nach dem Abheben "context/exten" im Dialplan aus.
    originate({ channel, context, exten, priority = 1, callerId, variables = {}, timeoutMs = 45000, actionId }) {
        const vars = Object.entries(variables).map(([k, v]) => { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new Error(`AMI: ungültiger Variablenname "${k}"`); return `${k}=${v}`; });
        return this._send('Originate', { Channel: channel, Context: context, Exten: exten, Priority: priority, CallerID: callerId, Timeout: timeoutMs, Async: 'true', EarlyMedia: 'false', Variable: vars }, { timeoutMs: this.actionTimeoutMs, actionId });
    }
    reload() { return this._send('Reload', {}, { timeoutMs: 20000 }); }                 // "core reload": Dialplan und PJSIP neu lesen
    hangup(channel) { return this._send('Hangup', { Channel: channel, Cause: 16 }); }
    async registrations() {
        const { events } = await this._send('PJSIPShowRegistrationsOutbound', {}, { collect: true });
        return events.filter(e => e.Event === 'OutboundRegistrationDetail').map(e => ({ name: e.ObjectName, status: e.Status, serverUri: e.ServerUri, clientUri: e.ClientUri }));
    }
    async channels() {
        const { events } = await this._send('CoreShowChannels', {}, { collect: true });
        return events.filter(e => e.Event === 'CoreShowChannel').map(e => ({ channel: e.Channel, state: e.ChannelStateDesc, callerId: e.CallerIDNum, exten: e.Exten, duration: e.Duration }));
    }
    async coreStatus() { const { response } = await this._send('CoreStatus', {}); return response; }
}
module.exports = { Ami, encodeAction, parseMessage, MessageParser, checkHeader };
