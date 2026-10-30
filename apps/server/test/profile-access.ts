import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import express from "express";
import { companionVitals } from "@digiworld/content";
import { ProfileStore, profileKey, type StoredProfile } from "../src/storage/profile-store.js";
import { ProfileAccess, LINK_TTL_MS, ProfileAccessError } from "../src/storage/profile-access.js";
import { AccessLimiter, PROFILE_IMPORT_PATH, registerProfileAccessRoutes } from "../src/profile-access-routes.js";
import { WorldRoom } from "../src/rooms/WorldRoom.js";
import type { Client, CloseCode } from "colyseus";

const token=()=>randomBytes(32).toString("hex");
const base=join(tmpdir(),"opencode");mkdirSync(base,{recursive:true});
const dir=mkdtempSync(join(base,"profile-access-test-"));
const source=token(),key=profileKey(source),owner="source";
const {maxHp,maxEp}=companionVitals("metalgreymon",14);
const profile:StoredProfile={name:"LinkedQA",species:"metalgreymon",level:14,xp:78,xpNext:800,hp:maxHp,ep:maxEp,
  x:4,z:5,rot:0,partnerX:6,partnerZ:5,partnerRot:0,duelWins:4,duelLosses:2,updatedAt:Date.now(),
  inventory:{bits:1234,hpPotion:7,epPotion:4,devimonSeals:2},quests:{completed:["pradera-datos"],kills:2},
  cooldowns:{metalgreymon_giga:Date.now()+20000},itemReadyAt:Date.now()+8000};
// Archivo de la versión anterior, sin accesos: la migración no mueve los perfiles.
writeFileSync(join(dir,"profiles.json"),JSON.stringify({version:1,profiles:{[key]:profile}}));
const store=new ProfileStore(dir);assert.equal(store.acquire(source,owner),key);
let now=1000000;
const access=new ProfileAccess(store,()=>now);
const request=(code:string,mode:"link"|"recovery"="link",target=token(),previous=token())=>({mode,code,token:target,previousToken:previous});
const first=access.issueLink(key,owner);
assert.match(first.code,/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
assert.equal(first.expiresAt,now+LINK_TTL_MS);
const linked=request(first.code.toLowerCase().replaceAll("-"," "));
const [result,retry]=await Promise.all([access.redeem(linked),access.redeem(linked)]);
assert.deepEqual(result,retry);assert.equal(result.species,"metalgreymon");
await assert.rejects(access.redeem(request(first.code)),/inválido/);
assert.throws(()=>store.acquire(linked.token,"duplicate"),/ya está abierta/,"Una sola sesión incluso con credenciales distintas");
const json=readFileSync(store.file,"utf8");
for(const secret of [source,linked.token,first.code.replaceAll("-","")])assert.ok(!json.includes(secret),"No guardar credenciales/códigos en claro");
assert.equal(JSON.parse(json).version,2);
assert.deepEqual(JSON.parse(json).profiles[key],profile,"Progreso sin copias ni pérdidas en migración/vinculación");
store.release(key,owner);
let reloaded=new ProfileStore(dir);
assert.equal(reloaded.acquire(linked.token,"mobile"),key);
assert.deepEqual(reloaded.get(key),profile);
assert.throws(()=>reloaded.acquire(source,"pc"),/ya está abierta/);
reloaded.release(key,"mobile");
assert.equal(reloaded.acquire(source,owner),key,"El origen conserva su acceso");
let again=new ProfileAccess(reloaded,()=>now);
assert.equal((await again.redeem({mode:"resume",token:linked.token,previousToken:linked.previousToken})).name,profile.name,"Retomar respuesta perdida después de reiniciar");
await assert.rejects(again.redeem(request(first.code)),/inválido/,"Los enlaces no sobreviven al reinicio");
const canceled=again.issueLink(key,owner);again.cancelLink(key);
await assert.rejects(again.redeem(request(canceled.code)),/inválido/);
const replaced=again.issueLink(key,owner);again.issueLink(key,owner);
await assert.rejects(again.redeem(request(replaced.code)),/inválido/);
const expired=again.issueLink(key,owner);now+=LINK_TTL_MS;
await assert.rejects(again.redeem(request(expired.code)),/inválido/);
for(const bad of [null,{},[],{mode:"unknown",token:token(),previousToken:token()},request("x"),request("0".repeat(16))]){
  await assert.rejects(again.redeem(bad as any));
}
const protectedCode=again.issueLink(key,owner),other=token(),otherKey=reloaded.acquire(other,"other");
await reloaded.save(otherKey,"other",{...profile,name:"OtherQA"});reloaded.release(otherKey,"other");
await assert.rejects(again.redeem(request(protectedCode.code,"link",token(),other)),/ya tiene una partida/);
assert.equal(reloaded.get(otherKey)!.name,"OtherQA");
await again.redeem(request(protectedCode.code)); // El rechazo no consume el código.

const recovery=await again.issueRecovery(key,owner);
assert.equal(recovery.replaceAll("-","").length,32);
reloaded.release(key,owner);
const afterRecoveryStore=new ProfileStore(dir);
afterRecoveryStore.acquire(source,owner);
const afterRecoveryRestart=new ProfileAccess(afterRecoveryStore,()=>now);
const recovered=request(recovery,"recovery");
await afterRecoveryRestart.redeem(recovered);
await assert.rejects(afterRecoveryRestart.redeem(request(recovery,"recovery")),/inválido/);
reloaded=afterRecoveryStore;again=afterRecoveryRestart;
const replacedRecovery=await again.issueRecovery(key,owner);
const latestRecovery=await again.issueRecovery(key,owner);
await assert.rejects(again.redeem(request(replacedRecovery,"recovery")),/inválido/);
assert.ok(!readFileSync(reloaded.file,"utf8").includes(latestRecovery.replaceAll("-","")));
const outstanding=again.issueLink(key,owner);
await again.revokeOthers(key,owner);
assert.throws(()=>reloaded.acquire(linked.token,"revoked"),/revocado/);
await assert.rejects(again.redeem(request(latestRecovery,"recovery")),/inválido/);
await assert.rejects(again.redeem(request(outstanding.code)),/inválido/);
reloaded.release(key,owner);assert.equal(reloaded.acquire(source,owner),key);

// Revocar desde un alias también invalida la credencial primaria antigua.
const lastLink=again.issueLink(key,owner),keeper=request(lastLink.code);
await again.redeem(keeper);reloaded.release(key,owner);
reloaded.acquire(keeper.token,"keeper");
await again.revokeOthers(key,"keeper");
reloaded.release(key,"keeper");
const finalStore=new ProfileStore(dir);
assert.throws(()=>finalStore.acquire(source,"old-root"),/revocado/);
assert.equal(finalStore.acquire(keeper.token,"keeper"),key);
assert.deepEqual(finalStore.get(key),profile);

// Un autoguardado encolado junto a un enlace no puede borrar ese enlace.
const simultaneous=new ProfileAccess(finalStore,()=>now),concurrent=simultaneous.issueLink(key,"keeper");
const nextDevice=request(concurrent.code);
const grant=simultaneous.redeem(nextDevice);
const save=finalStore.save(key,"keeper",{...profile,xp:79});
await Promise.all([grant,save]);
const concurrentStore=new ProfileStore(dir);
assert.equal(concurrentStore.acquire(nextDevice.token,"concurrent"),key);
assert.equal(concurrentStore.get(key)!.xp,79);
const staleLink=simultaneous.issueLink(key,"keeper");
const revoking=simultaneous.revokeOthers(key,"keeper");
const staleGrant=assert.rejects(simultaneous.redeem(request(staleLink.code)),/inválido/);
await Promise.all([revoking,staleGrant]);

const gateCode=simultaneous.issueLink(key,"keeper"),gated=request(gateCode.code);
const originalWrite=finalStore["writeSnapshot"].bind(finalStore);
let releaseGate!:()=>void,enteredGate!:()=>void;
const gate=new Promise<void>(resolve=>{releaseGate=resolve;});
const entered=new Promise<void>(resolve=>{enteredGate=resolve;});
finalStore["writeSnapshot"]=async data=>{enteredGate();await gate;return originalWrite(data);};
const gatedGrant=simultaneous.redeem(gated);
await entered;
assert.throws(()=>finalStore.acquire(gated.token,"race-target"),/confirmando/);
assert.throws(()=>finalStore.acquire(gated.previousToken,"race-previous"),/confirmando/);
releaseGate();await gatedGrant;finalStore["writeSnapshot"]=originalWrite;
assert.equal(new ProfileStore(dir).get(key)!.xp,79,"No crear perfiles que colisionen con alias durante el fsync");

const invalidDir=mkdtempSync(join(base,"profile-access-invalid-"));
const invalidPath=join(invalidDir,"profiles.json"),invalidData=JSON.parse(readFileSync(finalStore.file,"utf8"));
invalidData.access.aliases[profileKey(token())]=profileKey(token());
writeFileSync(invalidPath,JSON.stringify(invalidData));
const untouched=readFileSync(invalidPath,"utf8");
assert.throws(()=>new ProfileStore(invalidDir),/Alias/);
assert.equal(readFileSync(invalidPath,"utf8"),untouched,"No sobrescribir accesos corruptos");

// Fallo de disco: no se entrega una credencial que solo exista en memoria.
const blocked=join(dir,"blocked");writeFileSync(blocked,"file");
const failing=new ProfileStore(blocked),failureSource=token(),failureKey=failing.acquire(failureSource,"failure");
await assert.rejects(failing.save(failureKey,"failure",profile));
const failAccess=new ProfileAccess(failing,()=>now),failCode=failAccess.issueLink(failureKey,"failure"),failRequest=request(failCode.code);
await assert.rejects(failAccess.redeem(failRequest));
assert.equal(failing.linkedSummary(failRequest.token,failRequest.previousToken),undefined);
unlinkSync(blocked);await failing.save(failureKey,"failure",profile);
await failAccess.redeem(failRequest);

const cappedStore=new ProfileStore(mkdtempSync(join(base,"profile-access-cap-"))),capToken=token(),capKey=cappedStore.acquire(capToken,"cap");
await cappedStore.save(capKey,"cap",profile);
const capped=new ProfileAccess(cappedStore,()=>now);
assert.throws(()=>capped.issueLink(capKey,"other-owner"),/no pertenece/);
await assert.rejects(capped.issueRecovery(capKey,"other-owner"),/no pertenece/);
await assert.rejects(capped.revokeOthers(capKey,"other-owner"),/no pertenece/);
for(let i=0;i<16;i++)await capped.redeem(request(capped.issueLink(capKey,"cap").code));
await assert.rejects(capped.redeem(request(capped.issueLink(capKey,"cap").code)),/Límite/);
assert.equal(await capped.revokeOthers(capKey,"cap"),16);
await capped.redeem(request(capped.issueLink(capKey,"cap").code));

// Autoridad de sala y mensajes privados; ningún secreto se emite por broadcast.
const roomDir=mkdtempSync(join(base,"profile-access-room-test-")),roomStore=new ProfileStore(roomDir);
const room=new WorldRoom(),events:Array<{type:string;payload:any}>=[];
Object.assign(room,{profileStore:roomStore,profileAccess:new ProfileAccess(roomStore,()=>now),systemChat:()=>{},sendTo:()=>{},broadcast:()=>{throw Error("No publicar códigos");}});
const c={sessionId:"source",send:(type:string,payload:any)=>events.push({type,payload})} as unknown as Client;
room.onJoin(c,{profileToken:token(),name:"AccessRoom"});
await room["handleProfileAccess"](c,{action:"link"});
assert.ok(events.find(e=>e.type==="profile_access")?.payload.code);
await room["handleProfileAccess"](c,{action:"recovery"});
assert.ok(events.find(e=>e.type==="profile_access_error")?.payload.reason.includes("5 segundos"));
await room.onLeave(c,1000 as CloseCode);

// HTTP real: secretos en JSON, no caché, CORS acotado, límites y errores genéricos.
const http=express(),httpAccess=new ProfileAccess(finalStore,()=>now),httpCode=httpAccess.issueLink(key,"keeper");
registerProfileAccessRoutes(http,()=>httpAccess,new AccessLimiter(()=>now));
const server=http.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address();if(!address||typeof address==="string")throw Error("No HTTP fixture");
const url=`http://127.0.0.1:${address.port}${PROFILE_IMPORT_PATH}`;
try{
  const post=(body:unknown,headers:Record<string,string>={})=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
  const preflight=await fetch(url,{method:"OPTIONS",headers:{Origin:"http://localhost:5174"}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get("access-control-allow-origin"),"http://localhost:5174");
  assert.equal((await post(request(httpCode.code),{Origin:"https://evil.example"})).status,403);
  assert.equal((await fetch(url)).status,405);
  const bad=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:'{"code":"secret'});
  assert.equal(bad.status,400);assert.ok(!(await bad.text()).includes("secret"));
  const imported=await post(request(httpCode.code),{Origin:"http://localhost:5174"});
  assert.equal(imported.status,200);assert.ok(imported.headers.get("cache-control")?.includes("no-store"));
  const response=await imported.json();assert.equal(response.profile.level,14);assert.ok(!JSON.stringify(response).includes(source));
  assert.equal((await post({...request("x"),padding:"x".repeat(3000)})).status,400);
  for(let i=0;i<12;i++)await post(request("x"));
  const limited=await post(request("x"));assert.equal(limited.status,429);assert.equal(limited.headers.get("retry-after"),"60");
}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
let clock=0;const limiter=new AccessLimiter(()=>clock);
for(let i=0;i<10;i++)assert.ok(limiter.take("ip"));
for(let i=0;i<1000;i++)assert.equal(limiter.take("ip"),false);
assert.ok(limiter.take("different-ip"),"Los rechazos de una IP no agotan el cupo global");
clock=60001;assert.ok(limiter.take("ip"));
console.log("PASS: migración v1→v2, enlaces privados/temporales/únicos, credenciales independientes, recuperación, revocación, sesión única, no reemplazo, carreras, disco, HTTP/CORS/límites y sin secretos en respuestas/logs");
