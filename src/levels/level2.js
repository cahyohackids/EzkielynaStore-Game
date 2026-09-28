import { LevelBuilder } from './builder.js';

// SECTOR 2 — CIRCUIT CAVERNS
// Introduces: falling platforms, bounce pads, vertical traversal, static
// drones and hidden rooms. Built by carving air out of solid rock.
const W = 180, O = 2;                     // O: headroom rows added above
const b = new LevelBuilder(W, 34 + O);
const air = (x0, y0, x1, y1) => b.clear(x0, y0 + O, x1, y1 + O);
const at = (x, y, ch) => b.set(x, y + O, ch);
const row = (x0, x1, y, ch) => b.row(x0, x1, y + O, ch);
const bits = (list) => b.bits(list.map(([x, y]) => [x, y + O]));
const drone = (e) => b.ent({ ...e, type: 'drone', y: e.y + O, to: e.to ? [e.to[0], e.to[1] + O] : undefined });

b.rect(0, 0, W - 1, b.h - 1, '#');

// --- A: The descent -------------------------------------------------------------
air(0, 5, 11, 9);                        // start shelf (top 10)
at(3, 9, 'P');
at(8, 9, 'y');
bits([[6, 9], [7, 8], [9, 8]]);
air(12, 5, 16, 12);                      // step (top 13)
bits([[13, 11], [14, 11], [15, 11]]);
air(17, 6, 21, 15);                      // step (top 16)
at(19, 15, 'r');
air(22, 6, 27, 21);                      // drop with a safety bounce pad
at(24, 21, 'B');
row(23, 25, 15, 'F');                    // first falling platform
bits([[23, 13], [24, 12], [25, 13]]);
air(28, 6, 34, 13);                      // ledge (top 14)
at(30, 13, 'g');
bits([[32, 12], [33, 12]]);
air(35, 8, 40, 17);                      // step down (top 18)

// --- B: Crumbling bridge over the energy river -----------------------------------
air(41, 8, 62, 21);
b.pit(41, 62, 22 + O);
row(42, 43, 18, 'F');
row(46, 47, 17, 'F');
row(50, 51, 18, 'F');
row(54, 55, 17, 'F');
row(58, 59, 18, 'F');
bits([[42, 16], [43, 16], [46, 15], [47, 15], [50, 16], [51, 16], [54, 15], [55, 15], [58, 16], [59, 16]]);
drone({ x: 45, y: 12, to: [57, 12], period: 5.2 });
air(63, 8, 75, 17);                      // landing (top 18)
at(66, 17, 'K');
at(71, 17, 't');

// Hidden room 1 (Data Core 1) — entered from the lower floor, walking back left.
air(74, 24, 75, 25);
air(68, 23, 73, 25);
b.secret(68, 23 + O, 75, 25 + O);
at(69, 24, 'C');
bits([[71, 25], [72, 25]]);

// --- C: Drone gallery --------------------------------------------------------------
air(76, 16, 109, 25);
bits([[77, 25], [78, 25], [79, 25]]);    // trail pointing back at the secret
at(81, 25, 'g');
drone({ x: 85, y: 18, to: [85, 24], period: 3.2 });
b.row(88, 89, 25 + O, '^');
bits([[88, 23], [89, 23]]);
row(91, 93, 22, '=');
bits([[91, 21], [92, 21], [93, 21]]);
drone({ x: 99, y: 22, orbit: 2.6, period: 4.2 });
at(96, 25, 'y');
at(105, 25, 'b');
bits([[102, 25], [106, 23]]);

// --- D: The shaft ------------------------------------------------------------------
air(110, 6, 126, 25);
at(112, 25, 'B');
bits([[112, 22], [112, 20]]);
row(113, 117, 18, '=');
row(120, 124, 15, '=');
drone({ x: 119, y: 11, to: [119, 16], period: 3.4 });
row(115, 117, 12, 'F');
row(120, 126, 9, '=');
bits([[115, 16], [121, 13], [123, 13], [116, 10], [122, 7], [124, 7]]);
at(125, 25, 'r');
// Hidden room 2 (Data Core 2) in the shaft wall.
row(110, 112, 13, '=');
air(109, 11, 109, 12);
air(105, 10, 108, 12);
b.secret(105, 10 + O, 109, 12 + O);
at(106, 11, 'C');
bits([[111, 12], [107, 12]]);

// --- E: Upper circuits -------------------------------------------------------------
air(127, 3, 179, 8);
at(131, 8, 'K');
at(137, 8, 'b');
bits([[134, 7], [135, 7], [139, 6], [140, 6]]);
air(143, 3, 155, 12);
b.pit(143, 155, 13 + O);
b.ent({ type: 'mover', x: 144, y: 8 + O, to: [150, 8 + O], w: 2, period: 3.6 });
bits([[146, 6], [148, 6], [150, 6], [153, 6]]);
// Bounce into the ceiling alcove (Data Core 3).
at(160, 8, 'B');
bits([[160, 6], [160, 4]]);
air(158, 2, 164, 2);
air(164, 0, 164, 1);
air(159, 0, 163, 0);
row(159, 163, 1, '=');
b.secret(158, 0 + O, 164, 2 + O);
at(162, 0, 'C');
bits([[160, 0]]);
b.row(167, 168, 8 + O, '^');
bits([[167, 6], [168, 6]]);
at(164, 8, 't');
bits([[172, 7], [173, 7]]);
at(176, 8, 'T');

export default b.build({ id: 'caverns', name: 'CIRCUIT CAVERNS', theme: 'caverns' });
