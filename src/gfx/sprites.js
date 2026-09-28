import { C } from '../config.js';
import { makeCanvas } from '../engine/util.js';

// Procedurally *authored* pixel art. Each sprite is built from hand-placed
// pixel primitives at a fixed 1:1 scale, then cached (both facings).

const VISOR = '#172038';

/** Pixel rounded rect: r=1 cuts single corner pixels, r=2 a 2-step corner. */
function rr(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < h; i++) {
    let inset = 0;
    if (r >= 2) inset = i === 0 || i === h - 1 ? 2 : i === 1 || i === h - 2 ? 1 : 0;
    else if (r === 1) inset = i === 0 || i === h - 1 ? 1 : 0;
    ctx.fillRect(x + inset, y + i, w - inset * 2, 1);
  }
}
function px(ctx, x, y, color, w = 1, h = 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r + r * 0.8) ctx.fillRect(cx + x, cy + y, 1, 1);
  }
}

function flipped(src) {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function both(src) { return { 1: src, [-1]: flipped(src) }; }

// ---------------------------------------------------------------------------
// PIP
// ---------------------------------------------------------------------------
export const PIP_W = 24, PIP_H = 24;

function drawPip(ctx, o) {
  const bw = o.bw ?? 12, bh = o.bh ?? 10;
  const bx = 12 - Math.floor(bw / 2) + (o.lean ?? 0);
  const by = 20 - bh + (o.bob ?? 0);
  const legY = 19;

  // Legs (behind body)
  const leg = (lx, ly, back) => {
    px(ctx, lx, ly, C.ink, 4, 5 + (o.legLong ?? 0));
    px(ctx, lx + 1, ly + 1, back ? C.slate : C.slate2, 2, 3 + (o.legLong ?? 0));
    px(ctx, lx + 1, ly + 3 + (o.legLong ?? 0), back ? C.navy2 : C.slate, 2, 1);
  };
  const L = o.legs || [[0, 0], [0, 0]];
  const lx1 = 12 - 5, lx2 = 12 + 1;
  leg(lx1 + L[0][0], legY + L[0][1], true);
  leg(lx2 + L[1][0], legY + L[1][1], false);

  // Backpack transmitter
  const bpx = bx - 3, bpy = by + 3;
  px(ctx, bpx, bpy, C.ink, 5, 6);
  px(ctx, bpx + 1, bpy + 1, C.orange, 3, 4);
  px(ctx, bpx + 1, bpy + 4, C.orange0, 3, 1);
  px(ctx, bpx + 1, bpy + 1, C.orange2, 1, 1);
  px(ctx, bpx + 2, bpy + 2, o.packLight ? C.gold : C.orange0, 1, 1);

  // Antenna
  const ax = bx + 4, lean = o.ant ?? 0;
  px(ctx, ax, by - 2, C.ink, 1, 2);
  px(ctx, ax + Math.sign(lean) * (Math.abs(lean) > 1 ? 1 : 0), by - 3, C.ink, 1, 1);
  const tx = ax + lean - 1, ty = by - 6;
  px(ctx, tx, ty, C.ink, 4, 4);
  px(ctx, tx + 1, ty + 1, o.tipOn === false ? C.orange0 : C.orange2, 2, 2);
  if (o.tipOn !== false) px(ctx, tx + 1, ty + 1, C.gold, 1, 1);

  // Body shell
  rr(ctx, bx, by, bw, bh, 2, C.ink);
  rr(ctx, bx + 1, by + 1, bw - 2, bh - 2, 1, C.cream);
  px(ctx, bx + 2, by + bh - 3, C.cream2, bw - 4, 1);
  px(ctx, bx + 1, by + 3, C.cream2, 1, Math.max(1, bh - 6));
  px(ctx, bx + 2, by + 2, C.white, 2, 1);
  px(ctx, bx + 2, by + 3, C.white, 1, 1);
  // Belly band (orange accent)
  if (bh >= 9) px(ctx, bx + 2, by + bh - 4, C.cream2, bw - 4, 1);

  // Visor (front-top), leaves a cream cheek at the front edge
  const vw = Math.min(6, bw - 5), vh = bh >= 10 ? 4 : 3;
  const vx = bx + bw - vw - 2, vy = by + 2 + (bh >= 12 ? 1 : 0);
  rr(ctx, vx, vy, vw, vh, 1, VISOR);
  px(ctx, vx + vw - 1, vy + 1, C.slate, 1, 1); // glass glint

  // Eyes
  const look = o.look ?? 0;
  const e1 = vx + vw - 4, e2 = vx + vw - 2;
  const ey = vy + 1 + (look > 0 && vh >= 4 ? 1 : 0) - (look < 0 && vh >= 4 ? 0 : 0);
  const eye = o.eye || 'open';
  const EC = C.mint;
  for (const ex of [e1, e2]) {
    if (eye === 'open') px(ctx, ex, ey, EC, 1, Math.min(2, vh - 1 - (ey - vy)));
    else if (eye === 'blink') px(ctx, ex, vy + vh - 2, EC, 1, 1);
    else if (eye === 'focus') px(ctx, ex, vy + 1, EC, 1, 1);
    else if (eye === 'happy') { px(ctx, ex, vy + 1, EC); }
    else if (eye === 'hurt') px(ctx, ex, vy + 1, C.pink, 1, 2);
  }
  if (eye === 'happy') { px(ctx, e1 - 1, vy + 2, EC); px(ctx, e2 + 1 > vx + vw - 1 ? e2 : e2 + 1, vy + 2, EC); px(ctx, e1 + 1, vy + 2, EC); }
  if (eye === 'focus') { px(ctx, e1, vy + 2, EC, e2 - e1 + 1, 1); }
  if (eye === 'hurt') { px(ctx, e1 + 1, vy + 2, C.pink); }

  // Arm: a small paddle on the near side, below the visor
  if (o.arm !== null) {
    const a = o.arm || [0, 0];
    const armX = bx + 2 + a[0], armY = by + bh - 5 + a[1];
    px(ctx, armX, armY, C.ink, 4, 4);
    px(ctx, armX + 1, armY, C.cream, 2, 2);
    px(ctx, armX + 1, armY + 2, C.cream2, 2, 1);
  }
}

function pipFrames() {
  const frames = {};
  const make = (name, o) => {
    const [c, ctx] = makeCanvas(PIP_W, PIP_H);
    drawPip(ctx, o);
    frames[name] = both(c);
  };
  make('idle0', {});
  make('idle1', { bob: 1, legs: [[0, 0], [0, 0]], tipOn: false });
  make('blink0', { eye: 'blink' });
  make('blink1', { eye: 'blink', bob: 1, tipOn: false });
  for (let i = 0; i < 6; i++) {
    const ph = (i / 6) * Math.PI * 2;
    const l = (p) => [Math.round(Math.cos(p) * 1.6), -Math.max(0, Math.round(Math.sin(p) * 2))];
    make('run' + i, {
      legs: [l(ph), l(ph + Math.PI)],
      bob: i % 3 === 0 ? 0 : -1,
      ant: i % 3 === 0 ? -1 : 0,
      arm: [Math.round(-Math.cos(ph) * 1.5), 0],
      tipOn: i < 3,
    });
  }
  make('stretch', { bw: 10, bh: 12, legs: [[0, -1], [0, -1]], legLong: 1, ant: -1, look: -1, arm: [0, 1] });
  make('jump', { legs: [[1, -1], [-1, 0]], ant: -1, arm: [-1, -1] });
  make('apex', { legs: [[1, -1], [0, -1]], ant: 0, arm: [0, -2] });
  make('fall', { legs: [[-1, 0], [1, 1]], ant: 1, arm: [-1, -3], look: 1 });
  make('squash', { bw: 14, bh: 8, legs: [[-1, 0], [1, 0]], ant: 1, arm: [0, 1] });
  make('dash', { lean: 1, legs: [[-2, -1], [-1, -2]], ant: -3, eye: 'focus', arm: [-2, 0], packLight: true });
  make('hurt', { lean: -1, legs: [[-1, 0], [1, -1]], ant: 2, eye: 'hurt', arm: [-1, -2], tipOn: false });
  make('cheer0', { eye: 'happy', arm: [-1, -4], ant: 0, packLight: true });
  make('cheer1', { eye: 'happy', bob: -2, legs: [[0, -2], [0, -2]], arm: [-1, -5], ant: -1, packLight: true });
  return frames;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------
function hopperFrame(o) {
  const [c, ctx] = makeCanvas(18, 16);
  const bw = o.bw ?? 12, bh = o.bh ?? 10;
  const bx = 9 - Math.floor(bw / 2), by = 15 - bh - (o.air ? 2 : 1);
  // feet
  if (!o.flat) {
    const fy = o.air ? by + bh - 1 : 13;
    px(ctx, bx + 1, fy, C.ink, 4, 3); px(ctx, bx + 2, fy + 1, C.mag0, 2, 1);
    px(ctx, bx + bw - 5, fy, C.ink, 4, 3); px(ctx, bx + bw - 4, fy + 1, C.mag0, 2, 1);
  }
  // ear spikes
  if (!o.flat) {
    px(ctx, bx + 2, by - 3, C.ink, 3, 4); px(ctx, bx + 3, by - 2, C.pink, 1, 2);
    px(ctx, bx + bw - 5, by - 2, C.ink, 3, 3); px(ctx, bx + bw - 4, by - 1, C.pink, 1, 1);
  }
  rr(ctx, bx, by, bw, bh, 2, C.ink);
  rr(ctx, bx + 1, by + 1, bw - 2, bh - 2, 1, C.mag);
  px(ctx, bx + 2, by + bh - 3, C.mag0, bw - 4, 1);
  px(ctx, bx + 2, by + 1, C.mag2, bw - 5, 1);
  px(ctx, bx + 1, by + 2, C.mag2, 1, 1);
  // glitch stripe
  px(ctx, bx + 1, by + Math.floor(bh / 2), C.teal2, 2, 1);
  // eye (faces right)
  if (o.flat) {
    px(ctx, bx + bw - 6, by + 1, C.cream, 3, 1);
  } else {
    const ex = bx + bw - 7, ey = by + 2;
    px(ctx, ex, ey, C.ink, 5, 5);
    px(ctx, ex + 1, ey + 1, C.cream, 3, 3);
    px(ctx, ex + 2 + (o.pupil ?? 0), ey + 2, C.ink, 2, 2);
  }
  return both(c);
}

function bugFrame(o) {
  const [c, ctx] = makeCanvas(22, 12);
  const bodyY = 3 + (o.raise ? -1 : 0) + (o.low ? 1 : 0);
  // legs
  if (!o.flat) {
    const ls = o.legs ?? 0;
    for (let i = 0; i < 3; i++) {
      const lx = 5 + i * 4 + ((i + ls) % 2 ? 1 : -1);
      px(ctx, lx, bodyY + 6, C.ink, 2, 3);
      px(ctx, lx + ((i + ls) % 2 ? 1 : -1), 11, C.ink, 2, 1);
    }
  }
  // antennae
  if (!o.flat) {
    px(ctx, 18, bodyY - 2, C.ink, 1, 2); px(ctx, 19, bodyY - 3, C.ink, 2, 1);
    px(ctx, 16, bodyY - 2, C.ink, 1, 1); px(ctx, 16, bodyY - 3, C.ink, 1, 1);
  }
  const fy = o.flat ? 8 : bodyY;
  const fh = o.flat ? 4 : 7;
  // carapace
  rr(ctx, 2, fy, 15, fh, 2, C.ink);
  rr(ctx, 3, fy + 1, 13, fh - 2, 1, o.hot ? C.orange : C.orange0);
  px(ctx, 4, fy + 1, o.hot ? C.gold : C.orange, 10, 1);
  if (!o.flat) {
    px(ctx, 7, fy + 1, C.ink, 1, fh - 2);
    px(ctx, 11, fy + 1, C.ink, 1, fh - 2);
    px(ctx, 4, fy + 4, C.mag0, 11, 1);
  }
  // head
  rr(ctx, 14, fy + 1, 7, fh - 1, 1, C.ink);
  px(ctx, 15, fy + 2, C.mag0, 5, Math.max(1, fh - 3));
  const eyeC = o.hot ? C.gold : o.stun ? C.cream3 : C.mag2;
  if (!o.flat) {
    px(ctx, 18, fy + 2, eyeC, 2, 2);
    px(ctx, 16, fy + 3, eyeC, 1, 1);
    if (o.hot) px(ctx, 19, fy + 2, C.white);
  }
  return both(c);
}

function droneFrame(o) {
  const [c, ctx] = makeCanvas(20, 20);
  const cx = 10, cy = 10;
  // fins
  px(ctx, 1, 8, C.ink, 4, 5); px(ctx, 2, 9, C.slate, 2, 3);
  px(ctx, 15, 8, C.ink, 4, 5); px(ctx, 16, 9, C.slate, 2, 3);
  disc(ctx, cx, cy, 7, C.ink);
  disc(ctx, cx, cy, 6, C.navy2);
  // shading
  ctx.fillStyle = C.slate;
  for (let y = -6; y <= 0; y++) for (let x = -6; x <= 1; x++) if (x * x + y * y <= 26 && x * x + y * y > 9) ctx.fillRect(cx + x, cy + y, 1, 1);
  // cap (stompable plate)
  px(ctx, cx - 5, cy - 7, C.ink, 11, 3);
  px(ctx, cx - 4, cy - 6, C.cream2, 9, 1);
  px(ctx, cx - 4, cy - 6, C.cream, 4, 1);
  // eye
  const eo = o.eye ?? 0;
  px(ctx, cx - 2, cy - 1, C.ink, 5, 5);
  px(ctx, cx - 1, cy, o.hit ? C.white : C.orange, 3, 3);
  px(ctx, cx + eo, cy + 1, o.hit ? C.white : C.gold, 1, 1);
  // emitter
  px(ctx, cx - 2, cy + 6, C.ink, 5, 3);
  px(ctx, cx - 1, cy + 7, o.flash ? C.mint : C.teal, 3, 1);
  return c;
}

// ---------------------------------------------------------------------------
// Items / props
// ---------------------------------------------------------------------------
function bitFrames() {
  const widths = [7, 5, 3, 1];
  return widths.map((w) => {
    const [c, ctx] = makeCanvas(9, 11);
    const cx = 4;
    for (let y = 0; y < 9; y++) {
      const half = Math.round(((4 - Math.abs(y - 4)) / 4) * ((w - 1) / 2));
      const x0 = cx - half, x1 = cx + half;
      px(ctx, x0, y + 1, C.orange0, x1 - x0 + 1, 1);
    }
    for (let y = 1; y < 8; y++) {
      const half = Math.max(0, Math.round(((4 - Math.abs(y - 4)) / 4) * ((w - 1) / 2)) - 1);
      const x0 = cx - half, x1 = cx + half;
      if (w === 1) { px(ctx, cx, y + 1, C.gold); continue; }
      px(ctx, x0, y + 1, C.gold, x1 - x0 + 1, 1);
      if (y > 4) px(ctx, cx, y + 1, C.orange2, x1 - cx + 1, 1);
    }
    if (w >= 3) px(ctx, cx - 1, 3, C.white);
    return c;
  });
}

function coreFrames() {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(14, 14);
    // hex outline
    const rows = [[4, 9], [3, 10], [2, 11], [1, 12], [1, 12], [1, 12], [1, 12], [1, 12], [1, 12], [1, 12], [2, 11], [3, 10], [4, 9]];
    rows.forEach(([a, b], y) => px(ctx, a, y, C.ink, b - a + 1, 1));
    rows.slice(1, -1).forEach(([a, b], i) => px(ctx, a + 1, i + 1, C.teal0, b - a - 1, 1));
    rows.slice(2, -2).forEach(([a, b], i) => px(ctx, a + 2, i + 2, C.teal, b - a - 3, 1));
    disc(ctx, 6, 6, 2, f ? C.white : C.mint);
    px(ctx, 5, 5, C.white, 2, 1);
    px(ctx, 3, 2, C.mint, 2, 1);
    px(ctx, 2, 3, C.mint, 1, 2);
    return c;
  });
}

function haloSprite(r, color) {
  const size = r * 2 + 1;
  const [c, ctx] = makeCanvas(size, size);
  const rings = [[r, 0.12], [Math.round(r * 0.7), 0.16], [Math.round(r * 0.42), 0.22]];
  for (const [rad, a] of rings) {
    ctx.globalAlpha = a;
    disc(ctx, r, r, rad, color);
  }
  ctx.globalAlpha = 1;
  return c;
}

function checkpointFrame(on) {
  const [c, ctx] = makeCanvas(16, 30);
  // base
  px(ctx, 2, 26, C.ink, 12, 4); px(ctx, 3, 27, C.slate, 10, 2); px(ctx, 3, 27, C.slate2, 10, 1);
  // pole
  px(ctx, 6, 12, C.ink, 4, 15); px(ctx, 7, 12, C.slate2, 2, 14); px(ctx, 7, 12, C.blue, 1, 14);
  // screen box
  rr(ctx, 1, 4, 14, 10, 1, C.ink);
  px(ctx, 2, 5, C.slate, 12, 8);
  px(ctx, 3, 6, on ? C.teal0 : C.navy, 10, 6);
  if (on) {
    // signal glyph
    px(ctx, 5, 10, C.mint, 1, 1); px(ctx, 7, 9, C.mint, 1, 2); px(ctx, 9, 8, C.mint, 1, 3); px(ctx, 11, 7, C.mint, 1, 4);
  } else {
    px(ctx, 5, 9, C.slate, 6, 1);
  }
  // beacon
  px(ctx, 6, 0, C.ink, 4, 5);
  px(ctx, 7, 1, on ? C.mint : C.slate, 2, 3);
  if (on) px(ctx, 7, 1, C.white);
  return c;
}

function padFrames() {
  return [0, 1].map((f) => {
    const [c, ctx] = makeCanvas(16, 12);
    const top = f ? 7 : 3;
    // base
    px(ctx, 1, 9, C.ink, 14, 3); px(ctx, 2, 10, C.slate, 12, 1);
    // spring
    for (let y = top + 3; y < 9; y += 2) { px(ctx, 4, y, C.ink, 8, 1); px(ctx, 5, y, C.cream3, 6, 1); }
    // plate
    px(ctx, 0, top, C.ink, 16, 4);
    px(ctx, 1, top + 1, C.orange, 14, 2);
    px(ctx, 1, top + 1, C.orange2, 14, 1);
    px(ctx, 6, top + 1, C.gold, 4, 1);
    return c;
  });
}

export function buildSprites() {
  const S = {};
  S.pip = pipFrames();
  S.hopper = {
    idle0: hopperFrame({}),
    idle1: hopperFrame({ bw: 13, bh: 9 }),
    crouch: hopperFrame({ bw: 14, bh: 8 }),
    air: hopperFrame({ bw: 11, bh: 11, air: true, pupil: 0 }),
    flat: hopperFrame({ bw: 14, bh: 4, flat: true }),
  };
  S.bug = {
    walk0: bugFrame({ legs: 0 }),
    walk1: bugFrame({ legs: 1 }),
    alert: bugFrame({ raise: true, hot: true, legs: 0 }),
    charge0: bugFrame({ low: true, hot: true, legs: 0 }),
    charge1: bugFrame({ low: true, hot: true, legs: 1 }),
    stun: bugFrame({ stun: true, legs: 0 }),
    flat: bugFrame({ flat: true }),
  };
  S.drone = [droneFrame({ eye: 0 }), droneFrame({ eye: 1, flash: true }), droneFrame({ hit: true })];
  S.bit = bitFrames();
  S.core = coreFrames();
  S.haloGold = haloSprite(9, C.gold);
  S.haloMint = haloSprite(14, C.mint);
  S.haloMag = haloSprite(10, C.mag2);
  S.checkpoint = [checkpointFrame(false), checkpointFrame(true)];
  S.pad = padFrames();
  return S;
}

/** Render a bigger icon of PIP for menus. */
export function pipIcon(sprites, frame = 'idle0') {
  return sprites.pip[frame][1];
}
