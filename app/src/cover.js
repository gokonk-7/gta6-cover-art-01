// Vice Cover Studio — the cover renderer.
//
// Everything the cover shows is drawn on one canvas: a procedural Vice City
// backdrop (sunset sky, striped sun, skyline, palms, perspective grid), the
// photo panels with their colour grade, and the bold Anton title block.
// No image here comes from a game: the backdrop is code, the photos are the
// user's own uploads or the bundled samples, and Anton is an OFL font.

export const SIZES = {
  square: { width: 1080, height: 1080, label: 'Square 1080 x 1080' },
  portrait: { width: 1080, height: 1350, label: 'Portrait 1080 x 1350' },
  wide: { width: 1920, height: 1080, label: 'Wide 1920 x 1080' },
};

export const LAYOUTS = {
  triptych: { label: 'Triptych', panels: 3 },
  comic: { label: 'Comic', panels: 3 },
  heroDuo: { label: 'Hero + Duo', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
};

export const GRADES = {
  sunset: { label: 'Sunset', filter: 'saturate(1.30) contrast(1.06) brightness(1.02)' },
  neon: { label: 'Neon', filter: 'saturate(1.70) contrast(1.12) hue-rotate(-12deg)' },
  golden: { label: 'Golden Hour', filter: 'sepia(0.32) saturate(1.45) contrast(1.05)' },
  noir: { label: 'Noir', filter: 'grayscale(1) contrast(1.28) brightness(1.06)' },
};

/** Deterministic pseudo-random generator, so every render looks the same. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Panel rectangles for a layout, in canvas pixels. `m` is the outer margin,
 * `g` the gutter between panels; the backdrop shows through both.
 */
export function layoutRects(layout, w, h) {
  // A generous margin and gutter, so the sunset backdrop frames the panels
  // like a poster border instead of hiding behind them.
  const m = Math.round(w * 0.028);
  const g = Math.round(w * 0.02);
  const innerW = w - m * 2;
  const innerH = h - m * 2;
  const col = (x, y, cw, ch) => ({ x: m + x, y: m + y, w: cw, h: ch });
  switch (layout) {
    case 'comic': {
      const cw = (innerW - g * 2) / 3;
      return [
        col(0, 0, cw, innerH),
        col(cw + g, 0, cw, innerH),
        col((cw + g) * 2, 0, cw, innerH),
      ];
    }
    case 'heroDuo': {
      const topH = innerH * 0.58;
      const botH = innerH - topH - g;
      const halfW = (innerW - g) / 2;
      return [
        col(0, 0, innerW, topH),
        col(0, topH + g, halfW, botH),
        col(halfW + g, topH + g, halfW, botH),
      ];
    }
    case 'quad': {
      const halfW = (innerW - g) / 2;
      const halfH = (innerH - g) / 2;
      return [
        col(0, 0, halfW, halfH),
        col(halfW + g, 0, halfW, halfH),
        col(0, halfH + g, halfW, halfH),
        col(halfW + g, halfH + g, halfW, halfH),
      ];
    }
    case 'triptych':
    default: {
      const heroW = innerW * 0.6;
      const sideW = innerW - heroW - g;
      const sideH = (innerH - g) / 2;
      return [
        col(0, 0, heroW, innerH),
        col(heroW + g, 0, sideW, sideH),
        col(heroW + g, sideH + g, sideW, sideH),
      ];
    }
  }
}

/** The sky gradient, shared by the sky fill and the sun's stripes. */
function skyGradient(ctx, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.8);
  sky.addColorStop(0.0, '#160a2e');
  sky.addColorStop(0.35, '#4b1160');
  sky.addColorStop(0.55, '#b01e6e');
  sky.addColorStop(0.72, '#ff5e3a');
  sky.addColorStop(0.8, '#ffb347');
  return sky;
}

function drawStars(ctx, w, h, rand) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const count = Math.round((w * h) / 26000);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.34;
    const r = 0.6 + rand() * 1.6;
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, w, h, sky) {
  const cx = w * 0.5;
  const cy = h * 0.6;
  const r = Math.min(w, h) * 0.21;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.1);
  glow.addColorStop(0, 'rgba(255, 150, 80, 0.55)');
  glow.addColorStop(1, 'rgba(255, 150, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, '#ffe259');
  disc.addColorStop(0.55, '#ff7e5f');
  disc.addColorStop(1, '#ff2e88');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Synthwave stripes cut across the sun's lower half, painted with the sky
  // gradient so they read as gaps in the disc.
  ctx.fillStyle = sky;
  let y = cy + r * 0.08;
  let thick = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r - 2, y, r * 2 + 4, thick);
    y += thick + r * 0.11;
    thick *= 1.45;
  }
}

function drawSkyline(ctx, w, h, rand) {
  const horizon = h * 0.8;
  // Far row: hazy purple towers.
  ctx.fillStyle = '#3a1450';
  let x = -w * 0.02;
  while (x < w * 1.02) {
    const bw = w * (0.04 + rand() * 0.05);
    const bh = h * (0.05 + rand() * 0.09);
    ctx.fillRect(x, horizon - bh, bw, bh);
    x += bw + w * 0.008;
  }
  // Near row: near-black blocks with a few lit windows.
  ctx.fillStyle = '#12041f';
  x = -w * 0.01;
  while (x < w * 1.01) {
    const bw = w * (0.05 + rand() * 0.07);
    const bh = h * (0.03 + rand() * 0.07);
    const top = horizon - bh;
    ctx.fillRect(x, top, bw, bh);
    if (rand() > 0.45) ctx.fillRect(x + bw * 0.42, top - h * 0.018, w * 0.006, h * 0.018);
    ctx.fillStyle = 'rgba(255, 214, 130, 0.9)';
    const wins = Math.floor(rand() * 5);
    for (let i = 0; i < wins; i++) {
      ctx.fillRect(x + bw * (0.12 + rand() * 0.7), top + bh * (0.15 + rand() * 0.65), w * 0.008, h * 0.006);
    }
    ctx.fillStyle = '#12041f';
    x += bw + w * 0.012;
  }
}

function drawPalm(ctx, x, baseY, s, lean) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(s, s);
  ctx.strokeStyle = '#0d0518';
  ctx.fillStyle = '#0d0518';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 18, -70, lean * 34, -118);
  ctx.stroke();
  ctx.translate(lean * 34, -118);
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI * 0.08) - (i * Math.PI) / 7.2;
    const len = 52 - Math.abs(i - 3) * 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(
      Math.cos(a) * len * 0.6,
      Math.sin(a) * len * 0.6 + 14,
      Math.cos(a) * len,
      Math.sin(a) * len + 34,
    );
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(ctx, w, h) {
  const horizon = h * 0.8;
  const floor = ctx.createLinearGradient(0, horizon, 0, h);
  floor.addColorStop(0, '#2a0a3e');
  floor.addColorStop(1, '#0d0518');
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = 'rgba(255, 46, 136, 0.4)';
  ctx.lineWidth = Math.max(1, w * 0.0012);
  // Receding verticals from the vanishing point.
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * w * 0.045, horizon);
    ctx.lineTo(w / 2 + i * w * 0.16, h);
    ctx.stroke();
  }
  // Horizontals, closer together near the horizon.
  for (let i = 0; i < 7; i++) {
    const y = horizon + (h - horizon) * Math.pow((i + 1) / 7, 2.1);
    ctx.globalAlpha = 0.25 + (i / 7) * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Paints the procedural Vice City backdrop over the whole canvas. */
export function drawBackdrop(ctx, w, h) {
  const rand = mulberry32(20261119);
  const sky = skyGradient(ctx, h);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  drawStars(ctx, w, h, rand);
  drawSun(ctx, w, h, sky);
  drawGrid(ctx, w, h);
  drawSkyline(ctx, w, h, rand);
  const palmScale = Math.min(w, h) / 900;
  drawPalm(ctx, w * 0.045, h * 0.82, palmScale * 1.15, 1);
  drawPalm(ctx, w * 0.955, h * 0.82, palmScale, -1);
}

/** Draws one photo into its panel rect: cover-fit, pan (ox/oy 0..1), zoom. */
export function drawPanelPhoto(ctx, img, rect, panel, gradeKey) {
  if (!img || !img.naturalWidth) return;
  const grade = GRADES[gradeKey] ?? GRADES.sunset;
  const zoom = panel.zoom ?? 1;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const sw = img.naturalWidth * base * zoom;
  const sh = img.naturalHeight * base * zoom;
  const dx = rect.x + (rect.w - sw) * (panel.ox ?? 0.5);
  const dy = rect.y + (rect.h - sh) * (panel.oy ?? 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, sw, sh);
  ctx.restore();
  ctx.filter = 'none';
  // Frame: a dark outer edge, then a crisp white inner line.
  ctx.lineWidth = Math.max(3, rect.w * 0.006);
  ctx.strokeStyle = 'rgba(10, 4, 20, 0.6)';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = Math.max(2, rect.w * 0.0035);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
}

function gradeTint(ctx, w, h, gradeKey) {
  let tint;
  if (gradeKey === 'neon') {
    tint = ctx.createLinearGradient(0, 0, w, 0);
    tint.addColorStop(0, 'rgba(0, 229, 255, 0.13)');
    tint.addColorStop(1, 'rgba(255, 0, 128, 0.13)');
  } else if (gradeKey === 'golden') {
    tint = ctx.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, 'rgba(255, 176, 32, 0.05)');
    tint.addColorStop(1, 'rgba(255, 140, 0, 0.15)');
  } else if (gradeKey === 'noir') {
    return; // The grayscale filter already does the work.
  } else {
    tint = ctx.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, 'rgba(255, 46, 136, 0.09)');
    tint.addColorStop(1, 'rgba(255, 140, 0, 0.15)');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // A gentle vignette keeps the edges cinematic in every grade.
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  vig.addColorStop(0, 'rgba(8, 3, 16, 0)');
  vig.addColorStop(1, 'rgba(8, 3, 16, 0.32)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, maxWidth, startSize, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

function drawTitleBlock(ctx, w, h, title, subtitle) {
  const bandH = h * 0.21;
  const band = ctx.createLinearGradient(0, h - bandH * 1.5, 0, h);
  band.addColorStop(0, 'rgba(8, 3, 16, 0)');
  band.addColorStop(0.55, 'rgba(8, 3, 16, 0.72)');
  band.addColorStop(1, 'rgba(8, 3, 16, 0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - bandH * 1.5, w, bandH * 1.5);

  const words = (title || 'NEON HEAT').trim().toUpperCase();
  const maxW = w * 0.9;
  const size = fitFont(ctx, words, maxW, Math.round(w * 0.115), 'Anton, "Arial Narrow", sans-serif');
  const cx = w / 2;
  const baseline = h - h * 0.085;
  ctx.save();
  // A slight forward lean, the way poster lettering leans.
  ctx.translate(cx, baseline);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  ctx.translate(-cx, -baseline);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255, 46, 136, 0.75)';
  ctx.shadowBlur = size * 0.22;
  ctx.shadowOffsetY = size * 0.045;
  ctx.strokeStyle = '#12041f';
  ctx.lineWidth = size * 0.16;
  ctx.strokeText(words, cx, baseline);
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.75, '#ffe9f4');
  fill.addColorStop(1, '#ffb3d9');
  ctx.fillStyle = fill;
  ctx.fillText(words, cx, baseline);
  ctx.restore();

  // Magenta rule under the title.
  const ruleW = Math.min(maxW, ctx.measureText(words).width * 0.92);
  ctx.fillStyle = '#ff2e88';
  ctx.fillRect(cx - ruleW / 2, baseline + h * 0.016, ruleW, Math.max(3, h * 0.005));

  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subSize = Math.max(15, Math.round(h * 0.021));
    ctx.font = `600 ${subSize}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`; } catch { /* older canvas */ }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = subSize * 0.3;
    ctx.fillText(sub, cx, baseline + h * 0.052);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/**
 * Renders a full cover onto `canvas` from a state object:
 * { layout, grade, title, subtitle, panels: [{ image, zoom, ox, oy }] }.
 * The canvas is resized to the requested export size first.
 */
export function renderCover(canvas, state, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'none';
  drawBackdrop(ctx, width, height);
  const rects = layoutRects(state.layout, width, height);
  const panels = state.panels ?? [];
  rects.forEach((rect, i) => {
    drawPanelPhoto(ctx, panels[i]?.image ?? null, rect, panels[i] ?? {}, state.grade);
  });
  gradeTint(ctx, width, height, state.grade);
  drawTitleBlock(ctx, width, height, state.title, state.subtitle);
  return canvas;
}

/** Renders the state to a fresh offscreen canvas at an export size. */
export function renderToCanvas(state, width, height) {
  return renderCover(document.createElement('canvas'), state, width, height);
}
