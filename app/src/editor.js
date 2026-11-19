// Vice Cover Studio — editor wiring.
//
// Owns the page state (layout, grade, size, caption, one photo slot per
// panel), the controls panel, drag-to-pan and scroll-to-zoom on the preview
// canvas, and the PNG export buttons. The drawing itself lives in cover.js;
// this file only decides what to draw and when.
//
// A `?shot=` query switches the page into a fixed scene for screenshots
// (see shots.js) instead of the interactive editor.

import { GRADES, LAYOUTS, SIZES, layoutPanels, makeCoverCanvas, panelCount, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const panelList = document.getElementById('panel-list');
const panelCountEl = document.getElementById('panel-count');

const SAMPLES = [
  { id: 'portrait-woman', label: 'Woman' },
  { id: 'portrait-man', label: 'Man' },
  { id: 'boulevard', label: 'Boulevard' },
  { id: 'pier', label: 'Pier' },
];

// The pool holds one slot per panel of the biggest layout (quad, 4 panels);
// smaller layouts just use the first slots, so switching layouts never
// loses a photo a panel already had.
const pool = Array.from({ length: 4 }, () => ({
  image: null, zoom: 1, ox: 0, oy: 0, sample: null,
}));

const state = {
  layout: 'triptych',
  grade: 'sunset',
  sizeKey: 'square',
  title: 'SUNSET HEIST',
  subtitle: 'LEONIDA • 2026',
};

let activePanel = 0;
let fontsReady = false;

function currentPanels() {
  return pool.slice(0, panelCount(state.layout));
}

function coverState() {
  return {
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    panels: currentPanels(),
  };
}

function previewPixels() {
  const size = SIZES[state.sizeKey];
  const long = 900;
  const scale = long / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function renderPreview() {
  const px = previewPixels();
  if (canvas.width !== px.w || canvas.height !== px.h) {
    canvas.width = px.w;
    canvas.height = px.h;
  }
  renderCover(ctx, px.w, px.h, coverState());
}

function setStatus(text) {
  statusEl.textContent = text;
}

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

async function setPanelSample(index, id) {
  const slot = pool[index];
  try {
    slot.image = await loadSample(id);
    slot.sample = id;
    slot.zoom = 1;
    slot.ox = 0;
    slot.oy = 0;
    activePanel = index;
    buildPanelList();
    renderPreview();
    setStatus(`Panel ${index + 1}: sample “${id}” loaded.`);
  } catch {
    setStatus(`Could not load sample ${id}.`);
  }
}

function setPanelUpload(index, file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  loadImage(url)
    .then((img) => {
      const slot = pool[index];
      slot.image = img;
      slot.sample = null;
      slot.zoom = 1;
      slot.ox = 0;
      slot.oy = 0;
      activePanel = index;
      buildPanelList();
      renderPreview();
      setStatus(`Panel ${index + 1}: “${file.name}” loaded — drag it to position.`);
    })
    .catch(() => setStatus(`Could not read “${file.name}”.`));
}

function buildPanelList() {
  const count = panelCount(state.layout);
  panelCountEl.textContent = `— ${count} panel${count === 1 ? '' : 's'}`;
  panelList.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const slot = pool[i];
    const card = document.createElement('div');
    card.className = `panel-card${i === activePanel ? ' is-active' : ''}`;

    const head = document.createElement('div');
    head.className = 'panel-head';
    const name = document.createElement('span');
    name.textContent = `Panel ${i + 1}`;
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.textContent = 'Select';
    pick.addEventListener('click', () => {
      activePanel = i;
      buildPanelList();
      renderPreview();
    });
    head.append(name, pick);
    card.appendChild(head);

    const thumbs = document.createElement('div');
    thumbs.className = 'thumbs';
    for (const sample of SAMPLES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = sample.label;
      btn.className = slot.sample === sample.id ? 'is-active' : '';
      const img = document.createElement('img');
      img.src = `samples/${sample.id}.jpg`;
      img.alt = sample.label;
      btn.appendChild(img);
      btn.addEventListener('click', () => setPanelSample(i, sample.id));
      thumbs.appendChild(btn);
    }
    card.appendChild(thumbs);

    const uploadRow = document.createElement('div');
    uploadRow.className = 'upload-row';
    const label = document.createElement('label');
    label.textContent = 'Upload your photo';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      setPanelUpload(i, input.files[0]);
      input.value = '';
    });
    label.appendChild(input);
    uploadRow.appendChild(label);
    card.appendChild(uploadRow);

    const zoomRow = document.createElement('div');
    zoomRow.className = 'zoom-row';
    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom';
    const zoom = document.createElement('input');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '2.5';
    zoom.step = '0.05';
    zoom.value = String(slot.zoom);
    zoom.setAttribute('aria-label', `Zoom panel ${i + 1}`);
    zoom.addEventListener('input', () => {
      slot.zoom = Number(zoom.value);
      renderPreview();
    });
    zoomRow.append(zoomLabel, zoom);
    card.appendChild(zoomRow);

    panelList.appendChild(card);
  }
}

function buildChips(container, entries, current, onPick) {
  container.innerHTML = '';
  for (const [key, label] of Object.entries(entries)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip${key === current ? ' is-active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      onPick(key);
      buildChips(container, entries, key, onPick);
    });
    container.appendChild(btn);
  }
}

function setLayout(layout) {
  state.layout = layout;
  activePanel = 0;
  buildPanelList();
  renderPreview();
}

function setGrade(grade) {
  state.grade = grade;
  renderPreview();
}

function setSize(sizeKey) {
  state.sizeKey = sizeKey;
  document.querySelectorAll('.size-chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.size === sizeKey);
  });
  renderPreview();
}

function exportPng(sizeKey) {
  const size = SIZES[sizeKey];
  const cover = makeCoverCanvas(size.w, size.h, coverState());
  cover.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — please try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-cover-${size.w}x${size.h}.png (${size.w} × ${size.h}).`);
  }, 'image/png');
}

// ---- canvas interaction: click to select, drag to pan, wheel to zoom ----

function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = ((clientX - box.left) / box.width) * canvas.width;
  const y = ((clientY - box.top) / box.height) * canvas.height;
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const hit = rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  return { index: hit, x, y };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit.index === -1) return;
  activePanel = hit.index;
  buildPanelList();
  const slot = pool[hit.index];
  drag = { x: hit.x, y: hit.y, ox: slot.ox, oy: slot.oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const hit = panelAt(e.clientX, e.clientY);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[activePanel];
  const slot = pool[activePanel];
  slot.ox = drag.ox + ((hit.x - drag.x) / rect.w) * 4;
  slot.oy = drag.oy + ((hit.y - drag.y) / rect.h) * 4;
  slot.ox = Math.max(-1, Math.min(1, slot.ox));
  slot.oy = Math.max(-1, Math.min(1, slot.oy));
  renderPreview();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (hit.index === -1) return;
  e.preventDefault();
  const slot = pool[hit.index];
  slot.zoom = Math.max(1, Math.min(2.5, slot.zoom - Math.sign(e.deltaY) * 0.1));
  activePanel = hit.index;
  buildPanelList();
  renderPreview();
}, { passive: false });

// ---- wire the controls ----

buildChips(document.getElementById('layout-row'), LAYOUTS, state.layout, setLayout);
buildChips(document.getElementById('grade-row'), GRADES, state.grade, setGrade);
document.querySelectorAll('.size-chip').forEach((chip) => {
  chip.addEventListener('click', () => setSize(chip.dataset.size));
});
titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  renderPreview();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  renderPreview();
});
document.getElementById('fill-all').addEventListener('click', () => {
  const first = pool[0];
  if (!first.image) {
    setStatus('Load a photo into panel 1 first.');
    return;
  }
  for (let i = 1; i < 4; i += 1) {
    pool[i].image = first.image;
    pool[i].sample = first.sample;
    pool[i].zoom = first.zoom;
    pool[i].ox = first.ox;
    pool[i].oy = first.oy;
  }
  buildPanelList();
  renderPreview();
  setStatus('Panel 1 photo used in every panel.');
});
document.getElementById('export-square').addEventListener('click', () => exportPng('square'));
document.getElementById('export-portrait').addEventListener('click', () => exportPng('portrait'));
document.getElementById('export-wide').addEventListener('click', () => exportPng('wide'));

// ---- boot ----

buildPanelList();
renderPreview();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    async loadPhoto(name) {
      const img = await loadSample(name);
      return img;
    },
    applyPhoto(index, image, sampleId) {
      pool[index].image = image;
      pool[index].sample = sampleId;
      pool[index].zoom = 1;
      pool[index].ox = 0;
      pool[index].oy = 0;
    },
    applyCaption(title, subtitle) {
      state.title = title;
      state.subtitle = subtitle;
      titleInput.value = title;
      subtitleInput.value = subtitle;
    },
    applyLayout(layout) { state.layout = layout; },
    applyGrade(grade) { state.grade = grade; },
    applySize(sizeKey) { setSize(sizeKey); },
    refresh() {
      buildPanelList();
      renderPreview();
    },
    async fontsReady() {
      if (!fontsReady) {
        try {
          await document.fonts.load('80px Anton');
          await document.fonts.ready;
        } catch {
          // Anton missing still renders with the fallback sans.
        }
        fontsReady = true;
      }
    },
  });
} else {
  document.fonts.load('80px Anton').then(() => {
    fontsReady = true;
    renderPreview();
  }).catch(() => {});
}
