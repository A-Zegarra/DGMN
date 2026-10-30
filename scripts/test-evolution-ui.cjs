const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();
    await page.setViewport({width:1280,height:800});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto((process.env.GAME_URL||'http://localhost:5173/')+'?ds=1',{waitUntil:'networkidle2'});
    assert.equal(await page.$eval('.starter-card.is-selected .starter-name',el=>el.textContent),'Koromon');
    await page.type('input[placeholder="Ej. Alvaro"]','EvolutionUIQA');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Entrar al Bosque')).click());
    await page.waitForSelector('.target-button');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Evolución').click());
    await page.waitForSelector('[aria-label="Digievolución"]');
    assert.equal(await page.$$eval('.evolution-line li',els=>els.length),5);
    assert.ok(await page.$eval('.evolve-button',el=>el.disabled&&el.textContent.includes('nivel 5')));
    assert.ok(await page.$eval('.evolution-dialog',el=>el.textContent.includes('MetalGreymon')&&el.textContent.includes('WarGreymon')));
    if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
    // Intento de falsificación de nivel SOLO en desarrollo: el servidor debe rechazarlo.
    const debug=await page.evaluate(()=>Boolean(window.__dw));
    if(debug){
      const atlases=await page.evaluate(async()=>{
        const {REAL_DS_SPRITES}=await import('/src/game/models/real-ds-sprites.ts');
        return Promise.all(Object.entries(REAL_DS_SPRITES).map(async([id,sprite])=>{
          const image=new Image();image.src=sprite.url;await image.decode();
          return {id,width:image.naturalWidth,height:image.naturalHeight};
        }));
      });
      assert.ok(['koromon','agumon','greymon','metalgreymon','wargreymon'].every(id=>atlases.some(a=>a.id===id)),'Toda la línea tiene atlas original local');
      assert.ok(atlases.every(a=>a.width===384&&a.height===336),'Atlas de movimiento/ataque/reacción completos');
      await page.evaluate(()=>{const d=window.__dw;d.players.get(d.localId).level=5;});
      await page.waitForFunction(()=>!document.querySelector('.evolve-button').disabled);
      await page.click('.evolve-button');
      await page.waitForFunction(()=>window.__dw.lastError?.text.includes('nivel 5'));
      assert.equal(await page.evaluate(()=>window.__dw.players.get(window.__dw.localId).species),'koromon');
      await page.evaluate(()=>{const d=window.__dw;d.players.get(d.localId).level=1;});
    }
    await page.click('[aria-label="Cerrar evolución"]');
    await page.setViewport({width:390,height:780});
    await page.waitForSelector('.target-button');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Evolución').click());
    await page.waitForSelector('.evolution-dialog');
    const bounds=await page.$eval('.evolution-dialog',el=>{const r=el.getBoundingClientRect();return{x:r.x,right:r.right,height:r.height};});
    assert.ok(bounds.x>=0&&bounds.right<=390&&bounds.height<780,'Diálogo accesible en móvil');
    assert.deepEqual(errors,[]);
    console.log('PASS: Koromon inicial, línea completa visible, requisito Nv.5, bloqueo de nivel'+(debug?', rechazo de nivel falsificado':'')+', interfaz móvil sin errores');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
