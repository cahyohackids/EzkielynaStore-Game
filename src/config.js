// Global tuning + palette. Every visual colour in the game comes from here so the
// whole world reads as one art-directed palette.

export const TILE = 16;
export const VIEW_H = 225;           // internal resolution height (width adapts to aspect)
export const VIEW_W_MIN = 360;
export const VIEW_W_MAX = 480;
export const PHYS_STEP = 1 / 120;    // physics substep (s)

export const C = {
  ink: '#0b1020',
  navy: '#131a30',
  navy2: '#1c2743',
  slate: '#2a3a5c',
  slate2: '#364a70',
  blue: '#46638f',
  blue2: '#6786b0',
  sky: '#a8c8d8',
  sky2: '#cfe0e0',
  teal0: '#15505a',
  teal: '#1f8078',
  teal2: '#38b39b',
  mint: '#86e3c6',
  orange0: '#7c3421',
  orange: '#d0652e',
  orange2: '#f09a4a',
  gold: '#ffcf87',
  cream: '#f3e6c9',
  cream2: '#cbb996',
  cream3: '#9d8c70',
  white: '#fff8ec',
  mag0: '#4c1638',
  mag: '#a8305f',
  mag2: '#e4497a',
  pink: '#ff98ae',
};

// Player movement tuning (pixels / seconds).
export const P = {
  w: 10, h: 13,
  runMax: 118,
  runAccel: 1150,
  runDecel: 1500,
  turnAccel: 2300,
  airAccel: 820,
  airDecel: 380,
  airTurn: 1250,
  overspeedDecelAir: 170,
  overspeedDecelGround: 700,
  gravity: 960,
  fallGravity: 1480,
  cutGravity: 2500,
  apexThreshold: 38,
  apexGravityMul: 0.55,
  jumpVel: 330,
  maxFall: 330,
  coyote: 0.11,
  buffer: 0.13,
  dashSpeed: 300,
  dashTime: 0.15,
  dashCooldown: 0.55,
  dashBuffer: 0.08,
  dashExitSpeed: 150,
  dashJumpVx: 215,
  bounceVel: 505,
  stompVel: 250,
  stompVelHeld: 335,
  invuln: 1.3,
  hurtStun: 0.28,
  knockVx: 130,
  knockVy: 210,
};

export const LEVEL_IDS = ['meadow', 'caverns', 'tower'];
