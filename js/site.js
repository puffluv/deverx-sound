/* Deverx Sound Studio — page behaviour.
   No framework, no build step. Everything degrades to plain links:
   without this file the films still open on YouTube. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 719px)');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Menu (phones and small tablets) ---------- */

  var menu = $('[data-menu]');
  var menuToggle = $('[data-menu-toggle]');

  function setMenu(open) {
    if (!menu || !menuToggle) return;
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuToggle.querySelector('.menu-btn-label').textContent = open ? 'Close' : 'Menu';
    root.classList.toggle('menu-open', open);
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }
  if (menu && menuToggle) {
    menuToggle.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuToggle.focus(); }
    });
    window.matchMedia('(min-width: 881px)').addEventListener('change', function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------- Current section in the nav ---------- */

  var navLinks = $$('.nav a');
  var navFor = { work: 'work', services: 'services', about: 'about', contact: 'contact' };
  if ('IntersectionObserver' in window && navLinks.length) {
    var sectionIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var target = navFor[entry.target.id];
        navLinks.forEach(function (a) {
          if (target && a.getAttribute('href') === '#' + target) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('main > section[id]').forEach(function (s) { sectionIO.observe(s); });
  }

  /* ---------- Showreel player ----------
     The films play right here on the page, in YouTube's own embedded player
     served from youtube-nocookie.com (YouTube's privacy-enhanced embed
     domain, which also stays reachable on networks that block youtube.com).

     The player is loaded underneath the poster as the reel comes near. Once
     it is ready the poster lets taps fall through to it, so the very first
     tap starts the film with sound in every browser — Safari and iOS only
     allow that when the tap lands inside the player itself. The poster
     fades away as soon as the film is actually playing. */

  var EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

  var screen = $('[data-screen]');
  var poster = $('[data-poster]');
  var posterImg = $('[data-poster-img]');
  var playLabel = $('.screen-play-label');
  var playerBox = $('[data-player]');
  var nowTitle = $('[data-now-title]');
  var nowKind = $('[data-now-kind]');
  var nowTime = $('[data-now-time]');
  var ambientImg = $('[data-ambient]');

  var films = $$('.film[data-video]').map(function (el) {
    return { el: el, id: el.dataset.video, slug: el.dataset.slug, title: el.dataset.title, kind: el.dataset.kind, time: el.dataset.time || '' };
  });
  var current = films.filter(function (f) { return f.el.classList.contains('is-active'); })[0] || films[0];
  var embed = null;          // YouTube's player iframe
  var embedReady = false;    // it answered our "listening" handshake
  var loadedId = null;       // film currently loaded in the player
  var wantPlay = false;      // play was asked for before the player was ready
  var playing = false;
  var slowTimer = null;

  function embedSrc(id) {
    var q = 'playsinline=1&rel=0&color=white&enablejsapi=1';
    if (/^https?:$/.test(location.protocol)) q += '&origin=' + encodeURIComponent(location.origin);
    return EMBED_ORIGIN + '/embed/' + id + '?' + q;
  }

  function post(message) {
    if (embed && embed.contentWindow) embed.contentWindow.postMessage(JSON.stringify(message), EMBED_ORIGIN);
  }
  function command(func, args) { post({ event: 'command', func: func, args: args || [] }); }

  // Ask the embed to report its state back; repeat until it answers.
  function listen() {
    var tries = 0;
    (function ping() {
      if (!embed || embedReady || tries++ > 40) return;
      post({ event: 'listening', id: 'reel', channel: 'widget' });
      setTimeout(ping, 400);
    })();
  }

  function createEmbed() {
    if (embed || !playerBox) return;
    embed = document.createElement('iframe');
    embed.title = 'Showreel player';
    embed.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; web-share';
    embed.setAttribute('allowfullscreen', '');
    embed.referrerPolicy = 'strict-origin-when-cross-origin';
    embed.addEventListener('load', listen);
    loadedId = current.id;
    embed.src = embedSrc(current.id);
    playerBox.appendChild(embed);
  }

  function setLoading(on) {
    screen.classList.toggle('is-loading', on);
    clearTimeout(slowTimer);
    screen.classList.remove('is-slow');
    if (playLabel) playLabel.textContent = 'Play with sound';
    if (on) {
      slowTimer = setTimeout(function () {
        screen.classList.add('is-slow');
        if (playLabel) playLabel.textContent = 'Still loading the player — check your connection';
      }, 12000);
    }
  }

  function onEmbedReady() {
    embedReady = true;
    screen.classList.add('is-ready');
    setLoading(false);
    if (loadedId !== current.id) {
      loadedId = current.id;
      command(wantPlay ? 'loadVideoById' : 'cueVideoById', [current.id]);
    } else if (wantPlay) {
      command('playVideo');
    }
    wantPlay = false;
  }

  window.addEventListener('message', function (e) {
    if (!embed || e.source !== embed.contentWindow) return;
    var data;
    try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
    if (!data || !data.event) return;
    if (!embedReady) onEmbedReady();
    var state = null;
    if (data.event === 'onStateChange') state = data.info;
    else if (data.info && typeof data.info.playerState === 'number') state = data.info.playerState;
    if (typeof state !== 'number') return;
    var now = state === 1 || state === 3;   // playing or buffering
    if (now) screen.classList.add('is-live');
    if (now !== playing) { playing = now; requestFrame(); }
  });

  function select(film) {
    current = film;
    films.forEach(function (f) {
      var on = f === film;
      f.el.classList.toggle('is-active', on);
      if (on) f.el.setAttribute('aria-current', 'true'); else f.el.removeAttribute('aria-current');
    });
    if (nowTitle) nowTitle.textContent = film.title;
    if (nowKind) nowKind.textContent = film.kind;
    if (nowTime) nowTime.textContent = film.time;
    if (ambientImg) ambientImg.src = 'img/work/' + film.slug + '-thumb.webp';
    if (poster) {
      poster.href = 'https://youtu.be/' + film.id;
      poster.setAttribute('aria-label', 'Play ' + film.title + ', ' + film.kind.toLowerCase());
    }
    if (posterImg) {
      posterImg.srcset = 'img/work/' + film.slug + '-768.webp 768w, img/work/' + film.slug + '.webp 1280w';
      posterImg.src = 'img/work/' + film.slug + '.webp';
    }
  }

  function play(film) {
    if (!screen || !playerBox) return;
    if (film !== current) select(film);
    if (!embed) createEmbed();
    if (!embedReady) { wantPlay = true; setLoading(true); return; }
    if (loadedId !== film.id) {
      loadedId = film.id;
      command('loadVideoById', [film.id]);
    } else {
      command('playVideo');
    }
  }

  function bringScreenIntoView() {
    if (!screen) return;
    var r = screen.getBoundingClientRect();
    var top = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 68;
    if (r.top < top || r.bottom > window.innerHeight) {
      screen.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  }

  // Plain clicks play on the page; cmd/ctrl/middle-click keep the link.
  function isPlainClick(e) { return !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0); }
  function filmById(id) { return films.filter(function (f) { return f.id === id; })[0]; }

  if (screen && films.length) {
    films.forEach(function (f) {
      f.el.addEventListener('click', function (e) {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        play(f);
        bringScreenIntoView();
      });
    });
    // Only reached while the player is still loading (or from the keyboard):
    // once it is ready, taps go straight through to it.
    if (poster) {
      poster.addEventListener('click', function (e) {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        play(current);
      });
    }
    $$('[data-watch]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        screen.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        if (!playing) play(current);
      });
    });
    $$('[data-play]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var film = filmById(link.dataset.play);
        if (!film || !isPlainClick(e)) return;
        e.preventDefault();
        screen.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        play(film);
      });
    });

    // Load the player under the poster as the reel comes near.
    if ('IntersectionObserver' in window) {
      var nearIO = new IntersectionObserver(function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        nearIO.disconnect();
        createEmbed();
      }, { rootMargin: '800px 0px' });
      nearIO.observe(screen);
    } else {
      createEmbed();
    }
  }

  /* ---------- Mix session: generated stems + scroll-driven playhead ---------- */

  var session = $('[data-session]');
  var tcEl = $('[data-tc]');

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Stems shaped like the real thing: dialogue comes in phrases, sound design
  // in hits with a riser, Foley as footsteps, ambience as a slow bed.
  function buildStems(n) {
    var r = mulberry32(51);
    var s = { dialogue: [], design: [], foley: [], ambience: [], mix: [] };
    var i, k;
    for (i = 0; i < n; i++) { s.dialogue[i] = 0; s.design[i] = 0.035 + r() * 0.03; s.foley[i] = 0.03 + r() * 0.035; }

    for (i = 4; i < n;) {
      var len = 12 + Math.floor(r() * 26), gap = 6 + Math.floor(r() * 16), loud = 0.4 + r() * 0.45;
      for (k = 0; k < len && i + k < n; k++) {
        var env = Math.pow(Math.sin(Math.PI * (k + 0.5) / len), 0.5);
        var syl = 0.32 + 0.68 * Math.abs(Math.sin(k * 0.86 + r() * 0.9));
        s.dialogue[i + k] = loud * env * syl;
      }
      i += len + gap;
    }

    var hits = [Math.floor(n * 0.2), Math.floor(n * 0.55), Math.floor(n * 0.83)];
    for (k = 0; k < 40; k++) {
      var j = hits[1] - 40 + k;
      if (j >= 0) s.design[j] = Math.max(s.design[j], 0.06 + 0.62 * Math.pow(k / 40, 2.2) * (0.85 + r() * 0.15));
    }
    hits.forEach(function (h, idx) {
      var peak = idx === 1 ? 1 : 0.62 + r() * 0.2;
      for (var q = 0; q < 42 && h + q < n; q++) {
        s.design[h + q] = Math.max(s.design[h + q], peak * Math.exp(-q / 8) * (0.8 + r() * 0.2));
      }
    });

    for (i = 6; i < n;) {
      var step = 0.26 + r() * 0.3;
      for (k = 0; k < 5 && i + k < n; k++) s.foley[i + k] = Math.max(s.foley[i + k], step * Math.exp(-k / 1.3));
      i += 7 + Math.floor(r() * 4);
      if (r() < 0.07) i += 22;
    }

    var v = 0.2;
    for (i = 0; i < n; i++) {
      v = clamp(v + (r() - 0.5) * 0.028, 0.13, 0.3);
      s.ambience[i] = v * (0.9 + r() * 0.2);
    }

    for (i = 0; i < n; i++) {
      var sum = 0.78 * s.dialogue[i] + 0.62 * s.design[i] + 0.36 * s.foley[i] + 0.42 * s.ambience[i];
      s.mix[i] = Math.tanh(sum * 1.45) * (0.93 + r() * 0.07);
    }
    return s;
  }

  function envelope(a) {
    var n = a.length, dx = 1000 / (n - 1), top = 'M0 50', bottom = '', x, h;
    for (var i = 0; i < n; i++) {
      x = (i * dx).toFixed(1); h = Math.max(0.7, a[i] * 47);
      top += 'L' + x + ' ' + (50 - h).toFixed(1);
      bottom = 'L' + x + ' ' + (50 + h).toFixed(1) + bottom;
    }
    return top + bottom + 'Z';
  }

  var STEM_SAMPLES = 240;
  var stems = null;
  var meters = [];
  if (session) {
    stems = buildStems(STEM_SAMPLES);
    meters = $$('[data-meter]', session).map(function (el) {
      return { data: stems[el.dataset.meter], bars: $$('i', el) };
    });
    $$('.lane-wave', session).forEach(function (wave) {
      var data = stems[wave.dataset.kind];
      if (!data) return;
      var d = envelope(data);
      wave.innerHTML =
        '<svg class="w-dim" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>' +
        '<svg class="w-lit" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '"/></svg>';
    });
  }

  var SESSION_SECONDS = 94, FPS = 24;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function timecode(p) {
    var frames = Math.round(p * SESSION_SECONDS * FPS);
    var ff = frames % FPS, total = Math.floor(frames / FPS);
    return '01:' + pad(Math.floor(total / 60)) + ':' + pad(total % 60) + ':' + pad(ff);
  }

  var lastP = -1;
  function updateSession(vh) {
    if (!session) return;
    var p;
    if (reduceMotion.matches) p = 1;
    else {
      var r = session.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      var start = vh * 0.88, end = vh * 0.32;
      p = clamp((start - r.top) / ((start - end) + r.height), 0, 1);
    }
    p = Math.round(p * 1000) / 1000;
    if (p === lastP) return;
    lastP = p;
    session.style.setProperty('--p', String(p));
    if (tcEl) tcEl.textContent = timecode(p);
    // Meters read the level under the playhead (a little peak-hold on either side).
    var i = Math.round(p * (STEM_SAMPLES - 1));
    meters.forEach(function (m) {
      if (!m.data) return;
      var lvl = Math.max(m.data[i] || 0, m.data[i - 1] || 0, m.data[i + 1] || 0);
      m.bars.forEach(function (bar, side) {
        var v = side ? lvl * (0.88 + 0.12 * Math.abs(Math.sin(i * 1.7))) : lvl;
        bar.style.setProperty('--lvl', Math.min(1, v).toFixed(3));
      });
    });
  }

  /* ---------- Header + house lights (one rAF per scroll frame) ---------- */

  var header = $('[data-header]');

  function updateLights(vh) {
    if (!screen) return;
    var r = screen.getBoundingClientRect();
    var shown = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.min(r.height, vh);
    var centred = Math.abs(r.top + r.height / 2 - vh / 2) < vh * 0.2;
    var down = menu && !menu.hidden ? false
      : (playing && shown > 0.55) || (!narrow.matches && centred && shown > 0.85);
    root.classList.toggle('lights-down', down);
  }

  var ticking = false;
  function frame() {
    ticking = false;
    var vh = window.innerHeight;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    updateLights(vh);
    updateSession(vh);
  }
  function requestFrame() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame);
  reduceMotion.addEventListener && reduceMotion.addEventListener('change', function () { lastP = -1; requestFrame(); });
  frame();
})();
