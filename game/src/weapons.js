// SALTDOWN — weapons: definitions live in config.js; this module is the per-actor gun state
// (ammo, reload, recoil, spread) and the damage model that reads it.
import { WEAPONS } from './config.js';

export class Weapon {
  constructor(key) {
    this.key = key;
    this.def = WEAPONS[key];
    this.ammo = this.def.mag;
    this.reserve = this.def.reserve;
    this.reloadUntil = -1;
    this.nextShotAt = 0;
    this.recoilPitch = 0; // accumulated view kick, decays in update()
    this.recoilYaw = 0;
    this.shotsInBurst = 0;
  }

  get name() { return this.def.name; }
  get reloading() { return this.reloadUntil > 0; }

  canFire(t) {
    if (this.reloading || this.ammo <= 0) return false;
    return t >= this.nextShotAt;
  }

  startReload(t) {
    if (this.reloading || this.ammo === this.def.mag || this.reserve <= 0) return false;
    this.reloadUntil = t + this.def.reloadTime;
    return true;
  }

  finishReload(t) {
    if (this.reloadUntil > 0 && t >= this.reloadUntil) {
      const need = this.def.mag - this.ammo;
      const take = Math.min(need, this.reserve);
      this.ammo += take;
      this.reserve -= take;
      this.reloadUntil = -1;
      this.shotsInBurst = 0;
      return true;
    }
    return false;
  }

  // Fire one round: returns the spread cone (radians) to apply, or -1 when it cannot fire.
  fire(t) {
    if (!this.canFire(t)) return -1;
    this.ammo -= 1;
    this.nextShotAt = t + 60 / this.def.rpm;
    this.shotsInBurst += 1;
    const climb = Math.min(this.shotsInBurst, 8) / 8;
    this.recoilPitch = Math.min(this.recoilPitch + this.def.recoil * (0.6 + climb), 0.14);
    this.recoilYaw += (Math.sin(this.shotsInBurst * 2.7) * 0.5) * this.def.recoil * 0.5;
    const s = this.def;
    return s.spread * (1 + climb * 0.9);
  }

  // Spread cone while moving/crouched/airborne. speed in m/s.
  spreadFor(speed, crouched, airborne) {
    const s = this.def;
    let base = s.spread * (crouched ? s.crouchMul : 1);
    base += s.moveSpread * Math.min(speed / 7, 1.4) * (crouched ? 0.75 : 1);
    if (airborne) base += 0.05;
    base += this.shotsInBurst * s.recoil * 0.35;
    return base;
  }

  decayRecoil(dt) {
    const k = Math.pow(0.02, dt);
    this.recoilPitch *= k;
    this.recoilYaw *= k;
    if (this.recoilPitch < 1e-4 && this.recoilYaw < 1e-4) {
      this.recoilPitch = 0; this.recoilYaw = 0; this.shotsInBurst = 0;
    }
  }
}

// Damage after falloff and armour. Returns integer health loss.
export function damageFor(def, distance, headshot) {
  const fall = Math.pow(def.falloff, Math.max(0, distance - 12) / 18);
  const base = def.damage * fall * (headshot ? def.headshotMul : 1);
  return Math.round(base);
}

export function pistolLoadout() {
  return { primary: new Weapon('sidearm'), slot: 'primary' };
}
