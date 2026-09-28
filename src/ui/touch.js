/**
 * Multi-touch on-screen controls. The d-pad is one surface split in two so a
 * thumb can slide between left and right without lifting; jump and dash are
 * independent so they can be held together with a direction.
 */
export function setupTouch(input, game, audio) {
  const root = document.getElementById('touch');
  const dpad = root.querySelector('.t-dpad');
  const halves = { left: root.querySelector('.t-l'), right: root.querySelector('.t-r') };
  const buttons = [...root.querySelectorAll('.t-btn[data-action]')];
  const pointers = new Map(); // pointerId -> action

  const enableTouchUI = () => {
    if (!document.body.classList.contains('touch')) {
      document.body.classList.add('touch');
      game.resize && window.dispatchEvent(new Event('resize'));
    }
  };
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouchUI();
  window.addEventListener('touchstart', () => { enableTouchUI(); audio.unlock(); }, { passive: true });
  window.addEventListener('keydown', () => { input.lastDevice = 'keyboard'; }, { passive: true });

  const sync = () => {
    const held = new Set(pointers.values());
    for (const a of ['left', 'right', 'jump', 'dash']) input.setTouch(a, held.has(a));
    halves.left.classList.toggle('on', held.has('left'));
    halves.right.classList.toggle('on', held.has('right'));
    for (const b of buttons) b.classList.toggle('on', held.has(b.dataset.action));
  };

  const dirFrom = (e) => {
    const r = dpad.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? 'left' : 'right';
  };

  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dpad.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, dirFrom(e));
    sync();
  });
  dpad.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const d = dirFrom(e);
    if (pointers.get(e.pointerId) !== d) { pointers.set(e.pointerId, d); sync(); }
  });
  for (const b of buttons) {
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, b.dataset.action);
      sync();
    });
  }
  const release = (e) => { if (pointers.delete(e.pointerId)) sync(); };
  for (const el of [dpad, ...buttons]) {
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }
  root.querySelector('.t-pause').addEventListener('click', (e) => {
    e.preventDefault();
    pointers.clear(); sync();
    game.pause();
  });
  // Never let the page scroll/zoom under the controls.
  root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.getElementById('stage').addEventListener('touchmove', (e) => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });

  return { reset() { pointers.clear(); sync(); } };
}
