// Prueba por WebSocket, sin depender de las herramientas de depuración del navegador.
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const path = require('node:path');
const {Client} = createRequire(path.resolve(__dirname,'../apps/client/package.json'))('@colyseus/sdk');
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function until(condition, timeout=20000) {
  const start=Date.now();
  while(!condition()) {if(Date.now()-start>timeout)throw Error('Tiempo de espera agotado');await delay(80);}
}
(async()=>{
  const room=await new Client(process.env.GAME_URL || 'http://localhost:2567').joinOrCreate('world',{name:'PartnerNetQA',species:'agumon'});
  const events=[];
  room.onMessage('*', (type,message)=>events.push({type,message}));
  try {
    await until(()=>room.state?.players?.get(room.sessionId));
    const p=room.state.players.get(room.sessionId);
    assert.ok(Number.isFinite(p.partnerX),'Esquema nuevo activo en servidor');
    const wild=[...room.state.wilds.values()].filter(w=>w.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    const started=Date.now();
    while(Math.hypot(wild.x-p.x,wild.z-p.z)>13){
      if(Date.now()-started>30000)throw Error('No se llegó al rango de mando');
      const dx=wild.x-p.x,dz=wild.z-p.z,d=Math.hypot(dx,dz);
      room.send('input',{x:dx/d,z:dz/d,run:true,yaw:Math.atan2(dx,dz)});await delay(80);
    }
    room.send('input',{x:0,z:0,run:false,yaw:p.rot});
    await until(()=>!p.moving);
    await delay(250);
    const start={x:p.x,z:p.z};
    const wildId=[...room.state.wilds.entries()].find(([,value])=>value===wild)[0];
    room.send('wild_target',{wildId});
    await until(()=>Math.hypot(wild.x-p.partnerX,wild.z-p.partnerZ)<7);
    room.send('use_ability',{abilityId:'agumon_claw'});
    await until(()=>events.some(e=>e.type==='ability_used'&&e.message.casterId===room.sessionId));
    await until(()=>events.some(e=>e.type==='auto_attack'&&e.message.targetId===room.sessionId));
    await until(()=>p.hp<120 && p.ep<40);
    assert.ok(Math.hypot(p.x-start.x,p.z-start.z)<0.05,`El domador permanece inmóvil: ${JSON.stringify({start,end:{x:p.x,z:p.z}})}`);
    assert.ok(p.hp<120,'Daño al Digimon sincronizado');
    assert.ok(p.ep<40,'EP del Digimon consumida');
    assert.ok(Math.hypot(p.partnerX-p.x,p.partnerZ-p.z)>2,'Compañero separado del domador');
    console.log(JSON.stringify({hp:p.hp,ep:p.ep,tamer:{x:p.x,z:p.z},partner:{x:p.partnerX,z:p.partnerZ}},null,2));
    console.log('PASS: servidor desplegado, posición independiente, habilidad y daño recibido por el Digimon');
  } finally {await room.leave();}
})().catch(e=>{console.error(e);process.exitCode=1;});
