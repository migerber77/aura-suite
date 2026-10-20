'use strict';
/* AuraCall - kleiner Webserver ohne fremde Pakete: Routen, JSON, Anmeldung per Cookie, Schutzmassnahmen, statische Dateien. */
const http = require('http');
const fs = require('fs'), path = require('path');
const crypto = require('crypto');
const { sha256 } = require('./db');

class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); } }

// Begrenzung "höchstens max Anfragen in windowMs je Schlüssel (z.B. Adresse)"
class RateLimiter {
    constructor({ windowMs, max }) { this.windowMs = windowMs; this.max = max; this.hits = new Map(); }
    allow(key, now = Date.now()) {
        const arr = (this.hits.get(key) || []).filter(t => t > now - this.windowMs);
        if (arr.length >= this.max) { this.hits.set(key, arr); return { ok: false, retryInMs: arr[0] + this.windowMs - now }; }
        arr.push(now); this.hits.set(key, arr);
        if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some(t => t > now - this.windowMs)) this.hits.delete(k);
        return { ok: true };
    }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webmanifest': 'application/manifest+json; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

class WebApp {
    constructor({ db, staticDir, trustProxy = false, maxBody = 1 << 20, cookieName = 'auracall_sid', serviceKeyCheck, licenseGuard, logger = console.log, apiLimiter } = {}) {
        this.db = db; this.staticDir = staticDir ? path.resolve(staticDir) : null; this.trustProxy = trustProxy; this.maxBody = maxBody; this.cookieName = cookieName;
        this.serviceKeyCheck = serviceKeyCheck || (() => false); this.licenseGuard = licenseGuard || null; this.log = logger; this.routes = []; this.pages = new Map();
        this.apiLimiter = apiLimiter || new RateLimiter({ windowMs: 60000, max: 600 });
        this.server = http.createServer((req, res) => this._handle(req, res).catch((e) => this._fatal(res, e)));
        this.server.headersTimeout = 15000; this.server.requestTimeout = 30000; this.server.keepAliveTimeout = 5000;
    }
    // opts: auth 'session' (Standard) | 'none' | 'service'; limiter: RateLimiter nur für diese Route; allowMustChange: auch mit "Passwort muss geändert werden"
    route(method, pattern, handler, opts = {}) {
        const names = []; const re = new RegExp('^' + pattern.replace(/\/:([A-Za-z]+)/g, (m, n) => { names.push(n); return '/([^/]+)'; }) + '/?$');
        this.routes.push({ method, re, names, handler, opts: { auth: 'session', ...opts } });
    }
    // Öffentliche Seiten, die der Server selbst als HTML baut (z.B. die Datenschutzerklärung): handler({ query }) -> HTML-Text. Ohne Anmeldung erreichbar, nur lesend.
    page(pathname, handler) { this.pages.set(pathname, handler); }
    ip(req) { if (this.trustProxy) { const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f.slice(0, 64); } return req.socket.remoteAddress || '?'; }
    isHttps(req) { return !!req.socket.encrypted || (this.trustProxy && req.headers['x-forwarded-proto'] === 'https'); }
    _headers(res, req, api) {
        const h = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', 'Permissions-Policy': 'microphone=(), camera=(), geolocation=()' };
        if (api) h['Cache-Control'] = 'no-store'; if (this.isHttps(req)) h['Strict-Transport-Security'] = 'max-age=31536000';
        for (const [k, v] of Object.entries(h)) res.setHeader(k, v);
    }
    _send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
        if (res.headersSent) return; const data = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
        res.writeHead(status, { 'Content-Type': type, 'Content-Length': data.length, ...extra }); res.end(data);
    }
    _fatal(res, e) { this.log('Interner Fehler: ' + (e && e.stack || e)); if (!res.headersSent) this._send(res, 500, { error: 'Interner Fehler' }); else res.destroy(); }
    _cookie(req) { const m = {}; for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) m[part.slice(0, i).trim()] = part.slice(i + 1).trim(); } return m; }
    async _body(req) {
        if (!MUTATING.has(req.method)) return undefined;
        const len = Number(req.headers['content-length']); if (len > this.maxBody) throw new HttpError(413, 'Die Anfrage ist zu gross.');
        const chunks = []; let n = 0;
        for await (const c of req) { n += c.length; if (n > this.maxBody) throw new HttpError(413, 'Die Anfrage ist zu gross.'); chunks.push(c); }
        if (!n) return {};
        if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Es wird JSON erwartet (Content-Type: application/json).');
        try { const v = JSON.parse(Buffer.concat(chunks).toString('utf-8')); if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error(); return v; } catch { throw new HttpError(400, 'Das ist kein gültiges JSON-Objekt.'); }
    }
    async _handle(req, res) {
        let url; try { url = new URL(req.url, 'http://x'); } catch { return this._send(res, 400, { error: 'Ungültige Adresse' }); }
        const isApi = url.pathname.startsWith('/api/');
        this._headers(res, req, isApi);
        if (!isApi) { const page = this.pages.get(url.pathname.replace(/\/+$/, '') || '/'); if (page && (req.method === 'GET' || req.method === 'HEAD')) { let html; try { html = await page({ query: Object.fromEntries(url.searchParams), req }); } catch (e) { this.log('Fehler auf Seite ' + url.pathname + ': ' + (e && e.stack || e)); return this._send(res, 500, 'Interner Fehler', 'text/plain; charset=utf-8'); } return this._send(res, 200, req.method === 'HEAD' ? '' : html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' }); } return this._static(req, res, url); }
        const ip = this.ip(req), rl = this.apiLimiter.allow(ip);
        if (!rl.ok) return this._send(res, 429, { error: 'Zu viele Anfragen. Bitte kurz warten.' }, undefined, { 'Retry-After': String(Math.ceil(rl.retryInMs / 1000)) });
        const route = this.routes.find(r => r.method === req.method && r.re.test(url.pathname));
        if (!route) { const other = this.routes.some(r => r.re.test(url.pathname)); return this._send(res, other ? 405 : 404, { error: other ? 'Methode nicht erlaubt' : 'Nicht gefunden' }); }
        const params = {}; const m = route.re.exec(url.pathname); route.names.forEach((n, i) => { try { params[n] = decodeURIComponent(m[i + 1]); } catch { params[n] = m[i + 1]; } });
        const o = route.opts, cookies = this._cookie(req); const token = cookies[this.cookieName]; let user = null;
        try {
            if (o.limiter) { const l = o.limiter.allow(ip); if (!l.ok) throw new HttpError(429, 'Zu viele Versuche. Bitte später erneut versuchen.', { retryInMs: l.retryInMs }); }
            if (o.auth === 'service') {
                const bearer = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || ''); if (!bearer || !this.serviceKeyCheck(bearer[1])) throw new HttpError(401, 'Dienst-Schlüssel fehlt oder ist ungültig.');
            } else if (o.auth === 'session') {
                user = this.db.getSession(token); if (!user) throw new HttpError(401, 'Bitte anmelden.');
                if ((user.mustChange || user.mustSetup2fa) && !o.allowMustChange) throw new HttpError(403, user.mustChange ? 'Bitte zuerst das Passwort ändern.' : 'Bitte zuerst die Zwei-Faktor-Anmeldung einrichten (für alle Konten vorgeschrieben).', { mustChange: !!user.mustChange, mustSetup2fa: !user.mustChange && !!user.mustSetup2fa });
            }
            // Schutz vor Anfragen von fremden Seiten (CSRF): Änderungen nur mit unserem eigenen Kopf und - falls angegeben - gleicher Herkunft; gilt für alle Cookie-Anfragen
            if (MUTATING.has(req.method) && o.auth !== 'service') {
                if (req.headers['x-requested-with'] !== 'AuraCall') throw new HttpError(403, 'Anfrage abgelehnt (fehlender Schutz-Kopf).');
                const origin = req.headers.origin; if (origin) { let oh; try { oh = new URL(origin).host; } catch { oh = ''; } const host = (this.trustProxy && req.headers['x-forwarded-host']) || req.headers.host; if (oh !== host) throw new HttpError(403, 'Anfrage abgelehnt (fremde Herkunft).'); }
            }
            // Lizenz: ohne gültige Lizenz (und nach der Probezeit) sind alle Seiten gesperrt (402) ausser denen, die ausdrücklich "license: false" tragen (Anmelden, Konto, 2FA, Lizenz selbst). Erst nach Anmeldung und Schutz-Prüfung: Unbekannte sehen nie, dass es um die Lizenz geht.
            if (o.auth !== 'none' && o.license !== false && this.licenseGuard) { const g = this.licenseGuard(); if (!g.ok) throw new HttpError(402, g.message, { licenseRequired: true }); }
            const body = await this._body(req);
            const ctx = { req, res, params, query: Object.fromEntries(url.searchParams), body: body || {}, user, token, ip, app: this,
                setSession: (t, maxAgeS) => res.setHeader('Set-Cookie', `${this.cookieName}=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${this.isHttps(req) ? '; Secure' : ''}`),
                clearSession: () => res.setHeader('Set-Cookie', `${this.cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${this.isHttps(req) ? '; Secure' : ''}`) };
            const result = await route.handler(ctx);
            if (!res.headersSent) this._send(res, result && result.__status ? result.__status : 200, result === undefined ? { ok: true } : (result && result.__status ? result.body : result));
        } catch (e) {
            if (e instanceof HttpError) { const { status, message, ...extra } = e; return this._send(res, status, { error: message, ...Object.fromEntries(Object.entries(extra).filter(([k]) => ['mustChange', 'mustSetup2fa', 'licenseRequired', 'retryInMs', 'details'].includes(k))) }, undefined, e.status === 429 && e.retryInMs ? { 'Retry-After': String(Math.ceil(e.retryInMs / 1000)) } : {}); }
            this.log(`Fehler bei ${req.method} ${url.pathname}: ${e && e.stack || e}`); this._send(res, 500, { error: 'Interner Fehler' });
        }
    }
    _static(req, res, url) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return this._send(res, 405, { error: 'Methode nicht erlaubt' });
        if (!this.staticDir) return this._send(res, 404, 'Nicht gefunden', 'text/plain; charset=utf-8');
        let p; try { p = decodeURIComponent(url.pathname); } catch { return this._send(res, 400, 'Ungültige Adresse', 'text/plain; charset=utf-8'); }
        if (p.includes('\0') || p.includes('\\') || p.split('/').includes('..') || p.split('/').some(s => s.startsWith('.'))) return this._send(res, 404, 'Nicht gefunden', 'text/plain; charset=utf-8');
        if (p.endsWith('/')) p += 'index.html'; if (p === '') p = '/index.html';
        const file = path.resolve(this.staticDir, '.' + p), type = TYPES[path.extname(file).toLowerCase()];
        if (!type || !(file + path.sep).startsWith(this.staticDir + path.sep) && file !== this.staticDir) return this._send(res, 404, 'Nicht gefunden', 'text/plain; charset=utf-8');
        let real; try { real = fs.realpathSync(file); if (!real.startsWith(fs.realpathSync(this.staticDir) + path.sep)) throw new Error(); const st = fs.statSync(real); if (!st.isFile()) throw new Error(); } catch { return this._send(res, 404, 'Nicht gefunden', 'text/plain; charset=utf-8'); }
        const data = fs.readFileSync(real), video = /^video\//.test(type);
        const headers = { 'Content-Type': type, 'Cache-Control': /\.(png|ico|woff2|mp4|webm)$/.test(real) ? 'public, max-age=86400' : 'no-cache' };
        if (video) headers['Accept-Ranges'] = 'bytes';
        if (video && req.headers.range) {
            // Teilabruf: Safari und iPhones verlangen ihn für Videos. Genau ein Bereich (bytes=a-b, bytes=a-, bytes=-n).
            const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range).trim()); let start, end;
            if (m && (m[1] !== '' || m[2] !== '')) { if (m[1] === '') { start = Math.max(0, data.length - Number(m[2])); end = data.length - 1; } else { start = Number(m[1]); end = m[2] === '' ? data.length - 1 : Math.min(Number(m[2]), data.length - 1); } }
            if (start === undefined || !(start >= 0) || start > end || start >= data.length) { res.writeHead(416, { 'Content-Range': 'bytes */' + data.length, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(); }
            const part = data.subarray(start, end + 1); res.writeHead(206, { ...headers, 'Content-Range': 'bytes ' + start + '-' + end + '/' + data.length, 'Content-Length': part.length }); return res.end(req.method === 'HEAD' ? undefined : part);
        }
        res.writeHead(200, { ...headers, 'Content-Length': data.length }); res.end(req.method === 'HEAD' ? undefined : data);
    }
    listen(port, host = '0.0.0.0') { return new Promise((res, rej) => { this.server.once('error', rej); this.server.listen(port, host, () => { this.server.removeListener('error', rej); res(this.server.address().port); }); }); }
    close() { return new Promise((res) => { this.server.closeAllConnections && this.server.closeAllConnections(); this.server.close(() => res()); }); }
}
module.exports = { WebApp, HttpError, RateLimiter };
