'use strict';
/* AuraCall - Audio-Handwerk. Alles arbeitet mit "slin16": 16 Bit, vorzeichenbehaftet, little endian, mono (so spricht Asterisk AudioSocket). */

// Lautstärke eines Stücks: Effektivwert (RMS), 0 bis 32767
function rms(pcm) {
    const n = pcm.length >> 1;
    if (!n) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) { const v = pcm.readInt16LE(i * 2); sum += v * v; }
    return Math.sqrt(sum / n);
}

// Abtastrate umrechnen (z.B. 22050 -> 8000 für das Telefon, 8000 -> 16000 für die Spracherkennung).
// Verkleinern mit Tiefpass (Sinc, Lanczos-Fenster), damit hohe Töne nicht als falsche tiefe Töne zurückkommen ("Aliasing"); Vergrössern mit demselben Kern.
function resample(pcm, inRate, outRate) {
    if (!Number.isFinite(inRate) || !Number.isFinite(outRate) || inRate <= 0 || outRate <= 0) throw new Error('Ungültige Abtastrate');
    const n = pcm.length >> 1;
    if (inRate === outRate || n === 0) return Buffer.from(pcm);
    const ratio = inRate / outRate, outLen = Math.max(1, Math.floor(n / ratio)), out = Buffer.alloc(outLen * 2);
    const cut = Math.min(1, outRate / inRate) * 0.95;           // Grenzfrequenz relativ zur Eingangsrate (Nyquist der Ausgabe, mit Reserve)
    const A = 6, support = A / cut;                              // Breite des Kerns in Eingangsproben
    const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
    for (let o = 0; o < outLen; o++) {
        const t = o * ratio, i0 = Math.max(0, Math.ceil(t - support)), i1 = Math.min(n - 1, Math.floor(t + support));
        let acc = 0, wsum = 0;
        for (let i = i0; i <= i1; i++) {
            const x = (i - t) * cut, w = sinc(x) * sinc(x / A);   // Lanczos
            acc += pcm.readInt16LE(i * 2) * w; wsum += w;
        }
        const v = wsum !== 0 ? acc / wsum : 0;
        out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), o * 2);
    }
    return out;
}

// WAV lesen: nur lineares PCM mit 16 Bit (so liefert Piper); Stereo wird zu Mono gemischt. Gibt { rate, pcm } zurück.
function parseWav(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Das ist keine WAV-Datei');
    let pos = 12, fmt = null, data = null;
    while (pos + 8 <= buf.length) {
        const id = buf.toString('ascii', pos, pos + 4); let size = buf.readUInt32LE(pos + 4); const start = pos + 8;
        if (id === 'fmt ') { if (size < 16 || start + 16 > buf.length) throw new Error('WAV: kaputter Kopf'); fmt = { tag: buf.readUInt16LE(start), channels: buf.readUInt16LE(start + 2), rate: buf.readUInt32LE(start + 4), bits: buf.readUInt16LE(start + 14) }; }
        else if (id === 'data') { if (size === 0xFFFFFFFF || start + size > buf.length) size = buf.length - start; data = buf.subarray(start, start + size); break; }
        pos = start + size + (size & 1);
    }
    if (!fmt) throw new Error('WAV: Formatangabe fehlt');
    if (!data) throw new Error('WAV: keine Audiodaten');
    if (fmt.tag !== 1 && fmt.tag !== 0xFFFE) throw new Error(`WAV: Format ${fmt.tag} wird nicht unterstützt (nur lineares PCM)`);
    if (fmt.bits !== 16) throw new Error(`WAV: ${fmt.bits} Bit wird nicht unterstützt (nur 16 Bit)`);
    if (!fmt.channels || !fmt.rate) throw new Error('WAV: kaputter Kopf');
    const frames = Math.floor(data.length / (2 * fmt.channels)); let pcm;
    if (fmt.channels === 1) pcm = Buffer.from(data.subarray(0, frames * 2));
    else { pcm = Buffer.alloc(frames * 2); for (let f = 0; f < frames; f++) { let s = 0; for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((f * fmt.channels + c) * 2); pcm.writeInt16LE(Math.round(s / fmt.channels), f * 2); } }
    return { rate: fmt.rate, pcm };
}
function buildWav(pcm, rate) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
    h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
}
// Lautstärke ändern (Faktor), ohne Übersteuern
function gain(pcm, factor) {
    if (factor === 1) return pcm;
    const out = Buffer.alloc(pcm.length);
    for (let i = 0; i + 1 < pcm.length; i += 2) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i) * factor))), i);
    return out;
}
// In gleich lange Stücke zerlegen (Standard 20 ms bei 8000 Hz = 320 Byte); das letzte wird mit Stille aufgefüllt
function* frames(pcm, frameBytes) {
    for (let i = 0; i < pcm.length; i += frameBytes) {
        const f = pcm.subarray(i, i + frameBytes);
        yield f.length === frameBytes ? f : Buffer.concat([f, Buffer.alloc(frameBytes - f.length)]);
    }
}
const frameBytesFor = (rate, ms = 20) => Math.round(rate * ms / 1000) * 2;
const durationMs = (pcm, rate) => Math.round((pcm.length / 2) / rate * 1000);
// Erzeugt einen Sinuston (für Tests und den Rufton-Test): freqHz, Dauer, Lautstärke 0..1
function tone(freqHz, ms, rate, amp = 0.5) {
    const n = Math.round(rate * ms / 1000), b = Buffer.alloc(n * 2);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freqHz * i / rate) * amp * 32767), i * 2);
    return b;
}
const silence = (ms, rate) => Buffer.alloc(Math.round(rate * ms / 1000) * 2);

module.exports = { rms, resample, parseWav, buildWav, gain, frames, frameBytesFor, durationMs, tone, silence };
