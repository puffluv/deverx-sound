// A flowing two-pass waveform in the hero's lower-left band. Gold, low alpha,
// fades out before the portrait on the right. fade: overall opacity (drops as
// the intro hands off to the film).
// Hovering the Showreel button "excites" the wave (amplitude eases toward
// x2) — a nudge that there's sound behind that button.
import { ss } from './utils.js';

const heroWave = document.getElementById('heroWave');
const hwCtx = heroWave ? heroWave.getContext('2d') : null;
export const hasHeroWave = !!hwCtx;

let waveBoost = 1, waveBoostTarget = 1;
export function setWaveBoostTarget(v) { waveBoostTarget = v; }

export function drawHeroWave(t, fade) {
  if (!hwCtx) return;
  const cw = heroWave.clientWidth, ch = heroWave.clientHeight;
  if (!cw || !ch) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
  if (heroWave.width !== pw) heroWave.width = pw;
  if (heroWave.height !== ph) heroWave.height = ph;
  const ctx = hwCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const midY = ch * 0.52;
  const grad = ctx.createLinearGradient(0, 0, cw, 0);
  grad.addColorStop(0.00, 'rgba(216,164,88,0)');
  grad.addColorStop(0.10, 'rgba(216,164,88,0.6)');
  grad.addColorStop(0.40, 'rgba(255,201,122,0.62)');
  grad.addColorStop(0.80, 'rgba(216,164,88,0.5)');
  grad.addColorStop(1.00, 'rgba(216,164,88,0)');   // runs the full width, soft fade only at the very edge
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = grad;
  waveBoost += (waveBoostTarget - waveBoost) * 0.08;
  for (let pass = 0; pass < 2; pass++) {
    const amp = pass === 0 ? 1 : 0.5;
    const phse = t * 1.1 * (pass === 0 ? 1 : -1.35);
    ctx.beginPath();
    for (let x = 0; x <= cw; x += 2) {
      const u = x / cw;
      // Amplitude envelope: smoothstep in/out (zero slope at the ends) so
      // there's no kink where it reaches full amplitude — eases in over the
      // first 12%, full across, tapers only in the last 6%.
      const env = ss(0, 0.12, u) * ss(0, 0.06, 1 - u);
      // One smooth low-frequency swell (no high-frequency harmonic = no
      // jaggedness) at a gentle amplitude (no tall spikes).
      const y = midY
        + Math.sin(u * 5.0 + phse) * Math.sin(u * 2.0 - phse * 0.55) * (ch * 0.17) * waveBoost * amp * env;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = pass === 0 ? 2.2 : 1.3;
    ctx.globalAlpha = (pass === 0 ? 1 : 0.55) * fade;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
