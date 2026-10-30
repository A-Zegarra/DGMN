const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
const {Client}=require('node:module').createRequire(path.resolve('apps/client/package.json'))('@colyseus/sdk');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const url=process.env.GAME_URL||'http://localhost:5174/';
const origin=new URL(url);
const serverURL=process.env.GAME_SERVER_URL||(['localhost','127.0.0.1','[::1]'].includes(origin.hostname)?`${origin.protocol}//${origin.hostname}:2567`:origin.origin);
const out=path.join(os.tmpdir(),'opencode','profile-access-qa');fs.mkdirSync(out,{recursive:true});
const stableSummary=({updatedAt,...rest})=>rest;
async function openBackpack(page){await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Mochila / Mapa').click());await page.waitForSelector('.pve-dialog');}
async function openAccess(page){await openBackpack(page);await page.click('[data-pve-tab="access"]');await page.waitForSelector('[aria-label="Partida y dispositivos"]');}
async function inventory(page){return page.evaluate(()=>({
  summary:JSON.parse(localStorage.getItem('digiworld:saved-profile:v1')),
  stock:[...document.querySelectorAll('.inventory-item strong')].map(e=>e.textContent),
  money:document.querySelector('.pve-columns>div>p')?.textContent,
}));}
async function privateCode(page,label){await page.waitForSelector(`output[aria-label="${label}"]`);return page.$eval(`output[aria-label="${label}"]`,e=>e.textContent.trim());}
async function importAccess(page,code,mode='link'){
  await page.click('.profile-import-toggle');await page.waitForSelector('.profile-import-dialog');
  await page.select('[aria-label="Tipo de acceso"]',mode);
  await page.type(`input[aria-label="${mode==='link'?'Código de vinculación':'Clave de recuperación'}"]`,code);
  await page.click('.profile-import-submit');
}
async function bounds(page){assert.ok(await page.$eval('[role="dialog"]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1;}),'Diálogo dentro de pantalla');}
async function saveExit(page){await page.click('[aria-label="Cerrar mochila"]');await page.click('.exit-button');await page.waitForSelector('.saved-profile');}
async function joinNetwork(token){
  let error;for(let i=0;i<4;i++)try{const room=await new Client(serverURL).joinOrCreate('world',{profileToken:token});room.onMessage('*',()=>{});return room;}catch(e){error=e;await delay(350);}
  throw error;
}

(async()=>{
  if(process.env.ACCESS_UI_TOKEN&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw Error('La fixture de acceso solo se permite en localhost');
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(out,'chrome-')),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  let peer;
  try{
    const errors=[],contexts=[];
    async function pageFor(context,width=390,height=844){const p=await context.newPage();p.setDefaultTimeout(45000);p.setDefaultNavigationTimeout(60000);p.on('pageerror',e=>errors.push(e.message));await p.setViewport({width,height,isMobile:width<700,hasTouch:width<700});await p.goto(url,{waitUntil:'networkidle2'});return p;}
    const sourceContext=await browser.createBrowserContext();contexts.push(sourceContext);
    let source=await pageFor(sourceContext,1280,800);
    if(process.env.ACCESS_UI_TOKEN)await source.evaluate(token=>localStorage.setItem('digiworld:profile-token:v1',token),process.env.ACCESS_UI_TOKEN);
    await source.type('input[placeholder="Ej. Alvaro"]','LinkSourceQA');await source.click('.join-button');await source.waitForSelector('.target-button');
    await source.waitForFunction(()=>document.querySelector('.save-status')?.textContent.includes('Guardado'));
    const sourceToken=await source.evaluate(()=>localStorage.getItem('digiworld:profile-token:v1'));
    await openBackpack(source);const initial=await inventory(source);
    await source.click('[data-pve-tab="quests"]');const quest=await source.$eval('[data-quest-progress]',e=>e.textContent);
    await source.click('[data-pve-tab="access"]');await bounds(source);
    await source.screenshot({path:path.join(out,'source-panel-1280.png')}); // Aún no contiene códigos.
    await source.waitForFunction(()=>!document.querySelector('[data-access-action="link"]')?.disabled);
    await source.click('[data-access-action="link"]');const link=await privateCode(source,'Código de vinculación');
    assert.equal(link.replaceAll('-','').length,16);
    await saveExit(source);await source.close();
    // Mantener el origen ocupado mediante SDK, sin dos renderizadores de software.
    peer=await joinNetwork(sourceToken);
    const targetContext=await browser.createBrowserContext();contexts.push(targetContext);
    const target=await pageFor(targetContext);
    await target.evaluate(()=>{
      const original=window.fetch.bind(window);let drop=true;
      window.fetch=async(...args)=>{
        const response=await original(...args);
        if(drop&&String(args[0]).includes('/room/profile-access/redeem')&&JSON.parse(args[1]?.body??'{}').mode==='link'&&response.ok){drop=false;throw new TypeError('Respuesta perdida simulada por la prueba');}
        return response;
      };
    });
    await importAccess(target,link);
    await target.waitForFunction(()=>document.querySelector('.profile-import-dialog [role="alert"]')?.textContent.includes('Conserva este navegador'));
    const staged=await target.evaluate(()=>({pending:JSON.parse(localStorage.getItem('digiworld:pending-profile-link:v1')),active:localStorage.getItem('digiworld:profile-token:v1'),summary:localStorage.getItem('digiworld:saved-profile:v1')}));
    assert.equal(staged.active,staged.pending.previousToken);assert.equal(staged.summary,null,'No reemplazar el acceso sin confirmar la respuesta');
    await target.click('.profile-import-submit');await target.waitForSelector('.profile-import-dialog',{hidden:true});
    const targetToken=await target.evaluate(()=>localStorage.getItem('digiworld:profile-token:v1'));
    assert.notEqual(targetToken,sourceToken,'Credencial propia, no copiar la clave privada del origen');
    assert.equal(targetToken,staged.pending.token,'Retomar el acceso pendiente sin gastar otro código');
    assert.deepEqual(stableSummary(await target.evaluate(()=>JSON.parse(localStorage.getItem('digiworld:saved-profile:v1')))),stableSummary(initial.summary));
    await target.click('.join-button');await target.waitForFunction(()=>document.querySelector('.form-error')?.textContent.includes('otra pestaña'));
    assert.equal(await target.$('.target-button'),null,'No abrir dos sesiones de la misma partida');
    await peer.leave();peer=null;await delay(300);
    await target.click('.join-button');await target.waitForSelector('.target-button');await openBackpack(target);
    const linked=await inventory(target);assert.deepEqual(linked.stock,initial.stock);assert.equal(linked.money,initial.money);
    await target.click('[data-pve-tab="quests"]');assert.equal(await target.$eval('[data-quest-progress]',e=>e.textContent),quest);
    await target.click('[data-pve-tab="access"]');await bounds(target);
    await target.screenshot({path:path.join(out,'target-panel-390.png')});
    await delay(5500);
    await target.click('[data-access-confirm="recovery"]');await target.click('[data-access-action="recovery"]');
    const recovery=await privateCode(target,'Clave de recuperación');assert.equal(recovery.replaceAll('-','').length,32);
    await saveExit(target);await target.close();
    // Un navegador con partida conserva su acceso: no se reemplaza desde el inicio.
    source=await pageFor(sourceContext);
    await source.click('.profile-import-toggle');await source.waitForSelector('.profile-import-dialog');
    assert.ok(await source.$eval('.profile-import-dialog',e=>e.textContent.includes('ya tiene una partida')));
    assert.equal(await source.$('.profile-import-submit'),null);
    assert.equal(await source.evaluate(()=>localStorage.getItem('digiworld:profile-token:v1')),sourceToken);
    await source.close();
    const recoveryContext=await browser.createBrowserContext();contexts.push(recoveryContext);
    const recovered=await pageFor(recoveryContext,360,640);
    await recovered.click('.profile-import-toggle');await bounds(recovered);
    await recovered.screenshot({path:path.join(out,'receive-dialog-360.png')});
    await recovered.select('[aria-label="Tipo de acceso"]','recovery');await recovered.type('input[aria-label="Clave de recuperación"]',recovery);
    assert.equal(await recovered.$eval('input[aria-label="Clave de recuperación"]',e=>e.type),'password');
    await recovered.click('.profile-import-submit');await recovered.waitForSelector('.profile-import-dialog',{hidden:true});
    const recoveredToken=await recovered.evaluate(()=>localStorage.getItem('digiworld:profile-token:v1'));
    assert.notEqual(recoveredToken,sourceToken);assert.notEqual(recoveredToken,targetToken);
    await recovered.click('.join-button');await recovered.waitForSelector('.target-button');await openBackpack(recovered);
    const restored=await inventory(recovered);assert.deepEqual(restored.stock,initial.stock);assert.equal(restored.money,initial.money);
    assert.equal(restored.summary.species,initial.summary.species);assert.equal(restored.summary.level,initial.summary.level);assert.equal(restored.summary.xp,initial.summary.xp);
    await recovered.click('[data-pve-tab="access"]');await delay(5500);
    await recovered.click('[data-access-confirm="revoke_others"]');await recovered.click('[data-access-action="revoke_others"]');
    await recovered.waitForFunction(()=>document.querySelector('.profile-access-panel')?.textContent.includes('Se desvincularon'));
    await saveExit(recovered);await recovered.close();
    await assert.rejects(new Client(serverURL).joinOrCreate('world',{profileToken:sourceToken}),/revocado/);
    await assert.rejects(new Client(serverURL).joinOrCreate('world',{profileToken:targetToken}),/revocado/);
    const invalidContext=await browser.createBrowserContext();contexts.push(invalidContext);
    const invalid=await pageFor(invalidContext);
    await importAccess(invalid,recovery,'recovery');await invalid.waitForFunction(()=>document.querySelector('.profile-import-dialog [role="alert"]')?.textContent.includes('inválido'));
    assert.equal(await invalid.evaluate(()=>localStorage.getItem('digiworld:saved-profile:v1')),null);
    await invalid.close();
    const continued=await pageFor(recoveryContext);
    await continued.click('.join-button');await continued.waitForSelector('.target-button');await openBackpack(continued);
    assert.deepEqual((await inventory(continued)).stock,initial.stock);
    await saveExit(continued);await continued.close();
    assert.deepEqual(errors,[]);for(const c of contexts)await c.close();
    console.log('PASS: PC→móvil con credenciales distintas, sesión única, inventario/misiones/nivel/XP conservados, recuperación única, revocación, no reemplazo, recarga y diálogos a 1280/390/360 px');
    console.log(`Capturas sin códigos privados: ${out}`);
  }finally{if(peer)await peer.leave();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
