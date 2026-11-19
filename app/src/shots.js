// Vice Cover Studio — fixed scenes for screenshots.
//
// `?shot=cover` paints one exported cover full-screen, with no editor
// chrome, honouring `photo`, `caption`, `subtitle`, `layout`, `grade` and
// `size` query params. `?shot=editor` shows the editor with sample photos
// loaded, honouring the same params. Either way the scene sets
// window.__shotReady once it has painted, so a screenshot tool knows when
// to take the shot.

const COVER_PHOTOS = {
  triptych: ['portrait-woman', 'portrait-man', 'boulevard'],
  comic: ['portrait-woman', 'boulevard', 'portrait-man'],
  heroDuo: ['boulevard', 'portrait-woman', 'portrait-man'],
  quad: ['portrait-woman', 'portrait-man', 'boulevard', 'pier'],
};

function pickPhotos(query, layout) {
  const single = query.get('photo');
  if (single) return [single];
  return COVER_PHOTOS[layout] || COVER_PHOTOS.triptych;
}

function paintWhenReady(hooks) {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hooks.refresh();
        window.__shotReady = true;
        resolve();
      });
    });
  });
}

export async function runShot(shot, query, hooks) {
  const layout = query.get('layout') || 'triptych';
  const grade = query.get('grade') || 'sunset';
  const size = query.get('size') || (shot === 'cover' ? 'wide' : 'square');
  const title = query.get('caption') || 'SUNSET HEIST';
  const subtitle = query.get('subtitle') || 'LEONIDA • 2026';

  hooks.applyLayout(layout);
  hooks.applyGrade(grade);
  hooks.applyCaption(title, subtitle);
  hooks.applySize(size);

  const photos = pickPhotos(query, layout);
  for (let i = 0; i < photos.length; i += 1) {
    try {
      const image = await hooks.loadPhoto(photos[i]);
      hooks.applyPhoto(i, image, photos[i]);
    } catch {
      // A missing sample leaves that panel empty; the shot still paints.
    }
  }

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
  }
  await hooks.fontsReady();
  hooks.refresh();
  await paintWhenReady(hooks);
}
