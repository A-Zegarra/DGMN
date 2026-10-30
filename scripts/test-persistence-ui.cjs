const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();await page.setViewport({width:1280,height:800});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=(process.env.GAME_URL||'http://localhost:5173/')+'?ds=1';
    await page.goto(url,{waitUntil:'networkidle2'});
    await page.type('input[placeholder="Ej. Alvaro"]','SaveUIQA');
    await page.click('.join-button');
    await page.waitForSelector('.save-status');
    await page.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Guardado'));
    const initial=await page.evaluate(()=>({token:localStorage.getItem('digiworld:profile-token:v1'),profile:JSON.parse(localStorage.getItem('digiworld:saved-profile:v1'))}));
    assert.match(initial.token,/^[a-f0-9]{64}$/);assert.equal(initial.profile.name,'SaveUIQA');
    const duplicate=await browser.newPage();
    await duplicate.goto(url,{waitUntil:'networkidle2'});
    await duplicate.click('.join-button');
    await duplicate.waitForFunction(()=>document.querySelector('.form-error')?.textContent.includes('otra pestaña'));
    await duplicate.close();
    const debug=await page.evaluate(()=>Boolean(window.__dw));
    if(debug){
      await page.keyboard.down('w');await delay(800);await page.keyboard.up('w');
      await delay(500);
    }
    const before=await page.evaluate(()=>{
      const d=window.__dw,p=d?.players.get(d.localId);
      return p?{x:p.serverX,z:p.serverZ,species:p.species,level:p.level}:null;
    });
    await page.reload({waitUntil:'networkidle2'});
    await page.waitForSelector('.saved-profile');
    assert.ok(await page.$eval('.join-button',b=>b.textContent.includes('Continuar')));
    assert.equal(await page.evaluate(()=>localStorage.getItem('digiworld:profile-token:v1')),initial.token);
    await page.click('.join-button');
    await page.waitForSelector('.save-status');
    await page.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Guardado'));
    if(debug){
      const restored=await page.evaluate(()=>{const d=window.__dw,p=d.players.get(d.localId);return{x:p.serverX,z:p.serverZ,species:p.species,level:p.level};});
      assert.equal(restored.species,before.species);assert.equal(restored.level,before.level);
      assert.ok(Math.hypot(restored.x-before.x,restored.z-before.z)<0.7,'Posición restaurada');
    }
    await page.click('.exit-button');
    await page.waitForSelector('.saved-profile');
    // Un resumen local falsificado no puede cambiar el progreso canónico en el servidor.
    await page.evaluate(()=>{const key='digiworld:saved-profile:v1';const p=JSON.parse(localStorage.getItem(key));p.species='wargreymon';p.level=20;localStorage.setItem(key,JSON.stringify(p));});
    await page.reload({waitUntil:'networkidle2'});await page.click('.join-button');
    await page.waitForSelector('.save-status');
    await page.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Guardado'));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('digiworld:saved-profile:v1')).species),'koromon');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('digiworld:saved-profile:v1')).level),1);
    if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
    await page.click('.exit-button');await page.waitForSelector('.saved-profile');
    assert.deepEqual(errors,[]);
    console.log('PASS: guardado confirmado, recarga y continuación, clave estable, bloqueo de segunda pestaña, guardar/salir y rechazo de resumen local falsificado');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
