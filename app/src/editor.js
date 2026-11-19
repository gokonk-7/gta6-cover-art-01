// Vice Cover Studio editor: wires the controls to the renderer — layout and
// grade pickers, caption inputs, per-panel photo upload + bundled samples,
// drag-to-pan and zoom on the canvas, and the three PNG export buttons.
// `?shot=` scenes live in ./shots.js; the editor stays local-only, no fetch.
import { renderCover, layoutRects, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const zoomInput = document.getElementById('zoom');
const panelList = document.getElementById('panelList');
const sampleRow = document.getElementById('sampleRow');

export const SAMPLES = [
  { file: 'portrait-woman.jpg', label: 'Neon woman' },
  { file: 'portrait-man.jpg', label: 'Convertible man' },
  { file: 'boulevard.jpg', label: 'Boulevard' },
  { file: 'pier.jpg', label: 'Pier sunset' },
];

const state = {
  layout: 'triptych',
  grade: 'sunset',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  panels: [
    { photo: null, name: 'Hero', pan: { x: 0, y: 0 }, zoom: 1 },
    { photo: null, name: 'Panel 2', pan: { x: 0, y: 0 }, zoom: 1 },
    { photo: null, name: 'Panel 3', pan: { x: 0, y: 0 }, zoom: 1 },
  ],
};
let selected = 0;
let dragging = null;

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function redraw() {
  renderCover(ctx, state, canvas.width, canvas.height);
}

function panelThumb(panel) {
  if (!panel.photo) return '';
  return panel.photo.currentSrc || panel.photo.src || '';
}

function rebuildPanelList() {
  panelList.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `panel-card${i === selected ? ' sel' : ''}`;
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.src = panelThumb(panel) || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const meta = document.createElement('span');
    meta.className = 'meta';
    const name = document.createElement('b');
    name.textContent = panel.name;
    const detail = document.createElement('span');
    detail.textContent = panel.photo ? (panel.fileName || 'photo loaded') : 'empty — upload or pick a sample';
    meta.append(name, detail);
    card.append(thumb, meta);
    card.addEventListener('click', () => {
      selected = i;
      zoomInput.value = String(Math.round((state.panels[i].zoom || 1) * 100));
      rebuildPanelList();
    });
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.setAttribute('aria-label', `Upload photo for ${panel.name}`);
    file.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const url = URL.createObjectURL(f);
        panel.photo = await loadImage(url);
        panel.fileName = f.name;
        panel.pan = { x: 0, y: 0 };
        panel.zoom = 1;
        status.textContent = `${f.name} loaded into ${panel.name}.`;
        redraw();
        rebuildPanelList();
      } catch {
        status.textContent = 'That file could not be read as an image.';
      }
    });
    card.addEventListener('dblclick', () => file.click());
    const uploadBtn = document.createElement('span');
    uploadBtn.className = 'upload-link';
    uploadBtn.textContent = 'Upload';
    uploadBtn.addEventListener('click', (ev) => { ev.stopPropagation(); file.click(); });
    meta.append(uploadBtn);
    card.append(file);
    panelList.append(card);
  });
}

function pickChoice(container, attr, value, apply) {
  container.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('picked', b.dataset[attr] === value);
  });
  apply(value);
}

document.getElementById('layoutChoices').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-layout]');
  if (!b || !LAYOUTS.includes(b.dataset.layout)) return;
  pickChoice(e.currentTarget, 'layout', b.dataset.layout, (v) => { state.layout = v; });
  redraw();
});
document.getElementById('gradeChoices').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-grade]');
  if (!b || !GRADES.includes(b.dataset.grade)) return;
  pickChoice(e.currentTarget, 'grade', b.dataset.grade, (v) => { state.grade = v; });
  redraw();
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  const panel = state.panels[selected];
  panel.zoom = Number(zoomInput.value) / 100;
  redraw();
});

SAMPLES.forEach((sample) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = `Load sample: ${sample.label}`;
  const img = document.createElement('img');
  img.src = `samples/${sample.file}`;
  img.alt = sample.label;
  b.append(img);
  b.addEventListener('click', async () => {
    try {
      const panel = state.panels[selected];
      panel.photo = await loadImage(`samples/${sample.file}`);
      panel.fileName = sample.label;
      panel.pan = { x: 0, y: 0 };
      panel.zoom = 1;
      zoomInput.value = '100';
      status.textContent = `${sample.label} loaded into ${panel.name}.`;
      redraw();
      rebuildPanelList();
    } catch {
      status.textContent = 'Sample could not be loaded.';
    }
  });
  sampleRow.append(b);
});

// Drag on the canvas pans the photo inside the panel under the pointer.
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const fx = (clientX - box.left) / box.width;
  const fy = (clientY - box.top) / box.height;
  const rects = layoutRects(state.layout, state.panels.length);
  for (let i = 0; i < rects.length; i++) {
    const [x, y, w, h] = rects[i];
    if (fx >= x && fx <= x + w && fy >= y && fy <= y + h) return i;
  }
  return -1;
}
canvas.addEventListener('pointerdown', (e) => {
  const i = panelAt(e.clientX, e.clientY);
  if (i < 0) return;
  selected = i;
  zoomInput.value = String(Math.round((state.panels[i].zoom || 1) * 100));
  rebuildPanelList();
  dragging = { index: i, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const panel = state.panels[dragging.index];
  const box = canvas.getBoundingClientRect();
  panel.pan.x += ((e.clientX - dragging.x) / box.width) * 2.4;
  panel.pan.y += ((e.clientY - dragging.y) / box.height) * 2.4;
  panel.pan.x = Math.max(-1, Math.min(1, panel.pan.x));
  panel.pan.y = Math.max(-1, Math.min(1, panel.pan.y));
  dragging.x = e.clientX;
  dragging.y = e.clientY;
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });
canvas.addEventListener('pointercancel', () => { dragging = null; });

function exportPng(w, h, filename) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), state, w, h);
  off.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed — please try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved ${filename} (${w} × ${h}).`;
  }, 'image/png');
}
document.getElementById('exportSquare').addEventListener('click', () => exportPng(1080, 1080, 'vice-cover-1080x1080.png'));
document.getElementById('exportPortrait').addEventListener('click', () => exportPng(1080, 1350, 'vice-cover-1080x1350.png'));
document.getElementById('exportWide').addEventListener('click', () => exportPng(1920, 1080, 'vice-cover-1920x1080.png'));

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, {
    setState(next) {
      Object.assign(state, next);
      titleInput.value = state.title;
      subtitleInput.value = state.subtitle;
      zoomInput.value = String(Math.round((state.panels[selected].zoom || 1) * 100));
      rebuildPanelList();
      redraw();
    },
    loadImage,
    redraw,
  });
} else {
  // First paint: hero panel gets the neon woman sample so the studio
  // opens on a finished-looking cover, not an empty grid.
  loadImage('samples/portrait-woman.jpg').then((img) => {
    state.panels[0].photo = img;
    state.panels[0].fileName = 'Neon woman';
    redraw();
    rebuildPanelList();
  }).catch(() => {
    redraw();
    rebuildPanelList();
  });
  rebuildPanelList();
  redraw();
}
