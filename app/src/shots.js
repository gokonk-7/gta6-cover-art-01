// Vice Cover Studio — fixed scenes for screenshots.
//
// `?shot=cover` shows the cover alone, edge to edge, at the export size the
// query asks for. `?shot=editor` shows the editor with sample photos loaded
// in every panel. The query also takes `photo` (a sample file name without
// the extension), `caption`, `subtitle`, `layout`, `grade` and `size`
// (square, portrait or wide). `window.__shotReady` is set once the font has
// loaded and the cover has painted, so a screenshot never catches a
// half-drawn frame.

import { SIZES, autoPanFor, layoutPanels } from './cover.js';

function waitPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export async function runShot(shot, query, api) {
  const { loadSample, setPhoto, selectPanel, redraw, resizePreview, state, titleInput, subtitleInput } = api;

  const layout = query.get('layout');
  if (layout && ['triptych', 'comic', 'hero', 'quad'].includes(layout)) state.layout = layout;
  const grade = query.get('grade');
  if (grade && ['sunset', 'neon', 'gold', 'noir'].includes(grade)) state.grade = grade;
  const size = query.get('size');
  if (size && SIZES[size]) state.size = size;

  const caption = query.get('caption');
  if (caption != null) {
    state.title = caption;
    titleInput.value = caption;
  }
  const subtitle = query.get('subtitle');
  if (subtitle != null) {
    state.subtitle = subtitle;
    subtitleInput.value = subtitle;
  }

  // Fill the panels with the requested sample first, then spread the other
  // samples across the remaining panels so every layout looks full. Each
  // photo gets the same starting pan the editor would give it, so faces
  // stay in frame in the wide side panels. `photos` names the fill order
  // (sample file names without the extension); the default puts the square
  // pier shot in the wide lower panel, where a tall portrait would crop.
  const first = `${query.get('photo') ?? 'portrait-woman'}.jpg`;
  const rest = ['portrait-man.jpg', 'pier.jpg', 'boulevard.jpg', 'portrait-woman.jpg'];
  const listed = (query.get('photos') ?? '')
    .split(',')
    .map((s) => `${s.trim()}.jpg`)
    .filter((f) => f !== '.jpg');
  const files = listed.length
    ? [...listed, ...rest.filter((f) => !listed.includes(f))]
    : [first, ...rest.filter((f) => f !== first)];
  const target = SIZES[state.size];
  const rects = layoutPanels(state.layout, target.w, target.h);
  for (let i = 0; i < 4; i++) {
    try {
      const img = await loadSample(files[i]);
      const pan = rects[i] ? autoPanFor(img, rects[i]) : { panX: 0, panY: 0 };
      state.panels[i] = { img, panX: pan.panX, panY: pan.panY, zoom: 1 };
      img.dataset.file = files[i];
    } catch {
      // A missing sample leaves its panel empty; the cover still draws.
    }
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // The cover scene draws at the exact export size, not the preview size.
    const cover = document.getElementById('cover');
    cover.width = target.w;
    cover.height = target.h;
    redraw();
  } else {
    resizePreview();
    selectPanel(0);
  }

  try {
    await document.fonts.load('16px Anton');
    await document.fonts.ready;
  } catch {
    // The fallback stack still draws if the font fails to load.
  }
  redraw();
  await waitPaint();
  window.__shotReady = true;
}
