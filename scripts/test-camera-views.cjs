const assert=require('node:assert/strict');
const puppeteer=require('puppeteer-core');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out=path.join(os.tmpdir(),'opencode','controls-qa');
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(out,'camera-')),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1280,height:800});
    await page.goto(process.env.GAME_URL||'http://localhost:5173/',{waitUntil:'networkidle2'});
    await page.type('input[placeholder="Ej. Alvaro"]','ViewsQA');await page.click('.join-button');
    await page.waitForSelector('.target-button');
    const pure=await page.evaluate(async()=>{
      const {CameraCollision}=await import('/src/game/camera-collision.ts');
      const {cameraFraming,CAMERA_DEFAULTS,smoothFactor}=await import('/src/game/camera-settings.ts');
      const THREE=await import('/node_modules/.vite/deps/three.js');
      const wall=new THREE.Mesh(new THREE.BoxGeometry(10,10,0.5),new THREE.MeshBasicMaterial());
      wall.position.set(0,2,-3);wall.updateMatrixWorld(true);
      const c=new CameraCollision(),p=new THREE.Vector3(0,1.17,0),d=new THREE.Vector3(0,0,-1);
      const blocked=c.distance(p,d,9,[wall]),free=c.distance(p,d,9,[]);
      wall.geometry.dispose();wall.material.dispose();
      const sim=fps=>{let x=0;for(let i=0;i<fps;i++)x+=(1-x)*smoothFactor(6,1/fps);return x;};
      return {blocked,free,small:cameraFraming(1.8,1,CAMERA_DEFAULTS),big:cameraFraming(6,5,CAMERA_DEFAULTS),fpsError:Math.abs(sim(30)-sim(144))};
    });
    assert.ok(pure.blocked>2&&pure.blocked<2.75);assert.equal(pure.free,9);
    assert.ok(pure.big.distance>pure.small.distance);assert.ok(pure.fpsError<1e-10);
    console.log('PASS: colisión con margen, zona libre, tamaño del compañero y suavizado independiente de FPS');
    for(const [width,height] of [[1280,800],[390,844],[844,390]]) {
      await page.setViewport({width,height});
      for(const [label,yaw] of [['frente',0],['lateral',Math.PI/2],['espalda',Math.PI],['lateral-opuesto',Math.PI*1.5]]) {
        await page.evaluate(yaw=>{const d=window.__dw;d.resetControls();d.updateCameraSettings({mode:'classic',distance:9,initialPitch:38});d.yaw=yaw;},yaw);
        await wait(1800);
        const camera=await page.evaluate(()=>window.__dw.cameraTelemetry);
        assert.ok([camera.tamer,camera.partner].every(p=>Math.abs(p.x)<0.96&&Math.abs(p.y)<0.96),`${width} ${label}: equipo visible ${JSON.stringify(camera)}`);
        await page.screenshot({path:path.join(out,`view-${width}-${label}.png`)});
      }
      console.log(`PASS: ${width}×${height}, equipo visible en cuatro direcciones`);
    }
    await page.evaluate(()=>{const d=window.__dw;d.addLook(0,-100000);});
    assert.ok(await page.evaluate(()=>window.__dw.pitch>=20*Math.PI/180),'La cámara no puede caer bajo tierra');
    await page.evaluate(()=>window.__dw.addLook(0,100000));
    assert.ok(await page.evaluate(()=>window.__dw.pitch<=65*Math.PI/180),'Inclinación máxima elevada');
    await page.evaluate(()=>{const d=window.__dw;d.updateCameraSettings({mode:'follow'});d.setTouchMove(1,0);d.lastCameraInputAt=-10000;window.__qaYaw=d.yaw;});
    await wait(1500);
    assert.ok(await page.evaluate(()=>Math.abs(window.__dw.yaw-window.__qaYaw)<0.01),'Seguimiento no provoca giro en espiral con joystick lateral');
    await page.evaluate(()=>window.__dw.resetControls());
    assert.deepEqual(errors,[]);
    console.log('PASS: límites verticales, seguimiento táctil sin espiral y sin errores JS');
    await page.click('.exit-button');await page.waitForSelector('.saved-profile');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
