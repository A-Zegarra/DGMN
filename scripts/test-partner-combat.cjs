const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({width:960, height:720});
    const errors=[];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto((process.env.GAME_URL || 'http://localhost:5173/')+'?ds=1',{waitUntil:'networkidle2'});
    await page.type('input[placeholder="Ej. Alvaro"]','PartnerCombatQA');
    await page.evaluate(()=>[...document.querySelectorAll('.starter-card')].find(b=>b.querySelector('.starter-name')?.textContent==='Agumon').click());
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Entrar al Bosque')).click());
    await page.waitForSelector('.target-button');
    await page.waitForFunction(()=>Number.isFinite(window.__dw.players.get(window.__dw.localId)?.partnerX));
    await page.evaluate(async()=>{
      const d=window.__dw;
      d.clearTarget(); d.updateCameraSettings({mode:'classic'});
      const p=d.players.get(d.localId);
      const wild=[...d.wilds.values()].filter(w=>w.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
      const started=performance.now();
      // Solo preparar distancia de mando; el ataque posterior debe dejar quieto al domador.
      while(Math.hypot(wild.x-p.x,wild.z-p.z)>14 && performance.now()-started<40000){
        d.yaw=Math.atan2(wild.x-p.x,wild.z-p.z);d.setTouchMove(0,1);
        await new Promise(r=>setTimeout(r,80));
      }
      d.setTouchMove(0,0); d.clearKeys(); d.releaseMouse();
      await new Promise(r=>setTimeout(r,600));
      if(Math.hypot(wild.x-p.x,wild.z-p.z)>18)throw Error('No se llegó al rango de mando');
      d.setWildTarget(wild.id);
      window.__qaStart={x:p.x,z:p.z}; window.__qaEvents=[];
      const capture=m=>window.__qaEvents.push({message:m,
        target:d.getCombatPosition(m.targetId),from:d.getCombatPosition(m.casterId||m.attackerId),
        tamer:{x:p.x,z:p.z},attackAt:p.attackAt,hitAt:p.hitAt});
      d.room.onMessage('ability_used',capture);d.room.onMessage('auto_attack',capture);
    });
    await page.click('.ability-button');
    await page.waitForFunction(()=>window.__qaEvents.some(e=>e.message.casterId===window.__dw.localId),{timeout:30000});
    await page.waitForFunction(()=>window.__qaEvents.some(e=>e.message.targetId===window.__dw.localId),{timeout:15000});
    const result=await page.evaluate(()=>{
      const d=window.__dw,p=d.players.get(d.localId);
      return {start:window.__qaStart,end:{x:p.x,z:p.z},partner:{x:p.partnerX,z:p.partnerZ},hp:p.hp,ep:p.ep,
        localId:d.localId,events:window.__qaEvents,attackAt:p.attackAt,hitAt:p.hitAt};
    });
    assert.ok(Math.hypot(result.end.x-result.start.x,result.end.z-result.start.z)<0.6,'Atacar no mueve al domador');
    assert.ok(result.hp<120,'El compañero pierde HP al recibir daño');
    const outgoing=result.events.find(e=>e.message.casterId===result.localId);
    const incoming=result.events.find(e=>e.message.targetId===result.localId);
    assert.equal(outgoing.message.casterName,'Agumon');
    assert.equal(incoming.message.targetName,'Agumon');
    assert.ok(Math.hypot(outgoing.from.x-outgoing.tamer.x,outgoing.from.z-outgoing.tamer.z)>1,'El ataque sale del compañero');
    assert.ok(Math.hypot(incoming.target.x-incoming.tamer.x,incoming.target.z-incoming.tamer.z)>1,'El golpe se dirige al compañero');
    assert.ok(result.attackAt>0 && result.hitAt>0,'Animaciones activadas por eventos confirmados');
    assert.ok(result.ep<40,'Habilidad consume EP del compañero');
    assert.deepEqual(errors,[]);
    if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
    console.log(JSON.stringify(result,null,2));
    console.log('PASS: Digimon ataca/recibe daño; domador inmóvil; efectos y animaciones confirmados por servidor');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
