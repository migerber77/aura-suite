'use strict';
/* Apaleo-Vermittler ("Connect") für AuraChat: OAuth 2.0 Autorisierungscode-Ablauf (https://apaleo.dev/guides/oauth-connection/auth-code-grant.html).
 *
 * WARUM EIN VERMITTLER: AuraChat läuft selbst gehostet bei jedem Kunden. Apaleo verlangt für Store-Apps (a) eine vorab eingetragene redirect_uri und
 * (b) das geheime client_secret beim Tauschen und Erneuern der Token. Das Geheimnis darf nicht in jede Installation. Deshalb hält es dieser Vermittler
 * (beim Hersteller, im Lizenzserver) und die Installationen sprechen nur mit ihm. Er SPEICHERT KEINE TOKEN auf der Platte: Übergaben liegen nur
 * wenige Minuten im Speicher, das Erneuern geht ohne Speichern durch.
 *
 * Ablauf: (1) Installation: GET /apaleo/connect?return=<Adresse der Installation>/api/apaleo/return&challenge=<sha256(Geheimzahl)>
 *         (2) Bestätigungsseite: zeigt, WOHIN die Daten gehen (Schutz gegen untergeschobene Links), Knopf "Weiter zu Apaleo"
 *         (3) GET /apaleo/authorize?c=<Kennung>  -> Weiterleitung zu identity.apaleo.com (mit state)
 *         (4) Apaleo -> GET /apaleo/callback?code&state: Code gegen Token tauschen, Weiterleitung zur Installation mit einer EINMALIGEN Übergabe-Kennung
 *         (5) Installation (Server): POST /apaleo/handoff {handoff, verifier} -> Token (einmalig; nur mit der Geheimzahl, die zum challenge gehört)
 *         (6) Später: POST /apaleo/refresh {refresh_token} -> neues Token (der Vermittler fügt client_id/secret hinzu)
 * Aus dem Apaleo Store: GET /apaleo/landing fragt die Adresse der Installation ab und schickt dorthin (dort startet dann (1)). */
const crypto = require('crypto');

const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const rnd = (n = 24) => crypto.randomBytes(n).toString('hex');
const sha256hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function createApaleoConnect(opts = {}) {
  const o = { identityUrl: 'https://identity.apaleo.com', scopes: 'offline_access openid profile', confirmTtlMs: 15 * 60000, stateTtlMs: 10 * 60000, handoffTtlMs: 2 * 60000, returnPath: '/api/apaleo/return', maxEntries: 5000, timeoutMs: 15000, now: () => Date.now(), fetchImpl: globalThis.fetch, log: (m) => console.warn(m), ...opts };
  o.identityUrl = String(o.identityUrl).replace(/\/+$/, '');
  const configured = () => !!(o.clientId && o.clientSecret && o.redirectUri && /^https?:\/\//.test(o.redirectUri));
  const confirms = new Map(), states = new Map(), handoffs = new Map(), hits = new Map();

  const purge = () => { const t = o.now(); for (const [m, ttl] of [[confirms, o.confirmTtlMs], [states, o.stateTtlMs], [handoffs, o.handoffTtlMs]]) for (const [k, v] of m) if (t - v.at > ttl) m.delete(k); for (const [k, v] of hits) if (t - v.t > 60000) hits.delete(k); };
  const limited = (ip, bucket, max) => { const k = bucket + '|' + ip, t = o.now(), h = hits.get(k) || { n: 0, t }; if (t - h.t > 60000) { h.n = 0; h.t = t; } h.n++; hits.set(k, h); return h.n > max; };

  // Adresse der Installation, an die die Daten gehen: nur http(s), ohne Zugangsdaten, und NUR der feste Pfad (kein offener Weiterleiter)
  function parseReturn(raw) {
    if (typeof raw !== 'string' || raw.length < 8 || raw.length > 500) return null;
    let u; try { u = new URL(raw); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname || u.username || u.password || u.hash) return null;
    if (u.pathname !== o.returnPath || u.search) return null;
    return u;
  }

  // ---------- Seiten ----------
  const T = {
    de: { connect: 'Mit Apaleo verbinden', intro: 'AuraChat bekommt Zugriff auf Ihre Apaleo-Daten. Die Zugangsdaten gehen direkt an die AuraChat-Installation unter:', warn: 'Fahren Sie nur fort, wenn das Ihre eigene Installation ist.', go: 'Weiter zu Apaleo', cancel: 'Abbrechen', err: 'Das hat nicht geklappt', errText: 'Der Vorgang ist abgelaufen oder ungültig. Bitte in AuraChat unter „API → Apaleo“ noch einmal auf „Mit Apaleo verbinden“ klicken.', notConf: 'Die Verbindung zu Apaleo ist hier noch nicht eingerichtet.', landing: 'AuraChat für Apaleo', landingText: 'Verbinden Sie Ihr Apaleo-Konto mit Ihrer AuraChat-Installation. Geben Sie die Adresse Ihrer AuraChat-Installation ein, wie Sie sie im Browser öffnen:', instance: 'Adresse Ihrer AuraChat-Installation', next: 'Weiter', badInst: 'Diese Adresse ist ungültig. Erlaubt ist eine Adresse mit http:// oder https://, zum Beispiel https://chat.meinhotel.ch' },
    en: { connect: 'Connect with Apaleo', intro: 'AuraChat will get access to your Apaleo data. The credentials go directly to the AuraChat installation at:', warn: 'Only continue if this is your own installation.', go: 'Continue to Apaleo', cancel: 'Cancel', err: 'That did not work', errText: 'The process has expired or is invalid. Please click “Connect with Apaleo” again in AuraChat under “API → Apaleo”.', notConf: 'The connection to Apaleo is not set up here yet.', landing: 'AuraChat for Apaleo', landingText: 'Connect your Apaleo account with your AuraChat installation. Enter the address of your AuraChat installation, as you open it in the browser:', instance: 'Address of your AuraChat installation', next: 'Continue', badInst: 'This address is not valid. Use an address starting with http:// or https://, for example https://chat.myhotel.com' },
  };
  const lang = (req) => (/^de/i.test(String((req.headers && req.headers['accept-language']) || '')) ? 'de' : 'en');
  const page = (res, status, title, bodyHtml, extra = {}) => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}main{background:#111a2e;border:1px solid #1e293b;border-radius:16px;padding:28px;max-width:460px;width:100%;box-sizing:border-box}h1{font-size:18px;margin:0 0 12px}p{font-size:14px;line-height:1.5;color:#cbd5e1}code{background:#0b1220;padding:3px 8px;border-radius:6px;word-break:break-all;display:inline-block;color:#93c5fd}.btn{display:inline-block;background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 18px;font-size:14px;text-decoration:none;cursor:pointer}.sec{background:#1e293b;margin-left:8px}input{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#fff;margin:8px 0 12px}.warn{color:#fcd34d}</style></head><body><main>${bodyHtml}</main></body></html>`;
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://identity.apaleo.com; frame-ancestors 'none'; base-uri 'none'", ...extra });
    res.end(html);
  };
  const errPage = (req, res, status = 400) => { const t = T[lang(req)]; page(res, status, t.err, `<h1>${esc(t.err)}</h1><p>${esc(t.errText)}</p>`); };
  const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); };
  const redirect = (res, url) => { res.writeHead(302, { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); };
  const back = (returnUrl, params) => { const u = new URL(returnUrl); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); };

  // Gibt das gelesene JSON zurück, null bei ungültigem JSON und undefined, wenn der Inhalt zu gross war (dann ist schon mit 413 geantwortet; die Verbindung wird danach getrennt)
  async function readBody(req, res) {
    if (req.body !== undefined && req.body !== null && typeof req.body === 'object') return req.body;   // schon von Express gelesen
    return new Promise((resolve) => {
      const ch = []; let n = 0, done = false; const finish = (v) => { if (!done) { done = true; resolve(v); } };
      req.on('data', (d) => { if (done) return; n += d.length; if (n > 8192) { json(res, 413, { error: 'too_large' }); res.once('finish', () => req.destroy()); finish(undefined); } else ch.push(d); });
      req.on('error', () => finish(null));
      req.on('end', () => { try { finish(JSON.parse(Buffer.concat(ch).toString('utf8') || '{}')); } catch (e) { finish(null); } });
    });
  }
  async function identityPost(params) {
    try {
      const r = await o.fetchImpl(o.identityUrl + '/connect/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ ...params, client_id: o.clientId, client_secret: o.clientSecret }).toString(), signal: AbortSignal.timeout(o.timeoutMs) });
      let text = '', data = {};
      if (typeof r.text === 'function') { text = String(await r.text().catch(() => '')).slice(0, 4000); try { data = JSON.parse(text); } catch (e) { data = {}; } if (!data || typeof data !== 'object') data = {}; }
      else data = await r.json().catch(() => ({}));
      return { status: r.status, ok: r.ok, data, text, ctype: (r.headers && typeof r.headers.get === 'function' && r.headers.get('content-type')) || '' };
    } catch (e) { return { status: 0, ok: false, data: {} }; }
  }
  // Warum das Eintauschen des Codes bei Apaleo scheiterte, steht NUR im Protokoll dieses Servers (docker compose logs lic): Status und der Fehlercode von Apaleo mit einem Hinweis.
  // Nie ins Protokoll kommen der Code, der state, das Client-Secret, Adressen oder Beschreibungen von Apaleo (die können Namen enthalten). Der Browser sieht weiter nur die allgemeine Meldung.
  // Auszug aus der Antwort von Apaleo für das Protokoll (nur bei Serverfehlern oder ohne Fehlercode): Code, state, Client-Secret und E-Mail-Adressen werden entfernt,
  // Tags, Steuerzeichen und Mehrfach-Leerraum auch, und alles wird auf 200 Zeichen gekürzt.
  function safeExcerpt(text, secrets) {
    let t = String(text || '');
    for (const sec of secrets) { if (sec && String(sec).length >= 3) t = t.split(String(sec)).join('[entfernt]'); }
    return t.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[E-Mail entfernt]').replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  function logExchangeFailure(r, ctx) {
    const code = /^[A-Za-z_]{1,40}$/.test(String(r.data && r.data.error)) ? r.data.error : '';
    let hint;
    if (!r.status) hint = 'AuraLic erreicht identity.apaleo.com nicht (Netz, DNS, Firewall oder Zeitlimit). Von diesem Server aus prüfen: docker compose exec license-server wget -qO- https://identity.apaleo.com/.well-known/openid-configuration';
    else if (r.status === 401 || /^(invalid_client|unauthorized_client)$/.test(code)) hint = 'Apaleo lehnt die App ab: APALEO_CLIENT_ID oder APALEO_CLIENT_SECRET stimmen nicht mit der App in Apaleo überein (neu kopieren, keine Leerzeichen).';
    else if (code === 'invalid_grant') hint = 'Der Code wurde abgelehnt (schon benutzt, abgelaufen oder die redirect_uri weicht ab). APALEO_REDIRECT_URI muss EXAKT der in Apaleo eingetragenen entsprechen; nach einer Änderung der .env den Container NEU ERSTELLEN (docker compose up -d --force-recreate).';
    else if (r.status >= 500) hint = 'Apaleo meldet beim Abholen einen Serverfehler. Mögliche Ursachen: die redirect_uri weicht von der in der App bei Apaleo eingetragenen ab, die angefragten Scopes (APALEO_SCOPES) passen nicht zu den Scopes der App bei Apaleo, Client-ID oder Client-Secret sind falsch (vollständig neu kopieren), der Code war älter als 5 Minuten, die App ist bei Apaleo nicht (mehr) freigegeben, oder Apaleo hat gerade eine Störung.';
    else hint = 'Unerwartete Antwort von Apaleo.';
    // Die Einstellungen dieses Servers (keine Geheimnisse): so sieht der Betreiber sofort, was AuraLic zu Apaleo geschickt hat
    const used = ` Verwendet: redirect_uri=${o.redirectUri}, client_id=${o.clientId}, scopes="${o.scopes}", Länge des Client-Secrets=${String(o.clientSecret || '').length}.`;
    const ex = (r.status >= 500 || !code) && r.text ? ` Antwort von Apaleo (${(r.ctype || 'ohne Typ').split(';')[0]}, gekürzt): "${safeExcerpt(r.text, [ctx && ctx.code, ctx && ctx.state, o.clientSecret])}"` : '';
    o.log(`Apaleo: Die Zugangsdaten konnten nicht abgeholt werden (${r.status ? 'Status ' + r.status : 'keine Antwort'}${code ? ', Fehler "' + code + '"' : ''}). ${hint}${used}${ex}`);
  }
  const tokensOnly = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: Number(d.expires_in) || 3600 });   // id_token und alles andere bleibt hier

  // ---------- Verarbeitung ----------
  async function handle(req, res) {
    const u = new URL(req.url, 'http://x'), p = u.pathname; if (!p.startsWith('/apaleo/')) return false;
    const ip = String(req.ip || (req.socket && req.socket.remoteAddress) || '').replace(/^::ffff:/, ''), q = u.searchParams, method = req.method, t = T[lang(req)];
    purge();
    if (!configured()) { page(res, 503, t.notConf, `<h1>${esc(t.notConf)}</h1>`); return true; }
    if (confirms.size + states.size + handoffs.size > o.maxEntries) { json(res, 503, { error: 'busy' }); return true; }
    const isToken = p === '/apaleo/handoff' || p === '/apaleo/refresh';
    if (limited(ip, isToken ? 'tok' : 'page', isToken ? 20 : 60)) { json(res, 429, { error: 'rate_limited' }); return true; }

    if (method === 'GET' && p === '/apaleo/connect') {
      const ret = parseReturn(q.get('return')), ch = q.get('challenge');
      if (!ret || !/^[0-9a-f]{64}$/.test(String(ch))) { errPage(req, res); return true; }
      const id = rnd(24); confirms.set(id, { ret: ret.toString(), challenge: ch, at: o.now() });
      page(res, 200, t.connect, `<h1>${esc(t.connect)}</h1><p>${esc(t.intro)}</p><p><code>${esc(ret.origin)}</code></p><p class="warn">${esc(t.warn)}</p><p><a class="btn" href="/apaleo/authorize?c=${id}">${esc(t.go)}</a><a class="btn sec" href="${esc(ret.origin)}">${esc(t.cancel)}</a></p>`);
      return true;
    }
    if (method === 'GET' && p === '/apaleo/authorize') {
      const c = confirms.get(String(q.get('c'))); if (!c) { errPage(req, res); return true; } confirms.delete(String(q.get('c')));
      const state = rnd(24); states.set(state, { ret: c.ret, challenge: c.challenge, at: o.now() });
      const a = new URL(o.identityUrl + '/connect/authorize'); a.searchParams.set('response_type', 'code'); a.searchParams.set('scope', o.scopes); a.searchParams.set('client_id', o.clientId); a.searchParams.set('redirect_uri', o.redirectUri); a.searchParams.set('state', state);
      redirect(res, a.toString()); return true;
    }
    if (method === 'GET' && p === '/apaleo/callback') {
      const st = String(q.get('state') || ''), s = states.get(st); if (!s) { errPage(req, res); return true; } states.delete(st);   // jeder state gilt nur einmal
      if (q.get('error') || !q.get('code')) { redirect(res, back(s.ret, { apaleo_error: 'denied' })); return true; }
      const r = await identityPost({ grant_type: 'authorization_code', code: String(q.get('code')), redirect_uri: o.redirectUri });
      if (!r.ok || !r.data.access_token) { logExchangeFailure(r, { code: String(q.get('code')), state: st }); redirect(res, back(s.ret, { apaleo_error: 'exchange_failed' })); return true; }
      const h = rnd(32); handoffs.set(h, { tokens: tokensOnly(r.data), challenge: s.challenge, at: o.now(), tries: 0 });
      redirect(res, back(s.ret, { apaleo_handoff: h })); return true;
    }
    if (method === 'POST' && p === '/apaleo/handoff') {
      const b = await readBody(req, res); if (b === undefined) return true; if (!b || typeof b.handoff !== 'string' || typeof b.verifier !== 'string' || b.verifier.length < 16 || b.verifier.length > 200) { json(res, 400, { error: 'bad_request' }); return true; }
      const h = handoffs.get(b.handoff); if (!h) { json(res, 404, { error: 'unknown' }); return true; }
      if (!safeEq(sha256hex(b.verifier), h.challenge)) { h.tries++; if (h.tries >= 3) handoffs.delete(b.handoff); json(res, 403, { error: 'verifier' }); return true; }
      handoffs.delete(b.handoff); json(res, 200, h.tokens); return true;   // einmalig
    }
    if (method === 'POST' && p === '/apaleo/refresh') {
      const b = await readBody(req, res); if (b === undefined) return true; if (!b || typeof b.refresh_token !== 'string' || b.refresh_token.length < 8 || b.refresh_token.length > 2000 || /[\s\u0000-\u001f]/.test(b.refresh_token)) { json(res, 400, { error: 'bad_request' }); return true; }
      const r = await identityPost({ grant_type: 'refresh_token', refresh_token: b.refresh_token });
      if (r.ok && r.data.access_token) { json(res, 200, tokensOnly(r.data)); return true; }
      // Den Fehlertext von Apaleo NICHT weitergeben (er kann Benutzername und Konto enthalten): nur "neu verbinden" oder "später nochmal"
      const grant = r.status === 400 || r.status === 401 || /invalid_grant|invalid_client|unauthorized_client/.test(String(r.data && r.data.error)) || /no longer eligible/i.test(JSON.stringify(r.data || {}));
      json(res, grant && r.status !== 0 ? 400 : 502, { error: grant && r.status !== 0 ? 'reconnect' : 'upstream' }); return true;
    }
    if (method === 'GET' && p === '/apaleo/landing') {
      page(res, 200, t.landing, `<h1>${esc(t.landing)}</h1><p>${esc(t.landingText)}</p><form method="GET" action="/apaleo/landing/go"><input name="instance" type="url" required maxlength="300" placeholder="https://chat.meinhotel.ch" aria-label="${esc(t.instance)}"><button class="btn" type="submit">${esc(t.next)}</button></form>`); return true;
    }
    if (method === 'GET' && p === '/apaleo/landing/go') {
      let inst = null; try { const x = new URL(String(q.get('instance') || '')); if (/^https?:$/.test(x.protocol) && x.hostname && !x.username && !x.password) inst = x; } catch (e) { inst = null; }
      if (!inst) { page(res, 400, t.err, `<h1>${esc(t.err)}</h1><p>${esc(t.badInst)}</p><p><a class="btn" href="/apaleo/landing">${esc(t.next)}</a></p>`); return true; }
      redirect(res, inst.origin + '/api/apaleo/connect-start'); return true;   // dort startet der Ablauf (die Installation erzeugt die Geheimzahl)
    }
    json(res, 404, { error: 'not_found' }); return true;
  }
  return { handle, configured, _stores: { confirms, states, handoffs, hits }, _opts: o };
}

// In Express einhängen: vor der Anmelde-Prüfung (diese Adressen sind öffentlich: die Person kommt aus dem Browser von Apaleo zurück)
function registerApaleoConnect(app, opts) {
  const c = createApaleoConnect(opts);
  app.use((req, res, next) => { Promise.resolve(c.handle(req, res)).then((done) => { if (!done) next(); }).catch(() => { if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"internal"}'); } }); });
  return c;
}
module.exports = { createApaleoConnect, registerApaleoConnect, esc };
