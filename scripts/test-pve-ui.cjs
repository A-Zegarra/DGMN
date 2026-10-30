const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewport({width, height:800, isMobile:width < 700, hasTouch:width < 700});
      await page.goto(process.env.GAME_URL || 'http://localhost:5173/', {waitUntil:'networkidle2'});
      await page.type('input[placeholder="Ej. Alvaro"]', `PvEUI${width}`);
      await page.click('.join-button');
      await page.waitForSelector('.area-banner');
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Mochila / Mapa'));
      await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Mochila / Mapa').click());
      await page.waitForSelector('[aria-label="Mochila y mapa"]');
      await page.waitForFunction(() => document.querySelector('.pve-dialog')?.textContent.includes('Disco de vida ×3'));
      const text = await page.$eval('.pve-dialog', element => element.textContent);
      assert.ok(text.includes('Disco de energía ×2'));
      assert.ok(text.includes('2400/2400 HP'));
      assert.ok(text.includes('Refugio del Inicio'));
      assert.ok(await page.$('.pve-map'));
      assert.equal(await page.$eval('[data-item="hp_potion"]', button => button.disabled), true);
      assert.ok(await page.$eval('.pve-dialog', element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1;
      }), 'Diálogo sin desbordamiento horizontal');
      await page.evaluate(() => [...document.querySelectorAll('.pve-dialog button')].find(b => b.textContent.includes('Retirar compañero')).click());
      await page.waitForFunction(() => document.querySelector('.pve-dialog')?.textContent.includes('Tu compañero vuelve hacia ti'));
      await page.click('[aria-label="Cerrar mochila"]');
      await page.click('.exit-button');
      await page.waitForSelector('.saved-profile');
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: mochila, inventario inicial, mapa/Devimon, retirada, guardado y diálogo sin desbordamiento a 1280 y 390 px');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
