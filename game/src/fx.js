// SALTDOWN — effects: pooled tracers, impact sparks, muzzle flash and the planted-charge
// marker. Every pool is allocated once at boot; the hot loop reuses slots, never allocates.
import * as THREE from 'three';

const TRACER_COUNT = 48;
const SPARK_COUNT = 120;

export class Fx {
  constructor(scene) {
    this.scene = scene;
    // tracers: thin stretched boxes, moved and scaled in place
    this.tracers = [];
    const tGeo = new THREE.BoxGeometry(0.02, 0.02, 1);
    const tMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (let i = 0; i < TRACER_COUNT; i++) {
      const m = new THREE.Mesh(tGeo, tMat);
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, until: 0 });
    }
    this.tracerI = 0;

    // sparks: one InstancedMesh of tiny quads with per-slot life
    this.sparkGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
    this.sparks = new THREE.InstancedMesh(this.sparkGeo, this.sparkMat, SPARK_COUNT);
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparkData = [];
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < SPARK_COUNT; i++) {
      this.sparks.setMatrixAt(i, hidden);
      this.sparkData.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    }
    scene.add(this.sparks);
    this.sparkI = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();

    // muzzle flash quad attached to the camera
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0 });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), flashMat);
    this.flash.position.set(0.24, -0.18, -0.55);
    this.flash.visible = false;
    this.flashUntil = 0;
  }

  attachCamera(camera) { camera.add(this.flash); }

  tracer(from, to, until) {
    const slot = this.tracers[this.tracerI];
    this.tracerI = (this.tracerI + 1) % TRACER_COUNT;
    const m = slot.mesh;
    m.visible = true;
    m.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz) || 0.001;
    m.scale.set(1, 1, len);
    m.lookAt(to.x, to.y, to.z);
    slot.until = until;
  }

  sparksAt(x, y, z, count) {
    for (let i = 0; i < count; i++) {
      const s = this.sparkData[this.sparkI];
      this.sparkI = (this.sparkI + 1) % SPARK_COUNT;
      s.life = 0.35;
      s.x = x; s.y = y; s.z = z;
      s.vx = (Math.random() - 0.5) * 5;
      s.vy = Math.random() * 3.5;
      s.vz = (Math.random() - 0.5) * 5;
    }
  }

  explosion(x, y, z) {
    this.sparksAt(x, y + 0.4, z, 60);
    const light = new THREE.PointLight(0xff8040, 200, 30, 2);
    light.position.set(x, y + 1, z);
    this.scene.add(light);
    const slot = this.tracers[this.tracerI];
    this.tracerI = (this.tracerI + 1) % TRACER_COUNT;
    slot.mesh.visible = true;
    slot.mesh.scale.set(6, 6, 6);
    slot.mesh.position.set(x, y + 1, z);
    slot.until = 0.0001; // marker only; the light below fades in update
    slot.mesh.userData.fade = light;
  }

  muzzleFlash(t, dur = 0.045) {
    this.flash.visible = true;
    this.flashUntil = t + dur;
  }

  update(t, dt) {
    for (const slot of this.tracers) {
      if (slot.mesh.visible && t >= slot.until) {
        slot.mesh.visible = false;
        if (slot.mesh.userData.fade) {
          this.scene.remove(slot.mesh.userData.fade);
          slot.mesh.userData.fade = null;
        }
      }
    }
    let dirty = false;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = this.sparkData[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      s.vy -= 12 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.life <= 0) {
        this._m.makeScale(0, 0, 0);
      } else {
        const k = Math.max(s.life / 0.35, 0.05);
        this._m.makeScale(k, k, k);
        this._m.setPosition(s.x, s.y, s.z);
      }
      this.sparks.setMatrixAt(i, this._m);
      dirty = true;
    }
    if (dirty) this.sparks.instanceMatrix.needsUpdate = true;
    if (this.flash.visible && t >= this.flashUntil) this.flash.visible = false;
  }
}
