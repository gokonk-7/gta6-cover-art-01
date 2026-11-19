// Vice Cover Studio — editor wiring.
//
// Owns the page state (layout, grade, caption, one photo + pan + zoom per
// panel), binds every control, and repaints the preview canvas on every
// change. Uploads are read with FileReader and stay on this machine.

import { GRADES, LAYOUTS, exportCover, layoutRects, loadImage, renderCover } from './cover.js';

const SAMPLES = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
  { name: 'Portrait — woman', src: 'samples/portrait-woman.jpg' },
  { name: 'Portrait — man', src: 'samples/portrait-man.jpg' },
];

const PANEL_NAMES = ['Panel 1', 'Panel 2', 'Panel 3', 'Panel 4'];

// A different starter photo per layout so every preset looks composed
// on first paint, not empty.
const LAYOUT_STARTERS = {
  triptych: [2, 0, 1],
  comic: [3, 2, 0],
  heroDuo: [2, 3, 0],
  quad: [2, 3, 0, 1],
};

export const state = {
  layout: 'triptych',
  grade: 'sunset',
  title: 'VICE HEIST',
  subtitle: 'A LEONIDA STORY',
  photos: [],
  pans: [],
  zooms: [],
  size: [1080, 1080],
};

const stage = document.getElementById('stage');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const slotsBox = document.getElementById('photoSlots');

let paintQueued = false;

export function panelCount() {
  return layoutRects(state.layout, 1080, 1080).length;
}

function ensureSlots() {
  const n = panelCount();
  while (state.photos.length < n) state.photos.push(null);
  while (state.pans.length < n) state.pans.push({ x: 0, y: 0 });
  while (state.zooms.length < n) state.zooms.push(1);
  state.photos.length = n;
  state.pans.length = n;
  state.zooms.length = n;
}

export function paint() {
  ensureSlots();
  renderCover(stage, state);
  paintQueued = false;
}

export function schedulePaint() {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(paint);
}

function currentPreviewSize() {
  // The on-screen preview follows the cover's aspect: square by default.
  return state.size;
}

async function setPhoto(index, src) {
  try {
    const img = await loadImage(src);
    state.photos[index] = img;
    state.pans[index] = { x: 0, y: 0 };
    state.zooms[index] = 1;
  } catch {
    state.photos[index] = null;
  }
  buildSlots();
  schedulePaint();
}

export async function loadStarters() {
  const picks = LAYOUT_STARTERS[state.layout] || LAYOUT_STARTERS.triptych;
  ensureSlots();
  await Promise.all(
    picks.map((sampleIdx, i) => setPhoto(i, SAMPLES[sampleIdx].src)),
  );
  schedulePaint();
}

function buildSlots() {
  ensureSlots();
  slotsBox.innerHTML = '';
  for (let i = 0; i < panelCount(); i += 1) {
    const row = document.createElement('div');
    row.className = 'photo-slot';

    const thumb = document.createElement('img');
    thumb.alt = `${PANEL_NAMES[i]} photo`;
    thumb.src = state.photos[i]?.src || '';
    row.appendChild(thumb);

    const right = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = PANEL_NAMES[i];
    right.appendChild(name);

    const tools = document.createElement('div');
    tools.className = 'slot-tools';

    const pick = document.createElement('select');
    pick.setAttribute('aria-label', `${PANEL_NAMES[i]} sample`);
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Choose sample…';
    pick.appendChild(none);
    SAMPLES.forEach((sample) => {
      const option = document.createElement('option');
      option.value = sample.src;
      option.textContent = sample.name;
      pick.appendChild(option);
    });
    pick.value = state.photos[i]?.src && SAMPLES.some((s) => s.src === state.photos[i].src)
      ? state.photos[i].src
      : '';
    pick.addEventListener('change', () => {
      if (pick.value) setPhoto(i, pick.value);
    });
    tools.appendChild(pick);

    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'upload-btn';
    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.textContent = 'Upload';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhoto(i, String(reader.result));
      reader.readAsDataURL(file);
    });
    uploadBtn.addEventListener('click', () => fileInput.click());
    uploadLabel.append(uploadBtn, fileInput);
    tools.appendChild(uploadLabel);

    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '2.5';
    zoom.step = '0.05';
    zoom.value = String(state.zooms[i] || 1);
    zoom.setAttribute('aria-label', `${PANEL_NAMES[i]} zoom`);
    zoom.addEventListener('input', () => {
      state.zooms[i] = Number(zoom.value);
      schedulePaint();
    });
    tools.appendChild(zoom);
    right.appendChild(tools);
    row.appendChild(right);
    slotsBox.appendChild(row);
  }
}

function bindChoiceRow(rowId, attr, onPick) {
  const row = document.getElementById(rowId);
  row.addEventListener('click', (event) => {
    const button = event.target.closest(`[data-${attr}]`);
    if (!button) return;
    row.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    onPick(button.dataset[attr]);
  });
}

function pickLayout(layout) {
  if (!LAYOUTS.includes(layout)) return;
  state.layout = layout;
  buildSlots();
  schedulePaint();
}

function pickGrade(grade) {
  if (!GRADES.includes(grade)) return;
  state.grade = grade;
  schedulePaint();
}

// Drag on the canvas pans the photo under the pointer.
function panelAt(clientX, clientY) {
  const box = stage.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * stage.width;
  const y = ((clientY - box.top) / box.height) * stage.height;
  const rects = layoutRects(state.layout, stage.width, stage.height);
  const index = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  return index < 0 ? null : { index, x, y };
}

let drag = null;
stage.addEventListener('pointerdown', (event) => {
  const hit = panelAt(event.clientX, event.clientY);
  if (!hit || !state.photos[hit.index]) return;
  drag = { ...hit, startPan: { ...state.pans[hit.index] } };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const hit = panelAt(event.clientX, event.clientY);
  if (!hit || hit.index !== drag.index) return;
  const rects = layoutRects(state.layout, stage.width, stage.height);
  const rect = rects[drag.index];
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  state.pans[drag.index] = {
    x: clamp(drag.startPan.x + ((hit.x - drag.x) / rect.w) * 2),
    y: clamp(drag.startPan.y + ((hit.y - drag.y) / rect.h) * 2),
  };
  schedulePaint();
});
for (const end of ['pointerup', 'pointercancel']) {
  stage.addEventListener(end, () => { drag = null; });
}

titleInput.addEventListener('input', () => {
  state.title = titleInput.value.trim() || 'VICE HEIST';
  schedulePaint();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value.trim();
  schedulePaint();
});

bindChoiceRow('layoutRow', 'layout', pickLayout);
bindChoiceRow('gradeRow', 'grade', pickGrade);

document.querySelectorAll('[data-export]').forEach((button) => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await exportCover(state, button.dataset.export);
    } finally {
      button.disabled = false;
    }
  });
});

document.getElementById('shuffleBtn').addEventListener('click', async () => {
  const layouts = LAYOUTS.filter((l) => l !== state.layout);
  const grades = GRADES.filter((g) => g !== state.grade);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  await loadStarters();
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  state.title = 'VICE HEIST';
  state.subtitle = 'A LEONIDA STORY';
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  state.layout = 'triptych';
  state.grade = 'sunset';
  document.querySelectorAll('#layoutRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === 'triptych');
  });
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === 'sunset');
  });
  await loadStarters();
});

// Expose the live state for shot scenes and for debugging in the console.
window.__vice = { state, paint, loadStarters, setPhoto, pickLayout, pickGrade };

buildSlots();
loadStarters();
