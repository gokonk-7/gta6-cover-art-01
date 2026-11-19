// Fixed scenes for screenshots: `?shot=cover` shows the cover alone,
// fullscreen with no editor chrome; `?shot=editor` shows the editor with a
// sample loaded. `photo` picks the sample, `caption` the title, `layout`
// and `grade` the look. window.__shotReady is set once painted.
import { SAMPLES } from './editor.js';

const TITLES = {
  cover: 'VICE CITY',
  editor: 'VICE CITY',
};

export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photoName = query.get('photo') ?? 'portrait-woman';
  const title = query.get('caption') ?? TITLES[shot] ?? 'VICE CITY';
  const subtitle = query.get('subtitle') ?? 'Two outlaws. One last score.';
  const layout = query.get('layout') ?? (shot === 'cover' ? 'triptych' : 'triptych');
  const grade = query.get('grade') ?? 'sunset';
  const sample = SAMPLES.find((s) => s.file.startsWith(photoName)) ?? SAMPLES[0];
  const second = SAMPLES.find((s) => s.file.startsWith(query.get('photo2') ?? 'portrait-man')) ?? SAMPLES[1];
  const third = SAMPLES.find((s) => s.file.startsWith(query.get('photo3') ?? 'pier')) ?? SAMPLES[3];

  const hero = await api.loadImage(`samples/${sample.file}`);
  const two = await api.loadImage(`samples/${second.file}`);
  const three = await api.loadImage(`samples/${third.file}`);
  api.setState({
    layout,
    grade,
    title,
    subtitle,
    panels: [
      { photo: hero, name: 'Hero', pan: { x: 0, y: 0 }, zoom: 1 },
      { photo: two, name: 'Panel 2', pan: { x: 0, y: 0 }, zoom: 1 },
      { photo: three, name: 'Panel 3', pan: { x: 0, y: 0 }, zoom: 1 },
    ],
  });
  // Let the Anton webfont arrive before we declare the shot painted.
  if (document.fonts?.ready) {
    try { await document.fonts.load('40px Anton'); await document.fonts.ready; } catch { /* fall back to the drawn frame */ }
  }
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
