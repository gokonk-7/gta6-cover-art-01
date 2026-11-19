// Vice Cover Studio — the editor wiring.
//
// Owns the page state (layout, grade, size, caption, one photo per panel),
// the controls that change it, drag-to-pan on the preview canvas, and the
// PNG export buttons. The drawing itself lives in cover.js.

import { SIZES, LAYOUTS, GRADES, layoutRects, renderCover, renderToCanvas } from './cover.js';
import { runShot } from './shots.js';

export const SAMPLES = [
  { id: 'portrait-woman', label: 'Woman · neon portrait' },
  { id: 'portrait-man', label: 'Man · convertible sunset' },
  { id: 'boulevard', label: 'Boulevard · palm avenue' },
  { id: 'pier', label: 'Pier · dusk waterfront' },
];

const DEFAULT_PANELS = ['portrait-woman', 'portrait-man', 'boulevard', 'pier'];

const state = {
  layout: 'triptych',
  grade: 'sunset',
  size: 'square',
  title: 'NEON HEAT',
  subtitle: 'Sunset heist on Ocean Drive',
  panels: [],
};

let activePanel = 0;
let fontsReady = false;

const preview = document.getElementById('preview');
const statusEl = document.getElementById('status');
const panelsEl = document.getElementById('panels');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
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

async function loadSample(id) {
  return loadImage(`samples/${id}.jpg`);
}

/** Makes sure every panel slot has a photo, topping up from the defaults. */
async function ensurePanels() {
  const count = LAYOUTS[state.layout].panels;
  while (state.panels.length < count) {
    const slot = state.panels.length;
    const sample = DEFAULT_PANELS[slot % DEFAULT_PANELS.length];
    let image = null;
    try { image = await loadSample(sample); } catch { /* leave the slot empty */ }
    state.panels.push({ sample, image, zoom: 1, ox: 0.5, oy: 0.5 });
  }
  state.panels.length = count;
  if (activePanel >= count) activePanel = 0;
}

function currentSize() {
  return SIZES[state.size];
}

export function redraw() {
  const { width, height } = currentSize();
  renderCover(preview, state, width, height);
}

function markActiveButtons(group, value) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach((button) => {
    button.classList.toggle('active', button.dataset.value === value);
  });
}

function buildPanelRows() {
  panelsEl.innerHTML = '';
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i];
    const row = document.createElement('div');
    row.className = 'panel-row';
    if (i === activePanel) row.classList.add('active');
    row.dataset.index = String(i);

    const head = document.createElement('div');
    head.className = 'panel-head';
    const name = document.createElement('span');
    name.textContent = `Panel ${i + 1}`;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'mini';
    pick.textContent = 'Select';
    pick.addEventListener('click', () => { activePanel = i; buildPanelRows(); redraw(); });
    head.append(name, pick);
    row.append(head);

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Photo for panel ${i + 1}`);
    for (const sample of SAMPLES) {
      const option = document.createElement('option');
      option.value = sample.id;
      option.textContent = sample.label;
      if (panel.sample === sample.id) option.selected = true;
      select.append(option);
    }
    const uploadOption = document.createElement('option');
    uploadOption.value = '__upload';
    uploadOption.textContent = 'Upload your own photo…';
    select.append(uploadOption);
    select.addEventListener('change', async () => {
      if (select.value === '__upload') {
        fileInput.dataset.panel = String(i);
        fileInput.click();
        select.value = panel.sample ?? SAMPLES[0].id;
        return;
      }
      activePanel = i;
      panel.sample = select.value;
      try {
        panel.image = await loadSample(select.value);
        panel.zoom = 1;
        panel.ox = 0.5;
        panel.oy = 0.5;
      } catch { setStatus(`Could not load ${select.value}.`); }
      buildPanelRows();
      redraw();
    });
    row.append(select);

    const zoomLabel = document.createElement('label');
    zoomLabel.className = 'zoom-label';
    zoomLabel.textContent = 'Zoom';
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '2.5';
    zoom.step = '0.05';
    zoom.value = String(panel.zoom ?? 1);
    zoom.setAttribute('aria-label', `Zoom for panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      activePanel = i;
      panel.zoom = Number(zoom.value);
      redraw();
    });
    zoomLabel.append(zoom);
    row.append(zoomLabel);

    const panHint = document.createElement('p');
    panHint.className = 'hint';
    panHint.textContent = 'Drag the photo on the canvas to reposition it.';
    row.append(panHint);

    panelsEl.append(row);
  }
}

const fileInput = document.getElementById('upload');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const i = Number(fileInput.dataset.panel ?? activePanel);
  const panel = state.panels[i];
  if (!panel) return;
  try {
    const url = URL.createObjectURL(file);
    panel.image = await loadImage(url);
    panel.sample = null;
    panel.zoom = 1;
    panel.ox = 0.5;
    panel.oy = 0.5;
    activePanel = i;
    setStatus(`Loaded ${file.name} into panel ${i + 1}.`);
  } catch {
    setStatus('That file could not be read as a photo.');
  }
  fileInput.value = '';
  buildPanelRows();
  redraw();
});

function bindChoiceGroup(group, onPick) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach((button) => {
    button.addEventListener('click', async () => {
      await onPick(button.dataset.value);
      markActiveButtons(group, button.dataset.value);
    });
  });
}

bindChoiceGroup('layout', async (value) => {
  state.layout = value;
  await ensurePanels();
  buildPanelRows();
  redraw();
});

bindChoiceGroup('grade', async (value) => {
  state.grade = value;
  redraw();
});

bindChoiceGroup('size', async (value) => {
  state.size = value;
  redraw();
});

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});

document.querySelectorAll('[data-export]').forEach((button) => {
  button.addEventListener('click', () => {
    const size = SIZES[button.dataset.export];
    const canvas = renderToCanvas(state, size.width, size.height);
    canvas.toBlob((blob) => {
      if (!blob) { setStatus('Export failed — try again.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${size.width}x${size.height}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus(`Saved vice-cover-${size.width}x${size.height}.png`);
    }, 'image/png');
  });
});

/** Drag-to-pan: grab a panel's photo on the canvas and slide it around. */
let drag = null;
function canvasPoint(event) {
  const box = preview.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (preview.width / box.width),
    y: (event.clientY - box.top) * (preview.height / box.height),
    scale: preview.width / box.width,
  };
}

preview.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const rects = layoutRects(state.layout, preview.width, preview.height);
  const hit = rects.findIndex((r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h);
  if (hit === -1) return;
  const panel = state.panels[hit];
  if (!panel?.image) return;
  activePanel = hit;
  buildPanelRows();
  drag = { index: hit, startX: point.x, startY: point.y, ox: panel.ox, oy: panel.oy, scale: point.scale };
  preview.setPointerCapture(event.pointerId);
  preview.style.cursor = 'grabbing';
});

preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const panel = state.panels[drag.index];
  const rect = layoutRects(state.layout, preview.width, preview.height)[drag.index];
  const img = panel.image;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const sw = img.naturalWidth * base * panel.zoom;
  const sh = img.naturalHeight * base * panel.zoom;
  const overflowX = sw - rect.w;
  const overflowY = sh - rect.h;
  if (overflowX > 1) panel.ox = Math.min(1, Math.max(0, drag.ox + (point.x - drag.startX) / overflowX));
  if (overflowY > 1) panel.oy = Math.min(1, Math.max(0, drag.oy + (point.y - drag.startY) / overflowY));
  redraw();
});

function endDrag() {
  drag = null;
  preview.style.cursor = 'grab';
}
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);

/** The small API shots.js uses to stage a fixed scene for a screenshot. */
export const shotApi = {
  state,
  redraw,
  async setLayout(value) {
    state.layout = value;
    await ensurePanels();
    buildPanelRows();
    markActiveButtons('layout', value);
  },
  setGrade(value) {
    state.grade = value;
    markActiveButtons('grade', value);
  },
  setSize(value) {
    state.size = value;
    markActiveButtons('size', value);
  },
  setTitle(value) { state.title = value; document.getElementById('title').value = value; },
  setSubtitle(value) { state.subtitle = value; document.getElementById('subtitle').value = value; },
  async setPanelSample(i, sampleId) {
    await ensurePanels();
    const panel = state.panels[i];
    if (!panel) return;
    panel.sample = sampleId;
    panel.image = await loadSample(sampleId);
    panel.zoom = 1;
    panel.ox = 0.5;
    panel.oy = 0.5;
    buildPanelRows();
  },
  /** Nudges a panel's crop window (ox/oy 0..1) — used by shot scenes to keep faces in frame. */
  setPanelPan(i, ox, oy) {
    const panel = state.panels[i];
    if (!panel) return;
    if (typeof ox === 'number') panel.ox = Math.min(1, Math.max(0, ox));
    if (typeof oy === 'number') panel.oy = Math.min(1, Math.max(0, oy));
  },
};

async function boot() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
    fontsReady = true;
  } catch {
    fontsReady = false;
  }
  await ensurePanels();
  buildPanelRows();
  markActiveButtons('layout', state.layout);
  markActiveButtons('grade', state.grade);
  markActiveButtons('size', state.size);
  redraw();
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, shotApi);
  } else {
    window.__shotReady = true;
  }
}

boot();
