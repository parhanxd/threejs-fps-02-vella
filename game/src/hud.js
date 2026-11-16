// SALTDOWN — HUD: DOM overlay for health, armour, ammo, money, round timer, score,
// kill feed, round banners, hit marker, planted-charge warning and the buy menu.
import { WEAPONS, GRENADE, ECONOMY, HUD_COLORS } from './config.js';

const BUY_LIST = [
  { key: 'smg', label: 'Kestrel SMG', priceKey: 'price' },
  { key: 'carbine', label: 'Sentinel Carbine', priceKey: 'price' },
  { key: 'rifle', label: 'Vulture Rifle', priceKey: 'price' },
  { key: 'sniper', label: 'Longhorn Marksman', priceKey: 'price' },
  { key: 'grenade', label: 'Frag', priceKey: 'flat' },
  { key: 'armor', label: 'Plated Vest', priceKey: 'flat' },
  { key: 'kit', label: 'Defusal Kit', priceKey: 'flat' },
];
const FLAT_PRICE = { grenade: GRENADE.price, armor: 650, kit: 400 };

export class Hud {
  constructor(onBuy, onCloseBuy) {
    this.el = document.getElementById('hud');
    this.onBuy = onBuy;
    this.onCloseBuy = onCloseBuy;
    this.mag = document.getElementById('ammo-mag');
    this.reserve = document.getElementById('ammo-reserve');
    this.ammoBox = document.getElementById('ammo');
    this.health = document.getElementById('health-value');
    this.armor = document.getElementById('armor-value');
    this.money = document.getElementById('money-value');
    this.timer = document.getElementById('timer-value');
    this.scoreA = document.getElementById('score-attack');
    this.scoreD = document.getElementById('score-defend');
    this.banner = document.getElementById('banner');
    this.bannerSub = document.getElementById('banner-sub');
    this.feed = document.getElementById('feed');
    this.bombTag = document.getElementById('bomb-tag');
    this.hitmarker = document.getElementById('hitmarker');
    this.buyMenu = document.getElementById('buy-menu');
    this.buyMoney = document.getElementById('buy-money');
    this.weaponName = document.getElementById('weapon-name');
    this.grenadeTag = document.getElementById('grenade-tag');
    this.bannerUntil = 0;
    this.hitUntil = 0;
    this.buildBuyMenu();
  }

  buildBuyMenu() {
    const list = document.getElementById('buy-list');
    list.innerHTML = '';
    for (const item of BUY_LIST) {
      const btn = document.createElement('button');
      btn.className = 'buy-item';
      btn.dataset.key = item.key;
      const price = item.priceKey === 'flat' ? FLAT_PRICE[item.key] : WEAPONS[item.key].price;
      btn.innerHTML = `<span>${item.label}</span><b>$${price}</b>`;
      btn.addEventListener('click', () => this.onBuy(item.key));
      list.appendChild(btn);
    }
    document.getElementById('buy-close').addEventListener('click', () => this.onCloseBuy());
  }

  openBuy(money, canBuy) {
    this.buyMenu.hidden = false;
    this.buyMoney.textContent = `$${money}`;
    for (const btn of this.buyMenu.querySelectorAll('.buy-item')) {
      const key = btn.dataset.key;
      const price = key === 'grenade' ? GRENADE.price : key === 'armor' ? 650 : key === 'kit' ? 400 : WEAPONS[key].price;
      const owned = key === 'grenade' ? false : false;
      btn.disabled = !canBuy || money < price || owned;
    }
  }

  closeBuy() { this.buyMenu.hidden = true; }

  get buyOpen() { return !this.buyMenu.hidden; }

  setWeapon(weapon, grenades) {
    this.weaponName.textContent = weapon.name;
    this.grenadeTag.hidden = grenades <= 0;
    this.grenadeTag.textContent = `Frag x${grenades} [G]`;
  }

  setAmmo(mag, reserve) {
    this.mag.textContent = String(mag);
    this.reserve.textContent = `/ ${reserve}`;
    this.ammoBox.classList.toggle('empty', mag === 0);
  }

  setVitals(hp, armor) {
    this.health.textContent = String(hp);
    this.health.style.color = hp <= 30 ? HUD_COLORS.healthLow : HUD_COLORS.health;
    this.armor.textContent = String(armor);
  }

  setMoney(v) { this.money.textContent = `$${v}`; }

  setScore(attack, defend) {
    this.scoreA.textContent = String(attack);
    this.scoreD.textContent = String(defend);
  }

  setTimer(seconds, phase) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timer.textContent = phase === 'freeze' ? `BUY ${m}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
    this.timer.style.color = seconds < 15 && phase === 'live' ? HUD_COLORS.orange : '';
  }

  announce(title, sub, seconds = 2.4) {
    this.banner.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.parentElement.hidden = false;
    this.bannerUntil = performance.now() / 1000 + seconds;
  }

  flashReload() {
    this.reserve.textContent = '— RELOADED';
  }

  setBombPlanted(site) {
    this.bombTag.hidden = false;
    this.bombTag.textContent = `CHARGE ARMED — SITE ${site}`;
  }

  clearBomb() { this.bombTag.hidden = true; }

  hit(head) {
    this.hitmarker.classList.add('on');
    this.hitmarker.style.color = head ? '#d04030' : '#f0a830';
    this.hitUntil = performance.now() / 1000 + 0.12;
    if (navigator.vibrate) navigator.vibrate(head ? 30 : 12);
  }

  killFeed(killer, victim, head, weaponName) {
    const row = document.createElement('div');
    row.className = 'feed-row';
    row.innerHTML = `<b>${killer}</b> <span>▸ ${weaponName}${head ? ' ◎ headshot' : ''} ▸</span> <b>${victim}</b>`;
    this.feed.prepend(row);
    while (this.feed.children.length > 5) this.feed.removeChild(this.feed.lastChild);
    setTimeout(() => row.remove(), 5200);
  }

  update(now) {
    if (this.bannerUntil && now >= this.bannerUntil) {
      this.banner.parentElement.hidden = true;
      this.bannerUntil = 0;
    }
    if (this.hitUntil && now >= this.hitUntil) {
      this.hitmarker.classList.remove('on');
      this.hitUntil = 0;
    }
  }

  hideAll() { this.el.hidden = true; }
}
