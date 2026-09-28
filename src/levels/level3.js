import { LevelBuilder } from './builder.js';

// SECTOR 3 — GLITCH TOWER
// Introduces: timed + sweeping lasers, disappearing blocks, phase blocks,
// faster bugs and dash-gated gaps. Ends on the rooftop signal tower.
const W = 196, O = 6;                     // O: open sky above the roof
const b = new LevelBuilder(W, 30 + O);
const R = (x0, y0, x1, y1, ch = '#') => b.rect(x0, y0 + O, x1, y1 + O, ch);
const air = (x0, y0, x1, y1) => b.clear(x0, y0 + O, x1, y1 + O);
const ground = (x0, x1, top) => b.ground(x0, x1, top + O);
const at = (x, y, ch) => b.set(x, y + O, ch);
const row = (x0, x1, y, ch) => b.row(x0, x1, y + O, ch);
const pit = (x0, x1, s) => b.pit(x0, x1, s + O);
const bits = (list) => b.bits(list.map(([x, y]) => [x, y + O]));
const ent = (e) => b.ent({ ...e, y: e.y + O, to: e.to && Array.isArray(e.to) ? [e.to[0], e.to[1] + O] : e.to });

// --- A: Plaza — first lasers, crumbling bridge --------------------------------------
ground(0, 22, 25);
at(3, 24, 'P');
at(7, 24, 'y');
at(10, 24, 'r');
bits([[6, 24], [8, 23], [9, 23]]);
R(12, 18, 21, 18);                               // overhead gantry
ent({ type: 'laser', x: 14, y: 19, dir: 'down', on: 1.2, off: 1.6, offset: 0 });
ent({ type: 'laser', x: 19, y: 19, dir: 'down', on: 1.2, off: 1.6, offset: 1.4 });
bits([[14, 23], [16, 22], [17, 22], [19, 23]]);
pit(23, 30, 27);
row(23, 30, 25, 'x');                            // disappearing bridge
bits([[24, 23], [26, 22], [28, 22], [30, 23]]);
ground(31, 44, 25);
at(38, 24, 'b');
at(34, 24, 't');
bits([[41, 22], [42, 22]]);

// --- B: Phase blocks over the spike trench -----------------------------------------
ground(45, 66, 27);
row(45, 66, 26, '^');
row(46, 47, 23, 'A');
row(50, 51, 23, 'Z');
row(54, 55, 23, 'A');
row(58, 59, 23, 'Z');
row(62, 63, 23, 'A');
bits([[46, 21], [47, 21], [50, 21], [51, 21], [54, 21], [55, 21], [58, 21], [59, 21], [62, 21], [63, 21]]);

// --- C: Checkpoint, climb the tower wall ------------------------------------------
ground(67, 80, 25);
at(68, 24, 'K');
R(81, 12, 100, 29);
row(74, 76, 22, '=');
row(78, 79, 19, 'x');
row(73, 75, 16, '=');
row(77, 78, 13, 'x');
bits([[75, 20], [78, 17], [74, 14], [77, 11], [80, 10]]);
// Hidden room (Data Core 1) at the foot of the wall.
air(81, 23, 81, 24);
air(82, 22, 86, 24);
b.secret(81, 22 + O, 86, 24 + O);
at(85, 23, 'C');
bits([[78, 24], [79, 24], [80, 24], [83, 24]]);

// --- D: Dash gauntlet ----------------------------------------------------------------
R(88, 5, 92, 5);
ent({ type: 'laser', x: 90, y: 6, dir: 'down', on: 1.0, off: 1.5, offset: 0.3 });
at(96, 11, 'b');
ent({ type: 'sign', x: 99, y: 11, icon: 'dash' });
pit(101, 106, 17);
bits([[102, 10], [103, 9], [104, 9], [105, 10]]);
R(107, 12, 112, 29);                              // pillar
R(108, 5, 111, 5);
ent({ type: 'laser', x: 110, y: 6, dir: 'down', on: 0.9, off: 1.7, offset: 1.2 });
pit(113, 118, 17);
bits([[114, 10], [115, 9], [116, 9], [117, 10]]);
R(119, 12, 150, 29);
ent({ type: 'drone', x: 127, y: 9, orbit: 1.8, period: 3.4 });
bits([[122, 11], [123, 11], [130, 11]]);
// Phase-block staircase to a floating core (Data Core 2).
row(133, 134, 9, 'A');
row(136, 137, 6, 'Z');
row(133, 134, 3, 'A');
at(136, 1, 'C');
bits([[133, 7], [137, 4], [134, 1]]);
at(140, 11, 'K');

// --- E: Sweeping laser, the last ascent, the roof ------------------------------------
R(142, 3, 150, 3);
ent({ type: 'laser', mode: 'sweep', x: 143, to: 149, y: 4, dir: 'down', period: 4.2 });
bits([[143, 11], [145, 11], [147, 11], [149, 11]]);
pit(151, 162, 15);
row(152, 153, 10, 'x');
row(156, 158, 8, '=');
row(160, 161, 6, 'Z');
row(159, 159, 6, 'A');
bits([[152, 8], [157, 6], [160, 4]]);
R(163, 5, 195, 29);
at(167, 4, 'r');
at(171, 4, 'b');
ent({ type: 'drone', x: 177, y: -1, to: [177, 3], period: 2.6 });
// Server hut with a cracked front (Data Core 3).
R(181, 2, 185, 4);
air(181, 3, 184, 4);
b.secret(181, 3 + O, 184, 4 + O);
at(183, 3, 'C');
bits([[179, 4], [180, 4], [182, 4]]);
bits([[174, 3], [175, 2], [187, 3]]);
at(190, 4, 'T');

export default b.build({ id: 'tower', name: 'GLITCH TOWER', theme: 'tower' });
