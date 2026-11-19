// Vice Cover Studio renderer: draws the whole poster on any 2D canvas —
// the procedural Vice City backdrop (sunset sky, striped synthwave sun,
// skyline and palm silhouettes, neon grid horizon), the photo panels in
// the chosen layout, the colour grade, and the Anton title lettering.
// Pure canvas, no assets beyond the photos the caller hands in.

export const LAYOUTS = ['triptych', 'comic', 'hero-duo', 'quad'];
export const GRADES = ['sunset', 'neon', 'golden', 'noir'];

/** Panel rectangles for a layout, as fractions of the cover [x, y, w, h]. */
export function layoutRects(layout, panelCount) {
  const g = 0.022; // gutter, in cover units
  switch (layout) {
    case 'comic':
      return [0, 1, 2].slice(0, panelCount).map((i) => [
        g + i * (1 / 3), g, 1 / 3 - g * 1.35, 1 - g * 2,
      ]);
    case 'hero-duo':
      return [
        [g, g, 1 - g * 2, 0.58],
        [g, 0.58 + g * 1.5, 0.5 - g * 1.5, 1 - 0.58 - g * 2.5],
        [0.5 + g * 0.5, 0.58 + g * 1.5, 0.5 - g * 1.5, 1 - 0.58 - g * 2.5],
      ].slice(0, panelCount);
    case 'quad':
      return [
        [g, g, 0.5 - g * 1.5, 0.5 - g * 1.5],
        [0.5 + g * 0.5, g, 0.5 - g * 1.5, 0.5 - g * 1.5],
        [g, 0.5 + g * 0.5, 0.5 - g * 1.5, 0.5 - g * 1.5],
        [0.5 + g * 0.5, 0.5 + g * 0.5, 0.5 - g * 1.5, 0.5 - g * 1.5],
      ].slice(0, panelCount);
    case 'triptych':
    default:
      return [
        [g, g, 0.56, 1 - g * 2],
        [0.56 + g * 1.5, g, 1 - 0.56 - g * 2.5, 0.5 - g * 1.5],
        [0.56 + g * 1.5, 0.5 + g * 0.5, 1 - 0.56 - g * 2.5, 0.5 - g * 1.5],
      ].slice(0, panelCount);
  }
}

const GRADE_SKY = {
  sunset: ['#1b0b3b', '#5c1668', '#c62b7e', '#ff5e3a', '#ffb347'],
  neon: ['#0a0626', '#2a0a5e', '#a4138f', '#ff2e88', '#19e3ff'],
  golden: ['#241239', '#6b2a1e', '#b3541e', '#ff8c1a', '#ffd76a'],
  noir: ['#0a0a0c', '#1c1c22', '#3a3a42', '#6e6e78', '#c9c9cf'],
};
const GRADE_TINT = {
  sunset: 'rgba(255, 94, 58, 0.10)',
  neon: 'rgba(255, 46, 136, 0.14)',
  golden: 'rgba(255, 170, 40, 0.12)',
  noir: 'rgba(0, 0, 0, 0)',
};
const GRADE_SUN = {
  sunset: ['#ffd76a', '#ff5e3a'],
  neon: ['#7df9ff', '#ff2e88'],
  golden: ['#fff3b0', '#ff8c1a'],
  noir: ['#e8e8ea', '#8a8a92'],
};

/** Draws the procedural backdrop: sky, striped sun, skyline, palms, grid. */
export function drawBackdrop(ctx, w, h, grade) {
  const sky = GRADE_SKY[grade] ?? GRADE_SKY.sunset;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  sky.forEach((color, i) => grad.addColorStop(i / (sky.length - 1), color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Striped synthwave sun, low on the horizon.
  const cx = w * 0.5;
  const cy = h * 0.52;
  const r = Math.min(w, h) * 0.26;
  const sunColors = GRADE_SUN[grade] ?? GRADE_SUN.sunset;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, sunColors[0]);
  sun.addColorStop(1, sunColors[1]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Cut horizontal slats out of the sun's lower half.
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.08;
  let thick = h * 0.006;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, thick);
    y += thick + h * 0.028;
    thick *= 1.5;
  }
  ctx.restore();

  // Distant skyline: two rows of blocky towers with lit windows.
  drawSkyline(ctx, w, h, 0.62, '#1c0b33', 0.5);
  drawSkyline(ctx, w, h, 0.72, '#12081f', 0.9);

  // Palm silhouettes leaning in from the sides.
  drawPalm(ctx, w * 0.06, h * 0.86, h * 0.16, -0.5, '#0d0518');
  drawPalm(ctx, w * 0.95, h * 0.9, h * 0.19, 0.55, '#0d0518');

  // Neon grid floor below the horizon.
  const horizon = h * 0.78;
  const grid = ctx.createLinearGradient(0, horizon, 0, h);
  grid.addColorStop(0, 'rgba(25, 227, 255, 0)');
  grid.addColorStop(1, grade === 'noir' ? 'rgba(200, 200, 210, 0.20)' : 'rgba(255, 46, 136, 0.28)');
  ctx.fillStyle = grid;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = grade === 'noir' ? 'rgba(220, 220, 230, 0.35)' : 'rgba(25, 227, 255, 0.45)';
  ctx.lineWidth = Math.max(1, h * 0.0012);
  const rows = 7;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const yy = horizon + (h - horizon) * t * t;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.02, horizon);
    ctx.lineTo(cx + i * w * 0.16, h);
    ctx.stroke();
  }
}

function drawSkyline(ctx, w, h, baseY, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  let x = -w * 0.02;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  while (x < w * 1.02) {
    const bw = w * (0.03 + rnd() * 0.05);
    const bh = h * (0.05 + rnd() * 0.13);
    const top = h * baseY - bh;
    ctx.fillRect(x, top, bw, bh);
    if (rnd() > 0.6) ctx.fillRect(x + bw * 0.3, top - h * 0.02, bw * 0.4, h * 0.02);
    // A few lit windows.
    ctx.fillStyle = 'rgba(255, 214, 106, 0.75)';
    for (let k = 0; k < 4; k++) {
      if (rnd() > 0.55) {
        ctx.fillRect(x + bw * (0.15 + rnd() * 0.6), top + bh * (0.15 + rnd() * 0.6), Math.max(1.5, w * 0.004), Math.max(1.5, w * 0.006));
      }
    }
    ctx.fillStyle = color;
    x += bw + w * 0.008;
  }
  ctx.restore();
}

function drawPalm(ctx, x, y, size, lean, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.55, size * 0.22, -size * 0.95);
  ctx.stroke();
  const topX = size * 0.22;
  const topY = -size * 0.95;
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI * 0.95) + (i / 6) * Math.PI * 1.15;
    const len = size * (0.42 + (i % 2) * 0.1);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * len * 0.5, topY + Math.sin(a) * len * 0.5 + size * 0.12,
      topX + Math.cos(a) * len, topY + Math.sin(a) * len + size * 0.3,
    );
    ctx.lineWidth = Math.max(1.5, size * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws one photo into a rect with cover-fit, pan (ox, oy in -1..1) and zoom. */
export function drawPhotoPanel(ctx, photo, rect, pan, zoom) {
  const [rx, ry, rw, rh] = rect;
  if (!photo) {
    ctx.fillStyle = 'rgba(12, 5, 18, 0.55)';
    ctx.fillRect(rx, ry, rw, rh);
    return;
  }
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const base = Math.max(rw / iw, rh / ih);
  const scale = base * (zoom || 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const px = rx + (rw - pw) / 2 + (pan?.x ?? 0) * (pw - rw) * 0.5;
  const py = ry + (rh - ph) / 2 + (pan?.y ?? 0) * (ph - rh) * 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rx, ry, rw, rh);
  ctx.clip();
  ctx.drawImage(photo, px, py, pw, ph);
  ctx.restore();
}

/** Applies the grade: a warm tint wash plus a vignette. */
export function applyGrade(ctx, w, h, grade) {
  const tint = GRADE_TINT[grade] ?? GRADE_TINT.sunset;
  if (tint !== 'rgba(0, 0, 0, 0)') {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }
  if (grade === 'noir') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, w, h);
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** Bold condensed title + subtitle with outline, shadow and a pink underline bar. */
export function drawLettering(ctx, w, h, title, subtitle, grade) {
  const text = (title || '').trim().toUpperCase();
  const sub = (subtitle || '').trim();
  const bandH = h * 0.16;
  const bandY = h - bandH;
  // Dark band so the lettering reads over any photo.
  const band = ctx.createLinearGradient(0, bandY - h * 0.02, 0, h);
  band.addColorStop(0, 'rgba(10, 4, 16, 0)');
  band.addColorStop(0.35, 'rgba(10, 4, 16, 0.72)');
  band.addColorStop(1, 'rgba(10, 4, 16, 0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - h * 0.02, w, bandH + h * 0.02);

  const accent = grade === 'neon' ? '#19e3ff' : grade === 'golden' ? '#ffc233' : grade === 'noir' ? '#e8e8ea' : '#ff2e88';
  // Accent bar sits just above the title's cap height, clear of the glyphs.
  const barW = Math.min(w * 0.42, Math.max(w * 0.1, (text.length || 1) * w * 0.045));
  ctx.fillStyle = accent;
  ctx.fillRect(w * 0.045, bandY + h * 0.006, barW, Math.max(3, h * 0.008));

  if (text) {
    let size = h * 0.085;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    while (ctx.measureText(text).width > w * 0.92 && size > h * 0.02) {
      size -= 2;
      ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const tx = w * 0.045;
    const ty = bandY + bandH * 0.62;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 4, 16, 0.9)';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.shadowColor = 'rgba(255, 46, 136, 0.55)';
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(text, tx, ty);
    // White face with a subtle top-to-bottom pink fade.
    const face = ctx.createLinearGradient(0, ty - size, 0, ty + size * 0.2);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, grade === 'noir' ? '#d8d8de' : '#ffd7ec');
    ctx.fillStyle = face;
    ctx.fillText(text, tx, ty);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (sub) {
    let size = h * 0.026;
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(sub).width > w * 0.9 && size > h * 0.012) {
      size -= 1;
      ctx.font = `600 ${size}px system-ui, sans-serif`;
    }
    ctx.fillStyle = 'rgba(245, 238, 247, 0.92)';
    ctx.textAlign = 'left';
    ctx.fillText(sub, w * 0.045, h - h * 0.035);
  }
}

/**
 * Renders a full cover. `state` holds layout, grade, title, subtitle and
 * panels: [{ photo, pan: {x, y}, zoom }]. `w`/`h` are the output pixels.
 */
export function renderCover(ctx, state, w, h) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawBackdrop(ctx, w, h, state.grade);
  const rects = layoutRects(state.layout, state.panels.length);
  state.panels.forEach((panel, i) => {
    const frac = rects[i];
    if (!frac) return;
    const rect = [frac[0] * w, frac[1] * h, frac[2] * w, frac[3] * h];
    drawPhotoPanel(ctx, panel.photo, rect, panel.pan, panel.zoom);
    // Thin white frame + soft inner shadow so panels read as a poster grid.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.003);
    ctx.strokeRect(rect[0], rect[1], rect[2], rect[3]);
  });
  applyGrade(ctx, w, h, state.grade);
  drawLettering(ctx, w, h, state.title, state.subtitle, state.grade);
  ctx.restore();
}
