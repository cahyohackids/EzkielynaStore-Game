// All sound is synthesised at runtime with WebAudio: no external assets,
// original sounds and original music loops.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// --- Songs -------------------------------------------------------------------
// chords: one per bar (MIDI notes). lead: per bar, [step, note, lengthInSteps].
const SONGS = {
  menu: {
    bpm: 84, swing: 0,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    order: [0, 1, 2, 3],
    bass: [[0, 0, 16]],
    arp: { every: 2, pattern: [0, 1, 2, 3, 2, 1, 3, 2], oct: 12, vol: 0.045, cutoff: 1600 },
    drums: null,
    pad: true,
    lead: {},
  },
  meadow: {
    bpm: 112,
    chords: [[60, 64, 67, 71], [64, 67, 71, 74], [65, 69, 72, 76], [67, 71, 74, 77]],
    order: [0, 1, 2, 3, 0, 1, 2, 3],
    bass: [[0, -12, 3], [6, -12, 2], [8, 0, 3], [12, -12, 2], [14, -5, 2]],
    arp: { every: 2, pattern: [0, 2, 1, 3, 2, 1, 3, 2], oct: 12, vol: 0.04, cutoff: 2400 },
    drums: { kick: [0, 8], snare: [], hat: [2, 6, 10, 14], hatVol: 0.035 },
    lead: {
      4: [[0, 72, 3], [4, 76, 2], [6, 79, 4], [12, 77, 2], [14, 76, 2]],
      5: [[0, 74, 4], [6, 71, 2], [8, 74, 4], [12, 76, 4]],
      6: [[0, 77, 3], [4, 76, 2], [6, 72, 4], [12, 74, 2], [14, 76, 2]],
      7: [[0, 74, 6], [8, 71, 2], [10, 72, 2], [12, 74, 4]],
    },
  },
  caverns: {
    bpm: 88,
    chords: [[57, 60, 64, 69], [53, 57, 60, 65], [50, 57, 62, 65], [52, 56, 59, 64]],
    order: [0, 1, 2, 3, 0, 1, 2, 3],
    bass: [[0, -12, 10], [10, -12, 2], [12, -5, 4]],
    arp: { every: 3, pattern: [0, 3, 1, 2, 3, 1], oct: 12, vol: 0.05, cutoff: 1500 },
    drums: { kick: [0], snare: [], hat: [], drip: [5, 13], hatVol: 0.03 },
    delay: 0.36,
    lead: {
      4: [[0, 76, 6], [8, 72, 4], [12, 74, 4]],
      5: [[0, 72, 8], [8, 69, 8]],
      6: [[0, 74, 4], [4, 77, 4], [8, 76, 4], [12, 74, 4]],
      7: [[0, 71, 8], [8, 68, 8]],
    },
  },
  tower: {
    bpm: 128,
    chords: [[50, 53, 57, 62], [46, 50, 53, 58], [48, 52, 55, 60], [45, 48, 52, 57]],
    order: [0, 1, 2, 3, 0, 1, 2, 3],
    bass: [[0, -12, 1], [2, -12, 1], [4, 0, 1], [6, -12, 1], [8, -12, 1], [10, -12, 1], [12, 0, 1], [14, -5, 1]],
    arp: { every: 1, pattern: [0, 1, 2, 3, 2, 1, 2, 3], oct: 12, vol: 0.03, cutoff: 2000 },
    drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], hatVol: 0.04 },
    lead: {
      4: [[0, 74, 2], [2, 77, 2], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 76, 4]],
      5: [[0, 74, 4], [4, 70, 4], [8, 72, 2], [10, 74, 2], [12, 77, 4]],
      6: [[0, 79, 4], [4, 76, 2], [6, 72, 2], [8, 76, 4], [12, 79, 4]],
      7: [[0, 81, 6], [8, 76, 4], [12, 72, 4]],
    },
  },
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.music = 0.6;
    this.sfxVol = 0.8;
    this.muted = false;
    this.song = null;
    this.songName = null;
    this.bitStreak = 0;
    this.bitStreakT = 0;
    this._lastPlay = {};
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.musicBus.connect(this.musicFilter).connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      // Echo send for music.
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.3;
      this.delayFb = ctx.createGain(); this.delayFb.gain.value = 0.32;
      this.delayWet = ctx.createGain(); this.delayWet.gain.value = 0.0;
      this.delay.connect(this.delayFb).connect(this.delay);
      this.delay.connect(this.delayWet).connect(this.musicBus);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.pulse25 = this._pulseWave(0.25);
      this.pulse12 = this._pulseWave(0.125);
      this._apply();
      this._timer = setInterval(() => this._schedule(), 25);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _pulseWave(duty) {
    const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return this.ctx.createPeriodicWave(real, imag);
  }

  setVolumes({ music, sfx, muted }) {
    if (music != null) this.music = music;
    if (sfx != null) this.sfxVol = sfx;
    if (muted != null) this.muted = muted;
    this._apply();
  }

  _apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol * 0.9, t, 0.02);
  }

  setMuffled(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.08);
  }

  // --- Primitive voices ------------------------------------------------------
  _tone(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator();
    if (o.wave === 'p25') osc.setPeriodicWave(this.pulse25);
    else if (o.wave === 'p12') osc.setPeriodicWave(this.pulse12);
    else osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.15;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.sustain) {
      g.gain.setValueAtTime(vol, t + o.dur - (o.release || 0.05));
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc.connect(g);
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.cutoff;
      node = node.connect(f);
    }
    node.connect(o.dest || this.sfxBus);
    if (o.send) node.connect(this.delay);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  _noise(o) {
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.when || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.1, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.dest || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  // --- Sound effects -----------------------------------------------------------
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // Throttle identical sounds within 30ms (avoids phasing stacks).
    if (this._lastPlay[name] && now - this._lastPlay[name] < 0.03) return;
    this._lastPlay[name] = now;
    const T = (o) => this._tone(o), N = (o) => this._noise(o);
    switch (name) {
      case 'jump':
        T({ wave: 'p25', f0: 330, f1: 660, dur: 0.12, vol: 0.09, glide: 0.08 });
        T({ wave: 'triangle', f0: 165, f1: 330, dur: 0.1, vol: 0.1 });
        break;
      case 'land': {
        const v = opts.vol ?? 1;
        N({ type: 'lowpass', f0: 500, dur: 0.07, vol: 0.12 * v });
        T({ wave: 'triangle', f0: 110, f1: 55, dur: 0.07, vol: 0.12 * v });
        break;
      }
      case 'dash':
        N({ type: 'bandpass', f0: 2600, f1: 500, dur: 0.2, vol: 0.2, q: 1.2 });
        T({ wave: 'p12', f0: 260, f1: 130, dur: 0.12, vol: 0.05 });
        break;
      case 'dashReady':
        T({ wave: 'p12', f0: 1760, dur: 0.035, vol: 0.025 });
        break;
      case 'bit': {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const s = scale[Math.min(this.bitStreak, scale.length - 1)];
        const base = 76 + s;
        T({ wave: 'p25', f0: mtof(base), dur: 0.06, vol: 0.06 });
        T({ wave: 'triangle', f0: mtof(base + 7), dur: 0.12, vol: 0.08, when: 0.045 });
        this.bitStreak++;
        this.bitStreakT = 0.7;
        break;
      }
      case 'core':
        [72, 76, 79, 84, 88].forEach((m, i) => T({ wave: 'triangle', f0: mtof(m), dur: 0.22, vol: 0.12, when: i * 0.06 }));
        [84, 91].forEach((m, i) => T({ wave: 'p12', f0: mtof(m), dur: 0.4, vol: 0.04, when: 0.3 + i * 0.08 }));
        break;
      case 'stomp':
        T({ wave: 'square', f0: 360, f1: 90, dur: 0.12, vol: 0.1 });
        N({ type: 'lowpass', f0: 900, dur: 0.06, vol: 0.12 });
        T({ wave: 'p25', f0: 880, f1: 1320, dur: 0.08, vol: 0.05, when: 0.04 });
        break;
      case 'enemyDie':
        T({ wave: 'p12', f0: 700, f1: 180, dur: 0.18, vol: 0.06 });
        N({ type: 'highpass', f0: 3000, dur: 0.12, vol: 0.05 });
        break;
      case 'hurt':
        T({ wave: 'square', f0: 520, f1: 130, dur: 0.24, vol: 0.12 });
        N({ type: 'bandpass', f0: 1200, f1: 300, dur: 0.2, vol: 0.12 });
        break;
      case 'death':
        [67, 63, 60, 55].forEach((m, i) => T({ wave: 'p25', f0: mtof(m), dur: 0.14, vol: 0.09, when: i * 0.09 }));
        N({ type: 'lowpass', f0: 1800, f1: 200, dur: 0.6, vol: 0.14, when: 0.3 });
        break;
      case 'checkpoint':
        [67, 71, 74, 79].forEach((m, i) => T({ wave: 'triangle', f0: mtof(m), dur: 0.2, vol: 0.12, when: i * 0.07 }));
        T({ wave: 'p12', f0: mtof(86), dur: 0.35, vol: 0.035, when: 0.3 });
        break;
      case 'bounce':
        T({ wave: 'triangle', f0: 150, f1: 820, dur: 0.22, vol: 0.16, glide: 0.18 });
        T({ wave: 'p12', f0: 300, f1: 1200, dur: 0.14, vol: 0.04 });
        break;
      case 'crumble':
        N({ type: 'lowpass', f0: 1100, f1: 300, dur: 0.25, vol: 0.1 });
        break;
      case 'shake':
        N({ type: 'bandpass', f0: 600, dur: 0.16, vol: 0.06, q: 3 });
        break;
      case 'fall':
        N({ type: 'lowpass', f0: 700, f1: 120, dur: 0.4, vol: 0.1 });
        break;
      case 'vanish':
        T({ wave: 'p12', f0: 900, f1: 300, dur: 0.1, vol: 0.035 });
        break;
      case 'reform':
        T({ wave: 'p12', f0: 400, f1: 900, dur: 0.08, vol: 0.025 });
        break;
      case 'secret':
        [64, 68, 71, 76, 80].forEach((m, i) => T({ wave: 'triangle', f0: mtof(m), dur: 0.25, vol: 0.08, when: i * 0.08 }));
        break;
      case 'laserWarn':
        T({ wave: 'p12', f0: 1400, dur: 0.03, vol: 0.02 * (opts.vol ?? 1) });
        break;
      case 'laserOn':
        N({ type: 'bandpass', f0: 3500, f1: 1200, dur: 0.12, vol: 0.05 * (opts.vol ?? 1), q: 4 });
        T({ wave: 'sawtooth', f0: 110, dur: 0.12, vol: 0.03 * (opts.vol ?? 1), cutoff: 800 });
        break;
      case 'bugAlert':
        T({ wave: 'p25', f0: 900, f1: 1300, dur: 0.06, vol: 0.05 });
        T({ wave: 'p25', f0: 900, f1: 1300, dur: 0.06, vol: 0.05, when: 0.09 });
        break;
      case 'pit':
        N({ type: 'lowpass', f0: 1500, f1: 200, dur: 0.35, vol: 0.14 });
        T({ wave: 'square', f0: 300, f1: 60, dur: 0.3, vol: 0.08 });
        break;
      case 'respawn':
        [60, 67, 72].forEach((m, i) => T({ wave: 'p12', f0: mtof(m), dur: 0.12, vol: 0.05, when: i * 0.06 }));
        break;
      case 'tower':
        T({ wave: 'sawtooth', f0: 80, f1: 640, dur: 1.4, vol: 0.06, cutoff: 1400, glide: 1.3 });
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => T({ wave: 'triangle', f0: mtof(m), dur: 0.5, vol: 0.08, when: 0.9 + i * 0.07 }));
        break;
      case 'complete':
        [[0, 72], [0.12, 76], [0.24, 79], [0.36, 84], [0.6, 83], [0.72, 84]].forEach(([w, m]) =>
          T({ wave: 'p25', f0: mtof(m), dur: 0.18, vol: 0.07, when: w }));
        [60, 64, 67].forEach((m) => T({ wave: 'triangle', f0: mtof(m), dur: 1.2, vol: 0.08, when: 0.72, sustain: true, release: 0.5 }));
        break;
      case 'uiMove':
        T({ wave: 'p12', f0: 740, dur: 0.035, vol: 0.04 });
        break;
      case 'uiSelect':
        T({ wave: 'p25', f0: 660, f1: 990, dur: 0.07, vol: 0.06, glide: 0.04 });
        break;
      case 'uiBack':
        T({ wave: 'p25', f0: 660, f1: 440, dur: 0.07, vol: 0.05, glide: 0.04 });
        break;
      case 'pause':
        T({ wave: 'p25', f0: 880, dur: 0.05, vol: 0.05 });
        T({ wave: 'p25', f0: 660, dur: 0.07, vol: 0.05, when: 0.06 });
        break;
      default: break;
    }
  }

  tick(dt) {
    if (this.bitStreakT > 0) { this.bitStreakT -= dt; if (this.bitStreakT <= 0) this.bitStreak = 0; }
  }

  // --- Music sequencer -------------------------------------------------------
  playMusic(name) {
    if (this.songName === name) return;
    this.songName = name;
    this.song = SONGS[name] || null;
    this.step = 0;
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime + 0.08;
      this.delayWet.gain.setTargetAtTime(this.song && this.song.delay ? this.song.delay : 0.12, this.ctx.currentTime, 0.1);
    }
  }

  stopMusic() { this.songName = null; this.song = null; }

  _schedule() {
    if (!this.ctx || !this.song) return;
    const ctx = this.ctx;
    if (this.nextTime == null || this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05;
    const song = this.song;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this._playStep(song, this.step, this.nextTime - ctx.currentTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  _playStep(song, step, when, sd) {
    const barsLen = song.order.length;
    const bar = Math.floor(step / 16) % barsLen;
    const s = step % 16;
    const chord = song.chords[song.order[bar]];
    const M = this.musicBus;
    for (const [st, off, len] of song.bass) {
      if (st === s) this._tone({ wave: 'triangle', f0: mtof(chord[0] + off - 12), dur: len * sd * 0.95, vol: 0.2, attack: 0.01, sustain: true, release: 0.04, dest: M, when });
    }
    const arp = song.arp;
    if (arp && s % arp.every === 0) {
      const i = arp.pattern[(s / arp.every) % arp.pattern.length];
      this._tone({ wave: 'p12', f0: mtof(chord[i % chord.length] + arp.oct), dur: sd * 1.6, vol: arp.vol, cutoff: arp.cutoff, dest: M, when, send: true });
    }
    if (song.pad && s === 0) {
      for (const n of chord) {
        this._tone({ wave: 'triangle', f0: mtof(n), dur: sd * 16, vol: 0.025, attack: 0.4, sustain: true, release: 0.6, dest: M, when, detune: 6 });
      }
    }
    const lead = song.lead[bar];
    if (lead) for (const [st, n, len] of lead) {
      if (st === s) this._tone({ wave: 'p25', f0: mtof(n), dur: len * sd, vol: 0.045, attack: 0.01, sustain: true, release: 0.06, cutoff: 3000, dest: M, when, send: true });
    }
    const d = song.drums;
    if (d) {
      if (d.kick.includes(s)) this._tone({ wave: 'sine', f0: 150, f1: 45, dur: 0.14, vol: 0.22, dest: M, when, glide: 0.1 });
      if (d.snare.includes(s)) this._noise({ type: 'bandpass', f0: 1900, dur: 0.1, vol: 0.06, dest: M, when });
      if (d.hat.includes(s)) this._noise({ type: 'highpass', f0: 7000, dur: 0.035, vol: d.hatVol, dest: M, when });
      if (d.drip && d.drip.includes(s) && bar % 2 === 1) this._tone({ wave: 'sine', f0: 1800, f1: 900, dur: 0.08, vol: 0.03, dest: M, when, send: true });
    }
  }
}
