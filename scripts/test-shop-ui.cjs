const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const output = path.join(os.tmpdir(), 'opencode', 'shop-qa');
fs.mkdirSync(output, {recursive:true});
async function openShop(page) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Mochila / Mapa').click());
  await page.waitForSelector('[data-pve-tab="shop"]');
  await page.click('[data-pve-tab="shop"]');
  await page.waitForSelector('[aria-label="Tienda del refugio"]');
  await page.waitForFunction(() => !document.querySelector('.refuge-shop')?.textContent.includes('Recuperando inventario'));
}
async function bounds(page) {
  assert.ok(await page.$eval('.pve-dialog', e => {
    const r=e.getBoundingClientRect();
    return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1;
  }), 'Tienda sin desbordamiento');
}
(async () => {
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(output,'chrome-')),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for (const [width,height] of [[1280,800],[390,844],[360,640],[844,390]]) {
      const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.setViewport({width,height,isMobile:width<900,hasTouch:width<900});
      await page.goto(process.env.GAME_URL||'http://localhost:5174/',{waitUntil:'networkidle2'});
      await page.type('input[placeholder="Ej. Alvaro"]',`ShopUI${width}`);await page.click('.join-button');
      await page.waitForSelector('.area-banner');await openShop(page);await bounds(page);
      assert.equal(await page.$$eval('[data-shop-buy]',es=>es.length),3);
      assert.ok(await page.$$eval('[data-shop-buy]',es=>es.every(e=>e.disabled)),'No comprar sin saldo');
      assert.ok(await page.$eval('[data-shop-buy="hp-disc"]',e=>e.textContent.includes('50 Bits')));
      assert.ok(await page.$eval('[data-shop-buy="ep-disc"]',e=>e.textContent.includes('40 Bits')));
      assert.ok(await page.$eval('[data-shop-buy="devimon-supplies"]',e=>e.textContent.includes('1 sello')));
      if (width===1280) {
        await page.focus('[data-pve-tab="shop"]');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Cerrar mochila','Tab vuelve al cierre si todas las compras están deshabilitadas');
        await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
        assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-pve-tab')),'shop');
        await page.keyboard.press('Home');
        assert.equal(await page.$eval('[data-pve-tab="inventory"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('End');
        assert.equal(await page.$eval('[data-pve-tab="access"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.$eval('[data-pve-tab="shop"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.$eval('[data-pve-tab="access"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.$eval('[data-pve-tab="inventory"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.$eval('[data-pve-tab="access"]',e=>e.getAttribute('aria-selected')),'true');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.$eval('[data-pve-tab="shop"]',e=>e.getAttribute('aria-selected')),'true');
        // React también filtra eventos de botones disabled. Invocar su callback
        // desde la prueba simula un cliente alterado sin añadir APIs al juego.
        await page.$eval('[data-shop-buy="hp-disc"]',e=>{
          const key=Object.keys(e).find(k=>k.startsWith('__reactProps$'));
          if(!key||typeof e[key].onClick!=='function')throw Error('No se encontró el callback de compra de React');
          e[key].onClick();
        });
        try{
          await page.waitForFunction(()=>document.querySelector('.pve-dialog [role="alert"]')?.textContent.includes('No tienes suficientes Bits'),{polling:100});
        }catch(error){
          console.error('Diagnóstico de compra rechazada:',await page.$eval('.pve-dialog',e=>e.textContent));
          throw error;
        }
        assert.ok(await page.$eval('[data-shop-balance]',e=>e.textContent.startsWith('0 Bits')));
        assert.ok(await page.$eval('[data-shop-buy="hp-disc"]',e=>e.disabled));
      }
      await page.screenshot({path:path.join(output,`shop-${width}.png`)});
      await page.$eval('[data-shop-buy="devimon-supplies"]',e=>e.scrollIntoView({block:'center'}));
      assert.ok(await page.$eval('[data-shop-buy="devimon-supplies"]',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Último canje accesible por scroll');
      await page.$eval('.pve-dialog',e=>{e.scrollTop=0;});
      await page.click('[aria-label="Cerrar mochila"]');await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      assert.deepEqual(errors,[]);await context.close();
      console.log(`PASS: ${width}×${height}, precios, saldo, límites, scroll y navegación sin escapar del diálogo`);
    }
    if (process.env.SHOP_UI_TOKEN) {
      const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
      const url=process.env.GAME_URL||'http://localhost:5174/';
      await page.goto(url,{waitUntil:'networkidle2'});
      await page.evaluate(token=>localStorage.setItem('digiworld:profile-token:v1',token),process.env.SHOP_UI_TOKEN);
      await page.type('input[placeholder="Ej. Alvaro"]','ShopUIQA');await page.click('.join-button');
      await page.waitForSelector('.area-banner');await openShop(page);
      assert.ok(await page.$eval('[data-shop-balance]',e=>e.textContent.includes('1000 Bits')));
      for (const [offer,bits] of [['hp-disc',950],['ep-disc',910],['devimon-supplies',1110]]) {
        await page.waitForFunction(offer=>!document.querySelector(`[data-shop-buy="${offer}"]`)?.disabled,{},offer);
        await page.click(`[data-shop-buy="${offer}"]`);
        await page.waitForFunction(bits=>document.querySelector('[data-shop-balance]')?.textContent.startsWith(`${bits} Bits`),{},bits);
        await page.waitForSelector('.shop-receipt[role="status"]');
      }
      assert.ok(await page.$eval('[data-shop-buy="devimon-supplies"]',e=>e.disabled),'Sello ya gastado no reutilizable');
      await page.$eval('.pve-dialog',e=>{e.scrollTop=0;});await page.screenshot({path:path.join(output,'purchased-390.png')});
      await page.click('[data-pve-tab="inventory"]');
      assert.ok(await page.$eval('.pve-dialog',e=>e.textContent.includes('Disco de vida ×9')&&e.textContent.includes('Disco de energía ×6')&&e.textContent.includes('1110 Bits')));
      await page.click('[aria-label="Cerrar mochila"]');await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      await page.reload({waitUntil:'networkidle2'});await page.click('.join-button');await page.waitForSelector('.area-banner');
      await openShop(page);
      assert.ok(await page.$eval('[data-shop-balance]',e=>e.textContent.includes('1110 Bits')&&e.textContent.includes('0 sellos')));
      await page.click('[data-pve-tab="inventory"]');
      assert.ok(await page.$eval('.pve-dialog',e=>e.textContent.includes('Disco de vida ×9')&&e.textContent.includes('Disco de energía ×6')));
      await page.click('[aria-label="Cerrar mochila"]');await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      assert.deepEqual(errors,[]);await page.close();
      console.log('PASS: fixture aislada, dos compras y canje reales, inventario exacto y restauración tras recarga');
    }
    console.log(`Capturas: ${output}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
