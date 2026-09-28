/**
 * Tiny authoring DSL: levels are described in tile coordinates with intent
 * (ground, pit, platform row, bits) and compiled to an ASCII grid that
 * Level parses. Coordinates are inclusive.
 */
export class LevelBuilder {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill('.'));
    this.entities = [];
    this.secrets = [];
  }
  set(x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = ch; return this; }
  rect(x0, y0, x1, y1, ch = '#') {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }
  clear(x0, y0, x1, y1) { return this.rect(x0, y0, x1, y1, '.'); }
  /** Solid ground whose walkable surface is row `top`. */
  ground(x0, x1, top) { return this.rect(x0, top, x1, this.h - 1, '#'); }
  /** Energy pit: liquid from `surface` down to the bottom (air above is untouched). */
  pit(x0, x1, surface) { return this.rect(x0, surface, x1, this.h - 1, '~'); }
  row(x0, x1, y, ch) { return this.rect(x0, y, x1, y, ch); }
  /** Hidden room: every empty tile in the rect becomes fake rock until entered. */
  secret(x0, y0, x1, y1) { this.secrets.push([x0, y0, x1, y1]); return this; }
  bits(list) { for (const [x, y] of list) this.set(x, y, 'o'); return this; }
  ent(e) { this.entities.push(e); return this; }
  build(meta) {
    return { ...meta, rows: this.g.map((r) => r.join('')), entities: this.entities, secrets: this.secrets };
  }
}
