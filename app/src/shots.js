// Fixed scenes for screenshots. `?shot=cover` shows the cover alone, full
// screen, with no editor chrome; `?shot=editor` shows the editor with photos
// loaded. Query knobs: photo0..photo3 (sample ids), caption (the title),
// subtitle, layout, grade, size. window.__shotReady is set once painted.

const COVER_SCENES = {
  wide: { layout: 'triptych', grade: 'sunset', size: 'wide', photos: ['portrait-woman', 'portrait-man', 'boulevard'], pans: { 2: { ox: 0.5, oy: 0.18 } } },
  square: { layout: 'heroDuo', grade: 'neon', size: 'square', photos: ['portrait-man', 'portrait-woman', 'boulevard'], pans: { 2: { ox: 0.5, oy: 0.18 } } },
  portrait: { layout: 'comic', grade: 'golden', size: 'portrait', photos: ['portrait-woman', 'boulevard', 'portrait-man'] },
};

function paintDone() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

export async function runShot(shot, query, api) {
  const size = query.get('size');
  const scene = COVER_SCENES[size ?? ''] ?? null;
  if (shot === 'cover') document.body.classList.add('shot-cover');

  if (scene) {
    await api.setLayout(query.get('layout') ?? scene.layout);
    api.setGrade(query.get('grade') ?? scene.grade);
    api.setSize(scene.size);
  } else {
    await api.setLayout(query.get('layout') ?? 'triptych');
    api.setGrade(query.get('grade') ?? 'sunset');
    api.setSize(size ?? 'square');
  }

  const photos = scene?.photos ?? ['portrait-woman', 'portrait-man', 'boulevard', 'pier'];
  for (let i = 0; i < photos.length; i++) {
    const pick = query.get(`photo${i}`) ?? photos[i];
    try { await api.setPanelSample(i, pick); } catch { /* keep the slot as is */ }
  }
  // Scene pan overrides keep faces in frame (e.g. the boulevard shot's
  // subject sits high in its frame, so its crop window slides up).
  for (const [index, pan] of Object.entries(scene?.pans ?? {})) {
    api.setPanelPan(Number(index), pan.ox, pan.oy);
  }

  api.setTitle(query.get('caption') ?? (shot === 'cover' ? 'NEON HEAT' : api.state.title));
  api.setSubtitle(query.get('subtitle') ?? api.state.subtitle);
  api.redraw();
  paintDone();
}
