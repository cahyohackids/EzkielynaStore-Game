// Unified input: keyboard + touch + gamepad, mapped to abstract actions.
const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyJ'],
  dash: ['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyK'],
  restart: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
};
const ACTIONS = Object.keys(BINDINGS);
const CODES = new Set(Object.values(BINDINGS).flat());

export class Input {
  constructor() {
    this.held = new Set();
    this.touch = {};
    this.pad = {};
    this.prev = {};
    this.cur = {};
    this.latchP = {};
    this.latchR = {};
    this.lastDevice = 'keyboard';
    this.captureGame = false;   // true while gameplay owns the keyboard

    addEventListener('keydown', (e) => {
      if (CODES.has(e.code) && this.captureGame) e.preventDefault();
      if (e.repeat) return;
      this.lastDevice = 'keyboard';
      this.held.add(e.code);
      for (const a of ACTIONS) if (BINDINGS[a].includes(e.code)) this.latchP[a] = true;
    }, true); // capture: latch before menu handlers run, so they can clear() it
    addEventListener('keyup', (e) => {
      this.held.delete(e.code);
      for (const a of ACTIONS) if (BINDINGS[a].includes(e.code)) this.latchR[a] = true;
    }, true);
    addEventListener('blur', () => { this.held.clear(); this.touch = {}; });
  }

  setTouch(action, on) {
    if (on && !this.touch[action]) this.latchP[action] = true;
    if (!on && this.touch[action]) this.latchR[action] = true;
    this.touch[action] = on;
    this.lastDevice = 'touch';
  }

  _keyDown(a) {
    const codes = BINDINGS[a];
    for (let i = 0; i < codes.length; i++) if (this.held.has(codes[i])) return true;
    return false;
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && [...pads].find((p) => p && p.connected);
    const next = {};
    if (gp) {
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      next.left = b(14) || ax < -0.4;
      next.right = b(15) || ax > 0.4;
      next.up = b(12) || ay < -0.5;
      next.down = b(13) || ay > 0.5;
      next.jump = b(0);
      next.dash = b(2) || b(1) || b(5) || b(7);
      next.pause = b(9);
      next.restart = b(8);
      if (Object.values(next).some(Boolean)) this.lastDevice = 'gamepad';
    }
    for (const a of ACTIONS) {
      if (next[a] && !this.pad[a]) this.latchP[a] = true;
      if (!next[a] && this.pad[a]) this.latchR[a] = true;
    }
    this.pad = next;
  }

  /** Call once per frame before reading. */
  update() {
    this.pollGamepad();
    for (const a of ACTIONS) {
      this.prev[a] = this.cur[a];
      this.cur[a] = this._keyDown(a) || !!this.touch[a] || !!this.pad[a];
    }
  }

  down(a) { return !!this.cur[a]; }
  pressed(a) { return !!this.latchP[a] || (this.cur[a] && !this.prev[a]); }
  released(a) { return !!this.latchR[a]; }

  /** Call once per frame after gameplay consumed input. */
  endFrame() {
    for (const a of ACTIONS) { this.latchP[a] = false; this.latchR[a] = false; }
  }

  clear() {
    this.held.clear();
    this.touch = {};
    for (const a of ACTIONS) { this.latchP[a] = false; this.latchR[a] = false; this.cur[a] = false; this.prev[a] = false; }
  }
}
