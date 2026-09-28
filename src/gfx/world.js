import { C, TILE } from '../config.js';
import { hash2, makeCanvas, mulberry32 } from '../engine/util.js';
import { T, PHASE_PERIOD } from '../game/level.js';

// ---------------------------------------------------------------------------
// Theme palettes
// ---------------------------------------------------------------------------
export const THEMES = {
  meadow: {
    sky: ['#7ea6c6', '#8fb4cf', '#a3c3d6', '#b8d2da', '#cfdfdc', '#e6e9d8'],
    dust: [C.cream2, C.cream3],
    base: C.slate, dark: C.navy2, light: C.slate2,
  },
  caverns: {
    sky: ['#070a14', '#090d1a', '#0b1020', '#0d1326', '#0f162b'],
    dust: [C.slate2, C.blue],
    base: '#26365a', dark: C.navy2, light: C.slate2,
  },
  tower: {
    sky: ['#161a35', '#1f2143', '#2d2750', '#442c58', '#653558', '#8e4250', '#b95a44', '#dd8448'],
    dust: [C.blue2, C.cream3],
    base: C.slate, dark: C.navy2, light: C.blue,
  },
};

const px = (ctx, x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

// ---------------------------------------------------------------------------
// Solid tile painters
// ---------------------------------------------------------------------------
function paintSolid(ctx, lv, tx, ty, theme, secret) {
  const x = tx * TILE, y = ty * TILE;
  const S = (dx, dy) => lv.looksSolid(tx + dx, ty + dy);
  const up = S(0, -1), dn = S(0, 1), lf = S(-1, 0), rt = S(1, 0);
  const h = (k) => hash2(tx, ty, k);
  const th = THEMES[theme];

  px(ctx, x, y, th.base, TILE, TILE);

  if (theme === 'meadow') {
    for (let i = 0; i < 4; i++) px(ctx, x + ((h(i) * 15) | 0), y + ((h(i + 9) * 15) | 0), C.navy2, 2, 1);
    px(ctx, x + ((h(20) * 14) | 0), y + ((h(21) * 14) | 0), C.slate2, 1, 1);
    if (h(30) > 0.55) { const sy = y + 4 + ((h(31) * 9) | 0); px(ctx, x, sy, C.navy2, TILE, 1); px(ctx, x + ((h(32) * 10) | 0), sy - 1, C.slate2, 4, 1); }
    if (up && h(40) < 0.07) { const ox = x + 3 + ((h(41) * 8) | 0), oy = y + 4 + ((h(42) * 7) | 0); px(ctx, ox, oy, C.ink, 4, 4); px(ctx, ox + 1, oy + 1, C.orange, 2, 2); px(ctx, ox + 1, oy + 1, C.gold); }
  } else if (theme === 'caverns') {
    for (let i = 0; i < 5; i++) px(ctx, x + ((h(i) * 15) | 0), y + ((h(i + 9) * 15) | 0), i < 3 ? C.navy2 : C.slate2, i < 2 ? 2 : 1, 1);
    if (h(56) > 0.6) { const sy = y + 3 + ((h(57) * 10) | 0); px(ctx, x, sy, '#202e4d', TILE, 1); }
    if (h(50) < 0.28) {
      const ly = y + 3 + ((h(51) * 10) | 0);
      px(ctx, x, ly, C.teal0, TILE, 1);
      if (h(52) < 0.5) { const nx = x + 2 + ((h(53) * 11) | 0); px(ctx, nx - 1, ly - 1, C.teal0, 3, 3); px(ctx, nx, ly, C.teal2); }
      if (h(54) < 0.4) { const vx = x + 3 + ((h(55) * 10) | 0); px(ctx, vx, Math.min(ly, y + 8), C.teal0, 1, Math.abs(ly - (y + 8)) + 1); }
    }
  } else {
    // tower: riveted panels + corruption
    px(ctx, x, y + 15, C.navy2, TILE, 1); px(ctx, x + 15, y, C.navy2, 1, TILE);
    px(ctx, x, y, C.slate2, TILE, 1); px(ctx, x, y, C.slate2, 1, TILE);
    if ((tx + ty) % 2 === 0) { px(ctx, x + 2, y + 2, C.cream3); px(ctx, x + 13, y + 2, C.cream3); px(ctx, x + 2, y + 13, C.cream3); px(ctx, x + 13, y + 13, C.cream3); }
    if (h(60) < 0.35) { px(ctx, x + 4, y + 5, C.navy2, 8, 1); px(ctx, x + 4, y + 7, C.navy2, 8, 1); px(ctx, x + 4, y + 9, C.navy2, 8, 1); }
    if (h(61) < 0.16) {
      const gx = x + ((h(62) * 10) | 0), gy = y + 2 + ((h(63) * 10) | 0);
      px(ctx, gx, gy, C.mag, 5, 1); px(ctx, gx + 2, gy + 1, C.mag2, 3, 1); px(ctx, gx + 1, gy + 3, C.mag0, 6, 1);
    }
  }

  // Outline on exposed edges
  if (!lf) { px(ctx, x, y, C.ink, 1, TILE); px(ctx, x + 1, y, th.light, 1, TILE); }
  if (!rt) { px(ctx, x + 15, y, C.ink, 1, TILE); px(ctx, x + 14, y, th.dark, 1, TILE); }
  if (!dn) { px(ctx, x, y + 15, C.ink, TILE, 1); px(ctx, x, y + 14, th.dark, TILE, 1); }

  if (!up) {
    if (theme === 'meadow') {
      px(ctx, x, y, C.ink, TILE, 1);
      px(ctx, x, y + 1, C.mint, TILE, 1);
      px(ctx, x, y + 2, C.teal2, TILE, 2);
      px(ctx, x, y + 4, C.teal, TILE, 1);
      for (let i = 0; i < 16; i++) {
        const len = (hash2(tx * 16 + i, ty, 7) * 4) | 0;
        if (len > 0) px(ctx, x + i, y + 5, i % 3 ? C.teal : C.teal0, 1, len);
      }
    } else if (theme === 'caverns') {
      px(ctx, x, y, C.ink, TILE, 1);
      px(ctx, x, y + 1, C.blue2, TILE, 1);
      px(ctx, x, y + 2, C.blue, TILE, 1);
      px(ctx, x, y + 3, C.slate2, TILE, 1);
      for (let i = 0; i < 16; i += 1) if (hash2(tx * 16 + i, ty, 3) < 0.25) px(ctx, x + i, y + 4, C.teal, 1, 1 + ((hash2(i, tx, 4) * 3) | 0));
    } else {
      px(ctx, x, y, C.ink, TILE, 1);
      px(ctx, x, y + 1, C.cream3, TILE, 1);
      px(ctx, x, y + 2, C.blue2, TILE, 1);
      px(ctx, x, y + 3, C.blue, TILE, 1);
      px(ctx, x, y + 4, C.navy2, TILE, 1);
    }
    if (!lf) { px(ctx, x, y, 'rgba(0,0,0,0)'); ctx.clearRect(x, y, 1, 1); px(ctx, x + 1, y + 1, C.ink); }
    if (!rt) { ctx.clearRect(x + 15, y, 1, 1); px(ctx, x + 14, y + 1, C.ink); }
  }
  if (!dn && !lf) { ctx.clearRect(x, y + 15, 1, 1); px(ctx, x + 1, y + 14, C.ink); }
  if (!dn && !rt) { ctx.clearRect(x + 15, y + 15, 1, 1); px(ctx, x + 14, y + 14, C.ink); }

  if (secret && (!up || !dn || !lf || !rt)) {
    // Subtle tell on exposed fake rock: hairline cracks.
    px(ctx, x + 5, y + 6, C.ink, 3, 1); px(ctx, x + 7, y + 7, C.ink, 1, 2); px(ctx, x + 8, y + 9, C.ink, 2, 1);
    if (h(70) < 0.5) { px(ctx, x + 11, y + 11, th.light, 2, 1); }
  }
}

function paintSurfaceDetail(ctx, lv, tx, ty, theme) {
  // Decorations growing into the empty tile above / below.
  const x = tx * TILE, y = ty * TILE;
  const aboveEmpty = lv.tileAt(tx, ty - 1) === T.EMPTY && ty > 0;
  const belowEmpty = lv.tileAt(tx, ty + 1) === T.EMPTY && ty < lv.h - 1;
  const h = (k) => hash2(tx, ty, k + 100);
  if (theme === 'meadow' && aboveEmpty) {
    for (let i = 0; i < 3; i++) {
      if (h(i) < 0.6) {
        const gx = x + ((h(i + 5) * 15) | 0), gh = 1 + ((h(i + 8) * 3) | 0);
        px(ctx, gx, y - gh, C.teal2, 1, gh);
        if (gh > 2) px(ctx, gx + 1, y - 2, C.teal, 1, 2);
      }
    }
    if (h(20) < 0.16) { const fx = x + 3 + ((h(21) * 10) | 0); px(ctx, fx, y - 3, C.teal, 1, 3); px(ctx, fx - 1, y - 5, C.ink, 3, 3); px(ctx, fx, y - 4, h(22) < 0.5 ? C.cream : C.orange2); }
  }
  if (theme === 'caverns') {
    if (aboveEmpty && h(30) < 0.12) {
      const cx = x + 3 + ((h(31) * 9) | 0);
      px(ctx, cx - 1, y - 6, C.ink, 4, 6); px(ctx, cx, y - 5, C.orange, 2, 5); px(ctx, cx, y - 5, C.gold, 1, 2);
      px(ctx, cx + 2, y - 3, C.ink, 3, 3); px(ctx, cx + 3, y - 2, C.orange0, 1, 2);
    }
    if (belowEmpty && h(40) < 0.4) {
      const sx = x + 2 + ((h(41) * 11) | 0), sl = 2 + ((h(42) * 4) | 0);
      for (let i = 0; i < sl; i++) { const w = Math.max(1, 3 - Math.floor(i * 3 / sl)); px(ctx, sx + Math.floor((3 - w) / 2), y + 16 + i, i === sl - 1 ? C.ink : C.navy2, w, 1); }
    }
    if (belowEmpty && h(43) < 0.15) { const rx = x + ((h(44) * 14) | 0); px(ctx, rx, y + 16, C.teal0, 1, 3 + ((h(45) * 5) | 0)); }
  }
  if (theme === 'tower') {
    if (belowEmpty && h(50) < 0.2) { const cx = x + 3 + ((h(51) * 9) | 0); const len = 3 + ((h(52) * 6) | 0); px(ctx, cx, y + 16, C.ink, 1, len); px(ctx, cx - 1, y + 16 + len, C.ink, 3, 2); px(ctx, cx, y + 16 + len, C.orange2); }
    if (aboveEmpty && h(53) < 0.1) { const bx = x + 2 + ((h(54) * 8) | 0); px(ctx, bx, y - 3, C.ink, 5, 3); px(ctx, bx + 1, y - 2, C.slate2, 3, 1); px(ctx, bx + 2, y - 2, C.mag2); }
  }
}

function paintOneWay(ctx, tx, ty, theme) {
  const x = tx * TILE, y = ty * TILE;
  if (theme === 'meadow') {
    px(ctx, x, y, C.ink, TILE, 6);
    px(ctx, x, y + 1, C.orange2, TILE, 1);
    px(ctx, x, y + 2, C.orange, TILE, 2);
    px(ctx, x, y + 4, C.orange0, TILE, 1);
    px(ctx, x + 3, y + 2, C.orange0); px(ctx, x + 12, y + 2, C.orange0);
    if (tx % 2 === 0) { px(ctx, x + 6, y + 6, C.ink, 3, 3); px(ctx, x + 7, y + 6, C.orange0, 1, 2); }
  } else if (theme === 'caverns') {
    px(ctx, x, y, C.ink, TILE, 6);
    px(ctx, x, y + 1, C.blue2, TILE, 1);
    px(ctx, x, y + 2, C.slate2, TILE, 3);
    for (let i = 1; i < 16; i += 3) px(ctx, x + i, y + 3, C.ink, 2, 1);
  } else {
    px(ctx, x, y, C.ink, TILE, 7);
    px(ctx, x, y + 1, C.cream3, TILE, 1);
    px(ctx, x, y + 2, C.blue, TILE, 4);
    for (let i = 0; i < 16; i += 4) { px(ctx, x + i, y + 2, C.ink, 1, 4); px(ctx, x + i + 1, y + 3, C.ink, 2, 1); }
  }
}

function paintSpikes(ctx, tx, ty, down) {
  const x = tx * TILE, y = ty * TILE;
  const s = (sx) => {
    for (let i = 0; i < 8; i++) {
      const w = Math.max(1, Math.floor(i / 2) * 2 + 1);
      const yy = down ? y + i : y + 15 - i;
      const half = Math.floor(w / 2);
      const cx = x + sx;
      px(ctx, cx - half - 1, yy, C.ink, w + 2, 1);
      px(ctx, cx - half, yy, i >= 6 ? C.cream : C.cream2, w, 1);
      if (w >= 3) px(ctx, cx + 1, yy, C.cream3, half, 1);
    }
    px(ctx, x + sx, down ? y + 8 : y + 7, C.white);
  };
  s(3); s(8); s(13);
  px(ctx, x, down ? y : y + 14, C.ink, TILE, 2);
  px(ctx, x, down ? y + 1 : y + 14, C.mag, TILE, 1);
}

// ---------------------------------------------------------------------------
// Decor props (drawn behind tiles)
// ---------------------------------------------------------------------------
function paintDecor(ctx, d, theme, rand) {
  const x = d.x, y = d.y; // y = ground line
  if (theme === 'meadow') {
    if (d.kind === 't') {
      // Data tree: stacked pixel-cube canopy.
      px(ctx, x + 6, y - 22, C.ink, 5, 22); px(ctx, x + 7, y - 22, C.slate2, 2, 22); px(ctx, x + 9, y - 22, C.slate, 1, 22);
      const blocks = [[-4, -38, 14, 10], [4, -44, 12, 10], [-9, -30, 12, 9], [8, -32, 13, 10], [0, -30, 12, 8]];
      for (const [bx, by, w, h] of blocks) {
        px(ctx, x + bx, y + by, C.ink, w + 2, h + 2);
        px(ctx, x + bx + 1, y + by + 1, C.teal, w, h);
        px(ctx, x + bx + 1, y + by + 1, C.teal2, w, 2);
        px(ctx, x + bx + 1, y + by + 1, C.mint, Math.floor(w / 2), 1);
        px(ctx, x + bx + 1, y + by + h - 1, C.teal0, w, 1);
      }
      px(ctx, x + 2, y - 36, C.orange2, 2, 2); px(ctx, x + 14, y - 28, C.orange2, 2, 2);
    } else if (d.kind === 'r') {
      px(ctx, x + 2, y - 8, C.ink, 13, 8); px(ctx, x + 3, y - 7, C.teal, 11, 7); px(ctx, x + 3, y - 7, C.teal2, 6, 2); px(ctx, x + 5, y - 10, C.ink, 6, 3); px(ctx, x + 6, y - 9, C.teal2, 4, 2);
    } else if (d.kind === 'y') {
      // Toppled signal post: story prop.
      px(ctx, x + 7, y - 30, C.ink, 3, 30); px(ctx, x + 8, y - 30, C.slate2, 1, 30);
      for (let i = 0; i < 4; i++) { px(ctx, x + 4, y - 26 + i * 7, C.ink, 9, 1); }
      px(ctx, x + 3, y - 35, C.ink, 11, 6); px(ctx, x + 4, y - 34, C.cream2, 9, 4); px(ctx, x + 6, y - 33, C.slate, 5, 2);
      px(ctx, x + 12, y - 38, C.ink, 3, 3); px(ctx, x + 13, y - 37, C.mag);
    }
  } else if (theme === 'caverns') {
    if (d.kind === 't') {
      const shards = [[0, 22, 5], [5, 30, 6], [11, 18, 5], [15, 12, 4]];
      for (const [sx, h, w] of shards) {
        px(ctx, x + sx, y - h, C.ink, w + 2, h);
        px(ctx, x + sx + 1, y - h + 1, C.teal, w, h - 1);
        px(ctx, x + sx + 1, y - h + 1, C.mint, 1, h - 3);
        px(ctx, x + sx + 2, y - h - 2, C.ink, w - 2, 2);
      }
    } else if (d.kind === 'r') {
      px(ctx, x + 1, y - 7, C.ink, 14, 7); px(ctx, x + 2, y - 6, C.slate, 12, 6); px(ctx, x + 2, y - 6, C.slate2, 5, 2); px(ctx, x + 9, y - 3, C.teal0, 4, 1);
    } else if (d.kind === 'y') {
      px(ctx, x + 2, y - 40, C.ink, 12, 40); px(ctx, x + 3, y - 39, C.navy2, 10, 38);
      for (let i = 0; i < 5; i++) { px(ctx, x + 5, y - 35 + i * 7, C.ink, 6, 3); px(ctx, x + 6, y - 34 + i * 7, i % 2 ? C.teal : C.orange, 2, 1); }
    }
  } else {
    if (d.kind === 't') {
      px(ctx, x, y - 44, C.ink, 18, 44); px(ctx, x + 1, y - 43, C.navy2, 16, 42);
      for (let i = 0; i < 6; i++) { px(ctx, x + 2, y - 41 + i * 7, C.slate, 14, 5); px(ctx, x + 3, y - 39 + i * 7, rand() < 0.5 ? C.teal2 : C.mag2); px(ctx, x + 5, y - 39 + i * 7, C.ink, 9, 1); }
    } else if (d.kind === 'r') {
      px(ctx, x + 1, y - 10, C.ink, 14, 10); px(ctx, x + 2, y - 9, C.slate, 12, 8); px(ctx, x + 2, y - 9, C.blue, 12, 1); px(ctx, x + 4, y - 6, C.orange, 8, 1); px(ctx, x + 4, y - 4, C.ink, 8, 1);
    } else if (d.kind === 'y') {
      px(ctx, x + 1, y - 22, C.ink, 16, 14); px(ctx, x + 2, y - 21, C.navy, 14, 12);
      px(ctx, x + 3, y - 19, C.mag, 6, 1); px(ctx, x + 6, y - 16, C.teal2, 8, 1); px(ctx, x + 3, y - 13, C.mag2, 4, 1);
      px(ctx, x + 8, y - 8, C.ink, 2, 8);
    }
  }
}

/** Pre-render every static tile + prop of a level. */
export function buildLevelLayers(lv) {
  const theme = lv.theme;
  const [canvas, ctx] = makeCanvas(lv.pxW, lv.pxH);
  const [secret, sctx] = makeCanvas(lv.pxW, lv.pxH);
  const rand = mulberry32(lv.w * 31 + lv.h);
  for (const d of lv.decor) paintDecor(ctx, d, theme, rand);
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.w; tx++) {
      const t = lv.tiles[ty * lv.w + tx];
      if (t === T.SOLID) paintSolid(ctx, lv, tx, ty, theme, false);
      else if (t === T.FALSE) paintSolid(sctx, lv, tx, ty, theme, true);
      else if (t === T.ONEWAY) {
        paintOneWay(ctx, tx, ty, theme);
        if (lv.hiddenOneWay.has(ty * lv.w + tx)) paintSolid(sctx, lv, tx, ty, theme, true);
      }
      else if (t === T.SPIKE_UP) paintSpikes(ctx, tx, ty, false);
      else if (t === T.SPIKE_DOWN) paintSpikes(ctx, tx, ty, true);
    }
  }
  for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
    if (lv.tiles[ty * lv.w + tx] === T.SOLID) paintSurfaceDetail(ctx, lv, tx, ty, theme);
  }
  // Cache pit tiles for animated drawing.
  const pits = [];
  for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
    if (lv.tiles[ty * lv.w + tx] === T.PIT) pits.push({ tx, ty, surface: lv.tileAt(tx, ty - 1) !== T.PIT });
  }
  return { canvas, secret, pits };
}

// ---------------------------------------------------------------------------
// Dynamic tiles (drawn every frame)
// ---------------------------------------------------------------------------
export function drawPits(ctx, layers, cx, cy, vw, vh, t) {
  for (const p of layers.pits) {
    const x = p.tx * TILE - cx, y = p.ty * TILE - cy;
    if (x < -16 || x > vw || y < -16 || y > vh) continue;
    if (p.surface) {
      for (let i = 0; i < 16; i++) {
        const wx = p.tx * 16 + i;
        const off = Math.round(Math.sin(wx * 0.35 + t * 3.2) * 1.2 + Math.sin(wx * 0.13 - t * 1.7));
        const top = 5 + off;
        px(ctx, x + i, y + top, C.pink, 1, 1);
        px(ctx, x + i, y + top + 1, C.mag2, 1, 2);
        px(ctx, x + i, y + top + 3, C.mag, 1, 16 - top - 3);
      }
      if (((p.tx * 7 + Math.floor(t * 2)) % 11) === 0) {
        const bt = (t * 2) % 1;
        px(ctx, x + 6, y + 14 - Math.floor(bt * 9), C.pink, 2, 2);
      }
    } else {
      px(ctx, x, y, C.mag, TILE, TILE);
      for (let i = 0; i < 3; i++) px(ctx, x + ((hash2(p.tx, p.ty, i) * 14) | 0), y + ((hash2(p.tx, p.ty, i + 5) * 14) | 0), C.mag0, 2, 2);
    }
  }
}

export function drawDynamicBlocks(ctx, lv, cx, cy, vw, vh, t, sprites) {
  for (const b of lv.dyn.values()) {
    const x = b.tx * TILE - cx, y = b.ty * TILE - cy;
    if (x < -16 || x > vw || y < -16 || y > vh) continue;
    if (b.kind === T.VANISH) {
      if (b.state === 'gone') {
        const k = b.t < 0.5 ? 1 : 0;
        ctx.globalAlpha = k ? 0.6 : 0.3;
        dashedRect(ctx, x, y, C.blue2, t);
        ctx.globalAlpha = 1;
        continue;
      }
      const crumbling = b.state === 'crumble';
      const jx = crumbling ? Math.round((Math.random() - 0.5) * 2) : 0;
      px(ctx, x + jx, y, C.ink, TILE, TILE);
      px(ctx, x + jx + 1, y + 1, crumbling ? C.cream2 : C.sky2, 14, 14);
      px(ctx, x + jx + 1, y + 1, C.white, 14, 2);
      px(ctx, x + jx + 2, y + 12, C.blue2, 12, 2);
      // digital grid pattern
      for (let i = 3; i < 13; i += 4) px(ctx, x + jx + i, y + 5, C.blue2, 2, 2);
      if (crumbling) for (let i = 0; i < 6; i++) ctx.clearRect(x + jx + ((Math.random() * 14) | 0) + 1, y + ((Math.random() * 14) | 0) + 1, 2, 2);
      if (b.t > 0 && b.state === 'solid') { ctx.globalAlpha = b.t * 3; px(ctx, x, y, C.white, 16, 16); ctx.globalAlpha = 1; }
    } else {
      const a = b.kind === T.PHASE_A;
      const main = a ? C.teal2 : C.orange2, hi = a ? C.mint : C.gold, dk = a ? C.teal0 : C.orange0;
      if (b.solid) {
        const blink = b.warn && Math.floor(t * 14) % 2 === 0;
        px(ctx, x, y, C.ink, TILE, TILE);
        px(ctx, x + 1, y + 1, blink ? hi : main, 14, 14);
        px(ctx, x + 1, y + 1, hi, 14, 1);
        px(ctx, x + 1, y + 14, dk, 14, 1);
        px(ctx, x + 4, y + 4, dk, 8, 8);
        px(ctx, x + 5, y + 5, blink ? main : hi, 6, 6);
        px(ctx, x + 6, y + 6, dk, 4, 4);
      } else {
        ctx.globalAlpha = b.pending ? 0.7 : 0.45;
        dashedRect(ctx, x, y, main, t);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function dashedRect(ctx, x, y, color, t) {
  ctx.fillStyle = color;
  const o = Math.floor(t * 8) % 4;
  for (let i = 0; i < 16; i++) {
    if ((i + o) % 4 < 2) {
      ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + 15 - i, y + 15, 1, 1);
      ctx.fillRect(x, y + 15 - i, 1, 1); ctx.fillRect(x + 15, y + i, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Parallax backgrounds
// ---------------------------------------------------------------------------
const BG_W = 640;

function hills(ctx, rand, baseY, amp, color, top, w = BG_W) {
  let hgt = baseY;
  const cols = [];
  for (let x = 0; x < w; x += 2) {
    const a = (x / w) * Math.PI * 2;
    hgt = baseY - (Math.sin(a * 2 + 1) * 0.5 + Math.sin(a * 5 + 2) * 0.3 + Math.sin(a * 3) * 0.2 + 1) * amp;
    cols.push(Math.round(hgt));
  }
  // step-quantise heights for pixel look
  cols.forEach((h, i) => {
    const qh = Math.round(h / 2) * 2;
    px(ctx, i * 2, qh, color, 2, 400);
    if (top) px(ctx, i * 2, qh, top, 2, 1);
  });
  return cols;
}

function buildMeadowBg() {
  const rand = mulberry32(7);
  const layers = [];
  // clouds
  {
    const [c, ctx] = makeCanvas(BG_W, 120);
    for (let i = 0; i < 7; i++) {
      const x = (i * 97 + rand() * 40) | 0, y = 10 + ((rand() * 70) | 0), w = 26 + ((rand() * 40) | 0);
      px(ctx, x, y + 4, '#e9eee6', w, 5);
      px(ctx, x + 6, y, '#f4f3ea', w - 16, 5);
      px(ctx, x + 12, y - 3, '#f4f3ea', Math.max(8, w - 30), 4);
      px(ctx, x + 2, y + 9, '#c7d8dc', w - 4, 2);
    }
    layers.push({ c, f: 0.04, fy: 0.02, y: 8, drift: 3 });
  }
  // far hills with broken towers
  {
    const [c, ctx] = makeCanvas(BG_W, 140);
    const cols = hills(ctx, rand, 110, 28, '#8aa8c4', '#a6bfd3');
    for (let i = 0; i < 4; i++) {
      const tx = 60 + i * 160 + ((rand() * 40) | 0);
      const top = cols[(tx / 2) | 0] - 34;
      ctx.fillStyle = '#7897b6';
      ctx.fillRect(tx, top, 2, 36);
      for (let k = 0; k < 4; k++) ctx.fillRect(tx - 3 + k, top + 8 + k * 7, 8 - k * 2, 1);
      ctx.fillRect(tx - 2, top - 2, 6, 2);
      if (i % 2) { ctx.fillRect(tx + 2, top + 4, 6, 1); }
    }
    layers.push({ c, f: 0.12, fy: 0.06, y: 70 });
  }
  // mid hills with cube trees
  {
    const [c, ctx] = makeCanvas(BG_W, 140);
    const cols = hills(ctx, rand, 110, 22, '#5b8f98', '#74a8a8');
    for (let i = 0; i < 12; i++) {
      const tx = ((rand() * BG_W) | 0) & ~1, base = cols[(tx / 2) | 0];
      px(ctx, tx + 3, base - 10, '#4a7a84', 2, 10);
      px(ctx, tx, base - 18, '#4f838a', 9, 9);
      px(ctx, tx, base - 18, '#6aa3a3', 9, 2);
    }
    layers.push({ c, f: 0.3, fy: 0.15, y: 96 });
  }
  return { layers, sky: THEMES.meadow.sky, ground: '#5b8f98', motes: { color: '#fff8ec', n: 14, rise: -6 } };
}

function buildCavernBg() {
  const rand = mulberry32(21);
  const layers = [];
  {
    const [c, ctx] = makeCanvas(BG_W, 225);
    // ceiling teeth and floor ridge
    for (let x = 0; x < BG_W; x += 4) {
      const h = 20 + Math.round((Math.sin(x * 0.05) * 0.5 + 0.5) * 30 + rand() * 12);
      px(ctx, x, 0, '#0c1222', 4, h);
      const fh = 30 + Math.round((Math.sin(x * 0.03 + 1) * 0.5 + 0.5) * 30 + rand() * 6);
      px(ctx, x, 225 - fh, '#0c1222', 4, fh);
    }
    for (let i = 0; i < 26; i++) px(ctx, (rand() * BG_W) | 0, 70 + ((rand() * 90) | 0), rand() < 0.7 ? '#1d4b55' : '#6b3a2a', 1, 1);
    layers.push({ c, f: 0.1, fy: 0.05, y: 0, full: true });
  }
  {
    const [c, ctx] = makeCanvas(BG_W, 225);
    for (let i = 0; i < 7; i++) {
      const x = (i * 92 + rand() * 30) | 0, w = 10 + ((rand() * 12) | 0);
      px(ctx, x, 0, '#111a2f', w, 225);
      px(ctx, x + 1, 0, '#16213a', 2, 225);
      for (let y = 20; y < 225; y += 26 + ((rand() * 20) | 0)) { px(ctx, x - 2, y, '#0c1222', w + 4, 3); if (rand() < 0.5) px(ctx, x + 3, y + 1, rand() < 0.5 ? '#2a8a80' : '#b0602e'); }
    }
    // hanging cables
    for (let i = 0; i < 10; i++) {
      const x0 = (rand() * BG_W) | 0, span = 30 + ((rand() * 50) | 0), sag = 8 + ((rand() * 14) | 0), y0 = 8 + ((rand() * 40) | 0);
      for (let k = 0; k <= span; k++) { const u = k / span; px(ctx, x0 + k, y0 + Math.round(Math.sin(u * Math.PI) * sag), '#0a0f1d'); }
    }
    layers.push({ c, f: 0.28, fy: 0.12, y: 0, full: true });
  }
  return { layers, sky: THEMES.caverns.sky, ground: '#0c1222', motes: { color: '#5a7fae', n: 18, rise: 4 } };
}

function buildTowerBg() {
  const rand = mulberry32(99);
  const layers = [];
  {
    const [c, ctx] = makeCanvas(BG_W, 90);
    for (let i = 0; i < 60; i++) px(ctx, (rand() * BG_W) | 0, (rand() * 80) | 0, rand() < 0.8 ? '#8d87b0' : '#f3e6c9');
    layers.push({ c, f: 0.02, fy: 0.01, y: 0, stars: true });
  }
  {
    const [c, ctx] = makeCanvas(BG_W, 140);
    let x = 0;
    while (x < BG_W) {
      const w = 12 + ((rand() * 24) | 0), h = 20 + ((rand() * 60) | 0);
      px(ctx, x, 140 - h, '#2a2344', w, h);
      for (let wy = 140 - h + 4; wy < 136; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rand() < 0.18) px(ctx, wx, wy, '#9a4a48');
      if (rand() < 0.4) { px(ctx, x + (w >> 1), 140 - h - 10, '#2a2344', 1, 10); }
      x += w + ((rand() * 6) | 0);
    }
    layers.push({ c, f: 0.1, fy: 0.05, y: 100 });
  }
  {
    const [c, ctx] = makeCanvas(BG_W, 225);
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 210 + ((rand() * 40) | 0), top = 10 + ((rand() * 40) | 0), w = 26;
      px(ctx, x, top, '#1d1a36', w, 225);
      for (let y = top; y < 225; y += 12) {
        for (let k = 0; k < 12; k++) { px(ctx, x + Math.round(k * w / 12), y + k, '#16142c'); px(ctx, x + w - 1 - Math.round(k * w / 12), y + k, '#16142c'); }
      }
      px(ctx, x + 12, top - 20, '#1d1a36', 2, 20);
      px(ctx, x + 11, top - 22, '#e4497a', 4, 2);
    }
    layers.push({ c, f: 0.22, fy: 0.1, y: 0, full: true, blink: true });
  }
  return { layers, sky: THEMES.tower.sky, ground: '#1d1a36', motes: { color: '#e4497a', alt: '#38b39b', n: 16, rise: -12, glitch: true } };
}

export function buildBackground(theme) {
  if (theme === 'caverns') return buildCavernBg();
  if (theme === 'tower') return buildTowerBg();
  return buildMeadowBg();
}

/** Draw sky bands + parallax layers + ambient motes. */
export function drawBackground(ctx, bg, cam, levelPxH, vw, vh, t, reduced) {
  const bands = bg.sky;
  const bh = Math.ceil(vh / bands.length);
  for (let i = 0; i < bands.length; i++) {
    px(ctx, 0, i * bh, bands[i], vw, bh);
    if (i > 0) {
      // 1px dither seam between bands
      ctx.fillStyle = bands[i - 1];
      for (let x = (i % 2); x < vw; x += 2) ctx.fillRect(x, i * bh, 1, 1);
    }
  }
  const camBottom = Math.max(0, levelPxH - vh);
  const rel = cam.y - camBottom; // <= 0 when camera is above the bottom
  for (const L of bg.layers) {
    const drift = L.drift ? t * L.drift : 0;
    let ox = -Math.round((cam.x * L.f + drift) % BG_W);
    if (ox > 0) ox -= BG_W;
    const oy = Math.round(L.y - rel * L.fy);
    for (let x = ox; x < vw; x += BG_W) ctx.drawImage(L.c, x, oy);
    if (!L.full && oy + L.c.height < vh) {
      // extend the layer's bottom colour downwards
      const col = bg.ground;
      if (L === bg.layers[bg.layers.length - 1]) px(ctx, 0, oy + L.c.height, col, vw, vh - oy - L.c.height);
    }
    if (L.stars && !reduced) {
      for (let i = 0; i < 6; i++) {
        const sx = (Math.floor(hash2(i, Math.floor(t * 0.7), 3) * vw)), sy = Math.floor(hash2(i, Math.floor(t * 0.7), 4) * 70);
        px(ctx, sx, sy, C.cream);
      }
    }
  }
  // Ambient motes
  const m = bg.motes;
  if (m) {
    const n = reduced ? Math.floor(m.n / 2) : m.n;
    for (let i = 0; i < n; i++) {
      const sp = 0.3 + hash2(i, 1, 9) * 0.5;
      const x = ((hash2(i, 2, 9) * (vw + 40) - cam.x * sp * 0.5 + Math.sin(t * 0.6 + i) * 6) % (vw + 40) + vw + 40) % (vw + 40) - 20;
      const y = ((hash2(i, 3, 9) * vh + t * m.rise * (0.6 + sp) - (cam.y - camBottom) * 0.2) % vh + vh) % vh;
      const c = m.alt && i % 3 === 0 ? m.alt : m.color;
      ctx.globalAlpha = 0.35 + 0.35 * ((Math.sin(t * 2 + i) + 1) / 2);
      px(ctx, Math.round(x), Math.round(y), c, m.glitch && i % 4 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

export { PHASE_PERIOD };
