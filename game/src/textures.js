// SALTDOWN — procedural surface textures.
// Everything here is drawn into an offscreen canvas at boot from a seeded RNG,
// so the game ships zero image assets: containers, concrete and asphalt are all
// generated code. Textures are cached by kind and tinted per material.

import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surface(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return { c, ctx: c.getContext('2d') };
}

// speckle: the cheap salt-and-pepper grain that keeps flat colours from reading as plastic
function speckle(ctx, size, rand, count, alpha) {
  for (let i = 0; i < count; i++) {
    const v = 0.35 + rand() * 0.65;
    ctx.fillStyle = `rgba(${v * 255 | 0},${v * 250 | 0},${v * 245 | 0},${alpha * rand()})`;
    const r = rand() < 0.85 ? 1 : 2;
    ctx.fillRect(rand() * size | 0, rand() * size | 0, r, r);
  }
}

function grime(ctx, size, rand, count, tint) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 4 + rand() * 34;
    const h = 4 + rand() * 20;
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.05 + rand() * 0.12;
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, h * 0.5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function containerTexture(rand, base, rail) {
  const { c, ctx } = surface(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // corrugated ribs: shadow + highlight pair every 16px
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 5, 0, 2, 256);
  }
  // top and bottom rails
  ctx.fillStyle = rail;
  ctx.fillRect(0, 0, 256, 14);
  ctx.fillRect(0, 242, 256, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 14, 256, 3);
  ctx.fillRect(0, 239, 256, 3);
  // rivets along the rails
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 8; x < 256; x += 24) {
    ctx.beginPath();
    ctx.arc(x, 7, 1.6, 0, Math.PI * 2);
    ctx.arc(x, 249, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  grime(ctx, 256, rand, 26, '0,0,0');
  grime(ctx, 256, rand, 10, '120,60,20'); // rust bloom
  speckle(ctx, 256, rand, 2600, 0.10);
  return c;
}

function concreteTexture(rand, base) {
  const { c, ctx } = surface(256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  // poured-panel seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * 64);
    ctx.lineTo(256, i * 64);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.stroke();
  // form-tie holes
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  for (let x = 64; x < 256; x += 128) {
    for (let y = 32; y < 256; y += 64) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grime(ctx, 256, rand, 30, '0,0,0');
  grime(ctx, 256, rand, 12, '90,80,60');
  speckle(ctx, 256, rand, 3200, 0.08);
  return c;
}

function asphaltTexture(rand) {
  const { c, ctx } = surface(256);
  ctx.fillStyle = '#20262c';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, rand, 9000, 0.20);
  grime(ctx, 256, rand, 40, '0,0,0');
  grime(ctx, 256, rand, 16, '70,80,90');
  // hairline cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rand() * 256;
    let y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 30;
      y += (rand() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

function hazardTexture(rand) {
  const { c, ctx } = surface(64);
  ctx.fillStyle = '#d8b23c';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#1c1f24';
  for (let i = -64; i < 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i - 48 + 16, 64);
    ctx.lineTo(i - 48, 64);
    ctx.closePath();
    ctx.fill();
  }
  speckle(ctx, 64, rand, 700, 0.14);
  return c;
}

const CACHE = new Map();

// kind: 'rust' | 'orange' | 'metal' | 'concrete' | 'concreteDark' | 'teal' | 'asphalt' | 'hazard'
export function makeTexture(kind) {
  if (CACHE.has(kind)) return CACHE.get(kind);
  const rand = mulberry32(0x5a17d0 + kind.length * 977);
  let c;
  switch (kind) {
    case 'rust': c = containerTexture(rand, '#7a4a2e', '#5e3520'); break;
    case 'orange': c = containerTexture(rand, '#a8531f', '#7c3a14'); break;
    case 'metal': c = containerTexture(rand, '#4a545e', '#333b43'); break;
    case 'concrete': c = concreteTexture(rand, '#3d454e'); break;
    case 'concreteDark': c = concreteTexture(rand, '#333a42'); break;
    case 'teal': c = containerTexture(rand, '#1f7d78', '#125653'); break;
    case 'asphalt': c = asphaltTexture(rand); break;
    case 'hazard': c = hazardTexture(rand); break;
    default: c = concreteTexture(rand, '#3d454e');
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  CACHE.set(kind, tex);
  return tex;
}

// Vertical sky gradient for the dome behind the fog.
export function makeSkyTexture() {
  const { c, ctx } = surface(64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#0b1219');
  g.addColorStop(0.55, '#132030');
  g.addColorStop(0.82, '#2a3b46');
  g.addColorStop(1, '#3d4a4a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
