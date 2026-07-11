// Pure helpers + environment flags shared across modules. No DOM state here
// (splitWords touches the element it's given, but keeps no state of its own).

// Respect the OS "reduce motion" setting: idle drifts stop, only motion the
// user directly drives (drags, scrubs, video playback) remains.
export const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones/tablets get a "lite" rendering profile — lower pixel ratio, a
// smaller film texture, no soft shadows. The look survives, the lag doesn't.
export const LITE = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 900;

// Smoothstep between a..b.
export function ss(a, b, x) { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }

export function easeOutExpo(a) { return a >= 1 ? 1 : 1 - Math.pow(2, -10 * a); }

// Windowed reveal progress: 0 until `delay`, eases to 1 over `win`.
export function rev(p, delay, win) { let a = (p - delay) / win; a = a < 0 ? 0 : a > 1 ? 1 : a; return easeOutExpo(a); }

export function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

// Headings split into words that rise from behind a mask (see revealSection).
export function splitWords(el) {
  const words = (el.textContent || '').split(/\s+/).filter(Boolean);
  el.textContent = '';
  const inners = [];
  words.forEach(function(w, idx) {
    const mask = document.createElement('span'); mask.className = 'rw';
    const inner = document.createElement('span'); inner.className = 'rwi';
    inner.textContent = w;
    mask.appendChild(inner); el.appendChild(mask);
    if (idx < words.length - 1) el.appendChild(document.createTextNode(' '));
    inners.push(inner);
  });
  el.style.opacity = '1';
  return inners;
}

// ---- tiny color + rng helpers for the rich frame previews ----
export function normHex(h) {
  h = h.trim();
  if (h[0] !== '#') h = '#' + h;
  if (h.length === 4) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
}
export function hexToRgb(h) {
  h = normHex(h);
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
export function rgba(h, a) { const c = hexToRgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
export function darken(h, f) { const c = hexToRgb(h); return 'rgb(' + ((c[0]*f)|0) + ',' + ((c[1]*f)|0) + ',' + ((c[2]*f)|0) + ')'; }
export function lum(h) { const c = hexToRgb(h); return 0.299*c[0] + 0.587*c[1] + 0.114*c[2]; }
export function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
