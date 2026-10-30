import assert from "node:assert/strict";
import type { Client } from "colyseus";
import { PlayerState } from "@digiworld/shared/schema";
import { BITS_LIMIT, INVENTORY_LIMIT, PVE_SPAWNS, getPvEArea } from "@digiworld/content";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const room = new WorldRoom();
const events: Array<{id?:string;type:string;payload:any}> = [];
Object.assign(room, {
  broadcast: (type:string,payload:unknown) => events.push({type,payload}),
  sendTo: (id:string,type:string,payload:unknown) => events.push({id,type,payload}),
  systemChat: () => {},
});
const client = {sessionId:"owner",send:(type:string,payload:unknown)=>events.push({type,payload})} as unknown as Client;
const p = new PlayerState();
Object.assign(p,{species:"agumon",x:44,z:44,partnerX:46,partnerZ:44,maxHp:1000,hp:500,maxEp:100,ep:30});
room.state.players.set("owner",p);
room["spawnWilds"]();
assert.equal(room.state.wilds.size,PVE_SPAWNS.length);
for (const spawn of PVE_SPAWNS) assert.equal(getPvEArea(spawn.x,spawn.z).safe,false);
assert.equal(p.hpPotion,3);assert.equal(p.epPotion,2);

room.messages.use_item(client,{itemId:"forged"});
assert.equal(p.hpPotion,3);
room.messages.use_item(client,{itemId:"hp_potion"});
assert.equal(p.hp,870);assert.equal(p.hpPotion,2);
room.messages.use_item(client,{itemId:"ep_potion"});
assert.equal(p.ep,30,"Recarga compartida");
p.itemReadyAt=0;p.duelOpponent="rival";
room.messages.use_item(client,{itemId:"ep_potion"});
assert.equal(p.epPotion,2,"Objetos bloqueados en duelo");
p.duelOpponent="";p.ep=100;
room.messages.use_item(client,{itemId:"ep_potion"});
assert.equal(p.epPotion,2,"No consumir si ya está lleno");
p.ep=30;
room.messages.use_item(client,{itemId:"ep_potion"});
assert.equal(p.ep,75);assert.equal(p.epPotion,1);

const boss=room.state.wilds.get("boss-devimon")!;
const now=Date.now();
Object.assign(boss,{targetId:"owner",state:"chase",nextSpecialAt:now-1});
room["updateWilds"](now,0);
assert.equal(boss.state,"casting");assert.equal(boss.castEndsAt,now+1500);
// Recibir daño no cancela ni cambia el objetivo del ataque anunciado.
room.messages.wild_target(client,{wildId:"boss-devimon"});
room["update"](0);
assert.equal(boss.state,"casting");assert.equal(boss.targetId,"owner");
const before=p.hp;
room["updateWilds"](now+1500,0);
assert.ok(p.hp<before);assert.equal(boss.castEndsAt,0);
Object.assign(boss,{state:"casting",castEndsAt:now+3000});
p.partnerX=54;
const beforeMiss=p.hp;
room["updateWilds"](now+3000,0);
assert.equal(p.hp,beforeMiss,"Salir del círculo evita el especial");
Object.assign(boss,{state:"casting",castEndsAt:now+4500,hp:600});
p.partnerX=46;
room["updateWilds"](now+4500,0);
assert.equal(boss.nextSpecialAt,now+9500,"Enrage reduce la recarga");

room.messages.partner_recall(client);
assert.equal(p.partnerPassive,true);assert.equal(room["wildTargets"].has("owner"),false);
room.messages.wild_target(client,{wildId:"boss-devimon"});
assert.equal(p.partnerPassive,false);
Object.assign(p,{x:0,z:0,partnerX:0,partnerZ:0});
room["updateWilds"](now+5000,0);
assert.equal(boss.state,"return");assert.equal(boss.hp,boss.maxHp);assert.equal(boss.castEndsAt,0);
room.messages.wild_target(client,{wildId:"boss-devimon"});
assert.equal(room["wildTargets"].has("owner"),false,"No se puede atacar durante el retorno");
room["update"](0);
assert.equal(room["wildTargets"].has("owner"),false);
assert.equal(boss.hp,boss.maxHp);
room["updateWilds"](now+6000,0);
assert.equal(boss.targetId,"","El refugio no genera aggro");

Object.assign(p,{x:44,z:44,partnerX:46,partnerZ:44,bits:BITS_LIMIT-1,hpPotion:INVENTORY_LIMIT,epPotion:INVENTORY_LIMIT,devimonSeals:INVENTORY_LIMIT});
const ally=new PlayerState();
Object.assign(ally,{partnerX:45,partnerZ:44,hp:100});
room.state.players.set("ally",ally);
const stale=new PlayerState();
Object.assign(stale,{partnerX:45,partnerZ:44,hp:100});
room.state.players.set("stale",stale);
room["recordDamage"]("boss-devimon","ally",120);
room["contributors"].get("boss-devimon")!.set("stale",{damage:200,at:now-31000});
room["killWild"]("boss-devimon",boss,"owner",now);
assert.equal(p.bits,BITS_LIMIT);assert.equal(p.hpPotion,INVENTORY_LIMIT);
assert.equal(p.devimonSeals,INVENTORY_LIMIT);
assert.equal(ally.devimonSeals,1,"Contribuidor cercano recibe botín");
assert.equal(stale.devimonSeals,0,"Participación caducada no recibe botín");
const lootCount=events.filter(e=>e.type==="loot_received").length;
room["killWild"]("boss-devimon",boss,"owner",now);
assert.equal(events.filter(e=>e.type==="loot_received").length,lootCount,"Sin premio duplicado");
assert.equal(boss.respawnAt,now+120000);
room["updateWilds"](now+119999,0);assert.equal(boss.hp,0);
room["updateWilds"](now+120000,0);assert.equal(boss.hp,2400);
assert.equal(boss.state,"idle");assert.equal(boss.castEndsAt,0);
console.log("PASS: inventario, consumibles, recarga/duelo, refugio, retirada, Devimon/carga/esquiva/enrage, retorno, límites, reparto, duplicados y reaparición");
