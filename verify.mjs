import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0,300)));
await p.goto('http://localhost:8080/?seed=7', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
await p.click('#play');
await p.waitForTimeout(240000);
const s = await p.evaluate(() => {
  const g = window.game, m = g.match;
  return { t: +g.simTime.toFixed(1), round: m.roundNum, score: m.score, phase: m.phase,
    bomb: m.bomb.planted ? 'planted@' + m.bomb.site : (m.bomb.carrier ? 'carrier ' + m.bomb.carrier.name : 'dropped'),
    actors: g.actors.map(a => `${a.name} ${a.kills}/${a.deaths} hp${a.health} ${a.alive ? 'alive' : 'dead'}`).join(' | ') };
});
console.log(JSON.stringify(s, null, 1));
console.log('errors:', errs.join(' | ') || 'none');
await b.close();
