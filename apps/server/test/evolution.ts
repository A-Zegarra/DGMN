import assert from "node:assert/strict";
import type { Client } from "colyseus";
import { PlayerState } from "@digiworld/shared/schema";
import { AGUMON_LINE, SPECIES, companionVitals, getAbilitiesForSpecies, isStarter } from "@digiworld/content";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const room = new WorldRoom();
const events: Array<{type: string; payload: any}> = [];
Object.assign(room, {
  broadcast: (type: string, payload: unknown) => events.push({type, payload}),
  sendTo: (_id: string, type: string, payload: unknown) => events.push({type, payload}),
  systemChat: () => {},
});
const player = new PlayerState();
Object.assign(player, {name: "EvolutionQA", species: "koromon", level: 1, hp: 85, maxHp: 85, ep: 30, maxEp: 30, xp: 0, xpNext: 100});
room.state.players.set("qa", player);
const client = {sessionId:"qa", send:(type: string,payload:unknown)=>events.push({type,payload})} as unknown as Client;
const evolve = (id: string) => room["handleEvolution"](client, {targetSpecies:id});
const error = (text: string) => assert.ok(events.at(-1)?.payload.reason.includes(text), events.at(-1)?.payload.reason);
assert.ok(isStarter("koromon"));
assert.ok(!isStarter("wargreymon"), "No iniciar directamente en Mega");
evolve("wargreymon"); error("línea actual");
evolve("agumon"); error("nivel 5");
assert.equal(player.species,"koromon");
for (let index=1;index<AGUMON_LINE.length;index++) {
  const from = player.species;
  const target = AGUMON_LINE[index]!;
  const requirement = SPECIES[from]!.evolvesTo.find(e=>e.id===target)!;
  while(player.level<requirement.level) room["grantXp"]("qa",player.xpNext-player.xp);
  player.xp = 17;
  player.inCombat = true; evolve(target); error("combate"); player.inCombat = false;
  const oldHp = player.hp;
  player.hp=0; evolve(target); error("recuperado"); player.hp=oldHp;
  player.hp = player.maxHp / 2;
  player.ep = player.maxEp / 2;
  room["pendingDuel"].set("other",{fromId:"qa",at:Date.now()});
  evolve(target); error("invitación"); room["pendingDuel"].clear();
  room["wildTargets"].set("qa","old-target");
  room["abilityReadyAt"].set("qa",new Map([["old_ability",Date.now()+60000]]));
  const level = player.level;
  evolve(target);
  assert.equal(player.species,target);
  assert.equal(player.level,level);
  assert.equal(player.xp,17,"La evolución no consume XP");
  const vitals=companionVitals(target,level);
  assert.equal(player.maxHp,vitals.maxHp);
  assert.equal(player.maxEp,vitals.maxEp);
  assert.equal(player.hp,Math.round(vitals.maxHp/2));
  assert.equal(player.ep,Math.round(vitals.maxEp/2));
  assert.equal(room["wildTargets"].has("qa"),false);
  assert.equal(room["abilityReadyAt"].get("qa")!.size,0);
  assert.ok(events.some(e=>e.type==="evolution"&&e.payload.fromSpecies===from&&e.payload.toSpecies===target));
  const abilities=getAbilitiesForSpecies(target);
  assert.equal(abilities.length,3);
  assert.ok(abilities.every(a=>a.cost<=player.maxEp));
  room["handleAbility"](client,{abilityId:abilities[0]!.id});
  error("digievolucionando");
  evolve(target); error("en curso");
  player.evolutionReadyAt=0; // Avanzar la animación sin temporizadores en la prueba.
  evolve(from); error("línea actual");
}
assert.equal(player.species,"wargreymon");
assert.equal(player.level,20);
evolve("wargreymon"); error("línea actual");
assert.equal(SPECIES.wargreymon!.evolvesTo.length,0);
console.log("PASS: Koromon → Agumon → Greymon → MetalGreymon → WarGreymon; XP/niveles reales, requisitos, HP/EP, habilidades, bloqueo de combate/duelos y rechazo de saltos/repeticiones");
