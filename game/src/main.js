// SALTDOWN — main: boots the scene, actors, match and HUD, runs a fixed-step 60 Hz
// simulation separated from rendering, and routes every shot, grenade and death through
// one shared combat path. A seeded RNG drives all gameplay randomness.
import * as THREE from 'three';
import { buildScene } from './scene.js';
import { PHYS, WEAPONS, GRENADE, ECONOMY } from './config.js';
import { BOXES, SITES } from './mapdata.js';
import { createActor, attachMesh, syncMesh, eyePos, eyeHeight, applyDamage, rayHitsBox, bodyBox, headBox, TEAM_ATTACK } from './actors.js';
import { raycast, moveBody } from './physics.js';
import { damageFor, Weapon } from './weapons.js';
import { Input, updatePlayer } from './player.js';
import { makeBrain, botThink } from './bots.js';
import { Match } from './rounds.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Fx } from './fx.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed')) || 20261116;
const rng = mulberry32(SEED);
const STEP = 1 / 60;

const container = document.getElementById('game');
const { renderer, scene, camera } = buildScene(container);
const fx = new Fx(scene);
fx.attachCamera(camera);
const audio = new Audio();
const input = new Input();

// ---- actors -----------------------------------------------------------
const actors = [];
const player = createActor({ id: 0, name: 'You', team: TEAM_ATTACK, x: 0, z: 41 });
player.noMesh = true; // first-person: hide the player body
player.money = ECONOMY.startMoney;
actors.push(player);
const BOT_NAMES_A = ['Drift', 'Mako', 'Rivet', 'Talon'];
const BOT_NAMES_D = ['Anvil', 'Cinder', 'Fathom', 'Pike'];
let id = 1;
for (let i = 0; i < 8; i++) {
  const team = i < 4 ? TEAM_ATTACK : 'defend';
  const name = i < 4 ? BOT_NAMES_A[i] : BOT_NAMES_D[i - 4];
  const a = createActor({
    id, name, team,
    isBot: true, x: 0, z: team === TEAM_ATTACK ? 39 : -41,
  });
  a.money = ECONOMY.startMoney;
  a.brain = makeBrain(a, team === TEAM_ATTACK ? i : i - 4, rng);
  actors.push(a);
  id += 1;
}

for (const a of actors) attachMesh(a, scene);

const game = {
  simTime: 0,
  actors,
  player,
  fx,
  audio,
  hud: null,
  buyMenuOpen: false,
  frozen: true,
  throwingGrenade: false,
  match: null,
  grenades: [],
  rayHit: null,
  camera,
  scene,
};

// ---- shared combat ----------------------------------------------------
const _eye = { x: 0, y: 0, z: 0 };
const _bodyBox = {}; const _headBox = {};

function aimDir(yaw, pitch, spread, r1, r2, out) {
  // cone sample around the aim vector; pitch positive looks up
  const cp = Math.cos(pitch);
  const dx = Math.sin(yaw) * cp;
  const dy = Math.sin(pitch);
  const dz = Math.cos(yaw) * cp;
  const a = r1 * Math.PI * 2;
  const r = spread * Math.sqrt(r2);
  // build a tangent frame
  const ux = Math.cos(yaw), uy = 0, uz = -Math.sin(yaw);
  const vx = -Math.sin(yaw) * Math.sin(pitch), vy = Math.cos(pitch), vz = -Math.cos(yaw) * Math.sin(pitch);
  out[0] = dx + (ux * Math.cos(a) + vx * Math.sin(a)) * r;
  out[1] = dy + (uy * Math.cos(a) + vy * Math.sin(a)) * r;
  out[2] = dz + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
  const len = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= len; out[1] /= len; out[2] /= len;
}

const _dir = [0, 0, 0];

game.fireWeapon = function (actor, t) {
  const w = actor.weapon;
  const base = w.fire(t);
  if (base < 0) {
    if (!actor.isBot && w.ammo === 0 && !w.reloading) w.startReload(t);
    return;
  }
  const speed = Math.hypot(actor.vel.x, actor.vel.z);
  const extra = actor.isBot ? 0.012 : 0; // bots aim slightly looser than a laser
  const spread = w.spreadFor(speed, actor.crouched, !actor.grounded) + extra;
  eyePos(actor, _eye);
  aimDir(actor.yaw, actor.pitch || 0, spread, rng(), rng(), _dir);
  actor.lastShotAt = t;

  const maxT = 200;
  const mapHit = raycast(_eye.x, _eye.y, _eye.z, _dir[0], _dir[1], _dir[2], maxT);
  const tMap = mapHit ? mapHit.t : maxT;

  let hitActor = null;
  let hitHead = false;
  let tBest = tMap;
  for (const e of actors) {
    if (e === actor || !e.alive || e.team === actor.team) continue;
    const th = rayHitsBox(_eye.x, _eye.y, _eye.z, _dir[0], _dir[1], _dir[2], headBox(e, _headBox), tBest);
    if (th > 0) { tBest = th; hitActor = e; hitHead = true; continue; }
    const tb = rayHitsBox(_eye.x, _eye.y, _eye.z, _dir[0], _dir[1], _dir[2], bodyBox(e, _bodyBox), tBest);
    if (tb > 0) { tBest = tb; hitActor = e; hitHead = false; }
  }

  const hx = _eye.x + _dir[0] * tBest;
  const hy = _eye.y + _dir[1] * tBest;
  const hz = _eye.z + _dir[2] * tBest;
  fx.tracer(_eye, { x: hx, y: hy, z: hz }, t + 0.05);
  if (actor === player) {
    fx.muzzleFlash(t);
    player.pitch += w.def.recoil * 0.6;
    audio.shot(w.def.kind, 1);
  } else {
    const dist = Math.hypot(actor.pos.x - player.pos.x, actor.pos.z - player.pos.z);
    audio.shot(w.def.kind, Math.max(0.05, 1 - dist / 60));
  }

  if (hitActor) {
    const dmg = damageFor(w.def, tBest, hitHead);
    fx.sparksAt(hx, hy, hz, hitHead ? 10 : 6);
    const killed = applyDamage(hitActor, dmg, actor.team, t);
    if (actor === player) { game.hud.hit(hitHead); audio.hitmarker(hitHead); }
    if (killed) {
      actor.kills += 1;
      actor.money = Math.min(actor.money + ECONOMY.kill, ECONOMY.maxMoney);
      game.hud.killFeed(actor.name, hitActor.name, hitHead, w.def.name);
    }
  } else if (mapHit && tBest === mapHit.t) {
    fx.sparksAt(hx, hy, hz, 4);
  }
};

game.damageActor = function (actor, amount, fromTeam, t, head) {
  const killed = applyDamage(actor, amount, fromTeam, t);
  return killed;
};

// ---- the charge -------------------------------------------------------
const bombMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.22, 0.34),
  new THREE.MeshLambertMaterial({ color: 0x8a2a20 }),
);
const bombGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), new THREE.MeshBasicMaterial({ color: 0xff5030 }));
bombMesh.add(bombGlow);
bombMesh.visible = false;
scene.add(bombMesh);
const bombRing = new THREE.Mesh(
  new THREE.RingGeometry(4.4, 5.0, 40),
  new THREE.MeshBasicMaterial({ color: 0xd04030, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
);
bombRing.rotation.x = -Math.PI / 2;
bombRing.visible = false;
scene.add(bombRing);

game.pickUpBomb = function (actor) {
  game.bomb.carrier = actor;
  game.bomb.dropped = false;
  game.hud.announce(`${actor.name} has the charge`, '');
};
game.dropBomb = function (pos) {
  game.bomb.carrier = null;
  game.bomb.dropped = true;
  game.bomb.x = pos.x; game.bomb.z = pos.z; game.bomb.y = 0;
};

function syncBomb(t) {
  const b = game.bomb;
  if (b.carrier && !b.carrier.alive) {
    game.dropBomb(b.carrier.pos);
    b.carrier = null;
  }
  if (b.planted) {
    bombMesh.visible = true;
    bombMesh.position.set(b.x, b.y + 0.11, b.z);
    bombGlow.material.color.setHex(Math.sin(t * 9) > 0 ? 0xff5030 : 0x501010);
    bombRing.visible = true;
    bombRing.position.set(b.x, b.y + 0.06, b.z);
    game.hud.setBombPlanted(SITES[b.site] ? SITES[b.site].name : '?');
  } else if (b.dropped) {
    bombMesh.visible = true;
    bombMesh.position.set(b.x, 0.11, b.z);
    bombRing.visible = false;
    game.hud.clearBomb();
  } else {
    bombMesh.visible = false;
    bombRing.visible = false;
    game.hud.clearBomb();
  }
}

// ---- grenades ---------------------------------------------------------
const grenadeGeo = new THREE.BoxGeometry(0.14, 0.2, 0.14);
const grenadeMat = new THREE.MeshLambertMaterial({ color: 0x355040 });

game.throwGrenade = function (actor, t) {
  if (actor.grenades <= 0) return;
  actor.grenades -= 1;
  game.throwingGrenade = true;
  setTimeout(() => { game.throwingGrenade = false; }, 600);
  eyePos(actor, _eye);
  aimDir(actor.yaw, (actor.pitch || 0) + 0.12, 0, 0.5, 0.5, _dir);
  const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
  mesh.position.set(_eye.x, _eye.y, _eye.z);
  scene.add(mesh);
  game.grenades.push({
    mesh,
    x: _eye.x, y: _eye.y, z: _eye.z,
    vx: _dir[0] * GRENADE.throwSpeed + actor.vel.x,
    vy: _dir[1] * GRENADE.throwSpeed + 2,
    vz: _dir[2] * GRENADE.throwSpeed + actor.vel.z,
    explodeAt: t + GRENADE.fuse,
  });
};

function updateGrenades(t, dt) {
  for (let i = game.grenades.length - 1; i >= 0; i--) {
    const g = game.grenades[i];
    g.vy -= PHYS.gravity * dt;
    const pos = { x: g.x, y: g.y, z: g.z };
    moveBody(pos, { x: g.vx * dt, y: g.vy * dt, z: g.vz * dt }, 0.1, 0.2, 0);
    g.x = pos.x; g.y = pos.y; g.z = pos.z;
    if (g.y <= 0.1 && g.vy < 0) { g.vy = -g.vy * 0.35; g.vx *= 0.6; g.vz *= 0.6; }
    g.mesh.position.set(g.x, g.y + 0.1, g.z);
    g.mesh.rotation.x += dt * 6;
    if (t >= g.explodeAt) {
      scene.remove(g.mesh);
      game.grenades.splice(i, 1);
      audio.explosion(g.x, g.z);
      fx.explosion(g.x, g.y, g.z);
      for (const a of actors) {
        if (!a.alive) continue;
        const d = Math.hypot(a.pos.x - g.x, (a.pos.y + 0.9) - g.y, a.pos.z - g.z);
        if (d < GRENADE.radius) {
          const dmg = Math.round(GRENADE.damage * (1 - d / GRENADE.radius));
          game.fireGrenadeDamage(a, dmg);
        }
      }
    }
  }
}

game.fireGrenadeDamage = function (a, dmg) {
  applyDamage(a, dmg, player.team, game.simTime);
  if (a === player) game.hud.setVitals(player.health, player.armor);
};

// ---- camera + viewmodel ----------------------------------------------
const viewGun = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.5), new THREE.MeshLambertMaterial({ color: 0x454f58 }));
  body.position.set(0, 0, -0.25);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), new THREE.MeshLambertMaterial({ color: 0x2e353c }));
  grip.position.set(0, -0.1, -0.06);
  const magBox = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.05), new THREE.MeshLambertMaterial({ color: 0x353d45 }));
  magBox.position.set(0, -0.11, -0.16);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.02), new THREE.MeshBasicMaterial({ color: 0xe07030 }));
  sight.position.set(0, 0.065, -0.32);
  viewGun.add(body, grip, magBox, sight);
  viewGun.position.set(0.22, -0.18, -0.35);
  camera.add(viewGun);
  game.scene.add(camera); // camera children (viewmodel, muzzle flash) only render when the camera is in the graph
}

const _camPos = { x: 0, y: 0, z: 0 };
function updateCamera(t) {
  eyePos(player, _camPos);
  const recoilKick = player.weapon.recoilPitch;
  camera.position.set(_camPos.x, _camPos.y, _camPos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw + player.weapon.recoilYaw * 0.5;
  camera.rotation.x = player.pitch + recoilKick;
  const bob = player.grounded && !player.crouched ? Math.sin(t * 11) * Math.min(player.speedNow * 0.0016, 0.012) : 0;
  camera.position.y += bob;
  const w = player.weapon;
  const sway = Math.min(Math.hypot(player.vel.x, player.vel.z) * 0.004, 0.03);
  viewGun.rotation.x = -recoilKick * 2.2 + sway;
  viewGun.position.z = -0.35 + sway * 0.5;
}

// ---- buy menu ---------------------------------------------------------
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');

function tryBuy(key) {
  const money = player.money;
  if (key === 'grenade') {
    if (money >= GRENADE.price && player.grenades < 2) { player.money -= GRENADE.price; player.grenades += 1; }
  } else if (key === 'armor') {
    if (money >= 650 && player.armor < 100) { player.money -= 650; player.armor = 100; }
  } else if (key === 'kit') {
    if (money >= 400 && !player.hasKit) { player.money -= 400; player.hasKit = true; }
  } else if (WEAPONS[key]) {
    const price = WEAPONS[key].price;
    if (money >= price) {
      player.money -= price;
      player.primaryKey = key;
      player.weapon = new Weapon(key);
      audio.reload();
    }
  }
  refreshHud();
  if (game.buyMenuOpen) game.hud.openBuy(player.money, !game.frozen);
}

game.hud = new Hud(tryBuy, closeBuyMenu);
game.match = new Match(game, actors, rng);
game.bomb = game.match.bomb;
game.plantBomb = (a, t) => game.match.plantBomb(a, t);
game.defuseBomb = (a, t) => game.match.defuseBomb(a, t);

function openBuyMenu() {
  game.buyMenuOpen = true;
  game.hud.openBuy(player.money, !game.frozen || game.match.phase === 'freeze');
  document.exitPointerLock();
}
function closeBuyMenu() {
  game.buyMenuOpen = false;
  game.hud.closeBuy();
  renderer.domElement.requestPointerLock();
}
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') {
    if (game.buyMenuOpen) closeBuyMenu();
    else if (document.pointerLockElement) openBuyMenu();
  }
  if (e.code === 'Escape' && game.buyMenuOpen) closeBuyMenu();
});
playBtn.addEventListener('click', () => {
  overlay.hidden = true;
  audio.ensure();
  audio.resume();
  renderer.domElement.requestPointerLock();
});

// ---- HUD refresh ------------------------------------------------------
function refreshHud() {
  const m = game.match;
  game.hud.setAmmo(player.weapon.ammo, player.weapon.reserve);
  game.hud.setWeapon(player.weapon, player.grenades);
  game.hud.setVitals(player.health, player.armor);
  game.hud.setMoney(player.money);
  game.hud.setScore(m.score.attack, m.score.defend);
}

// ---- simulation step --------------------------------------------------
function step(dt) {
  const t = game.simTime;
  const m = game.match;
  game.frozen = m.phase === 'freeze';

  if (m.phase !== 'matchover') m.update(t, dt);

  for (const a of actors) {
    if (!a.alive) continue;
    if (a.isBot && !game.frozen && m.phase === 'live') {
      botThink(a, game, t, dt);
      if (a.weapon.finishReload(t)) {}
      a.vel.y -= PHYS.gravity * dt;
      a.grounded = moveBody(a.pos, { x: a.vel.x * dt, y: a.vel.y * dt, z: a.vel.z * dt }, PHYS.radius, a.crouched ? PHYS.crouchHeight : PHYS.height, PHYS.stepHeight);
      if (a.grounded && a.vel.y < 0) a.vel.y = 0;
      a.pos.x = Math.max(-44, Math.min(44, a.pos.x));
      a.pos.z = Math.max(-44, Math.min(44, a.pos.z));
      a.weapon.decayRecoil(dt);
      const sp = Math.hypot(a.vel.x, a.vel.z);
      a.crouched = sp < 0.5 && a.brain.state !== 'engage' && a.brain.rng() < 0.5;
      a.speedNow = sp;
    }
    syncMesh(a);
  }

  updatePlayer(player, input, game, t, dt, !!document.pointerLockElement);
  player.speedNow = Math.hypot(player.vel.x, player.vel.z);
  player.weapon.decayRecoil(dt);
  syncMesh(player);

  syncBomb(t);
  updateGrenades(t, dt);
  fx.update(t, dt);
}

// ---- main loop --------------------------------------------------------
let acc = 0;
let lastFrame = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  acc += dt;
  while (acc >= STEP) {
    game.simTime += STEP;
    step(STEP);
    acc -= STEP;
  }

  updateCamera(game.simTime);
  const m = game.match;
  game.hud.setTimer(m.timeLeft(game.simTime), m.phase);
  document.getElementById('phase-label').textContent = m.phase === 'freeze' ? 'buy time' : m.phase === 'end' ? 'round over' : m.bomb.planted ? 'armed' : 'live';
  refreshHud();
  game.hud.update(now / 1000);
  renderer.render(scene, camera);
}

// ---- screenshot staging (?shot=<kind>) --------------------------------
// Deterministic poses of real game state: the match is set up (positions, weapons,
// HUD, fx), actors are held still, and one frame is rendered for capture.
function poseScene(kind) {
  const m = game.match;
  overlay.hidden = true;

  const place = (a, x, z, yaw) => {
    a.pos.x = x; a.pos.z = z; a.pos.y = 0; a.yaw = yaw;
    a.vel.x = 0; a.vel.y = 0; a.vel.z = 0;
    a.alive = true; a.health = 100; a.crouched = false; a.isBot = false;
    syncMesh(a);
  };

  if (kind === 'lane') {
    m.score.attack = 3; m.score.defend = 2; m.roundNum = 6;
    m.phase = 'live'; m.phaseEndsAt = game.simTime + 52; m.bomb.planted = false;
    place(player, Number(params.get('px') || 0), Number(params.get('pz') || 28), Number(params.get('yaw') || 3.53));
    player.pitch = Number(params.get('pitch') || 0);
    player.health = 78; player.armor = 50; player.money = 3050;
    player.primaryKey = 'rifle';
    player.weapon = new Weapon('rifle');
    player.weapon.ammo = 17; player.weapon.reserve = 63;
    player.grenades = 1;
    place(actors[1], 9, 22, 2.8); // Drift ahead left
    place(actors[2], -6, 12, 2.6); // Mako behind left
    place(actors[5], -17, -13, 1.9); // Anvil, defender holding the A approach
    place(actors[6], -29, -25, 2.9); // Cinder on site A
    // Anvil fires at the player — incoming tracer reads as a streak in a still
    fx.tracer({ x: -17, y: 1.5, z: -13 }, { x: 0.4, y: 1.6, z: 27.6 }, game.simTime + 0.06);
    fx.sparksAt(-17, 1.4, -13, 6);
  } else if (kind === 'firefight') {
    m.score.attack = 3; m.score.defend = 3; m.roundNum = 7;
    m.phase = 'live'; m.phaseEndsAt = game.simTime + 21;
    place(player, -26, -30, 4.41); // on site A, eye on the enemy
    player.health = 64; player.armor = 25; player.money = 5400;
    player.primaryKey = 'carbine';
    player.weapon = new Weapon('carbine');
    player.weapon.ammo = 9; player.weapon.reserve = 60;
    player.pitch = 0.02;
    place(actors[1], -34, -33, 5.0); // teammate covering
    place(actors[5], -36, -33, 1.2); // Anvil at the site edge, crouched cover
    actors[5].crouched = true;
    place(actors[6], -22, -18, 3.1); // Cinder pushing through mid
    fx.tracer({ x: -39, y: 1.4, z: -36 }, { x: -30, y: 1.2, z: -34 }, game.simTime + 0.06);
    fx.muzzleFlash(game.simTime, 0.5);
    game.hud.hit(true);
    game.hud.killFeed('Drift', 'Fathom', false, 'Vulture Rifle');
    game.hud.killFeed('You', 'Pike', true, 'Sentinel Carbine');
  } else if (kind === 'buymenu') {
    m.phase = 'freeze'; m.phaseEndsAt = game.simTime + 6; m.score.attack = 3; m.score.defend = 2;
    place(player, 0, 41, Math.PI);
    player.money = 5400; player.armor = 0; player.grenades = 0;
    player.primaryKey = 'sidearm';
    player.weapon = new Weapon('sidearm');
    game.hud.openBuy(player.money, true);
    game.hud.announce('Round 6', 'Buy your gear — B opens the buy menu', 60);
  } else if (kind === 'armed') {
    m.score.attack = 4; m.score.defend = 3; m.roundNum = 8;
    m.phase = 'live'; m.phaseEndsAt = game.simTime + 99;
    game.bomb.planted = true; game.bomb.site = 0;
    game.bomb.x = -30; game.bomb.z = -28; game.bomb.y = 0;
    game.bomb.plantedAt = game.simTime - 12;
    place(player, -18, -24, 4.39); // rotating back to the armed charge
    player.health = 100; player.armor = 100; player.money = 8450;
    player.primaryKey = 'sniper';
    player.weapon = new Weapon('sniper');
    player.weapon.ammo = 5; player.weapon.reserve = 15;
    place(actors[5], -32, -34, 5.6); // defender moving to defuse
    place(actors[7], -26, -16, 3.4);
    syncBomb(game.simTime);
    game.hud.setBombPlanted('A');
    game.hud.announce('Charge armed at site A', 'Defenders: get on the charge', 60);
  }

  // settle a few steps so meshes and fx are coherent, then render one frame
  for (let i = 0; i < 3; i++) {
    game.simTime += STEP;
    step(STEP);
  }
  game.hud.announce('', '', 0); // clear any lingering round-start banner
  updateCamera(game.simTime);
  const t = game.simTime;
  game.hud.setTimer(m.timeLeft(t), m.phase);
  document.getElementById('phase-label').textContent = m.phase === 'freeze' ? 'buy time' : m.bomb.planted ? 'armed' : 'live';
  refreshHud();
  game.hud.update(t);
  renderer.render(scene, camera);
}

// exposed for QA/headless probes
window.game = game;

const shotMode = params.get('shot');
if (shotMode) {
  poseScene(shotMode);
} else {
  refreshHud();
  requestAnimationFrame(frame);
}
