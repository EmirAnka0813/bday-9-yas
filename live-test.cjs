const { chromium } = require('playwright');
const path = require('path');

const URL = process.argv[2] || 'https://emiranka0813.github.io/bday-9-yas/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const resp = await page.goto(URL, { waitUntil: 'networkidle' });
  console.log('HTTP durumu:', resp.status(), '| URL:', URL);
  await page.waitForTimeout(1200);

  const results = [];
  const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' -> ' + e : ''}`);

  let d = await page.evaluate(() => window.__dbg());
  check('Oyun yuklendi, TITLE ekraninda', d.state === 'title', d.state);
  check('9 yildiz tanimli', d.starsTotal === 9, 'stars=' + d.starsTotal);
  check('6 dusman tanimli', d.enemies === 6, 'enemies=' + d.enemies);
  check('6 kontrol bayragi', d.checkXs.length === 6, 'checks=' + d.checkXs.length);
  check('Pasta (goal) tanimli', d.goalX > 0, 'goalX=' + d.goalX);

  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  d = await page.evaluate(() => window.__dbg());
  check('SPACE ile oyun basladi', d.state === 'play', d.state);

  const x0 = d.player.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.keyboard.up('ArrowRight');
  d = await page.evaluate(() => window.__dbg());
  check('Hareket calisiyor', d.player.x > x0 + 80, `x ${x0} -> ${d.player.x}`);

  const y0 = d.player.y;
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  const yMid = (await page.evaluate(() => window.__dbg())).player.y;
  await page.keyboard.up('Space');
  check('Ziplama calisiyor', yMid < y0 - 10, `y ${y0} -> ${yMid}`);

  await page.evaluate(() => window.__warp(190, 360));
  await page.waitForTimeout(500);
  d = await page.evaluate(() => window.__dbg());
  check('Yildiz toplanabiliyor', d.starsGot >= 1, 'stars=' + d.starsGot);

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  d = await page.evaluate(() => window.__dbg());
  check('P ile duraklatma', d.state === 'pause', d.state);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);

  await page.evaluate(() => window.__warp(9990, 400));
  await page.waitForTimeout(1200);
  d = await page.evaluate(() => window.__dbg());
  check('Pastaya ulasma (WIN)', d.state === 'win', d.state);

  await page.screenshot({ path: path.join(__dirname, 'live-win.png') });

  console.log('\n=== CANLI TEST ===');
  results.forEach(r => console.log(r));
  console.log('JS HATALARI:', errors.length ? errors.join('\n') : 'YOK');
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed}/${results.length} test gecti`);
  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})();
