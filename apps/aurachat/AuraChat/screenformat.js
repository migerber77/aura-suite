/* AuraChat - Bildschirmformat
 *
 * Setzt die Oberfläche in eine feste Form, mittig mit schwarzem Rand. Gedacht für Bildschirme, deren Form man festlegen will (Kiosk im
 * Hochformat, Fernseher, Tablet ...). Zwei Arten:
 *   - SEITENVERHÄLTNIS (16:9, 4:3 ...): der Rahmen füllt das Fenster so gross wie möglich in dieser Form.
 *   - AUFLÖSUNG (1360x768, 1920x1080 ...): die Oberfläche wird genau in dieser Pixelgrösse aufgebaut (so wie auf einem Bildschirm dieser Auflösung)
 *     und passend zum Fenster vergrössert/verkleinert ("einpassen") oder in Originalgrösse gezeigt ("real", nie grösser als das Fenster).
 * "Automatisch" lässt alles wie bisher.
 * DREHUNG (0, 90, 180, 270 Grad im Uhrzeigersinn): gilt zusätzlich zu jeder Wahl (auch Automatisch). Für Bildschirme, die gedreht montiert sind, ohne dass das
 * Betriebssystem das Bild dreht. Der Aufbau (Quer-/Hochformat, Auflösung) bezieht sich auf das GEDREHTE Bild: bei 90°/270° tauschen Breite und Höhe des Fensters
 * die Rollen. Per Adresse: ?rotate=90 (zusammen mit ?format=... oder allein für die gespeicherte Wahl).
 *
 * Gilt pro Gerät (localStorage), gemeinsam für die Hauptansicht und die Kiosk-Ansicht. Per Adresse einstellbar: ?format=9:16 oder
 * ?format=1360x768 (dazu &fit=0 für Originalgrösse); "auto" setzt zurück. Wird von index.html und kiosk.html eingebunden, vor app.js.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'aura_screen_format';
    const EVENT_NAME = 'aura-screen-format-changed';

    // Gängige Formate. a:b ist die Schreibweise im Querformat (a >= b); im Hochformat wird sie umgedreht (16:9 -> 9:16).
    const PRESETS = [
        { id: '16:9',  a: 16, b: 9,  hintLandscape: 'Full HD, 4K, Fernseher, die meisten Monitore', hintPortrait: 'Smartphone, Hochformat-Display, Kiosk-Säule' },
        { id: '16:10', a: 16, b: 10, hintLandscape: 'Laptops, MacBook, manche Monitore',            hintPortrait: 'Tablets im Hochformat' },
        { id: '4:3',   a: 4,  b: 3,  hintLandscape: 'iPad, ältere Monitore',                        hintPortrait: 'iPad im Hochformat' },
        { id: '3:2',   a: 3,  b: 2,  hintLandscape: 'Surface, manche Tablets und Laptops',          hintPortrait: 'Surface im Hochformat' },
        { id: '21:9',  a: 21, b: 9,  hintLandscape: 'Ultrabreite Monitore',                         hintPortrait: 'Sehr hohe Displays, Totem' },
        { id: '1:1',   a: 1,  b: 1,  hintLandscape: 'Quadratische Displays',                        hintPortrait: 'Quadratische Displays' }
    ];
    const AUTO = Object.freeze({ mode: 'auto' });

    // Gängige Auflösungen (in CSS-Pixeln, wie ein Browser sie sieht), immer in Querformat-Schreibweise (lang x kurz). Im Hochformat wird getauscht.
    const RES_GROUPS = { monitor: 'Monitore & Fernseher', laptop: 'Laptops', tablet: 'Tablets', phone: 'Smartphones' };
    const RESOLUTIONS = [
        { w: 800,  h: 600,  name: 'SVGA',                   group: 'monitor' },
        { w: 1024, h: 768,  name: 'XGA, älteres iPad',      group: 'monitor' },
        { w: 1280, h: 720,  name: 'HD (720p)',              group: 'monitor' },
        { w: 1280, h: 1024, name: 'SXGA (5:4)',             group: 'monitor' },
        { w: 1600, h: 900,  name: 'HD+',                    group: 'monitor' },
        { w: 1600, h: 1200, name: 'UXGA (4:3)',             group: 'monitor' },
        { w: 1680, h: 1050, name: 'WSXGA+ (16:10)',         group: 'monitor' },
        { w: 1920, h: 1080, name: 'Full HD (1080p)',        group: 'monitor' },
        { w: 1920, h: 1200, name: 'WUXGA (16:10)',          group: 'monitor' },
        { w: 2560, h: 1080, name: 'Ultrabreit Full HD',     group: 'monitor' },
        { w: 2560, h: 1440, name: 'QHD / WQHD',             group: 'monitor' },
        { w: 3440, h: 1440, name: 'Ultrabreit QHD',         group: 'monitor' },
        { w: 3840, h: 2160, name: '4K UHD',                 group: 'monitor' },
        { w: 1280, h: 800,  name: 'WXGA',                   group: 'laptop' },
        { w: 1360, h: 768,  name: 'WXGA, häufig bei Kiosk-Displays', group: 'laptop' },
        { w: 1366, h: 768,  name: 'WXGA, häufigster Laptop', group: 'laptop' },
        { w: 1440, h: 900,  name: 'WXGA+',                  group: 'laptop' },
        { w: 1536, h: 864,  name: 'Full HD mit 125 % Skalierung', group: 'laptop' },
        { w: 2560, h: 1600, name: 'WQXGA',                  group: 'laptop' },
        { w: 1180, h: 820,  name: 'iPad Air',               group: 'tablet' },
        { w: 1194, h: 834,  name: 'iPad Pro 11"',           group: 'tablet' },
        { w: 1366, h: 1024, name: 'iPad Pro 12,9"',         group: 'tablet' },
        { w: 640,  h: 360,  name: 'Kleines Android-Handy',  group: 'phone' },
        { w: 667,  h: 375,  name: 'iPhone SE, iPhone 8',    group: 'phone' },
        { w: 844,  h: 390,  name: 'iPhone 12 bis 14',       group: 'phone' },
        { w: 852,  h: 393,  name: 'iPhone 15, 16',          group: 'phone' },
        { w: 915,  h: 412,  name: 'Pixel, Galaxy',          group: 'phone' },
        { w: 932,  h: 430,  name: 'iPhone Pro Max',         group: 'phone' }
    ];
    // Zulässiger Bereich (auch für eigene Eingaben): lange Seite 320 bis 7680, kurze Seite 240 bis 4320, höchstens 4:1
    const RES_LIMITS = { minLong: 320, maxLong: 7680, minShort: 240, maxShort: 4320, maxRatio: 4 };

    const presetById = (id) => PRESETS.find(p => p.id === id) || null;
    const presetByNumbers = (x, y) => PRESETS.find(p => (p.a === x && p.b === y) || (p.a === y && p.b === x)) || null;

    // ---- Lesen und Schreiben der Einstellung ----
    // Akzeptiert: "auto", "16:9|landscape", "16:9|portrait", und für die Adresse "9:16", "16x10", "4:3" (Hochformat, wenn die erste Zahl kleiner ist)
    // ---- Drehung ----
    const ROTATIONS = [0, 90, 180, 270];
    const rotationOf = (setting) => (setting && ROTATIONS.includes(setting.rotation) && setting.rotation) || 0;
    // Grad aus Text oder Zahl: "90", "90°", "90deg", "-90" (= 270), 360 (= 0); alles andere (Müll, 45, 450) = null
    function parseRotation(value) {
        if (value === null || value === undefined || typeof value === 'boolean') return null;
        const s = String(value).trim().toLowerCase().replace(/°$|deg$/, '').trim();
        if (!/^-?\d{1,3}$/.test(s)) return null;
        const n = Number(s);
        if (n % 90 !== 0 || n < -360 || n > 360) return null;
        return ((n % 360) + 360) % 360;
    }
    // Dieselbe Einstellung mit anderer Drehung (0 = ohne Eintrag, so bleiben alte Einstellungen unverändert); auch für Automatisch
    function withRotation(setting, deg) {
        const r = parseRotation(deg);
        if (r === null) return setting;
        if (!setting || setting.mode === 'auto') return r ? Object.freeze({ mode: 'auto', rotation: r }) : AUTO;
        const { rotation, ...rest } = setting;
        return Object.freeze(r ? { ...rest, rotation: r } : rest);
    }

    // parseOrNull: null bei einem unbekannten Wert (damit eine falsche Adresse nichts überschreibt); parse: dann Automatisch
    function parseOrNull(value) {
        const s = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
        const rm = s.match(/^(.*)\|rot(90|180|270)$/);   // gespeichert mit Drehung: "16:9|landscape|rot90", "auto|rot180"
        if (rm) {
            if (!rm[1] || /\|rot/.test(rm[1])) return null;   // ohne Format davor oder zweimal gedreht: nicht eindeutig, also ungültig
            const base = parseOrNull(rm[1]); return base ? withRotation(base, Number(rm[2])) : null;
        }
        if (!s || s === 'auto' || s === 'automatisch') return AUTO;
        let m = s.match(/^(\d{1,2}):(\d{1,2})\|(landscape|portrait)$/);
        if (m) { const p = presetByNumbers(Number(m[1]), Number(m[2])); return p ? fixed(p, p.a === p.b ? 'landscape' : m[3]) : null; }   // Zahlen in beiden Reihenfolgen, die Ausrichtung steht dabei
        m = s.match(/^(\d{1,2})\s*[:x]\s*(\d{1,2})$/);
        if (m) { const x = Number(m[1]), y = Number(m[2]); const p = presetByNumbers(x, y); return p ? fixed(p, x < y ? 'portrait' : 'landscape') : null; }
        // Auflösung: gespeichert "res:1360x768|landscape|fit", per Adresse "1360x768" (auch mit ×, Leerzeichen); Hochformat, wenn die erste Zahl kleiner ist
        m = s.match(/^res:(\d{3,4})x(\d{3,4})(?:\|(landscape|portrait))?(?:\|(fit|real))?$/);
        if (m) return makeResolution(Number(m[1]), Number(m[2]), { orientation: m[3], fit: m[4] !== 'real' });
        m = s.match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/);
        if (m) return makeResolution(Number(m[1]), Number(m[2]), {});
        return null;
    }
    // Auflösung prüfen und in die Querformat-Schreibweise bringen; null, wenn ausserhalb des zulässigen Bereichs
    function makeResolution(a, b, opts) {
        a = Math.round(Number(a)); b = Math.round(Number(b)); opts = opts || {};
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        const long = Math.max(a, b), short = Math.min(a, b);
        if (long < RES_LIMITS.minLong || long > RES_LIMITS.maxLong || short < RES_LIMITS.minShort || short > RES_LIMITS.maxShort || long / short > RES_LIMITS.maxRatio) return null;
        const orientation = long === short ? 'landscape' : (opts.orientation || (a < b ? 'portrait' : 'landscape'));
        const rot = parseRotation(opts.rotation) || 0;
        return Object.freeze({ mode: 'resolution', w: long, h: short, orientation, fit: opts.fit !== false, ...(rot ? { rotation: rot } : {}) });
    }
    const isResolution = (setting) => !!setting && setting.mode === 'resolution';
    const isFixedLike = (setting) => !!setting && (setting.mode === 'fixed' || setting.mode === 'resolution');
    const parse = (value) => parseOrNull(value) || AUTO;
    const fixed = (preset, orientation) => Object.freeze({ mode: 'fixed', id: preset.id, orientation: preset.a === preset.b ? 'landscape' : orientation });
    function serialize(setting) {
        if (setting && setting.mode === 'fixed') return `${setting.id}|${setting.orientation}${rotationOf(setting) ? '|rot' + rotationOf(setting) : ''}`;
        if (isResolution(setting)) return `res:${setting.w}x${setting.h}|${setting.orientation}|${setting.fit ? 'fit' : 'real'}${rotationOf(setting) ? '|rot' + rotationOf(setting) : ''}`;
        return rotationOf(setting) ? `auto|rot${rotationOf(setting)}` : 'auto';
    }
    const isPortrait = (setting) => isFixedLike(setting) && setting.orientation === 'portrait';

    // Verhältnis Breite/Höhe der Einstellung (z.B. 16:9 quer = 1.777, 16:9 hoch = 0.5625)
    function ratioOf(setting) {
        if (isResolution(setting)) return setting.orientation === 'portrait' ? setting.h / setting.w : setting.w / setting.h;
        if (!setting || setting.mode !== 'fixed') return null;
        const p = presetById(setting.id); if (!p) return null;
        return setting.orientation === 'portrait' ? p.b / p.a : p.a / p.b;
    }
    // Zahlen so, wie man sie schreibt: quer "16:9", hoch "9:16"
    // Seitenlängen so, wie man sie liest: quer 1360 x 768, hoch 768 x 1360
    const resDims = (setting) => (setting.orientation === 'portrait' ? { w: setting.h, h: setting.w } : { w: setting.w, h: setting.h });
    function ratioText(setting) {
        if (isResolution(setting)) { const d = resDims(setting); return `${d.w}×${d.h}`; }
        if (!setting || setting.mode !== 'fixed') return '';
        const p = presetById(setting.id); if (!p) return '';
        return setting.orientation === 'portrait' ? `${p.b}:${p.a}` : `${p.a}:${p.b}`;
    }
    function label(setting) {
        const rot = rotationOf(setting);
        return baseLabel(setting) + (rot ? ` · ${rot}° gedreht` : '');
    }
    function baseLabel(setting) {
        if (isResolution(setting)) return setting.w === setting.h ? `${setting.w}×${setting.h} Quadrat` : `${ratioText(setting)} ${setting.orientation === 'portrait' ? 'Hochformat' : 'Querformat'}`;
        if (!setting || setting.mode !== 'fixed') return 'Automatisch';
        const p = presetById(setting.id); if (!p) return 'Automatisch';
        return p.a === p.b ? '1:1 Quadrat' : `${ratioText(setting)} ${setting.orientation === 'portrait' ? 'Hochformat' : 'Querformat'}`;
    }
    // Liste für die Auswahl: je Format Zahlen, Hinweis, Vorschaugrösse (in einem Quadrat der Kantenlänge "box")
    function listPresets(orientation, box = 36) {
        return PRESETS.map(p => {
            const setting = fixed(p, orientation === 'portrait' ? 'portrait' : 'landscape');
            const r = ratioOf(setting);
            const w = r >= 1 ? box : Math.round(box * r), h = r >= 1 ? Math.round(box / r) : box;
            return { id: p.id, setting, ratioText: ratioText(setting), hint: setting.orientation === 'portrait' ? p.hintPortrait : p.hintLandscape, previewW: w, previewH: h, square: p.a === p.b };
        });
    }

    // Liste für die Auswahl der Auflösungen, nach Gruppen. Im Hochformat sind die Zahlen getauscht (1360×768 → 768×1360).
    function listResolutions(orientation, fit) {
        const o = orientation === 'portrait' ? 'portrait' : 'landscape';
        return Object.keys(RES_GROUPS).map(g => ({
            group: g, title: RES_GROUPS[g],
            items: RESOLUTIONS.filter(r => r.group === g).map(r => { const setting = makeResolution(r.w, r.h, { orientation: o, fit: fit !== false }); return { w: r.w, h: r.h, name: r.name, setting, text: ratioText(setting) }; })
        }));
    }
    const withFit = (setting, fit) => (isResolution(setting) ? makeResolution(setting.w, setting.h, { orientation: setting.orientation, fit: !!fit, rotation: rotationOf(setting) }) : setting);

    // Grösste Fläche mit diesem Verhältnis, die ins Fenster passt (ganze Pixel). Auto = null.
    // Auflösung: Grösse = genau diese Pixel, dazu der Massstab, mit dem sie ins Fenster passt (einpassen: auch vergrössern; real: nur verkleinern)
    function computeBox(winW, winH, setting) {
        const rot = rotationOf(setting), r = ratioOf(setting);
        if (!r && !rot) return null;                                  // Automatisch ohne Drehung: nichts zu tun
        const W0 = Math.floor(Number(winW)), H0 = Math.floor(Number(winH));
        if (!Number.isFinite(W0) || !Number.isFinite(H0) || !(W0 > 0) || !(H0 > 0)) return null;
        // Bei 90° und 270° liegt das Bild auf der Seite: für den Aufbau tauschen Breite und Höhe des Fensters die Rollen
        const [W, H] = rot === 90 || rot === 270 ? [H0, W0] : [W0, H0];
        const turned = rot ? { rotation: rot } : {};
        if (!r) return { w: W, h: H, scale: 1, ...turned };           // Automatisch + Drehung: das ganze (gedrehte) Fenster
        if (isResolution(setting)) {
            const d = resDims(setting); let scale = Math.min(W / d.w, H / d.h);
            if (!setting.fit) scale = Math.min(1, scale);
            return { w: d.w, h: d.h, scale: Math.round(scale * 10000) / 10000, ...turned };
        }
        let w, h;
        if (W / H > r) { h = H; w = Math.floor(H * r); } else { w = W; h = Math.floor(W / r); }
        return { w: Math.max(1, w), h: Math.max(1, h), ...turned };
    }

    // ---- Darstellung (CSS) ----
    // Der Rahmen ist der body: width/height gesetzt, "transform" macht ihn zum Bezugspunkt für alle "fixed"-Elemente - Fenster, Intro und Menüs
    // bleiben dadurch im Rahmen statt über den schwarzen Rand zu ragen.
    const CSS = [
        // Seitenverhältnis: der Rahmen ist der body, mittig im Fenster
        'html.aura-fmt { display: flex !important; align-items: center; justify-content: center; background: #000 !important; height: 100% !important; overflow: hidden; }',
        'html.aura-fmt body { width: var(--aura-w) !important; height: var(--aura-h) !important; flex: none !important; position: relative; transform: translateZ(0); overflow: hidden; box-shadow: 0 0 0 1px rgb(30 41 59); }',
        // Auflösung: der body hat genau diese Pixelgrösse und wird mit scale() ins Fenster gepasst (Mitte des Fensters = Mitte des Rahmens)
        'html.aura-res { position: relative !important; background: #000 !important; height: 100% !important; overflow: hidden; }',
        'html.aura-res body { position: absolute !important; left: 50%; top: 50%; width: var(--aura-w) !important; height: var(--aura-h) !important; flex: none !important; transform: translate(-50%, -50%) rotate(var(--aura-rot, 0deg)) scale(var(--aura-scale, 1)); transform-origin: center center; overflow: hidden; box-shadow: 0 0 0 1px rgb(30 41 59); }',
        // Drehung bei Automatisch oder Seitenverhältnis: gleiche Technik (Mitte des Fensters = Mitte des Rahmens, Drehpunkt in der Mitte), Massstab 1
        'html.aura-rot { position: relative !important; background: #000 !important; height: 100% !important; overflow: hidden; }',
        'html.aura-rot body { position: absolute !important; left: 50%; top: 50%; width: var(--aura-w) !important; height: var(--aura-h) !important; flex: none !important; transform: translate(-50%, -50%) rotate(var(--aura-rot, 0deg)) scale(var(--aura-scale, 1)); transform-origin: center center; overflow: hidden; box-shadow: 0 0 0 1px rgb(30 41 59); }',
        // Hochformat: Avatar oben (Höhe einstellbar, Vorgabe ein gutes Drittel), Chat darunter; Verlauf-Liste entfällt, damit der Platz für den Chat bleibt
        'html.aura-portrait #app-body { flex-direction: column !important; }',
        'html.aura-portrait #sidebar { width: 100% !important; height: var(--aura-sidebar-h, 36%) !important; border-right: 0 !important; border-bottom: 1px solid rgb(30 41 59); padding: 0.5rem 0.75rem !important; }',
        'html.aura-portrait #sidebar #avatar-container { min-height: 0 !important; }',
        'html.aura-portrait #sidebar #chat-history-list, html.aura-portrait #sidebar > div.mb-2 { display: none !important; }',
        'html.aura-portrait main { min-height: 0; }'
    ].join('\n');

    let state = { setting: AUTO, win: null, doc: null, resizeBound: false };

    function injectStyle(doc) {
        if (!doc || !doc.head || doc.getElementById('aura-screenformat-style')) return;
        const el = doc.createElement('style'); el.id = 'aura-screenformat-style'; el.textContent = CSS; doc.head.appendChild(el);
    }
    function apply(setting, win, doc) {
        win = win || state.win; doc = doc || state.doc;
        if (!win || !doc || !doc.documentElement) return null;
        const html = doc.documentElement;
        const box = computeBox(win.innerWidth, win.innerHeight, setting);
        html.classList.remove('aura-fmt', 'aura-res', 'aura-rot', 'aura-portrait', 'aura-r90', 'aura-r180', 'aura-r270');
        if (!box) {   // Automatisch ohne Drehung (oder Fenster noch ohne Grösse): alles zurücknehmen
            ['--aura-w', '--aura-h', '--aura-scale', '--aura-rot'].forEach(k => html.style.removeProperty(k));
            return null;
        }
        injectStyle(doc);
        const rot = rotationOf(setting);
        html.style.setProperty('--aura-w', box.w + 'px'); html.style.setProperty('--aura-h', box.h + 'px');
        if (rot) html.style.setProperty('--aura-rot', rot + 'deg'); else html.style.removeProperty('--aura-rot');
        if (isResolution(setting)) { html.style.setProperty('--aura-scale', String(box.scale)); html.classList.add('aura-res'); }
        else { html.style.removeProperty('--aura-scale'); html.classList.add(rot ? 'aura-rot' : 'aura-fmt'); }
        if (rot) html.classList.add('aura-r' + rot);
        // Hochformat-Layout: bei fester Wahl nach ihrer Ausrichtung, bei Automatisch + Drehung danach, ob das gedrehte Fenster höher als breit ist
        if (isFixedLike(setting) ? isPortrait(setting) : (rot !== 0 && box.h > box.w)) html.classList.add('aura-portrait');
        return box;
    }

    // ---- Speicher (kann in privaten Fenstern/gesperrt fehlen: dann gilt die Einstellung nur bis zum Neuladen) ----
    function load(win) { try { return parse(win.localStorage.getItem(STORAGE_KEY)); } catch { return AUTO; } }
    function save(setting, win) { try { win.localStorage.setItem(STORAGE_KEY, serialize(setting)); return true; } catch { return false; } }

    function get() { return state.setting; }
    function set(setting) {
        const s = isFixedLike(setting) || (setting && setting.mode === 'auto') ? parse(serialize(setting)) : AUTO;   // nur gültige Formate
        state.setting = s;
        if (state.win) save(s, state.win);
        apply(s);
        try { if (state.win && state.win.dispatchEvent && state.win.CustomEvent) state.win.dispatchEvent(new state.win.CustomEvent(EVENT_NAME, { detail: s })); } catch { /* Anzeige ist trotzdem gesetzt */ }
        return s;
    }

    // Beim Laden: Adresse ("?format=...") hat Vorrang und wird gemerkt, sonst die gespeicherte Einstellung
    function install(win, doc) {
        win = win || (typeof window !== 'undefined' ? window : null); doc = doc || (typeof document !== 'undefined' ? document : null);
        if (!win || !doc) return AUTO;
        state.win = win; state.doc = doc;
        let fromUrl = null;
        try {
            const q = new win.URLSearchParams(win.location.search);
            if (q.has('format')) fromUrl = parseOrNull(q.get('format'));   // ungültig = ignorieren
            if (fromUrl && isResolution(fromUrl) && q.has('fit')) fromUrl = withFit(fromUrl, q.get('fit') !== '0');   // &fit=0: Originalgrösse statt einpassen
            const rotUrl = q.has('rotate') ? parseRotation(q.get('rotate')) : null;   // ?rotate=90: Drehung (mit ?format=... oder allein für die gespeicherte Wahl); ungültig = ignorieren
            if (rotUrl !== null) fromUrl = withRotation(fromUrl !== null ? fromUrl : load(win), rotUrl);
        } catch { /* keine Adressangabe */ }
        state.setting = fromUrl !== null ? fromUrl : load(win);
        if (fromUrl !== null) save(state.setting, win);
        apply(state.setting);
        if (!state.resizeBound && win.addEventListener) {
            state.resizeBound = true;
            let queued = false;
            const again = () => { if (queued) return; queued = true; (win.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { queued = false; apply(state.setting); }); };
            win.addEventListener('resize', again);
            win.addEventListener('orientationchange', again);
        }
        return state.setting;
    }

    const api = { STORAGE_KEY, EVENT_NAME, PRESETS, RESOLUTIONS, RES_GROUPS, RES_LIMITS, ROTATIONS, AUTO, rotationOf, parseRotation, withRotation, parse, parseOrNull, serialize, ratioOf, ratioText, label, listPresets, listResolutions, makeResolution, withFit, isResolution, computeBox, isPortrait, apply, get, set, install, CSS, _state: state };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.AuraScreenFormat = api;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') install(window, document);
})(typeof window !== 'undefined' ? window : undefined);
