// SALTDOWN — physics: AABB colliders from map data, swept movement with step-up,
// ray casts for bullets and line-of-sight. No allocations in the query paths.
import { BOXES } from './mapdata.js';

// Collider list: {minX,maxX,minY,maxY,minZ,maxZ}
const colliders = [];
for (const b of BOXES) {
  const y0 = b.y !== undefined ? b.y : 0;
  colliders.push({
    minX: b.x - b.w / 2, maxX: b.x + b.w / 2,
    minY: y0, maxY: y0 + b.h,
    minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2,
  });
}
export const COLLIDERS = colliders;

export function overlapsBox(a, c) {
  return a.minX < c.maxX && a.maxX > c.minX && a.minY < c.maxY && a.maxY > c.minY && a.minZ < c.maxZ && a.maxZ > c.minZ;
}

// Move an AABB body (half extents hx, height h with feet at pos.y) by delta, axis by axis,
// stepping up ledges below stepHeight. Mutates pos {x,y,z}; returns landed on ground this step.
export function moveBody(pos, delta, hx, height, stepHeight) {
  let grounded = false;
  const axes = [
    ['x', delta.x], ['z', delta.z], ['y', delta.y],
  ];
  for (const [axis, d] of axes) {
    if (d === 0) continue;
    pos[axis] += d;
    const box = {
      minX: pos.x - hx, maxX: pos.x + hx,
      minY: pos.y, maxY: pos.y + height,
      minZ: pos.z - hx, maxZ: pos.z + hx,
    };
    for (const c of colliders) {
      if (!overlapsBox(box, c)) continue;
      if (axis === 'y') {
        if (d < 0) { pos.y = c.maxY; grounded = true; }
        else pos.y = c.minY - height;
        box.minY = pos.y; box.maxY = pos.y + height;
      } else {
        // try to step up onto low obstacles
        const stepY = c.maxY;
        if (stepY - pos.y <= stepHeight && stepY > pos.y) {
          const lifted = {
            minX: box.minX, maxX: box.maxX,
            minY: stepY + 0.001, maxY: stepY + 0.001 + height,
            minZ: box.minZ, maxZ: box.maxZ,
          };
          let clear = true;
          for (const c2 of colliders) {
            if (c2 !== c && overlapsBox(lifted, c2)) { clear = false; break; }
          }
          if (clear) { pos.y = stepY + 0.001; grounded = true; box.minY = pos.y; box.maxY = pos.y + height; continue; }
        }
        pos[axis] = d > 0 ? c[axis === 'x' ? 'minX' : 'minZ'] - hx : c[axis === 'x' ? 'maxX' : 'maxZ'] + hx;
        box.minX = pos.x - hx; box.maxX = pos.x + hx;
        box.minZ = pos.z - hx; box.maxZ = pos.z + hx;
      }
    }
  }
  // ground probe: settle onto the highest collider directly under the body
  if (!grounded && delta.y <= 0) {
    const probe = {
      minX: pos.x - hx, maxX: pos.x + hx,
      minY: pos.y - 0.02, maxY: pos.y,
      minZ: pos.z - hx, maxZ: pos.z + hx,
    };
    for (const c of colliders) {
      if (overlapsBox(probe, c)) { pos.y = c.maxY; grounded = true; break; }
    }
  }
  if (pos.y < 0) { pos.y = 0; grounded = true; }
  return grounded;
}

// Ray vs all colliders + the ground plane. Returns nearest hit {t, x,y,z, nx,ny,nz} or null.
const _hit = { t: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0 };
export function raycast(ox, oy, oz, dx, dy, dz, maxT) {
  let bestT = maxT;
  let bestN = null;
  for (const c of colliders) {
    const r = raySlab(ox, oy, oz, dx, dy, dz, c, bestT);
    if (r) { bestT = r.t; bestN = r.n; }
  }
  if (dy < 0) { // ground plane y=0
    const t = -oy / dy;
    if (t > 0 && t < bestT) { bestT = t; bestN = 'up'; }
  }
  if (!bestN) return null;
  _hit.t = bestT;
  _hit.x = ox + dx * bestT; _hit.y = oy + dy * bestT; _hit.z = oz + dz * bestT;
  _hit.nx = bestN === 'up' ? 0 : bestN[0];
  _hit.ny = bestN === 'up' ? 1 : bestN[1];
  _hit.nz = bestN === 'up' ? 0 : bestN[2];
  return _hit;
}

// slab test, returns {t, n:[nx,ny,nz]} or null; writes into scratch to avoid allocation
const _slab = { t: 0, n: null };
function raySlab(ox, oy, oz, dx, dy, dz, c, maxT) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const mins = [c.minX, c.minY, c.minZ], maxs = [c.maxX, c.maxY, c.maxZ];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return null;
      continue;
    }
    const inv = 1 / d[i];
    let t1 = (mins[i] - o[i]) * inv;
    let t2 = (maxs[i] - o[i]) * inv;
    let sign = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sign; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmin <= 0 || tmin >= maxT) return null;
  const n = [0, 0, 0];
  if (nAxis >= 0) n[nAxis] = nSign;
  _slab.t = tmin; _slab.n = n;
  return _slab;
}

// Line of sight between two points against the map only.
export function hasLineOfSight(ax, ay, az, bx, by, bz) {
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return true;
  dx /= len; dy /= len; dz /= len;
  const h = raycast(ax, ay, az, dx, dy, dz, len - 0.05);
  return !h;
}

// Highest floor under a point (for bot pathing sanity / spawn placement).
export function floorAt(x, z) {
  let top = 0;
  for (const c of colliders) {
    if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && c.maxY <= 1.3 && c.maxY > top) top = c.maxY;
  }
  return top;
}
