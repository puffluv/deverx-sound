// ===== Reviews rail: a finite, draggable horizontal carousel (no auto-drift;
// these are read, not glanced). Offset is clamped to [0, maxScroll]. =====
export function initReviewsRail(reviewRail) {
  let rvOffset = 0, rvDragging = false, rvDragX = 0, rvStart = 0, rvMax = 0, rvMoved = false;
  function rvApply() {
    rvMax = Math.max(0, reviewRail.scrollWidth - reviewRail.parentElement.clientWidth);
    rvOffset = Math.min(rvMax, Math.max(0, rvOffset));
    reviewRail.style.transform = 'translate3d(' + (-rvOffset).toFixed(1) + 'px,0,0)';
  }
  reviewRail.addEventListener('pointerdown', function(e) {
    // Don't hijack a click on the video link, and let the quote body scroll
    // vertically — only start a horizontal drag on the card surface.
    if (e.target.closest('a')) return;
    rvDragging = true; rvMoved = false; rvDragX = e.clientX; rvStart = rvOffset;
    try { reviewRail.setPointerCapture(e.pointerId); } catch (err) {}
  });
  reviewRail.addEventListener('pointermove', function(e) {
    if (!rvDragging) return;
    const dx = e.clientX - rvDragX;
    if (Math.abs(dx) > 4) rvMoved = true;
    rvOffset = rvStart - dx; rvApply();
  });
  function rvEnd(e) {
    if (!rvDragging) return; rvDragging = false;
    try { reviewRail.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  reviewRail.addEventListener('pointerup', rvEnd);
  reviewRail.addEventListener('pointercancel', rvEnd);
  reviewRail.addEventListener('click', function(e) { if (rvMoved && !e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.addEventListener('load', rvApply);
  window.addEventListener('resize', rvApply);
}
