const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const puppeteer = require('puppeteer-core');
const output = path.join(os.tmpdir(), 'opencode', 'quests-qa');
fs.mkdirSync(output, {recursive:true});
async function openJournal(page) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Mochila / Mapa').click());
  await page.waitForSelector('[data-pve-tab="quests"]');
  await page.click('[data-pve-tab="quests"]');
  await page.waitForSelector('[aria-label="Misiones PvE"]');
  await page.waitForFunction(() => document.querySelector('[data-quest-progress]')?.textContent.includes('/'));
}
async function bounds(page) {
  assert.ok(await page.$eval('.pve-dialog', e => {
    const r = e.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && e.scrollWidth <= e.clientWidth + 1;
  }), 'Diálogo de misiones dentro de la pantalla y sin desbordamiento horizontal');
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(output, 'chrome-')),headless:true,
    args:['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const [width,height] of [[1280,800],[390,844],[360,640],[844,390]]) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage(); const errors=[];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({width,height,isMobile:width<900,hasTouch:width<900});
      await page.goto(process.env.GAME_URL || 'http://localhost:5174/', {waitUntil:'networkidle2'});
      await page.type('input[placeholder="Ej. Alvaro"]', `QuestUI${width}`);
      await page.click('.join-button'); await page.waitForSelector('.area-banner');
      await openJournal(page); await bounds(page);
      assert.equal(await page.$eval('[data-quest-progress]', e => e.textContent.trim()), '0 / 3');
      assert.equal(await page.$eval('[data-quest-claim]', e => e.disabled), true);
      assert.equal(await page.$$eval('.quest-card', es => es.length), 3);
      assert.equal(await page.$$eval('.quest-card:not(.is-active)', es => es.filter(e => e.textContent.includes('Bloqueada')).length), 2);
      if (width===1280) {
        await page.focus('[data-pve-tab="quests"]');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.$eval('[data-pve-tab="inventory"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.$eval('[data-pve-tab="quests"]',e=>e.getAttribute('aria-selected')),'true');
        assert.ok(await page.$('[data-quest-progress]'));
      }
      // Cambiar de pestaña evita apilar las misiones sobre la mochila en móvil.
      await page.click('[data-pve-tab="inventory"]');
      await page.$eval('.pve-map', e => e.scrollIntoView({block:'center'}));
      assert.ok(await page.$eval('.pve-map', e => { const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight; }));
      await page.$eval('.pve-dialog', e => {e.scrollTop=0;});
      await page.click('[data-pve-tab="quests"]');
      await page.$eval('.pve-dialog', e => {e.scrollTop=0;});
      await page.screenshot({path:path.join(output, `quests-${width}.png`)});
      await page.click('[aria-label="Cerrar mochila"]');
      await page.click('.exit-button'); await page.waitForSelector('.saved-profile');
      await page.click('.join-button'); await page.waitForSelector('.area-banner');
      await openJournal(page);
      assert.equal(await page.$eval('[data-quest-progress]', e => e.textContent.trim()), '0 / 3');
      await page.click('[aria-label="Cerrar mochila"]');
      await page.click('.exit-button'); await page.waitForSelector('.saved-profile');
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS: ${width}×${height}, diario, bloqueos, scroll, límites y continuación`);
    }
    if (process.env.QUEST_UI_TOKEN) {
      const page = await browser.newPage(); const errors=[];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
      const url=process.env.GAME_URL || 'http://localhost:5174/';
      await page.goto(url,{waitUntil:'networkidle2'});
      await page.evaluate(token => localStorage.setItem('digiworld:profile-token:v1',token),process.env.QUEST_UI_TOKEN);
      await page.type('input[placeholder="Ej. Alvaro"]','QuestUIQA');
      await page.click('.join-button');await page.waitForSelector('.area-banner');
      await openJournal(page);
      assert.equal(await page.$eval('[data-quest-progress]',e=>e.textContent.trim()),'3 / 3');
      await page.waitForFunction(()=>!document.querySelector('[data-quest-claim]')?.disabled);
      await bounds(page);await page.screenshot({path:path.join(output,'ready-390.png')});
      await page.click('[data-quest-claim="pradera-datos"]');
      await page.waitForFunction(()=>document.querySelector('[data-quest="pradera-datos"]')?.textContent.includes('Entregada'));
      assert.equal(await page.$eval('[data-quest-progress]',e=>e.textContent.trim()),'0 / 4');
      assert.ok(await page.$('.quest-reward[role="status"]'));
      await page.screenshot({path:path.join(output,'delivered-390.png')});
      await page.click('[data-pve-tab="inventory"]');
      await page.waitForFunction(()=>document.querySelector('.pve-dialog')?.textContent.includes('120 Bits'));
      assert.ok(await page.$eval('.pve-dialog',e=>e.textContent.includes('Disco de vida ×5')&&e.textContent.includes('Disco de energía ×3')));
      await page.click('[aria-label="Cerrar mochila"]');
      await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      await page.reload({waitUntil:'networkidle2'});await page.click('.join-button');
      await page.waitForSelector('.area-banner');await openJournal(page);
      assert.ok(await page.$eval('[data-quest="pradera-datos"]',e=>e.textContent.includes('Entregada')));
      assert.equal(await page.$eval('[data-quest-progress]',e=>e.textContent.trim()),'0 / 4');
      await page.click('[data-pve-tab="inventory"]');
      assert.ok(await page.$eval('.pve-dialog',e=>e.textContent.includes('120 Bits')));
      await page.click('[aria-label="Cerrar mochila"]');await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      assert.deepEqual(errors,[]);await page.close();
      console.log('PASS: fixture aislada, entrega real, premio exacto, desbloqueo y restauración tras recarga');
    }
    console.log(`Capturas: ${output}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
