// SALTDOWN — bot AI: waypoint pathfinding (BFS over the graph), per-role plans,
// engagement with reaction delay, hearing, holding angles, planting and defusing.
import { WAYPOINTS, EDGES, SITES, SPAWNS, TEAM_PLAN } from './mapdata.js';
import { eyePos, eyeHeight } from './actors.js';
import { hasLineOfSight } from './physics.js';
import { PHYS } from './config.js';

const ADJ = (() => {
  const adj = WAYPOINTS.map(() => []);
  for (const [a, b] of EDGES) { adj[a].push(b); adj[b].push(a); }
  return adj;
})();

const _queue = new Int32Array(WAYPOINTS.length);
const _prev = new Int32Array(WAYPOINTS.length);

function nearestNode(x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = (WAYPOINTS[i].x - x) ** 2 + (WAYPOINTS[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function findPath(fromX, fromZ, toNode) {
  const start = nearestNode(fromX, fromZ);
  _prev.fill(-1);
  let head = 0, tail = 0;
  _queue[tail++] = start;
  _prev[start] = start;
  while (head < tail) {
    const cur = _queue[head++];
    if (cur === toNode) break;
    for (const nb of ADJ[cur]) {
      if (_prev[nb] === -1) { _prev[nb] = cur; _queue[tail++] = nb; }
    }
  }
  if (start === toNode || _prev[toNode] === -1) return [toNode];
  const path = [];
  let n = toNode;
  while (n !== start) { path.push(n); n = _prev[n]; }
  path.reverse();
  return path;
}

// ---- bot brain -------------------------------------------------------
// states: 'move' (follow path), 'hold' (watch an angle at a post), 'engage',
// 'plant', 'defuse'
export function makeBrain(actor, roleIndex, rng) {
  return {
    state: 'move',
    path: [],
    pathI: 0,
    targetSite: TEAM_PLAN[actor.team][roleIndex % TEAM_PLAN[actor.team].length],
    holdNode: -1,
    holdYaw: 0,
    reactAt: -1,
    engageTarget: null,
    nextThink: 0,
    burstUntil: 0,
    nextBurstAt: 0,
    strafeDir: 0,
    strafeUntil: 0,
    actionUntil: 0,
    alertedAt: -1,
    rng,
  };
}

function seeEnemy(bot, enemies, t) {
  const ex = bot.pos.x, ey = bot.pos.y + eyeHeight(bot), ez = bot.pos.z;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.pos.x - ex, dz = e.pos.z - ez;
    const dist = Math.hypot(dx, dz);
    if (dist > 55) continue;
    // ~100 degree forward cone
    const fx = Math.sin(bot.yaw), fz = Math.cos(bot.yaw);
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dot < -0.15) continue;
    const ty = e.pos.y + (e.crouched ? 0.8 : 1.3);
    if (!hasLineOfSight(ex, ey, ez, e.pos.x, ty, e.pos.z)) continue;
    return e;
  }
  return null;
}

function repath(bot, toNode) {
  bot.brain.path = findPath(bot.pos.x, bot.pos.z, toNode);
  bot.brain.pathI = 0;
}

export function botThink(bot, game, t, dt) {
  const brain = bot.brain;
  const enemies = game.actors.filter((a) => a.team !== bot.team);
  const mates = game.actors.filter((a) => a.team === bot.team);

  // perception (runs every step but the LOS loop is cheap at this scale)
  const seen = bot.alive ? seeEnemy(bot, enemies, t) : null;
  if (seen && brain.engageTarget !== seen) {
    brain.engageTarget = seen;
    if (brain.reactAt < 0) brain.reactAt = t + 0.22 + brain.rng() * 0.3;
  } else if (!seen) {
    brain.engageTarget = null;
    brain.reactAt = -1;
  }

  // hearing: recent enemy gunfire nearby raises alertness
  for (const e of enemies) {
    if (e.lastShotAt > t - 1 && Math.hypot(e.pos.x - bot.pos.x, e.pos.z - bot.pos.z) < 28) {
      if (brain.alertedAt < t - 2) {
        brain.alertedAt = t;
        if (brain.state === 'hold') {
          bot.yaw = Math.atan2(e.pos.x - bot.pos.x, e.pos.z - bot.pos.z);
        }
      }
    }
  }

  if (!bot.alive) return;

  // the charge comes first when the carrier is standing on a site and no enemy is close
  const b = game.bomb;
  if (b.carrier === bot && !b.planted && game.match.phase === 'live') {
    const site = SITES[brain.targetSite];
    const nearSite = Math.hypot(bot.pos.x - site.x, bot.pos.z - site.z) < site.radius;
    const threat = brain.engageTarget && brain.engageTarget.alive &&
      Math.hypot(brain.engageTarget.pos.x - bot.pos.x, brain.engageTarget.pos.z - bot.pos.z) < 10;
    if (nearSite && !threat) {
      if (brain.state !== 'plant') { brain.state = 'plant'; brain.actionUntil = t + 4; }
      return;
    }
  }

  if (brain.engageTarget && brain.engageTarget.alive) {
    brain.state = 'engage';
  } else if (brain.state === 'engage') {
    brain.state = 'move';
    brain.reactAt = -1;
    repath(bot, brain.targetSite === 0 ? 10 : 19);
  }

  switch (brain.state) {
    case 'move': return thinkMove(bot, game, brain, t, dt);
    case 'hold': return thinkHold(bot, game, brain, t, dt);
    case 'engage': return thinkEngage(bot, game, brain, t, dt);
    case 'plant': return thinkPlant(bot, game, brain, t, dt);
    case 'defuse': return thinkDefuse(bot, game, brain, t, dt);
  }
}

function arrive(bot, brain) {
  return brain.pathI >= brain.path.length;
}

function thinkMove(bot, game, brain, t, dt) {
  // a dropped charge is worth more than the site: go pick it up
  if (bot.team === 'attack' && game.bomb.dropped && !game.bomb.planted && brain.state === 'move') {
    const bx = game.bomb.x, bz = game.bomb.z;
    const d = Math.hypot(bx - bot.pos.x, bz - bot.pos.z);
    if (d < 1.3) {
      game.pickUpBomb(bot);
      return;
    }
    if (d < 12 && hasLineOfSight(bot.pos.x, bot.pos.y + 0.9, bot.pos.z, bx, 0.5, bz)) {
      steer(bot, (bx - bot.pos.x) / d, (bz - bot.pos.z) / d, PHYS.maxSpeed, dt);
      bot.yaw = Math.atan2(bx - bot.pos.x, bz - bot.pos.z);
      return;
    }
    if (arrive(bot, brain)) repath(bot, nearestNode(bx, bz));
    followPath(bot, brain, t, dt);
    return;
  }
  if (arrive(bot, brain) || brain.path.length === 0) {
    // reached objective node
    if (bot.team === 'attack' && game.bomb.carrier === bot && !game.bomb.planted) {
      const site = SITES[brain.targetSite];
      if (Math.hypot(bot.pos.x - site.x, bot.pos.z - site.z) < site.radius) {
        brain.state = 'plant';
        brain.actionUntil = t + 4;
        return;
      }
      repath(bot, brain.targetSite === 0 ? 10 : 19);
      return;
    }
    if (bot.team === 'attack' && game.bomb.planted) {
      brain.state = 'hold';
      brain.holdNode = nearestNode(bot.pos.x, bot.pos.z);
      brain.holdYaw = bot.yaw;
      return;
    }
    if (bot.team === 'defend') {
      if (game.bomb.planted && game.bomb.site === brain.targetSite) {
        const site = SITES[game.bomb.site];
        if (Math.hypot(bot.pos.x - site.x, bot.pos.z - site.z) < site.radius) {
          brain.state = 'defuse';
          brain.actionUntil = t + (bot.hasKit ? 5 : 7);
          return;
        }
        repath(bot, game.bomb.site === 0 ? 10 : 19);
        return;
      }
      brain.state = 'hold';
      const site = SITES[brain.targetSite];
      brain.holdNode = nearestNode(site.x, site.z);
      brain.pathI = 0;
      brain.path = [];
      // pick a watch angle toward the likely approach
      const from = brain.targetSite === 0 ? WAYPOINTS[9] : WAYPOINTS[14];
      brain.holdYaw = Math.atan2(from.x - site.x, from.z - site.z);
      return;
    }
    // attacker without the charge: push the same assigned site until the charge is down
    if (bot.team === 'attack' && !game.bomb.planted) {
      repath(bot, brain.targetSite === 0 ? 10 : 19);
      return;
    }
    // otherwise hold near where we stand
    brain.state = 'hold';
    brain.holdNode = nearestNode(bot.pos.x, bot.pos.z);
    return;
  }
  followPath(bot, brain, t, dt);
}

function thinkHold(bot, game, brain, t, dt) {
  // path to the hold post first, then stand watching the angle
  if (brain.holdNode >= 0) {
    const wp = WAYPOINTS[brain.holdNode];
    const dx = wp.x - bot.pos.x, dz = wp.z - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2) {
      if (brain.pathI >= brain.path.length) repath(bot, brain.holdNode);
      followPath(bot, brain, t, dt);
      if (bot.weapon.ammo < bot.weapon.def.mag && !bot.weapon.reloading && bot.weapon.reserve > 0) bot.weapon.startReload(t);
      return;
    }
    bot.vel.x *= 0.8; bot.vel.z *= 0.8;
    bot.yaw = brain.holdYaw;
    // occasionally re-scan angles
    if (t > brain.nextThink) {
      brain.nextThink = t + 3 + brain.rng() * 2;
      brain.holdYaw += (brain.rng() - 0.5) * 0.6;
    }
  }
}

function thinkEngage(bot, game, brain, t, dt) {
  const e = brain.engageTarget;
  if (!e || !e.alive) return;
  const dx = e.pos.x - bot.pos.x, dz = e.pos.z - bot.pos.z;
  const dist = Math.max(Math.hypot(dx, dz), 0.01);
  bot.yaw = Math.atan2(dx, dz);
  bot.pitch = Math.atan2(e.pos.y + 1.3 - (bot.pos.y + eyeHeight(bot)), dist);

  if (t < brain.reactAt) return; // reaction delay before the trigger

  // strafe while shooting at mid range, close in when far, back off when very close
  if (t > brain.strafeUntil) {
    brain.strafeUntil = t + 0.6 + brain.rng() * 0.8;
    brain.strafeDir = brain.rng() < 0.5 ? -1 : 1;
  }
  const fx = dx / dist, fz = dz / dist;
  const sniper = bot.weapon.def.kind === 'sniper';
  if (dist > (sniper ? 24 : 14)) {
    steer(bot, fx, fz, PHYS.maxSpeed * 0.8, dt);
  } else if (dist < 5) {
    steer(bot, -fx, -fz, PHYS.maxSpeed * 0.7, dt);
  } else {
    steer(bot, fz * brain.strafeDir, -fx * brain.strafeDir, PHYS.maxSpeed * 0.55, dt);
  }

  // fire in bursts
  if (t >= brain.nextBurstAt && bot.weapon.canFire(t)) {
    brain.burstUntil = t + (sniper ? 0.15 : 0.3 + brain.rng() * 0.4);
    brain.nextBurstAt = brain.burstUntil + 0.25 + brain.rng() * 0.5;
  }
  if (t < brain.burstUntil && bot.weapon.canFire(t)) {
    game.fireWeapon(bot, t);
  }
  if (bot.weapon.ammo === 0) bot.weapon.startReload(t);
}

function thinkPlant(bot, game, brain, t, dt) {
  bot.vel.x = 0; bot.vel.z = 0;
  if (t >= brain.actionUntil) {
    game.plantBomb(bot, t);
    if (game.bomb.planted) {
      brain.state = 'hold';
      brain.holdNode = nearestNode(bot.pos.x, bot.pos.z);
      brain.holdYaw = bot.yaw;
    } else {
      // drifted off the site: walk back on and try again
      brain.state = 'move';
      repath(bot, brain.targetSite === 0 ? 10 : 19);
    }
  }
}

function thinkDefuse(bot, game, brain, t, dt) {
  bot.vel.x *= 0.85; bot.vel.z *= 0.85;
  if (!game.bomb.planted) { brain.state = 'move'; return; }
  if (t >= brain.actionUntil) game.defuseBomb(bot, t);
}

function followPath(bot, brain, t, dt) {
  if (brain.pathI >= brain.path.length) return;
  const wp = WAYPOINTS[brain.path[brain.pathI]];
  const dx = wp.x - bot.pos.x, dz = wp.z - bot.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.4) { brain.pathI += 1; return; }
  steer(bot, dx / d, dz / d, PHYS.maxSpeed, dt);
  bot.yaw = Math.atan2(dx, dz);
  // stuck behind geometry: sidestep and try again shortly
  if (brain.stuckCheckAt === undefined) { brain.stuckCheckAt = t + 1; brain.stuckX = bot.pos.x; brain.stuckZ = bot.pos.z; }
  if (t > brain.stuckCheckAt) {
    if (Math.hypot(bot.pos.x - brain.stuckX, bot.pos.z - brain.stuckZ) < 0.35) {
      brain.pathI = Math.max(0, brain.pathI - 1);
      bot.vel.x += (brain.rng() - 0.5) * 6;
      bot.vel.z += (brain.rng() - 0.5) * 6;
    }
    brain.stuckX = bot.pos.x; brain.stuckZ = bot.pos.z; brain.stuckCheckAt = t + 1;
  }
  if (bot.weapon.ammo < bot.weapon.def.mag * 0.4 && !bot.weapon.reloading && bot.weapon.reserve > 0) {
    bot.weapon.startReload(t);
  }
}

function steer(bot, dx, dz, speed, dt) {
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
  bot.vel.x += dx * PHYS.accel * dt;
  bot.vel.z += dz * PHYS.accel * dt;
  const sp = Math.hypot(bot.vel.x, bot.vel.z);
  if (sp > speed) { bot.vel.x *= speed / sp; bot.vel.z *= speed / sp; }
}

// Economy: bots buy sensibly at round start.
export function botBuy(bot) {
  if (!bot.primaryKey || bot.primaryKey === 'sidearm') {
    if (bot.money >= 2700) { bot.primaryKey = bot.brain.rng() < 0.5 ? 'rifle' : 'carbine'; bot.money -= 2700; }
    else if (bot.money >= 1250) { bot.primaryKey = 'smg'; bot.money -= 1250; }
  }
  if (bot.money >= 1000 && bot.armor === 0) { bot.armor = 100; bot.money -= 650; }
  if (bot.team === 'defend' && bot.money >= 400 && !bot.hasKit) { bot.hasKit = true; bot.money -= 400; }
  if (bot.money >= 300 && bot.grenades < 1) { bot.grenades = 1; bot.money -= 300; }
}
