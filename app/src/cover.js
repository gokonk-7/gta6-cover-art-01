// Vice Cover Studio — the cover renderer.
//
// Everything on the cover is drawn on one canvas, from scratch, in this
// file: a procedural neon-city backdrop (sunset sky, striped synthwave sun,
// skyline and palm silhouettes, perspective grid), the photo panels, the
// colour grades and the bold caption lettering. No image is fetched for the
// backdrop — it is all canvas shapes, so the cover looks the same offline.
//
// A cover is split vertically into three bands: a sky band on top (about
// 17% of the height), the photo panels in the middle, and a caption band at
// the foot (about 20%). The four layouts only change how the middle band is
// divided; the four grades only change the palette and the per-photo tint.

/** A tiny deterministic random source, so the skyline never changes shape. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRADES = {
  sunset: {
    label: 'Sunset',
    photoFilter: 'saturate(1.35) contrast(1.06) brightness(1.02)',
    washTop: 'rgba(255,46,136,0.10)',
    washBottom: 'rgba(255,122,60,0.22)',
    sky: ['#150829', '#5c1a63', '#c2277e', '#ff6a3d'],
    sun: ['#fff3a3', '#ffb03c', '#ff2e88'],
    skylineBack: '#3d1450',
    skylineFront: '#170a26',
    grid: '#ff2e88',
    accent: '#ff2e88',
    band: ['rgba(26,6,38,0.0)', 'rgba(26,6,38,0.88)'],
  },
  neon: {
    label: 'Neon',
    photoFilter: 'saturate(1.7) contrast(1.12) hue-rotate(-10deg)',
    washTop: 'rgba(34,211,238,0.12)',
    washBottom: 'rgba(255,46,200,0.20)',
    sky: ['#04021c', '#1c0f55', '#7c1fc0', '#22d3ee'],
    sun: ['#d8fbff', '#22d3ee', '#ff2ec4'],
    skylineBack: '#241257',
    skylineFront: '#0a0424',
    grid: '#22d3ee',
    accent: '#22d3ee',
    band: ['rgba(4,2,28,0.0)', 'rgba(4,2,28,0.9)'],
  },
  gold: {
    label: 'Golden Hour',
    photoFilter: 'saturate(1.25) contrast(1.05) brightness(1.07) sepia(0.28)',
    washTop: 'rgba(255,190,60,0.08)',
    washBottom: 'rgba(255,140,20,0.24)',
    sky: ['#1d0f2e', '#6b2a4d', '#d96b2b', '#ffc44d'],
    sun: ['#fff8d0', '#ffc44d', '#ff7a1a'],
    skylineBack: '#40204a',
    skylineFront: '#1c0e24',
    grid: '#ffb03c',
    accent: '#ffc44d',
    band: ['rgba(29,15,46,0.0)', 'rgba(29,15,46,0.88)'],
  },
  noir: {
    label: 'Noir',
    photoFilter: 'grayscale(1) contrast(1.32) brightness(1.05)',
    washTop: 'rgba(255,255,255,0.05)',
    washBottom: 'rgba(0,0,0,0.28)',
    sky: ['#07070c', '#232330', '#55555f', '#a9a9b2'],
    sun: ['#ffffff', '#d8d8de', '#8a8a94'],
    skylineBack: '#26262e',
    skylineFront: '#0c0c11',
    grid: '#cfcfd6',
    accent: '#ffffff',
    band: ['rgba(7,7,12,0.0)', 'rgba(7,7,12,0.9)'],
  },
};

export const LAYOUTS = {
  triptych: { label: 'Triptych', panels: 3 },
  comic: { label: 'Comic', panels: 3 },
  hero: { label: 'Hero + Duo', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
};

export const SIZES = {
  square: { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};

/** Panel rectangles (in canvas pixels) for a layout inside the middle band. */
export function layoutPanels(name, w, h) {
  const top = h * 0.17;
  const bottom = h * 0.80;
  const m = w * 0.02;
  const gap = Math.max(6, w * 0.012);
  const x0 = m;
  const y0 = top + gap * 0.5;
  const pw = w - m * 2;
  const ph = bottom - top - gap;
  const midX = x0 + pw * 0.58;
  const midY = y0 + ph * 0.60;
  if (name === 'triptych') {
    return [
      { x: x0, y: y0, w: midX - x0 - gap / 2, h: ph },
      { x: midX + gap / 2, y: y0, w: x0 + pw - midX - gap / 2, h: (ph - gap) / 2 },
      { x: midX + gap / 2, y: y0 + (ph + gap) / 2, w: x0 + pw - midX - gap / 2, h: (ph - gap) / 2 },
    ];
  }
  if (name === 'comic') {
    const cw = (pw - gap * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: x0 + i * (cw + gap), y: y0, w: cw, h: ph }));
  }
  if (name === 'hero') {
    return [
      { x: x0, y: y0, w: pw, h: midY - y0 - gap / 2 },
      { x: x0, y: midY + gap / 2, w: (pw - gap) / 2, h: y0 + ph - midY - gap / 2 },
      { x: x0 + (pw + gap) / 2, y: midY + gap / 2, w: (pw - gap) / 2, h: y0 + ph - midY - gap / 2 },
    ];
  }
  const cw = (pw - gap) / 2;
  const ch = (ph - gap) / 2;
  return [
    { x: x0, y: y0, w: cw, h: ch },
    { x: x0 + cw + gap, y: y0, w: cw, h: ch },
    { x: x0, y: y0 + ch + gap, w: cw, h: ch },
    { x: x0 + cw + gap, y: y0 + ch + gap, w: cw, h: ch },
  ];
}

/** Draws text with even letter spacing, centred on cx. */
export function drawTracked(ctx, text, cx, y, tracking) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
}

/** A palm silhouette: a leaning trunk and long drooping fronds. */
export function drawPalm(ctx, x, y, s, lean, colour) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  const topX = x + lean * s;
  const topY = y - s;
  ctx.lineWidth = Math.max(3, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * s * 0.3, y - s * 0.55, topX, topY);
  ctx.stroke();
  ctx.lineWidth = Math.max(2, s * 0.04);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.02 + i * 0.125);
    const fx = topX + Math.cos(a) * s * 0.62;
    const fy = topY + Math.sin(a) * s * 0.55 + s * 0.16;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * s * 0.34, topY - s * 0.18, fx, fy);
    ctx.stroke();
  }
  ctx.restore();
}

/** A row of dark buildings with a few lit windows, along a baseline. */
export function drawSkyline(ctx, w, baseline, maxH, colour, seed, lit) {
  const rnd = seededRandom(seed);
  ctx.fillStyle = colour;
  let x = -10;
  while (x < w + 10) {
    const bw = 34 + rnd() * 90;
    const bh = maxH * (0.35 + rnd() * 0.65);
    ctx.fillRect(x, baseline - bh, bw, bh);
    if (rnd() > 0.6) {
      ctx.fillRect(x + bw * 0.45, baseline - bh - 14 - rnd() * 18, 3, 14 + rnd() * 18);
    }
    if (lit) {
      const cols = Math.floor(bw / 16);
      const rows = Math.floor(bh / 22);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rnd() > 0.72) {
            ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,209,102,0.85)' : 'rgba(255,120,180,0.8)';
            ctx.fillRect(x + 5 + c * 16, baseline - bh + 6 + r * 22, 6, 9);
            ctx.fillStyle = colour;
          }
        }
      }
    }
    x += bw + 4 + rnd() * 14;
  }
}

/** The neon-city backdrop: sky, striped sun, skyline, palms and grid. */
export function drawBackdrop(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // A few early stars in the upper sky.
  const rnd = seededRandom(20261119);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 46; i++) {
    const sx = rnd() * w;
    const sy = rnd() * h * 0.16;
    const sr = 0.6 + rnd() * 1.4;
    ctx.globalAlpha = 0.25 + rnd() * 0.55;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Striped synthwave sun, half sunk behind the panels.
  const sunR = Math.min(w, h) * 0.17;
  const sunX = w * 0.5;
  const sunY = h * 0.17;
  const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
  grade.sun.forEach((c, i) => sun.addColorStop(i / (grade.sun.length - 1), c));
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  // Slits cut across the sun's lower half, in the sky's own gradient.
  ctx.fillStyle = sky;
  let sy = sunY + sunR * 0.05;
  let sh = sunR * 0.045;
  while (sy < sunY + sunR) {
    ctx.fillRect(sunX - sunR, sy, sunR * 2, sh);
    sy += sh + sunR * 0.11;
    sh *= 1.45;
  }
  ctx.restore();

  // Skyline rows and palms framing the sky band.
  drawSkyline(ctx, w, h * 0.17, h * 0.075, grade.skylineBack, 7, false);
  drawSkyline(ctx, w, h * 0.175, h * 0.05, grade.skylineFront, 21, true);
  drawPalm(ctx, w * 0.045, h * 0.175, h * 0.085, 0.25, grade.skylineFront);
  drawPalm(ctx, w * 0.955, h * 0.175, h * 0.075, -0.25, grade.skylineFront);

  // Perspective grid across the caption band, with a soft glow at the horizon.
  const horizon = h * 0.80;
  const glow = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.42);
  glow.addColorStop(0, grade.grid === '#ffffff' ? 'rgba(255,255,255,0.20)' : 'rgba(255,46,136,0.22)');
  glow.addColorStop(1, 'rgba(255,46,136,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, horizon - h * 0.06, w, h - horizon + h * 0.06);
  ctx.save();
  ctx.strokeStyle = grade.grid;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, w * 0.0012);
  for (let i = 0; i <= 7; i++) {
    const t = (i / 7) ** 2;
    const y = horizon + (h - horizon) * t;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5 + i * w * 0.045, horizon);
    ctx.lineTo(w * 0.5 + i * w * 0.16, h);
    ctx.stroke();
  }
  ctx.restore();
}

/** One photo, cover-fit inside a panel, with its pan, zoom and grade tint. */
export function drawPanelPhoto(ctx, rect, panel, grade) {
  const bw = Math.max(4, Math.min(rect.w, rect.h) * 0.02);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const inner = { x: rect.x + bw, y: rect.y + bw, w: rect.w - bw * 2, h: rect.h - bw * 2 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  if (panel.img) {
    const iw = panel.img.naturalWidth;
    const ih = panel.img.naturalHeight;
    const base = Math.max(inner.w / iw, inner.h / ih) * panel.zoom;
    const dw = iw * base;
    const dh = ih * base;
    const cx = inner.x + inner.w / 2 + panel.panX * inner.w;
    const cy = inner.y + inner.h / 2 + panel.panY * inner.h;
    ctx.filter = grade.photoFilter;
    ctx.drawImage(panel.img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.filter = 'none';
    const wash = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    wash.addColorStop(0, grade.washTop);
    wash.addColorStop(1, grade.washBottom);
    ctx.fillStyle = wash;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  } else {
    const g = ctx.createLinearGradient(inner.x, inner.y, inner.x, inner.y + inner.h);
    g.addColorStop(0, '#3d1450');
    g.addColorStop(1, '#150829');
    ctx.fillStyle = g;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.max(14, inner.w * 0.09)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', inner.x + inner.w / 2, inner.y + inner.h / 2);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** Splits a title into at most two lines that fit maxWidth at a given size. */
export function wrapTitle(ctx, text, maxWidth, size) {
  ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The caption: big outlined title plus a tracked subtitle in a pill. */
export function drawLettering(ctx, w, h, title, subtitle, grade) {
  const bandTop = h * 0.80;
  const bandH = h - bandTop;
  const scrim = ctx.createLinearGradient(0, bandTop - h * 0.03, 0, h);
  scrim.addColorStop(0, grade.band[0]);
  scrim.addColorStop(1, grade.band[1]);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop - h * 0.03, w, h - bandTop + h * 0.03);

  const clean = (title || '').trim().toUpperCase() || 'VICE HEIST';
  const maxWidth = w * 0.92;
  // The subtitle pill sits near the top of the band; the title lives in the
  // clear space below it, with room for descenders above the frame.
  const subSize = Math.max(13, h * 0.026);
  const pillH = subSize * 2.1;
  const pillY = bandTop + bandH * 0.09;
  const titleTop = pillY + pillH + bandH * 0.06;
  const titleBottom = h - bandH * 0.10;
  let size = (titleBottom - titleTop) * 0.92;
  let lines = [];
  while (size > h * 0.02) {
    lines = wrapTitle(ctx, clean, maxWidth, size);
    if (lines.length <= 2) break;
    size *= 0.92;
  }
  const lineH = size * 1.02;
  const totalH = lines.length * lineH;
  // First baseline: centre the block between titleTop and titleBottom.
  const startY = titleTop + (titleBottom - titleTop - totalH) / 2 + size * 0.78;

  ctx.save();
  ctx.translate(w / 2, startY);
  ctx.rotate(-0.02);
  ctx.translate(-w / 2, -startY);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  lines.forEach((lineText, i) => {
    const y = startY + i * lineH;
    const fill = ctx.createLinearGradient(0, y - size, 0, y + size * 0.15);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(1, '#ffe9a8');
    ctx.font = `${size}px Anton, "Arial Narrow", sans-serif`;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.05;
    ctx.strokeStyle = '#160428';
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeText(lineText, w / 2, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = fill;
    ctx.fillText(lineText, w / 2, y);
  });
  ctx.restore();

  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    const tracking = subSize * 0.32;
    const chars = [...sub];
    const tw = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
    const pillW = tw + subSize * 2.4;
    const pillX = (w - pillW) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = 'rgba(10,2,20,0.72)';
    ctx.fill();
    ctx.strokeStyle = grade.accent;
    ctx.lineWidth = Math.max(1.5, h * 0.0016);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    drawTracked(ctx, sub, w / 2, pillY + pillH / 2 + subSize * 0.06, tracking);
    ctx.restore();
  }
}

/** Small corner marks: brand line top-left, edition badge top-right. */
export function drawCornerMarks(ctx, w, h, grade) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const markSize = Math.max(11, h * 0.016);
  ctx.font = `700 ${markSize}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const markTracking = h * 0.004;
  const markText = 'VICE COVER STUDIO';
  const markW = [...markText].reduce((a, c) => a + ctx.measureText(c).width, 0)
    + markTracking * (markText.length - 1);
  drawTracked(ctx, markText, w * 0.02 + markW / 2, h * 0.055, markTracking);
  const badge = 'EST. 2026';
  ctx.font = `700 ${Math.max(11, h * 0.016)}px system-ui, sans-serif`;
  const bw = ctx.measureText(badge).width + h * 0.05;
  const bh = h * 0.038;
  ctx.translate(w - w * 0.02 - bw / 2, h * 0.055);
  ctx.rotate(0.05);
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  ctx.fillStyle = grade.accent;
  ctx.fill();
  ctx.fillStyle = '#14091f';
  ctx.textAlign = 'center';
  ctx.fillText(badge, 0, h * 0.0015);
  ctx.restore();
}

/** A starting pan that keeps faces in frame: a tall photo inside a wide
 *  panel is shifted down so its upper part (usually the face) shows, and a
 *  wide photo inside a tall panel is shifted sideways the same way. */
export function autoPanFor(img, rect) {
  const photoAspect = img.naturalWidth / img.naturalHeight;
  const rectAspect = rect.w / rect.h;
  if (photoAspect < rectAspect * 0.8) return { panX: 0, panY: 0.22 };
  if (photoAspect > rectAspect * 1.25) return { panX: 0, panY: 0 };
  return { panX: 0, panY: 0 };
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size.
 * `state`: { layout, grade, title, subtitle, panels: [{img, panX, panY, zoom}] }
 * `options.selected`: index of the panel the editor has picked (outline only).
 */
export function renderCover(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  drawBackdrop(ctx, w, h, grade);
  const rects = layoutPanels(state.layout, w, h);
  rects.forEach((rect, i) => {
    drawPanelPhoto(ctx, rect, state.panels[i] ?? { img: null, panX: 0, panY: 0, zoom: 1 }, grade);
  });
  drawLettering(ctx, w, h, state.title, state.subtitle, grade);
  drawCornerMarks(ctx, w, h, grade);
  if (options.selected != null && rects[options.selected]) {
    const r = rects[options.selected];
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.restore();
  }
  // Vignette and a thin white frame to finish the poster.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(3, w * 0.005);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
}

/** Renders the cover at an export size on a fresh canvas and returns it. */
export function exportCanvas(state, sizeKey) {
  const size = SIZES[sizeKey] ?? SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas, state);
  return canvas;
}
