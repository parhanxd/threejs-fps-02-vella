// SALTDOWN — the local player: pointer-lock look, WASD with acceleration and friction,
// crouch, jump, and weapon handling (fire, reload, grenade throw, buy menu keys).
import { PHYS, GRENADE } from './config.js';
import { moveBody } from './physics.js';
import { eyeHeight } from './actors.js';

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.fireHeld = false;
    this.firePressed = false;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    addEventListener('mousedown', (e) => {
      if (document.pointerLockElement && e.button === 0) { this.fireHeld = true; this.firePressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
  }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }
}

const SENS = 0.0022;

export function updatePlayer(player, input, game, t, dt, locked) {
  if (!player.alive) return;

  if (locked) {
    const [dx, dy] = input.consumeMouse();
    player.yaw -= dx * SENS;
    player.pitch -= dy * SENS;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
  }

  const crouchKey = input.keys.has('ControlLeft') || input.keys.has('KeyC');
  const wishCrouch = crouchKey && player.grounded;
  if (wishCrouch !== player.crouched) {
    // only stand when there is headroom (checked by the physics body test in moveBody)
    player.crouched = wishCrouch;
  }

  const fwd = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
  const side = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
  const maxSpeed = player.crouched ? PHYS.crouchSpeed
    : (input.keys.has('ShiftLeft') ? PHYS.walkSpeed : PHYS.maxSpeed);

  const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
  let wx = side * cosY - fwd * sinY;
  let wz = -side * sinY - fwd * cosY;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }

  const accel = player.grounded ? PHYS.accel : PHYS.airAccel;
  if (wl > 0 && !game.buyMenuOpen && !game.frozen) {
    player.vel.x += wx * accel * dt;
    player.vel.z += wz * accel * dt;
  }
  if (player.grounded) {
    const fr = PHYS.friction * dt;
    player.vel.x -= player.vel.x * Math.min(fr, 1);
    player.vel.z -= player.vel.z * Math.min(fr, 1);
    if (input.keys.has('Space') && !game.buyMenuOpen && !game.frozen) {
      player.vel.y = PHYS.jumpSpeed;
      player.grounded = false;
    }
  }
  const sp = Math.hypot(player.vel.x, player.vel.z);
  if (sp > maxSpeed) { player.vel.x *= maxSpeed / sp; player.vel.z *= maxSpeed / sp; }

  player.vel.y -= PHYS.gravity * dt;
  const wasGrounded = player.grounded;
  const delta = { x: player.vel.x * dt, y: player.vel.y * dt, z: player.vel.z * dt };
  player.grounded = moveBody(player.pos, delta, PHYS.radius, player.crouched ? PHYS.crouchHeight : PHYS.height, PHYS.stepHeight);
  if (player.grounded && player.vel.y < 0) player.vel.y = 0;
  if (!wasGrounded && player.grounded) { /* landing: nothing to smooth, velocity handled above */ }

  // clamp inside the arena bounds
  player.pos.x = Math.max(-44, Math.min(44, player.pos.x));
  player.pos.z = Math.max(-44, Math.min(44, player.pos.z));

  // weapon input
  const w = player.weapon;
  if (w.finishReload(t)) game.hud.flashReload();
  if (input.keys.has('KeyR')) w.startReload(t);
  const wantFire = w.def.auto ? input.fireHeld : input.firePressed;
  if (wantFire && !game.buyMenuOpen && !game.frozen) {
    game.fireWeapon(player, t);
  }
  input.firePressed = false;

  // grenade
  if (input.keys.has('KeyG') && player.grenades > 0 && player.grounded && !game.throwingGrenade) {
    game.throwGrenade(player, t);
  }
}
