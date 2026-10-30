// Navegador real: teclado/ratón, multitáctil CDP, ventanas y distribución.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.join(os.tmpdir(), 'opencode', 'controls-qa');
fs.mkdirSync(output, {recursive:true});
const report = [];
const check = (condition, label) => { assert.ok(condition, label); report.push(label); console.log('PASS:', label); };

async function state(page) {
  return page.evaluate(() => {
    const d = window.__dw, p = d.players.get(d.localId);
    return {x:p.x,z:p.z,sx:p.serverX,sz:p.serverZ,rot:p.rot,yaw:d.yaw,pitch:d.pitch,
      input:d.readInput(p,1/60),blocked:d.inputBlocked,touch:d.touchMoving,
      left:d.mouseLeft,right:d.mouseRight,camera:d.cameraTelemetry};
  });
}
async function clickText(page, text) {
  const selector = await page.evaluate(text => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    if (!button) throw Error(`Falta botón: ${text}`);
    button.setAttribute('data-qa-click', 'true');
    return '[data-qa-click="true"]';
  }, text);
  await page.click(selector);
  await page.evaluate(() => document.querySelector('[data-qa-click]')?.removeAttribute('data-qa-click'));
}
async function layout(page, label) {
  const problems = await page.evaluate(() => {
    const selectors = ['.status-panel','.brand-panel','.area-banner','.partner-panel','.combat-panel','.ability-bar','.virtual-joystick','.chat-toggle'];
    const boxes = selectors.map(selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return e && r.width && r.height && getComputedStyle(e).display !== 'none' ? {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom} : null;
    }).filter(Boolean);
    const problems = [];
    for (const a of boxes) {
      if (a.x < -1 || a.y < -1 || a.right > innerWidth+1 || a.bottom > innerHeight+1) problems.push(`fuera: ${a.selector}`);
      for (const b of boxes) if (a.selector < b.selector && Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)
        problems.push(`solapamiento: ${a.selector} / ${b.selector}`);
    }
    for (const e of document.querySelectorAll('.status-panel button,.ability-bar button,.virtual-joystick,.chat-toggle')) {
      const r=e.getBoundingClientRect();
      if (!r.width || !r.height || e.disabled) continue;
      const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      if (!e.contains(hit)) problems.push(`tap bloqueado: ${e.className}`);
    }
    return problems;
  });
  check(problems.length===0, `${label}: sin solapamientos, botones accesibles (${problems.join('; ')})`);
}

(async () => {
  const browser=await puppeteer.launch({
    executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(output,'chrome-')),headless:true,
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  });
  try {
    for (const [width,height,touch] of [[1280,800,false],[1024,768,false],[390,844,true],[360,640,true],[844,390,true],[667,375,true]]) {
      const context=await browser.createBrowserContext();
      const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setViewport({width,height,isMobile:touch,hasTouch:touch});
      await page.goto(process.env.GAME_URL||'http://localhost:5173/',{waitUntil:'networkidle2'});
      await page.type('input[placeholder="Ej. Alvaro"]',`ControlQA${width}`);
      await page.click('.join-button');
      await page.waitForSelector('.target-button');
      await page.waitForFunction(()=>window.__dw?.players.has(window.__dw.localId));
      await wait(800);
      const framing=(await state(page)).camera;
      check([framing.tamer,framing.partner].every(p=>Math.abs(p.x)<0.9&&Math.abs(p.y)<0.9),`${width}: domador y compañero visibles al explorar`);
      await layout(page,`${width}×${height} exploración`);
      await page.screenshot({path:path.join(output,`idle-${width}.png`)});
      await page.click('.target-button');
      await page.waitForSelector('.combat-panel');
      await layout(page,`${width}×${height} objetivo`);
      await page.screenshot({path:path.join(output,`target-${width}.png`)});
      await page.click('.combat-close');
      await page.evaluate(()=>window.__dw.recallCompanion());

      if (width===1280) {
        let before=await state(page);
        await page.keyboard.down('w');await wait(900);await page.keyboard.up('w');await wait(200);
        let after=await state(page);
        if(Math.hypot(after.sx-before.sx,after.sz-before.sz)<=0.6) console.log('W DIAG',before,after,await page.evaluate(()=>({keys:[...window.__dw.keys],active:document.activeElement?.outerHTML})));
        check(Math.hypot(after.sx-before.sx,after.sz-before.sz)>0.6,'W mueve al domador en el servidor');
        check(after.input.x===0&&after.input.z===0,'Soltar W detiene movimiento');
        before=after;
        await page.keyboard.down('a');await wait(400);await page.keyboard.up('a');
        after=await state(page);
        check(Math.abs(after.rot-before.rot)>0.3&&Math.hypot(after.sx-before.sx,after.sz-before.sz)<0.2,'A gira sin caminar');
        await page.keyboard.down('q');await wait(550);await page.keyboard.up('q');await wait(150);
        check(Math.hypot((await state(page)).sx-after.sx,(await state(page)).sz-after.sz)>0.4,'Q permite desplazamiento lateral');
        await page.keyboard.down('w');await wait(150);
        await clickText(page,'Mochila / Mapa');await wait(100);
        check((await state(page)).blocked&&!(await state(page)).input.x&&!(await state(page)).input.z,'Abrir mochila cancela teclas mantenidas');
        await page.keyboard.up('w');await page.keyboard.down('w');await wait(150);await page.keyboard.up('w');
        check(!(await state(page)).input.x&&!(await state(page)).input.z,'W dentro de mochila no mueve al personaje');
        await page.click('[aria-label="Cerrar mochila"]');
        check(!(await state(page)).blocked,'Cerrar mochila devuelve controles');
        await page.keyboard.down('w');await wait(100);
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await wait(100);
        check(!(await state(page)).input.x&&!(await state(page)).input.z,'Perder foco detiene inmediatamente');
        await page.keyboard.up('w');
        await page.keyboard.press('Enter');await page.waitForSelector('.chat-panel');
        await page.keyboard.type('wasd qe');
        check(!(await state(page)).input.x&&!(await state(page)).input.z,'Escribir en chat no mueve ni gira');
        await page.keyboard.press('Escape');await page.waitForSelector('.chat-panel',{hidden:true});
        await page.keyboard.down('w');await wait(250);await page.keyboard.up('w');
        check(!(await state(page)).blocked,'Teclado recuperado después del chat');
        before=await state(page);
        await page.evaluate(()=>{const d=window.__dw;window.__qaUpdate=d.update;d.update=()=>{};});
        await page.keyboard.down('w');await wait(700);await page.keyboard.up('w');await wait(150);
        after=await state(page);
        await page.evaluate(()=>{window.__dw.update=window.__qaUpdate;delete window.__qaUpdate;});
        check(Math.hypot(after.sx-before.sx,after.sz-before.sz)>1.5,'El servidor recibe movimiento aunque se suspenda la actualización visual');
        check(!after.input.x&&!after.input.z,'Parada independiente del renderizado');
        for (const [key,axis] of [['s','move'],['e','move'],['d','turn'],['ArrowUp','move'],['ArrowDown','move'],['ArrowLeft','turn'],['ArrowRight','turn']]) {
          const initial=await state(page);
          await page.keyboard.down(key);await wait(180);
          const held=await state(page);
          await page.keyboard.up(key);
          check(axis==='move'?Math.hypot(held.input.x,held.input.z)>0.9:Math.abs(held.rot-initial.rot)>0.1,`${key}: entrada de ${axis==='move'?'movimiento':'giro'} operativa`);
        }
        await page.keyboard.down('Shift');await page.keyboard.down('w');
        check((await state(page)).input.run,'Shift + W activa correr');
        await page.keyboard.up('Shift');
        check(!(await state(page)).input.run,'Soltar Shift vuelve a caminar');
        await page.keyboard.up('w');
        const point={x:width/2,y:height/2};
        await page.mouse.move(point.x,point.y);
        before=await state(page);
        await page.mouse.down({button:'left'});await page.mouse.move(point.x+100,point.y+30,{steps:8});await page.mouse.up({button:'left'});
        after=await state(page);
        check(Math.abs(after.yaw-before.yaw)>0.15&&Math.abs(after.rot-before.rot)<0.02,'Órbita izquierda sin girar al domador');
        await page.mouse.down({button:'right'});await page.mouse.move(point.x+150,point.y+30,{steps:8});await wait(250);
        after=await state(page);
        check(Math.abs(Math.atan2(Math.sin(after.rot-after.yaw),Math.cos(after.rot-after.yaw)))<0.05,'Ratón derecho orienta al domador');
        before=after;
        await page.mouse.down({button:'left'});await wait(350);
        await page.mouse.up({button:'left'});await page.mouse.up({button:'right'});
        after=await state(page);
        check(Math.hypot(after.x-before.x,after.z-before.z)>0.5,'Ambos botones avanzan, incluso sin mover el ratón');
        check(!after.left&&!after.right&&!after.input.x&&!after.input.z,'Soltar ambos botones detiene');
        const zoom=await page.evaluate(()=>window.__dw.cameraSettings.distance);
        await page.mouse.wheel({deltaY:160});
        check(await page.evaluate(zoom=>window.__dw.cameraSettings.distance>zoom,zoom),'Rueda aleja la cámara');
        await page.mouse.wheel({deltaY:-160});
        check(await page.evaluate(zoom=>Math.abs(window.__dw.cameraSettings.distance-zoom)<0.01,zoom),'Rueda acerca la cámara');
        await clickText(page,'Ajustes cámara');
        await page.waitForSelector('.camera-settings');
        const pitch=await page.$eval('input[aria-label="Inclinación elevada DS (°)"]',e=>Number(e.value));
        await page.focus('input[aria-label="Inclinación elevada DS (°)"]');await page.keyboard.press('ArrowRight');
        check((await state(page)).pitch>pitch*Math.PI/180,'Control de inclinación cambia la vista inmediatamente');
        await page.click('[aria-label="Cerrar ajustes"]');
      }

      if (touch) {
        const cdp=await page.createCDPSession();
        await page.$eval('.virtual-joystick',e=>e.addEventListener('pointerdown',event=>{window.__qaPointerId=event.pointerId;},true));
        const rect=await page.$eval('.virtual-joystick',e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
        const first={id:1,x:rect.x,y:rect.y-29};
        const second={id:2,x:rect.x+18,y:rect.y+18};
        const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
        let before=await state(page);
        await send('touchStart',[first]);await wait(220);
        check((await state(page)).touch,`${width}: joystick inicia con dedo real`);
        const heading=(await state(page)).input;
        await send('touchStart',[first,second]);await wait(100);
        const held=(await state(page)).input;
        check(Math.abs(held.x-heading.x)<0.05&&Math.abs(held.z-heading.z)<0.05,`${width}: segundo dedo no secuestra el joystick`);
        await send('touchEnd',[second]);
        check((await state(page)).touch,`${width}: soltar segundo dedo no detiene al primero`);
        const look={id:3,x:width*0.65,y:height*0.52};
        const yaw=(await state(page)).yaw;
        await send('touchStart',[first,look]);
        await send('touchMove',[first,{...look,x:look.x+42,y:look.y+10}]);await wait(180);
        const looking=await state(page);
        check(looking.touch&&Math.abs(looking.yaw-yaw)>0.06,`${width}: mover y mirar simultáneamente`);
        await send('touchEnd',[]);await wait(140);
        const after=await state(page);
        check(!after.touch&&!after.input.x&&!after.input.z,`${width}: soltar dedos detiene sin atascarse`);
        check(Math.hypot(after.sx-before.sx,after.sz-before.sz)>0.4,`${width}: joystick mueve en servidor`);
        await send('touchStart',[first]);await send('touchCancel',[]);await wait(80);
        check(!(await state(page)).touch,`${width}: pointercancel libera el joystick`);
        await send('touchStart',[first]);
        await send('touchMove',[{...first,y:first.y-1}]);
        await page.evaluate(()=>document.querySelector('.virtual-joystick').releasePointerCapture(window.__qaPointerId));
        await send('touchMove',[first]);
        check(!(await state(page)).touch,`${width}: pérdida nativa de captura libera el joystick`);
        await send('touchEnd',[]);
        await send('touchStart',[first]);
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        check(!(await state(page)).touch,`${width}: perder foco libera dedo y mando`);
        await send('touchEnd',[]);
        await clickText(page,'Mochila / Mapa');
        await send('touchStart',[first]);await send('touchMove',[{...first,y:first.y-20}]);
        check(!(await state(page)).touch,`${width}: ventanas no dejan activar joystick debajo`);
        await send('touchEnd',[]);await page.click('[aria-label="Cerrar mochila"]');
        await send('touchStart',[first]);await wait(100);
        check((await state(page)).touch,`${width}: joystick reutilizable después de ventana`);
        await send('touchEnd',[]);
        await cdp.detach();
      }
      check(errors.length===0,`${width}: sin errores JavaScript (${errors.join('; ')})`);
      await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      await context.close();
    }
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log(`Capturas y resultados: ${output}`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
