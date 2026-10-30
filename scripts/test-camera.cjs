// Requiere puppeteer-core y Chrome. Ejecutar con el cliente/servidor de desarrollo activos.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
let puppeteer;
try {
  puppeteer = require('puppeteer-core');
} catch {
  puppeteer = require(path.join(os.tmpdir(), 'opencode', 'viewer-tools', 'node_modules', 'puppeteer-core'));
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1280, height: 900});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.GAME_URL || 'http://localhost:5173/', {waitUntil: 'networkidle2'});
    await page.type('input[placeholder="Ej. Alvaro"]', 'CameraQA');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Agumon')).click());
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Entrar al Bosque')).click());
    await page.waitForSelector('.target-button');
    await wait(1500);
    const check = (condition, name) => { assert.ok(condition, name); console.log('PASS:', name); };
    const pure = await page.evaluate(async () => {
      const {CameraCollision} = await import('/src/game/camera-collision.ts');
      const {CAMERA_DEFAULTS, cameraFraming, smoothFactor, validateCameraSettings} = await import('/src/game/camera-settings.ts');
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.5), new THREE.MeshBasicMaterial());
      wall.position.set(0, 2, -3); wall.updateMatrixWorld(true);
      const collision = new CameraCollision();
      const pivot = new THREE.Vector3(0, 1.17, 0), direction = new THREE.Vector3(0, 0, -1);
      const blocked = collision.distance(pivot, direction, 6, [wall]);
      const free = collision.distance(pivot, direction, 6, []);
      const raised = collision.distance(new THREE.Vector3(0, 2.17, 0), direction, 6, [wall]);
      const tiny = cameraFraming(0.7, 0.6, CAMERA_DEFAULTS);
      const giant = cameraFraming(8, 6, CAMERA_DEFAULTS);
      const simulate = fps => { let value = 0; for(let i=0;i<fps;i++) value += (1-value)*smoothFactor(6, 1/fps); return value; };
      wall.geometry.dispose(); wall.material.dispose();
      return {blocked, free, raised, tiny, giant, fpsError: Math.abs(simulate(30)-simulate(144)),
        invalid: validateCameraSettings({distance: 900, maxDistance: 20, fov: NaN}).distance};
    });
    check(pure.blocked < 2.75 && pure.blocked > 2, 'Raycast con margen: pared impide atravesar');
    check(pure.free === 6, 'Sin obstáculos se conserva el zoom solicitado');
    check(Math.abs(pure.raised - pure.blocked) < 0.001, 'Colisión estable con punto de enfoque elevado (simulación vertical)');
    check(pure.giant.distance > pure.tiny.distance && pure.giant.focus > pure.tiny.focus, 'Encuadre pequeño → gigante');
    check(pure.fpsError < 1e-10 && pure.invalid === 20, 'Interpolación 30/144 FPS y validación de ajustes');

    const inputs = await page.evaluate(() => {
      const d = window.__dw;
      d.clearKeys(); d.releaseMouse(); d.yaw = Math.PI / 2;
      const local = {rot:0};
      d.setKey('w', true); const leftOrbit = d.readInput(local, 1/60); d.clearKeys();
      d.setKey('a', true); const turn = d.readInput(local, 1/60);
      d.mouseRight = true; const strafe = d.readInput(local, 1/60); d.clearKeys();
      d.mouseRight = false; d.setKey('q', true); const q = d.readInput(local, 1/60); d.clearKeys();
      d.mouseLeft = true; d.mouseRight = true; const both = d.readInput(local, 1/60); d.releaseMouse();
      return {leftOrbit,turn,strafe,q,both};
    });
    check(inputs.leftOrbit.z === 1 && inputs.leftOrbit.x === 0, 'W conserva dirección del personaje con cámara libre');
    check(inputs.turn.yaw > 0 && inputs.turn.x === 0 && inputs.turn.z === 0, 'A gira sin desplazar');
    check(Math.hypot(inputs.strafe.x, inputs.strafe.z) > 0.9 && inputs.q.x > 0.9, 'Derecho+A y Q desplazan lateralmente');
    check(inputs.both.x > 0.9 && inputs.both.yaw > 0, 'Ambos botones avanzan hacia la cámara');

    // Gestos nativos: coordenada libre de paneles, verificando el elemento real.
    const point = await page.evaluate(() => {
      for(let y=360;y<520;y+=40) for(let x=260;x<480;x+=40) {
        if(document.elementFromPoint(x,y)?.tagName === 'CANVAS') return {x,y};
      }
      throw Error('No hay área de mundo libre de HUD');
    });
    await page.mouse.move(point.x, point.y);
    const initial = await page.evaluate(() => ({yaw:window.__dw.yaw, rot:window.__dw.players.get(window.__dw.localId).rot}));
    await page.mouse.down({button:'left'});
    await page.mouse.move(point.x + 90, point.y + 20, {steps:10});
    await page.mouse.up({button:'left'});
    await wait(400);
    const orbit = await page.evaluate(() => ({yaw:window.__dw.yaw, rot:window.__dw.players.get(window.__dw.localId).rot, locked:!!document.pointerLockElement}));
    check(Math.abs(orbit.yaw-initial.yaw)>0.1 && Math.abs(orbit.rot-initial.rot)<0.01 && !orbit.locked, 'Arrastre izquierdo real orbita sin rotar ni capturar cursor');
    const revolution = await page.evaluate(() => { const d=window.__dw; const y=d.yaw; d.addLook(-Math.PI*2/d.cameraSettings.sensitivityX,0); return d.yaw-y; });
    check(Math.abs(revolution-Math.PI*2)<1e-8, 'Rotación horizontal 360° sin límites');
    await page.mouse.down({button:'right'});
    await page.mouse.move(point.x+160,point.y+20,{steps:10});
    await wait(600);
    const right = await page.evaluate(() => {const d=window.__dw; return Math.atan2(Math.sin(d.yaw-d.players.get(d.localId).rot),Math.cos(d.yaw-d.players.get(d.localId).rot));});
    check(Math.abs(right)<0.05, 'Botón derecho real orienta al personaje');
    const before = await page.evaluate(() => {const d=window.__dw,p=d.players.get(d.localId);return {x:p.x,z:p.z,ml:d.mouseLeft,mr:d.mouseRight};});
    await page.mouse.down({button:'left'}); await wait(700);
    const mid = await page.evaluate(() => {const d=window.__dw,p=d.players.get(d.localId);return {x:p.x,z:p.z,ml:d.mouseLeft,mr:d.mouseRight,hp:p.hp};});
    await page.mouse.up({button:'left'}); await page.mouse.up({button:'right'});
    const after = await page.evaluate(() => {const d=window.__dw,p=d.players.get(d.localId);return {x:p.x,z:p.z};});
    check(Math.hypot(after.x-before.x,after.z-before.z)>0.3, 'Movimiento real con ambos botones');
    const zoomBefore = await page.evaluate(() => window.__dw.cameraSettings.distance);
    await page.mouse.wheel({deltaY:200});
    const zoom = await page.evaluate(() => ({requested:window.__dw.cameraSettings.distance, actual:window.__dw.cameraTelemetry.distance}));
    check(zoom.requested>zoomBefore && zoom.actual<zoom.requested, 'Rueda aplica zoom progresivo');
    await page.evaluate(() => {const d=window.__dw; d.updateCameraSettings({mode:'follow'});d.yaw+=1;d.lastCameraInputAt=-10000;d.setKey('w',true);});
    await wait(1800);
    const follow = await page.evaluate(() => {const d=window.__dw;d.clearKeys();return {diff:Math.abs(Math.atan2(Math.sin(d.yaw-d.players.get(d.localId).rot),Math.cos(d.yaw-d.players.get(d.localId).rot))), yaw:d.yaw, rot:d.players.get(d.localId).rot, moving:d.players.get(d.localId).moving, manual: d.mouseLeft || d.mouseRight || performance.now() - d.lastCameraInputAt < 1200, mode: d.cameraSettings.mode, follow: d.cameraSettings.follow};});
    check(follow.diff<0.75,'Seguimiento vuelve suavemente detrás al moverse');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.textContent==='Ajustes cámara').click());
    const yawBefore = await page.evaluate(() => window.__dw.yaw);
    await page.hover('.camera-settings'); await page.mouse.wheel({deltaY:100});
    check(await page.evaluate(y=>window.__dw.yaw===y,yawBefore),'La interfaz no mueve la cámara');
    await page.evaluate(() => window.__dw.updateCameraSettings({fov:73, invertY:true}));
    const saved = await page.evaluate(async () => (await import('/src/game/camera-settings.ts')).loadCameraSettings());
    check(saved.fov===73 && saved.invertY, 'Preferencias persistentes mediante localStorage');
    await page.click('[aria-label="Cerrar ajustes"]');
    await page.evaluate(() => { window.__dw.clearTarget(); window.__dw.updateCameraSettings({mode:'classic', invertY:false}); });
    await page.click('.target-button'); await page.click('.ability-button');
    const stateAfterClick = await page.evaluate(() => {
      const d = window.__dw;
      const local = d.players.get(d.localId);
      const wild = d.wilds.get(d.targetWildId);
      return { hp: local?.hp, ep: local?.ep, targetWildId: d.targetWildId, dist: wild && local ? Math.hypot(wild.x - local.x, wild.z - local.z) : null, pending: d.pendingAbility, err: d.lastError };
    });
    console.log('DEBUG combat click:', JSON.stringify(stateAfterClick));
    await page.waitForFunction(()=>window.__dw.getCombatFeed().some(e=>e.kind==='ability-out'), {timeout:30000});
    check(true,'HUD de combate: seleccionar, acercarse y lanzar habilidad');
    check(errors.length===0, 'Sin errores JavaScript');
    await page.screenshot({ path: path.join(os.tmpdir(), 'opencode', 'viewer-tools', 'ds-sprite-mode.png') });
    console.log('Salto físico: no disponible en el juego actual; comprobada la traslación vertical del cálculo de colisiones.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
