import { C } from '../config.js';
import { drawText, textWidth } from '../gfx/font.js';
import { easeOutBack } from '../engine/util.js';

const px = (ctx, x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

/** Minimal in-canvas HUD: energy cells, dash meter, bits, cores, toasts, banner. */
export class Hud {
  constructor() {
    this.toasts = [];
    this.banner = null;
    this.bitBump = 0;
    this.hurtFlash = 0;
    this.lostCell = -1;
    this.coreFlash = 0;
  }

  reset() { this.toasts.length = 0; this.banner = null; this.bitBump = 0; this.hurtFlash = 0; this.coreFlash = 0; }

  toast(text, color = C.cream) {
    if (this.toasts.length && this.toasts[this.toasts.length - 1].text === text) return;
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 2) this.toasts.shift();
  }

  showBanner(sector, name) { this.banner = { sector, name, t: 0 }; }

  onHurt(hpAfter) { this.hurtFlash = 0.5; this.lostCell = hpAfter; }

  update(dt) {
    if (this.bitBump > 0) this.bitBump -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.coreFlash > 0) this.coreFlash -= dt;
    for (const t of this.toasts) t.t += dt;
    while (this.toasts.length && this.toasts[0].t > 1.8) this.toasts.shift();
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 3) this.banner = null; }
  }

  draw(ctx, g, vw, t) {
    const p = g.player;
    // --- Energy cells
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 11, y = 8;
      const full = i < p.hp;
      let jx = 0;
      if (i === this.lostCell && this.hurtFlash > 0) jx = Math.floor(this.hurtFlash * 40) % 2 ? 1 : -1;
      px(ctx, x + 2 + jx, y - 2, C.ink, 5, 3);
      px(ctx, x + 3 + jx, y - 1, full ? C.cream2 : C.slate, 3, 1);
      px(ctx, x + jx, y, C.ink, 9, 12);
      if (full) {
        const low = p.hp === 1 && Math.floor(t * 3) % 2 === 0;
        px(ctx, x + 1 + jx, y + 1, low ? C.pink : C.teal2, 7, 10);
        px(ctx, x + 1 + jx, y + 1, low ? C.white : C.mint, 7, 2);
        px(ctx, x + 1 + jx, y + 9, low ? C.mag2 : C.teal, 7, 2);
        px(ctx, x + 2 + jx, y + 4, low ? C.white : C.mint, 1, 3);
      } else {
        px(ctx, x + 1 + jx, y + 1, C.navy, 7, 10);
        if (i === this.lostCell && this.hurtFlash > 0.25) px(ctx, x + 1 + jx, y + 1, C.white, 7, 10);
        px(ctx, x + 4 + jx, y + 5, C.slate, 1, 2);
      }
    }
    // --- Dash meter
    {
      const x = 44, y = 8;
      const ready = p.dashCharge >= 1 && p.canDash;
      const flash = p.dashReadyFlash > 0;
      px(ctx, x, y, C.ink, 17, 12);
      px(ctx, x + 1, y + 1, C.navy, 15, 10);
      const col = flash ? C.white : ready ? C.gold : C.slate2;
      // double chevron
      for (let k = 0; k < 2; k++) {
        const cx = x + 4 + k * 5;
        px(ctx, cx, y + 2, col, 2, 1); px(ctx, cx + 1, y + 3, col, 2, 1); px(ctx, cx + 2, y + 4, col, 2, 2);
        px(ctx, cx + 1, y + 6, col, 2, 1); px(ctx, cx, y + 7, col, 2, 1);
      }
      const fill = Math.round(13 * Math.min(1, p.dashCharge));
      px(ctx, x + 2, y + 9, C.slate, 13, 1);
      px(ctx, x + 2, y + 9, ready ? C.orange2 : C.blue2, fill, 1);
    }
    // --- Signal bits
    {
      const txt = `${g.bitsGot}/${g.bitsTotal}`;
      const bump = this.bitBump > 0 ? -1 : 0;
      const tw = textWidth(txt);
      const x = vw - 8 - tw;
      drawText(ctx, txt, x, 10 + bump, this.bitBump > 0 ? C.white : C.cream, { shadow: C.ink });
      // bit icon
      const ix = x - 10, iy = 8 + bump;
      px(ctx, ix + 2, iy, C.orange0, 3, 1); px(ctx, ix + 1, iy + 1, C.orange0, 5, 1); px(ctx, ix, iy + 2, C.orange0, 7, 5); px(ctx, ix + 1, iy + 7, C.orange0, 5, 1); px(ctx, ix + 2, iy + 8, C.orange0, 3, 1);
      px(ctx, ix + 2, iy + 1, C.gold, 3, 1); px(ctx, ix + 1, iy + 2, C.gold, 5, 3); px(ctx, ix + 1, iy + 5, C.orange2, 5, 2); px(ctx, ix + 2, iy + 7, C.orange2, 3, 1);
      px(ctx, ix + 2, iy + 2, C.white);
    }
    // --- Data cores
    for (let i = 0; i < 3; i++) {
      const x = vw - 8 - (3 - i) * 10 + 1, y = 22;
      const got = g.coresGot[i];
      const flash = this.coreFlash > 0 && g.lastCore === i && Math.floor(this.coreFlash * 16) % 2;
      px(ctx, x + 2, y, C.ink, 5, 1); px(ctx, x + 1, y + 1, C.ink, 7, 1); px(ctx, x, y + 2, C.ink, 9, 4); px(ctx, x + 1, y + 6, C.ink, 7, 1); px(ctx, x + 2, y + 7, C.ink, 5, 1);
      const inner = flash ? C.white : got ? C.teal2 : C.navy;
      px(ctx, x + 2, y + 1, inner, 5, 1); px(ctx, x + 1, y + 2, inner, 7, 4); px(ctx, x + 2, y + 6, inner, 5, 1);
      if (got) { px(ctx, x + 3, y + 3, C.white, 2, 2); px(ctx, x + 2, y + 1, C.mint, 3, 1); }
      else px(ctx, x + 4, y + 3, C.slate, 1, 2);
    }

    // --- Toasts
    let ty = 40;
    for (const tt of this.toasts) {
      const k = Math.min(1, tt.t * 5);
      const out = tt.t > 1.5 ? (tt.t - 1.5) / 0.3 : 0;
      if (out > 0 && Math.floor(out * 10) % 2) { ty += 12; continue; }
      drawText(ctx, tt.text, vw / 2, ty - Math.round((1 - easeOutBack(k)) * 6), tt.color, { align: 'center', shadow: C.ink });
      ty += 12;
    }

    // --- Level banner
    if (this.banner) {
      const b = this.banner;
      const inK = Math.min(1, b.t / 0.35);
      const outK = b.t > 2.4 ? Math.min(1, (b.t - 2.4) / 0.5) : 0;
      const y = 62;
      const w = Math.round(Math.max(textWidth(b.name, 2), 120) + 24);
      const cw = Math.round(w * (outK > 0 ? 1 - outK : easeOutBack(inK)));
      if (cw > 4) {
        const x = Math.round(vw / 2 - cw / 2);
        ctx.globalAlpha = 0.85;
        px(ctx, x, y - 6, C.ink, cw, 36);
        ctx.globalAlpha = 1;
        px(ctx, x, y - 6, C.orange, cw, 1);
        px(ctx, x, y + 29, C.teal2, cw, 1);
        if (inK >= 1 && outK < 0.5) {
          drawText(ctx, b.sector, vw / 2, y - 1, C.orange2, { align: 'center' });
          drawText(ctx, b.name, vw / 2, y + 10, C.cream, { align: 'center', scale: 2, shadow: C.navy });
        }
      }
    }
  }
}
