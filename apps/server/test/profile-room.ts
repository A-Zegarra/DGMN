import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client, CloseCode } from "colyseus";
import { companionVitals } from "@digiworld/content";
import { ProfileStore } from "../src/storage/profile-store.js";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const base=join(tmpdir(),"opencode");mkdirSync(base,{recursive:true});
const directory=mkdtempSync(join(base,"profile-room-test-"));
const token="c".repeat(64);
function roomFor(store:ProfileStore){
  const room=new WorldRoom();
  Object.assign(room,{profileStore:store,systemChat:()=>{},sendTo:()=>{}});
  return room;
}
const client=(id:string)=>({sessionId:id,send:()=>{}} as unknown as Client);
const first=roomFor(new ProfileStore(directory));
first.onJoin(client("first"),{name:"Keeper",species:"koromon",profileToken:token});
const player=first.state.players.get("first")!;
// Simular progreso exclusivamente en la fixture del servidor, nunca en mensajes de cliente.
player.level=14;player.species="metalgreymon";player.xp=78;player.xpNext=800;
Object.assign(player,companionVitals(player.species,player.level));
player.hp=200;player.ep=70;player.x=40;player.z=-20;player.partnerX=42;player.partnerZ=-18;
player.duelWins=4;player.duelLosses=2;
player.hpPotion=7;player.epPotion=4;player.bits=1234;player.devimonSeals=2;
player.itemReadyAt=Date.now()+8000;
const itemReadyAt=player.itemReadyAt;
const cooldown=Date.now()+20000;
first["abilityReadyAt"].set("first",new Map([["metalgreymon_giga",cooldown]]));
await first["saveProfile"]("first");
const second=roomFor(first["profileStore"]!);
assert.throws(()=>second.onJoin(client("duplicate"),{profileToken:token}),/ya está abierta/);
await first.onLeave(client("first"),1000 as CloseCode);

// Nuevo almacén + nueva sala: simula reiniciar el proceso y solicitar un starter falso.
const restarted=roomFor(new ProfileStore(directory));
restarted.onJoin(client("restored"),{name:"Override",species:"agumon",profileToken:token});
const restored=restarted.state.players.get("restored")!;
assert.equal(restored.name,"Keeper");
assert.equal(restored.species,"metalgreymon");
assert.equal(restored.level,14);assert.equal(restored.xp,78);assert.equal(restored.xpNext,800);
assert.equal(restored.hp,200);assert.equal(restored.ep,70);
assert.equal(restored.x,40);assert.equal(restored.partnerX,42);
assert.equal(restored.duelWins,4);assert.equal(restored.duelLosses,2);
assert.equal(restored.hpPotion,7);assert.equal(restored.epPotion,4);
assert.equal(restored.bits,1234);assert.equal(restored.devimonSeals,2);
assert.equal(restored.itemReadyAt,itemReadyAt);
assert.equal(restarted["abilityReadyAt"].get("restored")!.get("metalgreymon_giga"),cooldown);
assert.equal(restored.inCombat,false);assert.equal(restored.duelOpponent,"");
restored.hp=0;restored.ep=0;
await restarted.onLeave(client("restored"),1000 as CloseCode);
const recovered=roomFor(new ProfileStore(directory));
recovered.onJoin(client("recovered"),{profileToken:token});
const healthy=recovered.state.players.get("recovered")!;
assert.equal(healthy.hp,healthy.maxHp);assert.equal(healthy.ep,healthy.maxEp);
await recovered.onLeave(client("recovered"),1000 as CloseCode);
console.log("PASS: restauración real de especie/nivel/XP/victorias/HP/EP/posición/recargas, rechazo de duplicados y recuperación tras desconexión debilitado");
