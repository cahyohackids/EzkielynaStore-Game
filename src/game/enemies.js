import { C, TILE } from '../config.js';
import { moveX, moveY, groundAhead } from '../engine/physics.js';
import { sign } from '../engine/util.js';

const GRAV = 900;

class Enemy {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.alive = true;
    this.dead = false;
    this.deathT = 0;
    this.flash = 0;
    this.t = Math.random() * 3;
    this.stompable = true;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.grounded = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  onScreen(margin = 40) {
    const cam = this.game.cam;
    return this.x + this.w > cam.x - margin && this.x < cam.x + cam.w + margin && this.y + this.h > cam.y - margin && this.y < cam.y + cam.h + margin;
  }
  kill(stomped) {
    if (!this.alive) return;
    this.alive = false;
    this.stomped = stomped;
    this.deathT = 0;
    this.vy = stomped ? 0 : -160;
    this.game.sfx(stomped ? 'stomp' : 'enemyDie');
  }
  _physics(dt) {
    const lv = this.game.level;
    this.vy = Math.min(this.vy + GRAV * dt, 320);
    const hitWall = moveX(this, lv, this.vx * dt);
    this.ground = null;
    const r = moveY(this, lv, this.vy * dt, this.game.platforms);
    if (r === 1) { this.grounded = true; this.vy = 0; } else { this.grounded = false; if (r === -1) this.vy = 0; }
    if (this.y > lv.pxH + 32) this.dead = true;
    return hitWall;
  }
  _edgeAhead() {
    const probeX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return !groundAhead(this, this.game.level, probeX);
  }
  _dying(dt) {
    this.deathT += dt;
    if (this.deathT > (this.stomped ? 0.32 : 0.45)) {
      this.dead = true;
      this.game.fx.enemyPop(this.cx, this.cy, this.colors);
    }
  }
}

/** Glitch Hopper: patrols, does little periodic hops. Stompable. */
export class Hopper extends Enemy {
  constructor(game, def) {
    super(game, def);
    this.x = def.x; this.y = def.y;
    this.w = 12; this.h = 10;
    this.hopT = 0.8 + Math.random() * 0.8;
    this.speed = def.speed || 30;
    this.colors = [C.mag, C.mag2, C.pink, C.teal2];
    this.glitch = 0;
  }
  update(dt) {
    this.t += dt;
    if (!this.alive) return this._dying(dt);
    if (this.grounded) {
      this.hopT -= dt;
      if (this.hopT < 0.2) this.vx = 0;
      else this.vx = this.dir * this.speed;
      if (this.hopT <= 0) {
        this.vy = -175;
        this.vx = this.dir * this.speed * 1.5;
        this.hopT = 1.0 + Math.random() * 0.9;
        this.grounded = false;
      } else if (this._edgeAhead()) this.dir *= -1;
    }
    if (this._physics(dt)) this.dir *= -1;
    if (Math.random() < dt * 0.8) this.glitch = 0.12;
    if (this.glitch > 0) this.glitch -= dt;
  }
  draw(ctx, cx, cy, S) {
    let f;
    if (!this.alive) {
      if (this.stomped) f = S.hopper.flat;
      else f = S.hopper.air;
    } else if (!this.grounded) f = S.hopper.air;
    else if (this.hopT < 0.2) f = S.hopper.crouch;
    else f = Math.floor(this.t * 4) % 2 ? S.hopper.idle1 : S.hopper.idle0;
    const img = f[this.dir > 0 ? 1 : -1];
    const x = Math.round(this.x + this.w / 2 - 9 - cx), y = Math.round(this.y + this.h - 16 - cy + (this.alive || this.stomped ? 0 : this.deathT * -40 + this.deathT * this.deathT * 400));
    if (!this.alive && Math.floor(this.deathT * 20) % 2) return;
    if (this.glitch > 0 && !this.game.reduced) {
      // Horizontal slice offset: the "glitch" in Glitch Hopper.
      ctx.drawImage(img, 0, 0, 18, 7, x + 1, y, 18, 7);
      ctx.drawImage(img, 0, 7, 18, 9, x - 1, y + 7, 18, 9);
    } else ctx.drawImage(img, x, y);
  }
}

/** Corrupt Bug: fast patrol; telegraphs, then charges when PIP is in front. */
export class Bug extends Enemy {
  constructor(game, def) {
    super(game, def);
    this.x = def.x; this.y = def.y;
    this.w = 16; this.h = 8;
    this.state = 'walk';
    this.stateT = 0;
    this.cool = 0.5;
    const fast = game.level.theme === 'tower';
    this.walkSpeed = fast ? 46 : 38;
    this.chargeSpeed = fast ? 205 : 170;
    this.colors = [C.orange, C.orange0, C.gold, C.mag];
  }
  update(dt) {
    this.t += dt;
    if (!this.alive) return this._dying(dt);
    const p = this.game.player;
    this.stateT += dt;
    this.cool -= dt;
    if (this.state === 'walk') {
      this.vx = this.dir * this.walkSpeed;
      if (this.grounded && this._edgeAhead()) this.dir *= -1;
      const dx = p.cx - this.cx, dy = p.bottom - (this.y + this.h);
      if (this.cool <= 0 && p.state === 'play' && Math.abs(dx) < 118 && Math.abs(dy) < 22 && sign(dx) === this.dir && this.grounded) {
        this.state = 'alert'; this.stateT = 0;
        if (this.onScreen(0)) this.game.sfx('bugAlert');
      }
    } else if (this.state === 'alert') {
      this.vx = 0;
      if (this.stateT > 0.42) { this.state = 'charge'; this.stateT = 0; }
    } else if (this.state === 'charge') {
      this.vx = this.dir * this.chargeSpeed;
      if (Math.random() < dt * 30) this.game.fx.runDust(this.cx - this.dir * 6, this.y + this.h, this.dir);
      if ((this.grounded && this._edgeAhead()) || this.stateT > 1.3) { this.state = 'stun'; this.stateT = 0; this.vx = 0; }
    } else if (this.state === 'stun') {
      this.vx = 0;
      if (this.stateT > 0.7) { this.state = 'walk'; this.stateT = 0; this.cool = 0.9; this.dir *= -1; }
    }
    if (this._physics(dt)) {
      if (this.state === 'charge') {
        this.state = 'stun'; this.stateT = 0;
        this.game.fx.wallBump(this.dir > 0 ? this.x + this.w : this.x, this.cy);
        if (this.onScreen(0)) this.game.shake(1, 0.08);
      } else this.dir *= -1;
    }
  }
  draw(ctx, cx, cy, S) {
    let f;
    if (!this.alive) f = this.stomped ? S.bug.flat : S.bug.stun;
    else if (this.state === 'alert') f = S.bug.alert;
    else if (this.state === 'charge') f = Math.floor(this.t * 20) % 2 ? S.bug.charge0 : S.bug.charge1;
    else if (this.state === 'stun') f = S.bug.stun;
    else f = Math.floor(this.t * 8) % 2 ? S.bug.walk0 : S.bug.walk1;
    if (!this.alive && Math.floor(this.deathT * 20) % 2) return;
    const jx = this.state === 'alert' ? (Math.floor(this.t * 30) % 2 ? 1 : -1) : 0;
    const x = Math.round(this.x + this.w / 2 - 11 - cx + jx), y = Math.round(this.y + this.h - 12 - cy + (this.alive || this.stomped ? 0 : this.deathT * -40 + this.deathT * this.deathT * 400));
    ctx.drawImage(f[this.dir > 0 ? 1 : -1], x, y);
    if (this.state === 'alert' && this.alive) {
      // "!" telegraph
      const bx = Math.round(this.cx - cx), by = Math.round(this.y - cy - 10);
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 2, by - 1, 5, 9);
      ctx.fillStyle = C.gold; ctx.fillRect(bx - 1, by, 3, 4); ctx.fillRect(bx - 1, by + 5, 3, 2);
    }
    if (this.state === 'stun' && this.alive) {
      const a = this.t * 8;
      ctx.fillStyle = C.cream;
      ctx.fillRect(Math.round(this.cx - cx + Math.cos(a) * 6), Math.round(this.y - cy - 4 + Math.sin(a) * 2), 1, 1);
      ctx.fillRect(Math.round(this.cx - cx - Math.cos(a) * 6), Math.round(this.y - cy - 4 - Math.sin(a) * 2), 1, 1);
    }
  }
}

/** Static Drone: floats along a path, sparks below. Stompable from above only. */
export class Drone extends Enemy {
  constructor(game, def) {
    super(game, def);
    this.w = 12; this.h = 11;
    this.ax = def.x * TILE + 8; this.ay = def.y * TILE + 8;
    this.bx = def.to ? def.to[0] * TILE + 8 : this.ax;
    this.by = def.to ? def.to[1] * TILE + 8 : this.ay;
    this.orbit = def.orbit ? def.orbit * TILE : 0;
    this.period = def.period || 4;
    this.phase = def.phase || 0;
    this.t = 0;
    this.colors = [C.navy2, C.slate2, C.orange, C.mint, C.cream];
    this._place();
  }
  _place() {
    let px, py;
    const a = (this.t / this.period) * Math.PI * 2 + this.phase * Math.PI * 2;
    if (this.orbit) { px = this.ax + Math.cos(a) * this.orbit; py = this.ay + Math.sin(a) * this.orbit; }
    else {
      const u = (1 - Math.cos(a)) / 2;
      px = this.ax + (this.bx - this.ax) * u;
      py = this.ay + (this.by - this.ay) * u + Math.sin(this.t * 3) * 1.5;
    }
    const nx = px - this.w / 2;
    if (this.x != null) this.dir = nx > this.x ? 1 : nx < this.x ? -1 : this.dir;
    this.x = nx; this.y = py - this.h / 2 + 1;
  }
  update(dt) {
    if (!this.alive) {
      this.deathT += dt;
      this.vy += 600 * dt;
      this.y += this.vy * dt;
      if (this.deathT > 0.5) { this.dead = true; this.game.fx.enemyPop(this.cx, this.cy, this.colors); }
      return;
    }
    this.t += dt;
    this._place();
    if (Math.random() < dt * 5 && this.onScreen(0)) this.game.fx.sparkle(this.cx + (Math.random() - 0.5) * 10, this.y + this.h + 2, Math.random() < 0.5 ? C.mint : C.cream);
  }
  draw(ctx, cx, cy, S) {
    if (!this.alive && Math.floor(this.deathT * 20) % 2) return;
    const img = !this.alive ? S.drone[2] : Math.floor(this.t * 3) % 2 ? S.drone[1] : S.drone[0];
    const x = Math.round(this.cx - 10 - cx), y = Math.round(this.cy - 10 - cy);
    ctx.drawImage(img, x, y);
    if (!this.alive) return;
    // Static field: jagged sparks under and around the lower half.
    ctx.fillStyle = Math.floor(this.t * 12) % 2 ? C.mint : C.cream;
    const seed = Math.floor(this.t * 14);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * (0.15 + 0.35 * i) + ((seed * 7 + i * 13) % 5) * 0.08;
      let sx = this.cx - cx + Math.cos(a) * 8, sy = this.cy - cy + Math.sin(a) * 8;
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
        sx += Math.cos(a) * 1.5 + (((seed + k + i) % 3) - 1);
        sy += Math.sin(a) * 1.5;
      }
    }
  }
}

export function createEnemy(game, def) {
  if (def.type === 'hopper') return new Hopper(game, def);
  if (def.type === 'bug') return new Bug(game, def);
  if (def.type === 'drone') return new Drone(game, def);
  return null;
}
