import { C, TILE, VIEW_H, PHYS_STEP, LEVEL_IDS } from '../config.js';
import { Camera } from '../engine/camera.js';
import { Particles } from '../engine/particles.js';
import { overlap, makeCanvas, clamp } from '../engine/util.js';
import { buildSprites, PIP_W, PIP_H } from '../gfx/sprites.js';
import { buildLevelLayers, buildBackground, drawBackground, drawPits, drawDynamicBlocks, THEMES } from '../gfx/world.js';
import { Level, T } from './level.js';
import { Player } from './player.js';
import { createEnemy } from './enemies.js';
import { Bit, Core, Checkpoint, Tower, Sign, Mover, Faller, Pad, Laser } from './objects.js';
import { Hud } from './hud.js';
import { LEVELS } from '../levels/index.js';

/**
 * Owns the simulation + rendering of one level at a time and the high-level
 * flow (play / pause / death / completion). Menus live in ui/menus.js and talk
 * to the game through a handful of methods.
 */
export class Game {
  constructor(canvas, { input, audio, save }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.audio = audio;
    this.save = save;
    this.S = buildSprites();
    this._buildTints();
    this.cam = new Camera();
    this.fx = new Particles();
    this.hud = new Hud();
    this.vw = 400;
    this.vh = VIEW_H;
    this.state = 'menu';
    this.t = 0;
    this.freeze = 0;
    this.fade = null;       // { t, dur, cover, cb }
    this.fadeCover = 0;     // 0..1 current cover
    this.ui = null;
    this.flash = 0;
    this.applySettings();
    this.loadLevel(0, { attract: true });
  }

  // ------------------------------------------------------------------------
  // Settings / helpers
  // ------------------------------------------------------------------------
  applySettings() {
    const s = this.save.settings;
    this.reduced = !!s.reducedMotion;
    this.cam.shakeEnabled = !!s.shake && !this.reduced;
    this.fx.scale = this.reduced ? 0.5 : 1;
    this.audio.setVolumes({ music: s.music, sfx: s.sfx, muted: s.muted });
  }

  sfx(name, opts) { this.audio.play(name, opts); }
  shake(mag, dur) { this.cam.shake(mag, dur); }
  hitstop(t) { if (!this.reduced) this.freeze = Math.max(this.freeze, t); }
  touchMode() { return this.input.lastDevice === 'touch' || document.body.classList.contains('touch'); }

  resize(vw) {
    this.vw = vw;
    this.canvas.width = vw;
    this.canvas.height = this.vh;
    this.ctx.imageSmoothingEnabled = false;
    this.cam.w = vw;
    this.cam.h = this.vh;
    if (this.player && this.state !== 'menu') this.cam.snap(this.player);
  }

  _buildTints() {
    // Mint silhouettes of the dash pose for the afterimage trail.
    this.dashGhost = {};
    for (const d of [1, -1]) {
      const src = this.S.pip.dash[d];
      const [c, ctx] = makeCanvas(PIP_W, PIP_H);
      ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = C.mint;
      ctx.fillRect(0, 0, PIP_W, PIP_H);
      this.dashGhost[d] = c;
    }
    this.whitePip = {};
    for (const name of ['hurt', 'idle0']) {
      this.whitePip[name] = {};
      for (const d of [1, -1]) {
        const [c, ctx] = makeCanvas(PIP_W, PIP_H);
        ctx.drawImage(this.S.pip[name][d], 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = C.white;
        ctx.fillRect(0, 0, PIP_W, PIP_H);
        this.whitePip[name][d] = c;
      }
    }
  }

  // ------------------------------------------------------------------------
  // Level lifecycle
  // ------------------------------------------------------------------------
  loadLevel(index, { attract = false } = {}) {
    const def = LEVELS[index];
    this.levelIndex = index;
    this.levelDef = def;
    this.level = new Level(def);
    this.layers = buildLevelLayers(this.level);
    this.bg = buildBackground(def.theme);
    this.fx.clear();
    this.fx.dust = THEMES[def.theme].dust;
    this.cam.setBounds(this.level.pxW, this.level.pxH);

    const saved = this.save.level(def.id);
    const regionAt = (x, y) => {
      const r = this.level.falseRegionOf[Math.floor(y / TILE) * this.level.w + Math.floor(x / TILE)];
      return r >= 0 ? this.level.falseRegions[r] : null;
    };
    this.bits = this.level.bits.map((b) => new Bit(b.x, b.y, regionAt(b.x, b.y)));
    this.cores = this.level.cores.map((c) => new Core(c.x, c.y, c.index, !!saved.cores[c.index], regionAt(c.x, c.y)));
    this.checkpoints = this.level.checkpoints.map((c, i) => new Checkpoint(c.x, c.y, i));
    this.tower = this.level.tower ? new Tower(this.level.tower.x, this.level.tower.y) : null;
    this.signs = (def.entities || []).filter((e) => e.type === 'sign').map((e) => new Sign(e, () => this.touchMode()));
    this.lasers = (def.entities || []).filter((e) => e.type === 'laser').map((e) => new Laser(e, this));
    this._spawnDynamic();

    this.bitsTotal = this.bits.length;
    this.bitsGot = 0;
    this.coresGot = [false, false, false];
    this.lastCore = -1;
    this.deaths = 0;
    this.time = 0;
    this.respawnPoint = { ...this.level.spawn };
    this.activeCheckpoint = null;
    this.player = new Player(this, this.level.spawn.x, this.level.spawn.y);
    this.hud.reset();
    this.completeT = 0;
    this.completeShown = false;
    this.deadT = 0;
    this.respawnT = 0;
    this.attract = attract;
    if (attract) {
      this.state = 'menu';
      this.cam.x = 0; this.cam.y = this.level.pxH - this.vh;
    } else {
      this.cam.snap(this.player);
    }
  }

  _spawnDynamic() {
    const def = this.levelDef, theme = def.theme;
    this.enemies = this.level.enemyDefs.map((d) => createEnemy(this, d)).filter(Boolean);
    this.movers = (def.entities || []).filter((e) => e.type === 'mover').map((e) => new Mover(e, theme));
    this.fallers = this.level.fallDefs.map((d) => { const f = new Faller(d, theme); f.game = this; return f; });
    this.pads = this.level.bounceDefs.map((d) => new Pad(d));
    this.platforms = [...this.movers, ...this.fallers, ...this.pads];
  }

  startLevel(index) {
    this.transition(() => {
      this.ui.hideAll();
      this.loadLevel(index);
      this.state = 'play';
      this.input.captureGame = true;
      this.audio.playMusic(this.levelDef.theme);
      this.audio.setMuffled(false);
      this.hud.showBanner(`SECTOR ${index + 1}`, this.levelDef.name);
      this.ui.showHud(true);
    });
  }

  restartLevel() { this.startLevel(this.levelIndex); }

  toMenu(screen = 'title') {
    this.transition(() => {
      this.loadLevel(0, { attract: true });
      this.input.captureGame = false;
      this.audio.playMusic('menu');
      this.audio.setMuffled(false);
      this.ui.showHud(false);
      this.ui.show(screen);
    });
  }

  transition(cb, dur = 0.32) {
    this.fade = { t: 0, dur, phase: 'in', cb };
  }

  pause() {
    if (this.state !== 'play' || this.player.state !== 'play') return;
    this.state = 'paused';
    this.audio.setMuffled(true);
    this.sfx('pause');
    this.input.captureGame = false;
    this.ui.showPause(this.stats());
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'play';
    this.audio.setMuffled(false);
    this.input.captureGame = true;
    this.input.clear();
    this.ui.hideAll();
  }

  stats() {
    return {
      time: this.time, bits: this.bitsGot, totalBits: this.bitsTotal,
      cores: this.coresGot.slice(), deaths: this.deaths, levelIndex: this.levelIndex, name: this.levelDef.name,
    };
  }

  // ------------------------------------------------------------------------
  // Events from entities
  // ------------------------------------------------------------------------
  onPlayerHurt(p) {
    this.sfx('hurt');
    this.fx.hurt(p.cx, p.cy);
    this.shake(3, 0.2);
    this.hitstop(0.08);
    this.hud.onHurt(p.hp - 1);
    this.flash = 0.12;
  }

  onPlayerDeath(p) {
    this.deaths++;
    this.deadT = 0;
    this.sfx('death');
    this.shake(4, 0.3);
    this.hitstop(0.12);
    this.audio.setMuffled(true);
  }

  respawn() {
    const rp = this.respawnPoint;
    this._spawnDynamic();
    this.player.reset(rp.x, rp.y);
    this.player.state = 'respawn';
    this.player.stateT = 0;
    this.player.invuln = 0.6;
    this.respawnT = 0;
    this.state = 'play';
    this.input.captureGame = true;
    this.input.clear();
    this.cam.snap(this.player);
    this.audio.setMuffled(false);
    this.sfx('respawn');
    this.fx.checkpoint(this.player.cx, this.player.bottom);
    this.ui.hideAll();
  }

  retryFromCheckpoint() { this.transition(() => this.respawn(), 0.25); }

  _collectBit(b) {
    b.got = true;
    this.bitsGot++;
    this.sfx('bit');
    this.fx.pickup(b.x, b.y);
    this.hud.bitBump = 0.12;
  }

  _collectCore(c) {
    c.got = true;
    this.coresGot[c.index] = true;
    this.lastCore = c.index;
    this.sfx('core');
    this.fx.coreBurst(c.x, c.y);
    this.hitstop(0.06);
    this.shake(2, 0.15);
    const n = this.coresGot.filter(Boolean).length;
    this.hud.toast(`DATA CORE ${n}/3`, C.mint);
    this.hud.coreFlash = 0.8;
  }

  _activateCheckpoint(cp) {
    cp.active = true;
    cp.t = 0;
    this.activeCheckpoint = cp;
    this.respawnPoint = cp.spawn;
    this.player.hp = 3;
    this.sfx('checkpoint');
    this.fx.checkpoint(cp.x + 8, cp.y - 26);
  }

  _startVictory() {
    const p = this.player;
    this.tower.activate();
    p.startVictory(this.tower.cx);
    this.state = 'complete';
    this.completeT = 0;
    this.audio.stopMusic();
    this.sfx('tower');
    this.input.captureGame = false;
  }

  _pitFall() {
    const p = this.player;
    this.sfx('pit');
    this.fx.pitSplash(p.cx, Math.min(p.bottom, this.level.pxH - 4));
    const died = p.hurt(p.cx, { noKnock: true });
    if (p.state === 'play') {
      p.state = 'respawn';
      p.stateT = -0.45; // hidden for a beat, then rematerialise
      this.respawnT = 0.45;
    }
    return died;
  }

  // ------------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.audio.tick(dt);

    if (this.fade) {
      const f = this.fade;
      f.t += dt;
      if (f.phase === 'in') {
        this.fadeCover = Math.min(1, f.t / f.dur);
        if (f.t >= f.dur) { f.phase = 'hold'; f.t = 0; f.cb && f.cb(); }
      } else if (f.phase === 'hold') {
        this.fadeCover = 1;
        if (f.t > 0.08) { f.phase = 'out'; f.t = 0; }
      } else {
        this.fadeCover = 1 - Math.min(1, f.t / f.dur);
        if (f.t >= f.dur) { this.fade = null; this.fadeCover = 0; }
      }
    }

    if (this.state === 'menu') { this._updateAttract(dt); return; }

    if (this.state === 'play') {
      if (this.input.pressed('pause')) { this.pause(); return; }
      if (this.input.pressed('restart') && !this.fade) { this.restartLevel(); }
    } else if (this.state === 'paused') {
      return;
    }
    if (this.input.pressed('mute')) this.ui.toggleMute();

    this.hud.update(dt);
    if (this.flash > 0) this.flash -= dt;

    if (this.freeze > 0) {
      this.freeze -= dt;
      this.fx.update(dt * 0.25);
      return;
    }

    const p = this.player;
    const ctrl = {
      dir: (this.input.down('right') ? 1 : 0) - (this.input.down('left') ? 1 : 0),
      jumpHeld: this.input.down('jump'),
      jumpPressed: this.input.pressed('jump'),
      dashPressed: this.input.pressed('dash'),
      down: this.input.down('down'),
    };
    if (this.state !== 'play' || this.fade) { ctrl.dir = 0; ctrl.jumpPressed = false; ctrl.dashPressed = false; }

    if (this.state === 'play' && p.state === 'play') this.time += dt;

    // Fixed substeps for stable collision at any frame rate.
    let remaining = Math.min(dt, 1 / 20);
    while (remaining > 1e-6) {
      const h = Math.min(PHYS_STEP, remaining);
      remaining -= h;
      this._step(h, ctrl);
      ctrl.jumpPressed = false;
      ctrl.dashPressed = false;
      if (this.freeze > 0) break;
    }

    // Per-frame (non-physics) updates.
    for (const c of this.checkpoints) c.update(dt);
    if (this.tower) this.tower.update(dt);
    this.fx.update(dt);

    if (p.state === 'dead') {
      this.deadT += dt;
      if (this.deadT > 0.45 && !p.burst) { p.burst = true; this.fx.death(p.cx, p.cy); this.shake(2, 0.15); }
      if (this.deadT > 1.25 && this.state === 'play') {
        this.state = 'dead';
        this.input.captureGame = false;
        this.ui.showDeath(this.stats());
      }
    }
    if (p.state === 'respawn') {
      if (this.respawnT > 0) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) {
          p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.vx = 0; p.vy = 0;
          p.stateT = 0;
          this.cam.snap(p);
          this.fx.checkpoint(p.cx, p.bottom);
          this.sfx('respawn');
        }
      } else if (p.stateT > 0.32) { p.state = 'play'; }
    }

    if (this.state === 'complete') this._updateVictory(dt);
    this.cam.update(dt, this._camTarget());
  }

  _camTarget() {
    if (this.state === 'complete' && this.completeT > 0.5 && this.tower) {
      // Pan up toward the beacon during activation.
      const bottom = this.tower.y - Math.min(70, (this.completeT - 0.5) * 60);
      return { cx: this.tower.cx, bottom, y: bottom - 13, facing: 0, vx: 0, grounded: true, state: 'cinematic' };
    }
    return this.player;
  }

  _step(h, ctrl) {
    const p = this.player;
    const lv = this.level;
    const events = [];
    lv.update(h, p.state === 'play' ? p : null, events);
    for (const e of events) {
      if (e.type === 'secret') { this.sfx('secret'); this.hud.toast('HIDDEN PATH', C.gold); }
      else if (e.type === 'vanish') { this.fx.crumble(e.tx * TILE, e.ty * TILE, [C.sky2, C.blue2, C.white]); this.sfx('vanish'); }
    }
    // Platforms move first, then carry their riders.
    for (const pl of this.platforms) pl.update(h);
    if (p.ground && (p.ground.dx || p.ground.dy) && p.state === 'play') {
      const g = p.ground;
      moveCarry(p, lv, g.dx, g.dy);
    }
    for (const l of this.lasers) l.update(h);

    p.step(h, ctrl);

    // Enemies (only those near the camera are simulated).
    const cam = this.cam;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.x > cam.x - 160 && e.x < cam.x + cam.w + 160) e.update(h);
      if (e.dead) this.enemies.splice(i, 1);
    }

    if (p.state !== 'play') return;
    this._interactions(h);
  }

  _interactions(h) {
    const p = this.player;
    const lv = this.level;

    for (const b of this.bits) if (!b.got && b.hit(p)) this._collectBit(b);
    for (const c of this.cores) if (!c.got && c.hit(p)) this._collectCore(c);
    for (const cp of this.checkpoints) if (cp.hit(p)) this._activateCheckpoint(cp);
    if (this.tower && this.tower.hit(p) && p.grounded) { this._startVictory(); return; }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!overlap(p, e)) continue;
      const fromAbove = p.vy > 20 && p.bottom - e.y <= Math.max(7, p.vy * h + 4);
      if (e.stompable && fromAbove) {
        e.kill(true);
        p.stompBounce(this.input.down('jump'));
        this.fx.stompStar(p.cx, p.bottom);
        this.hitstop(0.05);
        this.shake(1.5, 0.1);
      } else if (p.invuln <= 0) {
        p.hurt(e.cx);
        if (p.state !== 'play') return;
      }
    }

    // Spikes
    if (p.invuln <= 0) {
      const tx0 = Math.floor((p.x + 1) / TILE), tx1 = Math.floor((p.x + p.w - 1) / TILE);
      const ty0 = Math.floor((p.y + 1) / TILE), ty1 = Math.floor((p.bottom - 1) / TILE);
      outer: for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const t = lv.tileAt(tx, ty);
          if (t !== T.SPIKE_UP && t !== T.SPIKE_DOWN) continue;
          const hz = t === T.SPIKE_UP
            ? { x: tx * TILE + 2, y: ty * TILE + 9, w: 12, h: 7 }
            : { x: tx * TILE + 2, y: ty * TILE, w: 12, h: 7 };
          if (overlap(p, hz)) {
            p.hurt(p.cx - p.facing, { knockVy: t === T.SPIKE_UP ? 280 : -60 });
            break outer;
          }
        }
      }
    }
    if (p.state !== 'play') return;

    // Lasers
    for (const l of this.lasers) if (p.invuln <= 0 && l.hits(p)) { p.hurt(p.cx - p.facing); break; }
    if (p.state !== 'play') return;

    // Energy pits / falling out of the world
    const ty = Math.floor((p.bottom - 3) / TILE);
    const tx0 = Math.floor((p.x + 2) / TILE), tx1 = Math.floor((p.x + p.w - 2) / TILE);
    let inPit = p.y > lv.pxH + 8;
    for (let tx = tx0; tx <= tx1 && !inPit; tx++) {
      if (lv.tileAt(tx, ty) === T.PIT && (p.bottom - ty * TILE) > 7) inPit = true;
    }
    if (inPit) this._pitFall();
  }

  _updateAttract(dt) {
    // Slow drift across Signal Meadow behind the menus.
    const span = Math.max(0, this.level.pxW * 0.55 - this.vw);
    const u = (1 - Math.cos(this.t * 0.03)) / 2;
    this.cam.x = u * span;
    this.cam.y = this.level.pxH - this.vh;
    for (const c of this.checkpoints) c.update(dt);
    for (const pl of this.platforms) pl.update && pl instanceof Mover && pl.update(dt);
    this.fx.update(dt);
    if (Math.random() < dt * 2) this.fx.sparkle(this.cam.x + Math.random() * this.vw, this.cam.y + 120 + Math.random() * 80, C.cream);
  }

  _updateVictory(dt) {
    this.completeT += dt;
    const t = this.completeT;
    const tw = this.tower;
    const top = tw.y - 16 - tw.mastH;
    if (t > 1.4 && t - dt <= 1.4) {
      this.fx.ring(tw.cx, top - 6, C.mint, 60, 0.8);
      this.fx.ring(tw.cx, top - 6, C.white, 30, 0.5);
      this.shake(3, 0.3);
      this.flash = 0.15;
    }
    if (t > 1.4 && Math.floor(t * 3) !== Math.floor((t - dt) * 3)) this.fx.ring(tw.cx, top - 6, C.mint, 44, 0.7);
    if (t > 0.2 && t < 3.2) this.fx.towerBeam(tw.cx, top + 4 + Math.random() * (tw.mastH * Math.max(0, 1 - t / 1.4)));
    if (t > 2.9 && !this.completeShown) {
      this.completeShown = true;
      this.sfx('complete');
      const st = this.stats();
      const newBest = this.save.recordCompletion(this.levelDef.id, { time: st.time, bits: st.bits, totalBits: st.totalBits, cores: st.cores });
      this.ui.showComplete({ ...st, newBest, last: this.levelIndex === LEVEL_IDS.length - 1 });
    }
  }

  // ------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    const vw = this.vw, vh = this.vh;
    const cx = this.cam.rx, cy = this.cam.ry;
    const t = this.t;
    const S = this.S;

    drawBackground(ctx, this.bg, this.cam, this.level.pxH, vw, vh, t, this.reduced);

    // Static level art
    const sx = clamp(cx, 0, this.level.pxW), sy = clamp(cy, 0, this.level.pxH);
    const dx = sx - cx, dy = sy - cy;
    const sw = Math.min(vw - dx, this.level.pxW - sx), sh = Math.min(vh - dy, this.level.pxH - sy);
    if (sw > 0 && sh > 0) ctx.drawImage(this.layers.canvas, sx, sy, sw, sh, dx, dy, sw, sh);

    drawPits(ctx, this.layers, cx, cy, vw, vh, t);
    drawDynamicBlocks(ctx, this.level, cx, cy, vw, vh, t, S);

    const vis = (x, w = 32) => x + w > cx - 8 && x - w < cx + vw + 8;
    for (const s of this.signs) if (vis(s.x)) s.draw(ctx, cx, cy);
    for (const c of this.checkpoints) if (vis(c.x)) c.draw(ctx, cx, cy, t, S);
    if (this.tower && vis(this.tower.x, 64)) this.tower.draw(ctx, cx, cy, t, S);
    for (const pl of this.pads) if (vis(pl.x)) pl.draw(ctx, cx, cy, t, S);
    for (const m of this.movers) if (vis(m.x, m.w + 16)) m.draw(ctx, cx, cy, t);
    for (const f of this.fallers) if (vis(f.x, f.w + 16)) f.draw(ctx, cx, cy);
    for (const b of this.bits) if (!b.got && vis(b.x)) b.draw(ctx, cx, cy, t, S);
    for (const c of this.cores) if (!c.got && vis(c.x)) c.draw(ctx, cx, cy, t, S);
    for (const e of this.enemies) if (vis(e.x)) e.draw(ctx, cx, cy, S);

    if (this.state !== 'menu') this._drawPlayer(ctx, cx, cy);

    for (const l of this.lasers) if (vis(l.ox, 400)) l.draw(ctx, cx, cy, t);
    this.fx.draw(ctx, cx, cy);

    // False walls (drawn over everything they hide).
    for (const r of this.level.falseRegions) {
      const x = r.x0 * TILE, y = r.y0 * TILE, w = (r.x1 - r.x0 + 1) * TILE, h = (r.y1 - r.y0 + 1) * TILE;
      if (x + w < cx || x > cx + vw || y + h < cy || y > cy + vh) continue;
      ctx.globalAlpha = r.alpha;
      ctx.drawImage(this.layers.secret, x, y, w, h, x - cx, y - cy, w, h);
    }
    ctx.globalAlpha = 1;

    if (this.flash > 0 && !this.reduced) {
      ctx.globalAlpha = Math.min(0.35, this.flash * 2.5);
      ctx.fillStyle = C.white;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }

    if (this.state !== 'menu') {
      if (this.state === 'paused') this.hud.banner = null;
      this.hud.draw(ctx, this, vw, t);
    }
    if (this.fadeCover > 0) this._drawWipe(ctx, this.fadeCover);
  }

  _drawPlayer(ctx, cx, cy) {
    const p = this.player;
    const t = this.t;
    for (const a of p.afterimages) {
      if (a.life <= 0) continue;
      ctx.globalAlpha = Math.max(0, a.life / 0.2) * 0.55;
      ctx.drawImage(this.dashGhost[a.facing], Math.round(a.x + p.w / 2 - PIP_W / 2 - cx), Math.round(a.y + p.h - PIP_H - cy));
    }
    ctx.globalAlpha = 1;
    if (p.state === 'dead' && p.burst) return;
    if (p.state === 'respawn' && p.stateT < 0) return;
    if (p.invuln > 0 && p.state === 'play' && Math.floor(p.invuln * 14) % 2 === 0) return;
    const x = Math.round(p.x + p.w / 2 - PIP_W / 2 - cx);
    const y = Math.round(p.y + p.h - PIP_H - cy);
    const pose = p.pose();
    const img = this.S.pip[pose] ? this.S.pip[pose][p.facing] : this.S.pip.idle0[p.facing];
    if (p.state === 'dead') {
      const k = this.deadT;
      const jx = Math.round(Math.sin(k * 60) * 1.5);
      const lift = Math.round(Math.min(1, k / 0.3) * -6);
      ctx.drawImage(Math.floor(k * 16) % 2 ? this.whitePip.hurt[p.facing] : img, x + jx, y + lift);
      return;
    }
    if (p.state === 'respawn') {
      // Materialise from a scanline outward.
      const k = Math.min(1, p.stateT / 0.3);
      const hh = Math.max(1, Math.round(PIP_H * k));
      const oy = Math.round((PIP_H - hh) / 2);
      ctx.drawImage(this.whitePip.idle0[p.facing], 0, oy, PIP_W, hh, x, y + oy, PIP_W, hh);
      ctx.globalAlpha = k;
      ctx.drawImage(img, 0, oy, PIP_W, hh, x, y + oy, PIP_W, hh);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.drawImage(img, x, y);
  }

  _drawWipe(ctx, k) {
    const cell = 16;
    const cols = Math.ceil(this.vw / cell), rows = Math.ceil(this.vh / cell);
    ctx.fillStyle = C.ink;
    if (k >= 1) { ctx.fillRect(0, 0, this.vw, this.vh); return; }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const d = (i + j) / (cols + rows);
        const local = clamp(k * 1.7 - d * 0.7, 0, 1);
        const s = Math.round(local * cell);
        if (s <= 0) continue;
        ctx.fillRect(i * cell + ((cell - s) >> 1), j * cell + ((cell - s) >> 1), s, s);
      }
    }
  }
}

/** Move a rider with its platform, respecting walls. */
function moveCarry(p, lv, dx, dy) {
  const ground = p.ground;
  if (dx) {
    p.x += dx;
    if (!lv.rectFree(p.x, p.y, p.w, p.h)) {
      p.x -= dx;
    }
  }
  if (dy) {
    const ny = p.y + dy;
    if (lv.rectFree(p.x, ny, p.w, p.h)) p.y = ny;
  }
  p.ground = ground;
}
