import { P, TILE } from '../config.js';
import { approach, sign } from '../engine/util.js';
import { moveX, moveY } from '../engine/physics.js';
import { T } from './level.js';

/**
 * PIP. Physics tuned for responsiveness: separate ground/air acceleration,
 * turn-around boost, coyote time, jump buffering, variable jump height,
 * apex hang, heavier fall gravity, ceiling corner correction, dash + dash-jump.
 */
export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.w = P.w;
    this.h = P.h;
    this.reset(x, y);
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.ground = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.dashBuffer = 0;
    this.jumping = false;      // rising from a player jump (variable height applies)
    this.bounced = false;      // launched by pad/stomp: jump-cut disabled
    this.dashT = 0;
    this.dashCD = 0;
    this.dashReadyFlash = 0;
    this.canDash = true;
    this.dashDir = 1;
    this.hp = 3;
    this.invuln = 0;
    this.stun = 0;
    this.state = 'play';       // play | dead | victory | respawn
    this.stateT = 0;
    this.animT = 0;
    this.landT = 0;
    this.jumpT = 0;
    this.runDustT = 0;
    this.trailT = 0;
    this.afterimages = [];
    this.dropThrough = false;
    this.lastSafe = { x, y };
    this.safeT = 0;
    this.idleT = 0;
    this.airT = 0;
    this.maxFallSpeed = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get bottom() { return this.y + this.h; }
  get dashing() { return this.dashT > 0; }
  /** 0..1 dash readiness for the HUD. */
  get dashCharge() { return this.dashCD <= 0 ? 1 : 1 - this.dashCD / P.dashCooldown; }

  step(dt, c) {
    const g = this.game;
    this.animT += dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.jumpT > 0) this.jumpT -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashReadyFlash > 0) this.dashReadyFlash -= dt;
    for (const a of this.afterimages) a.life -= dt;
    if (this.afterimages.length && this.afterimages[0].life <= 0) this.afterimages.shift();

    if (this.state === 'dead' || this.state === 'respawn') { this.stateT += dt; return; }
    if (this.state === 'victory') { this._victoryStep(dt); return; }

    const wasDashReady = this.dashCD <= 0;
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.dashBuffer -= dt;
    this.dashCD -= dt;
    if (!wasDashReady && this.dashCD <= 0) { this.dashReadyFlash = 0.25; }
    if (this.stun > 0) this.stun -= dt;

    let dir = this.stun > 0 ? 0 : c.dir;
    if (c.jumpPressed) this.jumpBuffer = P.buffer;
    if (c.dashPressed) this.dashBuffer = P.dashBuffer;

    // Drop through one-way platforms: hold down + jump.
    if (this.jumpBuffer > 0 && c.down && this.grounded && !this.ground && this._onOneWay()) {
      this.dropThrough = true;
      this.jumpBuffer = 0;
      this.grounded = false;
      this.coyote = 0;
      this.y += 1;
    }
    if (this.dropThrough && this.airT > 0.05 && !this._overlapsOneWay()) this.dropThrough = false;

    // --- Dash -------------------------------------------------------------
    if (this.dashBuffer > 0 && this.dashCD <= 0 && this.canDash && this.stun <= 0) {
      this.dashBuffer = 0;
      this.dashT = P.dashTime;
      this.dashDir = dir || this.facing;
      this.facing = this.dashDir;
      this.dashCD = P.dashCooldown;
      if (!this.grounded) this.canDash = false;
      this.vx = this.dashDir * P.dashSpeed;
      this.vy = 0;
      this.jumping = false;
      this.trailT = 0;
      g.sfx('dash');
      g.shake(1.2, 0.08);
      g.fx.dashBurst(this.cx - this.dashDir * 4, this.cy + 2, this.dashDir);
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * P.dashSpeed;
      this.vy = 0;
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.022;
        this.afterimages.push({ x: this.x, y: this.y, facing: this.facing, life: 0.2 });
      }
      // Dash-jump: jumping out of a grounded dash keeps extra momentum.
      if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
        this.dashT = 0;
        this._jump();
        this.vx = this.dashDir * P.dashJumpVx;
      } else if (this.dashT <= 0) {
        this.vx = this.dashDir * P.dashExitSpeed;
      }
    } else {
      // --- Horizontal ------------------------------------------------------
      const target = dir * P.runMax;
      let accel;
      if (this.grounded) {
        if (dir === 0) accel = P.runDecel;
        else if (this.vx !== 0 && sign(this.vx) !== dir) accel = P.turnAccel;
        else accel = P.runAccel;
        if (dir !== 0 && sign(this.vx) === dir && Math.abs(this.vx) > P.runMax) accel = P.overspeedDecelGround;
      } else {
        if (dir === 0) accel = P.airDecel;
        else if (this.vx !== 0 && sign(this.vx) !== dir) accel = P.airTurn;
        else accel = P.airAccel;
        if (sign(this.vx) === dir && Math.abs(this.vx) > P.runMax) accel = P.overspeedDecelAir;
      }
      this.vx = approach(this.vx, target, accel * dt);

      // --- Vertical --------------------------------------------------------
      let grav = this.vy < 0 ? P.gravity : P.fallGravity;
      if (this.vy < 0 && this.jumping && !c.jumpHeld && !this.bounced) grav = P.cutGravity;
      if (Math.abs(this.vy) < P.apexThreshold && c.jumpHeld && !this.grounded) grav *= P.apexGravityMul;
      this.vy = Math.min(this.vy + grav * dt, P.maxFall);

      if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) this._jump();
    }

    if (dir !== 0 && this.dashT <= 0 && this.stun <= 0) this.facing = dir;

    // --- Move & collide ------------------------------------------------------
    const wasGrounded = this.grounded;
    const impactVy = this.vy;
    if (moveX(this, g.level, this.vx * dt)) {
      if (this.dashT > 0) {
        this.dashT = 0;
        g.fx.wallBump(this.dashDir > 0 ? this.x + this.w : this.x, this.cy);
        g.shake(1.5, 0.08);
      }
      this.vx = 0;
    }

    // Ceiling corner correction: nudge around ledges we barely clip.
    if (this.vy < 0 && !g.level.rectFree(this.x, this.y + this.vy * dt, this.w, this.h)) {
      for (let off = 1; off <= 4; off++) {
        if (g.level.rectFree(this.x + off, this.y + this.vy * dt, this.w, this.h) && g.level.rectFree(this.x + off, this.y, this.w, this.h)) { this.x += off; break; }
        if (g.level.rectFree(this.x - off, this.y + this.vy * dt, this.w, this.h) && g.level.rectFree(this.x - off, this.y, this.w, this.h)) { this.x -= off; break; }
      }
    }

    this.ground = null;
    const res = moveY(this, g.level, this.vy * dt, g.platforms);
    if (res === 1) {
      if (this.ground && this.ground.bounce) {
        this._bounce(this.ground);
      } else {
        this.grounded = true;
        this.coyote = P.coyote;
        this.canDash = true;
        this.jumping = false;
        this.bounced = false;
        this.dropThrough = false;
        if (!wasGrounded) this._land(impactVy);
        this.vy = 0;
        if (this.ground && this.ground.onStand) this.ground.onStand(this);
        this._touchVanish();
      }
    } else {
      if (res === -1) {
        if (this.vy < -60) g.fx.ceilingBump(this.cx, this.y);
        this.vy = Math.max(this.vy, 0);
        this.jumping = false;
      }
      this.grounded = false;
    }

    if (!this.grounded) {
      this.airT += dt;
      if (this.vy > this.maxFallSpeed) this.maxFallSpeed = this.vy;
    } else this.airT = 0;

    // Run dust
    if (this.grounded && Math.abs(this.vx) > 70 && dir !== 0) {
      this.runDustT -= dt;
      if (this.runDustT <= 0) {
        this.runDustT = 0.14;
        g.fx.runDust(this.cx - this.facing * 4, this.bottom, this.facing);
      }
      if (sign(this.vx) !== dir && Math.abs(this.vx) > 90) g.fx.skid(this.cx, this.bottom, dir);
    }

    this._trackSafe(dt);
    if (this.grounded && dir === 0 && Math.abs(this.vx) < 1) this.idleT += dt; else this.idleT = 0;
  }

  _jump() {
    const g = this.game;
    this.vy = -P.jumpVel;
    this.jumping = true;
    this.bounced = false;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpT = 0.12;
    this.landT = 0;
    g.sfx('jump');
    g.fx.jumpPuff(this.cx, this.bottom);
  }

  _bounce(pad) {
    const g = this.game;
    this.vy = -P.bounceVel;
    this.jumping = false;
    this.bounced = true;
    this.grounded = false;
    this.coyote = 0;
    this.canDash = true;
    this.dashCD = Math.min(this.dashCD, 0);
    this.jumpT = 0.18;
    pad.onBounce && pad.onBounce();
    g.sfx('bounce');
    g.fx.bouncePuff(this.cx, this.bottom);
    g.shake(1.5, 0.1);
  }

  /** Called by enemies when stomped. */
  stompBounce(held) {
    this.vy = -(held ? P.stompVelHeld : P.stompVel);
    this.jumping = true;
    this.bounced = false;
    this.canDash = true;
    this.grounded = false;
    this.jumpT = 0.12;
  }

  _land(impactVy) {
    const g = this.game;
    if (impactVy > 120) {
      this.landT = 0.1;
      g.fx.landDust(this.cx, this.bottom, Math.min(1, impactVy / P.maxFall));
      g.sfx('land', { vol: Math.min(1, impactVy / P.maxFall) });
    }
    if (impactVy >= P.maxFall - 1 && this.airT > 0.55) g.shake(1.5, 0.1);
    this.maxFallSpeed = 0;
  }

  _onOneWay() {
    const lv = this.game.level;
    const ty = Math.floor((this.bottom + 1) / TILE);
    const tx0 = Math.floor(this.x / TILE), tx1 = Math.floor((this.x + this.w - 0.01) / TILE);
    let any = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.solidAt(tx, ty)) return false;
      if (lv.oneWayAt(tx, ty)) any = true;
    }
    return any;
  }

  _overlapsOneWay() {
    const lv = this.game.level;
    const tx0 = Math.floor(this.x / TILE), tx1 = Math.floor((this.x + this.w - 0.01) / TILE);
    const ty0 = Math.floor(this.y / TILE), ty1 = Math.floor((this.bottom - 0.01) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (lv.oneWayAt(tx, ty)) return true;
    return false;
  }

  _touchVanish() {
    if (this.ground) return;
    const lv = this.game.level;
    const ty = Math.floor((this.bottom + 1) / TILE);
    const tx0 = Math.floor(this.x / TILE), tx1 = Math.floor((this.x + this.w - 0.01) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.tileAt(tx, ty) === T.VANISH && lv.touchVanish(tx, ty)) this.game.sfx('crumble');
    }
  }

  /** Remember the last fully-supported, hazard-free standing spot (pit respawn). */
  _trackSafe(dt) {
    this.safeT -= dt;
    if (!this.grounded || this.ground || this.safeT > 0) return;
    const lv = this.game.level;
    const ty = Math.floor((this.bottom + 1) / TILE);
    const txL = Math.floor((this.x - 2) / TILE), txR = Math.floor((this.x + this.w + 2) / TILE);
    for (let tx = txL; tx <= txR; tx++) {
      if (lv.tileAt(tx, ty) !== T.SOLID) return;
      for (let dy = -2; dy <= 0; dy++) {
        const t = lv.tileAt(tx, ty + dy);
        if (t === T.SPIKE_UP || t === T.SPIKE_DOWN || t === T.PIT) return;
      }
    }
    this.safeT = 0.15;
    this.lastSafe.x = this.x;
    this.lastSafe.y = this.y;
  }

  hurt(srcX, opts = {}) {
    const g = this.game;
    if (this.invuln > 0 || this.state !== 'play') return false;
    this.hp -= 1;
    this.invuln = P.invuln;
    this.dashT = 0;
    this.jumping = false;
    this.bounced = true;
    g.onPlayerHurt(this);
    if (this.hp <= 0) { this.die(); return true; }
    if (!opts.noKnock) {
      const d = sign(this.cx - srcX) || -this.facing;
      this.vx = d * P.knockVx;
      this.vy = -(opts.knockVy || P.knockVy);
      this.stun = P.hurtStun;
      this.grounded = false;
    }
    return true;
  }

  die() {
    this.state = 'dead';
    this.stateT = 0;
    this.vx = 0; this.vy = 0;
    this.dashT = 0;
    this.game.onPlayerDeath(this);
  }

  startVictory(towerX) {
    this.state = 'victory';
    this.stateT = 0;
    this.dashT = 0;
    this.victoryX = towerX;
  }

  _victoryStep(dt) {
    this.stateT += dt;
    const lv = this.game.level;
    // Walk to the console, then celebrate.
    const dx = this.victoryX - this.cx;
    if (Math.abs(dx) > 1.5 && this.stateT < 1.6) {
      this.facing = sign(dx);
      this.vx = approach(this.vx, sign(dx) * 70, 600 * dt);
    } else {
      this.vx = approach(this.vx, 0, 900 * dt);
      this.facing = 1;
    }
    this.vy = Math.min(this.vy + P.fallGravity * dt, P.maxFall);
    moveX(this, lv, this.vx * dt);
    this.ground = null;
    if (moveY(this, lv, this.vy * dt, this.game.platforms) === 1) { this.vy = 0; this.grounded = true; }
    else this.grounded = false;
  }

  /** Name of the pose to render this frame. */
  pose() {
    if (this.state === 'dead') return 'hurt';
    if (this.state === 'victory') {
      if (this.stateT > 1.6) return Math.floor(this.stateT * 4) % 2 ? 'cheer1' : 'cheer0';
      if (Math.abs(this.vx) > 10) return 'run' + (Math.floor(this.animT * 12) % 6);
      return 'idle0';
    }
    if (this.stun > 0) return 'hurt';
    if (this.dashT > 0) return 'dash';
    if (!this.grounded) {
      if (this.jumpT > 0) return 'stretch';
      if (this.vy < -40) return 'jump';
      if (this.vy < 60) return 'apex';
      return 'fall';
    }
    if (this.landT > 0) return 'squash';
    if (Math.abs(this.vx) > 8) {
      const speed = Math.abs(this.vx) / P.runMax;
      return 'run' + (Math.floor(this.animT * (8 + speed * 6)) % 6);
    }
    const blink = (this.animT % 3.4) > 3.25;
    const b = Math.floor(this.animT * 1.6) % 2;
    return blink ? 'blink' + b : 'idle' + b;
  }
}
