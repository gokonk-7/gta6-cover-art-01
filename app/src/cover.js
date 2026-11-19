// Vice Cover Studio — cover renderer.
//
// Everything on a cover is drawn here, on a plain 2D canvas: a procedural
// Vice City sunset (striped sun, skyline, palms, perspective grid), the
// photo panels in one of four layouts, a colour grade, and bold Anton
// lettering. No image is ever fetched from the network and no Rockstar art,
// logo or font is used: the backdrop is painted from code and the lettering
// font is Anton under the SIL Open Font License (see app/fonts/FONTS.md).
//
// renderCover(ctx, width, height, state) paints a whole cover at any size, so
// the live preview and the exported PNG are the same drawing, only scaled.

export const LAYOUTS = {
  triptych: 'Triptych',
  comic: 'Comic',
  heroDuo: 'Hero + Duo',
  quad: 'Quad',
};

export const GRADES = {
  sunset: 'Sunset',
  neon: 'Neon',
  golden: 'Golden Hour',
  noir: 'Noir',
};

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

// Sky, sun, wash and accent colours per grade. Noir keeps the same drawing
// but desaturates it through the panel filter and a grey wash.
const GRADE_PAINT = {
  sunset: {
    sky: ['#150829', '#4d1450', '#a4135f', '#ff2d78', '#ff7a3d', '#ffc46b'],
    sunTop: '#ffe9a8',
    sunBottom: '#ff5e3a',
    wash: ['rgba(255, 45, 120, 0.20)', 'rgba(255, 150, 60, 0.16)'],
    filter: 'saturate(1.35) contrast(1.08) sepia(0.18)',
    accent: '#ffd166',
    grid: 'rgba(255, 110, 180, 0.55)',
    band: 'rgba(16, 4, 32, 0.62)',
  },
  neon: {
    sky: ['#070418', '#160a3d', '#3d0f6e', '#c62bff', '#00e5ff', '#7df9ff'],
    sunTop: '#fff3b0',
    sunBottom: '#ff2bd6',
    wash: ['rgba(198, 43, 255, 0.22)', 'rgba(0, 229, 255, 0.18)'],
    filter: 'saturate(1.6) contrast(1.12) hue-rotate(-12deg)',
    accent: '#00e5ff',
    grid: 'rgba(0, 229, 255, 0.6)',
    band: 'rgba(6, 2, 26, 0.66)',
  },
  golden: {
    sky: ['#241204', '#5c2a08', '#a34d12', '#ff8c2e', '#ffb347', '#ffe3a1'],
    sunTop: '#fff6c9',
    sunBottom: '#ff9a1f',
    wash: ['rgba(255, 150, 40, 0.20)', 'rgba(255, 210, 110, 0.14)'],
    filter: 'saturate(1.4) contrast(1.06) sepia(0.32)',
    accent: '#ffe3a1',
    grid: 'rgba(255, 180, 90, 0.5)',
    band: 'rgba(28, 12, 2, 0.6)',
  },
  noir: {
    sky: ['#050505', '#141414', '#2e2e2e', '#555555', '#8a8a8a', '#c9c9c9'],
    sunTop: '#f2f2f2',
    sunBottom: '#9a9a9a',
    wash: ['rgba(0, 0, 0, 0.18)', 'rgba(255, 255, 255, 0.06)'],
    filter: 'grayscale(1) contrast(1.32) brightness(1.06)',
    accent: '#f2f2f2',
    grid: 'rgba(255, 255, 255, 0.4)',
    band: 'rgba(0, 0, 0, 0.68)',
  },
};

// A tiny deterministic generator, so the skyline and palms are identical on
// every run and every export size.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Panel rectangles for a layout, as fractions of the cover size. */
export function layoutPanels(layout, w, h) {
  const m = Math.min(w, h) * 0.032; // outer margin
  const g = Math.min(w, h) * 0.018; // gap between panels
  const x0 = m;
  const y0 = m;
  const fullW = w - m * 2;
  const fullH = h - m * 2;
  if (layout === 'comic') {
    const pw = (fullW - g * 2) / 3;
    return [0, 1, 2].map((i) => ({ x: x0 + i * (pw + g), y: y0, w: pw, h: fullH }));
  }
  if (layout === 'heroDuo') {
    const topH = (fullH - g) * 0.6;
    const botH = fullH - g - topH;
    const bw = (fullW - g) / 2;
    return [
      { x: x0, y: y0, w: fullW, h: topH },
      { x: x0, y: y0 + topH + g, w: bw, h: botH },
      { x: x0 + bw + g, y: y0 + topH + g, w: bw, h: botH },
    ];
  }
  if (layout === 'quad') {
    const cw = (fullW - g) / 2;
    const ch = (fullH - g) / 2;
    return [
      { x: x0, y: y0, w: cw, h: ch },
      { x: x0 + cw + g, y: y0, w: cw, h: ch },
      { x: x0, y: y0 + ch + g, w: cw, h: ch },
      { x: x0 + cw + g, y: y0 + ch + g, w: cw, h: ch },
    ];
  }
  // triptych: one tall hero on the left, two stacked on the right.
  const heroW = fullW * 0.56;
  const sideW = fullW - g - heroW;
  const sideH = (fullH - g) / 2;
  return [
    { x: x0, y: y0, w: heroW, h: fullH },
    { x: x0 + heroW + g, y: y0, w: sideW, h: sideH },
    { x: x0 + heroW + g, y: y0 + sideH + g, w: sideW, h: sideH },
  ];
}

/** How many panels a layout has. */
export function panelCount(layout) {
  return layoutPanels(layout, 100, 100).length;
}

function drawStripedSun(ctx, cx, cy, r, paint) {
  const sun = document.createElement('canvas');
  sun.width = Math.ceil(r * 2);
  sun.height = Math.ceil(r * 2);
  const s = sun.getContext('2d');
  const grad = s.createLinearGradient(0, 0, 0, r * 2);
  grad.addColorStop(0, paint.sunTop);
  grad.addColorStop(1, paint.sunBottom);
  s.fillStyle = grad;
  s.beginPath();
  s.arc(r, r, r, 0, Math.PI * 2);
  s.fill();
  // Cut horizontal stripes out of the sun's lower half, widening downward.
  s.globalCompositeOperation = 'destination-out';
  let y = r * 1.05;
  let thick = r * 0.045;
  while (y < r * 2) {
    s.fillRect(0, y, r * 2, thick);
    y += thick + r * 0.13;
    thick *= 1.55;
  }
  ctx.drawImage(sun, cx - r, cy - r);
}

function drawSkyline(ctx, w, horizon, paint, rand) {
  const base = '#0d0318';
  ctx.fillStyle = base;
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const bw = w * (0.05 + rand() * 0.09);
    const bh = hgt(rand);
    const top = horizon - bh;
    ctx.fillRect(x, top, bw, bh);
    if (rand() < 0.4) {
      // A rooftop antenna.
      ctx.fillRect(x + bw * 0.45, top - bh * 0.16, 2, bh * 0.16);
    }
    // A few lit windows.
    ctx.fillStyle = 'rgba(255, 190, 90, 0.75)';
    const cols = Math.max(1, Math.floor(bw / (w * 0.018)));
    const rows = Math.max(1, Math.floor(bh / (w * 0.03)));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (rand() < 0.16) {
          ctx.fillRect(x + 4 + c * (w * 0.018), top + 6 + r * (w * 0.03), 3, 4);
        }
      }
    }
    ctx.fillStyle = base;
    x += bw + w * 0.012;
  }
  function hgt(r) {
    return w * (0.06 + r() * 0.16);
  }
}

function drawPalm(ctx, x, baseY, size, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = 'round';
  // Trunk, leaning slightly.
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + size * 0.1, baseY - size * 0.55, x + size * 0.22, baseY - size);
  ctx.stroke();
  const topX = x + size * 0.22;
  const topY = baseY - size;
  // Fronds: arcs fanning out from the crown.
  ctx.lineWidth = Math.max(1.5, size * 0.03);
  for (let i = 0; i < 7; i += 1) {
    const a = (-Math.PI * 0.15) - (i * Math.PI) / 8.5;
    const len = size * (0.42 + (i % 2) * 0.08);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.55 + len * 0.28;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * len * 0.6, topY - len * 0.18, ex, ey);
    ctx.stroke();
  }
  // A couple of coconuts.
  ctx.beginPath();
  ctx.arc(topX - 3, topY + 4, Math.max(2, size * 0.03), 0, Math.PI * 2);
  ctx.arc(topX + 4, topY + 5, Math.max(2, size * 0.03), 0, Math.PI * 2);
  ctx.fill();
}

function drawBackdrop(ctx, w, h, paint) {
  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  paint.sky.forEach((c, i) => sky.addColorStop(i / (paint.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const horizon = h * 0.66;
  drawStripedSun(ctx, w * 0.5, horizon - h * 0.16, Math.min(w, h) * 0.17, paint);

  // Perspective grid on the ground below the horizon.
  ctx.strokeStyle = paint.grid;
  ctx.lineWidth = Math.max(1, w * 0.0012);
  const cx = w * 0.5;
  for (let i = -8; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + (i * w) / 8, horizon);
    ctx.lineTo(cx + i * w * 0.32, h);
    ctx.stroke();
  }
  let gy = horizon;
  let step = h * 0.012;
  ctx.globalAlpha = 0.85;
  while (gy < h) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    gy += step;
    step *= 1.55;
  }
  ctx.globalAlpha = 1;

  // Ground haze over the grid.
  const haze = ctx.createLinearGradient(0, horizon, 0, h);
  haze.addColorStop(0, 'rgba(20, 4, 40, 0)');
  haze.addColorStop(1, 'rgba(20, 4, 40, 0.5)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon, w, h - horizon);

  const rand = seeded(20261119);
  drawSkyline(ctx, w, horizon, paint, rand);
  const palmY = horizon + h * 0.005;
  drawPalm(ctx, w * 0.06, palmY, Math.min(w, h) * 0.16, '#0d0318');
  drawPalm(ctx, w * 0.94, palmY, Math.min(w, h) * 0.13, '#0d0318');
  drawPalm(ctx, w * 0.86, palmY, Math.min(w, h) * 0.09, '#0d0318');
}

/** Draws one photo into its panel rect, cover-fit, with pan and zoom. */
function drawPhotoPanel(ctx, rect, panel, paint) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = Math.max(8, rect.w * 0.02);
  ctx.shadowOffsetY = Math.max(4, rect.w * 0.008);
  ctx.fillStyle = '#fff';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
  ctx.clip();
  if (panel.image) {
    const img = panel.image;
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const scale = base * (panel.zoom || 1);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Anchor the crop window toward the top of a tall photo (faces live
    // there) instead of dead centre: a portrait photo in a wide panel
    // would otherwise lose the subject's head. 0.5 is centred, 0 is the top.
    const anchorY = img.naturalHeight > img.naturalWidth ? 0.3 : 0.5;
    const anchorX = 0.5;
    const dx = rect.x + (rect.w - dw) * anchorX + (panel.ox || 0) * rect.w * 0.25;
    const dy = rect.y + (rect.h - dh) * anchorY + (panel.oy || 0) * rect.h * 0.25;
    ctx.filter = paint.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
    // A warm wash over the photo so panels and backdrop feel like one poster.
    const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    wash.addColorStop(0, paint.wash[0]);
    wash.addColorStop(1, paint.wash[1]);
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else {
    // Empty slot: dark panel with diagonal stripes and a prompt.
    ctx.fillStyle = '#1b0a2e';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = Math.max(2, rect.w * 0.01);
    for (let d = -rect.h; d < rect.w; d += rect.w * 0.12) {
      ctx.beginPath();
      ctx.moveTo(rect.x + d, rect.y + rect.h);
      ctx.lineTo(rect.x + d + rect.h, rect.y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `${Math.max(14, rect.w * 0.075)}px Anton, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+ ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
  // Thin dark inner edge, poster style.
  ctx.strokeStyle = 'rgba(10, 2, 20, 0.65)';
  ctx.lineWidth = Math.max(1.5, rect.w * 0.004);
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawStars(ctx, w, h, paint) {
  const r = Math.min(w, h) * 0.018;
  const gap = r * 2.6;
  const total = gap * 4 + r * 2;
  let x = w - Math.min(w, h) * 0.032 - total + r;
  const y = Math.min(w, h) * 0.032 + r;
  for (let i = 0; i < 5; i += 1) {
    starPath(ctx, x, y, r);
    ctx.fillStyle = paint.accent;
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 2, 20, 0.8)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
    x += gap;
  }
}

function wrapTitle(ctx, title, maxWidth) {
  const words = title.toUpperCase().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawLettering(ctx, w, h, title, subtitle, paint) {
  const m = Math.min(w, h) * 0.032;
  // A dark band at the bottom so the title stays readable over any photo.
  const band = ctx.createLinearGradient(0, h * 0.68, 0, h);
  band.addColorStop(0, 'rgba(10, 2, 20, 0)');
  band.addColorStop(1, paint.band);
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  const size = Math.min(w, h) * 0.105;
  ctx.font = `${size}px Anton, sans-serif`;
  const maxWidth = w - m * 2;
  const lines = wrapTitle(ctx, title || 'SUNSET HEIST', maxWidth);
  const lineHeight = size * 0.96;
  const blockH = lines.length * lineHeight;
  let y = h - m - (subtitle ? size * 0.42 : 0) - blockH + lineHeight * 0.82;

  ctx.save();
  ctx.translate(m, 0);
  ctx.rotate(-0.022);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetX = size * 0.045;
  ctx.shadowOffsetY = size * 0.06;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12041f';
  ctx.lineWidth = size * 0.16;
  ctx.fillStyle = '#ffffff';
  for (const line of lines) {
    ctx.strokeText(line, 0, y);
    ctx.fillText(line, 0, y);
    y += lineHeight;
  }
  ctx.restore();

  if (subtitle) {
    const subSize = Math.min(w, h) * 0.032;
    ctx.font = `${subSize}px Anton, sans-serif`;
    try {
      ctx.letterSpacing = `${subSize * 0.28}px`;
    } catch {
      // Older engines ignore letterSpacing; the text still draws.
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = paint.accent;
    ctx.strokeStyle = 'rgba(10, 2, 20, 0.85)';
    ctx.lineWidth = subSize * 0.18;
    const text = subtitle.toUpperCase();
    const ty = h - m * 0.55;
    ctx.strokeText(text, m, ty);
    ctx.fillText(text, m, ty);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // No-op.
    }
  }
}

/**
 * Paints a whole cover onto ctx at the given size.
 * state: { layout, grade, title, subtitle, panels: [{image, zoom, ox, oy}] }
 */
export function renderCover(ctx, w, h, state) {
  const paint = GRADE_PAINT[state.grade] || GRADE_PAINT.sunset;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, paint);
  const rects = layoutPanels(state.layout, w, h);
  rects.forEach((rect, i) => {
    drawPhotoPanel(ctx, rect, state.panels[i] || {}, paint);
  });
  // Whole-cover grade wash to tie panels and backdrop together.
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, paint.wash[0]);
  wash.addColorStop(1, paint.wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  // Vignette.
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(5, 1, 12, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  // Poster edge.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.008);
  ctx.strokeRect(
    ctx.lineWidth / 2, ctx.lineWidth / 2,
    w - ctx.lineWidth, h - ctx.lineWidth,
  );
  drawStars(ctx, w, h, paint);
  drawLettering(ctx, w, h, state.title, state.subtitle, paint);
  ctx.restore();
}

/** Builds an offscreen canvas with the cover at the requested size. */
export function makeCoverCanvas(w, h, state) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, state);
  return canvas;
}
