const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const puppeteer=require('puppeteer-core');
const {Client}=require('node:module').createRequire(path.resolve('apps/client/package.json'))('@colyseus/sdk');
const output=path.join(os.tmpdir(),'opencode','party-sprites-qa');
fs.mkdirSync(output,{recursive:true});

async function inspectAtlas(page,species,sheet,rows) {
  await page.waitForFunction(species=>window.__dsQa.paints.some(p=>new RegExp(`/${species}-ds(?:-[^/]+)?\\.png`).test(p.url)),{},species);
  const result=await page.evaluate(async({species,sheet,rows})=>{
    const qa=window.__dsQa;
    const records=qa.paints.filter(p=>new RegExp(`/${species}-ds(?:-[^/]+)?\\.png`).test(p.url));
    const {canvas,url}=records[0];
    const expected=new Image();expected.src=url;await expected.decode();
    const comparison=document.createElement('canvas');comparison.width=expected.width;comparison.height=expected.height;
    const ctx=comparison.getContext('2d');qa.ignore=true;
    try{ctx.drawImage(expected,0,0);}finally{qa.ignore=false;}
    const source=ctx.getImageData(0,0,expected.width,expected.height).data;
    const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let pixels=0;const equal=source.length===actual.length&&source.every((p,i)=>p===actual[i]);
    for(let i=3;i<actual.length;i+=4)if(actual[i])pixels++;
    return {width:canvas.width,height:canvas.height,pixels,equal,tag:canvas.dataset.spriteSource,paints:records.length};
  },{species,sheet,rows});
  assert.equal(result.width,384);assert.equal(result.height,48*rows);
  assert.ok(result.equal&&result.pixels>1000,`${species}: píxeles del atlas original, sin recoloreado`);
  assert.equal(result.tag,`tsr-${sheet}`);
  assert.equal(result.paints,1,`${species}: canvas compartido sin decodificar de nuevo por apariencia/jugador`);
}

(async()=>{
  const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    userDataDir:fs.mkdtempSync(path.join(output,'chrome-')),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const cases=[['gabumon','Gabumon',41249,1280,800],['patamon','Patamon',48422,1280,800],['gabumon','Gabumon',41249,390,844],['patamon','Patamon',48422,390,844]];
    const fixtures=process.env.PARTY_UI_TOKENS?JSON.parse(process.env.PARTY_UI_TOKENS):{};
    if(Object.keys(fixtures).length&&!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.GAME_URL||'http://localhost:5174/').hostname))throw Error('Las claves de fixture solo se permiten contra un servidor local aislado');
    for(const [species,name,sheet,width,height] of [...cases,...Object.keys(fixtures).map(s=>[s,s==='garurumon'?'Garurumon':'Angemon',s==='garurumon'?48583:48611,390,844])]){
      const context=await browser.createBrowserContext(),page=await context.newPage(),errors=[],models=[],remote=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/\.(glb|gltf)(\?|$)/i.test(r.url()))models.push(r.url());if(/spriters-resource|web\.archive\.org/.test(r.url()))remote.push(r.url());});
      page.on('requestfailed',r=>{if(/-ds.*\.png/.test(r.url()))failed.push(r.url());});
      await page.setViewport({width,height,isMobile:width<700,hasTouch:width<700});
      await page.evaluateOnNewDocument(()=>{
        window.__dsQa={paints:[],ignore:false};
        const draw=CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage=function(...args){
          const result=draw.apply(this,args),image=args[0];
          if(!window.__dsQa.ignore&&image instanceof HTMLImageElement&&/-ds(?:-[^/]+)?\.png/.test(image.src))window.__dsQa.paints.push({url:image.src,canvas:this.canvas});
          return result;
        };
      });
      await page.goto(process.env.GAME_URL||'http://localhost:5174/',{waitUntil:'networkidle2'});
      if(fixtures[species]){
        await page.evaluate(token=>localStorage.setItem('digiworld:profile-token:v1',token),fixtures[species]);
      }else{
        await page.evaluate(name=>[...document.querySelectorAll('.starter-card')].find(e=>e.querySelector('.starter-name')?.textContent===name).click(),name);
        await inspectAtlas(page,species,sheet,7);
        await page.screenshot({path:path.join(output,`preview-${species}-${width}.png`)});
      }
      await page.type('input[placeholder="Ej. Alvaro"]',`Sprite${species}`.slice(0,16));await page.click('.join-button');
      await page.waitForSelector('.target-button');
      await inspectAtlas(page,'tamer',48323,5);await inspectAtlas(page,species,sheet,7);
      await page.screenshot({path:path.join(output,`world-${species}-${width}.png`)});
      if(species==='gabumon'&&width===1280){
        const before=await page.$eval('.online-count',e=>parseInt(e.textContent,10));
        // Un segundo cliente de red evita tener dos renderizadores WebGL de
        // software compitiendo por CPU. La página sí dibuja ambos personajes.
        const url=new URL(process.env.GAME_URL||'http://localhost:5174/');
        const server=process.env.GAME_SERVER_URL||(['localhost','127.0.0.1','[::1]'].includes(url.hostname)?`${url.protocol}//${url.hostname}:2567`:url.origin);
        const peer=await new Client(server).joinOrCreate('world',{name:'SpriteOtroQA',species:'patamon'});
        peer.onMessage('*',()=>{});
        try{
          await page.waitForFunction(before=>parseInt(document.querySelector('.online-count')?.textContent,10)>before,{},before);
          await inspectAtlas(page,'tamer',48323,5);
        }finally{await peer.leave();}
        console.log('PASS: segundo domador con otro compañero reutiliza el canvas original sin recoloreado ni otra decodificación');
      }
      await page.keyboard.down('w');await new Promise(r=>setTimeout(r,300));await page.keyboard.up('w');
      await page.screenshot({path:path.join(output,`moving-${species}-${width}.png`)});
      assert.deepEqual(errors,[]);assert.deepEqual(models,[]);assert.deepEqual(remote,[]);assert.deepEqual(failed,[]);
      await page.click('.exit-button');await page.waitForSelector('.saved-profile');
      await context.close();console.log(`PASS: ${species}, ${width}×${height}, atlas original en visor/mundo, domador DS, caché, sin modelos 3D ni descargas externas`);
    }
    console.log(`Capturas: ${output}`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
