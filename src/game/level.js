import { TILE } from '../config.js';

// Tile codes stored in the collision grid.
export const T = {
  EMPTY: 0,
  SOLID: 1,
  ONEWAY: 2,
  SPIKE_UP: 3,
  SPIKE_DOWN: 4,
  PIT: 5,
  FALSE: 6,     // looks solid, is passable (secret)
  PHASE_A: 7,
  PHASE_B: 8,
  VANISH: 9,
};

const CHAR_TILE = {
  '#': T.SOLID, '=': T.ONEWAY, '^': T.SPIKE_UP, 'v': T.SPIKE_DOWN, '~': T.PIT,
  '%': T.FALSE, 'A': T.PHASE_A, 'Z': T.PHASE_B, 'x': T.VANISH,
};

export const PHASE_PERIOD = 3.6;
export const PHASE_ON = 0.62;
export const PHASE_WARN = 0.55;
const VANISH_CRUMBLE = 0.5;
const VANISH_GONE = 2.4;

/**
 * Parsed, mutable level state: collision grid, dynamic blocks and the raw spawn
 * lists for entities. Pure logic — rendering lives in gfx/.
 */
export class Level {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.theme = def.theme;
    this.h = def.rows.length;
    this.w = Math.max(...def.rows.map((r) => r.length));
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.spawn = { x: 2 * TILE, y: 2 * TILE };
    this.bits = [];
    this.cores = [];
    this.checkpoints = [];
    this.tower = null;
    this.enemyDefs = [];
    this.fallDefs = [];
    this.bounceDefs = [];
    this.decor = [];
    this.dyn = new Map();
    this.phaseT = 0;

    let coreIndex = 0;
    const fallRuns = [];
    for (let y = 0; y < this.h; y++) {
      const row = def.rows[y];
      let fallStart = -1;
      for (let x = 0; x <= this.w; x++) {
        const ch = x < row.length ? row[x] : '.';
        if (ch === 'F') {
          if (fallStart < 0) fallStart = x;
        } else if (fallStart >= 0) {
          fallRuns.push({ x: fallStart, y, w: x - fallStart });
          fallStart = -1;
        }
        if (x >= this.w) continue;
        const t = CHAR_TILE[ch];
        if (t !== undefined) {
          this.tiles[y * this.w + x] = t;
          if (t >= T.PHASE_A) {
            this.dyn.set(y * this.w + x, {
              tx: x, ty: y, kind: t, solid: true, pending: false,
              state: 'solid', t: 0, vis: 1,
            });
          }
          continue;
        }
        const px = x * TILE, py = y * TILE;
        switch (ch) {
          case 'P': this.spawn = { x: px + 3, y: py + TILE - 13 }; break;
          case 'o': this.bits.push({ x: px + 8, y: py + 8 }); break;
          case 'C': this.cores.push({ x: px + 8, y: py + 8, index: coreIndex++ }); break;
          case 'K': this.checkpoints.push({ x: px, y: py + TILE }); break;
          case 'T': this.tower = { x: px, y: py + TILE }; break;
          case 'g': this.enemyDefs.push({ type: 'hopper', x: px + 2, y: py + 6 }); break;
          case 'b': this.enemyDefs.push({ type: 'bug', x: px, y: py + 8 }); break;
          case 'B': this.bounceDefs.push({ x: px, y: py + TILE }); break;
          case 't': case 'r': case 'y': case 'u':
            this.decor.push({ kind: ch, x: px, y: py + TILE }); break;
          default: break;
        }
      }
    }
    this.fallDefs = fallRuns;
    for (const e of def.entities || []) {
      if (e.type === 'drone') this.enemyDefs.push({ ...e });
    }
    // Secret rooms: empty tiles become fake rock; one-way ledges inside stay
    // functional but are hidden under the fake-rock layer.
    this.hiddenOneWay = new Set();
    for (const [x0, y0, x1, y1] of def.secrets || []) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x;
        if (this.tiles[i] === T.EMPTY) this.tiles[i] = T.FALSE;
        else if (this.tiles[i] === T.ONEWAY) this.hiddenOneWay.add(i);
      }
    }
    this._buildFalseRegions();
  }

  idx(tx, ty) { return ty * this.w + tx; }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return T.EMPTY;
    return this.tiles[ty * this.w + tx];
  }

  solidAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return true;
    if (ty < 0 || ty >= this.h) return false;
    const t = this.tiles[ty * this.w + tx];
    if (t === T.SOLID) return true;
    if (t >= T.PHASE_A) return this.dyn.get(ty * this.w + tx).solid;
    return false;
  }

  /** Solid for rendering/decoration (includes false walls). */
  looksSolid(tx, ty) {
    if (tx < 0 || tx >= this.w || ty < 0) return true;
    if (ty >= this.h) return true;
    const i = ty * this.w + tx;
    const t = this.tiles[i];
    return t === T.SOLID || t === T.FALSE || this.hiddenOneWay.has(i);
  }

  oneWayAt(tx, ty) { return this.tileAt(tx, ty) === T.ONEWAY; }

  rectFree(x, y, w, h) {
    const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + w - 0.001) / TILE);
    const ty0 = Math.floor(y / TILE), ty1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) if (this.solidAt(tx, ty)) return false;
    return true;
  }

  _buildFalseRegions() {
    this.falseRegions = [];
    this.falseRegionOf = new Int16Array(this.w * this.h).fill(-1);
    for (let i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i] !== T.FALSE || this.falseRegionOf[i] >= 0) continue;
      const region = { tiles: [], x0: 1e9, y0: 1e9, x1: -1, y1: -1, alpha: 1, found: false };
      const id = this.falseRegions.length;
      const stack = [i];
      this.falseRegionOf[i] = id;
      while (stack.length) {
        const j = stack.pop();
        const tx = j % this.w, ty = (j / this.w) | 0;
        region.tiles.push(j);
        region.x0 = Math.min(region.x0, tx); region.x1 = Math.max(region.x1, tx);
        region.y0 = Math.min(region.y0, ty); region.y1 = Math.max(region.y1, ty);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = tx + dx, ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const k = ny * this.w + nx;
          if (this.tiles[k] === T.FALSE && this.falseRegionOf[k] < 0) {
            this.falseRegionOf[k] = id;
            stack.push(k);
          }
        }
      }
      this.falseRegions.push(region);
    }
  }

  /**
   * Phase groups are each solid for 62% of the cycle, offset by half a cycle,
   * so there is always a short window where both exist: blink -> the other
   * group materialises -> jump.
   */
  phaseState(kind) {
    const P = PHASE_PERIOD, L = P * PHASE_ON;
    const start = kind === T.PHASE_A ? 0 : P / 2;
    const rel = (((this.phaseT - start) % P) + P) % P;
    const on = rel < L;
    return { on, warn: on && rel > L - PHASE_WARN };
  }

  /** Called by blocks standing under the player's feet. */
  touchVanish(tx, ty) {
    const b = this.dyn.get(ty * this.w + tx);
    if (b && b.kind === T.VANISH && b.state === 'solid') {
      b.state = 'crumble';
      b.t = VANISH_CRUMBLE;
      return true;
    }
    return false;
  }

  /**
   * Advance dynamic blocks. `body` is the player (blocks will not re-solidify
   * inside it). Returns events for sound/particles.
   */
  update(dt, body, events) {
    this.phaseT += dt;
    const overlapsBody = (b) =>
      body &&
      body.x < (b.tx + 1) * TILE && body.x + body.w > b.tx * TILE &&
      body.y < (b.ty + 1) * TILE && body.y + body.h > b.ty * TILE;

    for (const b of this.dyn.values()) {
      if (b.kind === T.VANISH) {
        if (b.state === 'crumble') {
          b.t -= dt;
          if (b.t <= 0) { b.state = 'gone'; b.t = VANISH_GONE; b.solid = false; events && events.push({ type: 'vanish', tx: b.tx, ty: b.ty }); }
        } else if (b.state === 'gone') {
          b.t -= dt;
          if (b.t <= 0 && !overlapsBody(b)) { b.state = 'solid'; b.solid = true; b.t = 0.25; events && events.push({ type: 'reform', tx: b.tx, ty: b.ty }); }
        } else if (b.t > 0) b.t -= dt;
      } else {
        const st = this.phaseState(b.kind);
        if (st.on) {
          if (!b.solid) {
            if (overlapsBody(b)) b.pending = true;
            else { b.solid = true; b.pending = false; }
          }
        } else {
          b.solid = false;
          b.pending = false;
        }
        b.warn = st.warn;
      }
    }

    // Secret reveal fading.
    if (body) {
      const cx = Math.floor((body.x + body.w / 2) / TILE);
      const cy0 = Math.floor(body.y / TILE), cy1 = Math.floor((body.y + body.h - 1) / TILE);
      let inside = -1;
      for (let ty = cy0; ty <= cy1; ty++) {
        const k = ty * this.w + cx;
        if (cx >= 0 && cx < this.w && ty >= 0 && ty < this.h && this.falseRegionOf[k] >= 0) inside = this.falseRegionOf[k];
      }
      for (let i = 0; i < this.falseRegions.length; i++) {
        const r = this.falseRegions[i];
        const target = i === inside ? 0.18 : 1;
        r.alpha += (target - r.alpha) * Math.min(1, dt * 7);
        if (i === inside && !r.found) {
          r.found = true;
          events && events.push({ type: 'secret', x: (r.x0 + r.x1 + 1) * TILE / 2, y: (r.y0 + r.y1 + 1) * TILE / 2 });
        }
      }
    }
  }
}
