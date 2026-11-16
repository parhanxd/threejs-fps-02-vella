import { BOXES, WAYPOINTS, EDGES } from './game/src/mapdata.js';
const R = 0.45; // bot radius + slack
const STEP = 0.55;
function blocks(p) {
  for (const b of BOXES) {
    const y0 = b.y || 0;
    if (b.h <= STEP) continue;
    if (y0 > 2) continue;              // walkable step-up
    if (p.x > b.x - b.w/2 - R && p.x < b.x + b.w/2 + R && p.z > b.z - b.d/2 - R && p.z < b.z + b.d/2 + R) return b;
  }
  return null;
}
const bad = [];
for (const [a, c] of EDGES) {
  const A = WAYPOINTS[a], B = WAYPOINTS[c];
  const n = Math.ceil(Math.hypot(B.x-A.x, B.z-A.z) / 0.5);
  let hit = null;
  for (let i = 1; i < n; i++) {
    const p = { x: A.x + (B.x-A.x)*i/n, z: A.z + (B.z-A.z)*i/n };
    const b = blocks(p);
    if (b) { hit = { at: [+p.x.toFixed(1), +p.z.toFixed(1)], box: [b.x, b.z, b.w, b.d, b.h] }; break; }
  }
  if (hit) bad.push({ edge: [a, c], ...hit });
}
// also nodes inside boxes
const nodeBad = WAYPOINTS.map((p, i) => blocks(p) ? { i, at: [p.x, p.z] } : null).filter(Boolean);
console.log('blocked edges:', JSON.stringify(bad, null, 0));
console.log('blocked nodes:', JSON.stringify(nodeBad));
