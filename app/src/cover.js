// Vice Cover Studio — canvas renderer.
//
// Draws everything the cover shows: a procedural Vice City backdrop
// (synthwave sun, skyline, palms, grid horizon), the photo panels, the
// colour grade and the caption lettering. Every pixel is drawn in code or
// comes from the user's own photos / the bundled samples — no Rockstar
// logos, artwork or fonts anywhere.
//
// The renderer is pure canvas 2D and deterministic: the same state always
// paints the same bytes, so an exported PNG can be reproduced exactly.

export const EXPORT_SIZES = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  wide: [1920, 1080],
};

export const LAYOUTS = ['triptych', 'comic', 'heroDuo', 'quad'];
export const GRADES = ['sunset', 'neon', 'golden', 'noir'];

// A grade is a sky palette, a sun palette, a wash colour laid over the
// finished cover, and a per-photo tint. Noir desaturates the photos first.
export const GRADE_DEFS = {
  sunset: {
    sky: ['#1d0b3d', '#6d28a8', '#e0397e', '#ff7a3d', '#ffb02e'],
    sun: ['#fff3b0', '#ffd166', '#ff5c8a'],
    wash: '#ff5c8a', washAlpha: 0.10, photoTint: '#ff7a3d', photoAlpha: 0.16,
  },
  neon: {
    sky: ['#0b0626', '#2b0a5e', '#a4138e', '#ff2e88', '#2de2ff'],
    sun: ['#e8fbff', '#2de2ff', '#ff2e88'],
    wash: '#b537f2', washAlpha: 0.12, photoTint: '#2de2ff', photoAlpha: 0.18,
  },
  golden: {
    sky: ['#241232', '#7a2d12', '#c85a17', '#f59e0b', '#fde68a'],
    sun: ['#fffbeb', '#fde68a', '#f59e0b'],
    wash: '#f59e0b', washAlpha: 0.10, photoTint: '#fbbf24', photoAlpha: 0.15,
  },
  noir: {
    sky: ['#050505', '#1a1a1a', '#3f3f46', '#71717a', '#a1a1aa'],
    sun: ['#fafafa', '#d4d4d8', '#a1a1aa'],
    wash: '#000000', washAlpha: 0.08, photoTint: '#ffffff', photoAlpha: 0.0,
  },
};

// Deterministic pseudo-random numbers so the skyline never changes shape
// between runs of the same cover.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Panel rectangles for each layout, in fractions of the cover size.
// `gap` is the gutter between panels, in pixels at the target size.
export function layoutRects(layout, w, h) {
  const gap = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  const full = { x: 0, y: 0, w, h };
  switch (layout) {
    case 'comic': {
      const pw = (w - gap * 2) / 3;
      return [0, 1, 2].map((i) => ({ x: i * (pw + gap), y: 0, w: pw, h }));
    }
    case 'heroDuo': {
      const topH = Math.round(h * 0.60);
      const bw = (w - gap) / 2;
      return [
        { x: 0, y: 0, w, h: topH },
        { x: 0, y: topH + gap, w: bw, h: h - topH - gap },
        { x: bw + gap, y: topH + gap, w: bw, h: h - topH - gap },
      ];
    }
    case 'quad': {
      const cw = (w - gap) / 2;
      const ch = (h - gap) / 2;
      return [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + gap, y: 0, w: cw, h: ch },
        { x: 0, y: ch + gap, w: cw, h: ch },
        { x: cw + gap, y: ch + gap, w: cw, h: ch },
      ];
    }
    case 'triptych':
    default: {
      const heroW = Math.round(w * 0.56);
      const sideW = w - heroW - gap;
      const sideH = (h - gap) / 2;
      return [
        { x: 0, y: 0, w: heroW, h },
        { x: heroW + gap, y: 0, w: sideW, h: sideH },
        { x: heroW + gap, y: sideH + gap, w: sideW, h: sideH },
      ];
    }
  }
  return [full];
}

function clipPanel(ctx, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(18, r.w * 0.02));
  } else {
    ctx.rect(r.x, r.y, r.w, r.h);
  }
  ctx.clip();
}

function drawSun(ctx, cx, cy, radius, grade) {
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.9);
  glow.addColorStop(0, grade.sun[1] + '55');
  glow.addColorStop(1, grade.sun[1] + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius * 2, cy - radius * 2, radius * 4, radius * 4);

  const disc = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  disc.addColorStop(0, grade.sun[0]);
  disc.addColorStop(0.55, grade.sun[1]);
  disc.addColorStop(1, grade.sun[2]);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Synthwave stripes: sky-coloured bars cut across the sun's lower half,
  // growing thicker towards the bottom.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grade.sky[0];
  let y = cy + radius * 0.05;
  let thick = Math.max(2, radius * 0.03);
  while (y < cy + radius) {
    ctx.fillRect(cx - radius, y, radius * 2, thick);
    y += thick + Math.max(6, radius * 0.10);
    thick *= 1.45;
  }
  ctx.restore();
}

function drawSkyline(ctx, w, horizonY, grade, seed, scale, colour) {
  const rand = mulberry32(seed);
  ctx.fillStyle = colour;
  let x = -10;
  while (x < w + 10) {
    const bw = (0.03 + rand() * 0.06) * w * scale;
    const bh = (0.06 + rand() * 0.20) * horizonY;
    const top = horizonY - bh;
    ctx.fillRect(x, top, bw, bh);
    // Aerial or antenna on some towers.
    if (rand() > 0.72) {
      ctx.fillRect(x + bw / 2 - 1, top - bh * 0.18, 2, bh * 0.18);
    }
    // Lit windows: a sparse scatter of warm dots.
    if (rand() > 0.35) {
      ctx.fillStyle = grade.sun[0];
      const rows = Math.floor(bh / 16);
      const cols = Math.floor(bw / 14);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (rand() > 0.82) {
            ctx.fillRect(x + 4 + c * 14, top + 6 + r * 16, 3, 4);
          }
        }
      }
      ctx.fillStyle = colour;
    }
    x += bw + rand() * 8;
  }
}

function drawPalm(ctx, x, baseY, size, colour) {
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(3, size * 0.06);
  ctx.lineCap = 'round';
  // Trunk: a gentle curve leaning right.
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + size * 0.12, baseY - size * 0.55, x + size * 0.22, baseY - size);
  ctx.stroke();
  const topX = x + size * 0.22;
  const topY = baseY - size;
  // Fronds: seven arcs fanning out from the crown.
  for (let i = 0; i < 7; i += 1) {
    const angle = Math.PI * (0.95 + (i / 6) * 1.1);
    const len = size * (0.55 + (i % 2) * 0.12);
    const ex = topX + Math.cos(angle) * len;
    const ey = topY + Math.sin(angle) * len * 0.55 + size * 0.12;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(angle) * len * 0.5,
      topY - size * 0.22,
      ex,
      ey,
    );
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(topX - 3, topY + 4, Math.max(2, size * 0.04), 0, Math.PI * 2);
  ctx.arc(topX + 4, topY + 5, Math.max(2, size * 0.04), 0, Math.PI * 2);
  ctx.fill();
}

function drawBackdrop(ctx, w, h, grade) {
  const horizonY = Math.round(h * 0.68);

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY + 1);

  // Stars in the upper sky.
  const stars = mulberry32(20261119);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 70; i += 1) {
    const sx = stars() * w;
    const sy = stars() * horizonY * 0.45;
    ctx.globalAlpha = 0.25 + stars() * 0.6;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Sun + skyline + palms.
  drawSun(ctx, w * 0.5, horizonY * 0.62, Math.min(w, h) * 0.21, grade);
  drawSkyline(ctx, w, horizonY, grade, 7, 1, grade.sky[1]);
  drawSkyline(ctx, w, horizonY, grade, 21, 1, grade.sky[0]);
  const palmSize = Math.min(w, h) * 0.16;
  drawPalm(ctx, w * 0.07, horizonY + 2, palmSize, grade.sky[0]);
  drawPalm(ctx, w * 0.90, horizonY + 2, palmSize * 0.85, grade.sky[0]);
  drawPalm(ctx, w * 0.97, horizonY + 2, palmSize * 0.6, grade.sky[0]);

  // Grid floor below the horizon: receding lines plus horizontal lines
  // that bunch up near the horizon and spread out towards the viewer.
  const floor = ctx.createLinearGradient(0, horizonY, 0, h);
  floor.addColorStop(0, grade.sky[1]);
  floor.addColorStop(1, grade.sky[0]);
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  ctx.strokeStyle = grade.sun[1] + '66';
  ctx.lineWidth = Math.max(1, w * 0.0012);
  const vanishingX = w * 0.5;
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(vanishingX + i * w * 0.05, horizonY);
    ctx.lineTo(vanishingX + i * w * 0.22, h);
    ctx.stroke();
  }
  let gy = horizonY + 4;
  let step = 5;
  while (gy < h) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    gy += step;
    step *= 1.55;
  }
}

function drawPhotoPanel(ctx, img, rect, pan, zoom, grade, noir) {
  ctx.save();
  clipPanel(ctx, rect);
  if (!img) {
    // Empty slot: a dark placeholder so the layout still reads.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, '#2a1747');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `700 ${Math.max(14, rect.w * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    ctx.restore();
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * (zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const slackX = Math.max(0, (dw - rect.w) / 2);
  const slackY = Math.max(0, (dh - rect.h) / 2);
  const dx = rect.x + (rect.w - dw) / 2 + (pan?.x || 0) * slackX;
  const dy = rect.y + (rect.h - dh) / 2 + (pan?.y || 0) * slackY;
  ctx.filter = noir ? 'grayscale(1) contrast(1.15)' : 'none';
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // Per-photo grade tint.
  if (grade.photoAlpha > 0) {
    ctx.globalAlpha = grade.photoAlpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grade.photoTint;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // Panel edge: a bright hairline and a soft inner shade.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, rect.w * 0.008);
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  const shade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawLettering(ctx, w, h, title, subtitle, grade) {
  const bandH = h * 0.20;
  const band = ctx.createLinearGradient(0, h - bandH, 0, h);
  band.addColorStop(0, 'rgba(8,2,18,0)');
  band.addColorStop(1, 'rgba(8,2,18,0.72)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - bandH, w, bandH);

  const pad = w * 0.035;
  const titleSize = Math.min(w * 0.105, (h * 0.62) / 1.1);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const titleFont = `${titleSize}px Anton, "Arial Narrow", sans-serif`;
  ctx.font = titleFont;
  // Measure and shrink the title until it fits the width.
  let size = titleSize;
  while (ctx.measureText(title).width > w - pad * 2 && size > 18) {
    size *= 0.94;
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  }
  const titleY = h - pad * 0.9;
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.09);
  ctx.strokeStyle = '#16081f';
  ctx.strokeText(title, pad, titleY);
  const fill = ctx.createLinearGradient(0, titleY - size, 0, titleY);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.7, '#ffe9a8');
  fill.addColorStop(1, grade.sun[1]);
  ctx.fillStyle = fill;
  ctx.fillText(title, pad, titleY);
  ctx.restore();

  if (subtitle && subtitle.trim()) {
    const subSize = Math.max(13, size * 0.24);
    ctx.save();
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${subSize * 0.32}px`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = Math.max(2, subSize * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,2,20,0.9)';
    ctx.fillStyle = grade.sun[0];
    const subY = titleY - size * 1.08;
    ctx.strokeText(subtitle.toUpperCase(), pad, subY);
    ctx.fillText(subtitle.toUpperCase(), pad, subY);
    ctx.restore();
  }
}

// Paint a full cover onto `canvas` (resized in place) from a state object:
// { photos: HTMLImageElement[], layout, grade, title, subtitle,
//   pans: [{x,y}], zooms: [number] }.
export function renderCover(canvas, state) {
  const size = state.size || [1080, 1080];
  const w = size[0];
  const h = size[1];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grade = GRADE_DEFS[state.grade] || GRADE_DEFS.sunset;
  const noir = state.grade === 'noir';

  drawBackdrop(ctx, w, h, grade);

  const rects = layoutRects(state.layout || 'triptych', w, h);
  rects.forEach((rect, i) => {
    drawPhotoPanel(
      ctx,
      state.photos?.[i] || null,
      rect,
      state.pans?.[i],
      state.zooms?.[i] || 1,
      grade,
      noir,
    );
  });

  // Grade wash over the whole cover, then a vignette to hold the edges.
  ctx.save();
  ctx.globalAlpha = grade.washAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  drawLettering(
    ctx, w, h,
    (state.title || 'VICE HEIST').toUpperCase(),
    state.subtitle || '',
    grade,
  );
  return canvas;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load image: ${src}`));
    img.src = src;
  });
}

// Render a state at an export size and trigger a PNG download in the page.
export async function exportCover(state, sizeKey, fileName) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES.square;
  const off = document.createElement('canvas');
  renderCover(off, { ...state, size });
  const blob = await new Promise((resolve, reject) => {
    off.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || `vice-cover-${sizeKey}-${size[0]}x${size[1]}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return blob;
}
