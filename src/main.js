import { VIEW_H, VIEW_W_MIN, VIEW_W_MAX } from './config.js';
import { Input } from './engine/input.js';
import { AudioManager } from './engine/audio.js';
import { Save } from './engine/save.js';
import { Game } from './game/game.js';
import { UI } from './ui/menus.js';
import { setupTouch } from './ui/touch.js';
import { clamp } from './engine/util.js';

const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const input = new Input();
const audio = new AudioManager();
const save = new Save();
const game = new Game(canvas, { input, audio, save });
const ui = new UI(document.getElementById('ui'), game, { audio, save });
game.ui = ui;
setupTouch(input, game, audio);

// Fit a 225px-tall view to the window: width adapts to the aspect ratio
// (360..480 game px), then the whole stage scales uniformly — never stretched.
function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  const vw = Math.round(clamp((VIEW_H * W) / H, VIEW_W_MIN, VIEW_W_MAX));
  const scale = Math.min(W / vw, H / VIEW_H);
  stage.style.width = `${Math.floor(vw * scale)}px`;
  stage.style.height = `${Math.floor(VIEW_H * scale)}px`;
  document.documentElement.style.setProperty('--px', `${scale}px`);
  if (vw !== game.vw) game.resize(vw);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

// Audio can only start after a gesture.
const unlock = () => { audio.unlock(); audio.playMusic(game.state === 'menu' ? 'menu' : game.levelDef.theme); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.pause();
});
window.addEventListener('blur', () => { if (game.state === 'play') game.pause(); });

ui.show('title');

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  input.update();
  ui.poll(dt);
  game.update(dt);
  game.render();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// QA hooks (only with ?debug in the URL).
if (new URLSearchParams(location.search).has('debug')) window.PB = { game, input, audio, save, ui };
