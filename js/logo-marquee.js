// ===== Logo marquee: auto-drift + drag like a film strip =====
// Self-contained: builds the strip from LOGOS, owns all drag state, and
// exposes update(dt) for the main render loop to advance the drift.
import { REDUCED_MOTION } from './utils.js';
import { LOGOS } from './data.js';

export function initLogoMarquee(trustTrack) {
  let logoOffset = 0;              // px scrolled (wrapped to one copy's width)
  let logoVel = 0;                 // current eased speed (px/sec) for smooth start/stop
  let logoLoopW = 0;               // width of ONE copy of the logos (set lazily)
  const LOGO_SPIN_SPEED = 26;      // px/sec the logos drift on their own
  let logoHover = false, logoDragging = false;
  let logoDragX = 0, logoDragStart = 0, logoDragMoved = false;

  // Build 3 copies so the loop never runs out of width on wide screens.
  (function buildLogos() {
    let html = '';
    for (let c = 0; c < 3; c++) {
      LOGOS.forEach(function(l) {
        html += '<div class="trust-item">' +
                  '<div class="trust-logo"><img src="' + l.src + '" alt="' + l.name + '" draggable="false"></div>' +
                  '<span class="trust-name">' + l.name + '</span>' +
                '</div>';
      });
    }
    trustTrack.innerHTML = html;
  })();

  // Measure ONE copy's width (track holds 3 copies). Must run AFTER the logo
  // images have real dimensions, else scrollWidth is too small and the marquee
  // wraps early -> visible jump instead of an endless loop. Re-measure on load
  // and resize so it stays seamless.
  function measureLogos() {
    const w = trustTrack.scrollWidth / 3;
    if (w > 0) logoLoopW = w;
  }
  window.addEventListener('load', measureLogos);
  window.addEventListener('resize', measureLogos);
  Array.prototype.forEach.call(trustTrack.querySelectorAll('img'), function(img) {
    if (!img.complete) img.addEventListener('load', measureLogos);
  });

  trustTrack.addEventListener('pointerenter', function() { logoHover = true; });
  trustTrack.addEventListener('pointerleave', function() { logoHover = false; });
  trustTrack.addEventListener('pointerdown', function(e) {
    logoDragging = true; logoDragMoved = false;
    logoDragX = e.clientX; logoDragStart = logoOffset;
    try { trustTrack.setPointerCapture(e.pointerId); } catch (err) {}
  });
  trustTrack.addEventListener('pointermove', function(e) {
    if (!logoDragging) return;
    const dx = e.clientX - logoDragX;
    if (Math.abs(dx) > 4) logoDragMoved = true;
    logoOffset = logoDragStart - dx;   // drag right -> reveal earlier logos
  });
  function endLogoDrag(e) {
    if (!logoDragging) return;
    logoDragging = false;
    try { trustTrack.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  trustTrack.addEventListener('pointerup', endLogoDrag);
  trustTrack.addEventListener('pointercancel', endLogoDrag);
  // Suppress the click-through on logo links right after a drag.
  trustTrack.addEventListener('click', function(e) { if (logoDragMoved) { e.preventDefault(); e.stopPropagation(); } }, true);

  return {
    // Per-frame drift, called from the main render loop. The track content is
    // triplicated, so we wrap the offset by one copy's width to loop
    // seamlessly. Auto-drift pauses while dragging/hovering.
    update: function(dt) {
      if (logoLoopW <= 0) logoLoopW = trustTrack.scrollWidth / 3; // fallback before images report width
      if (logoLoopW <= 0) return;
      // Smooth, never jerky: the actual speed eases toward the target speed
      // (0 while dragging/hovering, LOGO_SPIN_SPEED otherwise) instead of
      // snapping, so pausing/resuming glides. Dragging drives logoOffset directly.
      if (!logoDragging) {
        const wantSpeed = (logoHover || REDUCED_MOTION) ? 0 : LOGO_SPIN_SPEED;
        logoVel += (wantSpeed - logoVel) * Math.min(1, dt * 3);
        logoOffset += logoVel * dt;
      }
      logoOffset = ((logoOffset % logoLoopW) + logoLoopW) % logoLoopW;
      // sub-pixel value (no rounding) -> smooth motion, not stair-stepped.
      trustTrack.style.transform = 'translate3d(' + (-logoOffset).toFixed(2) + 'px,0,0)';
    }
  };
}
