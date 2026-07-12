  // App entry (ES module). THREE comes from the classic CDN script tag, which
  // is guaranteed to run before any module. The bulk of the experience — the
  // Three.js film strip, navigation, the on-film player and the render loop —
  // lives here; the self-contained pieces are imported from sibling modules.
  import { REDUCED_MOTION, LITE, ss, easeOutExpo, rev, fmtTime, splitWords,
           normHex, hexToRgb, rgba, darken, lum, mulberry32 } from './utils.js';
  import { projects, FRAME_KINDS, ICON_PLAY, ICON_PAUSE, ICON_CLOSE, ICON_EXPAND } from './data.js';
  import { initLogoMarquee } from './logo-marquee.js';
  import { initReviewsRail } from './reviews-rail.js';
  import { drawHeroWave, hasHeroWave, setWaveBoostTarget } from './hero-wave.js';

  window.addEventListener('error', (e) => {
    const box = document.getElementById('errorBox');
    if (box) {
      box.style.display = 'block';
      box.textContent = 'Error: ' + (e.message || e.error || 'unknown');
    }
  });

  (function() {
    if (typeof THREE === 'undefined') {
      const box = document.getElementById('errorBox');
      box.style.display = 'block';
      box.textContent = 'Three.js failed to load from CDN.';
      return;
    }

    const titleBlock = document.querySelector('.title-block');
    const navEl = document.querySelector('.nav');
    const aboutEl = document.getElementById('about');
    const pageBg = document.getElementById('pageBg');
    const trustEl = document.getElementById('trust');
    const trustTrack = document.getElementById('trustTrack');
    const trustHead = document.querySelector('.trust-head');
    // Logo marquee + reviews rail live in their own modules; the marquee
    // returns an update(dt) hook the render loop drives.
    const logoMarquee = initLogoMarquee(trustTrack);
    initReviewsRail(document.getElementById('reviewRail'));

    const reviewsEl = document.getElementById('reviews');
    const educationEl = document.getElementById('education');
    // Education horizontal rail: cache panels + their animatable children (.e-rev).
    const eduRail = document.getElementById('eduRail');
    const eduBar = document.getElementById('eduBar');
    const eduHint = document.getElementById('eduHint');
    const eduPanels = eduRail ? Array.prototype.slice.call(eduRail.querySelectorAll('.edu-panel')) : [];
    eduPanels.forEach(function(p) { p._items = Array.prototype.slice.call(p.querySelectorAll('.e-rev')); });
    const contactsEl = document.getElementById('contacts');
    const deckBg = document.getElementById('deckBg');
    const deckBgInner = document.getElementById('deckBgInner');
    const deckOrbs = Array.prototype.slice.call(document.querySelectorAll('.deck-orb'));
    // Magnetic CTA: the Telegram button eases toward the cursor when near it.
    const ctaBtn = contactsEl.querySelector('.contact-cta');
    if (ctaBtn) {
      contactsEl.addEventListener('pointermove', function(e) {
        const r = ctaBtn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - dist / 360);     // attracts within ~360px
        ctaBtn.style.transform = 'translate(' + (dx * 0.5 * pull).toFixed(1) + 'px,' + (dy * 0.5 * pull).toFixed(1) + 'px) scale(' + (1 + 0.06 * pull).toFixed(3) + ')';
      });
      contactsEl.addEventListener('pointerleave', function() {
        ctaBtn.style.transform = 'translate(0,0)';
      });
    }
    // === Premium scroll-reveal ===
    // Headings split into words that rise from behind a mask; kickers "track in"
    // (letters un-spread); cards/items rise + scale (or slide) with expo easing
    // and a cascade. All driven by how centred each section is -> it scrubs with
    // the wheel like high-end scrollytelling.
    function buildSection(el, index, axis) {
      return {
        index: index, axis: axis, hidden: false, prog: 0,
        titleEls: Array.prototype.slice.call(el.querySelectorAll('.r-title')),
        titles:   Array.prototype.slice.call(el.querySelectorAll('.r-title')).map(splitWords),
        kickers:  Array.prototype.slice.call(el.querySelectorAll('.r-kicker')),
        items:    Array.prototype.slice.call(el.querySelectorAll('.reveal'))
      };
    }
    const deckSections = [
      buildSection(trustEl, 1, 'y'),
      buildSection(reviewsEl, 2, 'y'),
      buildSection(educationEl, 3, 'x'),
      buildSection(contactsEl, 4, 'y')
    ];
    // p = how centred the section is (0..1). px/py = smoothed mouse (-0.5..0.5).
    // Each layer drifts by its own depth -> real parallax; cards also tilt in 3D
    // and resolve from a blur, which is what reads as "expensive".
    function revealSection(s, p, px, py) {
      if (p <= 0.0001) { if (s.hidden) return; s.hidden = true; p = 0; } else { s.hidden = false; }
      // Kicker — furthest back, smallest drift.
      for (let i = 0; i < s.kickers.length; i++) {
        const e = rev(p, 0.0, 0.5), k = s.kickers[i];
        k.style.opacity = e.toFixed(3);
        k.style.letterSpacing = (0.28 + (1 - e) * 0.55).toFixed(3) + 'em';
        k.style.transform = 'translate3d(' + (px * 16).toFixed(1) + 'px,' + ((1 - e) * -10 + py * 10).toFixed(1) + 'px,0)';
      }
      // Title — words rise out of a mask; the whole heading parallaxes mid-depth.
      for (let t = 0; t < s.titleEls.length; t++) {
        s.titleEls[t].style.transform = 'translate3d(' + (px * 30).toFixed(1) + 'px,' + (py * 18).toFixed(1) + 'px,0)';
        const inners = s.titles[t];
        for (let i = 0; i < inners.length; i++) {
          const e = rev(p, 0.06 + i * 0.05, 0.5);
          inners[i].style.transform = 'translateY(' + ((1 - e) * 112).toFixed(1) + '%)';
          inners[i].style.filter = e < 0.999 ? 'blur(' + ((1 - e) * 6).toFixed(2) + 'px)' : 'none';
        }
      }
      // Items (cards / rows) — foreground: largest drift, 3D tilt, blur-in.
      for (let i = 0; i < s.items.length; i++) {
        const e = rev(p, 0.14 + i * 0.08, 0.6), it = s.items[i];
        it.style.opacity = e.toFixed(3);
        it.style.filter = e < 0.999 ? 'blur(' + ((1 - e) * 9).toFixed(2) + 'px)' : 'none';
        const pxx = px * 44, pyy = py * 26;             // foreground parallax
        const rY = px * 7, rX = -py * 7;                 // mouse 3D tilt (deg)
        if (s.axis === 'x') {
          const slide = -(1 - e) * 80;
          it.style.transform =
            'translate3d(' + (slide + pxx).toFixed(1) + 'px,' + pyy.toFixed(1) + 'px,0) ' +
            'rotateX(' + rX.toFixed(2) + 'deg) rotateY(' + rY.toFixed(2) + 'deg)';
        } else {
          const rise = (1 - e) * 64;
          const sc = 0.92 + e * 0.08;
          it.style.transform =
            'translate3d(' + pxx.toFixed(1) + 'px,' + (rise + pyy).toFixed(1) + 'px,0) ' +
            'rotateX(' + (rX + (1 - e) * 8).toFixed(2) + 'deg) rotateY(' + rY.toFixed(2) + 'deg) ' +
            'scale(' + sc.toFixed(3) + ')';
        }
        // Light sheen sweeps across review cards as they resolve.
        if (it.classList.contains('review-card')) {
          it.style.setProperty('--sheen', (-60 + e * 220).toFixed(0) + '%');
        }
        // Count-up the chapter numbers (00 -> 01/02/03) as Education reveals.
        const num = it.querySelector && it.querySelector('.edu-num');
        if (num) num.textContent = String(Math.round(e * (i + 1))).padStart(2, '0');
      }
    }
    const aboutInner = document.querySelector('.about-inner');
    const aboutKicker = document.querySelector('.about-kicker');
    const aboutH2 = document.querySelector('.about h2');
    const aboutP = document.querySelector('.about p');
    const aboutVeil = document.querySelector('.about-veil');
    const controlsEl = document.querySelector('.controls');
    const videoPlayer = document.getElementById('videoPlayer');
    const mainVideo = document.getElementById('mainVideo');
    const playerTitle = document.getElementById('playerTitle');
    const closePlayer = document.getElementById('closePlayer');
    const playPause = document.getElementById('playPause');
    const timeline = document.getElementById('timeline');
    const volume = document.getElementById('volume');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const timecode = document.getElementById('timecode');

    // SVG icons for the player controls come from data.js.
    closePlayer.innerHTML = ICON_CLOSE;
    fullscreenBtn.innerHTML = ICON_EXPAND;
    playPause.innerHTML = ICON_PLAY;

    // ============ CONFIG ============
    // (Film-strip content itself — `projects` — comes from data.js.)
    const FRAME_W = 4.0;
    const FRAME_H = 2.3;
    const SPROCKET_H = 0.42;
    const FILM_H = FRAME_H + SPROCKET_H * 2;
    const FRAME_GAP = 0.0;
    const SLOT = FRAME_W + FRAME_GAP;
    const N = projects.length;
    const ACTIVE_FRAME_RIGHT_BIAS = 0.018;
    let activeIndex = 0;
    let targetOffset = 0;
    let currentOffset = 0;
    let activeFrameSForTexture = 0.5;
    let visibleFramesForTexture = N;
    const PREVIEW_START = 2;
    const PREVIEW_SECONDS = 5;
    const previewVideos = projects.map(function(project, index) {
      const video = document.createElement('video');
      video.src = encodeURI(project.src);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      // Only metadata up front — the big .mov/.mp4 files would otherwise all
      // download at once and starve whichever frame you navigate to. The active
      // frame is upgraded to full load on demand in startActivePreview().
      video.preload = 'metadata';
      video.addEventListener('loadedmetadata', function() {
        try { video.currentTime = Math.min(PREVIEW_START, Math.max(0, (video.duration || PREVIEW_START) - 0.1)); } catch (err) {}
      });
      video.addEventListener('seeked', function() {
        redrawFilmTexture(lastAboutMix < 0 ? 0 : lastAboutMix);
      });
      video.addEventListener('loadeddata', function() {
        redrawFilmTexture(lastAboutMix < 0 ? 0 : lastAboutMix);
      });
      video.addEventListener('error', function() {
        redrawFilmTexture(lastAboutMix < 0 ? 0 : lastAboutMix);
      });
      return video;
    });
    let previewActiveIndex = -1;
    let lastPreviewPaint = 0;
    let playerOpening = false;
    let playerOpen = false;
    // Eased zoom (0 = full strip view, 1 = active frame fills the screen),
    // mirrored here so redrawFilmTexture can hide the on-film play UI mid-zoom.
    let filmZoom = 0;
    // Click the active frame -> the film enlarges only partway (stays a film
    // strip) and the baked-in 3D player takes over. Not fullscreen.
    // Reassigned per aspect in updateCameraFraming (deeper stop on phones).
    let FRAME_PLAYER_ZOOM = 0.5;
    // Screen-space rect of the active frame while the player is up, used to
    // hit-test taps on the curved on-film controls.
    let frameRect = null;
    // Cinema mode = the real <video> shown fullscreen (native res) with the
    // HTML player chrome, instead of the 3D on-film player.
    let playerCinema = false;
    // True once the opened video has reached a playable state at least once —
    // stops the "loading" overlay from flashing on every scrub.
    let playerEverReady = false;
    // Suppress the scroll-to-About image while the player zoom is opening or
    // closing, so home.png never flashes onto the frame during the transition.
    let suppressAbout = false;
    // Intro "Loading films" overlay — stays up until the first film can play.
    const loadingEl = document.getElementById('loading');
    loadingEl.textContent = 'Loading films…';
    let loadingHidden = false;

    // ============ THREE.JS ============
    const canvas = document.getElementById('canvas');
    const stage = document.querySelector('.stage');
    // Hero intro layer: a real 3D mixing-console scene (built below in setupHero).
    const heroEl = document.getElementById('hero');
    const heroContent = document.getElementById('heroContent');
    const heroScroll = document.getElementById('heroScroll');
    const heroPhotoImg = document.getElementById('heroPhotoImg');
    // (The gold hero waveform lives in hero-wave.js.)
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, stage.clientWidth / stage.clientHeight, 0.1, 200);
    camera.position.set(0, 0.3, 14.1);
    camera.lookAt(0, 0, 0);

    // preserveDrawingBuffer lets the hero's little screen copy this live film
    // canvas (via drawImage) so it shows the REAL film, not an imitation.
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: !LITE, alpha: true, preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, LITE ? 1.5 : 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);

    scene.add(new THREE.AmbientLight(0xd8c4a8, 0.52));

    const keyLight = new THREE.DirectionalLight(0xffc47a, 1.95);
    keyLight.position.set(4.2, 6.2, 11);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x73d6ff, 1.05);
    rimLight.position.set(-8, -1.2, 8);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xff7a3d, 0.65, 42, 2);
    fillLight.position.set(0, -1.2, 7);
    scene.add(fillLight);

    // ============ FRAME IMAGE TEXTURE ============
    // (Color/rng helpers and FRAME_KINDS come from utils.js / data.js.)
    const frameFallbackCache = [];
    // Last good video frame per slot. Once a frame has shown real video we keep
    // its last decoded pixels instead of flashing back to the synthetic poster
    // during a seek / decode stall — that flash was the "flicker".
    const frameFreeze = [];
    const frameHasVideo = [];

    function makeFrameTexture(project, index) {
      if (frameFallbackCache[index]) return frameFallbackCache[index];
      const W = 1024;
      const H = Math.round(W * (FRAME_H / FRAME_W));
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');

      // Sort palette by brightness so we always have a dark bg / bright ink.
      const pal = [project.palette[0], project.palette[1], project.palette[2]]
        .slice().sort(function(a, b){ return lum(a) - lum(b); });
      const col = { dark: pal[0], mid: pal[1], ink: pal[2], accent: project.palette[2],
                    label: project.label, title: project.title };
      const rnd = mulberry32((index + 7) * 2654435761);

      // dark "screen" base + soft colored glow
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, darken(col.dark, 0.55));
      g.addColorStop(1, darken(col.mid, 0.30));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 2; i++) {
        const r = ctx.createRadialGradient(rnd()*W, rnd()*H, 10, rnd()*W, rnd()*H, W*0.45);
        r.addColorStop(0, rgba(col.accent, 0.32));
        r.addColorStop(1, rgba(col.accent, 0));
        ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      drawKind(ctx, W, H, FRAME_KINDS[index % FRAME_KINDS.length], col, rnd);
      ctx.restore();

      // vignette
      const v = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, W*0.72);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.46)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

      // top caption + film footer metadata
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '22px "JetBrains Mono", monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(project.title.toUpperCase(), 30, 26);

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '24px "JetBrains Mono", monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(index + 1).padStart(2, '0') + ' / WORK', 30, H - 26);
      ctx.textAlign = 'right';
      ctx.fillText(String(2024 + (index % 2)), W - 30, H - 26);

      frameFallbackCache[index] = c;
      return c;
    }

    // Draws one of several sound-design themed preview styles into the frame.
    function drawKind(ctx, W, H, kind, col, rnd) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';

      if (kind === 'wave') {
        const midY = H * 0.52;
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          const amp = (pass === 0 ? 0.20 : 0.10) * H;
          const ph = rnd() * 6.28;
          for (let x = 0; x <= W; x += 3) {
            const t = x / W;
            const y = midY + Math.sin(t * Math.PI * (5 + pass*4) + ph) * amp
              + Math.sin(t * Math.PI * 19 + 1.7) * amp * 0.28 + (rnd() - 0.5) * H * 0.03;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = pass === 0 ? col.ink : rgba(col.accent, 0.5);
          ctx.lineWidth = pass === 0 ? 5 : 3;
          ctx.shadowColor = col.ink; ctx.shadowBlur = pass === 0 ? 26 : 10;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(col.ink, 0.22); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke();

      } else if (kind === 'spectrum') {
        const bars = 40, gap = W / bars, bw = gap * 0.55;
        for (let i = 0; i < bars; i++) {
          const env = Math.sin((i / bars) * Math.PI);
          const hh = (0.12 + Math.pow(rnd(), 1.5) * 0.78 * (0.4 + env)) * H * 0.66;
          const x = i * gap + (gap - bw) / 2, yTop = H * 0.86 - hh;
          const bg = ctx.createLinearGradient(0, H * 0.86, 0, yTop);
          bg.addColorStop(0, rgba(col.mid, 0.85)); bg.addColorStop(1, col.ink);
          ctx.fillStyle = bg; ctx.shadowColor = col.accent; ctx.shadowBlur = 14;
          ctx.fillRect(x, yTop, bw, hh);
          ctx.shadowBlur = 0; ctx.globalAlpha = 0.16;
          ctx.fillRect(x, H * 0.86 + 4, bw, hh * 0.4);
          ctx.globalAlpha = 1;
        }

      } else if (kind === 'ripple') {
        const cx = W * 0.5, cy = H * 0.5;
        ctx.lineWidth = 4;
        for (let i = 0; i < 16; i++) {
          const r = (i + 1) / 16 * Math.max(W, H) * 0.62 + Math.sin(i) * 6;
          ctx.strokeStyle = rgba(col.ink, Math.max(0.05, 0.55 - i * 0.03));
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
        const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, W * 0.16);
        cg.addColorStop(0, rgba(col.accent, 0.95)); cg.addColorStop(1, rgba(col.accent, 0));
        ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);

      } else if (kind === 'grid') {
        const vpX = W * 0.5, vpY = H * 0.40;
        ctx.strokeStyle = rgba(col.ink, 0.5); ctx.lineWidth = 2;
        ctx.shadowColor = col.accent; ctx.shadowBlur = 8;
        for (let i = -14; i <= 14; i++) {
          const bx = vpX + i * (W * 0.5 / 7);
          ctx.beginPath(); ctx.moveTo(bx, H); ctx.lineTo(vpX + i * 3, vpY); ctx.stroke();
        }
        for (let j = 0; j <= 12; j++) {
          const f = j / 12, y = vpY + (H - vpY) * Math.pow(f, 2.3);
          ctx.globalAlpha = 0.25 + f * 0.5;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        const hg = ctx.createLinearGradient(0, vpY - 60, 0, vpY + 40);
        hg.addColorStop(0, rgba(col.accent, 0)); hg.addColorStop(0.6, rgba(col.accent, 0.4));
        hg.addColorStop(1, rgba(col.accent, 0));
        ctx.fillStyle = hg; ctx.fillRect(0, vpY - 60, W, 100);

      } else if (kind === 'spectrogram') {
        const cols = 52, rows = 22;
        const ox = W * 0.06, oy = H * 0.16, gw = W * 0.88, gh = H * 0.64;
        const cw = gw / cols, ch = gh / rows;
        for (let yy = 0; yy < rows; yy++) {
          for (let xx = 0; xx < cols; xx++) {
            let val = Math.pow(rnd(), 1.6) * (0.5 + 0.5 * Math.sin((xx / cols) * Math.PI * 3 + yy * 0.3));
            val = Math.max(0, Math.min(1, val));
            ctx.fillStyle = val < 0.5 ? rgba(col.mid, val * 1.4) : rgba(col.accent, 0.4 + val * 0.6);
            ctx.fillRect(ox + xx * cw, oy + yy * ch, cw + 0.5, ch + 0.5);
          }
        }

      } else if (kind === 'particle') {
        const pts = [];
        for (let i = 0; i < 26; i++) pts.push([rnd() * W, rnd() * H]);
        ctx.strokeStyle = rgba(col.ink, 0.22); ctx.lineWidth = 1.5;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i][0]-pts[j][0], dy = pts[i][1]-pts[j][1];
            if (dx*dx + dy*dy < (W*0.22)*(W*0.22)) {
              ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
            }
          }
        }
        for (let i = 0; i < 420; i++) {
          ctx.fillStyle = rgba(col.ink, rnd() * 0.5 + 0.08);
          ctx.beginPath(); ctx.arc(rnd()*W, rnd()*H, rnd() * 2.4 + 0.4, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowColor = col.accent; ctx.shadowBlur = 16;
        for (let i = 0; i < pts.length; i++) {
          ctx.fillStyle = rgba(col.accent, 0.9);
          ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 4, 0, Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0;

      } else if (kind === 'knobs') {
        const ky = H * 0.40, rr = W * 0.075;
        for (let i = 0; i < 3; i++) {
          const kx = W * (0.22 + i * 0.28);
          ctx.strokeStyle = rgba(col.ink, 0.3); ctx.lineWidth = 8;
          ctx.beginPath(); ctx.arc(kx, ky, rr, Math.PI*0.75, Math.PI*0.25, false); ctx.stroke();
          const a = Math.PI*0.75 + (0.15 + rnd()*0.85) * Math.PI * 1.5;
          ctx.strokeStyle = col.accent; ctx.shadowColor = col.accent; ctx.shadowBlur = 16;
          ctx.beginPath(); ctx.arc(kx, ky, rr, Math.PI*0.75, a, false); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = col.ink; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(a)*rr*0.8, ky + Math.sin(a)*rr*0.8); ctx.stroke();
        }
        const fy = H * 0.78;
        for (let i = 0; i < 4; i++) {
          const fx = W * (0.16 + i * 0.22);
          ctx.strokeStyle = rgba(col.ink, 0.3); ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(fx, fy - H*0.08); ctx.lineTo(fx, fy + H*0.08); ctx.stroke();
          const ty = fy - H*0.08 + rnd() * H*0.16;
          ctx.fillStyle = col.accent; ctx.fillRect(fx - 18, ty - 6, 36, 12);
        }

      } else { // 'poster'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const word = col.label || col.title.split(' ')[0];
        ctx.fillStyle = rgba(col.ink, 0.12);
        ctx.font = 'italic 360px "Cormorant Garamond", serif';
        ctx.fillText(word, W/2 + 8, H/2 + 8);
        ctx.fillStyle = rgba(col.ink, 0.95);
        ctx.font = 'italic 300px "Cormorant Garamond", serif';
        ctx.shadowColor = rgba(col.accent, 0.7); ctx.shadowBlur = 30;
        ctx.fillText(word, W/2, H/2);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(col.ink, 0.4); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W*0.2, H*0.74); ctx.lineTo(W*0.8, H*0.74); ctx.stroke();
      }
    }

    // ============ ABOUT IMAGE ============
    const canUseImageInWebGL = window.location.protocol !== 'file:';
    const aboutImage = new Image(); // intentionally empty — fallback draws waves

    // ============ ANIMATED SOUND-WAVE SURFACE (fullscreen background) ============
    // ONE waveform renderer (drawAboutSoundFallback, defined below) paints both
    // the active film frame's About morph AND this fullscreen background, so they
    // look identical as the frame zooms out into the About page. `waveTime` only
    // advances while the user is turning the film (scroll energy) or once the
    // About page is fully revealed -> idle on the film strip == frozen waves.
    let wavesEnergy = 0;     // 0..1, bumped on wheel, decays when idle
    let waveTime    = 0;     // shared animation clock for every wave surface
    let wavesCtl    = null;  // { draw(t) } fullscreen background painter
    (function initWavesBg() {
      const wc = document.getElementById('wavesBgCanvas');
      const wx = wc.getContext('2d');
      let wW = 0, wH = 0;
      function wResize() {
        // Cap the backing-store width so the per-frame waveform paint stays cheap.
        const cssW = wc.clientWidth  || window.innerWidth;
        const cssH = wc.clientHeight || window.innerHeight;
        const scale = Math.min(1.0, 1280 / Math.max(1, cssW)); // cap backing-store size
        wW = wc.width  = Math.round(cssW * scale);
        wH = wc.height = Math.round(cssH * scale);
      }
      window.addEventListener('resize', wResize);
      wResize();
      wavesCtl = {
        draw: function(t) { drawAboutSoundFallback(wx, 0, 0, wW, wH, t); }
      };
    })();

    function drawCoverImage(ctx, image, x, y, w, h) {
      const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (image.naturalWidth - sw) * 0.5;
      const sy = (image.naturalHeight - sh) * 0.5;
      ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    }

    function drawCoverVideo(ctx, video, x, y, w, h, extraScale) {
      if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;
      const scale = Math.max(w / video.videoWidth, h / video.videoHeight) * (extraScale || 1);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (video.videoWidth - sw) * 0.5;
      const sy = (video.videoHeight - sh) * 0.5;
      ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
      return true;
    }

    // A glowing, animated AUDIO WAVEFORM — the DAW/SoundCloud look: a mirrored
    // bar field (sample magnitudes around a centre line) with loud/quiet bursts
    // that scroll with `t`, plus softer depth-echo layers behind for richness,
    // and a bright oscilloscope line on top. Used for the film-frame morph AND
    // the fullscreen About background, so they match as the frame zooms out.
    function audioSample(u, tt) {
      // u: 0..1 across the surface, tt: animation time. The window scrolls with
      // tt so the wave "plays"; an envelope creates realistic loud/quiet sections.
      const s = u * 46.0 + tt * 5.5;
      const v = Math.sin(s * 0.50) * 0.55 +
                Math.sin(s * 1.27) * 0.32 +
                Math.sin(s * 2.73) * 0.20 +
                Math.sin(s * 0.11 - tt * 0.7) * 0.45;
      const env = Math.pow(Math.abs(Math.sin(u * Math.PI * 2.4 - tt * 1.1)), 1.6);
      return v * (0.12 + 0.95 * env);
    }

    function drawAboutSoundFallback(ctx, x, y, w, h, t) {
      t = t || 0;
      const midY = y + h * 0.5;

      // deep background
      const bg = ctx.createRadialGradient(x+w*0.5, y+h*0.46, 0, x+w*0.5, y+h*0.5, Math.max(w,h)*0.85);
      bg.addColorStop(0,   '#0c2032');
      bg.addColorStop(0.55,'#07121c');
      bg.addColorStop(1,   '#020205');
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);

      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.globalCompositeOperation = 'lighter'; // additive glow

      const COUNT = Math.max(56, Math.round(w / 9));
      function drawBars(tt, hScale, rgb, alpha, blur, hot) {
        const slot = w / COUNT;
        const bw = Math.max(1.5, slot * 0.46);
        ctx.shadowBlur = blur;
        for (let i = 0; i < COUNT; i++) {
          const u = i / (COUNT - 1);
          const a = audioSample(u, tt);
          const mag = Math.min(1.0, Math.abs(a));
          let bh = mag * h * 0.46 * hScale;
          if (bh < 1) bh = 1;
          const cx = x + u * w;
          const col = (hot && mag > 0.72) ? '255,111,60' : rgb; // hot orange peaks
          const aa = alpha * (0.35 + 0.65 * mag);
          ctx.fillStyle   = 'rgba(' + col + ',' + aa.toFixed(3) + ')';
          ctx.shadowColor = 'rgba(' + col + ',' + alpha.toFixed(3) + ')';
          ctx.fillRect(cx - bw * 0.5, midY - bh, bw, bh * 2); // mirrored around centre
        }
      }

      // depth echoes (back) -> main waveform (front). shadowBlur is the costly
      // part, so echoes use little/none and only the front layer glows brightly.
      drawBars(t * 0.6 + 2.1, 0.55, '123,216,255', 0.09, 0,  false); // far cyan echo
      drawBars(t * 0.8 + 1.0, 0.78, '216,164,88',  0.17, 3,  false); // mid amber
      drawBars(t,             1.00, '123,216,255', 0.50, 7,  true);  // front + hot peaks

      // oscilloscope line tracing the peaks (dimmed)
      ctx.shadowBlur  = 6;
      ctx.shadowColor = 'rgba(216,236,255,0.5)';
      ctx.strokeStyle = 'rgba(233,244,255,0.55)';
      ctx.lineWidth   = Math.max(1.5, h * 0.006);
      ctx.beginPath();
      for (let px = 0; px <= w; px += 3) {
        const u = px / w;
        const yy = midY - audioSample(u, t) * h * 0.30;
        px === 0 ? ctx.moveTo(x + px, yy) : ctx.lineTo(x + px, yy);
      }
      ctx.stroke();

      // faint zero-axis baseline
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(123,216,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke();

      ctx.restore();
    }

    // The flat About mesh's texture is redrawn every frame (see animate) so its
    // waveform animates; keep a handle to its canvas/ctx/texture for that.
    const aboutTexState = { canvas: null, ctx: null, tex: null };
    function makeAboutFallbackTexture() {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = Math.round(c.width * (FRAME_H / FRAME_W));
      const cx = c.getContext('2d');
      drawAboutSoundFallback(cx, 0, 0, c.width, c.height, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      aboutTexState.canvas = c;
      aboutTexState.ctx = cx;
      aboutTexState.tex = tex;
      return tex;
    }

    // ============ FILM STRIP TEXTURE ============
    const filmCanvasState = {
      canvas: null,
      ctx: null,
      framePx: 1024,
      gapPx: 0,
      sprocketPx: 0,
      slotPx: 0,
      framePxH: 0,
      totalH: 0
    };
    let filmTexture;
    let lastAboutMix = -1;

    function visibleActiveFrameIndex() {
      const visibleU = activeFrameSForTexture * (visibleFramesForTexture / N) + currentOffset;
      const wrappedU = ((visibleU % 1) + 1) % 1;
      return Math.floor(wrappedU * N);
    }

    // Snapshot the just-drawn video pixels of slot i so we can re-show them if
    // the video stalls on a later paint (prevents the synthetic-poster flicker).
    function captureFreeze(i, x, y, w, h) {
      let fz = frameFreeze[i];
      if (!fz) {
        fz = document.createElement('canvas');
        fz.width = w; fz.height = h;
        frameFreeze[i] = fz;
      }
      const fctx = fz.getContext('2d');
      fctx.clearRect(0, 0, w, h);
      fctx.drawImage(filmCanvasState.canvas, x, y, w, h, 0, 0, w, h);
    }

    function fmtClock(s) {
      if (!Number.isFinite(s)) s = 0;
      const m = Math.floor(s / 60);
      const ss = Math.floor(s % 60);
      return m + ':' + String(ss).padStart(2, '0');
    }

    // Bottom-bar layout, as fractions of the frame. Shared by the baked drawing
    // and the pointer hit-testing so the two always line up.
    const UI_BAR_H = 0.22;     // control-bar height
    const UI_PP_X  = 0.045;    // play/pause glyph (bottom-LEFT)
    const UI_TL_X0 = 0.09;     // timeline left
    const UI_TL_X1 = 0.40;     // timeline right
    const UI_TC_X  = 0.44;     // timecode LEFT anchor
    const UI_SPK_X = 0.65;     // speaker icon (bottom-right group)
    const UI_VOL_X0 = 0.71;    // volume bar left  (clear of speaker waves)
    const UI_VOL_X1 = 0.83;    // volume bar right
    const UI_FSB_X  = 0.93;    // fullscreen glyph (bottom-RIGHT)
    const UI_BAND  = 0.78;     // y below which clicks hit the bottom bar
    // Close (X) lives top-right; its tap zone is the whole top-right corner so
    // it stays reliable on the curved/bulging frame.
    const UI_BTN_Y    = 0.10;  // vertical centre of the close icon
    const UI_CLOSE_X  = 0.935; // close (X) icon centre
    const UI_TOP_BAND = 0.22;  // y below frame-top counts as the corner zone
    const UI_TR_X     = 0.80;  // x beyond which the top zone closes

    // Animated "loading" state baked onto the frame while its video decodes.
    function drawLoading(ctx, x, y, w, h) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.fillStyle = 'rgba(2,2,5,0.4)';
      ctx.fillRect(x, y, w, h);
      const cx = x + w * 0.5, cy = y + h * 0.42, R = h * 0.10;
      const a = (performance.now() / 1000) * 4.2;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3, R * 0.18);
      ctx.strokeStyle = 'rgba(248,239,224,0.16)';
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(216,164,88,0.95)';
      ctx.beginPath(); ctx.arc(cx, cy, R, a, a + Math.PI * 0.6); ctx.stroke();
      ctx.fillStyle = 'rgba(248,239,224,0.88)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = Math.round(h * 0.05) + 'px "JetBrains Mono", monospace';
      ctx.fillText('LOADING FILM' + '.'.repeat(1 + (Math.floor(performance.now() / 400) % 3)), cx, cy + R + h * 0.13);
      ctx.restore();
    }

    // Player UI baked straight into the film texture, so it curves with the
    // strip — real transport drawn ONTO the active frame in 3D. mode:
    // 'idle' = the preview affordance, 'playing' = live playback controls.
    function drawFrameUI(ctx, x, y, w, h, mode) {
      const playing = mode === 'playing';
      const src = playing ? mainVideo : previewVideos[activeIndex];
      const paused = playing ? mainVideo.paused : false;
      let prog = 0, cur = 0, dur = 0;
      if (playing) {
        cur = src.currentTime || 0;
        dur = src.duration || 0;
        prog = dur ? Math.max(0, Math.min(1, cur / dur)) : 0;
      } else if (src && src.duration) {
        const end = Math.min(PREVIEW_START + PREVIEW_SECONDS, src.duration);
        cur = Math.max(0, (src.currentTime || 0) - PREVIEW_START);
        dur = Math.max(0.1, end - PREVIEW_START);
        prog = Math.max(0, Math.min(1, cur / dur));
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

      // Show the loading spinner ONLY when this frame has never shown video
      // (no freeze to fall back on). On open/close/scrub the source dips below
      // "ready" for a moment, but a freeze frame is already on screen — so we
      // skip the spinner and just draw controls over it (no flash).
      const ready = playing ? (playerEverReady || mainVideo.readyState >= 2)
                            : (src && src.readyState >= 2 && src.duration);
      if (!ready && !frameHasVideo[activeIndex]) {
        drawLoading(ctx, x, y, w, h);
        ctx.restore();
        return;
      }

      // bottom control bar
      const barH = h * UI_BAR_H;
      const bg = ctx.createLinearGradient(0, y + h - barH, 0, y + h);
      bg.addColorStop(0, 'rgba(2,2,5,0)');
      bg.addColorStop(1, 'rgba(2,2,5,0.66)');
      ctx.fillStyle = bg;
      ctx.fillRect(x, y + h - barH, w, barH);

      // big centre play button: idle always; in playback only while paused
      if (!playing || paused) {
        const cx = x + w * 0.5, cy = y + h * 0.42;
        const R = h * 0.14;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(8,8,12,0.42)'; ctx.fill();
        ctx.lineWidth = Math.max(3, R * 0.10);
        ctx.strokeStyle = 'rgba(248,239,224,0.92)';
        ctx.shadowColor = 'rgba(216,164,88,0.55)'; ctx.shadowBlur = R * 0.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        const tw = R * 0.62, th = R * 0.74;
        ctx.beginPath();
        ctx.moveTo(cx - tw * 0.42, cy - th * 0.5);
        ctx.lineTo(cx - tw * 0.42, cy + th * 0.5);
        ctx.lineTo(cx + tw * 0.72, cy);
        ctx.closePath();
        ctx.fillStyle = 'rgba(248,239,224,0.96)';
        ctx.fill();
      }

      const lineY = y + h - barH * 0.42;

      // Preview (idle): NO timeline — just a clear, clickable CLICK TO PLAY
      // centred at the bottom (the whole frame is the click target).
      if (!playing) {
        ctx.fillStyle = 'rgba(248,239,224,0.95)';
        ctx.font = Math.round(h * 0.055) + 'px "JetBrains Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = h * 0.03;
        ctx.fillText('CLICK TO PLAY', x + w * 0.5, lineY);
        ctx.shadowBlur = 0;
        ctx.restore();
        return;
      }

      ctx.lineCap = 'round';
      ctx.fillStyle = 'rgba(248,239,224,0.92)';

      // play / pause glyph (far left)
      const ppX = x + w * UI_PP_X, ir = h * 0.05;
      if (!paused) {
        const bw = ir * 0.42, gap = ir * 0.34, bh = ir * 1.5;
        ctx.fillRect(ppX - gap - bw, lineY - bh / 2, bw, bh);
        ctx.fillRect(ppX + gap, lineY - bh / 2, bw, bh);
      } else {
        ctx.beginPath();
        ctx.moveTo(ppX - ir * 0.5, lineY - ir * 0.72);
        ctx.lineTo(ppX - ir * 0.5, lineY + ir * 0.72);
        ctx.lineTo(ppX + ir * 0.82, lineY);
        ctx.closePath();
        ctx.fill();
      }

      // speaker icon + volume slider (compact, kept clear of the slider)
      const vol = mainVideo.muted ? 0 : Math.max(0, Math.min(1, mainVideo.volume || 0));
      const spkX = x + w * UI_SPK_X, sr = h * 0.036;
      ctx.beginPath();
      ctx.moveTo(spkX - sr * 0.9, lineY - sr * 0.34);
      ctx.lineTo(spkX - sr * 0.25, lineY - sr * 0.34);
      ctx.lineTo(spkX + sr * 0.4, lineY - sr * 0.8);
      ctx.lineTo(spkX + sr * 0.4, lineY + sr * 0.8);
      ctx.lineTo(spkX - sr * 0.25, lineY + sr * 0.34);
      ctx.lineTo(spkX - sr * 0.9, lineY + sr * 0.34);
      ctx.closePath();
      ctx.fillStyle = 'rgba(248,239,224,0.92)'; ctx.fill();
      ctx.lineWidth = Math.max(2, sr * 0.16);
      ctx.strokeStyle = vol > 0 ? 'rgba(248,239,224,0.8)' : 'rgba(248,239,224,0.22)';
      ctx.beginPath(); ctx.arc(spkX + sr * 0.45, lineY, sr * 0.6, -0.6, 0.6); ctx.stroke();
      if (vol > 0.5) { ctx.beginPath(); ctx.arc(spkX + sr * 0.45, lineY, sr * 0.95, -0.6, 0.6); ctx.stroke(); }

      const vx0 = x + w * UI_VOL_X0, vx1 = x + w * UI_VOL_X1;
      ctx.lineWidth = Math.max(3, h * 0.012);
      ctx.strokeStyle = 'rgba(248,239,224,0.22)';
      ctx.beginPath(); ctx.moveTo(vx0, lineY); ctx.lineTo(vx1, lineY); ctx.stroke();
      ctx.strokeStyle = 'rgba(248,239,224,0.85)';
      ctx.beginPath(); ctx.moveTo(vx0, lineY); ctx.lineTo(vx0 + (vx1 - vx0) * vol, lineY); ctx.stroke();
      ctx.beginPath(); ctx.arc(vx0 + (vx1 - vx0) * vol, lineY, h * 0.016, 0, Math.PI * 2);
      ctx.fillStyle = '#f8efe0'; ctx.fill();

      // timeline
      const x0 = x + w * UI_TL_X0, x1 = x + w * UI_TL_X1;
      ctx.lineWidth = Math.max(3, h * 0.013);
      ctx.strokeStyle = 'rgba(248,239,224,0.22)';
      ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x1, lineY); ctx.stroke();
      ctx.strokeStyle = 'rgba(216,164,88,0.95)';
      ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x0 + (x1 - x0) * prog, lineY); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * prog, lineY, h * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = '#f0d6a8'; ctx.fill();

      // timecode (compact, left-anchored so it never collides with the timeline)
      ctx.fillStyle = 'rgba(248,239,224,0.82)';
      ctx.font = Math.round(h * 0.04) + 'px "JetBrains Mono", monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtClock(cur) + ' / ' + fmtClock(dur), x + w * UI_TC_X, lineY);

      const br = h * 0.05;
      // fullscreen glyph bottom-RIGHT
      topBtn(ctx, x + w * UI_FSB_X, lineY, br, 'expand');

      // close (X) top-RIGHT, with a soft corner darkening for legibility
      const rad = ctx.createRadialGradient(
        x + w * 0.95, y + h * 0.05, 0,
        x + w * 0.95, y + h * 0.05, w * 0.27);
      rad.addColorStop(0, 'rgba(2,2,5,0.5)');
      rad.addColorStop(1, 'rgba(2,2,5,0)');
      ctx.fillStyle = rad;
      ctx.fillRect(x, y, w, h);
      topBtn(ctx, x + w * UI_CLOSE_X, y + h * UI_BTN_Y, br, 'close');

      ctx.restore();
    }

    // One of the curved, baked top-right player buttons.
    function topBtn(ctx, cx, cy, r, kind) {
      ctx.save();
      // Clean glyph (no chip) to match the baked timecode / play look, with a
      // soft shadow so it stays legible over bright video.
      ctx.strokeStyle = 'rgba(248,239,224,0.95)';
      ctx.lineWidth = Math.max(2.5, r * 0.2);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = r * 0.7;
      if (kind === 'close') {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.58, cy - r * 0.58); ctx.lineTo(cx + r * 0.58, cy + r * 0.58);
        ctx.moveTo(cx + r * 0.58, cy - r * 0.58); ctx.lineTo(cx - r * 0.58, cy + r * 0.58);
        ctx.stroke();
      } else {
        const a = r * 0.72, b = r * 0.34;
        ctx.beginPath();
        if (kind === 'expand') {
          ctx.moveTo(cx - a + b, cy - a); ctx.lineTo(cx - a, cy - a); ctx.lineTo(cx - a, cy - a + b);
          ctx.moveTo(cx + a - b, cy - a); ctx.lineTo(cx + a, cy - a); ctx.lineTo(cx + a, cy - a + b);
          ctx.moveTo(cx + a, cy + a - b); ctx.lineTo(cx + a, cy + a); ctx.lineTo(cx + a - b, cy + a);
          ctx.moveTo(cx - a + b, cy + a); ctx.lineTo(cx - a, cy + a); ctx.lineTo(cx - a, cy + a - b);
        } else { // compress (inward)
          ctx.moveTo(cx - a, cy - a + b); ctx.lineTo(cx - a + b, cy - a + b); ctx.lineTo(cx - a + b, cy - a);
          ctx.moveTo(cx + a, cy - a + b); ctx.lineTo(cx + a - b, cy - a + b); ctx.lineTo(cx + a - b, cy - a);
          ctx.moveTo(cx + a, cy + a - b); ctx.lineTo(cx + a - b, cy + a - b); ctx.lineTo(cx + a - b, cy + a);
          ctx.moveTo(cx - a, cy + a - b); ctx.lineTo(cx - a + b, cy + a - b); ctx.lineTo(cx - a + b, cy + a);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    function redrawFilmTexture(aboutMix) {
      if (!filmCanvasState.ctx) return;

      const c = filmCanvasState.canvas;
      const ctx = filmCanvasState.ctx;
      const FRAME_PX = filmCanvasState.framePx;
      const GAP_PX = filmCanvasState.gapPx;
      const SPROCKET_PX = filmCanvasState.sprocketPx;
      const SLOT_PX = filmCanvasState.slotPx;
      const FRAME_PX_H = filmCanvasState.framePxH;
      const TOTAL_H = filmCanvasState.totalH;
      const TOTAL_W = c.width;

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, TOTAL_W, TOTAL_H);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

      const aboutFrameIndex = visibleActiveFrameIndex();
      for (let i = 0; i < N; i++) {
        const frameCanvas = makeFrameTexture(projects[i], i);
        const x = i * SLOT_PX + GAP_PX / 2;
        const y = SPROCKET_PX;
        ctx.drawImage(frameCanvas, x, y, FRAME_PX, FRAME_PX_H);

        const video = previewVideos[i];
        const playerVideoInFrame = (playerOpening || playerOpen) && i === activeIndex && mainVideo.readyState >= 2;
        const sourceVideo = playerVideoInFrame ? mainVideo : video;
        const scaleForFrame = playerVideoInFrame ? 1 : (projects[i].previewScale || 1);
        let drewVideo = drawCoverVideo(ctx, sourceVideo, x, y, FRAME_PX, FRAME_PX_H, scaleForFrame);
        if (drewVideo) {
          // Only the active frame keeps moving, so only refresh its freeze every
          // paint; the paused neighbours just need one capture on first paint.
          if (i === activeIndex || !frameFreeze[i]) captureFreeze(i, x, y, FRAME_PX, FRAME_PX_H);
          frameHasVideo[i] = true;
        } else if (frameHasVideo[i] && frameFreeze[i]) {
          ctx.drawImage(frameFreeze[i], x, y, FRAME_PX, FRAME_PX_H);
          drewVideo = true;
        }
        if (drewVideo) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = i === activeIndex ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.22)';
          ctx.fillRect(x, y, FRAME_PX, FRAME_PX_H);
          ctx.restore();
        }

        // On-film player UI, baked into the texture so it curves with the strip.
        // Only when fully open (not mid-zoom) so it doesn't flash during the
        // open/close transition; hidden entirely in cinema (fullscreen) mode.
        if (i === activeIndex && !playerCinema) {
          if (playerOpen) {
            drawFrameUI(ctx, x, y, FRAME_PX, FRAME_PX_H, 'playing');
          } else if (!playerOpening && filmZoom < 0.06) {
            drawFrameUI(ctx, x, y, FRAME_PX, FRAME_PX_H, 'idle');
          }
        }

        if (i === aboutFrameIndex && aboutMix > 0.001) {
          ctx.save();
          ctx.globalAlpha = aboutMix;
          if (canUseImageInWebGL && aboutImage.complete && aboutImage.naturalWidth > 0) {
            drawCoverImage(ctx, aboutImage, x, y, FRAME_PX, FRAME_PX_H);
          } else {
            // Animated waves, drawn INTO the active frame -> clipped to it and
            // bulging with it (framed exactly like the video preview).
            drawAboutSoundFallback(ctx, x, y, FRAME_PX, FRAME_PX_H, waveTime);
          }
          ctx.restore();
        }
      }

      // SQUARE sprocket holes
      const HOLES_PER_SLOT = 7;
      const HOLE_SIZE = Math.round(SPROCKET_PX * 0.42);
      const holeSpacing = SLOT_PX / HOLES_PER_SLOT;

      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < N; i++) {
        const slotStartX = i * SLOT_PX;
        for (let h = 0; h < HOLES_PER_SLOT; h++) {
          const cx = slotStartX + h * holeSpacing + holeSpacing / 2;
          const x = cx - HOLE_SIZE / 2;
          const yTop = (SPROCKET_PX - HOLE_SIZE) / 2;
          ctx.fillRect(x, yTop, HOLE_SIZE, HOLE_SIZE);
          const yBot = TOTAL_H - SPROCKET_PX + (SPROCKET_PX - HOLE_SIZE) / 2;
          ctx.fillRect(x, yBot, HOLE_SIZE, HOLE_SIZE);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      if (filmTexture) filmTexture.needsUpdate = true;
      lastAboutMix = aboutMix;
    }

    function buildFilmTexture() {
      // The whole strip is ONE canvas re-uploaded to the GPU on every preview
      // repaint; at 1024px/frame that's ~8200px wide. Phones get 512px/frame —
      // a quarter of the upload — and the frame is at most ~60% of a small
      // screen anyway, so it still reads sharp.
      const FRAME_PX = LITE ? 512 : 1024;
      const GAP_PX = Math.round(FRAME_PX * FRAME_GAP / FRAME_W);
      const SPROCKET_PX = Math.round(FRAME_PX * SPROCKET_H / FRAME_W);
      const SLOT_PX = FRAME_PX + GAP_PX;
      const TOTAL_W = SLOT_PX * N;
      const FRAME_PX_H = Math.round(FRAME_PX * FRAME_H / FRAME_W);
      const TOTAL_H = FRAME_PX_H + SPROCKET_PX * 2;

      const c = document.createElement('canvas');
      c.width = TOTAL_W; c.height = TOTAL_H;
      const ctx = c.getContext('2d');

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = LITE ? 4 : renderer.capabilities.getMaxAnisotropy();
      filmCanvasState.canvas = c;
      filmCanvasState.ctx = ctx;
      filmCanvasState.framePx = FRAME_PX;
      filmCanvasState.gapPx = GAP_PX;
      filmCanvasState.sprocketPx = SPROCKET_PX;
      filmCanvasState.slotPx = SLOT_PX;
      filmCanvasState.framePxH = FRAME_PX_H;
      filmCanvasState.totalH = TOTAL_H;
      filmTexture = tex;
      redrawFilmTexture(0);
      return tex;
    }

    filmTexture = buildFilmTexture();

    // ============ THE HORIZONTAL PANORAMIC ARC ============
    //
    // The film lies on a shallow HORIZONTAL arc (a slice of a big cylinder
    // seen from the front). The CENTER of the arc sits closest to the camera
    // and faces the viewer head-on; frames curve away to the left and right
    // and recede into the distance. So the active (center) frame clearly
    // bulges toward you — a wave whose crest points AT the user — while the
    // neighbours turn away. Both ends fade out near the screen edges.

    const PLANE_TILT_X = 0.0;
    const PLANE_TILT_Y = 0.0;

    // Cylinder-wrap shape knobs — tweak these to taste:
    const CYL_R     = 9.0;     // wrap radius (bigger = flatter/straighter front frame + larger)
    const CYL_LEFT  = 3.05;    // how far the film wraps to the LEFT (recedes into the distance)
    const CYL_RIGHT = 1.25;    // how far it wraps to the RIGHT (a short gentle sweep)
    const CYL_RISE  = 1.0;     // base rise of the wrapped ends
    const BACK_LIFT = 5.0;     // the BACK tail lifts UP (as if the film is flowing upward)
    const BACK_CURL = 2.8;     // the back tail bends/curls over while it lifts
    const CYL_PTS   = 110;
    // Re-used by the fragment shader's depth fade (front z = +CYL_R, back z = -CYL_R):
    const ARC_DEPTH = CYL_R;
    const ARC_BACK  = CYL_R;

    // ref.png: the film is wrapped around a vertical cylinder. The front-center
    // frame faces the viewer (active); side frames turn away; and the strip
    // wraps around the back, where the BACK tail lifts UP and bends over — as if
    // the film is flowing upward into the distance. Asymmetric (more to the left).
    const curvePoints = [];
    for (let i = 0; i < CYL_PTS; i++) {
      const p = i / (CYL_PTS - 1);
      const th = -CYL_LEFT + p * (CYL_LEFT + CYL_RIGHT);   // th = 0 -> front-center
      const behind = Math.max(0, -Math.cos(th));           // 0 at the front, ->1 at the far back
      const lift = behind * behind;                        // concentrate the lift on the far tail
      const x = CYL_R * Math.sin(th) - BACK_CURL * lift;   // back tail bends/curls over
      const z = CYL_R * Math.cos(th);                      // front close, wrapped ends far back
      const y = CYL_RISE * (1.0 - Math.cos(th)) + BACK_LIFT * lift;  // back tail rises up & away
      curvePoints.push(new THREE.Vector3(x, y, z));
    }

    const pathCurve = new THREE.CatmullRomCurve3(curvePoints, false, 'catmullrom', 0.5);

    // One texture frame spans SLOT units of arc length, so frames keep their
    // correct aspect no matter how big the arc is.
    const VISIBLE_FRAMES = pathCurve.getLength() / SLOT;
    visibleFramesForTexture = VISIBLE_FRAMES;

    function curvePoint(s) {
      const p = pathCurve.getPointAt(s).clone();
      p.applyEuler(new THREE.Euler(PLANE_TILT_X, PLANE_TILT_Y, 0, 'XYZ'));
      return p;
    }

    function curveTangent(s) {
      const ds = 0.0005;
      const a = curvePoint(Math.max(0, s - ds));
      const b = curvePoint(Math.min(1, s + ds));
      return b.sub(a).normalize();
    }

    function findLowerLoopFocusS() {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      const frontLoop = [];

      for (let i = 0; i <= SEGMENTS; i++) {
        const s = i / SEGMENTS;
        const p = curvePoint(s);
        if (p.z <= 0) continue;
        frontLoop.push({ s: s, point: p });
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }

      if (!frontLoop.length) return 0.5;

      const targetX = (minX + maxX) * 0.5 + (maxX - minX) * ACTIVE_FRAME_RIGHT_BIAS;
      const targetY = (minY + maxY) * 0.5;
      let bestS = frontLoop[0].s;
      let bestDist = Infinity;

      for (let i = 0; i < frontLoop.length; i++) {
        const candidate = frontLoop[i];
        const dx = candidate.point.x - targetX;
        const dy = candidate.point.y - targetY;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestS = candidate.s;
        }
      }

      return bestS;
    }

    // ============ BUILD THE RIBBON MESH ============
    const SEGMENTS = 400;
    const positions = [];
    const uvs = [];
    const indices = [];

    const centers = [];
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      centers.push(curvePoint(s));
    }

    // Auto-pick the front-most (camera-facing, least-receded) part of the loop
    // as the active frame — the big flat arc at the bottom-front.
    const ACTIVE_FRAME_S = findLowerLoopFocusS();
    activeFrameSForTexture = ACTIVE_FRAME_S;
    redrawFilmTexture(lastAboutMix < 0 ? 0 : lastAboutMix);

    // Use a transport frame so the strip keeps a stable orientation through
    // tight turns instead of re-snapping to world up at every sample.
    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    const WORLD_FORWARD = new THREE.Vector3(0, 0, 1);
    const tangents = [];
    const frames = { normals: [], binormals: [] };

    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      tangents.push(curveTangent(s));
    }

    function projectedNormal(reference, tangent) {
      const projected = reference.clone().sub(
        tangent.clone().multiplyScalar(reference.dot(tangent))
      );
      if (projected.lengthSq() < 1e-6) return null;
      return projected.normalize();
    }

    let normal = projectedNormal(WORLD_UP, tangents[0]) || projectedNormal(WORLD_FORWARD, tangents[0]);
    let binormal = new THREE.Vector3().crossVectors(tangents[0], normal).normalize();
    frames.normals.push(normal.clone());
    frames.binormals.push(binormal.clone());

    for (let i = 1; i <= SEGMENTS; i++) {
      const tangent = tangents[i];
      const carried = projectedNormal(normal, tangent);
      const upright = projectedNormal(WORLD_UP, tangent) || projectedNormal(WORLD_FORWARD, tangent);

      normal = (carried || upright).clone();
      if (upright && normal.dot(upright) < 0) upright.multiplyScalar(-1);
      if (upright) normal.lerp(upright, 0.18).normalize();

      binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
      normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

      frames.normals.push(normal.clone());
      frames.binormals.push(binormal.clone());
    }

    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const center = centers[i];
      const filmUp = frames.normals[i];

      const top = center.clone().addScaledVector(filmUp, FILM_H / 2);
      const bot = center.clone().addScaledVector(filmUp, -FILM_H / 2);

      positions.push(top.x, top.y, top.z);
      positions.push(bot.x, bot.y, bot.z);

      // UV: u runs along the strip, scaled so VISIBLE_FRAMES texture
      // repetitions cover the whole curve — when uOffset shifts, frames
      // appear to scroll along the S.
      // Texture covers N frames. Curve length = VISIBLE_FRAMES frames.
      // So uv.u = s * (VISIBLE_FRAMES / N), shifted by uOffset.
      const uvU = s * (VISIBLE_FRAMES / N);
      uvs.push(uvU, 0);
      uvs.push(uvU, 1);
    }

    for (let i = 0; i < SEGMENTS; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }

    const ribbonGeom = new THREE.BufferGeometry();
    ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ribbonGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ribbonGeom.setIndex(indices);
    ribbonGeom.computeVertexNormals();

    // We also need to know each vertex's "s" param along the curve, for
    // fading the ends. Pass it as a custom attribute.
    const sValues = new Float32Array((SEGMENTS + 1) * 2);
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      sValues[i * 2] = s;
      sValues[i * 2 + 1] = s;
    }
    ribbonGeom.setAttribute('aS', new THREE.BufferAttribute(sValues, 1));

    // ============ MATERIAL with UV scroll + END FADE ============
    const filmMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: filmTexture },
        uOffset: { value: 0 },
        uFocusS: { value: ACTIVE_FRAME_S },
        uBulge: { value: 0.92 }
      },
      vertexShader: [
        'attribute float aS;',
        'varying vec2 vUv;',
        'varying float vS;',
        'varying float vZ;',
        'uniform float uOffset;',
        'uniform float uFocusS;',
        'uniform float uBulge;',
        'void main() {',
        '  vUv = vec2(uv.x + uOffset, uv.y);',
        '  vS = aS;',
        '  vZ = position.z;',
        '  vec3 p = position;',
        // Tighter focus band: only the active frame stays flat & forward,
        // its neighbours start curling away — that curl is the active cue.
        '  float focusBand = 1.0 - smoothstep(0.0, 0.22, abs(aS - uFocusS));',
        '  float curlBand = 1.0 - focusBand;',
        '  float edgeMask = clamp(abs(uv.y - 0.5) * 2.0, 0.0, 1.0);',
        '  float softCurl = smoothstep(0.12, 1.0, curlBand);',
        '  p.z -= softCurl * (0.12 + edgeMask * 0.18);',
        '  p.y += softCurl * softCurl * 0.035;',
        // Extra forward surge on the active frame, on top of the arc geometry,
        // so its crest points AT the user.
        '  float crest = focusBand * focusBand;',
        '  float activeScale = crest * 0.32;',
        '  p.x += (aS - uFocusS) * activeScale * 8.5;',
        '  p.y += (uv.y - 0.5) * activeScale * 1.25;',
        '  p.z += crest * uBulge;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap;',
        'uniform float uFocusS;',
        'varying vec2 vUv;',
        'varying float vS;',
        'varying float vZ;',
        'void main() {',
        '  vec2 sampleUv = gl_FrontFacing ? vec2(vUv.x, 1.0 - vUv.y) : vUv;',
        '  vec4 c = texture2D(uMap, sampleUv);',
        '  float edgeBand = clamp(abs(vUv.y - 0.5) * 2.0, 0.0, 1.0);',
        // Concentrate the highlight on (roughly) the single active frame.
        '  float focusBand = 1.0 - smoothstep(0.0, 0.15, abs(vS - uFocusS));',
        // Active frame: brighter & more saturated; the rest dim & desaturated.
        '  c.rgb *= mix(0.64, 1.32, focusBand);',
        '  float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
        '  c.rgb = mix(vec3(luma), c.rgb, mix(0.72, 1.16, focusBand));',
        // Darken the film as it recedes behind, so the back pass reads as depth.
        '  float depthDim = clamp((vZ + ' + ARC_BACK.toFixed(2) + ') / ' + (ARC_DEPTH + ARC_BACK).toFixed(2) + ', 0.0, 1.0);',
        '  c.rgb *= mix(0.4, 1.0, depthDim);',
        // Back of the film: show a dark, neutral film "spine" (no mirrored image),
        '  if (!gl_FrontFacing) c.rgb = mix(vec3(0.05, 0.06, 0.09), vec3(0.12, 0.13, 0.17), depthDim);',
        // Soft fade at the strip ends.
        '  float fadeStart = smoothstep(0.0, 0.10, vS);',
        '  float fadeEnd   = smoothstep(1.0, 0.84, vS);',
        '  float edgeAlpha = mix(0.68, 0.82, edgeBand);',
        // Push non-active frames slightly back in opacity so the active pops.
        '  float focusAlpha = mix(0.78, 1.0, focusBand);',
        // Atmospheric depth fade: the receding film dissolves INTO the distance
        // instead of ending in a hard cut.
        '  float fogAlpha = smoothstep(0.0, 0.34, depthDim);',
        '  float alpha = fadeStart * fadeEnd * edgeAlpha * focusAlpha * fogAlpha;',
        '  gl_FragColor = vec4(c.rgb, c.a * alpha);',
        '}'
      ].join('\n'),
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      alphaTest: 0.12
    });

    const filmMesh = new THREE.Mesh(ribbonGeom, filmMaterial);

    const aboutFrameTexture = makeAboutFallbackTexture();

    const aboutFrameMat = new THREE.MeshBasicMaterial({
      map: aboutFrameTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });
    // The film shader bulges the active frame forward and stretches it, so on
    // screen it renders ~1.18x wider and ~1.30x taller than a flat 1:1 plane
    // (the same factors the tap hit-rect uses below: FRAME_RECT_GX/GY). Grow the
    // About morph plane by the same amounts so it covers the active frame
    // exactly — otherwise the waves sit INSIDE the frame, looking "not stretched".
    const ABOUT_FRAME_GX = 1.18;
    const ABOUT_FRAME_GY = 1.30;
    // The oversized flat plane fills the screen for the final full-screen About
    // background, so it may only fade in once the active frame is large/head-on
    // (z within this range). Before that its extra size would bleed the waves
    // onto the neighbouring frames; the clipped in-frame waves carry the morph
    // until then. Lower ABOUT_PLANE_IN0 to bring the plane in earlier.
    const ABOUT_PLANE_IN0 = 0.6;
    const ABOUT_PLANE_IN1 = 0.92;
    const aboutFrameMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(FRAME_W * 0.985 * ABOUT_FRAME_GX, FRAME_H * 0.985 * ABOUT_FRAME_GY),
      aboutFrameMat
    );
    const activeSample = Math.max(0, Math.min(SEGMENTS, Math.round(ACTIVE_FRAME_S * SEGMENTS)));
    const activeTangent = tangents[activeSample].clone().normalize();
    const activeNormal = frames.normals[activeSample].clone().normalize();
    const activeBinormal = frames.binormals[activeSample].clone().normalize();
    aboutFrameMesh.position.copy(centers[activeSample]).addScaledVector(activeBinormal, 0.08);
    aboutFrameMesh.setRotationFromMatrix(new THREE.Matrix4().makeBasis(
      activeTangent,
      activeNormal,
      activeBinormal
    ));
    aboutFrameMesh.renderOrder = 10;

    const glowCurve = new THREE.CatmullRomCurve3(
      centers.map(function(p) { return p.clone(); }),
      false,
      'centripetal'
    );
    const glowTubeGeom = new THREE.TubeGeometry(glowCurve, 220, FILM_H * 0.08, 14, false);
    const glowTubeMat = new THREE.MeshBasicMaterial({
      color: 0xf6d7aa,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowTube = new THREE.Mesh(glowTubeGeom, glowTubeMat);
    glowTube.scale.set(1.0, 0.9, 1.0);
    glowTube.visible = false;

    const filmGroup = new THREE.Group();
    filmGroup.add(glowTube);
    filmGroup.add(filmMesh);
    filmGroup.add(aboutFrameMesh);
    filmGroup.scale.set(0.82, 0.82, 0.82);
    const FILM_BASE_ROT_X = 0.10;
    const FILM_BASE_ROT_Y = 0.0;
    const FILM_BASE_ROT_Z = 0.0;
    const FILM_BASE_POS_X = 0.0;
    const FILM_BASE_POS_Y = 0.98;
    scene.add(filmGroup);

    // ============ NAVIGATION ============
    // The active frame should land at the visual center of the lower,
    // front-facing loop rather than the midpoint of the whole strip.
    //
    // In texture space, frame i is centered at u = (i + 0.5)/N.
    // After UV shift by uOffset, that u appears at vertex u-coordinate:
    //   vertexU = (i + 0.5)/N - uOffset   ... no wait, vUv = uv.x + uOffset
    //   so vertexU has uv.x = vUv - uOffset, and we want the frame at
    //   vUv = (i+0.5)/N to appear at vertex uv.x = visible_uv_at_s
    //   = ACTIVE_FRAME_S * (VISIBLE_FRAMES / N).
    //
    // From vUv = uv.x + uOffset:
    //   (i+0.5)/N = ACTIVE_FRAME_S * (VISIBLE_FRAMES / N) + uOffset
    //   uOffset = (i+0.5)/N - ACTIVE_FRAME_S * (VISIBLE_FRAMES / N)
    //           = ((i+0.5) - ACTIVE_FRAME_S * VISIBLE_FRAMES) / N

    function offsetForFrame(i) {
      return ((i + 0.5) - ACTIVE_FRAME_S * VISIBLE_FRAMES) / N;
    }

    targetOffset = offsetForFrame(activeIndex);
    currentOffset = targetOffset;

    function shortestDelta(from, to) {
      // Texture wraps every N/N = 1 unit (one full set of frames),
      // so wrap delta to nearest equivalent.
      let d = to - from;
      while (d > 0.5) d -= 1;
      while (d < -0.5) d += 1;
      return d;
    }

    function startActivePreview() {
      // Pause + de-prioritise every non-active frame so bandwidth goes to the
      // one we actually want to see moving.
      previewVideos.forEach(function(video, i) {
        if (i !== activeIndex) {
          video.pause();
          if (video.preload !== 'metadata') video.preload = 'metadata';
        }
      });

      const activeFor = activeIndex;
      previewActiveIndex = activeFor;
      const video = previewVideos[activeFor];
      video.muted = true;
      video.loop = false;
      video.preload = 'auto';

      const begin = function() {
        // If the user already navigated away, don't hijack playback.
        if (activeIndex !== activeFor) return;
        try {
          const end = Math.max(0, (video.duration || PREVIEW_START + PREVIEW_SECONDS) - 0.1);
          video.currentTime = Math.min(PREVIEW_START, end);
        } catch (err) {}
        const playPromise = video.play();
        if (playPromise && playPromise.catch) playPromise.catch(function() {});
      };

      if (video.readyState >= 1) {
        begin();
      } else {
        // preload was 'metadata'; load() + a one-shot ready handler guarantees
        // the freshly-selected frame actually starts even before it was cached.
        video.load();
        video.addEventListener('loadedmetadata', begin, { once: true });
        video.addEventListener('canplay', begin, { once: true });
      }

      // Warm the immediate neighbours (decode a still at PREVIEW_START) so the
      // very next Prev/Next shows its preview instantly instead of a blank wait.
      [activeFor - 1, activeFor + 1].forEach(function(off) {
        const j = ((off % N) + N) % N;
        if (j === activeFor) return;
        const nv = previewVideos[j];
        nv.preload = 'auto';
        const warm = function() {
          if (nv.paused && nv.readyState >= 1) {
            try {
              const end = Math.max(0, (nv.duration || PREVIEW_START) - 0.1);
              nv.currentTime = Math.min(PREVIEW_START, end);
            } catch (err) {}
          }
        };
        if (nv.readyState >= 1) warm();
        else { nv.load(); nv.addEventListener('loadedmetadata', warm, { once: true }); }
      });
    }

    function setActive(i) {
      activeIndex = ((i % N) + N) % N;
      const p = projects[activeIndex];
      document.getElementById('project-title').textContent = p.title;
      document.getElementById('project-type').textContent = p.type;
      dots.forEach(function(d, j) { d.classList.toggle('active', j === activeIndex); });
      startActivePreview();
      redrawFilmTexture(lastAboutMix < 0 ? 0 : lastAboutMix);
    }

    function goTo(i) {
      const wrapped = ((i % N) + N) % N;
      const desired = offsetForFrame(wrapped);
      const delta = shortestDelta(currentOffset, desired);
      targetOffset = currentOffset + delta;
      setActive(wrapped);
    }

    const dotsEl = document.getElementById('dots');
    projects.forEach(function(_, i) {
      const dot = document.createElement('button');
      dot.className = 'dot';
      if (i === activeIndex) dot.classList.add('active');
      dot.addEventListener('click', function() { goTo(i); });
      dotsEl.appendChild(dot);
    });
    const dots = dotsEl.querySelectorAll('.dot');
    setActive(activeIndex);

    document.getElementById('prev').addEventListener('click', function() { goTo(activeIndex - 1); });
    document.getElementById('next').addEventListener('click', function() { goTo(activeIndex + 1); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') goTo(activeIndex - 1);
      if (e.key === 'ArrowRight') goTo(activeIndex + 1);
      if (e.key === 'Escape' && playerOpen) closeVideoPlayer();
    });


    function syncPlayerControls() {
      const duration = mainVideo.duration || 0;
      const current = mainVideo.currentTime || 0;
      timeline.value = duration ? String((current / duration) * 1000) : '0';
      timecode.textContent = fmtTime(current) + ' / ' + fmtTime(duration);
      playPause.innerHTML = mainVideo.paused ? ICON_PLAY : ICON_PAUSE;
    }

    function showVideoPlayer() {
      if (playerOpen) return;
      playerOpen = true;
      playerOpening = false;
      videoPlayer.classList.add('open');
      videoPlayer.classList.add('playback');
      videoPlayer.setAttribute('aria-hidden', 'false');
      syncPlayerControls();
    }

    function closeVideoPlayer() {
      playerOpening = false;
      playerOpen = false;
      playerCinema = false;
      playerEverReady = false;
      suppressAbout = true;
      frameRect = null;
      videoPlayer.classList.remove('open');
      videoPlayer.classList.remove('playback');
      videoPlayer.classList.remove('frame-mode');
      videoPlayer.classList.remove('cinema');
      videoPlayer.setAttribute('aria-hidden', 'true');
      mainVideo.pause();
      zoomTarget = 0;
      startActivePreview();
      // Clear the baked player UI from the texture right now, so it can't
      // linger on the frame during the zoom-out (gates are off => no UI drawn).
      redrawFilmTexture(0);
    }

    function openActiveVideo() {
      const project = projects[activeIndex];
      playerOpening = true;
      playerOpen = false;
      playerCinema = false;
      playerEverReady = false;
      suppressAbout = true;
      videoPlayer.classList.add('frame-mode');
      videoPlayer.setAttribute('aria-hidden', 'false');
      previewVideos[activeIndex].pause();
      playerTitle.textContent = project.title + ' / ' + project.type;
      if (mainVideo.dataset.src !== project.src) {
        mainVideo.src = encodeURI(project.src);
        mainVideo.dataset.src = project.src;
        mainVideo.load();
      }
      try { mainVideo.currentTime = 0; } catch (err) {}
      mainVideo.muted = false;
      mainVideo.volume = Number(volume.value);
      // Partial zoom only — the film enlarges but stays a strip; the 3D player
      // is baked onto the active frame (see drawFrameUI 'playing').
      zoomTarget = FRAME_PLAYER_ZOOM;
      const playPromise = mainVideo.play();
      if (playPromise && playPromise.catch) playPromise.catch(function() {});
      // Clear the idle "CLICK TO PLAY" affordance from the texture immediately
      // so it doesn't flash on the frame during the zoom-in.
      redrawFilmTexture(0);
    }

    // ===== Pointer handling for the on-film 3D player =====
    // The active frame's screen rect (frameRect) is refreshed every frame in
    // animate(); we hit-test taps against it: bottom band = scrub the timeline,
    // elsewhere on the frame = play/pause, outside = close.
    function frameScrubRatio(clientX) {
      const x0 = frameRect.left + frameRect.width * UI_TL_X0;
      const x1 = frameRect.left + frameRect.width * UI_TL_X1;
      return Math.max(0, Math.min(1, (clientX - x0) / (x1 - x0)));
    }
    function setVolFromX(clientX) {
      const vx0 = frameRect.left + frameRect.width * UI_VOL_X0;
      const vx1 = frameRect.left + frameRect.width * UI_VOL_X1;
      const r = Math.max(0, Math.min(1, (clientX - vx0) / (vx1 - vx0)));
      mainVideo.volume = r;
      mainVideo.muted = r <= 0.001;
      if (volume) volume.value = String(r);   // keep the cinema slider in sync
    }
    // Enter/leave the real fullscreen <video> (native resolution + HTML chrome).
    function enterCinema() {
      if (!playerOpen) return;
      playerCinema = true;
      videoPlayer.classList.remove('frame-mode');
      videoPlayer.classList.add('cinema');
      syncPlayerControls();
    }
    function exitCinema() {
      playerCinema = false;
      videoPlayer.classList.remove('cinema');
      videoPlayer.classList.add('frame-mode');
    }

    let scrubbing = false;
    let volSliding = false;
    videoPlayer.addEventListener('pointerdown', function(e) {
      if (playerCinema) return;            // cinema uses the HTML controls
      if (!playerOpen || !frameRect) return;
      const inX = e.clientX >= frameRect.left && e.clientX <= frameRect.left + frameRect.width;
      const inY = e.clientY >= frameRect.top && e.clientY <= frameRect.top + frameRect.height;
      if (!inX || !inY) { closeVideoPlayer(); return; }
      // Top-right corner = close (X). The TAP zone is the whole top-right
      // corner (not the tiny icon) so it never misses on the curved frame.
      if (e.clientY <= frameRect.top + frameRect.height * UI_TOP_BAND &&
          e.clientX >= frameRect.left + frameRect.width * UI_TR_X) {
        closeVideoPlayer();
        return;
      }
      // Bottom bar zones, left->right: play | timeline | (timecode gap) | volume | fullscreen.
      if (e.clientY >= frameRect.top + frameRect.height * UI_BAND) {
        const fx = (e.clientX - frameRect.left) / frameRect.width;
        if (fx >= UI_FSB_X - 0.05) {                 // bottom-right fullscreen
          enterCinema();
          return;
        }
        if (fx >= UI_SPK_X - 0.04) {                 // volume (speaker + bar)
          volSliding = true;
          try { videoPlayer.setPointerCapture(e.pointerId); } catch (err) {}
          setVolFromX(e.clientX);
          return;
        }
        if (fx <= UI_PP_X + 0.035) {                 // far-left play/pause glyph
          if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
          syncPlayerControls();
          return;
        }
        if (fx <= UI_TL_X1 + 0.04) {                 // timeline
          scrubbing = true;
          try { videoPlayer.setPointerCapture(e.pointerId); } catch (err) {}
          if (mainVideo.duration) mainVideo.currentTime = frameScrubRatio(e.clientX) * mainVideo.duration;
          syncPlayerControls();
          return;
        }
        return; // gap behind the timecode
      }
      if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
      syncPlayerControls();
    });
    videoPlayer.addEventListener('pointermove', function(e) {
      if (!frameRect) return;
      if (volSliding) { setVolFromX(e.clientX); return; }
      if (scrubbing && mainVideo.duration) {
        mainVideo.currentTime = frameScrubRatio(e.clientX) * mainVideo.duration;
        syncPlayerControls();
      }
    });
    function endScrub(e) {
      if (!scrubbing && !volSliding) return;
      scrubbing = false;
      volSliding = false;
      try { videoPlayer.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    videoPlayer.addEventListener('pointerup', endScrub);
    videoPlayer.addEventListener('pointercancel', endScrub);

    // The HTML X is only visible in cinema mode -> it returns to the 3D frame
    // player (a second X there closes back to the strip).
    closePlayer.addEventListener('click', function() {
      if (playerCinema) exitCinema(); else closeVideoPlayer();
    });
    // Click the fullscreen video itself to toggle play/pause.
    mainVideo.addEventListener('click', function() {
      if (!playerCinema) return;
      if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
      syncPlayerControls();
    });
    playPause.addEventListener('click', function() {
      if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
      syncPlayerControls();
    });
    timeline.addEventListener('input', function() {
      if (!mainVideo.duration) return;
      mainVideo.currentTime = (Number(timeline.value) / 1000) * mainVideo.duration;
    });
    volume.addEventListener('input', function() {
      mainVideo.volume = Number(volume.value);
      mainVideo.muted = mainVideo.volume <= 0;
    });
    fullscreenBtn.addEventListener('click', function() {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
    });
      mainVideo.addEventListener('timeupdate', syncPlayerControls);
      mainVideo.addEventListener('durationchange', syncPlayerControls);
    mainVideo.addEventListener('loadeddata', function() { redrawFilmTexture(0); });
      mainVideo.addEventListener('play', syncPlayerControls);
      mainVideo.addEventListener('pause', syncPlayerControls);

    // Wheel = gradual zoom into the active frame (down = zoom in, up = zoom out).
    let zoomTarget = 0, zoomCurrent = 0;
    // After the film->About zoom, content lives in a vertical "deck" of full-screen
    // sections you scroll through: 0=About, 1=Trusted, 2=Reviews, 3=Education,
    // 4=Contacts. secTarget only advances once zoomTarget has reached 1 (About in).
    let secTarget = 0, secCurrent = 0;
    const MAX_SEC = 4;
    const SEC_STEP = 0.06; // how much one wheel notch advances the deck (lower = slower)
    // Vertical spacing between the deck sections (Trusted/Reviews/Education/
    // Contacts), in screen-heights. <1 packs them closer so you scroll through
    // LESS empty space between blocks. (About->Trusted stays a full screen so the
    // waves/About fully leave first.)
    const DECK_GAP = 0.62;
    // Education (section 3) is a horizontal scrollytelling rail of EDU_PANELS
    // panels. While that section is active the wheel walks panel-by-panel; only
    // at the ends does it hand off to the deck (prev/next section).
    const EDU_PANELS = 7;
    let eduScroll = 0, eduScrollTarget = 0, eduStepAt = 0;
    // The instant the film finishes zooming into About, hold here for a moment so
    // the SAME downward flick / trackpad inertia can't skip straight to Trusted.
    let aboutDwellUntil = 0;
    // Hero intro scrub progress: 0 = video start / hero shown, 1 = handed off to film.
    let heroTarget = 0, heroCurrent = 0;
    // True once the hero's styles reflect its settled "gone" state — lets the
    // render loop stop rewriting them every frame. Any heroTarget/heroCurrent
    // change (including heroCut's instant jump) makes the loop write again.
    let heroParked = false;
    // Dev/preview hook used by tools/hero_check.js to jump the intro to a given
    // progress (0 = portrait at rest, 1 = handed off to the film).
    window.__hero = function(v){ heroTarget = v; heroCurrent = v; };
    const HERO_STEP = 0.08;
    // One navigation "notch", shared by the mouse wheel and touch swipes.
    // dir: 1 = forward (wheel down / swipe up), -1 = back. mult scales the
    // hero scrub and the film->About zoom — one finger flick should cover more
    // ground than one wheel notch (a wheel spin fires many events, a flick
    // fires once). Returns true when consumed (caller should preventDefault).
    function navGesture(dir, targetEl, mult) {
      if (playerOpen || playerOpening) return false;
      // Vertical scroll always drives the full-screen story, not nested blocks.
      // Hero intro: scrub the start video by scroll, then hand off to the film.
      // Forward scrubs ahead; back scrubs back, but only at the very film start.
      if (dir > 0 && heroCurrent < 0.999) {
        heroCut(true);
        return true;
      }
      if (dir < 0 && heroCurrent > 0.001 && zoomTarget <= 0.001 && secTarget <= 0.001) {
        heroCut(false);
        return true;
      }
      // Education horizontal walk (only when it's the settled, active section).
      if (!shutterBusy && zoomTarget >= 1 && Math.round(secTarget) === 3) {
        const END = EDU_PANELS - 1;
        const atEnd = eduScrollTarget >= END - 0.001, atStart = eduScrollTarget <= 0.001;
        if ((dir > 0 && !atEnd) || (dir < 0 && !atStart)) {
          const now = performance.now();
          if (now - eduStepAt > 360) {   // one panel per deliberate gesture
            eduScrollTarget = Math.max(0, Math.min(END, Math.round(eduScrollTarget) + dir));
            eduStepAt = now;
            wavesEnergy = Math.min(1, wavesEnergy + 0.35);
          }
          return true;
        }
        // at an end -> fall through to normal section navigation below
      }
      suppressAbout = false; // scrolling is an intentional About reveal
      if (dir > 0) {
        // Scrolling DOWN: first zoom into About; once there, each wheel gesture
        // advances ONE section with the camera-shutter cut (handled in shutterTo).
        if (zoomTarget < 1) {
          const before = zoomTarget;
          zoomTarget = Math.min(1, zoomTarget + 0.085 * mult);
          // Just landed on a fully-zoomed About -> arm the dwell.
          if (before < 1 && zoomTarget >= 1) aboutDwellUntil = performance.now() + 900;
        } else if (Math.round(secTarget) === 0 && performance.now() < aboutDwellUntil) {
          // Still dwelling on About: swallow this notch so we don't auto-jump to
          // Trusted. A fresh, deliberate scroll after the pause advances.
        } else {
          shutterTo(Math.round(secTarget) + 1);
        }
      } else {
        // Scrolling UP: step the deck back one frame, then zoom back out.
        if (secTarget > 0.001 || shutterBusy) shutterTo(Math.round(secTarget) - 1);
        else zoomTarget = Math.max(0, zoomTarget - 0.085 * mult);
      }
      wavesEnergy = Math.min(1, wavesEnergy + 0.55); // wake the 3D waves while turning the film
      return true;
    }
    window.addEventListener('wheel', function(e) {
      if (navGesture(e.deltaY > 0 ? 1 : -1, e.target, 1)) e.preventDefault();
    }, { passive: false });

    // Touch: the finger DRIVES the page — no wheel on phones. While the intro
    // or the film->About zoom is on screen the gesture scrubs it 1:1 (the page
    // literally follows the finger) and completes the stage on release, like a
    // page snap. On the section deck, crossing a short distance fires the same
    // shutter step the wheel does — DURING the drag, not after it. Horizontal
    // drags still belong to the film canvas and the review/trust rails.
    (function() {
      let live = false, mode = null, startEl = null;
      let sX = 0, sY = 0;            // gesture origin
      let stepX = 0, stepY = 0;      // re-armed after each deck/edu step
      let baseP = 0;                 // intro+zoom chain progress at touchstart
      // 60% of the screen height of finger travel = one full stage.
      function scrubSpan() { return Math.max(1, window.innerHeight) * 0.6; }

      // The intro scrub (0..1) and the film->About zoom (1..2) form one chain
      // the finger slides along. The zoom half only exists while the deck is
      // still parked on section 0.
      function chainP() {
        const z = Math.round(secTarget) === 0 ? Math.max(0, Math.min(1, zoomTarget)) : 0;
        return Math.min(1, heroTarget) + z;
      }
      function applyChain(p) {
        p = Math.max(0, Math.min(2, p));
        // The hero is no longer scrubbed — it cuts. If the finger pulls the
        // chain below the film (p<1) while the portrait is gone, iris-cut back
        // to it instead of dissolving.
        if (p < 1) {
          if (heroCurrent >= 0.999 && zoomTarget <= 0.001 && secTarget <= 0.001) heroCut(false);
          return;
        }
        const z = Math.max(0, p - 1);
        if (z > 0 || zoomTarget > 0) {
          if (z >= 1 && zoomTarget < 1) aboutDwellUntil = performance.now() + 900;
          zoomTarget = z;
          suppressAbout = false;
        }
        wavesEnergy = Math.min(1, wavesEnergy + 0.08);
      }

      window.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1 || playerOpen || playerOpening) { live = false; return; }
        live = true; mode = 'pending'; startEl = e.target;
        sX = stepX = e.touches[0].clientX;
        sY = stepY = e.touches[0].clientY;
        baseP = chainP();
      }, { passive: true });

      window.addEventListener('touchmove', function(e) {
        if (!live) return;
        const t = e.touches[0];
        const dxT = t.clientX - sX, dyT = t.clientY - sY;

        if (mode === 'pending') {
          if (Math.max(Math.abs(dxT), Math.abs(dyT)) < 12) return;
          if (Math.abs(dyT) >= Math.abs(dxT)) {
            // Vertical movement always belongs to the full-screen story.
            // Scrub while the intro/zoom chain is interactive; on About (chain
            // fully forward) only a downward pull re-enters it — upward goes
            // to the deck. Otherwise the deck steps.
            // The portrait now cuts (it's not scrubbed), so the 1:1 finger
            // scrub only owns the film->About zoom. While the hero is still up,
            // a vertical swipe steps (-> heroCut) like a deck step.
            const onChain = heroCurrent >= 0.999 &&
              Math.round(secTarget) === 0 && secCurrent < 0.5 && !shutterBusy &&
              (zoomTarget < 1 || dyT > 0);
            mode = onChain ? 'scrub' : 'deck';
          } else {
            // Horizontal: Education walks its panels; the film strip and the
            // logo/review rails run their own pointer drags.
            const onRail = startEl && startEl.closest && startEl.closest('.review-rail, .trust-track');
            mode = (!onRail && zoomTarget >= 1 && Math.round(secTarget) === 3) ? 'eduH' : 'native';
          }
        }
        if (mode === 'native') return;

        if (mode === 'scrub') {
          applyChain(baseP - dyT / scrubSpan());
          return;
        }
        // Stepping modes: cross ~72px -> one wheel-notch step, then re-arm so a
        // long drag keeps stepping (the shutter / edu rate-limit paces it).
        const dy = t.clientY - stepY, dx = t.clientX - stepX;
        if (mode === 'eduH') {
          if (Math.abs(dx) > 72) {
            navGesture(dx < 0 ? 1 : -1, startEl, 1);
            stepX = t.clientX; stepY = t.clientY;
          }
          return;
        }
        if (Math.abs(dy) > 72) {
          navGesture(dy < 0 ? 1 : -1, startEl, 1);
          stepX = t.clientX; stepY = t.clientY;
        }
      }, { passive: true });

      window.addEventListener('touchend', function(e) {
        if (!live) return;
        live = false;
        if (mode !== 'scrub') return;
        // Release: complete the stage in the swipe's direction (page-snap).
        const dyT = e.changedTouches[0].clientY - sY;
        const p = chainP();
        let goal;
        if (dyT < -24) goal = Math.min(2, Math.ceil(p - 0.02));
        else if (dyT > 24) goal = Math.max(0, Math.floor(p + 0.02));
        else goal = Math.round(p);
        applyChain(goal);
      }, { passive: true });
      window.addEventListener('touchcancel', function() { live = false; }, { passive: true });
      // Touch devices: the "scroll" hints should say what the finger does.
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        const hs = heroScroll && heroScroll.querySelector('span:last-child');
        if (hs) hs.textContent = 'swipe';
        const eh = document.getElementById('eduHint');
        if (eh) eh.innerHTML = 'swipe <span class="arrow">&rarr;</span>';
      }
    })();

    // ===== Section indicator + custom cursor =====
    const secNav = document.getElementById('secNav');
    const secDots = Array.prototype.slice.call(secNav.querySelectorAll('.sec-dot'));
    const cursorDot = document.getElementById('cursorDot');
    const cursorRing = document.getElementById('cursorRing');

    // ===== Camera-shutter / film-gate transition =====
    // Blades snap shut, we hard-cut the deck to the target section while hidden,
    // then they snap open — exactly like a film camera advancing one frame.
    const shutterEl = document.getElementById('shutter');
    let shutterBusy = false;
    function shutterTo(target) {
      target = Math.max(0, Math.min(MAX_SEC, target));
      // One transition at a time. Extra wheel input during a shutter cut is
      // ignored (not queued as a partial scroll) so you NEVER see the deck slide
      // between blocks — only the clean shutter cut.
      if (shutterBusy) return;
      if (Math.abs(target - secTarget) < 0.001) { secTarget = target; return; }
      const goingForward = target > secTarget;
      shutterBusy = true;
      shutterEl.classList.add('closing');
      // At full close (iris shut): hard-cut both eased+target positions to frame.
      setTimeout(function() {
        secTarget = target; secCurrent = target;
        // Entering Education: park the rail just before the first panel (or just
        // past the last, if arriving from Contacts) so the panel eases + reveals
        // in as the shutter opens — never snaps in fully formed.
        if (target === 3) {
          if (goingForward) { eduScrollTarget = 0; eduScroll = -0.6; }
          else { eduScrollTarget = EDU_PANELS - 1; eduScroll = EDU_PANELS - 1 + 0.6; }
        }
        shutterEl.classList.remove('closing');
        shutterEl.classList.add('opening');
        setTimeout(function() {
          shutterEl.classList.remove('opening');
          shutterBusy = false;
        }, 340);
      }, 260);
    }
    // Hero <-> film uses the SAME iris cut as the deck (instead of a scroll-
    // scrub dissolve): blades close over the portrait, we hard-snap the intro
    // to/from the film while hidden, then they open. toFilm=true hands off to
    // the film; false brings the portrait back.
    function heroCut(toFilm) {
      if (shutterBusy) return;
      shutterBusy = true;
      shutterEl.classList.add('closing');
      setTimeout(function() {
        if (toFilm) { heroTarget = 1; heroCurrent = 1; }
        else { heroTarget = 0; heroCurrent = 0; }
        shutterEl.classList.remove('closing');
        shutterEl.classList.add('opening');
        setTimeout(function() {
          shutterEl.classList.remove('opening');
          shutterBusy = false;
        }, 340);
      }, 260);
    }
    // Hero "Showreel" button: same iris cut into the film reel. Hover excites
    // the hero waveform (see drawHeroWave) — sound lives behind this button.
    const heroShowreelBtn = document.getElementById('heroShowreel');
    if (heroShowreelBtn) {
      heroShowreelBtn.addEventListener('click', function() {
        if (heroCurrent < 0.999) heroCut(true);
      });
      heroShowreelBtn.addEventListener('mouseenter', function() { setWaveBoostTarget(2); });
      heroShowreelBtn.addEventListener('mouseleave', function() { setWaveBoostTarget(1); });
    }
    // Click a section dot -> shutter-cut there (zoom must be past the film first).
    secDots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        zoomTarget = 1;            // ensure we're past the film zoom
        suppressAbout = false;
        shutterTo(Number(dot.getAttribute('data-sec')));
      });
    });
    // Custom cursor: dot tracks instantly, ring eases; both grow over interactives.
    let curX = window.innerWidth / 2, curY = window.innerHeight / 2;
    let ringX = curX, ringY = curY;
    if (cursorRing) {
      window.addEventListener('pointermove', function(e) {
        curX = e.clientX; curY = e.clientY;
        cursorDot.style.opacity = '1'; cursorRing.style.opacity = '1';
        cursorDot.style.transform = 'translate(' + curX + 'px,' + curY + 'px) translate(-50%,-50%)';
        const hot = e.target && e.target.closest &&
          e.target.closest('a,button,.review-card,.edu-item,.trust-item,#canvas,.sec-dot');
        cursorRing.classList.toggle('hot', !!hot);
      });
      document.addEventListener('pointerdown', function() { cursorRing.classList.add('hot'); });
      document.addEventListener('pointerup',   function() { cursorRing.classList.remove('hot'); });
    }

    // Dragging the film strip also counts as "scrolling" -> waves animate.
    window.addEventListener('pointermove', function() {
      if (isDragging) wavesEnergy = Math.min(1, wavesEnergy + 0.06);
    }, { passive: false });

    // Mouse position drives a subtle camera PARALLAX (see animate()): the near
    // frames shift more than the far, receding film -> a real sense of depth.
    let mouseNX = 0, mouseNY = 0;
    let camParX = 0, camParY = 0;
    let aboutParX = 0, aboutParY = 0; // smoothed mouse for the parallax About text
    let titleParX = 0, titleParY = 0; // smoothed mouse for the parallax title (sits BEHIND the film)
    // Deck sections sit ON TOP of the stage, so stage's pointermove won't fire over
    // them. Track the mouse at the window level too, and ease it for the section
    // parallax (deckMX/Y = raw, deckParX/Y = smoothed).
    let deckMX = 0, deckMY = 0, deckParX = 0, deckParY = 0;
    // Under reduced motion the mouse never feeds the parallax: deckMX/Y stay 0,
    // so every deckPar* consumer (hero, film, bg layers) holds still.
    if (!REDUCED_MOTION) window.addEventListener('pointermove', function(e) {
      deckMX = e.clientX / window.innerWidth - 0.5;
      deckMY = e.clientY / window.innerHeight - 0.5;
    });
    let lastFrameT = 0;               // for per-frame dt (drives wave time)
    let lastFrameWaveMix = -1;        // last About-mix the frame waveform was painted at
    let lastWavePaint = 0;            // throttles the costly 2D waveform paints (~32fps)
    stage.addEventListener('pointermove', function(e) {
      const rect = stage.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      mouseNX = nx; mouseNY = ny;
    });
    stage.addEventListener('pointerleave', function() {
      mouseNX = 0; mouseNY = 0;
    });

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragStartOffset = 0;
    let dragMoved = false;
    canvas.addEventListener('pointerdown', function(e) {
      if (playerOpen || playerOpening) return;
      // While the hero intro is still on screen the film sits UNDER it; the hero
      // doesn't swallow pointer events, so a click would fall through to the film
      // and open the active video. Ignore taps until the hero has handed off.
      if (heroCurrent < 0.999) return;
      // Once we've scrolled toward / onto the About page the film is zoomed out
      // of strip view, so taps must NOT grab the strip or open the active video.
      if (zoomTarget > 0.02 || zoomCurrent > 0.05) return;
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartOffset = targetOffset;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', function(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 6) dragMoved = true;
      targetOffset = dragStartOffset - dx * dragSens;
    });
    canvas.addEventListener('pointerup', function(e) {
      if (!isDragging) return;
      isDragging = false;
      canvas.releasePointerCapture(e.pointerId);
      // A tap must be still in BOTH axes — a vertical touch swipe over the film
      // is section navigation, not a click on the active frame.
      if (!dragMoved && Math.abs(e.clientX - dragStartX) <= 6 && Math.abs(e.clientY - dragStartY) <= 6) {
        // Don't open the video if the film has zoomed out toward the About page.
        if (zoomTarget > 0.02 || zoomCurrent > 0.05) return;
        goTo(activeIndex);
        openActiveVideo();
        return;
      }
      // snap to nearest frame whose offset is closest to targetOffset
      let bestIdx = 0, bestDist = 999;
      for (let i = 0; i < N; i++) {
        const desired = offsetForFrame(i);
        let d = Math.abs(shortestDelta(targetOffset, desired));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      goTo(bestIdx);
    });

    function onResize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      updateCameraFraming();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    // Active (front-center) frame world position — the zoom dollies onto it so
    // the film enlarges and that frame fills the screen.
    const FRAME_S  = filmGroup.scale.x;
    const FRAME_Z  = CYL_R * FRAME_S * Math.cos(FILM_BASE_ROT_X);
    const FRAME_Y  = FILM_BASE_POS_Y - CYL_R * FRAME_S * Math.sin(FILM_BASE_ROT_X);
    const CAM_Y0 = 0.3;
    // Responsive framing. On desktop these match the original hand-tuned values
    // (fov 35, camZ0 14.1, zoomGap 2.42); on narrow/portrait screens the lens
    // widens and the camera pulls back so the strip never crops to one frame.
    let camZ0 = 14.1;
    let zoomGap = FRAME_S * 2.95;
    let dragSens = 0.002;
    function updateCameraFraming() {
      const aspect = Math.max(0.0001, stage.clientWidth / Math.max(1, stage.clientHeight));
      camera.aspect = aspect;
      camera.fov = aspect < 1 ? Math.min(50, 35 + (1 - aspect) * 24) : 35;
      const halfTan = Math.tan(camera.fov * Math.PI / 360);
      // Keep ~2 frame-slots of film visible at the active frame's depth — the
      // desktop framing already shows that, so this only kicks in when narrow.
      const needDist = (SLOT * FRAME_S * 1.95) / (2 * halfTan * aspect);
      camZ0 = Math.max(14.1, FRAME_Z + needDist);
      // Zoomed in (z=1) the active frame overfills the width ~1.2x, like desktop.
      zoomGap = (FRAME_W * FRAME_S) / (1.2 * 2 * halfTan * aspect);
      // The on-film player stops at a partial zoom; on phones it needs a deeper
      // stop or the player (and its controls) would be a sliver of the width.
      FRAME_PLAYER_ZOOM = aspect < 1 ? 0.8 : 0.5;
      // One comfortable thumb swipe (~60% of a phone's width) ≈ one frame.
      dragSens = Math.max(0.002, 1 / (0.6 * Math.max(1, stage.clientWidth)));
      camera.updateProjectionMatrix();
    }
    updateCameraFraming();

    // Screen-space bounding rect of the active frame (aboutFrameMesh sits right
    // on it), so taps can be mapped onto the curved on-film controls.
    const _projV = new THREE.Vector3();
    const _hw = (FRAME_W * 0.985) / 2;
    const _hh = (FRAME_H * 0.985) / 2;
    const _frameCorners = [
      new THREE.Vector3(-_hw,  _hh, 0),
      new THREE.Vector3( _hw,  _hh, 0),
      new THREE.Vector3( _hw, -_hh, 0),
      new THREE.Vector3(-_hw, -_hh, 0)
    ];
    // aboutFrameMesh is the flat (un-bulged) frame; the shader pushes the live
    // active frame forward + stretches it, so it renders bigger than this. We
    // grow the projected box to match, keeping the on-film timeline tap-aligned.
    const FRAME_RECT_GX = 1.18;
    const FRAME_RECT_GY = 1.30;
    function computeFrameRect() {
      filmGroup.updateMatrixWorld(true);
      const rect = stage.getBoundingClientRect();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < _frameCorners.length; i++) {
        _projV.copy(_frameCorners[i]);
        aboutFrameMesh.localToWorld(_projV);
        _projV.project(camera);
        const sx = (_projV.x * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-_projV.y * 0.5 + 0.5) * rect.height + rect.top;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const wR = (maxX - minX) * FRAME_RECT_GX;
      const hR = (maxY - minY) * FRAME_RECT_GY;
      return { left: cx - wR / 2, top: cy - hR / 2, width: wR, height: hR };
    }


    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      const dt = lastFrameT ? Math.min(0.05, t - lastFrameT) : 0.016;
      lastFrameT = t;

      // Scroll zoom (eased). 0 = full view, 1 = active frame fills the screen.
      zoomCurrent += (zoomTarget - zoomCurrent) * 0.08;
      const z = zoomCurrent;
      filmZoom = z;

      // Vertical section-deck position (eased). Only advances once z == 1 (About in).
      secCurrent += (secTarget - secCurrent) * 0.08;
      const sec = secCurrent;

      // Section indicator: visible only once we're on the About page / deck
      // (z near 1), highlighting the nearest section.
      const deckUiOn = z > 0.82 && !playerOpen && !playerOpening;
      secNav.classList.toggle('show', deckUiOn);
      if (deckUiOn) {
        const nearest = Math.round(sec);
        for (let i = 0; i < secDots.length; i++) secDots[i].classList.toggle('active', i === nearest);
      }
      // Ease the custom cursor ring toward the pointer (dot already snaps in the
      // move handler), so it trails with a smooth, premium lag.
      if (cursorRing) {
        ringX += (curX - ringX) * 0.18; ringY += (curY - ringY) * 0.18;
        cursorRing.style.transform = 'translate(' + ringX.toFixed(1) + 'px,' + ringY.toFixed(1) + 'px) translate(-50%,-50%)';
      }

      // About-morph mix, computed up-front so the preview repaint below keeps the
      // in-frame waves ANIMATING (and clipped to the active frame) instead of
      // erasing them back to the bare video on each pass.
      if (suppressAbout && !playerOpen && !playerOpening && zoomTarget === 0 && z < 0.02) suppressAbout = false;
      const aboutFrameMix = (playerOpening || playerOpen || suppressAbout) ? 0 : ss(0.0, 0.16, Math.max(z, zoomTarget * 0.85));

      // Sound-wave animation clock. It advances ONLY while the user is turning
      // the film (scroll energy) OR once the About page is fully revealed
      // (aboutFull). Idle on the film strip -> waveTime frozen -> still waves.
      wavesEnergy *= 0.93;                          // decay when not scrolling
      if (wavesEnergy < 0.001) wavesEnergy = 0;
      const aboutFull = ss(0.94, 1.0, z);           // 1 == standing on About
      const wavesSpeed = REDUCED_MOTION ? wavesEnergy : Math.max(wavesEnergy, aboutFull);
      waveTime += dt * wavesSpeed * 0.6;            // base wave speed (lower = calmer)
      const wavesRepaint = (t - lastWavePaint) > 0.031; // ~32fps cap for 2D paints
      const wig = 1.0 - z;              // calm the idle drift as we zoom in
      // Visibility gate: the WebGL film canvas is fully covered by the opaque
      // hero at the start, and fully faded out once the About/deck takes over
      // (z≈1). While covered, skip the video decode, the film-texture canvas
      // repaints + GPU re-uploads AND the GL render itself — they were burning
      // frame budget on pixels nobody could see (the main phone-lag source).
      const filmCovered = ss(0.93, 1.0, heroCurrent) < 0.004;  // hero still opaque
      const filmGone = (1.0 - ss(0.96, 1.0, z)) < 0.004;       // About/deck took over
      const filmLive = (playerOpening || playerOpen) || (!filmCovered && !filmGone);
      if (filmLive && !playerOpen && !playerOpening && previewActiveIndex === activeIndex) {
        const previewVideo = previewVideos[activeIndex];
        if (previewVideo && previewVideo.readyState >= 2) {
          const previewEnd = Math.min(PREVIEW_START + PREVIEW_SECONDS, previewVideo.duration || PREVIEW_START + PREVIEW_SECONDS);
          if (previewVideo.currentTime < PREVIEW_START || previewVideo.currentTime >= previewEnd || previewVideo.ended) {
            try { previewVideo.currentTime = PREVIEW_START; } catch (err) {}
            // loop=false, so after a reset (or hitting the clip end) we have to
            // kick playback again — otherwise the preview freezes after one pass.
            if (previewVideo.paused) {
              const rp = previewVideo.play();
              if (rp && rp.catch) rp.catch(function () {});
            }
          } else if (previewVideo.paused) {
            // Was paused by the visibility gate while covered — resume.
            const rp = previewVideo.play();
            if (rp && rp.catch) rp.catch(function () {});
          }
          if (t - lastPreviewPaint > (LITE ? 1 / 18 : 1 / 24)) {
            redrawFilmTexture(aboutFrameMix);
            lastPreviewPaint = t;
          }
        } else if (filmZoom < 0.06 && t - lastPreviewPaint > 1 / 12) {
          // Active preview still decoding -> keep the LOADING spinner spinning.
          redrawFilmTexture(0);
          lastPreviewPaint = t;
        }
      } else if (!filmLive && previewActiveIndex === activeIndex) {
        // Fully hidden: stop the active preview's decode loop too.
        const pv = previewVideos[activeIndex];
        if (pv && !pv.paused) pv.pause();
      }
      if ((playerOpening || playerOpen) && mainVideo.readyState >= 2) playerEverReady = true;
      // Redraw the 3D on-film player (skip in cinema: it's hidden behind it).
      if ((playerOpening || playerOpen) && !playerCinema) {
        const rate = mainVideo.readyState >= 2 ? 1 / 30 : 1 / 12; // spin while it loads
        if (t - lastPreviewPaint > rate) {
          redrawFilmTexture(0);
          lastPreviewPaint = t;
        }
      }
      // Hide the intro overlay once the first film can actually play.
      // body.hero-in kicks off the hero copy's staggered rise (CSS-driven).
      if (!loadingHidden && previewVideos[activeIndex] && previewVideos[activeIndex].readyState >= 2) {
        loadingEl.classList.add('hidden');
        document.body.classList.add('hero-in');
        loadingHidden = true;
      }
      if (playerOpening && z > FRAME_PLAYER_ZOOM * 0.96) showVideoPlayer();
      // Catch any in-frame-wave repaint the 24fps preview loop above didn't (mix
      // changes, or a not-yet-ready active video). The waves are drawn INTO the
      // active frame, so they stay clipped to it and bulge with it.
      if (Math.abs(aboutFrameMix - lastAboutMix) > 0.004) {
        redrawFilmTexture(aboutFrameMix);
      }
      // Flat overlay plane: oversized for the final full-screen About background,
      // so fade it in only once the frame is large/head-on (see ABOUT_PLANE_IN*).
      // Until then the clipped in-frame waves above carry the morph.
      const aboutPlaneMix = aboutFrameMix * ss(ABOUT_PLANE_IN0, ABOUT_PLANE_IN1, z);
      aboutFrameMat.opacity = aboutPlaneMix;
      aboutFrameMesh.visible = aboutPlaneMix > 0.001;
      // Re-paint the flat About frame's waveform each frame so it animates while
      // turning the film (or always, on the About page). Frozen when waveTime is.
      if (aboutFrameMesh.visible && aboutTexState.ctx && wavesRepaint && (wavesSpeed > 0.002 || aboutFrameMix !== lastFrameWaveMix)) {
        drawAboutSoundFallback(aboutTexState.ctx, 0, 0, aboutTexState.canvas.width, aboutTexState.canvas.height, waveTime);
        aboutTexState.tex.needsUpdate = true;
        lastFrameWaveMix = aboutFrameMix;
        lastWavePaint = t;
      }

      currentOffset += (targetOffset - currentOffset) * 0.08;
      filmMaterial.uniforms.uOffset.value = currentOffset;
      filmMaterial.uniforms.uFocusS.value = ACTIVE_FRAME_S;
      filmGroup.rotation.z = FILM_BASE_ROT_Z + Math.sin(t * 0.28) * 0.014 * wig;
      filmGroup.rotation.x = FILM_BASE_ROT_X + Math.cos(t * 0.22) * 0.009 * wig;
      filmGroup.rotation.y = FILM_BASE_ROT_Y + Math.sin(t * 0.19) * 0.01 * wig;
      filmGroup.position.y = FILM_BASE_POS_Y + Math.sin(t * 0.6) * 0.035 * wig;
      filmGroup.position.x = FILM_BASE_POS_X + Math.cos(t * 0.34) * 0.02 * wig;
      glowTube.material.opacity = 0.11 + Math.sin(t * 1.4) * 0.025;
      keyLight.intensity = 1.55 + Math.sin(t * 0.9) * 0.08;
      rimLight.intensity = 0.68 + Math.cos(t * 1.1) * 0.06;

      // ===== Hero intro: portrait push-in, then parallax-dissolve into film =====
      heroCurrent += (heroTarget - heroCurrent) * 0.12;
      // The push-in completes over the first 85% of the hero progress; the last
      // 15% is the parallax dissolve into the film.
      const heroOut = ss(0.93, 1.0, heroCurrent);   // 0 = hero shown, 1 = film shown
      const filmReveal = heroOut;
      // Once the hero has fully dissolved AND its final styles have been
      // written once (heroParked), stop rewriting them every frame. heroCut()
      // jumps heroTarget/heroCurrent in one go, so the settled check alone
      // would skip the very frame that must write opacity 0 — heroParked
      // guarantees that last write happens.
      const heroSettled = heroOut > 0.9995 && Math.abs(heroTarget - heroCurrent) < 0.001;
      if (!heroSettled) heroParked = false;
      if (heroEl && !(heroSettled && heroParked)) {
        heroParked = heroSettled;
        // The push-in parks at 88% — the last 12% is a clean full-screen
        // plateau where the crossfade to the real film happens.
        const dolly = Math.min(1, heroCurrent / 0.88);
        // Photo hero: a slow cinematic push-in. The still portrait scales up and
        // lifts as you scroll (dolly), and the mouse parallaxes it the opposite
        // way to the type -> it reads as a moving camera before the whole layer
        // dissolves into the film.
        if (heroPhotoImg) {
          const push = 1.0 + dolly * 0.13;
          heroPhotoImg.style.transform =
            'translate3d(' + (deckParX * 24).toFixed(1) + 'px,' +
            (deckParY * 16 - heroCurrent * 46).toFixed(1) + 'px,0) scale(' + push.toFixed(3) + ')';
        }
        heroEl.style.opacity = (1 - heroOut).toFixed(3);
        heroEl.style.pointerEvents = 'none';
        // Title fades / lifts out earlier than the scene for depth separation.
        const cFade = 1 - ss(0.16, 0.62, heroCurrent);
        heroContent.style.opacity = cFade.toFixed(3);
        heroContent.style.transform =
          'translate3d(' + (-deckParX * 44).toFixed(1) + 'px,' +
          (-deckParY * 28 - heroCurrent * 70).toFixed(1) + 'px,0)';
        if (heroScroll) heroScroll.style.opacity = (1 - ss(0.04, 0.3, heroCurrent)).toFixed(3);
        // Reduced motion: the wave is drawn frozen (t=0) — present but still.
        if (hasHeroWave && heroOut < 0.999) drawHeroWave(REDUCED_MOTION ? 0 : t, 1 - ss(0.02, 0.4, heroCurrent));
      }
      // Far layer: the film strip settles in from slightly larger as the hero clears.
      if (stage) {
        stage.style.opacity = filmReveal.toFixed(3);
        stage.style.transform = 'scale(' + (1 + (1 - filmReveal) * 0.07).toFixed(3) + ')';
      }

      // Fade the slider UI out as we scroll. (Also gated by the hero hand-off so
      // the film chrome stays hidden until the intro clears.)
      const uiFade = ((playerOpening || playerOpen) ? 0 : Math.max(0, 1.0 - z * 1.5)) * filmReveal;
      const uiPE = uiFade > 0.05 ? 'auto' : 'none';
      titleBlock.style.opacity = uiFade;
      // Parallax title: it now sits BEHIND the film (z-index 0). The camera/film
      // shift toward the mouse, so we drift the title WITH the mouse like a deep
      // backdrop -> clear relative motion against the strip = a sense of depth.
      // Eased here so it glides instead of snapping on each mouse event.
      titleParX += (mouseNX - titleParX) * 0.06;
      titleParY += (mouseNY - titleParY) * 0.06;
      titleBlock.style.transform =
        'translate3d(' + (titleParX * 46).toFixed(1) + 'px,' + (titleParY * 30).toFixed(1) + 'px,0)';
      if (navEl) { navEl.style.opacity = uiFade; navEl.style.pointerEvents = uiPE; }
      dotsEl.style.opacity = uiFade; dotsEl.style.pointerEvents = uiPE;
      controlsEl.style.opacity = uiFade; controlsEl.style.pointerEvents = uiPE;

      // The 3D wave field emerges behind the enlarging film as soon as the
      // scroll begins, then fully takes over as the About page. The flat About
      // FRAME (which grows with the zoom) carries the waveform through the
      // journey; this fullscreen layer takes over the edges at the very end.
      const bgReveal = ss(0.9, 1.0, z);
      const bgVisible = !(playerOpening || playerOpen) && bgReveal > 0.001 && sec < 1.05;
      // Waves belong to the About page ONLY. Instead of a global fade, the wave
      // layer is glued to the About block: it rides UP with it as you scroll into
      // the deck (same translateY as aboutEl), so the waves stay on that block and
      // simply leave the screen — they never bleed onto the deck sections.
      // Fade the waves out as the About block leaves (sec 0->1), so they never
      // show through the transparent deck sections that sit above them.
      pageBg.style.opacity = (playerOpening || playerOpen) ? 0 : (bgReveal * Math.max(0, 1 - sec)).toFixed(3);
      // The wave background drifts WITH the mouse a little; the text layers below
      // drift the OTHER way and much more -> a real sense of parallax depth.
      pageBg.style.transform =
        'translate3d(' + (aboutParX * 16).toFixed(1) + 'px,' + (Math.round(-sec * window.innerHeight) + aboutParY * 11).toFixed(1) + 'px,0) ' +
        'scale(' + (1.06 - bgReveal * 0.04).toFixed(3) + ')';
      if (bgVisible && wavesCtl && wavesRepaint) { wavesCtl.draw(waveTime); lastWavePaint = t; } // fullscreen waveform
      const stageFade = (playerOpening || playerOpen) ? 1.0 : (1.0 - ss(0.96, 1.0, z));
      stage.style.opacity = stageFade.toFixed(3);
      aboutVeil.style.opacity = (playerOpening || playerOpen) ? 0 : ss(0.7, 1.0, z);
      const textIn = (playerOpening || playerOpen) ? 0 : ss(0.82, 1.0, z);

      // Parallax About text: each layer drifts the opposite way to the waves,
      // by a different amount, so the heading feels closest and the paragraph
      // furthest. mouseNX/NY are ~-0.5..0.5, so these px ranges are sizeable.
      aboutParX += (mouseNX - aboutParX) * 0.09;
      aboutParY += (mouseNY - aboutParY) * 0.09;
      const baseY = 26 * (1 - textIn);
      // container carries only the scroll rise-in + a gentle base drift (it slides
      // up and out of frame as the "Trusted by" section scrolls up from below).
      aboutInner.style.opacity = textIn;
      aboutInner.style.transform =
        'translate3d(' + (-aboutParX * 24).toFixed(1) + 'px,' +
        (baseY - aboutParY * 14).toFixed(1) + 'px,0)';
      // children add their own depth offset on top of the container
      if (aboutKicker) aboutKicker.style.transform =
        'translate3d(' + (-aboutParX * 60).toFixed(1) + 'px,' + (-aboutParY * 34).toFixed(1) + 'px,0)';
      if (aboutH2) aboutH2.style.transform =
        'translate3d(' + (-aboutParX * 40).toFixed(1) + 'px,' + (-aboutParY * 22).toFixed(1) + 'px,0)';
      if (aboutP) aboutP.style.transform =
        'translate3d(' + (-aboutParX * 16).toFixed(1) + 'px,' + (-aboutParY * 9).toFixed(1) + 'px,0)';

      // ===== Vertical content deck. Each section sits one screen below the prior;
      // translateY = (index - sec) * 100vh, so scrolling slides the current one UP
      // and out while the next rises from below. Their opaque monotone backgrounds
      // keep the sound waves on the About page only.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Each section's top in screen-heights: About->Trusted is a full screen,
      // the rest are spaced by DECK_GAP (tighter). scrollPos is the current
      // viewport position in those same units, so section offset = pos - scrollPos.
      const deckPos = function(i) { return i === 0 ? 0 : 1 + (i - 1) * DECK_GAP; };
      const scrollPos = sec <= 1 ? sec : 1 + (sec - 1) * DECK_GAP;
      // Rounded to whole pixels so adjacent sections tile cleanly (no hairline seam).
      aboutEl.style.transform     = 'translate3d(0,' + Math.round((deckPos(0) - scrollPos) * vh) + 'px,0)';
      trustEl.style.transform     = 'translate3d(0,' + Math.round((deckPos(1) - scrollPos) * vh) + 'px,0)';
      reviewsEl.style.transform   = 'translate3d(0,' + Math.round((deckPos(2) - scrollPos) * vh) + 'px,0)';
      educationEl.style.transform = 'translate3d(0,' + Math.round((deckPos(3) - scrollPos) * vh) + 'px,0)';
      contactsEl.style.transform  = 'translate3d(0,' + Math.round((deckPos(4) - scrollPos) * vh) + 'px,0)';
      // Only the section at (or nearest) the current position is visible; the rest
      // are hidden. The swap happens under the closed shutter, so you never see two
      // sections at once during a transition — each fully appears / disappears.
      const deckEls = [trustEl, reviewsEl, educationEl, contactsEl];
      for (let i = 0; i < deckEls.length; i++) {
        const d = Math.abs(deckPos(i + 1) - scrollPos);     // distance in screen-heights
        deckEls[i].style.opacity = (d < 0.45 ? 1 : 0).toFixed(0);
      }
      // ===== Education: horizontal scrollytelling rail =====
      // The rail glides sideways by whole panels; each panel's .e-rev children
      // rise + fade in (staggered) the more centred that panel is, so text keeps
      // resolving as you scroll across. translate uses a CLAMPED scroll (no blank
      // edge) while the reveal uses the raw value (so the cut-in still animates).
      // Only animate the rail while Education is on (or next to) the screen —
      // its nested per-item style loop is wasted work from any other section.
      if (eduRail && eduPanels.length && Math.abs(deckPos(3) - scrollPos) < 1.3) {
        eduScroll += (eduScrollTarget - eduScroll) * 0.14;
        const END = EDU_PANELS - 1;
        const eW = educationEl.clientWidth || vw;
        const clamped = Math.max(0, Math.min(END, eduScroll));
        eduRail.style.transform = 'translate3d(' + (-clamped * eW).toFixed(1) + 'px,0,0)';
        for (let i = 0; i < eduPanels.length; i++) {
          const c = 1 - Math.min(1.4, Math.abs(i - eduScroll));   // centredness
          const items = eduPanels[i]._items;
          for (let j = 0; j < items.length; j++) {
            // Cap the cascade delay so long lists (14 items) still fully resolve.
            let a = (c - Math.min(j * 0.05, 0.4)) / 0.55; a = a < 0 ? 0 : a > 1 ? 1 : easeOutExpo(a);
            items[j].style.opacity = a.toFixed(3);
            items[j].style.transform = 'translate3d(0,' + ((1 - a) * 32).toFixed(1) + 'px,0)';
          }
        }
        if (eduBar) eduBar.style.width = (clamped / END * 100).toFixed(1) + '%';
        if (eduHint) eduHint.style.opacity = clamped > 0.12 ? '0' : '';
      }
      // Logos: the endless client-logo marquee (see logo-marquee.js).
      logoMarquee.update(dt);

      // Premium scroll-reveal, scrubbed by how centred each section is, plus a
      // multi-layer mouse parallax (each layer drifts at its own depth).
      deckParX += (deckMX - deckParX) * 0.07;
      deckParY += (deckMY - deckParY) * 0.07;

      // Shared deck backdrop. It becomes fully opaque already during the film->
      // About ZOOM (z), so there's a solid dark sheet sitting behind the About
      // page BEFORE you start scrolling the deck. That way, as About slides up,
      // there is never a gap/seam — the dark deck bg is already there underneath.
      // The orbs still scroll slowly (parallax) once you move into the deck.
      const deckShow = ss(0.9, 1.0, z);
      deckBg.style.opacity = deckShow.toFixed(3);
      if (deckShow > 0.001) {
        // Inner is 5.6 screens tall; scroll it ~0.5x the content travel so the
        // gradient + orbs glide past noticeably while clearly lagging the deck.
        const bgTravel = (5.6 - 1) * vh;               // matches .deck-bg-inner height
        const bgY = -(sec / MAX_SEC) * bgTravel * 0.5;
        deckBgInner.style.transform =
          'translate3d(' + (deckParX * 40).toFixed(1) + 'px,' + (bgY + deckParY * 30).toFixed(1) + 'px,0)';
        for (let i = 0; i < deckOrbs.length; i++) {
          const depth = 1 + i * 0.5;     // each orb a different parallax depth
          deckOrbs[i].style.transform =
            'translate3d(' + (deckParX * 60 * depth).toFixed(1) + 'px,' +
            (deckParY * 46 * depth + Math.sin(t * 0.3 + i) * 14).toFixed(1) + 'px,0)';
        }
      }

      // TIME-TRIGGERED reveal: once a section is mostly centred its entrance PLAYS
      // over ~0.6s so you SEE it animate in. It only ever advances toward 1 (never
      // rewinds), so there's an entrance animation but NO exit animation.
      for (let si = 0; si < deckSections.length; si++) {
        const ds = deckSections[si];
        const presence = 1 - Math.min(1, Math.abs(ds.index - sec));
        if (presence > 0.55 && ds.prog < 1) {
          ds.prog = Math.min(1, ds.prog + dt * 4.5);
        }
        revealSection(ds, ds.prog, deckParX, deckParY);
      }

      // Camera dollies in onto the active frame, so the FILM enlarges and that
      // frame fills the screen — then the About layer takes over.
      const parDamp = 1.0 - z * 0.6;
      camParX += (mouseNX - camParX) * 0.05;
      camParY += (mouseNY - camParY) * 0.05;
      camera.position.x = camParX * 2.6 * parDamp;
      camera.position.y = (CAM_Y0 * (1.0 - z) + FRAME_Y * z) - camParY * 1.5 * parDamp;
      camera.position.z = camZ0 * (1.0 - z) + (FRAME_Z + zoomGap) * z;
      camera.lookAt(0, CAM_Y0 * (1.0 - z) + FRAME_Y * z, FRAME_Z * z);

      // Skip the GL render entirely while the film canvas can't be seen (hero
      // covers it / About-deck replaced it). The first visible frame of any
      // transition re-renders within the same rAF tick, so nothing flashes.
      if (filmLive) renderer.render(scene, camera);

      // World/camera matrices are current right after render, so the on-film
      // controls hit-rect tracks the active frame exactly.
      if (playerOpening || playerOpen) frameRect = computeFrameRect();
    }
    animate();

    // Fallback: never let the overlay hang even if a video stalls.
    setTimeout(function() {
      loadingEl.classList.add('hidden');
      document.body.classList.add('hero-in');
      loadingHidden = true;
    }, 12000);
  })();
