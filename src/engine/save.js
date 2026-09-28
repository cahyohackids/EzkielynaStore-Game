import { LEVEL_IDS } from '../config.js';

const KEY = 'pixelbound-lost-signal/v1';

function defaults() {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    unlocked: 1,
    levels: {},
    settings: { music: 0.6, sfx: 0.8, muted: false, shake: true, reducedMotion: reduced },
  };
}

/** localStorage-backed progress + settings. Fails soft if storage is blocked. */
export class Save {
  constructor() {
    this.data = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = { ...defaults(), ...d, settings: { ...defaults().settings, ...(d.settings || {}) } };
      }
    } catch { /* storage unavailable: play without persistence */ }
  }

  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  get settings() { return this.data.settings; }

  level(id) {
    return this.data.levels[id] || { completed: false, bestTime: null, bestBits: 0, totalBits: 0, cores: [false, false, false] };
  }

  isUnlocked(index) { return index < this.data.unlocked; }

  recordCompletion(id, { time, bits, totalBits, cores }) {
    const prev = this.level(id);
    const newBest = prev.bestTime == null || time < prev.bestTime;
    this.data.levels[id] = {
      completed: true,
      bestTime: newBest ? time : prev.bestTime,
      bestBits: Math.max(prev.bestBits || 0, bits),
      totalBits,
      cores: prev.cores.map((c, i) => c || !!cores[i]),
    };
    const idx = LEVEL_IDS.indexOf(id);
    this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVEL_IDS.length, idx + 2));
    this.write();
    return newBest;
  }

  resetProgress() {
    const s = this.data.settings;
    this.data = defaults();
    this.data.settings = s;
    this.write();
  }
}
