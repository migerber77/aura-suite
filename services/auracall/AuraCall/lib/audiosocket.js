'use strict';
/* AuraCall - AudioSocket: so schickt Asterisk ein Gespräch als Audio-Strom an ein Programm (Dialplan: AudioSocket(UUID,host:port)).
 * Asterisk verbindet sich mit UNS (wir sind der TCP-Server). Jedes Stück: 1 Byte Art, 2 Byte Länge (big endian), dann die Daten.
 *   0x00 Auflegen   0x01 UUID des Gesprächs (16 Byte, immer als erstes)   0x03 Tonwahl (1 Zeichen)   0x10 Audio (slin 16 Bit, 8 kHz, mono)   0xff Fehler */
const net = require('net');
const { EventEmitter } = require('events');

const KIND = { HANGUP: 0x00, UUID: 0x01, DTMF: 0x03, AUDIO: 0x10, ERROR: 0xff };
const MAX_PAYLOAD = 0xFFFF;

function encodeFrame(kind, payload) {
    const p = payload || Buffer.alloc(0);
    if (p.length > MAX_PAYLOAD) throw new RangeError(`AudioSocket: Stück zu gross (${p.length} Byte, höchstens ${MAX_PAYLOAD})`);
    const h = Buffer.alloc(3); h[0] = kind; h.writeUInt16BE(p.length, 1);
    return Buffer.concat([h, p]);
}
const uuidFromBuffer = (b) => { const h = Buffer.from(b).toString('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const uuidToBuffer = (s) => { const h = String(s).replace(/-/g, ''); if (!/^[0-9a-fA-F]{32}$/.test(h)) throw new Error('Keine gültige UUID'); return Buffer.from(h, 'hex'); };

// Setzt Stücke aus beliebig zerstückelten Daten zusammen (TCP garantiert keine Grenzen)
class FrameParser {
    constructor(maxBuffered = 1 << 20) { this.buf = Buffer.alloc(0); this.max = maxBuffered; }
    push(chunk) {
        this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
        if (this.buf.length > this.max) throw new Error('AudioSocket: zu viele unvollständige Daten');
        const out = []; let pos = 0;
        while (this.buf.length - pos >= 3) {
            const len = this.buf.readUInt16BE(pos + 1);
            if (this.buf.length - pos - 3 < len) break;
            out.push({ kind: this.buf[pos], payload: Buffer.from(this.buf.subarray(pos + 3, pos + 3 + len)) });
            pos += 3 + len;
        }
        this.buf = pos ? this.buf.subarray(pos) : this.buf;
        return out;
    }
}

class AudioSocketConn extends EventEmitter {
    constructor(socket) {
        super(); this.socket = socket; this.uuid = null; this.closed = false; this.remote = `${socket.remoteAddress || '?'}:${socket.remotePort || '?'}`;
    }
    sendAudio(pcm) { return this._send(KIND.AUDIO, pcm); }
    hangup() { this._send(KIND.HANGUP); setTimeout(() => this.close(), 200).unref(); }   // Auflegen-Stück senden, dann kurz Zeit zum Abholen, dann schliessen
    close() { if (this.closed) return; this.closed = true; try { this.socket.destroy(); } catch { /* schon zu */ } }
    _send(kind, payload) {
        if (this.closed || this.socket.destroyed || !this.socket.writable) return false;
        if (this.socket.writableLength > (1 << 20)) { this.close(); return false; }   // Asterisk liest nicht mehr: nicht ewig Daten ansammeln
        return this.socket.write(encodeFrame(kind, payload));
    }
}

class AudioSocketServer extends EventEmitter {
    constructor({ host = '127.0.0.1', port = 9092, maxConnections = 8, handshakeMs = 3000 } = {}) {
        super(); this.host = host; this.port = port; this.max = maxConnections; this.handshakeMs = handshakeMs; this.conns = new Set();
        this.server = net.createServer((s) => this._onSocket(s));
    }
    listen() { return new Promise((res, rej) => { this.server.once('error', rej); this.server.listen(this.port, this.host, () => { this.server.removeListener('error', rej); this.port = this.server.address().port; res(this.port); }); }); }
    close() { for (const c of this.conns) c.close(); return new Promise((res) => this.server.close(() => res())); }
    _onSocket(socket) {
        socket.setNoDelay(true);
        if (this.conns.size >= this.max) { socket.destroy(); this.emit('rejected', 'zu viele gleichzeitige Gespräche'); return; }
        const conn = new AudioSocketConn(socket), parser = new FrameParser(); this.conns.add(conn);
        const hs = setTimeout(() => { if (!conn.uuid) { this.emit('problem', `Keine UUID innerhalb von ${this.handshakeMs} ms von ${conn.remote}`); conn.close(); } }, this.handshakeMs);
        const fail = (msg) => { this.emit('problem', msg + ' (' + conn.remote + ')'); conn.close(); };
        socket.on('data', (chunk) => {
            let frames; try { frames = parser.push(chunk); } catch (e) { return fail(e.message); }
            for (const f of frames) {
                if (!conn.uuid) {
                    if (f.kind !== KIND.UUID || f.payload.length !== 16) return fail('Das erste Stück ist keine UUID');
                    conn.uuid = uuidFromBuffer(f.payload); clearTimeout(hs); this.emit('connection', conn); continue;
                }
                if (f.kind === KIND.AUDIO) conn.emit('audio', f.payload);
                else if (f.kind === KIND.DTMF) conn.emit('dtmf', f.payload.toString('ascii'));
                else if (f.kind === KIND.HANGUP) { conn.emit('hangup'); conn.close(); }
                else if (f.kind === KIND.ERROR) conn.emit('asterisk-error', f.payload[0]);
                /* alles andere: ignorieren (neue Arten in künftigen Asterisk-Versionen) */
            }
        });
        socket.on('error', (e) => { if (conn.uuid) conn.emit('problem', e); });
        socket.on('close', () => { clearTimeout(hs); this.conns.delete(conn); conn.closed = true; conn.emit('close'); });
    }
}
module.exports = { KIND, MAX_PAYLOAD, encodeFrame, FrameParser, uuidFromBuffer, uuidToBuffer, AudioSocketServer, AudioSocketConn };
