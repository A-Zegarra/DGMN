// Cliente y servidor locales activos. puppeteer-core debe estar en NODE_PATH.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({width:1280, height:800});
    const errors = [];
    const models = [];
    page.on('request', request => { if (/\.(glb|gltf)(\?|$)/i.test(request.url())) models.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => localStorage.setItem('digiworld:visual-mode:v1','3d'));
    await page.goto((process.env.GAME_URL || 'http://localhost:5173/') + '?3d=1', {waitUntil:'networkidle2'});
    await page.evaluate(() => [...document.querySelectorAll('.starter-card')].find(b => b.querySelector('.starter-name')?.textContent === 'Agumon').click());
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => e.initiatorType === 'img' && /agumon-ds.*\.png/.test(e.name)));
    const source = await page.evaluate(() => performance.getEntriesByType('resource').find(e => e.initiatorType === 'img' && /agumon-ds.*\.png/.test(e.name))?.name);
    assert.ok(source, 'El visor solicita el atlas real');
    const dimensions = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, source);
    assert.deepEqual(dimensions, [384, 336]);
    await page.screenshot({path:path.join(os.tmpdir(), 'opencode', 'agumon-real-preview.png')});
    await page.type('input[placeholder="Ej. Alvaro"]', 'AgumonRealQA');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Entrar al Bosque')).click());
    await page.waitForSelector('.target-button');
    assert.equal(await page.$eval('.sprite-mode-label', element => element.textContent),'Sprites DS');
    await page.keyboard.press('v');
    assert.equal(await page.$eval('.sprite-mode-label', element => element.textContent),'Sprites DS');
    assert.ok(await page.evaluate(() => ![...document.querySelectorAll('button')].some(b => /Vista 3D|Cambiar a 3D|modo 3D/i.test(b.textContent))));
    await page.click('.target-button');
    assert.ok(await page.evaluate(() => document.querySelector('.combat-panel')?.textContent.includes('salvaje')));
    assert.deepEqual(errors, []);
    assert.deepEqual(models, [], 'No cargar modelos GLB/GLTF ni con preferencias antiguas');
    console.log('PASS: atlas DS original, visor y juego sin opción 3D, tecla V inactiva, preferencias antiguas ignoradas y cero peticiones GLB/GLTF');
    console.log('Captura: ' + path.join(os.tmpdir(), 'opencode', 'agumon-real-preview.png'));
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
