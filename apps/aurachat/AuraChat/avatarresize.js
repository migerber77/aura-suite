/* AuraChat - Bild von Aura an der Ecke mit der Maus vergrössern oder verkleinern (wie ein Fenster)
 *
 * Unten rechts im Bild von Aura (#avatar-container) sitzt ein Griff (#avatar-resize-grip):
 *   - Aura in der Seitenleiste:   nach rechts/links ziehen = Seitenleiste breiter/schmaler (gleiche Grösse wie der Griff zwischen Leiste und Chat),
 *                                 nach unten/oben ziehen  = Bild höher/niedriger
 *   - Hochformat (Aura oben):     nach unten/oben ziehen  = Bereich von Aura höher/niedriger
 *   - Aura mittig schwebend:      Breite und Höhe des schwebenden Fensters (es bleibt in der Mitte, die Ecke folgt dem Zeiger)
 *   - Pfeiltasten bei fokussiertem Griff = in kleinen Schritten (mit Umschalttaste grösser), Doppelklick, Eingabe- oder Esc-Taste = zurück auf die Vorgabe
 * Die Grösse wird pro Gerät gemerkt (localStorage), wie die Breite der Seitenleiste. Wer in den Einstellungen eine "Aura-Grösse" wählt, setzt sie zurück.
 * Arbeitet mit dem Bildschirmformat zusammen (Massstab und Drehung des Rahmens), über die Hilfen von panelresize.js.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'aura_avatar_size';
    const LIMITS = { minH: 120, minFloat: 120, maxFloatPct: 0.9 };
    const STEP_PX = 16;

    const num = (v) => {
        if (typeof v === 'string' ? v.trim() === '' : typeof v !== 'number') return null;
        const n = Number(v); return Number.isFinite(n) ? n : null;
    };
    // Höhe des Bildes in der Seitenleiste: mindestens 120 Pixel, höchstens der Platz, der neben Logo, "Neuer Chat" und Verlauf bleibt (maxH)
    function clampHeight(h, maxH) {
        const x = num(h); if (x === null) return null;
        const s = num(maxH), max = Math.max(LIMITS.minH, s === null ? 4000 : s);
        return Math.round(Math.min(max, Math.max(LIMITS.minH, x)));
    }
    // Schwebendes Fenster: mindestens 120 Pixel, höchstens 90 % des Rahmens
    function clampFloat(v, frame) {
        const x = num(v); if (x === null) return null;
        const f = num(frame), max = Math.max(LIMITS.minFloat, Math.floor((f === null ? 4000 : f) * LIMITS.maxFloatPct));
        return Math.round(Math.min(max, Math.max(LIMITS.minFloat, x)));
    }

    function load(win) {
        try {
            const o = JSON.parse(win.localStorage.getItem(STORAGE_KEY)), out = {};
            if (o && num(o.h) !== null) out.h = clampHeight(o.h, null);
            if (o && num(o.fw) !== null) out.fw = clampFloat(o.fw, null);
            if (o && num(o.fh) !== null) out.fh = clampFloat(o.fh, null);
            return out;
        } catch { return {}; }
    }
    function save(sizes, win) {
        try {
            const clean = {};
            for (const k of ['h', 'fw', 'fh']) if (num(sizes[k]) !== null) clean[k] = Math.round(sizes[k]);
            if (Object.keys(clean).length) win.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); else win.localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch { return false; }
    }

    // Gemerkte Grösse gewinnt gegen die feste "Aura-Grösse" aus den Einstellungen (die app.js als Inline-Stil setzt): darum !important im Stylesheet
    const CSS = [
        'html:not(.aura-portrait) #avatar-container.aura-avatar-manual { height: var(--aura-avatar-h) !important; min-height: var(--aura-avatar-h) !important; flex: none !important; }',
        '#avatar-container.aura-avatar-float-manual { width: var(--aura-avatar-fw) !important; height: var(--aura-avatar-fh) !important; }',
        '#avatar-resize-grip { position: absolute; right: 0; bottom: 0; width: 22px; height: 22px; z-index: 5; cursor: nwse-resize; touch-action: none; outline: none; pointer-events: auto;',
        '  border-bottom-right-radius: 1rem; background: linear-gradient(135deg, transparent 0 46%, rgba(148,163,184,.85) 46% 52%, transparent 52% 62%, rgba(148,163,184,.85) 62% 68%, transparent 68% 78%, rgba(148,163,184,.85) 78% 84%, transparent 84%);',
        '  opacity: 0; transition: opacity .15s; }',
        '#avatar-container:hover #avatar-resize-grip, #avatar-resize-grip:focus-visible, html.aura-avatar-resizing #avatar-resize-grip { opacity: 1; }',
        '#avatar-resize-grip:focus-visible { box-shadow: inset 0 0 0 2px #3b82f6; }',
        '@media (hover: none) { #avatar-resize-grip { opacity: .7; } }',
        'html.aura-portrait #avatar-resize-grip { cursor: ns-resize; }',
        'html.aura-avatar-resizing, html.aura-avatar-resizing * { user-select: none !important; cursor: nwse-resize !important; }',
        'html.aura-avatar-resizing.aura-portrait, html.aura-avatar-resizing.aura-portrait * { cursor: ns-resize !important; }',
        '#avatar-container.aura-avatar-float-manual, #avatar-container.aura-avatar-manual { transition: none !important; }'
    ].join('\n');

    let ctl = null;
    function install(win, doc) {
        win = win || (typeof window !== 'undefined' ? window : null); doc = doc || (typeof document !== 'undefined' ? document : null);
        if (!win || !doc) return null;
        const box = doc.getElementById('avatar-container'), sidebar = doc.getElementById('sidebar'), app = doc.getElementById('app-body') || doc.body;
        if (!box || !sidebar) return null;
        const html = doc.documentElement, P = () => win.AuraPanelResize || root.AuraPanelResize || null;
        if (doc.head && !doc.getElementById('aura-avatarresize-style')) { const st = doc.createElement('style'); st.id = 'aura-avatarresize-style'; st.textContent = CSS; doc.head.appendChild(st); }
        let grip = doc.getElementById('avatar-resize-grip');
        if (!grip) { grip = doc.createElement('div'); grip.id = 'avatar-resize-grip'; box.appendChild(grip); }
        grip.setAttribute('role', 'separator'); grip.setAttribute('tabindex', '0'); grip.setAttribute('aria-label', 'Grösse von Aura');
        grip.setAttribute('title', 'Ziehen = Aura grösser/kleiner, Doppelklick = zurücksetzen');

        let sizes = load(win);
        const isPortrait = () => html.classList.contains('aura-portrait');
        const isFloating = () => (box.style && box.style.position === 'fixed');
        const cssVar = (name) => { try { return parseFloat(html.style.getPropertyValue(name)); } catch { return NaN; } };
        const rotationDeg = () => { const v = cssVar('--aura-rot'); return Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0; };
        const scaleOf = () => { const v = cssVar('--aura-scale'); return v > 0 ? v : 1; };
        const delta = (dx, dy) => { const p = P(); return p && p.logicalDelta ? p.logicalDelta(dx, dy, rotationDeg()) : { x: dx, y: dy }; };
        const frame = () => ({ w: app.clientWidth || win.innerWidth, h: app.clientHeight || win.innerHeight });
        // Platz für das Bild in der Seitenleiste: Höhe der Leiste ohne Innenabstand und ohne alle anderen Elemente (Logo, Titel, "Neuer Chat", Verlauf)
        const px = (v) => parseFloat(v) || 0;
        const sidebarH = () => {
            try {
                const cs = win.getComputedStyle(sidebar), bs = win.getComputedStyle(box);
                let used = px(cs.paddingTop) + px(cs.paddingBottom) + px(bs.marginTop) + px(bs.marginBottom);
                for (const el of sidebar.children) { if (el === box) continue; const st = win.getComputedStyle(el); if (st.display === 'none' || st.position === 'absolute' || st.position === 'fixed') continue; used += el.offsetHeight + px(st.marginTop) + px(st.marginBottom); }
                return Math.max(LIMITS.minH, sidebar.clientHeight - used);
            } catch { return null; }
        };
        const panel = () => { const p = P(); return p && p.controller ? p.controller : null; };

        function render() {
            const f = frame();
            if (sizes.h !== undefined) { const h = clampHeight(sizes.h, sidebarH()); html.style.setProperty('--aura-avatar-h', h + 'px'); box.classList.add('aura-avatar-manual'); }
            else { html.style.removeProperty('--aura-avatar-h'); box.classList.remove('aura-avatar-manual'); }
            if (isFloating() && sizes.fw !== undefined && sizes.fh !== undefined) {
                html.style.setProperty('--aura-avatar-fw', clampFloat(sizes.fw, f.w) + 'px'); html.style.setProperty('--aura-avatar-fh', clampFloat(sizes.fh, f.h) + 'px');
                box.classList.add('aura-avatar-float-manual');
            } else { box.classList.remove('aura-avatar-float-manual'); }
        }
        // Aktuelle Masse im Aufbau (ohne Massstab/Drehung)
        const boxSize = () => ({ w: box.offsetWidth || 0, h: box.offsetHeight || 0 });

        function apply(kind, values, persist) {
            const f = frame();
            if (kind === 'side') {
                if (values.h !== undefined) sizes = { ...sizes, h: clampHeight(values.h, sidebarH()) };
                if (values.w !== undefined && panel()) panel().setSize('w', values.w, persist);
            } else if (kind === 'portrait') {
                if (values.pct !== undefined && panel()) panel().setSize('h', values.pct, persist);
            } else if (kind === 'float') {
                sizes = { ...sizes, fw: clampFloat(values.fw, f.w), fh: clampFloat(values.fh, f.h) };
            }
            render(); if (persist) save(sizes, win);
        }
        function reset() {
            if (isFloating()) { const n = { ...sizes }; delete n.fw; delete n.fh; sizes = n; }
            else if (isPortrait()) { if (panel()) panel().reset(); }
            else { const n = { ...sizes }; delete n.h; sizes = n; if (panel()) panel().reset(); }
            render(); save(sizes, win);
        }
        // Von den Einstellungen ("Aura-Grösse" gewählt): gemerkte Bildgrösse vergessen, die Vorgabe der Einstellung gilt wieder
        function clearManual() { sizes = {}; render(); save(sizes, win); }

        let drag = null;
        function pointerDown(e) {
            if (e.button !== undefined && e.button !== 0) return;
            const b = boxSize(), sb = sidebar.offsetWidth || 0;
            drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, scale: scaleOf(), mode: isFloating() ? 'float' : (isPortrait() ? 'portrait' : 'side'), w: b.w, h: b.h, sb, sbh: sidebar.offsetHeight || 0 };
            try { grip.setPointerCapture && grip.setPointerCapture(e.pointerId); } catch { /* weiter über das Dokument */ }
            html.classList.add('aura-avatar-resizing');
            if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation();
        }
        function pointerMove(e) {
            if (!drag || (drag.id !== undefined && e.pointerId !== undefined && e.pointerId !== drag.id)) return;
            const d = delta(e.clientX - drag.sx, e.clientY - drag.sy), dx = d.x / drag.scale, dy = d.y / drag.scale;
            if (drag.mode === 'side') apply('side', { w: drag.sb + dx, h: drag.h + dy }, false);
            else if (drag.mode === 'portrait') apply('portrait', { pct: ((drag.sbh + dy) / Math.max(1, frame().h)) * 100 }, false);
            else apply('float', { fw: drag.w + 2 * dx, fh: drag.h + 2 * dy }, false);   // das Fenster bleibt mittig: die Ecke folgt dem Zeiger, wenn es auf beiden Seiten wächst
        }
        function pointerUp() {
            if (!drag) return;
            try { grip.releasePointerCapture && grip.releasePointerCapture(drag.id); } catch { /* schon losgelassen */ }
            const mode = drag.mode; drag = null; html.classList.remove('aura-avatar-resizing');
            save(sizes, win); if (mode !== 'float' && panel()) { const c = panel(); c.setSize(isPortrait() ? 'h' : 'w', c.current().value, true); }
        }
        function keyDown(e) {
            const arrow = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
            if (e.key === 'Enter' || e.key === 'Escape') { reset(); if (e.preventDefault) e.preventDefault(); return; }
            if (!arrow) return;
            const step = STEP_PX * (e.shiftKey ? 4 : 1), d = delta(arrow[0] * step, arrow[1] * step), b = boxSize();
            if (isFloating()) apply('float', { fw: b.w + 2 * d.x, fh: b.h + 2 * d.y }, true);
            else if (isPortrait()) { if (d.y) apply('portrait', { pct: (((sidebar.offsetHeight || 0) + d.y) / Math.max(1, frame().h)) * 100 }, true); }
            else apply('side', { w: d.x ? (sidebar.offsetWidth || 0) + d.x : undefined, h: d.y ? b.h + d.y : undefined }, true);
            if (e.preventDefault) e.preventDefault();
        }
        grip.addEventListener('pointerdown', pointerDown); grip.addEventListener('pointermove', pointerMove); grip.addEventListener('pointerup', pointerUp); grip.addEventListener('pointercancel', pointerUp);
        grip.addEventListener('keydown', keyDown); grip.addEventListener('dblclick', (e) => { if (e.stopPropagation) e.stopPropagation(); reset(); });

        // Neu rechnen, wenn sich der Rahmen ändert oder app.js die Position (Seitenleiste/schwebend) umstellt
        let queued = false;
        const again = () => { if (queued) return; queued = true; (win.requestAnimationFrame || ((f) => setTimeout(f, 16)))(() => { queued = false; render(); }); };
        win.addEventListener('resize', again); win.addEventListener('orientationchange', again); win.addEventListener('aura-screen-format-changed', again);
        try { new win.MutationObserver(again).observe(box, { attributes: true, attributeFilter: ['style'] }); } catch { /* ältere Browser: beim nächsten Ziehen */ }

        render();
        ctl = { render, apply, reset, clearManual, get: () => ({ ...sizes }), isDragging: () => !!drag, _handlers: { pointerDown, pointerMove, pointerUp, keyDown } };
        return ctl;
    }

    const api = { STORAGE_KEY, LIMITS, STEP_PX, CSS, clampHeight, clampFloat, load, save, install, get controller() { return ctl; } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.AuraAvatarResize = api;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const run = () => install(window, document);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
    }
})(typeof window !== 'undefined' ? window : null);
