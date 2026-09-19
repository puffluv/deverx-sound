// Real audio, for a site about audio.
//
// Every waveform here used to be Math.sin(): the line under the hero card, the
// bar field behind About, the shapes baked into the film frames. This module
// gives them an actual signal to read instead — the reel that is playing.
//
// Three facts shape the design:
//
//   * Browsers will not start unmuted audio without a user gesture, so nothing
//     here exists until someone presses the sound toggle. enable() must be
//     called from inside that click handler.
//   * createMediaElementSource() can only ever be called once per element, and
//     once called the element's audio ONLY reaches the speakers through the
//     graph. So each element is routed at most once, is always connected to
//     the destination, and the context is resumed on every play.
//   * There is frequently no signal at all — nothing playing, sound off, the
//     preview paused because the film scrolled out of view. Callers get a
//     `presence` that falls to 0 then, so the visuals can cross-fade back to
//     the synthetic generator instead of flatlining.

const FFT = 1024;

let ctx = null;
let analyser = null;
let gain = null;
let timeData = null;        // Float32Array, -1..1
let freqData = null;        // Uint8Array, 0..255
const routed = new WeakMap();   // media element -> MediaElementAudioSourceNode
const pending = [];             // elements asked for before the context existed

let on = false;
let presence = 0;           // 0..1, eased — "is there really a signal right now"
let lastRms = 0;

export function isOn() { return on; }

// How much to trust the live data, 0..1. Visuals blend real vs synthetic by it.
export function signalPresence() { return presence; }

// Smoothed loudness, 0..1. Usable even when presence is low (it will be ~0).
export function level() { return lastRms; }

// Raw buffers. Callers must respect signalPresence() before leaning on them.
export function timeDomain() { return timeData; }
export function spectrum() { return freqData; }

// Route one <video>/<audio> element into the analyser. Safe to call repeatedly
// and safe to call before enable() — the element is queued until there is a
// context to attach it to.
export function attach(el) {
  if (!el) return;
  if (!ctx) { if (pending.indexOf(el) < 0) pending.push(el); return; }
  if (routed.has(el)) return;
  try {
    const src = ctx.createMediaElementSource(el);
    src.connect(analyser);
    routed.set(el, src);
  } catch (err) {
    // Already routed by someone else, or a cross-origin stream we may not tap.
    routed.set(el, null);
  }
}

// Must run inside a user gesture.
export function enable() {
  if (on) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (!ctx) {
    try { ctx = new AC(); } catch (err) { return false; }
    analyser = ctx.createAnalyser();
    analyser.fftSize = FFT;
    // Heavy smoothing: the bars are a mood, not a measurement instrument, and
    // an unsmoothed FFT strobes badly at 24fps.
    analyser.smoothingTimeConstant = 0.82;
    gain = ctx.createGain();
    gain.gain.value = 1;
    analyser.connect(gain);
    gain.connect(ctx.destination);
    timeData = new Float32Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    while (pending.length) attach(pending.shift());
  }
  if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  on = true;
  return true;
}

export function disable() {
  on = false;
  presence = 0;
  lastRms = 0;
}

// The context can be suspended out from under us (tab switch, OS audio focus).
export function resume() {
  if (on && ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
}

// Call once per rendered frame. `audible` says whether the caller believes
// something should be making noise right now; it gates the fade so a paused
// preview decays instead of freezing on its last frame of data.
export function sample(dt, audible) {
  if (!on || !analyser) {
    presence += (0 - presence) * Math.min(1, dt * 4);
    lastRms += (0 - lastRms) * Math.min(1, dt * 4);
    return;
  }
  analyser.getFloatTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  let sum = 0;
  for (let i = 0; i < timeData.length; i += 4) sum += timeData[i] * timeData[i];
  const rms = Math.sqrt(sum / (timeData.length / 4));
  // Perceptual-ish curve: raw RMS on dialogue-and-atmos material sits very low
  // and would barely move anything.
  const shaped = Math.min(1, Math.pow(rms * 3.4, 0.62));
  lastRms += (shaped - lastRms) * Math.min(1, dt * 12);

  // Presence rises quickly when there is signal and falls slowly, so a quiet
  // beat in the mix does not flip the visuals back to synthetic.
  const want = (audible && rms > 0.0015) ? 1 : 0;
  presence += (want - presence) * Math.min(1, dt * (want ? 3.5 : 1.2));
}

// Time-domain sample at u (0..1), already shaped for drawing. Returns a value
// in roughly -1..1. Falls back to 0 with no signal; callers blend by presence.
export function waveAt(u) {
  if (!timeData || presence <= 0.001) return 0;
  const i = Math.min(timeData.length - 1, Math.max(0, Math.round(u * (timeData.length - 1))));
  return timeData[i];
}

// Frequency magnitude at u (0..1), 0..1. Low bins carry almost all the energy
// in film audio, so u is warped to spread the interesting range across the
// whole field instead of crushing it into the left eighth.
export function bandAt(u) {
  if (!freqData || presence <= 0.001) return 0;
  const warped = Math.pow(u, 2.1);
  const i = Math.min(freqData.length - 1, Math.max(0, Math.round(warped * (freqData.length - 1))));
  return freqData[i] / 255;
}
