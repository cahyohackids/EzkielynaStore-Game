import { LevelBuilder } from './builder.js';

// SECTOR 1 — SIGNAL MEADOW
// Teaches: walking into pickups, small hop, full jump, pits, stomping,
// one-way platforms, horizontal + vertical movers, checkpoints, an optional
// dash gap, a false-wall secret and a sky route.
const b = new LevelBuilder(206, 17);

// --- Start: walk, collect, hop ---------------------------------------------
b.ground(0, 24, 14);
b.set(3, 13, 'P');
b.set(1, 13, 't');
b.set(6, 13, 'y');
b.bits([[8, 13], [9, 13], [10, 13]]);
b.ent({ type: 'sign', x: 11, y: 13, icon: 'jump' });
b.rect(13, 13, 14, 13);                       // 1-high step
b.bits([[12, 11], [13, 10], [14, 10], [15, 11]]);
b.rect(19, 12, 20, 13);                       // 2-high block: full jump
b.bits([[19, 11], [20, 11], [22, 12]]);

// --- First pit ---------------------------------------------------------------
b.pit(25, 27, 15);
b.bits([[25, 11], [26, 10], [27, 11]]);

// --- Hopper yard -------------------------------------------------------------
b.ground(28, 46, 14);
b.row(32, 35, 11, '=');
b.bits([[32, 10], [33, 10], [34, 10], [35, 10]]);
b.rect(37, 12, 37, 13);                       // keeps the hopper in its yard
b.set(41, 13, 'g');
b.bits([[41, 10], [42, 10], [43, 10]]);       // "jump on it" hint
b.ground(47, 60, 12);
b.set(51, 11, 'r');
b.bits([[50, 10], [51, 10]]);
b.set(57, 11, 'K');

// --- Moving platform over the energy pit -------------------------------------
b.pit(61, 72, 15);
b.ent({ type: 'mover', x: 62, y: 11, to: [68, 11], w: 2, period: 4.2 });
b.bits([[63, 9], [65, 9], [67, 9], [69, 9]]);
b.ground(73, 85, 12);
b.set(75, 11, 'g');
b.rect(79, 10, 79, 11);                       // hopper turn-post
b.row(80, 81, 11, '^');                       // first spikes: readable, jumpable
b.bits([[79, 9], [80, 8], [81, 9]]);

// --- Meadow floor & false-wall secret (Data Core 1) ---------------------------
b.ground(86, 99, 14);
b.set(88, 13, 't');
b.set(93, 13, 'r');
b.row(95, 98, 11, '=');
b.bits([[96, 10], [97, 10]]);
b.bits([[97, 13], [98, 13], [99, 13]]);       // trail leading into the wall
b.rect(100, 9, 107, 17);                      // plateau
b.clear(100, 12, 101, 13);                    // cracked false wall...
b.clear(102, 11, 106, 13);                    // ...into a hidden chamber
b.secret(100, 11, 106, 13);
b.set(105, 12, 'C');
b.bits([[102, 13], [103, 13]]);

// --- Hopper valley with an upper route ----------------------------------------
b.ground(108, 125, 14);
b.set(113, 13, 'g');
b.set(120, 13, 'g');
b.set(116, 13, 'r');
b.bits([[114, 12], [117, 11], [118, 11]]);
b.row(109, 111, 8, '=');
b.row(115, 117, 7, '=');
b.row(121, 123, 8, '=');
b.bits([[110, 7], [116, 6], [122, 7]]);

// --- Vertical mover + sky route (Data Core 3) ---------------------------------
b.pit(126, 131, 15);
b.ent({ type: 'mover', x: 127, y: 12, to: [127, 7], w: 2, period: 4.6 });
b.row(116, 121, 3, '=');
b.row(124, 126, 4, '=');
b.set(117, 2, 'C');
b.bits([[128, 5], [125, 3], [120, 2], [119, 2]]);

// --- Ledge, checkpoint 2, optional dash to the island (Data Core 2) -----------
b.rect(132, 9, 142, 17);
b.set(134, 8, 't');
b.set(137, 8, 'K');
b.ent({ type: 'sign', x: 141, y: 8, icon: 'dash' });
b.ground(143, 160, 14);
b.rect(150, 9, 152, 10);                      // floating island (dash required)
b.set(151, 8, 'C');
b.bits([[145, 8], [146, 8], [147, 8], [148, 8]]);
b.set(155, 13, 'g');
b.bits([[153, 12], [157, 12]]);

// --- Stepping stone pit & final approach -------------------------------------
b.pit(161, 164, 15);
b.row(162, 163, 12, '=');
b.bits([[162, 11], [163, 11]]);
b.ground(165, 205, 14);
b.set(170, 13, 't');
b.bits([[168, 13], [171, 12], [174, 13]]);
b.set(176, 13, 'g');
b.set(178, 13, 'y');
b.rect(181, 13, 205, 13);
b.rect(187, 12, 205, 12);
b.bits([[182, 12], [185, 11], [188, 10], [190, 11]]);
b.set(192, 11, 'r');
b.set(197, 11, 'T');

export default b.build({ id: 'meadow', name: 'SIGNAL MEADOW', theme: 'meadow' });
