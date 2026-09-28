import { TILE } from '../config.js';

const EPS = 0.001;

/**
 * Axis-separated tile collision. Bodies are {x, y, w, h}. Movement per call is
 * always < 1 tile because the game runs fixed 1/120 s substeps, so only the
 * leading edge row/column needs checking — no tunnelling.
 */
export function moveX(b, level, dx) {
  if (dx === 0) return false;
  b.x += dx;
  const ty0 = Math.floor(b.y / TILE);
  const ty1 = Math.floor((b.y + b.h - EPS) / TILE);
  if (dx > 0) {
    const tx = Math.floor((b.x + b.w - EPS) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (level.solidAt(tx, ty)) { b.x = tx * TILE - b.w; return true; }
    }
  } else {
    const tx = Math.floor(b.x / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (level.solidAt(tx, ty)) { b.x = (tx + 1) * TILE; return true; }
    }
  }
  return false;
}

/**
 * Vertical move. Returns 1 when landing (sets b.ground to a platform or null),
 * -1 when bumping a ceiling, 0 otherwise. One-way tiles and platform entities
 * only collide when approached from above.
 */
export function moveY(b, level, dy, platforms) {
  if (dy === 0) return 0;
  const prevBottom = b.y + b.h;
  b.y += dy;
  const tx0 = Math.floor(b.x / TILE);
  const tx1 = Math.floor((b.x + b.w - EPS) / TILE);
  if (dy > 0) {
    const bottom = b.y + b.h;
    const ty = Math.floor((bottom - EPS) / TILE);
    let landY = Infinity;
    let plat = null;
    const top = ty * TILE;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (level.solidAt(tx, ty)) { landY = Math.min(landY, top); }
      else if (!b.dropThrough && level.oneWayAt(tx, ty) && prevBottom <= top + 0.5) {
        landY = Math.min(landY, top);
      }
    }
    if (platforms) {
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (!p.solid) continue;
        if (b.x >= p.x + p.w || b.x + b.w <= p.x) continue;
        const ref = Math.max(p.y, p.prevY);
        if (prevBottom <= ref + 0.75 && bottom >= p.y && p.y < landY) {
          landY = p.y;
          plat = p;
        }
      }
    }
    if (landY !== Infinity) {
      b.y = landY - b.h;
      b.ground = plat;
      return 1;
    }
  } else {
    const ty = Math.floor(b.y / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (level.solidAt(tx, ty)) { b.y = (ty + 1) * TILE; return -1; }
    }
  }
  return 0;
}

/** True when the tile directly below `x` at the body's feet is solid ground. */
export function groundAhead(b, level, x) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor((b.y + b.h + 1) / TILE);
  return level.solidAt(tx, ty) || level.oneWayAt(tx, ty);
}
