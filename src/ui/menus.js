import { C, LEVEL_IDS } from '../config.js';
import { LEVELS } from '../levels/index.js';
import { drawText, textWidth } from '../gfx/font.js';
import { makeCanvas, formatTime } from '../engine/util.js';
import { THEMES, buildLevelLayers, buildBackground, drawBackground } from '../gfx/world.js';
import { Level } from '../game/level.js';

const $ = (sel, root = document) => root.querySelector(sel);

const EPILOGUE = 'The last tower hums awake. Across the fractured network, a thousand quiet screens flicker back to life. PIP\'s delivery is complete.';

/**
 * DOM menus layered over the canvas. Every screen is keyboard, mouse, touch and
 * gamepad navigable; focus is always visible.
 */
export class UI {
  constructor(root, game, { audio, save }) {
    this.root = root;
    this.game = game;
    this.audio = audio;
    this.save = save;
    this.current = null;
    this.settingsFrom = 'title';
    this.timers = [];
    this.pad = {};
    this.padRepeat = 0;
    this._build();
    root.addEventListener('click', (e) => this._onClick(e));
    document.addEventListener('keydown', (e) => this._onKey(e));
    root.addEventListener('input', (e) => this._onInput(e));
    this._applyBodyClasses();
  }

  // ------------------------------------------------------------------------
  _build() {
    this.root.innerHTML = `
      <section class="screen scrim" id="s-title" aria-label="Main menu">
        <canvas class="logo" id="logo" role="img" aria-label="PIXELBOUND — Lost Signal"></canvas>
        <p class="tagline">The network has gone dark. Guide PIP, a pocket-sized courier bot, through three broken sectors and bring the signal home.</p>
        <nav class="menu" aria-label="Main">
          <button class="btn primary" data-act="play">Play<small id="play-sub"></small></button>
          <button class="btn" data-act="levels">Level Select</button>
          <button class="btn" data-act="howto">How to Play</button>
          <button class="btn" data-act="settings">Settings</button>
        </nav>
        <canvas class="pip-portrait" id="pip-portrait" width="24" height="24" aria-hidden="true"></canvas>
        <div class="corner-btns"><button class="btn icon-btn" data-act="mute" id="mute-btn" aria-label="Toggle sound">Sound: On</button></div>
        <div class="title-foot">Arrows / WASD to choose &middot; Enter to select</div>
      </section>

      <section class="screen scrim-full" id="s-levels" aria-label="Level select">
        <div class="screen-head"><h2>Level Select</h2><span class="kicker">Choose a sector</span></div>
        <div class="cards" id="cards"></div>
        <div class="foot-row"><button class="btn ghost" data-act="back">Back</button><span class="hint">Restore a tower to unlock the next sector</span></div>
      </section>

      <section class="screen scrim-full" id="s-howto" aria-label="How to play">
        <div class="screen-head"><h2>How to Play</h2><span class="kicker">Reach and activate the signal tower</span></div>
        <div class="howto-grid">
          <div>
            <div class="sub">Controls</div>
            <div class="keys">
              <span><span class="kbd">A</span><span class="kbd">D</span></span><span>Move &middot; or arrow keys</span>
              <span><span class="kbd">Space</span><span class="kbd">W</span></span><span>Jump &middot; hold to jump higher</span>
              <span><span class="kbd">Shift</span></span><span>Dash &middot; once per jump, recharges on landing</span>
              <span><span class="kbd">S</span>+<span class="kbd">Space</span></span><span>Drop through thin platforms</span>
              <span><span class="kbd">R</span></span><span>Restart level</span>
              <span><span class="kbd">Esc</span></span><span>Pause</span>
              <span><span class="kbd">M</span></span><span>Mute</span>
            </div>
            <p class="tips">Gamepads work too. On touch screens, use the on-screen pad. Dash out of a running start and jump for a long leap.</p>
          </div>
          <div>
            <div class="sub">Field guide</div>
            <div class="legend" id="legend"></div>
          </div>
        </div>
        <div class="foot-row"><button class="btn ghost" data-act="back">Back</button><span class="hint">Cracked walls sometimes hide more than rock</span></div>
      </section>

      <section class="screen scrim-full" id="s-settings" aria-label="Settings">
        <div class="screen-head"><h2>Settings</h2><span class="kicker">Saved automatically</span></div>
        <div class="settings">
          <label for="set-music">Music</label>
          <div class="slider"><input type="range" id="set-music" min="0" max="100" step="5" data-key="music"><output id="out-music"></output></div>
          <label for="set-sfx">Effects</label>
          <div class="slider"><input type="range" id="set-sfx" min="0" max="100" step="5" data-key="sfx"><output id="out-sfx"></output></div>
          <label id="lbl-muted">Mute all</label>
          <button class="toggle" role="switch" data-act="toggle" data-key="muted" aria-labelledby="lbl-muted"></button>
          <label id="lbl-shake">Screen shake</label>
          <button class="toggle" role="switch" data-act="toggle" data-key="shake" aria-labelledby="lbl-shake"></button>
          <label id="lbl-reduced">Reduced motion</label>
          <button class="toggle" role="switch" data-act="toggle" data-key="reducedMotion" aria-labelledby="lbl-reduced"></button>
          <label>Progress</label>
          <div><button class="btn ghost danger" data-act="reset" id="reset-btn">Reset save data</button></div>
        </div>
        <div class="foot-row"><button class="btn ghost" data-act="back">Back</button><span class="hint">Reduced motion also disables shake, flashes and glitches</span></div>
      </section>

      <section class="screen scrim-full center" id="s-pause" aria-label="Paused">
        <div class="big-title">Paused</div>
        <div class="statline" id="pause-stats"></div>
        <nav class="menu centered">
          <button class="btn primary" data-act="resume">Resume</button>
          <button class="btn" data-act="restart">Restart Level</button>
          <button class="btn" data-act="settings">Settings</button>
          <button class="btn" data-act="menu">Main Menu</button>
        </nav>
      </section>

      <section class="screen scrim-full center" id="s-dead" aria-label="Signal lost">
        <div class="big-title lost">Signal Lost</div>
        <p class="subtitle">Connection dropped. Rerouting PIP to the last terminal&hellip;</p>
        <nav class="menu centered">
          <button class="btn primary" data-act="retry">Retry</button>
          <button class="btn" data-act="levelselect">Level Select</button>
        </nav>
      </section>

      <section class="screen scrim-full center" id="s-complete" aria-label="Signal restored">
        <div class="big-title won">Signal Restored</div>
        <p class="subtitle" id="complete-sub"></p>
        <div class="results panel" id="results"></div>
        <p class="epilogue" id="epilogue" hidden></p>
        <nav class="menu centered" id="complete-menu">
          <button class="btn primary" data-act="next" id="next-btn">Next Level</button>
          <button class="btn" data-act="replay">Replay</button>
          <button class="btn" data-act="levelselect">Level Select</button>
        </nav>
      </section>
    `;
    this._drawLogo();
    this._drawLegend();
    this._animatePortrait();
    this._syncSettings();
  }

  _drawLogo() {
    const cv = $('#logo', this.root);
    const title = 'PIXELBOUND', sub = 'LOST SIGNAL';
    const w = textWidth(title, 2) + 8, h = 34;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    // outline pass
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [0, 2], [1, 2], [-1, 2]]) {
      drawText(ctx, title, 4 + dx, 3 + dy, C.ink, { scale: 2 });
    }
    drawText(ctx, title, 4, 3, C.cream, { scale: 2 });
    // warm lower band on the letters
    const [tmp, tctx] = makeCanvas(w, h);
    drawText(tctx, title, 4, 3, C.orange2, { scale: 2 });
    ctx.drawImage(tmp, 0, 11, w, 6, 0, 11, w, 6);
    const [tmp2, t2] = makeCanvas(w, h);
    drawText(t2, title, 4, 3, C.orange, { scale: 2 });
    ctx.drawImage(tmp2, 0, 15, w, 2, 0, 15, w, 2);
    // subtitle with signal bars
    const sx = 4;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 2]]) drawText(ctx, sub, sx + 12 + dx, 23 + dy, C.ink);
    drawText(ctx, sub, sx + 12, 23, C.mint);
    ctx.fillStyle = C.ink; ctx.fillRect(sx - 1, 22, 10, 9);
    ctx.fillStyle = C.teal2;
    ctx.fillRect(sx, 28, 2, 2); ctx.fillRect(sx + 3, 26, 2, 4);
    ctx.fillStyle = C.slate2; ctx.fillRect(sx + 6, 23, 2, 7);
    const lw = sx + 12 + textWidth(sub) + 4;
    ctx.fillStyle = C.orange; ctx.fillRect(lw, 26, w - lw - 4, 1);
    ctx.fillStyle = C.teal2; ctx.fillRect(lw, 28, Math.max(0, w - lw - 20), 1);
  }

  _drawLegend() {
    const S = this.game.S;
    const items = [
      ['bit', 'Signal Bits', 'Collect them all for a perfect run.'],
      ['core', 'Data Cores', 'Three per sector, hidden off the beaten path.'],
      ['check', 'Checkpoint', 'Saves your progress and restores energy.'],
      ['enemy', 'Glitches', 'Most can be defeated by landing on top.'],
      ['hazard', 'Hazards', 'Spikes, energy pits and lasers cost a cell.'],
    ];
    const legend = $('#legend', this.root);
    for (const [kind, name, desc] of items) {
      const [c, ctx] = makeCanvas(20, 20);
      if (kind === 'bit') ctx.drawImage(S.bit[0], 5, 4);
      if (kind === 'core') ctx.drawImage(S.core[0], 3, 3);
      if (kind === 'check') ctx.drawImage(S.checkpoint[1], 0, 0, 16, 30, 4, -3, 11, 20.6);
      if (kind === 'enemy') ctx.drawImage(S.hopper.idle0[1], 1, 3);
      if (kind === 'hazard') {
        // three little spikes on a corrupted base
        for (let i = 0; i < 3; i++) {
          const cx = 4 + i * 6;
          for (let k = 0; k < 7; k++) {
            const half = Math.floor(k / 3);
            ctx.fillStyle = C.ink; ctx.fillRect(cx - half - 1, 15 - k, half * 2 + 3, 1);
            ctx.fillStyle = k > 4 ? C.cream : C.cream2; ctx.fillRect(cx - half, 15 - k, half * 2 + 1, 1);
          }
        }
        ctx.fillStyle = C.ink; ctx.fillRect(0, 16, 20, 3);
        ctx.fillStyle = C.mag; ctx.fillRect(1, 17, 18, 1);
      }
      const row = document.createElement('div');
      row.style.display = 'contents';
      row.appendChild(c);
      const text = document.createElement('div');
      text.innerHTML = `<b>${name}</b>${desc}`;
      row.appendChild(text);
      legend.appendChild(row);
    }
  }

  _animatePortrait() {
    const cv = $('#pip-portrait', this.root);
    const ctx = cv.getContext('2d');
    let f = 0;
    const draw = () => {
      if (this.current !== 'title') return;
      f++;
      const S = this.game.S.pip;
      const cycle = f % 20;
      const pose = cycle === 7 ? 'blink0' : cycle < 10 ? 'idle0' : cycle === 17 ? 'blink1' : 'idle1';
      ctx.clearRect(0, 0, 24, 24);
      ctx.drawImage(S[pose][-1], 0, 0);
    };
    setInterval(draw, 300);
    draw();
  }

  /** A real 1:1 pixel-art snapshot of each sector's opening area (cached). */
  _thumb(i) {
    this.thumbs = this.thumbs || [];
    if (this.thumbs[i]) return this.thumbs[i];
    const def = LEVELS[i];
    const lv = new Level(def);
    const layers = buildLevelLayers(lv);
    const bg = buildBackground(def.theme);
    const W = 128, H = 64;
    const [c, ctx] = makeCanvas(W, H);
    const cam = { x: Math.max(0, lv.spawn.x - 36), y: Math.min(lv.pxH - H, Math.max(0, lv.spawn.y + 13 - 46)) };
    drawBackground(ctx, bg, { x: cam.x, y: cam.y + (lv.pxH - 225) * 0 }, lv.pxH, W, H, 0, true);
    ctx.drawImage(layers.canvas, cam.x, cam.y, W, H, 0, 0, W, H);
    ctx.drawImage(this.game.S.pip.idle0[1], Math.round(lv.spawn.x + 5 - 12 - cam.x), Math.round(lv.spawn.y + 13 - 24 - cam.y));
    this.thumbs[i] = c;
    return c;
  }

  _minimap(def, locked) {
    const w = def.rows[0].length, h = def.rows.length;
    const [c, ctx] = makeCanvas(w, h);
    const th = THEMES[def.theme];
    ctx.fillStyle = locked ? C.navy : th.sky[Math.floor(th.sky.length / 2)];
    ctx.fillRect(0, 0, w, h);
    const col = {
      '#': locked ? C.slate : th.base, '%': locked ? C.slate : th.base, '=': C.orange, '~': C.mag, '^': C.cream, 'v': C.cream,
      'x': C.sky2, 'A': C.teal2, 'Z': C.orange2, 'F': C.orange, 'B': C.gold, 'K': C.mint, 'T': C.mint,
    };
    const secret = (x, y) => (def.secrets || []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    for (let y = 0; y < h; y++) {
      const r = def.rows[y];
      for (let x = 0; x < w; x++) {
        const k = secret(x, y) ? col['#'] : col[r[x]];
        if (!k || (locked && k !== col['#'])) continue;
        ctx.fillStyle = k;
        ctx.fillRect(x, y, 1, r[x] === 'T' || r[x] === 'K' ? 1 : 1);
        if (!locked && (r[x] === 'T')) { ctx.fillRect(x, y - 6, 1, 7); }
        if (!locked && (r[x] === 'K')) { ctx.fillRect(x, y - 1, 1, 2); }
      }
    }
    return c;
  }

  _buildCards() {
    const cards = $('#cards', this.root);
    cards.innerHTML = '';
    LEVELS.forEach((def, i) => {
      const unlocked = this.save.isUnlocked(i);
      const st = this.save.level(def.id);
      const totalBits = def.rows.reduce((n, r) => n + (r.match(/o/g) || []).length, 0);
      const btn = document.createElement('button');
      btn.className = 'card' + (unlocked ? '' : ' locked');
      btn.dataset.act = unlocked ? 'start' : 'locked';
      btn.dataset.level = i;
      btn.setAttribute('aria-label', `Sector ${i + 1}: ${def.name}${unlocked ? '' : ' (locked)'}`);
      if (!unlocked) btn.setAttribute('aria-disabled', 'true');
      const badge = !unlocked ? '<span class="badge">Locked</span>' : st.completed ? '<span class="badge done">Restored</span>' : '<span class="badge new">New</span>';
      const cores = [0, 1, 2].map((k) => `<i class="core-ico${st.cores[k] ? ' on' : ''}"></i>`).join('');
      btn.innerHTML = `
        ${badge}
        <span class="num">Sector ${i + 1}</span>
        <span class="name">${def.name}</span>
        <span class="thumb"></span>
        <span class="map"></span>
        ${unlocked ? `<span class="stats">
          <span>Best time</span><b>${st.bestTime != null ? formatTime(st.bestTime) : '--:--.-'}</b>
          <span>Signal bits</span><b>${st.bestBits || 0} / ${totalBits}</b>
          <span>Data cores</span><span class="cores">${cores}</span>
        </span>` : `<span class="lockmsg">Restore Sector ${i}'s tower to reconnect this route.</span>`}
      `;
      const mm = this._minimap(def, !unlocked);
      mm.className = 'minimap';
      btn.querySelector('.map').replaceWith(mm);
      const th = document.createElement('canvas');
      const src = this._thumb(i);
      th.width = src.width; th.height = src.height;
      th.className = 'thumb' + (unlocked ? '' : ' dim');
      th.getContext('2d').drawImage(src, 0, 0);
      btn.querySelector('.thumb').replaceWith(th);
      cards.appendChild(btn);
    });
  }

  // ------------------------------------------------------------------------
  show(name) {
    this._clearTimers();
    for (const s of this.root.querySelectorAll('.screen')) s.classList.remove('show');
    const el = $(`#s-${name}`, this.root);
    this.current = name;
    if (!el) return;
    if (name === 'levels') this._buildCards();
    if (name === 'settings') this._syncSettings();
    if (name === 'title') this._syncTitle();
    el.classList.add('show');
    const back = this.returnFocus && this.returnFocus[name];
    requestAnimationFrame(() => {
      const first = back && el.contains(back) ? back : name === 'levels' ? el.querySelector('.card:not(.locked)') : el.querySelector('.btn, .card, input, .toggle');
      first && first.focus({ preventScroll: true });
    });
  }

  hideAll() {
    this._clearTimers();
    for (const s of this.root.querySelectorAll('.screen')) s.classList.remove('show');
    this.current = null;
    if (document.activeElement && this.root.contains(document.activeElement)) document.activeElement.blur();
  }

  showHud(on) { document.body.classList.toggle('playing', on); }

  showPause(st) {
    $('#pause-stats', this.root).innerHTML = `<span>Sector ${st.levelIndex + 1}</span><span>Time <b>${formatTime(st.time)}</b></span><span>Bits <b>${st.bits}/${st.totalBits}</b></span><span>Cores <b>${st.cores.filter(Boolean).length}/3</b></span>`;
    this.show('pause');
  }

  showDeath() { this.show('dead'); }

  showComplete(st) {
    this.show('complete');
    $('#complete-sub', this.root).textContent = `Sector ${st.levelIndex + 1} — ${st.name} is back online.`;
    const coreIcons = [0, 1, 2].map((k) => `<i class="core-ico${st.cores[k] ? ' on' : ''}"></i>`).join('');
    const rows = [
      ['Time', `${formatTime(st.time)}${st.newBest ? '<span class="tag">Best</span>' : ''}`],
      ['Signal Bits', `${st.bits} / ${st.totalBits}${st.bits === st.totalBits ? '<span class="tag">All</span>' : ''}`],
      ['Data Cores', `<span class="cores">${coreIcons}</span>`],
      ['Deaths', `${st.deaths}`],
    ];
    const res = $('#results', this.root);
    res.innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('');
    const kids = [...res.children];
    kids.forEach((el, i) => this.timers.push(setTimeout(() => { el.classList.add('in'); if (i % 2) this.audio.play('uiMove'); }, 180 + Math.floor(i / 2) * 220)));
    const ep = $('#epilogue', this.root);
    ep.hidden = !st.last;
    ep.textContent = st.last ? EPILOGUE : '';
    const next = $('#next-btn', this.root);
    next.textContent = st.last ? 'Main Menu' : 'Next Level';
    next.dataset.act = st.last ? 'menu' : 'next';
  }

  _syncTitle() {
    const s = this.save.data;
    const idx = this._continueIndex();
    $('#play-sub', this.root).textContent = s.unlocked > 1 || this.save.level(LEVEL_IDS[0]).completed ? `Sector ${idx + 1}` : '';
    this._syncMute();
  }

  _continueIndex() {
    for (let i = 0; i < LEVEL_IDS.length; i++) {
      if (this.save.isUnlocked(i) && !this.save.level(LEVEL_IDS[i]).completed) return i;
    }
    return 0;
  }

  _syncSettings() {
    const s = this.save.settings;
    for (const key of ['music', 'sfx']) {
      const inp = $(`#set-${key}`, this.root);
      inp.value = Math.round(s[key] * 100);
      inp.style.setProperty('--fill', inp.value + '%');
      $(`#out-${key}`, this.root).textContent = inp.value;
    }
    for (const t of this.root.querySelectorAll('.toggle')) {
      const on = !!s[t.dataset.key];
      t.setAttribute('aria-checked', on ? 'true' : 'false');
      t.textContent = on ? 'On' : 'Off';
    }
    this._syncMute();
  }

  _syncMute() {
    const b = $('#mute-btn', this.root);
    if (b) b.textContent = this.save.settings.muted ? 'Sound: Off' : 'Sound: On';
  }

  _applyBodyClasses() {
    document.body.classList.toggle('reduced', !!this.save.settings.reducedMotion);
  }

  toggleMute() {
    this.save.settings.muted = !this.save.settings.muted;
    this.save.write();
    this.game.applySettings();
    this._syncSettings();
    this.game.hud.toast(this.save.settings.muted ? 'SOUND OFF' : 'SOUND ON', C.cream2);
  }

  // ------------------------------------------------------------------------
  _onInput(e) {
    const t = e.target;
    if (t.type !== 'range') return;
    const key = t.dataset.key;
    this.save.settings[key] = +t.value / 100;
    t.style.setProperty('--fill', t.value + '%');
    $(`#out-${key}`, this.root).textContent = t.value;
    this.save.write();
    this.game.applySettings();
    if (key === 'sfx') this.audio.play('bit');
  }

  _onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    this.audio.unlock();
    const act = el.dataset.act;
    const g = this.game;
    if (['levels', 'howto', 'settings'].includes(act) && this.current) {
      this.returnFocus = this.returnFocus || {};
      this.returnFocus[this.current] = el;
    }
    const sel = () => this.audio.play('uiSelect');
    switch (act) {
      case 'play': sel(); this.hideAll(); g.startLevel(this._continueIndex()); break;
      case 'levels': sel(); this.show('levels'); break;
      case 'howto': sel(); this.show('howto'); break;
      case 'settings': sel(); this.settingsFrom = this.current === 'pause' ? 'pause' : 'title'; this.show('settings'); break;
      case 'back': this.back(); break;
      case 'start': sel(); this.hideAll(); g.startLevel(+el.dataset.level); break;
      case 'locked': this.audio.play('uiBack'); el.animate([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 160, easing: 'steps(3)' }); break;
      case 'resume': sel(); g.resume(); break;
      case 'restart': sel(); this.hideAll(); g.restartLevel(); break;
      case 'menu': sel(); this.hideAll(); g.toMenu('title'); break;
      case 'retry': sel(); this.hideAll(); g.retryFromCheckpoint(); break;
      case 'levelselect': sel(); this.hideAll(); g.toMenu('levels'); break;
      case 'next': sel(); this.hideAll(); g.startLevel(Math.min(LEVEL_IDS.length - 1, g.levelIndex + 1)); break;
      case 'replay': sel(); this.hideAll(); g.restartLevel(); break;
      case 'mute': this.toggleMute(); sel(); break;
      case 'toggle': {
        const k = el.dataset.key;
        this.save.settings[k] = !this.save.settings[k];
        this.save.write();
        g.applySettings();
        this._applyBodyClasses();
        this._syncSettings();
        sel();
        break;
      }
      case 'reset': {
        if (el.dataset.confirm) {
          this.save.resetProgress();
          el.textContent = 'Save data cleared';
          delete el.dataset.confirm;
          this.audio.play('uiBack');
        } else {
          el.dataset.confirm = '1';
          el.textContent = 'Press again to confirm';
          sel();
        }
        break;
      }
      default: break;
    }
  }

  back() {
    const cur = this.current;
    if (!cur) return;
    if (cur === 'pause') { this.audio.play('uiSelect'); this.game.resume(); return; }
    if (cur === 'title' || cur === 'dead' || cur === 'complete') return;
    this.audio.play('uiBack');
    if (cur === 'settings') {
      const rb = $('#reset-btn', this.root);
      delete rb.dataset.confirm; rb.textContent = 'Reset save data';
      if (this.settingsFrom === 'pause') { this.show('pause'); return; }
    }
    this.show('title');
  }

  _focusables() {
    const el = this.current && $(`#s-${this.current}`, this.root);
    if (!el) return [];
    return [...el.querySelectorAll('button, input')].filter((b) => b.offsetParent !== null && !b.hidden);
  }

  nav(dir) {
    const list = this._focusables();
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const next = list[(i + dir + list.length) % list.length] || list[0];
    next.focus({ preventScroll: true });
    this.audio.play('uiMove');
  }

  _onKey(e) {
    if (!this.current) return;
    const a = document.activeElement;
    const isRange = a && a.type === 'range';
    switch (e.code) {
      case 'ArrowDown': case 'KeyS': e.preventDefault(); this.nav(1); break;
      case 'ArrowUp': case 'KeyW': e.preventDefault(); this.nav(-1); break;
      case 'ArrowRight': case 'KeyD':
        if (isRange) { if (e.code === 'KeyD') { a.stepUp(); a.dispatchEvent(new Event('input', { bubbles: true })); } break; }
        e.preventDefault(); this.nav(1); break;
      case 'ArrowLeft': case 'KeyA':
        if (isRange) { if (e.code === 'KeyA') { a.stepDown(); a.dispatchEvent(new Event('input', { bubbles: true })); } break; }
        e.preventDefault(); this.nav(-1); break;
      case 'Escape': case 'Backspace': e.preventDefault(); this.back(); break;
      case 'KeyP': if (this.current === 'pause') { e.preventDefault(); this.back(); } break;
      case 'KeyM': this.toggleMute(); break;
      case 'Enter': case 'Space':
        if (!a || !this.root.contains(a)) { e.preventDefault(); this.nav(1); }
        break;
      default: break;
    }
  }

  /** Gamepad navigation for menus (edge-triggered with repeat). */
  poll(dt) {
    if (!this.current) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    if (!gp) return;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
    const now = { up: b(12) || ay < -0.5 || b(14) || ax < -0.5, down: b(13) || ay > 0.5 || b(15) || ax > 0.5, a: b(0), back: b(1), start: b(9) };
    const edge = (k) => now[k] && !this.pad[k];
    this.padRepeat -= dt;
    if (edge('down') || (now.down && this.padRepeat <= 0 && this.pad.down)) { this.nav(1); this.padRepeat = edge('down') ? 0.35 : 0.12; }
    if (edge('up') || (now.up && this.padRepeat <= 0 && this.pad.up)) { this.nav(-1); this.padRepeat = edge('up') ? 0.35 : 0.12; }
    if (edge('a')) {
      const a = document.activeElement;
      if (a && this.root.contains(a)) a.click(); else this.nav(1);
    }
    if (edge('back') || (edge('start') && this.current === 'pause')) this.back();
    this.pad = now;
  }

  _clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers.length = 0; }
}
