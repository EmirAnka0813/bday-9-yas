const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/'));
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);

  const bot = await page.evaluate(async () => {
    const log = [];
    const runOne = async (attempt) => {
      window.__reset();
      await new Promise(r => setTimeout(r, 80));
      const t0 = performance.now();
      let lastJump = -9999, jumpCount = 0;
      const iv = setInterval(() => {
        const d = window.__dbg();
        if (d.state !== 'play') return;
        const now = performance.now() - t0;

        // 1) Dusmandan kac
        let avoid = false;
        for (const e of window.__enemies()) {
          const dd = e.x - (d.player.x + 28);
          if (dd > -20 && dd < 190) { avoid = true; break; }
        }

        // 2) Siradaki bosluğa olan mesafe
        const gap = window.__nextGap();
        const gapDist = gap ? gap.x - d.player.x : 9999;

        // 3) Yuksek platformun ustune cikmam gerekiyor mu?
        const step = window.__nextStep();

        // Ziplama karari
        let wantJump = false;
        if (avoid) wantJump = true;
        else if (step && step.dx < 110 && step.dy > 20) wantJump = true;   // yuksek platforma atla
        else if (gapDist < 120 && gapDist > -10) wantJump = true;           // bosluğa atla

        // Cok sık ziplamayı engelle
        if (wantJump && now - lastJump > 420) {
          window.__key('Space', true);
          setTimeout(() => window.__key('Space', false), 160);
          lastJump = now; jumpCount++;
        }
        window.__key('ArrowRight', true);
      }, 30);

      let result = 'TIMEOUT', maxX = 0;
      while (performance.now() - t0 < 70000) {
        await new Promise(r => setTimeout(r, 100));
        const d = window.__dbg();
        maxX = Math.max(maxX, d.player.x);
        if (d.state === 'win') { result = 'WIN'; break; }
        if (d.state === 'over') { result = 'OVER'; break; }
      }
      clearInterval(iv);
      window.__key('ArrowRight', false);
      window.__key('Space', false);
      const d = window.__dbg();
      log.push({ attempt, result, x: Math.round(maxX), jumps: jumpCount, stars: d.starsGot });
      return result;
    };

    for (let i = 0; i < 4; i++) {
      const r = await runOne(i);
      if (r === 'WIN') break;
    }
    const d = window.__dbg();
    return { log, finalState: d.state, goalX: d.goalX, stars: d.starsGot };
  });

  console.log('BOT SONUCU:');
  bot.log.forEach(l => console.log(`  deneme ${l.attempt}: ${l.result}  x=${l.x} ziplama=${l.jumps} yildiz=${l.stars}`));
  console.log('  hedef x =', bot.goalX, '| son durum =', bot.finalState);
  const ok = bot.finalState === 'win';
  console.log(ok ? '\nPASS  Seviye bot tarafindan tamamlandi' : '\nFAIL  Seviye tamamlanamadi');
  console.log('JS HATALARI:', errors.length ? errors.join('\n') : 'YOK');

  await browser.close();
  process.exit(ok ? 0 : 1);
})();
