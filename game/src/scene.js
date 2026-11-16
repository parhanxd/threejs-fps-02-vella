// SALTDOWN — scene construction: renderer, lights, and every map mesh.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { BOXES } from './mapdata.js';
import { makeTexture, makeSkyTexture } from './textures.js';

// mapdata material key -> generated texture kind
const TEX_KIND = {
  c: 'concrete',
  d: 'concreteDark',
  m: 'metal',
  r: 'rust',
  t: 'teal',
  o: 'orange',
};

// one shared unit box; every wall/container is this mesh scaled (no per-frame allocation)
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();

// material per (kind, tile repeat) so a whole container shares one draw-call friendly material
function boxMaterial(kind, rx, ry) {
  const key = kind + rx + 'x' + ry;
  if (matCache.has(key)) return matCache.get(key);
  const tex = makeTexture(TEX_KIND[kind] || 'concrete').clone();
  tex.needsUpdate = true;
  tex.repeat.set(rx, ry);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  matCache.set(key, mat);
  return mat;
}

export function buildScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 45, 150);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 320);

  scene.add(new THREE.HemisphereLight(0x8fa3b0, 0x272c2f, 1.35));
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.3);
  sun.position.set(-42, 70, 34);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -62;
  sun.shadow.camera.right = 62;
  sun.shadow.camera.top = 62;
  sun.shadow.camera.bottom = -62;
  sun.shadow.camera.far = 180;
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // sodium floodlights over each site for the industrial palette
  for (const p of [[-30, 3, -28], [30, 3, 28], [0, 6, 0]]) {
    const lamp = new THREE.PointLight(PALETTE.sodium, 55, 42, 1.8);
    lamp.position.set(p[0], p[1] + 5, p[2]);
    scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6),
      new THREE.MeshBasicMaterial({ color: PALETTE.sodium }));
    bulb.position.copy(lamp.position);
    scene.add(bulb);
  }

  // sky dome: a big back-facing sphere carrying the gradient (fog handles the haze)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 16, 12),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // ground
  const groundTex = makeTexture('asphalt').clone();
  groundTex.needsUpdate = true;
  groundTex.repeat.set(22, 22);
  const ground = new THREE.Mesh(BOX_GEO, new THREE.MeshLambertMaterial({ map: groundTex }));
  ground.scale.set(94, 0.2, 94);
  ground.position.y = -0.1;
  ground.receiveShadow = true;
  scene.add(ground);

  // map boxes
  for (const b of BOXES) {
    const rx = Math.max(1, Math.round(b.w / 5));
    const ry = Math.max(1, Math.round(b.h / 3));
    const mesh = new THREE.Mesh(BOX_GEO, boxMaterial(b.m, rx, ry));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.y !== undefined ? b.y + b.h / 2 : b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // site props get a hazard-striped skirt so the plant zones read at a glance
    if (b.m === 't' || b.m === 'o') {
      const capMat = new THREE.MeshBasicMaterial({
        color: b.m === 't' ? PALETTE.accentTeal : PALETTE.accentOrange,
      });
      const cap = new THREE.Mesh(BOX_GEO, capMat);
      cap.scale.set(b.w + 0.15, 0.08, b.d + 0.15);
      cap.position.set(b.x, b.h + 0.05, b.z);
      scene.add(cap);
      const skirtTex = makeTexture('hazard').clone();
      skirtTex.needsUpdate = true;
      skirtTex.repeat.set(Math.round(b.w), 1);
      const skirt = new THREE.Mesh(BOX_GEO, new THREE.MeshLambertMaterial({ map: skirtTex }));
      skirt.scale.set(b.w + 0.3, 0.55, b.d + 0.3);
      skirt.position.set(b.x, 0.28, b.z);
      skirt.castShadow = false;
      scene.add(skirt);
    }
  }

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera };
}

// shared geometries/meshes for actors, built once
export function makeActorMeshes(scene, color, scale = 1, accent = 0xffffff) {
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x20242a });
  // helmet band in the team accent colour — enemy/friendly must read instantly
  const bandMat = new THREE.MeshBasicMaterial({ color: accent });
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.9 * scale, 0.32 * scale), bodyMat);
  torso.position.y = 1.15 * scale;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.3 * scale), bodyMat);
  head.position.y = 1.78 * scale;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.32 * scale, 0.08 * scale, 0.32 * scale), bandMat);
  band.position.y = 1.86 * scale;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 0.72 * scale, 0.3 * scale), darkMat);
  legs.position.y = 0.36 * scale;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), darkMat);
  gun.position.set(0.22 * scale, 1.3 * scale, -0.3 * scale);
  torso.castShadow = true;
  legs.castShadow = true;
  head.castShadow = true;
  g.add(torso, head, band, legs, gun);
  return { group: g, head, torso };
}
