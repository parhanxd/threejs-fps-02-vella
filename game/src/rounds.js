// SALTDOWN — rounds: the match state machine. Freeze -> live -> (plant) -> end, plus
// the bomb object, economy payouts and score. All timing from the sim clock.
import { ROUND, ECONOMY } from './config.js';
import { SITES, SPAWNS } from './mapdata.js';
import { spawnReset } from './actors.js';
import { botBuy } from './bots.js';
import { Weapon } from './weapons.js';

const SPAWN_FACING = { attack: Math.PI, defend: 0 };

export class Match {
  constructor(game, actors, rng) {
    this.game = game;
    this.actors = actors;
    this.rng = rng;
    this.score = { attack: 0, defend: 0 };
    this.roundNum = 0;
    this.phase = 'freeze'; // freeze | live | end | matchover
    this.phaseEndsAt = ROUND.freezeTime;
    this.winner = null;
    this.lossStreak = { attack: 0, defend: 0 };
    this.bomb = { planted: false, carrier: null, site: -1, x: 0, z: 0, y: 0, plantedAt: 0, defusing: null, defuseEndsAt: 0, dropped: false };
    this.startRound();
  }

  startRound() {
    this.roundNum += 1;
    this.phase = 'freeze';
    this.phaseEndsAt = this.game.simTime + ROUND.freezeTime;
    this.winner = null;
    const b = this.bomb;
    b.planted = false; b.carrier = null; b.site = -1; b.dropped = false; b.defusing = null;

    const atk = this.actors.filter((a) => a.team === 'attack');
    const def = this.actors.filter((a) => a.team === 'defend');
    atk.forEach((a, i) => { spawnReset(a, SPAWNS.attack[i % SPAWNS.attack.length]); a.yaw = SPAWN_FACING.attack; });
    def.forEach((a, i) => { spawnReset(a, SPAWNS.defend[i % SPAWNS.defend.length]); a.yaw = SPAWN_FACING.defend; });

    // hand the charge to a living attacker (bot 0 if present, else first bot)
    const carriers = atk.filter((a) => a.isBot);
    b.carrier = carriers.length ? carriers[this.rng() * carriers.length | 0] : null;
    b.dropped = false;

    // bots spend money
    for (const a of atk.concat(def)) {
      if (a.isBot) botBuy(a);
      // rebuild the weapon with full mags each round; the buy already owns the gun
      a.weapon = new Weapon(a.primaryKey || 'sidearm');
    }
    this.game.hud.announce(`Round ${this.roundNum}`, 'Buy your gear — B opens the buy menu');
  }

  plantBomb(actor, t) {
    if (this.bomb.planted || this.phase !== 'live') return;
    const site = SITES.findIndex((s) => Math.hypot(actor.pos.x - s.x, actor.pos.z - s.z) < s.radius + 3);
    if (site < 0) return;
    this.bomb.planted = true;
    this.bomb.site = site;
    this.bomb.x = actor.pos.x; this.bomb.z = actor.pos.z; this.bomb.y = actor.pos.y;
    this.bomb.plantedAt = t;
    this.bomb.carrier = null;
    this.bomb.dropped = false;
    actor.money = Math.min(actor.money + ECONOMY.plantBonus, ECONOMY.maxMoney);
    this.game.hud.announce(`Charge armed at site ${SITES[site].name}`, 'Defenders: get on the charge');
    this.game.hud.setBombPlanted(SITES[site].name);
    this.game.audio.beepPlant();
  }

  defuseBomb(actor, t) {
    if (!this.bomb.planted || this.phase !== 'live') return;
    this.bomb.planted = false;
    this.bomb.defusing = null;
    actor.money = Math.min(actor.money + ECONOMY.defuseBonus, ECONOMY.maxMoney);
    this.endRound('defend', 'Charge defused');
  }

  endRound(winner, reason) {
    if (this.phase === 'end' || this.phase === 'matchover') return;
    this.phase = 'end';
    this.phaseEndsAt = this.game.simTime + ROUND.endDelay;
    this.winner = winner;
    this.score[winner] += 1;
    const loser = winner === 'attack' ? 'defend' : 'attack';
    this.lossStreak[winner] = 0;
    this.lossStreak[loser] = Math.min(this.lossStreak[loser] + 1, 4);
    const payout = (a) => {
      const team = a.team;
      const amount = team === winner ? ECONOMY.winRound
        : Math.min(ECONOMY.lossBase + (this.lossStreak[team] - 1) * ECONOMY.lossStep, ECONOMY.lossMax);
      a.money = Math.min(a.money + amount, ECONOMY.maxMoney);
    };
    for (const a of this.actors) {
      payout(a);
      a.primaryKey = a.weapon.def.price > 0 || a.primaryKey ? (a.primaryKey || a.weapon.key) : 'sidearm';
    }
    this.game.hud.announce(winner === 'attack' ? 'Attackers win' : 'Defenders win', reason);
    this.game.hud.setScore(this.score.attack, this.score.defend);
    this.game.audio.roundEnd();
    if (this.score[winner] >= ROUND.roundsToWin) this.phase = 'matchover';
  }

  update(t, dt) {
    if (this.phase === 'matchover') return;
    if (this.phase === 'freeze') {
      if (t >= this.phaseEndsAt) {
        this.phase = 'live';
        this.phaseEndsAt = t + ROUND.roundTime;
        this.game.hud.announce('Live', '');
      }
      return;
    }
    if (this.phase === 'end') {
      if (t >= this.phaseEndsAt && this.phase !== 'matchover') this.startRound();
      return;
    }

    // live
    if (this.bomb.planted) {
      if (t >= this.bomb.plantedAt + ROUND.bombTime) {
        this.bomb.planted = false;
        this.game.audio.explosion(this.bomb.x, this.bomb.z);
        this.game.fx.explosion(this.bomb.x, this.bomb.y + 0.5, this.bomb.z);
        for (const a of this.actors) {
          if (!a.alive) continue;
          const d = Math.hypot(a.pos.x - this.bomb.x, a.pos.z - this.bomb.z);
          if (d < 12) this.game.damageActor(a, Math.round(120 * (1 - d / 12)), 'attack', t, false);
        }
        this.endRound('attack', 'The charge went off');
        return;
      }
    } else if (t >= this.phaseEndsAt) {
      this.endRound('defend', 'Time expired — defenders held');
      return;
    }

    // elimination check
    const atkAlive = this.actors.some((a) => a.team === 'attack' && a.alive);
    const defAlive = this.actors.some((a) => a.team === 'defend' && a.alive);
    if (!defAlive && !this.bomb.planted) { this.endRound('attack', 'Defenders eliminated'); return; }
    if (!atkAlive) {
      if (this.bomb.planted) { /* the charge can still win */ }
      else { this.endRound('defend', 'Attackers eliminated'); return; }
    }
    if (!atkAlive && !defAlive) { this.endRound('defend', 'Mutual elimination'); }
  }

  timeLeft(t) {
    if (this.phase === 'freeze') return this.phaseEndsAt - t;
    if (this.phase === 'end') return 0;
    if (this.bomb.planted) return Math.max(0, this.bomb.plantedAt + ROUND.bombTime - t);
    return Math.max(0, this.phaseEndsAt - t);
  }
}
