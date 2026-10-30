import assert from "node:assert/strict";
import type { Client } from "colyseus";
import { PlayerState, WildState } from "@digiworld/shared/schema";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const room = new WorldRoom();
const events: Array<{type: string; payload: any}> = [];
// Sin sockets ni temporizadores: ejecutar las mismas funciones autoritativas de la sala.
Object.assign(room, {
  broadcast: (type: string, payload: unknown) => events.push({type, payload}),
  sendTo: (_id: string, type: string, payload: unknown) => events.push({type, payload}),
  systemChat: () => {},
});
const player = new PlayerState();
// Misma geometría de prueba, trasladada fuera del nuevo refugio de radio 16.
Object.assign(player, {name: "DomadorQA", species: "agumon", x: 0, z: 25,
  partnerX: 10, partnerZ: 25, hp: 120, maxHp: 120, ep: 40, maxEp: 40});
room.state.players.set("owner", player);
const client = {sessionId: "owner", send: (type: string, payload: unknown) => events.push({type, payload})} as unknown as Client;
const wild = new WildState();
Object.assign(wild, {name: "Agumon salvaje", species: "agumon", x: 12, z: 25, homeX: 12, homeZ: 25, hp: 100, maxHp: 100, level: 1});
room.state.wilds.set("enemy", wild);
room["abilityReadyAt"].set("owner", new Map());
room["handleWildTarget"](client, {wildId: "enemy"});

room["handleAbility"](client, {abilityId: "agumon_claw"});
assert.ok(wild.hp < 100, "Daño válido aunque el domador esté fuera del alcance de 8 m");
assert.equal(player.ep, 34);
assert.equal(events.find(e => e.type === "ability_used")?.payload.casterName, "Agumon");
const hp = wild.hp;
room["handleAbility"](client, {abilityId: "agumon_claw"});
assert.equal(wild.hp, hp, "Cooldown sigue siendo autoritativo");
assert.equal(player.ep, 34, "Rechazar recarga no consume energía");

room["lastAbilityAt"].clear(); room["abilityReadyAt"].get("owner")!.clear();
player.partnerX = -10; wild.x = 1;
room["handleAbility"](client, {abilityId: "agumon_claw"});
assert.equal(wild.hp, hp, "Domador cerca + Digimon lejos no permite ataque");
assert.ok(events.some(e => e.type === "ability_error" && e.payload.reason === "Fuera de alcance."));

player.partnerX = 3; wild.x = 12;
for (let i = 0; i < 50; i++) room["updatePartners"](0.05, Date.now());
assert.ok(player.partnerX > 9, "El Digimon se acerca solo");
assert.equal(player.x, 0, "La orden no mueve al domador");
wild.targetId = "owner"; wild.lastAttackAt = 0;
room["updateWilds"](Date.now(), 0.05);
assert.ok(player.hp < 120, "La vida del compañero baja cuando recibe golpes");
const attack = events.find(e => e.type === "auto_attack" && e.payload.attackerId === "enemy");
assert.equal(attack?.payload.targetName, "Agumon");
assert.equal(player.x, 0);

player.partnerX = 5; wild.x = 10;
room["wildTargets"].clear(); wild.targetId = "";
room["updateWilds"](Date.now() + 5000, 0.05);
assert.equal(wild.targetId, "owner", "Aggro detecta al Digimon a 5 m, no al domador a 10 m");

const before = wild.x;
player.partnerX = -5; player.x = 0;
room["updateWilds"](Date.now() + 5001, 0.05);
assert.ok(wild.x < before, "El enemigo persigue la posición del Digimon");

room["lastAbilityAt"].clear(); room["abilityReadyAt"].get("owner")!.clear();
wild.x = 24; player.partnerX = 20;
const beforeTether = wild.hp;
room["handleAbility"](client, {abilityId: "agumon_claw"});
assert.equal(wild.hp, beforeTether, "El servidor rechaza habilidades fuera de correa aunque el compañero esté en rango");

player.species = "patamon"; player.hp = 60; player.ep = 40; player.inCombat = true;
room["lastAbilityAt"].clear(); room["abilityReadyAt"].get("owner")!.clear();
room["handleAbility"](client, {abilityId: "patamon_heal"});
assert.ok(player.hp > 60, "La curación restaura al compañero");
assert.ok(events.some(e => e.type === "ability_used" && e.payload.kind === "heal" && e.payload.targetId === "owner"));
player.species = "agumon";

const rival = new PlayerState();
Object.assign(rival, {name: "OtroDomador", species: "gabumon", x: 30, z: 25,
  partnerX: 13, partnerZ: 25, hp: 120, maxHp: 120, inCombat: true, duelOpponent: "owner"});
room.state.players.set("rival", rival);
player.partnerX = 10; player.duelOpponent = "rival"; player.inCombat = true;
room["lastAutoAt"].clear();
room["autoAttack"]("owner", "rival", Date.now());
assert.ok(rival.hp < 120, "PvP valida distancia entre compañeros y no entre domadores");
assert.equal(rival.x, 30, "El domador rival no se mueve por recibir daño");
room.state.players.delete("rival"); player.duelOpponent = "";

player.partnerX = 2; player.partnerZ = 25; wild.x = 60; wild.z = 25;
room["wildTargets"].set("owner", "enemy");
room["updatePartners"](0.05, Date.now());
assert.ok(player.partnerX < 3, "La correa impide enviar al compañero por todo el mapa");

player.hp = 0; player.respawnAt = Date.now() + 3000;
room["handleInput"](client, {x: 1, z: 0, run: false, yaw: 0, seq: 1});
room["update"](50);
assert.ok(player.x > 0, "Domador sigue moviéndose mientras su Digimon está debilitado");
assert.equal(player.hp, 0, "No regenerar antes de la recuperación");
player.respawnAt = Date.now() - 1;
room["update"](50);
assert.equal(player.hp, player.maxHp, "Recuperación del Digimon");
console.log("PASS: alcance del compañero, daño/EP/cooldown, movimiento independiente, aggro, persecución, correa, debilitamiento y recuperación");
