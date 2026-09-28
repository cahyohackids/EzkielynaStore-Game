# PIXELBOUND: Lost Signal

A small, complete 2D pixel platformer for the browser. You play **PIP**, a pocket-sized
courier robot, restoring the signal towers of a network broken by *The Lost Signal*.

Three hand-built sectors, original pixel art drawn in code, synthesized sound and music,
keyboard / gamepad / touch controls, and saved progress. No frameworks, no build step,
no external assets beyond two open-licensed pixel fonts that ship with the repo.

## Play

Serve the folder with any static server. ES modules don't load from `file://`:

```sh
npx http-server -c-1 .     # or: python3 -m http.server
# open http://localhost:8080
```

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move | A / D, ← / → | D-pad, left stick | Left pad (slide between halves) |
| Jump (hold for higher) | Space, W, ↑ | A | ⇧ button |
| Dash | Shift (also X / K) | X / B / bumpers | » button |
| Drop through thin platform | S + Jump | Down + A | — |
| Restart level | R | Select | Pause menu |
| Pause | Esc / P | Start | ❚❚ button |
| Mute | M | — | Settings |

Every menu works with the keyboard, a gamepad, the mouse or touch, and focus is always visible.

## The sectors

1. **Signal Meadow** (easy). Teaches through layout: walk into your first pickups, hop, full jump,
   a pit, stomping a Glitch Hopper, one-way platforms, horizontal and vertical movers. Dash
   shows up only as an optional route to a Data Core.
2. **Circuit Caverns** (medium). Crumbling platforms over an energy river, bounce pads,
   a vertical shaft climb, Static Drones and two hidden rooms.
3. **Glitch Tower** (medium-hard). Timed and sweeping lasers, disappearing blocks, phase
   blocks, faster Corrupt Bugs, dash-gated gaps, and a rooftop tower finale.

Each sector has two checkpoints, three hidden **Data Cores** and at least one secret path. A
cracked wall is usually worth walking into.

## Game feel

The player controller lives in `src/game/player.js` and its tuning in `src/config.js`:

- Separate ground and air acceleration, with a turn-around boost and overspeed decay (momentum)
- **Coyote time** 110 ms and **jump buffering** 130 ms
- **Variable jump height** (jump-cut gravity), an apex hang while jump is held, and heavier fall gravity
- Terminal velocity and ceiling corner-correction (you slide past ledges you barely clip)
- **Dash** with afterimage trail, cooldown meter and one air dash per jump (refreshed on landing
  or on a stomp). **Dash-jump** keeps extra momentum for long leaps.
- Squash and stretch, landing dust, stomp hit-stop, restrained screen shake (can be turned off)

Physics runs in fixed 1/120 s substeps, so collision stays stable at any refresh rate and
nothing can tunnel.

## Architecture

```
index.html, styles.css      shell, pixel-styled DOM UI (scaled in game-pixel units)
src/main.js                 bootstrap, responsive sizing, main loop
src/config.js               palette + movement tuning
src/engine/                 input (kbd/touch/pad), audio (WebAudio synth + sequencer),
                            save (localStorage), camera, particles (pooled), physics, utils
src/gfx/                    sprites (procedural pixel art), world (auto-tiling, parallax), font
src/game/                   game (state/flow/render), level (tile grid, dynamic blocks,
                            secrets), player, enemies, objects (collectibles, checkpoints,
                            tower, platforms, lasers), hud
src/levels/                 level DSL (builder.js) + the three sectors
src/ui/                     menus, touch controls
tools/validate-levels.mjs   headless completability checker
```

The internal resolution is 225 px tall. Width adapts to the screen's aspect ratio
(360–480 px), and the result is scaled uniformly with nearest-neighbour filtering, so sprites
are never stretched.

## Level validation

```sh
node tools/validate-levels.mjs        # all levels
node tools/validate-levels.mjs 2      # just Glitch Tower
```

The validator runs the real `Player` physics headlessly. It does a breadth-first search over
standing positions using a library of input macros: walks, hops, full jumps, drifts, dashes,
dash-jumps, drop-throughs, and waits for timed hazards. Any route that touches a hazard is
thrown out. It then checks that the tower, every Signal Bit, every Data Core and every
checkpoint can be reached without taking damage.

## Credits

Code, pixel art, sound effects and music are all original and generated in code.
Fonts: [Silkscreen](https://fonts.google.com/specimen/Silkscreen) and
[Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), both under the SIL Open Font License.
