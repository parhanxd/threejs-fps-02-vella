// SALTDOWN — combatants: one shape for the local player and every bot, so rounds, damage,
// bullets and the HUD read the same fields. Mesh building and hitboxes live here too.
import * as THREE from 'three';
import { PHYS } from './config.js';
import { Weapon } from './weapons.js';
import { makeActorMeshes } from './scene.js';

export const TEAM_ATTACK = 'attack';
export const TEAM_DEFEND = 'defend';

export function createActor(opts) {
  const a = {
    id: opts.id,
    name: opts.name,
    team: opts.team,
    isBot: !!opts.isBot,
    pos: { x: opts.x, y: 0, z: opts.z },
    vel: { x: 0, y: 0, z: 0 },
    yaw: opts.yaw || 0,
    pitch: 0,
    health: 100,
    armor: 0,
    alive: true,
    crouched: false,
    grounded: true,
    speed: 0,
    weapon: new Weapon('sidearm'),
    primaryKey: null,
    grenades: 0,
    hasKit: false,
    lastDamageAt: -99,
    lastShotAt: -99,
    kills: 0,
    deaths: 0,
    mesh: null,
    headMesh: null,
    // bot-only fields
    brain: null,
  };
  return a;
}

export function attachMesh(actor, scene, scale = 1) {
  const color = actor.team === TEAM_ATTACK ? 0xb98a4a : 0x4a6f8a;
  const accent = actor.team === TEAM_ATTACK ? 0xc05040 : 0x3f9fd8;
  const { group, head, torso } = makeActorMeshes(scene, color, scale, accent);
  scene.add(group);
  actor.mesh = group;
  actor.headMesh = head;
  actor.torsoMesh = torso;
  return group;
}

export function actorHeight(a) {
  return a.crouched ? PHYS.crouchHeight : PHYS.height;
}

export function eyeHeight(a) {
  return a.crouched ? PHYS.eyeCrouch : PHYS.eyeHeight;
}

export function eyePos(a, out) {
  out.x = a.pos.x; out.y = a.pos.y + eyeHeight(a); out.z = a.pos.z;
  return out;
}

// Body AABB for ray tests: torso from feet to chest, head box on top.
export function bodyBox(a, out) {
  const h = actorHeight(a);
  out.minX = a.pos.x - 0.28; out.maxX = a.pos.x + 0.28;
  out.minY = a.pos.y + 0.05; out.maxY = a.pos.y + h - 0.3;
  out.minZ = a.pos.z - 0.28; out.maxZ = a.pos.z + 0.28;
  return out;
}

export function headBox(a, out) {
  const h = actorHeight(a);
  out.minX = a.pos.x - 0.17; out.maxX = a.pos.x + 0.17;
  out.minY = a.pos.y + h - 0.32; out.maxY = a.pos.y + h + 0.04;
  out.minZ = a.pos.z - 0.17; out.maxZ = a.pos.z + 0.17;
  return out;
}

export function rayHitsBox(ox, oy, oz, dx, dy, dz, box, maxT) {
  let tmin = 0, tmax = maxT;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const mins = [box.minX, box.minY, box.minZ], maxs = [box.maxX, box.maxY, box.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return -1;
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (mins[i] - o[i]) * inv, t2 = (maxs[i] - o[i]) * inv;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (tmin <= 0) return -1;
  return tmin;
}

// Apply damage with armour absorbing 50% until it breaks. Returns true if this killed.
export function applyDamage(actor, amount, fromTeam, t) {
  if (!actor.alive || actor.team === fromTeam) return false;
  let dmg = amount;
  if (actor.armor > 0) {
    const absorbed = Math.min(actor.armor, Math.round(dmg * 0.5));
    actor.armor -= absorbed;
    dmg -= absorbed;
  }
  actor.health -= dmg;
  actor.lastDamageAt = t;
  if (actor.health <= 0) {
    actor.health = 0;
    actor.alive = false;
    actor.deaths += 1;
    if (actor.mesh) actor.mesh.visible = false;
    return true;
  }
  return false;
}

export function spawnReset(actor, spawn) {
  actor.pos.x = spawn.x; actor.pos.z = spawn.z; actor.pos.y = 0;
  actor.vel.x = 0; actor.vel.y = 0; actor.vel.z = 0;
  actor.health = 100;
  actor.alive = true;
  actor.crouched = false;
  if (spawn.yaw !== undefined) actor.yaw = spawn.yaw;
  actor.weapon = new Weapon(actor.primaryKey || 'sidearm');
  if (actor.mesh) actor.mesh.visible = true;
}

const _v = new THREE.Vector3();
export function syncMesh(actor) {
  if (!actor.mesh) return;
  actor.mesh.position.set(actor.pos.x, actor.pos.y, actor.pos.z);
  actor.mesh.rotation.y = actor.yaw;
  const crouchScale = actor.crouched ? 0.72 : 1;
  actor.mesh.scale.set(1, crouchScale, 1);
  // first-person player never sees their own body
  actor.mesh.visible = actor.alive && !actor.noMesh;
}
