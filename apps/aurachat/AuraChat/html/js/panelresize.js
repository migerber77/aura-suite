/* AuraChat - Seitenleiste (Aura-Fenster) mit der Maus vergrössern oder verkleinern
 *
 * Zwischen der Seitenleiste mit Aura und dem Chat sitzt ein schmaler Griff (#sidebar-resizer):
 *   - mit der Maus (oder dem Finger) ziehen = Breite ändern; im Hochformat-Layout (Aura oben) = Höhe ändern
 *   - Pfeiltasten bei fokussiertem Griff = in kleinen Schritten (mit Umschalttaste grösser)
 *   - Doppelklick = zurück auf die Vorgabe
 * Die Grösse wird pro Gerät gemerkt (localStorage), getrennt für Quer- und Hochformat-Layout, und immer so begrenzt, dass der Chat Platz behält.
 * Arbeitet mit dem Bildschirmformat zusammen: ist der Rahmen vergrössert/verkleinert (Auflösung "einpassen"), wird die Mausbewegung durch den
 * Massstab geteilt, damit die Leiste dem Zeiger genau folgt. Ist der Rahmen GEDREHT (90/180/270 Grad), wird die Mausbewegung zusätzlich in die Achsen
 * des gedrehten Bildes umgerechnet (bei 90° heisst "Maus nach rechts" im Bild "nach oben"); Pfeiltasten gelten für die Richtung auf dem Bildschirm.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'aura_sidebar_size';
    const LIMITS = { minWidth: 220, minMainWidth: 360, defaultWidth: 320, minHeightPct: 18, maxHeightPct: 70, defaultHeightPct: 36 };
    const STEP_PX = 16, STEP_PCT = 2;

    // Nur echte Zahlen (oder Zahlen als Text) gelten. "Nichts" (null, undefined, leer, true/false, Listen) ist KEINE Null - sonst würde eine unbekannte Rahmenbreite als 0 Pixel gelesen
    const num = (v) => {
        if (typeof v === 'string' ? v.trim() === '' : typeof v !== 'number') return null;
        const n = Number(v); return Number.isFinite(n) ? n : null;
    };
    // Breite in Pixel (Querformat-Layout): mindestens 220, höchstens so, dass der Chat noch 360 Pixel behält (bei kleinen Rahmen nie unter dem Minimum)
    function clampWidth(w, containerW) {
        const c = num(containerW), x = num(w);
        if (x === null) return LIMITS.defaultWidth;
        const max = Math.max(LIMITS.minWidth, (c === null ? 4000 : c) - LIMITS.minMainWidth);
        return Math.round(Math.min(max, Math.max(LIMITS.minWidth, x)));
    }
    // Höhe in Prozent des Rahmens (Hochformat-Layout, Aura oben): 18 bis 70 %
    function clampHeightPct(p) {
        const x = num(p);
        if (x === null) return LIMITS.defaultHeightPct;
        return Math.round(Math.min(LIMITS.maxHeightPct, Math.max(LIMITS.minHeightPct, x)) * 10) / 10;
    }
    // Neue Grösse beim Ziehen: Ausgangsgrösse + Mausweg (in Bildschirmpixeln) geteilt durch den Massstab des Rahmens
    const dragWidth = (startWidth, deltaPx, scale, containerW) => clampWidth(startWidth + deltaPx / (num(scale) > 0 ? scale : 1), containerW);
    const dragHeightPct = (startHeightPx, deltaPx, scale, containerH) => clampHeightPct(((startHeightPx + deltaPx / (num(scale) > 0 ? scale : 1)) / Math.max(1, num(containerH) || 1)) * 100);

    // Mausweg auf dem Bildschirm (dx, dy) -> Weg in den Achsen des GEDREHTEN Bildes (Drehung im Uhrzeigersinn, y zeigt nach unten):
    // 90°: Bild-x zeigt auf dem Bildschirm nach unten, Bild-y nach links; 180°: beide umgekehrt; 270°: Bild-x nach oben, Bild-y nach rechts.
    function logicalDelta(dx, dy, rot) {
        const r = ((Number(rot) % 360) + 360) % 360;
        switch (r) {
            case 90: return { x: dy + 0, y: -dx + 0 };
            case 180: return { x: -dx + 0, y: -dy + 0 };
            case 270: return { x: -dy + 0, y: dx + 0 };
            default: return { x: dx + 0, y: dy + 0 };
        }
    }

    // ---- Speicher: { w: Pixel (quer), h: Prozent (hoch) } - fehlende Werte = Vorgabe ----
    function load(win) {
        try {
            const o = JSON.parse(win.localStorage.getItem(STORAGE_KEY));
            const out = {};
            if (o && num(o.w) !== null) out.w = clampWidth(o.w, null);
            if (o && num(o.h) !== null) out.h = clampHeightPct(o.h);
            return out;
        } catch { return {}; }
    }
    function save(sizes, win) {
        try {
            const clean = {};
            if (num(sizes.w) !== null) clean.w = Math.round(sizes.w);
            if (num(sizes.h) !== null) clean.h = sizes.h;
            if (Object.keys(clean).length) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); else win.localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch { return false; }
    }

    const CSS = [
        '#sidebar { transition: none !important; }',   // kein Nachlaufen beim Ziehen und keine Animation beim Laden der gemerkten Grösse
        '#sidebar-resizer { flex: none; position: relative; z-index: 45; width: 6px; margin: 0 -3px; cursor: col-resize; touch-action: none; outline: none; }',
        '#sidebar-resizer::after { content: ""; position: absolute; top: 50%; left: 1px; width: 4px; height: 56px; margin-top: -28px; border-radius: 2px; background: #64748b; opacity: 0; transition: opacity .15s; }',
        '#sidebar-resizer:hover::after, #sidebar-resizer:focus-visible::after, html.aura-resizing #sidebar-resizer::after { opacity: 1; }',
        '#sidebar-resizer:focus-visible::after { background: #3b82f6; }',
        '#sidebar.hidden + #sidebar-resizer { display: none; }',
        'html.aura-portrait #sidebar-resizer { width: 100%; height: 6px; margin: -3px 0; cursor: row-resize; }',
        'html.aura-portrait #sidebar-resizer::after { top: 1px; left: 50%; width: 56px; height: 4px; margin: 0 0 0 -28px; }',
        'html.aura-resizing, html.aura-resizing * { user-select: none !important; cursor: col-resize !important; }',
        'html.aura-resizing.aura-portrait, html.aura-resizing.aura-portrait * { cursor: row-resize !important; }',
        // Gedreht um 90/270 Grad: ein senkrechter Griff im Bild liegt auf dem Bildschirm waagrecht (und umgekehrt), also auch der Zeiger
        'html.aura-r90 #sidebar-resizer, html.aura-r270 #sidebar-resizer { cursor: row-resize; }',
        'html.aura-r90.aura-portrait #sidebar-resizer, html.aura-r270.aura-portrait #sidebar-resizer { cursor: col-resize; }',
        'html.aura-resizing.aura-r90, html.aura-resizing.aura-r90 *, html.aura-resizing.aura-r270, html.aura-resizing.aura-r270 * { cursor: row-resize !important; }',
        'html.aura-resizing.aura-portrait.aura-r90, html.aura-resizing.aura-portrait.aura-r90 *, html.aura-resizing.aura-portrait.aura-r270, html.aura-resizing.aura-portrait.aura-r270 * { cursor: col-resize !important; }'
    ].join('\n');

    let ctl = null;
    function install(win, doc) {
        win = win || (typeof window !== 'undefined' ? window : null); doc = doc || (typeof document !== 'undefined' ? document : null);
        if (!win || !doc) return null;
        const sidebar = doc.getElementById('sidebar'), handle = doc.getElementById('sidebar-resizer'), app = doc.getElementById('app-body') || doc.body;
        if (!sidebar || !handle || !app) return null;
        const html = doc.documentElement;
        if (doc.head && !doc.getElementById('aura-panelresize-style')) { const st = doc.createElement('style'); st.id = 'aura-panelresize-style'; st.textContent = CSS; doc.head.appendChild(st); }

        let sizes = load(win);
        const isPortrait = () => html.classList.contains('aura-portrait');
        const container = () => ({ w: app.clientWidth || app.offsetWidth || win.innerWidth, h: app.clientHeight || app.offsetHeight || win.innerHeight });
        // Stilvariable des Bildschirmformats lesen (NaN, wenn es sie nicht gibt oder der Browser das Lesen nicht kann)
        const cssVar = (name) => { try { return typeof html.style.getPropertyValue === 'function' ? parseFloat(html.style.getPropertyValue(name)) : NaN; } catch { return NaN; } };
        // Drehung des Rahmens in Grad (0/90/180/270), vom Bildschirmformat als Stilvariable gesetzt
        const rotationDeg = () => { const v = cssVar('--aura-rot'); return Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0; };
        // Massstab des Rahmens (Auflösung "einpassen"): bevorzugt die Stilvariable des Bildschirmformats; sonst angezeigte geteilt durch Layout-Breite
        // (bei 90°/270° ist die angezeigte Breite die Höhe des Umrisses)
        const scaleOf = () => {
            const v = cssVar('--aura-scale'); if (v > 0) return v;
            try {
                const r = app.getBoundingClientRect(), rot = rotationDeg(), w = app.offsetWidth, shown = (rot === 90 || rot === 270) ? r.height : r.width;
                return w > 0 && shown > 0 ? shown / w : 1;
            } catch { return 1; }
        };
        // Grösse der Seitenleiste im Aufbau (ohne Massstab und Drehung): bevorzugt die Layout-Masse, die von Transformationen unberührt sind
        const sidebarSize = (portrait, sc, rot) => {
            const ow = sidebar.offsetWidth, oh = sidebar.offsetHeight;
            if (ow > 0 && oh > 0) return portrait ? oh : ow;
            const r = sidebar.getBoundingClientRect(), swap = rot === 90 || rot === 270;
            return (portrait ? (swap ? r.width : r.height) : (swap ? r.height : r.width)) / sc;
        };

        function current() { const c = container(); return isPortrait() ? { kind: 'h', value: clampHeightPct(sizes.h), c } : { kind: 'w', value: clampWidth(sizes.w === undefined ? LIMITS.defaultWidth : sizes.w, c.w), c }; }
        function render() {
            const cur = current();
            if (cur.kind === 'w') {
                sidebar.style.width = cur.value + 'px';
                html.style.removeProperty('--aura-sidebar-h');
                handle.setAttribute('aria-orientation', 'vertical');
                handle.setAttribute('aria-valuemin', String(LIMITS.minWidth)); handle.setAttribute('aria-valuemax', String(Math.max(LIMITS.minWidth, cur.c.w - LIMITS.minMainWidth))); handle.setAttribute('aria-valuenow', String(cur.value));
            } else {
                sidebar.style.width = '';
                html.style.setProperty('--aura-sidebar-h', cur.value + '%');
                handle.setAttribute('aria-orientation', 'horizontal');
                handle.setAttribute('aria-valuemin', String(LIMITS.minHeightPct)); handle.setAttribute('aria-valuemax', String(LIMITS.maxHeightPct)); handle.setAttribute('aria-valuenow', String(cur.value));
            }
            return cur;
        }
        function setSize(kind, value, persist) {
            if (kind === 'w') sizes = { ...sizes, w: clampWidth(value, container().w) }; else sizes = { ...sizes, h: clampHeightPct(value) };
            render(); if (persist) save(sizes, win);
        }
        function reset() { const next = { ...sizes }; if (isPortrait()) delete next.h; else delete next.w; sizes = next; render(); save(sizes, win); }

        // ---- Ziehen (Maus, Stift, Finger) ----
        let drag = null;
        function pointerDown(e) {
            if (e.button !== undefined && e.button !== 0) return;
            const portrait = isPortrait(), sc = scaleOf(), rot = rotationDeg();
            drag = { id: e.pointerId, portrait, sx: e.clientX, sy: e.clientY, rot, startSize: sidebarSize(portrait, sc, rot), scale: sc };
            try { handle.setPointerCapture && handle.setPointerCapture(e.pointerId); } catch { /* ohne Capture geht es über das Dokument weiter */ }
            html.classList.add('aura-resizing');
            if (e.preventDefault) e.preventDefault();
        }
        function pointerMove(e) {
            if (!drag || (drag.id !== undefined && e.pointerId !== undefined && e.pointerId !== drag.id)) return;
            const d = logicalDelta(e.clientX - drag.sx, e.clientY - drag.sy, drag.rot), delta = drag.portrait ? d.y : d.x, c = container();
            if (drag.portrait) setSize('h', dragHeightPct(drag.startSize, delta, drag.scale, c.h), false); else setSize('w', dragWidth(drag.startSize, delta, drag.scale, c.w), false);
        }
        function pointerUp(e) {
            if (!drag) return;
            try { handle.releasePointerCapture && handle.releasePointerCapture(drag.id); } catch { /* schon losgelassen */ }
            drag = null; html.classList.remove('aura-resizing'); save(sizes, win);
        }
        function keyDown(e) {
            const portrait = isPortrait(), big = e.shiftKey ? 4 : 1; let handled = true;
            // Pfeiltasten gelten für die Richtung auf dem BILDSCHIRM: in die Achsen des (gedrehten) Bildes umgerechnet; nur die Richtung entlang des Griffs wirkt
            const arrow = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
            const along = arrow ? (portrait ? logicalDelta(arrow[0], arrow[1], rotationDeg()).y : logicalDelta(arrow[0], arrow[1], rotationDeg()).x) : 0;
            if (arrow && along !== 0) setSize(portrait ? 'h' : 'w', current().value + along * (portrait ? STEP_PCT : STEP_PX) * big, true);
            else if (arrow) handled = false;
            else if (e.key === 'Home') setSize(portrait ? 'h' : 'w', portrait ? LIMITS.minHeightPct : LIMITS.minWidth, true);
            else if (e.key === 'End') setSize(portrait ? 'h' : 'w', portrait ? LIMITS.maxHeightPct : 99999, true);
            else if (e.key === 'Enter' || e.key === 'Escape') reset();
            else handled = false;
            if (handled && e.preventDefault) e.preventDefault();
        }
        handle.setAttribute('role', 'separator'); handle.setAttribute('tabindex', '0'); handle.setAttribute('title', 'Ziehen = Aura-Fenster grösser/kleiner, Doppelklick = zurücksetzen');
        handle.setAttribute('aria-label', 'Grösse des Aura-Fensters');
        handle.addEventListener('pointerdown', pointerDown); handle.addEventListener('pointermove', pointerMove); handle.addEventListener('pointerup', pointerUp); handle.addEventListener('pointercancel', pointerUp);
        handle.addEventListener('keydown', keyDown); handle.addEventListener('dblclick', reset);

        // ---- Neu rechnen, wenn sich der Rahmen ändert (Fenstergrösse, Drehen, anderes Bildschirmformat) ----
        let queued = false;
        const again = () => { if (queued) return; queued = true; (win.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { queued = false; render(); }); };
        win.addEventListener('resize', again); win.addEventListener('orientationchange', again); win.addEventListener('aura-screen-format-changed', again);

        render();
        ctl = { render, setSize, reset, get: () => ({ ...sizes }), current, isDragging: () => !!drag, _handlers: { pointerDown, pointerMove, pointerUp, keyDown } };
        return ctl;
    }

    const api = { STORAGE_KEY, LIMITS, STEP_PX, STEP_PCT, CSS, clampWidth, clampHeightPct, dragWidth, dragHeightPct, logicalDelta, load, save, install, get controller() { return ctl; } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.AuraPanelResize = api;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const run = () => install(window, document);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
    }
})(typeof window !== 'undefined' ? window : undefined);
