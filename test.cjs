const { chromium } = require('playwright');
const path = require('path');

// Tek betik iki hedefi de dener:
//   node test.cjs                       → lokal index.html
//   node test.cjs https://...           → canlı sürüm
const arg = process.argv[2];
const LOCAL = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const URL = arg || LOCAL;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const resp = await page.goto(URL, { waitUntil: 'networkidle' });
  if (resp) console.log('HTTP', resp.status(), '|', URL);
  await page.waitForTimeout(1000);

  const results = [];
  const check = (name, cond, extra = '') =>
    results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' -> ' + extra : ''}`);

  // --- dünya kurulumu ---
  let s = await page.evaluate(() => window.__dbg());
  check('Oyun yuklendi, TITLE ekraninda', s && s.state === 'title', s && s.state);
  check('9 yildiz tanimli', s.starsTotal === 9, 'stars=' + s.starsTotal);
  check('6 dusman tanimli', s.enemies === 6, 'enemies=' + s.enemies);
  check('6 kontrol bayragi', s.checkXs.length === 6, 'checks=' + s.checkXs.length);
  check('Pasta (goal) tanimli', s.goalX > 0, 'goalX=' + s.goalX);

  // --- SPACE ile basla ---
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.__dbg());
  check('SPACE ile oyun basladi (PLAY)', s.state === 'play', s.state);

  // --- hareket ---
  const x0 = s.player.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.keyboard.up('ArrowRight');
  s = await page.evaluate(() => window.__dbg());
  check('SAG ok tusu oyuncuyu hareket ettirdi', s.player.x > x0 + 80, `x ${x0} -> ${s.player.x}`);

  // --- ziplama ---
  const y0 = s.player.y;
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  const yMid = (await page.evaluate(() => window.__dbg())).player.y;
  await page.keyboard.up('Space');
  check('SPACE ziplama yapti', yMid < y0 - 10, `y ${y0} -> ${yMid}`);

  // --- yildiz ---
  await page.evaluate(() => window.__warp(190, 360));
  await page.waitForTimeout(500);
  s = await page.evaluate(() => window.__dbg());
  check('Yildiz toplanabiliyor', s.starsGot >= 1, 'stars=' + s.starsGot);

  // --- dusman: yandan carpi -> can gider ---
  const livesBefore = s.lives;
  const ex = s.enemyXs[0];
  await page.evaluate(e => window.__warp(e - 5, 400), ex);
  await page.waitForTimeout(600);
  s = await page.evaluate(() => window.__dbg());
  check('Dusmana yandan carpisma can azaltir', s.lives < livesBefore, `lives ${livesBefore} -> ${s.lives}`);

  // --- dusman: ustten inince ezilir -> can gitmez ---
  const lives2 = s.lives;
  await page.evaluate(e => window.__warp(e + 4, 330), s.enemyXs[0]);
  await page.waitForTimeout(700);
  s = await page.evaluate(() => window.__dbg());
  check('Dusmana ustten inince ezilir, can gitmez', s.lives >= lives2, `lives ${lives2} -> ${s.lives}`);

  // --- kontrol bayragi ---
  await page.evaluate(() => window.__warp(3050, 400));
  await page.waitForTimeout(400);
  s = await page.evaluate(() => window.__dbg());
  check('Kontrol bayragi aktif oldu', s.checksActive >= 1, 'checks=' + s.checksActive);

  // --- duraklat / devam ---
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  s = await page.evaluate(() => window.__dbg());
  check('P ile duraklatildi (PAUSE)', s.state === 'pause', s.state);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  s = await page.evaluate(() => window.__dbg());
  check('P ile devam ediyor (PLAY)', s.state === 'play', s.state);

  // --- zafer ---
  await page.evaluate(() => window.__warp(9990, 400));
  await page.waitForTimeout(1200);
  s = await page.evaluate(() => window.__dbg());
  check('Pastaya ulasinca kazanma (WIN)', s.state === 'win', s.state);

  // --- gorsel ---
  await page.screenshot({ path: path.join(__dirname, 'shot-win.png') });
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(__dirname, 'shot-title.png') });
  check('Screenshot alindi', true);

  console.log('\n=== TEST SONUCU ===');
  results.forEach(r => console.log(r));
  console.log('\nJS HATALARI:', errors.length ? errors.join('\n') : 'YOK');

  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed}/${results.length} test gecti`);

  await browser.close();
  process.exit(failed || errors.length ? 1 : 0);
})();
