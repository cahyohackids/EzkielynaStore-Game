// Headless level validator.
//
// Runs the real Player physics against each level and explores, breadth-first,
// every standing position reachable with a library of input "macros" (walks,
// hops, full jumps, drifts, dashes, dash-jumps, drop-throughs, waiting for
// timed hazards). Any macro that touches a hazard is discarded, so the result
// is a set of hazard-free routes. Reports unreachable bits, cores, checkpoints
// and whether the signal tower can be activated.
//
//   node tools/validate-levels.mjs [levelIndex]

import { LEVELS } from '../src/levels/index.js';
import { Level, T } from '../src/game/level.js';
import { Player } from '../src/game/player.js';
import { Mover, Faller, Pad, Laser, Tower } from '../src/game/objects.js';
import { TILE, PHYS_STEP } from '../src/config.js';
import { PHASE_PERIOD } from '../src/game/level.js';

const noop = () => {};
const fx = new Proxy({}, { get: () => noop });

function makeWorld(def) {
  const level = new Level(def);
  const game = { level, fx, sfx: noop, shake: noop, onPlayerHurt: noop, onPlayerDeath: noop, cam: { x: 0, y: 0, w: 480, h: 225 } };
  const ents = def.entities || [];
  game.movers = ents.filter((e) => e.type === 'mover').map((e) => new Mover(e, def.theme));
  game.fallers = level.fallDefs.map((d) => { const f = new Faller(d, def.theme); f.game = game; return f; });
  game.pads = level.bounceDefs.map((d) => new Pad(d));
  game.platforms = [...game.movers, ...game.fallers, ...game.pads];
  game.player = { cx: -9999, cy: -9999, x: -9999, y: -9999, w: 10, h: 13, bottom: -9999 };
  game.lasers = ents.filter((e) => e.type === 'laser').map((e) => new Laser(e, game));
  game.tower = level.tower ? new Tower(level.tower.x, level.tower.y) : null;
  // Where timing matters, waiting variants of every macro are tried.
  const timed = [
    ...game.lasers.map((l) => ({ x: l.ox, period: l.mode === 'sweep' ? l.period : l.on + l.off })),
    ...[...level.dyn.values()].filter((b) => b.kind !== T.VANISH).map((b) => ({ x: b.tx * TILE, period: PHASE_PERIOD })),
  ];
  const timedXs = timed.map((e) => e.x);
  // Period of the closest timed element (states only differ modulo it).
  game.localPeriod = (x) => {
    let best = null;
    for (const e of timed) if (Math.abs(e.x - x) < 8 * TILE && (!best || Math.abs(e.x - x) < Math.abs(best.x - x))) best = e;
    return best ? best.period : 0;
  };
  const moverXs = game.movers.flatMap((m) => [m.x0, m.x1 + m.w]);
  // Timed hazards/blocks: the moment you arrive matters.
  game.nearTimed = (x) => timedXs.some((dx) => Math.abs(dx - x) < 8 * TILE);
  // Anything periodic nearby: worth trying a few waits before acting.
  game.nearDynamic = (x) => game.nearTimed(x) || moverXs.some((dx) => Math.abs(dx - x) < 5 * TILE);
  return game;
}

function resetWorld(g, t0) {
  const lv = g.level;
  lv.phaseT = t0;
  for (const b of lv.dyn.values()) {
    if (b.kind === T.VANISH) { b.state = 'solid'; b.solid = true; b.t = 0; }
    else { b.solid = lv.phaseState(b.kind).on; b.pending = false; }
  }
  for (const m of g.movers) { m.t = (m.def0 ?? (m.def0 = m.t)) + t0; m._place(); m.prevX = m.x; m.prevY = m.y; m.dx = 0; m.dy = 0; }
  for (const f of g.fallers) f.reset();
  for (const l of g.lasers) { l.t = t0; l.update(0); }
}

// --- Macros: functions of elapsed time -> control state -------------------------
function macros(dir) {
  const M = [];
  const J = (hold, opts = {}) => (t) => ({
    dir: t < (opts.delayDir || 0) ? 0 : (opts.stopDirAt != null && t > opts.stopDirAt ? 0 : dir),
    jumpHeld: t < hold, jumpPressed: t === 0,
    dashPressed: opts.dashAt != null && Math.abs(t - opts.dashAt) < PHYS_STEP / 2,
    down: false,
  });
  for (const d of [0.1, 0.25, 0.6]) M.push({ name: `walk${d}`, f: (t) => ({ dir: t < d ? dir : 0 }), land: false });
  for (const h of [0.05, 0.14, 9]) M.push({ name: `jump${h}`, f: J(h), land: true });
  M.push({ name: 'jumpShort', f: J(9, { stopDirAt: 0.18 }), land: true });
  M.push({ name: 'jumpShort2', f: J(9, { stopDirAt: 0.34 }), land: true });
  M.push({ name: 'upDrift', f: J(9, { delayDir: 0.2 }), land: true });
  M.push({ name: 'upDriftLate', f: J(9, { delayDir: 0.38 }), land: true });
  for (const r of [0.15, 0.35]) M.push({ name: `run${r}Jump`, f: (t) => ({ dir, jumpHeld: t >= r, jumpPressed: Math.abs(t - r) < PHYS_STEP / 2 }), land: true });
  for (const dt of [0.1, 0.22, 0.34, 0.46]) M.push({ name: `jumpDash${dt}`, f: J(9, { dashAt: dt }), land: true });
  M.push({ name: 'dashJump', f: (t) => ({ dir, dashPressed: t === 0, jumpHeld: t > 0.05, jumpPressed: Math.abs(t - 0.06) < PHYS_STEP / 2 }), land: true });
  M.push({ name: 'runDashJump', f: (t) => ({ dir, dashPressed: Math.abs(t - 0.25) < PHYS_STEP / 2, jumpHeld: t > 0.3, jumpPressed: Math.abs(t - 0.31) < PHYS_STEP / 2 }), land: true });
  M.push({ name: 'walkDash', f: (t) => ({ dir, dashPressed: Math.abs(t - 0.2) < PHYS_STEP / 2 }), land: true });
  M.push({ name: 'drop', f: (t) => ({ dir: t > 0.1 ? dir : 0, down: t < 0.1, jumpPressed: t === 0, jumpHeld: false }), land: true });
  return M;
}
const ALL_MACROS = [...macros(1), ...macros(-1), { name: 'hop', f: (t) => ({ dir: 0, jumpHeld: true, jumpPressed: t === 0 }), land: true }];

function hazardAt(g, p) {
  const lv = g.level;
  const tx0 = Math.floor((p.x + 1) / TILE), tx1 = Math.floor((p.x + p.w - 1) / TILE);
  const ty0 = Math.floor((p.y + 1) / TILE), ty1 = Math.floor((p.bottom - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = lv.tileAt(tx, ty);
    if (t === T.SPIKE_UP && p.bottom > ty * TILE + 9) return true;
    if (t === T.SPIKE_DOWN && p.y < ty * TILE + 7) return true;
    if (t === T.PIT && p.bottom - ty * TILE > 7) return true;
  }
  if (p.y > lv.pxH + 8) return true;
  for (const l of g.lasers) if (l.hits(p)) return true;
  return false;
}

function simulate(g, node, macro, wait, sink) {
  resetWorld(g, node.t);
  const p = new Player(g, node.x, node.y);
  g.player = p;
  p.grounded = true; p.coyote = 0.11;
  let t = 0, airborne = false, airT = 0;
  const H = PHYS_STEP;
  const settle = !macro.land;
  for (let i = 0; i < 520; i++) {
    const mt = t - wait;
    const c = mt < 0 ? { dir: 0 } : macro.f(Math.round(mt / H) * H);
    // world
    g.level.update(H, p, null);
    for (const pl of g.platforms) pl.update(H);
    if (p.ground && (p.ground.dx || p.ground.dy)) {
      const nx = p.x + p.ground.dx, ny = p.y + p.ground.dy;
      if (g.level.rectFree(nx, p.y, p.w, p.h)) p.x = nx;
      if (g.level.rectFree(p.x, ny, p.w, p.h)) p.y = ny;
    }
    for (const l of g.lasers) l.update(H);
    const ctrl = { dir: c.dir || 0, jumpHeld: !!c.jumpHeld, jumpPressed: !!c.jumpPressed, dashPressed: !!c.dashPressed, down: !!c.down };
    p.step(H, ctrl);
    t += H;
    if (hazardAt(g, p)) return null;
    sink(p, t);
    if (!p.grounded) { airT += H; if (airT > 0.04) airborne = true; }
    if (mt > 0) {
      if (!settle && airborne && p.grounded) return { p, t };
      if (settle && p.grounded && Math.abs(p.vx) < 2 && mt > 0.1) return { p, t };
      if (settle && airborne && p.grounded) return { p, t };
    }
  }
  return null;
}

function validate(index) {
  const def = LEVELS[index];
  const g = makeWorld(def);
  const lv = g.level;
  const bits = lv.bits.map((b) => ({ ...b, got: false }));
  const cores = lv.cores.map((c) => ({ ...c, got: false }));
  const cps = lv.checkpoints.map((c) => ({ ...c, got: false }));
  let tower = false;
  const sink = (p) => {
    for (const b of bits) if (!b.got && Math.abs(p.cx - b.x) < 9 && Math.abs(p.cy - b.y) < 11) b.got = true;
    for (const c of cores) if (!c.got && Math.abs(p.cx - c.x) < 11 && Math.abs(p.cy - c.y) < 12) c.got = true;
    for (const c of cps) if (!c.got && p.x + p.w > c.x + 1 && p.x < c.x + 15 && p.bottom > c.y - 30 && p.y < c.y) c.got = true;
    if (g.tower && g.tower.hit(p) && p.grounded) tower = true;
  };
  const seen = new Set();
  const key = (p, t) => {
    let tb = 0;
    if (p.ground && p.ground instanceof Mover) tb = Math.round((t % p.ground.period) / 0.3);
    else if (g.nearTimed(p.x)) { const per = g.localPeriod(p.x); tb = Math.round((t % per) / 0.3) % Math.round(per / 0.3); }
    return `${Math.round(p.x / 5)},${Math.round(p.y / 4)},${p.ground ? g.platforms.indexOf(p.ground) : -1},${tb}`;
  };
  const start = { x: lv.spawn.x, y: lv.spawn.y, t: 0 };
  const queue = [start];
  seen.add(key({ ...start, ground: null }, 0));
  let sims = 0;
  const t0 = Date.now();
  while (queue.length) {
    const node = queue.shift();
    const waits = g.nearDynamic(node.x) && !node.onFaller ? [0, 0.45, 1.0, 1.7] : [0];
    for (const w of waits) {
      for (const m of ALL_MACROS) {
        sims++;
        const r = simulate(g, node, m, w, sink);
        if (!r) continue;
        const k = key(r.p, node.t + r.t);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ x: r.p.x, y: r.p.y, t: node.t + r.t, onFaller: r.p.ground instanceof Faller });
      }
    }
    if (sims > 6000000) { console.log('  (search budget exhausted)'); break; }
  }
  const missBits = bits.filter((b) => !b.got).map((b) => `(${Math.floor(b.x / TILE)},${Math.floor(b.y / TILE)})`);
  const missCores = cores.filter((c) => !c.got).map((c) => `#${c.index + 1}@(${Math.floor(c.x / TILE)},${Math.floor(c.y / TILE)})`);
  const missCps = cps.filter((c) => !c.got).map((c) => `(${c.x / TILE})`);
  const ok = tower && !missBits.length && !missCores.length && !missCps.length;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${def.name}: tower ${tower ? 'reachable' : 'UNREACHABLE'}, ` +
    `bits ${bits.length - missBits.length}/${bits.length}, cores ${cores.length - missCores.length}/${cores.length}, ` +
    `checkpoints ${cps.length - missCps.length}/${cps.length}  [${seen.size} states, ${sims} sims, ${((Date.now() - t0) / 1000).toFixed(1)}s]`);
  if (missBits.length) console.log('  unreachable bits:', missBits.join(' '));
  if (missCores.length) console.log('  unreachable cores:', missCores.join(' '));
  if (missCps.length) console.log('  unreachable checkpoints:', missCps.join(' '));
  return ok;
}

const arg = process.argv[2];
const which = arg != null ? [+arg] : LEVELS.map((_, i) => i);
let allOk = true;
for (const i of which) allOk = validate(i) && allOk;
process.exit(allOk ? 0 : 1);
