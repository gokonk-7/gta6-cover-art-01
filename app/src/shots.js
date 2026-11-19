// Vice Cover Studio — screenshot scenes.
//
// `?shot=cover` paints one cover fullscreen with no editor chrome (the
// exported-cover shots); `?shot=editor` shows the editor with a sample
// loaded. Extra parameters pick the scene: photo=<sample file>,
// caption=<title>, subtitle=<text>, layout=<preset>, grade=<grade>.
// Sets window.__shotReady once the scene has painted, so a screenshot
// runner knows the frame is final.

import { loadImage, renderCover } from './cover.js';

function params() {
  return new URLSearchParams(window.location.search);
}

function markReady() {
  // Two animation frames: one for the paint, one for the font to settle.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

async function shotCover(query) {
  document.body.classList.add('shot-cover');
  const stage = document.getElementById('stage');
  const vice = window.__vice;
  if (!vice) return;

  const layout = query.get('layout') || 'triptych';
  const grade = query.get('grade') || 'sunset';
  const title = query.get('caption') || 'VICE HEIST';
  const subtitle = query.get('subtitle') || 'A LEONIDA STORY';
  const photoName = query.get('photo') || 'portrait-woman.jpg';

  vice.pickLayout(layout);
  vice.pickGrade(grade);
  vice.state.title = title.toUpperCase();
  vice.state.subtitle = subtitle;

  const picks = {
    triptych: ['portrait-woman.jpg', 'boulevard.jpg', 'pier.jpg'],
    comic: ['portrait-man.jpg', 'portrait-woman.jpg', 'boulevard.jpg'],
    heroDuo: ['portrait-woman.jpg', 'portrait-man.jpg', 'pier.jpg'],
    quad: ['portrait-woman.jpg', 'portrait-man.jpg', 'boulevard.jpg', 'pier.jpg'],
  };
  const chosen = picks[layout] || picks.triptych;
  // Only override the hero photo when the caller names one explicitly;
  // the default picks already use a different photo per panel.
  if (query.get('photo')) chosen[0] = photoName;
  const images = await Promise.all(
    chosen.map((name) => loadImage(`samples/${name}`).catch(() => null)),
  );
  vice.state.photos = images;
  vice.state.pans = images.map(() => ({ x: 0, y: 0 }));
  vice.state.zooms = images.map(() => 1);

  // Size the stage to the window so the screenshot is the cover itself.
  const size = [window.innerWidth, window.innerHeight];
  renderCover(stage, { ...vice.state, size });
  document.title = `${title} — Vice Cover Studio`;
  markReady();
}

async function shotEditor(query) {
  const vice = window.__vice;
  if (!vice) return;
  const layout = query.get('layout') || 'triptych';
  const grade = query.get('grade') || 'sunset';
  vice.pickLayout(layout);
  vice.pickGrade(grade);
  vice.state.title = (query.get('caption') || 'VICE HEIST').toUpperCase();
  vice.state.subtitle = query.get('subtitle') || 'A LEONIDA STORY';
  const titleInput = document.getElementById('titleInput');
  const subtitleInput = document.getElementById('subtitleInput');
  if (titleInput) titleInput.value = vice.state.title;
  if (subtitleInput) subtitleInput.value = vice.state.subtitle;
  await vice.loadStarters();
  // Let the fonts finish before signalling ready.
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }
  markReady();
}

const query = params();
const shot = query.get('shot');
if (shot === 'cover') {
  shotCover(query).catch(() => { window.__shotReady = true; });
} else if (shot === 'editor') {
  shotEditor(query).catch(() => { window.__shotReady = true; });
}
