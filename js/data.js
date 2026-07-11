// Site content + static assets: projects on the film strip, client logos,
// preview art styles and player icons. Edit here, not in app code.

// Brands + their display names. Rename freely — names render under each logo.
// (channels4_profile = the golden-tiger emblem -> Taiga Reverie; the teal
// pencil-crest is a guess of K.A.M.I — change if wrong.)
export const LOGOS = [
  { src: 'logos/Loreal-Logo.jpg',                      name: "L'Oréal" },
  { src: 'logos/MULTITUSYA logo.png',                  name: 'Multitusya' },
  { src: 'logos/PRANA SPRING logo.png',                name: 'Prana Spring' },
  { src: 'logos/nikita kolesnik film studio logo.png', name: 'Nikita Kolesnik' },
  { src: 'logos/suspense films logo.png',              name: 'Suspense Films' },
  { src: 'logos/oonga_logo.jpeg',                      name: 'Oonga' },
  { src: 'logos/channels4_profile.jpg',                name: 'Taiga Reverie' },
  { src: 'logos/__ai_Instagram_Post.png.webp',         name: 'K.A.M.I' }
];

export const projects = [
  { title: 'Process',      type: 'Sound Design Reel',      palette: ['#0b1018', '#d8a458', '#7bd8ff'], src: 'works/0.Process.mp4' },
  { title: 'Dune',         type: 'Trailer Sound Redesign', palette: ['#160f0a', '#c98f45', '#f8efe0'], src: 'works/1.Dune.mp4' },
  { title: 'NEVO Trailer', type: 'Cinematic Trailer',      palette: ['#07111a', '#6fb7d7', '#f0d09a'], src: 'works/2.NEVO Trailer.mp4', previewScale: 1.22 },
  { title: 'Pressure',     type: 'Tension Sound Design',   palette: ['#09090d', '#a62f32', '#f2d1a0'], src: 'works/3.Pressure.mp4' },
  { title: 'Dead Space',   type: 'Game Audio Redesign',    palette: ['#05070a', '#6e8c8f', '#dce6df'], src: 'works/4.Dead Space.mp4' },
  { title: 'Chainsaw Man', type: 'Anime Sound Redesign',   palette: ['#130707', '#d64f2f', '#ffe1a8'], src: 'works/5.Chainsaw Man.mp4' },
  { title: 'Raihan-002',   type: 'Music Video Sound',      palette: ['#060c10', '#3b8f9d', '#f1eee4'], src: 'works/6.Raihan-002.mp4', previewScale: 1.2 },
  { title: 'GhostCode',    type: 'Sci-Fi Interface Audio', palette: ['#030709', '#31c6a4', '#d8fff4'], src: 'works/7.GhostCode.mp4' },
];

// Which preview style each project gets (sound-design themed).
export const FRAME_KINDS = ['ripple','poster','grid','spectrum','wave','spectrogram','particle','wave','spectrum','ripple','knobs','poster'];

// SVG icons for the player controls.
export const ICON_PLAY  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
export const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/></svg>';
export const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/></svg>';
export const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
