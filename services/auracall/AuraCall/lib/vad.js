'use strict';
/* AuraCall - Sprechpausen-Erkennung (VAD): erkennt in einem Strom von 20-ms-Stücken, wann jemand zu sprechen anfängt und wann er fertig ist.
 * Einfach und ohne fremde Pakete: Lautstärke gegen eine Schwelle, die sich dem Grundrauschen der Leitung anpasst; mit Hysterese, damit kurze
 * Lücken im Wort nicht als Ende zählen. Zeiten werden in Stücken gezählt (nicht in Uhrzeit), das macht Tests schnell und genau. */
const { rms } = require('./audio');

class Vad {
    constructor(o = {}) {
        this.frameMs = o.frameMs || 20;
        this.minRms = o.minRms !== undefined ? o.minRms : 350;               // niedrigste Schwelle (RMS), darunter ist es nie Sprache
        this.noiseFactor = o.noiseFactor !== undefined ? o.noiseFactor : 3;  // Schwelle = max(minRms, Grundrauschen * Faktor)
        this.startFrames = Math.max(1, Math.round((o.startMs !== undefined ? o.startMs : 100) / this.frameMs));       // so lange muss es laut sein, damit es als Sprechbeginn zählt
        this.endFrames = Math.max(1, Math.round((o.endSilenceMs !== undefined ? o.endSilenceMs : 700) / this.frameMs)); // so lange Ruhe = fertig
        this.minUtteranceFrames = Math.max(1, Math.round((o.minUtteranceMs !== undefined ? o.minUtteranceMs : 250) / this.frameMs)); // kürzer = Klick/Husten, verwerfen
        this.maxFrames = Math.max(1, Math.round((o.maxUtteranceMs !== undefined ? o.maxUtteranceMs : 20000) / this.frameMs));
        this.preRollFrames = Math.max(0, Math.round((o.preRollMs !== undefined ? o.preRollMs : 200) / this.frameMs));  // Stück vor dem Beginn mitnehmen (sonst fehlt der Wortanfang)
        this.tailKeep = Math.round(100 / this.frameMs);                       // am Ende so viel Ruhe mitgeben
        this.noise = o.initialNoise !== undefined ? o.initialNoise : 80;
        this.reset();
    }
    reset() { this.speaking = false; this.loud = 0; this.quiet = 0; this.buf = []; this.pre = []; this.frameCount = 0; this.lead = 0; }
    get threshold() { return Math.max(this.minRms, this.noise * this.noiseFactor); }
    // Ein Stück verarbeiten. Gibt null zurück oder { type: 'start' } / { type: 'end', pcm, reason: 'silence'|'max', speechMs }
    push(frame) {
        const level = rms(frame), hi = this.threshold, lo = hi * 0.6;
        if (!this.speaking) {
            // Grundrauschen nachführen, solange niemand spricht (langsam hoch, schnell runter)
            this.noise = level < this.noise ? this.noise * 0.9 + level * 0.1 : this.noise * 0.995 + level * 0.005;
            this.pre.push(frame); if (this.pre.length > this.preRollFrames + this.startFrames) this.pre.shift();
            this.loud = level > hi ? this.loud + 1 : 0;
            if (this.loud >= this.startFrames) { this.speaking = true; this.quiet = 0; this.buf = this.pre.slice(); this.pre = []; this.frameCount = this.buf.length; this.lead = Math.max(0, this.buf.length - this.startFrames); return { type: 'start' }; }   // lead: Stille VOR dem Sprechen (Vorlauf), zählt nicht als Sprache
            return null;
        }
        this.buf.push(frame); this.frameCount++;
        if (level > lo) this.quiet = 0; else this.quiet++;
        if (this.quiet >= this.endFrames) return this._finish('silence');
        if (this.frameCount >= this.maxFrames) return this._finish('max');
        return null;
    }
    _finish(reason) {
        const keepEnd = reason === 'silence' ? Math.max(0, this.buf.length - this.quiet + this.tailKeep) : this.buf.length;   // Ruhe am Ende kürzen
        const used = this.buf.slice(0, Math.min(this.buf.length, keepEnd));
        const speechFrames = this.buf.length - this.lead - (reason === 'silence' ? this.quiet : 0);   // ohne Vorlauf und ohne die Ruhe am Ende
        this.speaking = false; this.loud = 0; this.quiet = 0; this.buf = []; this.pre = []; this.frameCount = 0; this.lead = 0;
        if (speechFrames < this.minUtteranceFrames) return { type: 'discard', reason: 'too-short' };
        return { type: 'end', pcm: Buffer.concat(used), reason, speechMs: speechFrames * this.frameMs };
    }
}
module.exports = { Vad };
