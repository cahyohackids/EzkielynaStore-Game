import { C } from '../config.js';

const MAX = 700;

/**
 * Pooled pixel particles. Every effect is a small named recipe so gameplay code
 * reads as intent ("landDust") rather than numbers.
 */
export class Particles {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX; i++) this.pool.push({});
    this.n = 0;
    this.scale = 1;          // reduced motion halves emission
    this.dust = [C.cream2, C.cream3];
    this.rings = [];
  }

  clear() { this.n = 0; this.rings.length = 0; }

  emit(x, y, o) {
    if (this.n >= MAX) return;
    const p = this.pool[this.n++];
    p.x = x; p.y = y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = p.max = o.life || 0.5;
    p.c = o.c || C.cream;
    p.c2 = o.c2 || p.c;
    p.s = o.s || 1;
    p.shrink = o.shrink || false;
    p.g = o.g || 0;
    p.drag = o.drag || 0;
    p.flicker = o.flicker || false;
  }

  count(n) { return Math.max(1, Math.round(n * this.scale)); }

  burst(x, y, n, o) {
    n = this.count(n);
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed || 60) * (0.45 + Math.random() * 0.75);
      this.emit(x + (Math.random() - 0.5) * (o.jitter || 0), y + (Math.random() - 0.5) * (o.jitterY ?? o.jitter ?? 0), {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: (o.life || 0.5) * (0.6 + Math.random() * 0.6),
        c: Array.isArray(o.c) ? o.c[(Math.random() * o.c.length) | 0] : o.c,
        c2: o.c2, s: o.s instanceof Array ? o.s[(Math.random() * o.s.length) | 0] : o.s,
        g: o.g, drag: o.drag, shrink: o.shrink, flicker: o.flicker,
      });
    }
  }

  ring(x, y, color, maxR = 24, life = 0.4) {
    this.rings.push({ x, y, r: 2, maxR, life, max: life, c: color });
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.n--;
        const last = this.pool[this.n];
        this.pool[this.n] = p;
        this.pool[i] = last;
        i--;
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      const t = 1 - r.life / r.max;
      r.r = 2 + (r.maxR - 2) * (1 - (1 - t) * (1 - t));
    }
  }

  draw(ctx, cx, cy) {
    for (let i = 0; i < this.n; i++) {
      const p = this.pool[i];
      const t = p.life / p.max;
      if (p.flicker && Math.random() < 0.25) continue;
      ctx.globalAlpha = t > 0.5 ? 1 : t > 0.22 ? 0.7 : 0.4;
      ctx.fillStyle = t < 0.45 ? p.c2 : p.c;
      const s = p.shrink ? Math.max(1, Math.ceil(p.s * t)) : p.s;
      ctx.fillRect(Math.round(p.x - cx - s / 2), Math.round(p.y - cy - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const t = r.life / r.max;
      ctx.globalAlpha = t > 0.5 ? 0.9 : 0.5;
      ctx.strokeStyle = r.c;
      ctx.lineWidth = 1;
      // Pixel ring: octagon approximates a circle crisply at low res.
      const x = Math.round(r.x - cx) + 0.5, y = Math.round(r.y - cy) + 0.5, rr = Math.round(r.r), d = Math.round(rr * 0.42);
      ctx.beginPath();
      ctx.moveTo(x - d, y - rr); ctx.lineTo(x + d, y - rr); ctx.lineTo(x + rr, y - d); ctx.lineTo(x + rr, y + d);
      ctx.lineTo(x + d, y + rr); ctx.lineTo(x - d, y + rr); ctx.lineTo(x - rr, y + d); ctx.lineTo(x - rr, y - d);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // --- Recipes ---------------------------------------------------------------
  runDust(x, y, dir) {
    this.burst(x, y - 1, 2, { angle: dir > 0 ? -Math.PI * 0.85 : -Math.PI * 0.15, spread: 0.6, speed: 26, life: 0.35, c: this.dust, g: -10, drag: 3, s: 1 });
  }
  skid(x, y, dir) {
    if (Math.random() < 0.5) this.burst(x + dir * 4, y - 1, 1, { angle: -Math.PI / 2 - dir * 0.8, spread: 0.6, speed: 40, life: 0.3, c: this.dust, g: 60, s: 1 });
  }
  jumpPuff(x, y) {
    this.burst(x - 3, y - 1, 3, { angle: Math.PI, spread: 0.5, speed: 35, life: 0.3, c: this.dust, drag: 5, s: 2, shrink: true });
    this.burst(x + 3, y - 1, 3, { angle: 0, spread: 0.5, speed: 35, life: 0.3, c: this.dust, drag: 5, s: 2, shrink: true });
  }
  landDust(x, y, k) {
    const n = 3 + Math.round(k * 4);
    this.burst(x - 3, y - 1, n, { angle: Math.PI + 0.15, spread: 0.5, speed: 30 + 40 * k, life: 0.35, c: this.dust, drag: 5, g: -20, s: 2, shrink: true });
    this.burst(x + 3, y - 1, n, { angle: -0.15, spread: 0.5, speed: 30 + 40 * k, life: 0.35, c: this.dust, drag: 5, g: -20, s: 2, shrink: true });
  }
  bouncePuff(x, y) {
    this.burst(x, y, 10, { angle: -Math.PI / 2, spread: 1.6, speed: 90, life: 0.4, c: [C.orange2, C.gold, C.cream], drag: 3, g: 120, s: 1 });
  }
  dashBurst(x, y, dir) {
    this.burst(x, y, 7, { angle: dir > 0 ? Math.PI : 0, spread: 0.9, speed: 70, life: 0.3, c: [C.mint, C.cream, C.teal2], drag: 4, s: 1 });
  }
  wallBump(x, y) {
    this.burst(x, y, 6, { angle: -Math.PI / 2, spread: Math.PI, speed: 50, life: 0.3, c: this.dust, g: 150, s: 1 });
  }
  ceilingBump(x, y) {
    this.burst(x, y, 4, { angle: Math.PI / 2, spread: 1.4, speed: 40, life: 0.3, c: this.dust, g: 150, s: 1 });
  }
  pickup(x, y) {
    this.burst(x, y, 7, { speed: 60, life: 0.35, c: [C.gold, C.orange2, C.white], drag: 5, s: 1 });
    this.ring(x, y, C.gold, 9, 0.22);
  }
  coreBurst(x, y) {
    this.burst(x, y, 26, { speed: 110, life: 0.8, c: [C.mint, C.teal2, C.white, C.gold], drag: 3.5, s: [1, 2], flicker: true });
    this.ring(x, y, C.mint, 30, 0.5);
    this.ring(x, y, C.white, 16, 0.3);
  }
  enemyPop(x, y, colors) {
    this.burst(x, y, 14, { speed: 90, life: 0.5, c: colors, g: 220, drag: 1.5, s: [1, 2] });
    this.ring(x, y, C.cream, 14, 0.25);
  }
  stompStar(x, y) {
    this.burst(x, y, 6, { angle: -Math.PI / 2, spread: Math.PI, speed: 70, life: 0.25, c: [C.white, C.cream], drag: 6, s: 1 });
  }
  hurt(x, y) {
    this.burst(x, y, 12, { speed: 90, life: 0.45, c: [C.mag2, C.pink, C.white], drag: 3, g: 100, s: [1, 2] });
  }
  death(x, y) {
    this.burst(x, y, 36, { speed: 140, life: 1.0, c: [C.cream, C.cream2, C.orange2, C.mint, C.white], g: 260, drag: 1, s: [1, 2, 2] });
    this.ring(x, y, C.white, 36, 0.5);
  }
  checkpoint(x, y) {
    this.burst(x, y, 18, { angle: -Math.PI / 2, spread: 1.2, speed: 80, life: 0.9, c: [C.mint, C.teal2, C.cream], g: -30, drag: 2, s: 1, flicker: true });
    this.ring(x, y, C.mint, 28, 0.5);
  }
  sparkle(x, y, c = C.gold) {
    this.burst(x, y, 1, { speed: 12, life: 0.6, c, g: -12, s: 1, flicker: true });
  }
  crumble(x, y, colors) {
    this.burst(x + 8, y + 8, 8, { speed: 40, life: 0.6, c: colors, g: 300, s: [1, 2], jitter: 12 });
  }
  pitSplash(x, y) {
    this.burst(x, y, 16, { angle: -Math.PI / 2, spread: 1.1, speed: 130, life: 0.6, c: [C.mag2, C.pink, C.mag], g: 400, s: [1, 2] });
  }
  towerBeam(x, y) {
    this.burst(x, y, 3, { angle: -Math.PI / 2, spread: 0.5, speed: 160, life: 1.2, c: [C.mint, C.white, C.gold], drag: 0.5, s: [1, 2], flicker: true, jitter: 10 });
  }
}
