// Shoots the game's staged screenshots with headless Chromium (SwiftShader WebGL).
// Usage: node shots.mjs [baseUrl]
import { chromium } from 'playwright';
import { statSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:8080';
const shots = [
  { file: 'screenshots/1-crane-alley.jpg', url: `${base}/?shot=lane&seed=7` },
  { file: 'screenshots/2-site-firefight.jpg', url: `${base}/?shot=firefight&seed=7` },
  { file: 'screenshots/3-buy-menu.jpg', url: `${base}/?shot=buymenu&seed=7` },
  { file: 'screenshots/4-charge-armed.jpg', url: `${base}/?shot=armed&seed=7` },
];

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
for (const s of shots) {
  await page.goto(s.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: s.file, type: 'jpeg', quality: 85 });
  console.log('shot', s.file, statSync(s.file).size, 'bytes');
}
console.log('pageerrors:', errors.join(' | ') || 'none');
await browser.close();
