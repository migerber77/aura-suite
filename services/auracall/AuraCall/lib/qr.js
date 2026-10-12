'use strict';
/* QR-Code-Erzeuger ohne fremde Pakete: Byte-Modus, Versionen 1 bis 10 (bis 213 Zeichen bei Stufe M), Fehlerkorrektur L/M/Q/H, Ausgabe als SVG.
 * Gedacht für den Link zur Einrichtung der Zwei-Faktor-Anmeldung. Der Aufbau folgt der Norm ISO/IEC 18004. */
const ECL = { L: 0, M: 1, Q: 2, H: 3 }, ECL_FORMAT_BITS = [1, 0, 3, 2];
const ECC_PER_BLOCK = [[-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24], [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28]];
const NUM_BLOCKS = [[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8], [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8]];
const MAX_VERSION = 10;
const bit = (x, i) => ((x >>> i) & 1) !== 0;

function alignPositions(ver) {
    if (ver === 1) return []; const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, res = [6];
    for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos); return res;
}
function rawDataModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
}
const dataCodewords = (ver, ecl) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
// Reed-Solomon über GF(2^8) mit dem Polynom 0x11D
function rsMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
function rsDivisor(degree) {
    const r = new Array(degree).fill(0); r[degree - 1] = 1; let root = 1;
    for (let i = 0; i < degree; i++) { for (let j = 0; j < degree; j++) { r[j] = rsMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; } root = rsMul(root, 2); }
    return r;
}
function rsRemainder(data, divisor) { const r = divisor.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); divisor.forEach((c, i) => { r[i] ^= rsMul(c, f); }); } return r; }
function eccAndInterleave(data, ver, ecl) {
    const nb = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawDataModules(ver) / 8), shortBlocks = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const blocks = [], div = rsDivisor(eccLen);
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - eccLen + (i < shortBlocks ? 0 : 1)); k += dat.length; const ecc = rsRemainder(dat, div); if (i < shortBlocks) dat.push(0); blocks.push(dat.concat(ecc)); }
    const out = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= shortBlocks) out.push(b[i]); });
    return out;
}
function encodeData(bytes, ver, ecl) {
    const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
    const cap = dataCodewords(ver, ecl) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const out = new Array(bits.length / 8).fill(0); bits.forEach((b, i) => { out[i >>> 3] |= b << (7 - (i & 7)); }); return out;
}

function build(bytes, ver, ecl, forceMask) {
    const size = ver * 4 + 17, m = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPositions(ver), last = ap.length - 1;
    for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) { if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const formatBits = (mask) => {
        const data = (ECL_FORMAT_BITS[ecl] << 3) | mask; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((data << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) setFn(8, i, bit(bits, i)); setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
        for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(bits, i));
        for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(bits, i)); for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(bits, i));
        setFn(8, size - 8, true);
    };
    formatBits(0);
    if (ver >= 7) { let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const bits = (ver << 12) | rem; for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3), c = bit(bits, i); setFn(a, b, c); setFn(b, a, c); } }
    const codewords = eccAndInterleave(encodeData(bytes, ver, ecl), ver, ecl); let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) { const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v; if (!fn[y][x] && k < codewords.length * 8) { m[y][x] = bit(codewords[k >>> 3], 7 - (k & 7)); k++; } } }
    const applyMask = (mask) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { let inv; switch (mask) { case 0: inv = (x + y) % 2 === 0; break; case 1: inv = y % 2 === 0; break; case 2: inv = x % 3 === 0; break; case 3: inv = (x + y) % 3 === 0; break; case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break; case 5: inv = x * y % 2 + x * y % 3 === 0; break; case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break; default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0; } if (!fn[y][x] && inv) m[y][x] = !m[y][x]; } };
    const penalty = () => {
        let r = 0; const hist = () => [0, 0, 0, 0, 0, 0, 0];
        const add = (len, h) => { if (h[0] === 0) len += size; h.pop(); h.unshift(len); };
        const count = (h) => { const n = h[1], core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n; return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0); };
        const term = (color, len, h) => { if (color) { add(len, h); len = 0; } len += size; add(len, h); return count(h); };
        for (const rows of [true, false]) for (let a = 0; a < size; a++) { let color = false, run = 0; const h = hist(); for (let b = 0; b < size; b++) { const v = rows ? m[a][b] : m[b][a]; if (v === color) { run++; if (run === 5) r += 3; else if (run > 5) r++; } else { add(run, h); if (!color) r += count(h) * 40; color = v; run = 1; } } r += term(color, run, h) * 40; }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) r += 3; }
        let dark = 0; for (const row of m) for (const c of row) if (c) dark++; const total = size * size; r += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10; return r;
    };
    let best = forceMask === undefined ? 0 : forceMask, bestPen = Infinity;
    if (forceMask === undefined) for (let mask = 0; mask < 8; mask++) { applyMask(mask); formatBits(mask); const p = penalty(); if (p < bestPen) { best = mask; bestPen = p; } applyMask(mask); }
    applyMask(best); formatBits(best);
    return { size, version: ver, mask: best, modules: m };
}
// text: Zeichenkette (UTF-8) -> { size, version, mask, modules } (modules[y][x] === true: dunkel)
function encode(text, { ecl = 'M', mask } = {}) {
    const level = ECL[ecl]; if (level === undefined) throw new Error('Fehlerkorrektur: L, M, Q oder H'); const bytes = [...Buffer.from(String(text), 'utf8')];
    for (let ver = 1; ver <= MAX_VERSION; ver++) if (4 + (ver < 10 ? 8 : 16) + 8 * bytes.length <= dataCodewords(ver, level) * 8) return build(bytes, ver, level, mask);
    throw new Error('Der Text ist zu lang für diesen QR-Code.');
}
// SVG als Zeichenkette: weisser Grund, schwarze Module, 4 Module Rand (Pflicht für Handy-Kameras)
function toSvg(qr, { border = 4 } = {}) {
    const n = qr.size + border * 2, parts = [];
    for (let y = 0; y < qr.size; y++) { let x = 0; while (x < qr.size) { if (!qr.modules[y][x]) { x++; continue; } let e = x; while (e < qr.size && qr.modules[y][e]) e++; parts.push(`M${x + border},${y + border}h${e - x}v1h-${e - x}z`); x = e; } }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${parts.join('')}" fill="#000"/></svg>`;
}
// Zeilen aus "0" und "1" (für die Oberfläche: der Browser baut die Grafik selbst aus Elementen, ohne HTML einzusetzen)
const toRows = (qr) => qr.modules.map(r => r.map(c => (c ? '1' : '0')).join(''));
module.exports = { encode, toSvg, toRows, ECL, MAX_VERSION, dataCodewords };
