// Vice Cover Studio — the editor wiring.
//
// Owns the page state (one photo slot per panel, each with its own pan and
// zoom), the controls beside the preview, and the export buttons. The actual
// drawing lives in cover.js; this file only decides *what* to draw and when.
// A `?shot=` query sets up a fixed scene for a screenshot instead (shots.js).

import { GRADES, LAYOUTS, SIZES, autoPanFor, exportCanvas, layoutPanels, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const uploadInput = document.getElementById('upload');
const zoomInput = document.getElementById('zoom');
const status = document.getElementById('status');

const SAMPLES = [
  { file: 'portrait-woman.jpg', label: 'Woman portrait' },
  { file: 'portrait-man.jpg', label: 'Man portrait' },
  { file: 'boulevard.jpg', label: 'Boulevard' },
  { file: 'pier.jpg', label: 'Pier' },
];

/** One slot per panel: the photo, its pan (fractions of the panel) and zoom. */
export function blankPanels() {
  return [0, 1, 2, 3].map(() => ({ img: null, panX: 0, panY: 0, zoom: 1 }));
}

export const state = {
  layout: 'triptych',
  grade: 'sunset',
  size: 'square',
  title: titleInput.value,
  subtitle: subtitleInput.value,
  panels: blankPanels(),
};

let selected = 0;

function redraw() {
  // A cover scene never shows the editor's selection outline.
  const showSelection = !document.body.classList.contains('shot-cover');
  renderCover(canvas, state, showSelection ? { selected } : {});
}

function resizePreview() {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  redraw();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSample(file) {
  return loadImage(`samples/${file}`);
}

function selectPanel(i) {
  selected = i;
  zoomInput.value = String(state.panels[selected].zoom);
  document.querySelectorAll('.panel-tab').forEach((tab, j) => {
    tab.setAttribute('aria-selected', String(j === selected));
  });
  document.querySelectorAll('.samples button').forEach((btn) => {
    const file = btn.dataset.file;
    btn.setAttribute('aria-pressed', String(state.panels[selected].img?.dataset?.file === file));
  });
  redraw();
}

function setPhoto(index, img, file) {
  if (file) img.dataset.file = file;
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const pan = rects[index] ? autoPanFor(img, rects[index]) : { panX: 0, panY: 0 };
  state.panels[index] = { img, panX: pan.panX, panY: pan.panY, zoom: 1 };
  selectPanel(index);
}

/* ---- control panels ---- */

const panelTabs = document.getElementById('panelTabs');

/** Rebuilds the panel tabs for the current layout (3 or 4 panels). */
function buildPanelTabs() {
  const count = LAYOUTS[state.layout].panels;
  panelTabs.replaceChildren();
  for (let i = 0; i < count; i++) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'panel-tab';
    tab.textContent = `Panel ${i + 1}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(i === selected));
    tab.addEventListener('click', () => selectPanel(i));
    panelTabs.appendChild(tab);
  }
}
buildPanelTabs();

const samplesBox = document.getElementById('samples');
for (const sample of SAMPLES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.file = sample.file;
  btn.setAttribute('aria-pressed', 'false');
  btn.title = sample.label;
  const img = document.createElement('img');
  img.src = `samples/${sample.file}`;
  img.alt = sample.label;
  btn.appendChild(img);
  btn.addEventListener('click', async () => {
    try {
      setPhoto(selected, await loadSample(sample.file), sample.file);
    } catch {
      status.textContent = 'That sample could not be loaded.';
    }
  });
  samplesBox.appendChild(btn);
}

const layoutBox = document.getElementById('layoutChoices');
for (const [key, layout] of Object.entries(LAYOUTS)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = layout.label;
  btn.setAttribute('aria-pressed', String(key === state.layout));
  btn.addEventListener('click', () => {
    state.layout = key;
    selected = Math.min(selected, layout.panels - 1);
    buildPanelTabs();
    layoutBox.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    selectPanel(selected);
  });
  layoutBox.appendChild(btn);
}

const gradeBox = document.getElementById('gradeChoices');
for (const [key, grade] of Object.entries(GRADES)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = grade.label;
  btn.setAttribute('aria-pressed', String(key === state.grade));
  btn.addEventListener('click', () => {
    state.grade = key;
    gradeBox.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    redraw();
  });
  gradeBox.appendChild(btn);
}

const sizeBox = document.getElementById('sizeChoices');
for (const [key, size] of Object.entries(SIZES)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = size.label;
  btn.setAttribute('aria-pressed', String(key === state.size));
  btn.addEventListener('click', () => {
    state.size = key;
    sizeBox.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
    resizePreview();
  });
  sizeBox.appendChild(btn);
}

/* ---- photo input: upload, pan, zoom ---- */

uploadInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const img = await loadImage(URL.createObjectURL(file));
    setPhoto(selected, img, null);
    status.textContent = 'Photo loaded — drag it to position, then export.';
  } catch {
    status.textContent = 'That file could not be read as a photo.';
  }
  uploadInput.value = '';
});

document.getElementById('fillAll').addEventListener('click', () => {
  const source = state.panels[selected].img;
  if (!source) {
    status.textContent = 'Give the selected panel a photo first.';
    return;
  }
  state.panels = state.panels.map(() => ({ img: source, panX: 0, panY: 0, zoom: 1 }));
  status.textContent = 'One photo now fills every panel.';
  redraw();
});

document.getElementById('resetPan').addEventListener('click', () => {
  const panel = state.panels[selected];
  panel.panX = 0;
  panel.panY = 0;
  panel.zoom = 1;
  zoomInput.value = '1';
  redraw();
});

zoomInput.addEventListener('input', () => {
  state.panels[selected].zoom = Number(zoomInput.value);
  redraw();
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  redraw();
});

subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});

/** Which panel, if any, sits under a point on the preview canvas. */
export function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

let dragging = null;
canvas.addEventListener('pointerdown', (event) => {
  const hit = panelAt(event.clientX, event.clientY);
  if (hit === -1) return;
  selectPanel(hit);
  dragging = { x: event.clientX, y: event.clientY, panel: hit };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const box = canvas.getBoundingClientRect();
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[dragging.panel];
  const panel = state.panels[dragging.panel];
  panel.panX += ((event.clientX - dragging.x) / box.width) * (canvas.width / rect.w);
  panel.panY += ((event.clientY - dragging.y) / box.height) * (canvas.height / rect.h);
  panel.panX = Math.max(-0.9, Math.min(0.9, panel.panX));
  panel.panY = Math.max(-0.9, Math.min(0.9, panel.panY));
  dragging = { x: event.clientX, y: event.clientY, panel: dragging.panel };
  redraw();
});

canvas.addEventListener('pointerup', () => {
  dragging = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const panel = state.panels[selected];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (event.deltaY < 0 ? 1.08 : 0.93)));
  zoomInput.value = String(panel.zoom);
  redraw();
}, { passive: false });

/* ---- export ---- */

function exportPng(sizeKey, filename) {
  const out = exportCanvas(state, sizeKey);
  out.toBlob((blob) => {
    if (!blob) {
      status.textContent = 'Export failed — try again.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved ${filename}`;
  }, 'image/png');
}

document.getElementById('exportSquare').addEventListener('click', () => {
  exportPng('square', 'vice-cover-1080x1080.png');
});
document.getElementById('exportPortrait').addEventListener('click', () => {
  exportPng('portrait', 'vice-cover-1080x1350.png');
});
document.getElementById('exportWide').addEventListener('click', () => {
  exportPng('wide', 'vice-cover-1920x1080.png');
});

/* ---- start ---- */

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { loadSample, setPhoto, selectPanel, redraw, resizePreview, state, titleInput, subtitleInput });
} else {
  selectPanel(0);
  resizePreview();
}
