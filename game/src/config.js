// SALTDOWN — shared configuration: palette, weapons, economy, physics, timing.
// One place for every tunable; modules read from here, never redefine constants.

export const PALETTE = {
  sky: 0x101820,
  fog: 0x131c24,
  ground: 0x22282e,
  concrete: 0x3d454e,
  concreteDark: 0x333a42,
  metal: 0x4a545e,
  rust: 0x7a4a2e,
  accentTeal: 0x2fa8a0,
  accentOrange: 0xe07030,
  sodium: 0xffb066,
  enemy: 0xc05040,
  friendly: 0x3f9fd8,
  charge: 0xd04030,
};

// Weapons. Names, art and sounds are original. damage is the body hit; headshotMul scales it.
// spread is radians of cone at rest; moveSpread adds per (m/s) of velocity; recoil is per-shot
// vertical climb (radians) plus horizontal jitter. crouchMul scales spread while crouched.
export const WEAPONS = {
  sidearm: {
    name: 'M9 Sidearm', price: 0, kind: 'pistol',
    damage: 26, headshotMul: 4, rpm: 420, mag: 12, reserve: 36, reloadTime: 1.9,
    spread: 0.006, moveSpread: 0.012, recoil: 0.010, crouchMul: 0.65, falloff: 0.5,
    auto: false, tracer: 0.35,
  },
  smg: {
    name: 'Kestrel SMG', price: 1250, kind: 'smg',
    damage: 21, headshotMul: 3, rpm: 800, mag: 30, reserve: 90, reloadTime: 2.3,
    spread: 0.014, moveSpread: 0.008, recoil: 0.007, crouchMul: 0.7, falloff: 0.65,
    auto: true, tracer: 0.28,
  },
  rifle: {
    name: 'Vulture Rifle', price: 2700, kind: 'rifle',
    damage: 36, headshotMul: 4, rpm: 600, mag: 30, reserve: 90, reloadTime: 2.5,
    spread: 0.0055, moveSpread: 0.022, recoil: 0.013, crouchMul: 0.6, falloff: 0.85,
    auto: true, tracer: 0.35,
  },
  carbine: {
    name: 'Sentinel Carbine', price: 2900, kind: 'rifle',
    damage: 29, headshotMul: 3.5, rpm: 660, mag: 30, reserve: 90, reloadTime: 2.4,
    spread: 0.005, moveSpread: 0.019, recoil: 0.010, crouchMul: 0.6, falloff: 0.85,
    auto: true, tracer: 0.35,
  },
  sniper: {
    name: 'Longhorn Marksman', price: 4750, kind: 'sniper',
    damage: 115, headshotMul: 2.2, rpm: 48, mag: 5, reserve: 20, reloadTime: 3.2,
    spread: 0.0008, moveSpread: 0.05, recoil: 0.03, crouchMul: 0.5, falloff: 1.0,
    auto: false, tracer: 0.5, zoom: true,
  },
};

export const GRENADE = { name: 'Frag', price: 300, damage: 90, radius: 7, fuse: 2.2, throwSpeed: 16 };

export const ECONOMY = {
  startMoney: 800,
  maxMoney: 16000,
  winRound: 3250,
  lossBase: 1400,
  lossStep: 500,
  lossMax: 3400,
  kill: 300,
  plantBonus: 300,
  defuseBonus: 300,
};

export const ROUND = {
  freezeTime: 5,
  roundTime: 95,
  bombTime: 40,
  plantTime: 4,
  defuseTime: 7,
  defuseTimeKit: 5,
  endDelay: 5,
  roundsToWin: 8, // first to 8 of 15 wins the match
};

export const PHYS = {
  gravity: 22,
  jumpSpeed: 7.4,
  accel: 62,
  airAccel: 14,
  friction: 9,
  maxSpeed: 7.0,
  walkSpeed: 3.6,
  crouchSpeed: 3.0,
  eyeHeight: 1.62,
  eyeCrouch: 1.12,
  radius: 0.42,
  height: 1.8,
  crouchHeight: 1.3,
  stepHeight: 0.55,
};

export const HUD_COLORS = {
  health: '#e9e6df',
  healthLow: '#d04030',
  money: '#8fd08f',
  teal: '#2fa8a0',
  orange: '#e07030',
};
