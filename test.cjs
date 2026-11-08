const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  const url = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(url);
  await page.waitForTimeout(1200);

  const results = [];
  const check = (name, cond, extra = '') => {
    results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' -> ' + extra : ''}`);
  };

  // --- 1. Baslangic ekrani ---
  let state = await page.evaluate(() => window.__dbg ? window.__dbg() : null);
  check('Sayfa yuklendi, oyun objesi var', state !== null, JSON.stringify(state));
  check('Baslangic ekraninda (TITLE)', state && state.state === 'title', state && state.state);

  // --- 2. SPACE ile basla ---
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  state = await page.evaluate(() => window.__dbg());
  check('SPACE ile oyun basladi (PLAY)', state.state === 'play', state.state);

  // --- 3. Saga hareket ---
  const x0 = state.player.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(900);
  await page.keyboard.up('ArrowRight');
  state = await page.evaluate(() => window.__dbg());
  check('SAG ok tusu oyuncuyu hareket ettirdi', state.player.x > x0 + 80, `x ${x0} -> ${state.player.x}`);

  // --- 4. ZIPLAMA ---
  const yBefore = state.player.y;
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  const yMid = (await page.evaluate(() => window.__dbg())).player.y;
  await page.keyboard.up('Space');
  check('SPACE ziplama yapti', yMid < yBefore - 10, `y ${yBefore} -> ${yMid}`);

  // --- 5. Yildiz toplama ---
  await page.evaluate(() => window.__warp(190, 360));
  await page.waitForTimeout(500);
  state = await page.evaluate(() => window.__dbg());
  check('Yildiz toplanabiliyor', state.starsGot >= 1, 'stars=' + state.starsGot);

  // --- 6a. Dusmana YANDAN carpisma -> can azalir ---
  const livesBefore = state.lives;
  const ex = state.enemyXs[0];
  await page.evaluate(e => window.__warp(e - 5, 400), ex);
  await page.waitForTimeout(600);
  state = await page.evaluate(() => window.__dbg());
  check('Dusmana yandan carpisma can azaltir', state.lives < livesBefore, `lives ${livesBefore} -> ${state.lives}`);

  // --- 6b. Dusmana USTTEN inince ezilir -> can gitmez ---
  const lives2 = state.lives;
  await page.evaluate(e => window.__warp(e + 4, 330), state.enemyXs[0]);
  await page.waitForTimeout(700);
  state = await page.evaluate(() => window.__dbg());
  check('Dusmana ustten inince ezilir, can gitmez', state.lives >= lives2, `lives ${lives2} -> ${state.lives}`);

  // --- 7. Kontrol noktasi ---
  await page.evaluate(() => window.__warp(3050, 400));
  await page.waitForTimeout(400);
  state = await page.evaluate(() => window.__dbg());
  check('Kontrol bayragi aktif oldu', state.checksActive >= 1, 'checks=' + state.checksActive);

  // --- 8. Duraklat ---
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  state = await page.evaluate(() => window.__dbg());
  check('P ile duraklatildi (PAUSE)', state.state === 'pause', state.state);
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  state = await page.evaluate(() => window.__dbg());
  check('P ile devam ediyor (PLAY)', state.state === 'play', state.state);

  // --- 9. Zafer ---
  await page.evaluate(() => { window.__warp(9990, 400); });
  await page.waitForTimeout(1200);
  state = await page.evaluate(() => window.__dbg());
  check('Pastaya ulasinca kazanma (WIN)', state.state === 'win', state.state);

  // --- 10. Gorsel ---
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
