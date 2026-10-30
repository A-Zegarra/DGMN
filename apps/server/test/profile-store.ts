import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProfileStore, profileKey, type StoredProfile } from "../src/storage/profile-store.js";

const base=join(tmpdir(),"opencode"); mkdirSync(base,{recursive:true});
const directory=mkdtempSync(join(base,"profile-store-test-"));
const token="a".repeat(64);
const profile:StoredProfile={name:"SaveQA",species:"wargreymon",level:20,xp:42,xpNext:1000,
  hp:386,ep:100,x:10,z:20,rot:0.5,partnerX:12,partnerZ:22,partnerRot:0.6,
  duelWins:12,duelLosses:3,updatedAt:Date.now(),cooldowns:{wargreymon_gaia:Date.now()+10000}};
const store=new ProfileStore(directory);
const key=store.acquire(token,"session-a");
assert.equal(key,profileKey(token));
assert.throws(()=>store.acquire(token,"session-b"),/ya está abierta/);
store.release(key,"wrong-session");
assert.throws(()=>store.acquire(token,"session-b"),/ya está abierta/);
await store.save(key,"session-a",profile);
await Promise.all(Array.from({length:20},(_,xp)=>store.save(key,"session-a",{...profile,xp})));
assert.equal(new ProfileStore(directory).get(key)!.xp,19,"Escrituras serializadas, sin perder la última");
assert.equal(new ProfileStore(directory).get(key)!.species,"wargreymon");
assert.deepEqual(new ProfileStore(directory).get(key)!.cooldowns,profile.cooldowns);
const copy=store.get(key)!;copy.cooldowns!.wargreymon_gaia=0;
assert.notEqual(store.get(key)!.cooldowns!.wargreymon_gaia,0,"Lecturas no mutan el almacén");
const json=readFileSync(store.file,"utf8");
assert.ok(!json.includes(token),"Token privado nunca se guarda en texto claro");
assert.deepEqual(readdirSync(directory),["profiles.json"],"No quedan archivos temporales");
await assert.rejects(store.save(key,"other",profile),/no pertenece/);
assert.throws(()=>profileKey("nombre-de-jugador"),/inválida/);
store.release(key,"session-a");
assert.equal(store.acquire(token,"session-b"),key);

const broken=join(directory,"broken");mkdirSync(broken);
writeFileSync(join(broken,"profiles.json"),"{corrupto");
assert.throws(()=>new ProfileStore(broken));
assert.equal(readFileSync(join(broken,"profiles.json"),"utf8"),"{corrupto","No sobrescribir archivo corrupto");

const blocked=join(directory,"not-a-directory");writeFileSync(blocked,"blocked");
const failing=new ProfileStore(blocked);
const failureKey=failing.acquire("b".repeat(64),"session");
await assert.rejects(failing.save(failureKey,"session",profile),"Propagar fallo de disco");
unlinkSync(blocked); // Solo el archivo creado por esta prueba.
await failing.save(failureKey,"session",profile);
assert.equal(new ProfileStore(blocked).get(failureKey)!.species,"wargreymon","Reintentar tras error de disco");
console.log("PASS: disco, reinicio, escrituras atómicas/serializadas, tokens hasheados, bloqueo de sesiones, corrupción y recuperación tras fallo de escritura");
