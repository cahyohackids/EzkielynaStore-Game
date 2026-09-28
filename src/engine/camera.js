import { clamp, damp } from './util.js';

/**
 * Side-scrolling camera: horizontal look-ahead in the facing direction,
 * platform-snapped vertical framing (only re-centres on landing, unless the
 * player leaves a comfort band), clamped to level bounds, optional shake.
 */
export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.w = 400; this.h = 225;
    this.look = 0;
    this.focusY = 0;
    this.shakeT = 0; this.shakeDur = 1; this.shakeMag = 0;
    this.ox = 0; this.oy = 0;
    this.shakeEnabled = true;
  }

  setBounds(w, h) { this.bw = w; this.bh = h; }

  snap(p) {
    this.look = p.facing * 20;
    this.focusY = p.bottom;
    this.x = this._clampX(p.cx + this.look - this.w / 2);
    this.y = this._clampY(this.focusY - this.h * 0.62);
  }

  _clampX(x) { return clamp(x, 0, Math.max(0, this.bw - this.w)); }
  _clampY(y) { return clamp(y, Math.min(0, this.bh - this.h), Math.max(0, this.bh - this.h)); }

  update(dt, p) {
    const moving = Math.abs(p.vx) > 30;
    const targetLook = p.facing * (moving ? 34 : 18);
    this.look = damp(this.look, targetLook, moving ? 2.2 : 1.2, dt);
    const tx = p.cx + this.look - this.w / 2;
    this.x = damp(this.x, tx, 7, dt);

    // Vertical: anchor on ground, track if the player leaves the band.
    if (p.grounded || p.state !== 'play') this.focusY = p.bottom;
    else {
      if (p.bottom < this.focusY - 56) this.focusY = p.bottom + 56;
      if (p.bottom > this.focusY + 8) this.focusY = p.bottom - 8;
    }
    const ty = this.focusY - this.h * 0.62;
    this.y = damp(this.y, ty, p.grounded ? 5 : 3.5, dt);
    // Hard keep-in-view margins so fast falls never lose the player.
    const top = p.y - this.y, bot = p.bottom - this.y;
    if (top < 28) this.y = p.y - 28;
    if (bot > this.h - 20) this.y = p.bottom - (this.h - 20);

    this.x = this._clampX(this.x);
    this.y = this._clampY(this.y);

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur);
      const m = this.shakeMag * k;
      this.ox = Math.round((Math.random() * 2 - 1) * m);
      this.oy = Math.round((Math.random() * 2 - 1) * m);
    } else { this.ox = 0; this.oy = 0; }
  }

  shake(mag, dur) {
    if (!this.shakeEnabled) return;
    if (mag >= this.shakeMag * Math.max(0, this.shakeT / this.shakeDur)) {
      this.shakeMag = mag; this.shakeDur = dur; this.shakeT = dur;
    }
  }

  get rx() { return Math.round(this.x) + this.ox; }
  get ry() { return Math.round(this.y) + this.oy; }
}
