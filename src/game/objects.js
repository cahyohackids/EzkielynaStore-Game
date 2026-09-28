import { C, TILE } from '../config.js';
import { drawText, textWidth } from '../gfx/font.js';

const px = (ctx, x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

// ---------------------------------------------------------------------------
// Collectibles
// ---------------------------------------------------------------------------
export class Bit {
  constructor(x, y, region) { this.x = x; this.y = y; this.got = false; this.phase = (x * 0.07 + y * 0.03) % (Math.PI * 2); this.region = region; }
  hit(p) { return !this.got && Math.abs(p.cx - this.x) < 9 && Math.abs(p.cy - this.y) < 11; }
  draw(ctx, cx, cy, t, S) {
    const bob = Math.round(Math.sin(t * 3 + this.phase) * 1.5);
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy) + bob;
    if (!this.region || this.region.alpha < 0.6) {
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 4 + this.phase);
      ctx.drawImage(S.haloGold, x - 9, y - 9);
      ctx.globalAlpha = 1;
    }
    const seq = [0, 1, 2, 3, 2, 1];
    const f = seq[Math.floor(t * 9 + this.phase * 2) % 6];
    ctx.drawImage(S.bit[f], x - 4, y - 6);
  }
}

export class Core {
  constructor(x, y, index, before, region) { this.x = x; this.y = y; this.index = index; this.got = false; this.before = before; this.region = region; }
  hit(p) { return !this.got && Math.abs(p.cx - this.x) < 11 && Math.abs(p.cy - this.y) < 12; }
  draw(ctx, cx, cy, t, S) {
    const bob = Math.round(Math.sin(t * 2.2 + this.index) * 2);
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy) + bob;
    if (!this.region || this.region.alpha < 0.6) {
      ctx.globalAlpha = this.before ? 0.25 : 0.5 + 0.25 * Math.sin(t * 3);
      ctx.drawImage(S.haloMint, x - 14, y - 14);
    }
    ctx.globalAlpha = this.before ? 0.55 : 1;
    ctx.drawImage(S.core[Math.floor(t * 3) % 2], x - 7, y - 7);
    // orbiting data pixel
    const a = t * 4 + this.index;
    px(ctx, Math.round(x + Math.cos(a) * 10), Math.round(y + Math.sin(a) * 4), C.white, 1, 1);
    px(ctx, Math.round(x - Math.cos(a) * 10), Math.round(y - Math.sin(a) * 4), C.mint, 1, 1);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Checkpoint terminal
// ---------------------------------------------------------------------------
export class Checkpoint {
  constructor(x, y, index) { this.x = x; this.y = y; this.index = index; this.active = false; this.t = 0; }
  get spawn() { return { x: this.x + 3, y: this.y - 13 }; }
  hit(p) { return !this.active && p.x + p.w > this.x + 1 && p.x < this.x + 15 && p.bottom > this.y - 30 && p.y < this.y; }
  update(dt) { if (this.active) this.t += dt; }
  draw(ctx, cx, cy, t, S) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy) - 30;
    if (this.active) {
      // faint beacon beam
      const pulse = 0.12 + 0.08 * Math.sin(t * 3);
      ctx.globalAlpha = pulse;
      px(ctx, x + 7, y - 60, C.mint, 2, 60);
      ctx.globalAlpha = 1;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 4);
      ctx.drawImage(S.haloMint, x + 8 - 14, y + 2 - 14);
      ctx.globalAlpha = 1;
    }
    const booting = this.active && this.t < 0.5;
    const img = S.checkpoint[this.active && !(booting && Math.floor(this.t * 20) % 2) ? 1 : 0];
    ctx.drawImage(img, x, y);
    if (this.active && this.t < 1.2) {
      // scan line sweeping the screen as it boots
      const sy = y + 6 + Math.floor(((this.t * 8) % 1) * 6);
      px(ctx, x + 3, sy, C.white, 10, 1);
    }
    if (this.active && this.t < 1.6) {
      const k = Math.min(1, this.t * 3);
      drawText(ctx, 'SAVED', x + 8, y - 12 - Math.round(k * 4), C.mint, { align: 'center', shadow: C.ink });
    }
  }
}

// ---------------------------------------------------------------------------
// Signal tower (goal)
// ---------------------------------------------------------------------------
export class Tower {
  constructor(x, y) {
    this.x = x; this.y = y; this.state = 'idle'; this.t = 0; this.glitchT = 0;
    this.mastH = 112;
  }
  get cx() { return this.x + 8; }
  hit(p) { return this.state === 'idle' && p.cx > this.x - 14 && p.cx < this.x + 30 && p.bottom > this.y - 40 && p.y < this.y; }
  activate() { this.state = 'active'; this.t = 0; }
  update(dt) { this.t += dt; this.glitchT -= dt; if (this.glitchT < -0.2 - Math.random() * 2) this.glitchT = 0.1; }
  draw(ctx, cx, cy, t, S) {
    const bx = Math.round(this.x - cx), by = Math.round(this.y - cy);
    const on = this.state === 'active';
    const k = on ? Math.min(1, this.t / 1.4) : 0; // light-up progress
    const top = by - 16 - this.mastH;
    const mx = bx + 1;
    // light beam into the sky when complete
    if (on && this.t > 1.4) {
      const w = Math.min(8, Math.floor((this.t - 1.4) * 20));
      ctx.globalAlpha = 0.18;
      px(ctx, mx + 7 - w, top - 400, C.mint, w * 2, 400);
      ctx.globalAlpha = 0.5;
      px(ctx, mx + 7 - Math.ceil(w / 3), top - 400, C.white, Math.ceil(w / 3) * 2, 400);
      ctx.globalAlpha = 1;
    }
    // mast lattice
    for (let y = top + 10; y < by - 16; y++) {
      const rel = (by - 16 - y) / (this.mastH - 10);
      const lit = on && rel < k;
      const edge = lit ? C.teal2 : C.slate2;
      px(ctx, mx, y, C.ink, 2, 1); px(ctx, mx + 12, y, C.ink, 2, 1);
      px(ctx, mx + 1, y, edge, 1, 1); px(ctx, mx + 12, y, edge, 1, 1);
      const seg = (y - top) % 14;
      if (seg === 0) px(ctx, mx, y, C.ink, 14, 2);
      const d = Math.round(seg * 12 / 14);
      px(ctx, mx + 1 + d, y, lit ? C.teal : C.slate, 1, 1);
      px(ctx, mx + 12 - d, y, lit ? C.teal : C.slate, 1, 1);
    }
    // dish + beacon
    px(ctx, mx - 4, top + 4, C.ink, 22, 6);
    px(ctx, mx - 3, top + 5, on ? C.cream : C.cream3, 20, 2);
    px(ctx, mx - 1, top + 7, on ? C.cream2 : C.slate2, 16, 2);
    px(ctx, mx + 5, top - 4, C.ink, 4, 9);
    px(ctx, mx + 6, top - 3, C.slate2, 2, 7);
    const beaconOn = on ? this.t > 1.4 || Math.floor(this.t * 10) % 2 : this.glitchT > 0;
    px(ctx, mx + 3, top - 10, C.ink, 8, 7);
    px(ctx, mx + 4, top - 9, beaconOn ? (on ? C.gold : C.mag2) : C.orange0, 6, 5);
    if (beaconOn) px(ctx, mx + 4, top - 9, C.white, 2, 1);
    if (on && this.t > 1.4) {
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6);
      ctx.drawImage(S.haloMint, mx + 7 - 14, top - 7 - 14);
      ctx.globalAlpha = 1;
    }
    // base console
    px(ctx, bx - 16, by - 16, C.ink, 48, 16);
    px(ctx, bx - 15, by - 15, C.slate, 46, 14);
    px(ctx, bx - 15, by - 15, C.slate2, 46, 2);
    px(ctx, bx - 12, by - 11, C.ink, 40, 7);
    for (let i = 0; i < 6; i++) {
      const lit = on ? this.t * 6 > i : (i === 1 && this.glitchT > 0);
      px(ctx, bx - 11 + i * 6 + 1, by - 10, lit ? (on ? C.mint : C.mag2) : C.navy2, 4, 5);
    }
    if (!on) {
      // prompt arrow bouncing above the console
      const a = Math.round(Math.sin(t * 5) * 2);
      drawText(ctx, '↓', bx + 8, by - 30 + a, C.gold, { align: 'center', shadow: C.ink });
    }
  }
}

// ---------------------------------------------------------------------------
// Hint signs (tiny, iconographic)
// ---------------------------------------------------------------------------
export class Sign {
  constructor(def, touchMode) {
    this.x = def.x * TILE; this.y = (def.y + 1) * TILE; this.icon = def.icon; this.touchMode = touchMode;
  }
  label() {
    const touch = this.touchMode();
    switch (this.icon) {
      case 'jump': return touch ? '^' : 'SPACE';
      case 'dash': return touch ? '>>' : 'SHIFT';
      case 'hold': return touch ? 'HOLD ^' : 'HOLD';
      case 'down': return '↓';
      case 'arrow': return '>';
      default: return this.icon.toUpperCase();
    }
  }
  draw(ctx, cx, cy) {
    const s = this.label();
    const w = Math.max(12, textWidth(s) + 6);
    const x = Math.round(this.x + 8 - cx), y = Math.round(this.y - cy);
    px(ctx, x - 1, y - 12, C.ink, 3, 12); px(ctx, x, y - 12, C.cream3, 1, 12);
    const sx = x - Math.floor(w / 2), sy = y - 25;
    px(ctx, sx - 1, sy - 1, C.ink, w + 2, 13);
    px(ctx, sx, sy, C.navy, w, 11);
    px(ctx, sx, sy, C.slate, w, 1);
    drawText(ctx, s, x + 1, sy + 2, C.cream, { align: 'center' });
  }
}

// ---------------------------------------------------------------------------
// Platforms (entities that can be stood on from above)
// ---------------------------------------------------------------------------
export class Mover {
  constructor(def, theme) {
    this.x0 = def.x * TILE; this.y0 = def.y * TILE;
    this.x1 = (def.to ? def.to[0] : def.x) * TILE; this.y1 = (def.to ? def.to[1] : def.y) * TILE;
    this.w = (def.w || 2) * TILE; this.h = 6;
    this.period = def.period || 4;
    this.t = (def.phase || 0) * this.period;
    this.theme = theme;
    this.solid = true;
    this._place();
    this.prevX = this.x; this.prevY = this.y; this.dx = 0; this.dy = 0;
  }
  _place() {
    const u = (1 - Math.cos((this.t / this.period) * Math.PI * 2)) / 2;
    this.x = this.x0 + (this.x1 - this.x0) * u;
    this.y = this.y0 + (this.y1 - this.y0) * u;
  }
  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    this.t += dt;
    this._place();
    this.dx = this.x - this.prevX; this.dy = this.y - this.prevY;
  }
  draw(ctx, cx, cy, t) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy), w = this.w;
    const tower = this.theme === 'tower';
    px(ctx, x, y, C.ink, w, 7);
    px(ctx, x + 1, y + 1, tower ? C.cream3 : C.cream2, w - 2, 1);
    px(ctx, x + 1, y + 2, tower ? C.blue : C.slate2, w - 2, 3);
    for (let i = 6; i < w - 4; i += 8) px(ctx, x + i, y + 3, C.slate, 3, 1);
    const blink = Math.floor(t * 2) % 2;
    px(ctx, x + 2, y + 2, blink ? C.mint : C.teal, 2, 2);
    px(ctx, x + w - 4, y + 2, blink ? C.teal : C.mint, 2, 2);
    // thruster
    const mid = x + (w >> 1);
    px(ctx, mid - 3, y + 7, C.ink, 6, 2);
    if (Math.floor(t * 16) % 2) px(ctx, mid - 1, y + 9, C.orange2, 2, 1 + (Math.floor(t * 30) % 2));
  }
}

export class Faller {
  constructor(def, theme) {
    this.ox = def.x * TILE; this.oy = def.y * TILE;
    this.w = def.w * TILE; this.h = 8;
    this.theme = theme;
    this.reset();
  }
  reset() {
    this.x = this.ox; this.y = this.oy; this.prevX = this.x; this.prevY = this.y;
    this.dx = 0; this.dy = 0; this.vy = 0;
    this.state = 'idle'; this.t = 0; this.solid = true; this.fade = 0;
  }
  onStand() {
    if (this.state === 'idle') { this.state = 'shake'; this.t = 0; this.game.sfx('shake'); }
  }
  update(dt) {
    this.prevX = this.x; this.prevY = this.y;
    this.t += dt;
    if (this.state === 'shake' && this.t > 0.45) { this.state = 'fall'; this.t = 0; this.game.sfx('fall'); }
    else if (this.state === 'fall') {
      this.vy = Math.min(this.vy + 900 * dt, 420);
      this.y += this.vy * dt;
      if (this.t > 1.6) { this.state = 'gone'; this.t = 0; this.solid = false; }
    } else if (this.state === 'gone' && this.t > 2.2) {
      const p = this.game.player;
      const blocked = p.x < this.ox + this.w && p.x + p.w > this.ox && p.y < this.oy + 8 && p.bottom > this.oy;
      if (!blocked) { this.reset(); this.fade = 0.3; }
    }
    if (this.fade > 0) this.fade -= dt;
    this.dx = this.x - this.prevX; this.dy = this.y - this.prevY;
  }
  draw(ctx, cx, cy) {
    if (this.state === 'gone') return;
    const jx = this.state === 'shake' ? (Math.floor(this.t * 40) % 2 ? 1 : -1) : 0;
    const x = Math.round(this.x - cx) + jx, y = Math.round(this.y - cy), w = this.w;
    if (this.fade > 0) ctx.globalAlpha = 1 - this.fade / 0.3;
    px(ctx, x, y, C.ink, w, 8);
    px(ctx, x + 1, y + 1, C.orange2, w - 2, 1);
    px(ctx, x + 1, y + 2, C.orange, w - 2, 3);
    px(ctx, x + 1, y + 5, C.orange0, w - 2, 2);
    for (let i = 5; i < w - 3; i += 7) { px(ctx, x + i, y + 2, C.orange0, 1, 3); px(ctx, x + i + 1, y + 4, C.orange0, 2, 1); }
    // hanging crumbs
    for (let i = 3; i < w - 2; i += 6) px(ctx, x + i, y + 8, C.ink, 2, 1 + (i % 4 === 3 ? 1 : 0));
    ctx.globalAlpha = 1;
  }
}

export class Pad {
  constructor(def) {
    this.x = def.x; this.y = def.y - 8; this.w = 16; this.h = 8;
    this.prevX = this.x; this.prevY = this.y; this.dx = 0; this.dy = 0;
    this.bounce = true; this.solid = true; this.t = 1;
  }
  onBounce() { this.t = 0; }
  update(dt) { this.t += dt; }
  draw(ctx, cx, cy, t, S) {
    const f = this.t < 0.12 ? 1 : 0;
    ctx.drawImage(S.pad[f], Math.round(this.x - cx), Math.round(this.y - 4 - cy));
    if (this.t > 0.12) {
      // chevrons hint the launch direction
      const a = Math.floor(t * 3) % 3;
      ctx.globalAlpha = 0.6;
      px(ctx, Math.round(this.x - cx) + 7, Math.round(this.y - cy) - 8 - a * 3, C.gold, 2, 1);
      ctx.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Lasers: timed (warn -> fire) or sweeping along a rail.
// ---------------------------------------------------------------------------
export class Laser {
  constructor(def, game) {
    this.game = game;
    this.dir = def.dir || 'down';
    this.mode = def.mode || 'timed';
    this.on = def.on ?? 1.2; this.off = def.off ?? 1.6; this.offset = def.offset || 0;
    this.tx0 = def.x; this.ty = def.y;
    this.tx1 = def.to != null ? def.to : def.x;
    this.period = def.period || 4;
    this.t = 0;
    this.active = false; this.warn = false;
    this.len = 0;
    this._place();
  }
  _place() {
    let tx = this.tx0;
    if (this.mode === 'sweep') {
      const u = (1 - Math.cos((this.t / this.period) * Math.PI * 2)) / 2;
      tx = this.tx0 + (this.tx1 - this.tx0) * u;
    }
    const v = this.dir === 'down' || this.dir === 'up';
    if (v) { this.ox = tx * TILE + 8; this.oy = this.dir === 'down' ? this.ty * TILE + 5 : (this.ty + 1) * TILE - 5; }
    else { this.oy = this.ty * TILE + 8; this.ox = this.dir === 'right' ? this.tx0 * TILE + 5 : (this.tx0 + 1) * TILE - 5; }
    // Raycast to the first solid tile.
    const lv = this.game.level;
    const sx = Math.floor(this.ox / TILE), sy = Math.floor(this.oy / TILE);
    const [ddx, ddy] = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[this.dir];
    let n = 1;
    while (n < 40 && !lv.solidAt(sx + ddx * n, sy + ddy * n)) n++;
    const endTile = { x: sx + ddx * n, y: sy + ddy * n };
    if (this.dir === 'down') this.len = endTile.y * TILE - this.oy;
    else if (this.dir === 'up') this.len = this.oy - (endTile.y + 1) * TILE;
    else if (this.dir === 'right') this.len = endTile.x * TILE - this.ox;
    else this.len = this.ox - (endTile.x + 1) * TILE;
  }
  update(dt) {
    this.t += dt;
    const wasActive = this.active;
    if (this.mode === 'sweep') { this.active = true; this.warn = false; }
    else {
      const cyc = this.on + this.off;
      const u = (this.t + this.offset) % cyc;
      this.active = u < this.on;
      this.warn = !this.active && u > cyc - 0.65;
    }
    this._place();
    const near = this._near();
    if (this.active && !wasActive && near) this.game.sfx('laserOn', { vol: near });
    if (this.warn && near && Math.floor(this.t * 12) !== Math.floor((this.t - dt) * 12)) this.game.sfx('laserWarn', { vol: near });
    if (this.active && Math.random() < dt * 12 && near) {
      const e = this.end();
      this.game.fx.burst(e.x, e.y, 1, { speed: 40, life: 0.25, c: [C.pink, C.white], g: 200, s: 1 });
    }
  }
  _near() {
    const p = this.game.player;
    const d = Math.hypot(p.cx - this.ox, p.cy - this.oy);
    return d < 220 ? Math.max(0.25, 1 - d / 220) : 0;
  }
  end() {
    const v = { down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0] }[this.dir];
    return { x: this.ox + v[0] * this.len, y: this.oy + v[1] * this.len };
  }
  rect() {
    const th = 3;
    switch (this.dir) {
      case 'down': return { x: this.ox - th / 2 - 1, y: this.oy, w: th + 1, h: this.len };
      case 'up': return { x: this.ox - th / 2 - 1, y: this.oy - this.len, w: th + 1, h: this.len };
      case 'right': return { x: this.ox, y: this.oy - th / 2 - 1, w: this.len, h: th + 1 };
      default: return { x: this.ox - this.len, y: this.oy - th / 2 - 1, w: this.len, h: th + 1 };
    }
  }
  hits(p) {
    if (!this.active) return false;
    const r = this.rect();
    return p.x + 1 < r.x + r.w && p.x + p.w - 1 > r.x && p.y + 2 < r.y + r.h && p.bottom > r.y;
  }
  draw(ctx, cx, cy, t) {
    const ox = Math.round(this.ox - cx), oy = Math.round(this.oy - cy);
    const v = this.dir === 'down' || this.dir === 'up';
    const r = this.rect();
    const rx = Math.round(r.x - cx), ry = Math.round(r.y - cy);
    if (this.mode === 'sweep') {
      // rail
      const x0 = Math.round(this.tx0 * TILE + 8 - cx), x1 = Math.round(this.tx1 * TILE + 8 - cx);
      const railY = this.dir === 'down' ? Math.round(this.ty * TILE - cy) + 1 : oy;
      px(ctx, Math.min(x0, x1) - 4, railY, C.ink, Math.abs(x1 - x0) + 8, 3);
      px(ctx, Math.min(x0, x1) - 3, railY + 1, C.slate2, Math.abs(x1 - x0) + 6, 1);
    }
    if (this.active) {
      const flick = Math.floor(t * 30) % 2;
      if (v) {
        ctx.globalAlpha = 0.25; px(ctx, rx - 2, ry, C.mag2, 8, r.h); ctx.globalAlpha = 1;
        px(ctx, rx, ry, C.mag2, 4, r.h);
        px(ctx, rx + 1, ry, flick ? C.white : C.pink, 2, r.h);
      } else {
        ctx.globalAlpha = 0.25; px(ctx, rx, ry - 2, C.mag2, r.w, 8); ctx.globalAlpha = 1;
        px(ctx, rx, ry, C.mag2, r.w, 4);
        px(ctx, rx, ry + 1, flick ? C.white : C.pink, r.w, 2);
      }
    } else if (this.warn) {
      if (Math.floor(t * 16) % 2) {
        ctx.fillStyle = C.mag2;
        if (v) for (let y = 0; y < r.h; y += 4) ctx.fillRect(rx + 1, ry + y, 2, 2);
        else for (let x = 0; x < r.w; x += 4) ctx.fillRect(rx + x, ry + 1, 2, 2);
      }
    }
    // emitter housing
    if (v) {
      const hy = this.dir === 'down' ? oy - 5 : oy - 1;
      px(ctx, ox - 5, hy, C.ink, 10, 6);
      px(ctx, ox - 4, hy + 1, C.slate2, 8, 4);
      px(ctx, ox - 2, this.dir === 'down' ? hy + 4 : hy, this.active || this.warn ? C.mag2 : C.mag0, 4, 2);
    } else {
      const hx = this.dir === 'right' ? ox - 5 : ox - 1;
      px(ctx, hx, oy - 5, C.ink, 6, 10);
      px(ctx, hx + 1, oy - 4, C.slate2, 4, 8);
      px(ctx, this.dir === 'right' ? hx + 4 : hx, oy - 2, this.active || this.warn ? C.mag2 : C.mag0, 2, 4);
    }
  }
}
