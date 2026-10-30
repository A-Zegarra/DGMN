import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client, CloseCode } from "colyseus";
import { BITS_LIMIT, INVENTORY_LIMIT, PVE_QUESTS } from "@digiworld/content";
import type { QuestJournalData } from "@digiworld/shared/messages";
import { ProfileStore, profileKey } from "../src/storage/profile-store.js";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const base = join(tmpdir(), "opencode"); mkdirSync(base, {recursive: true});
const directory = mkdtempSync(join(base, "quest-room-test-"));
const events: Array<{id: string; type: string; payload: any}> = [];
function createRoom(store: ProfileStore) {
  const room = new WorldRoom();
  Object.assign(room, {profileStore: store, systemChat: () => {}, broadcast: () => {},
    sendTo: (id: string, type: string, payload: unknown) => events.push({id, type, payload})});
  room["spawnWilds"]();
  return room;
}
const client = (id: string) => ({sessionId: id, send: (type: string, payload: unknown) => events.push({id, type, payload})} as unknown as Client);
const token = "d".repeat(64);
const owner = client("owner");
const room = createRoom(new ProfileStore(directory));
room.onJoin(owner, {name: "QuestQA", species: "koromon", profileToken: token});
const p = room.state.players.get(owner.sessionId)!;
const journal = () => room["questJournals"].get(owner.sessionId)!;
const first = PVE_QUESTS[0]!;
const claim = (questId: unknown) => room.messages.quest_claim(owner, {questId} as any);
const kill = (wildId: string, killerId = owner.sessionId) => {
  const wild = room.state.wilds.get(wildId)!;
  // Solo la fixture del servidor fuerza una muerte; no existe mensaje de cliente.
  wild.hp = wild.maxHp; wild.respawnAt = 0;
  room["killWild"](wildId, wild, killerId, Date.now());
};
const deliveries = () => events.filter(e => e.type === "quest_claimed" && e.id === owner.sessionId).length;
assert.deepEqual(journal(), {completed: [], kills: 0});
for (const forged of [undefined, null, {}, [], "forged", PVE_QUESTS[1]!.id, first.id]) claim(forged);
room.messages.quest_claim(owner, null as any);
assert.equal(deliveries(), 0, "No se entrega una misión incompleta o futura con datos falsos");
kill("wild-9"); kill("boss-devimon");
assert.equal(journal().kills, 0, "La zona equivocada y Devimon no avanzan la primera misión");

const ally = client("ally");
room.onJoin(ally, {name: "Ally", species: "agumon"});
kill("wild-1", ally.sessionId);
assert.equal(journal().kills, 0, "La baja de otro jugador no cuenta");
assert.equal(room["questJournals"].get("ally")!.kills, 1);
kill("wild-1");
const dead = room.state.wilds.get("wild-1")!;
room["killWild"]("wild-1", dead, "owner", Date.now());
assert.equal(journal().kills, 1, "Una misma muerte solo cuenta una vez");
dead.x = 0; dead.z = 0;
kill("wild-1");
assert.equal(journal().kills, 2, "La zona de origen manda aunque el enemigo cambie de lugar");
await room["saveProfile"]("owner");
assert.equal(new ProfileStore(directory).get(profileKey(token))!.quests!.kills, 2, "El progreso parcial llega a disco");
kill("wild-2"); kill("wild-3");
assert.equal(journal().kills, first.count, "No exceder el objetivo");
const rewardState = () => ({bits: p.bits, hpPotion: p.hpPotion, epPotion: p.epPotion, seals: p.devimonSeals, level: p.level, xp: p.xp});
const beforeReject = rewardState();
Object.assign(p, {x: 22, z: 0}); claim(first.id);
Object.assign(p, {x: 0, z: 0, partnerX: 22, partnerZ: 0}); claim(first.id);
Object.assign(p, {partnerX: 2, inCombat: true}); claim(first.id);
p.inCombat = false; p.duelOpponent = "rival"; claim(first.id);
p.duelOpponent = ""; p.hp = 0; claim(first.id);
p.hp = p.maxHp; p.evolutionReadyAt = Date.now() + 10000; claim(first.id);
p.evolutionReadyAt = 0;
assert.equal(deliveries(), 0, "Refugio de ambos, combate, duelo, derrota y evolución se validan en servidor");
assert.deepEqual(rewardState(), beforeReject);
for (const [key, limit] of [["bits", BITS_LIMIT], ["hpPotion", INVENTORY_LIMIT], ["epPotion", INVENTORY_LIMIT]] as const) {
  const old = p[key]; p[key] = limit; claim(first.id); p[key] = old;
}
assert.equal(deliveries(), 0, "No perder premios por mochila llena");
const before = rewardState();
claim(first.id); claim(first.id);
assert.equal(deliveries(), 1, "Entrega duplicada bloqueada");
assert.equal(p.bits, before.bits + first.reward.bits);
assert.equal(p.hpPotion, before.hpPotion + first.reward.hpPotion);
assert.equal(p.epPotion, before.epPotion + first.reward.epPotion);
assert.deepEqual(journal(), {completed: [first.id], kills: 0});
kill("wild-1");
assert.equal(journal().kills, 0, "La misión siguiente solo cuenta su zona");
kill("wild-9");
await room.onLeave(owner, 1000 as CloseCode);
assert.equal(room["questJournals"].has("owner"), false, "Limpiar diario al salir");

const restarted = createRoom(new ProfileStore(directory));
const restoredClient = client("restored");
restarted.onJoin(restoredClient, {profileToken: token});
const restored = restarted.state.players.get("restored")!;
assert.deepEqual(restarted["questJournals"].get("restored"), {completed: [first.id], kills: 1});
assert.equal(restored.bits, p.bits, "Premios y misiones restaurados tras reinicio");
restarted.messages.quest_claim(restoredClient, {questId: first.id});
assert.equal(restored.bits, p.bits, "No volver a cobrar tras reiniciar");
for (let i = 0; i < 3; i++) {
  const wild = restarted.state.wilds.get("wild-9")!;
  wild.respawnAt = 0; wild.hp = wild.maxHp;
  restarted["killWild"]("wild-9", wild, "restored", Date.now());
}
restarted.messages.quest_claim(restoredClient, {questId: PVE_QUESTS[1]!.id});
assert.deepEqual(restarted["questJournals"].get("restored"), {completed: PVE_QUESTS.slice(0, 2).map(q => q.id), kills: 0});

// Devimon: mismos requisitos de contribución que el botín, no basta mirar al jefe.
const helper = client("helper"), spectator = client("spectator"), stale = client("stale");
for (const c of [helper, spectator, stale]) {
  restarted.onJoin(c, {name: c.sessionId});
  restarted["questJournals"].set(c.sessionId, {completed: PVE_QUESTS.slice(0, 2).map(q => q.id), kills: 0});
  Object.assign(restarted.state.players.get(c.sessionId)!, {partnerX: 45, partnerZ: 44});
}
const boss = restarted.state.wilds.get("boss-devimon")!;
restarted["recordDamage"]("boss-devimon", "helper", boss.maxHp * 0.05);
restarted["recordDamage"]("boss-devimon", "spectator", 1);
restarted["contributors"].get("boss-devimon")!.set("stale", {damage: boss.maxHp, at: Date.now() - 31000});
restarted["killWild"]("boss-devimon", boss, "restored", Date.now());
assert.equal(restarted["questJournals"].get("restored")!.kills, 1);
assert.equal(restarted["questJournals"].get("helper")!.kills, 1, "Contribuidor válido del jefe avanza");
assert.equal(restarted["questJournals"].get("spectator")!.kills, 0, "Espectador no avanza");
assert.equal(restarted["questJournals"].get("stale")!.kills, 0, "Daño caducado no avanza");
restored.devimonSeals = INVENTORY_LIMIT;
restarted.messages.quest_claim(restoredClient, {questId: PVE_QUESTS[2]!.id});
assert.equal(restarted["questJournals"].get("restored")!.completed.length, 2, "Capacidad de sellos validada");
restored.devimonSeals = 0;
restarted.messages.quest_claim(restoredClient, {questId: PVE_QUESTS[2]!.id});
assert.equal(restored.devimonSeals, 1);
assert.deepEqual(restarted["questJournals"].get("restored"), {completed: PVE_QUESTS.map(q => q.id), kills: 0});
const finalBits = restored.bits;
for (const quest of PVE_QUESTS) restarted.messages.quest_claim(restoredClient, {questId: quest.id});
assert.equal(restored.bits, finalBits, "Cadena final sin premios repetidos");
await restarted.onLeave(restoredClient, 1000 as CloseCode);
const store = new ProfileStore(directory);
const saved = store.get(profileKey(token))!;
assert.deepEqual(saved.quests, {completed: PVE_QUESTS.map(q => q.id), kills: 0});
const invalidStore = new ProfileStore(mkdtempSync(join(base, "quest-invalid-test-")));
const key = invalidStore.acquire("e".repeat(64), "test");
for (const quests of [null, {completed: ["forged"], kills: 0}, {completed: [first.id, first.id], kills: 0},
  {completed: [], kills: -1}, {completed: [], kills: 4}, {completed: [], kills: 1.5},
  {completed: PVE_QUESTS.map(q => q.id), kills: 1}] as unknown as QuestJournalData[]) {
  await assert.rejects(async () => invalidStore.save(key, "test", {...saved, quests}), /Misiones/);
}
assert.ok(!readFileSync(store.file, "utf8").includes(token));
// Un archivo previo al sistema de misiones no lleva el campo quests.
const legacyDirectory = mkdtempSync(join(base, "quest-legacy-test-"));
const legacyStore = new ProfileStore(legacyDirectory);
const legacyToken = "a".repeat(64);
const legacyKey = legacyStore.acquire(legacyToken, "fixture");
await legacyStore.save(legacyKey, "fixture", {...saved, quests: undefined});
legacyStore.release(legacyKey, "fixture");
const legacyRoom = createRoom(new ProfileStore(legacyDirectory));
const legacyClient = client("legacy");
legacyRoom.onJoin(legacyClient, {profileToken: legacyToken});
const legacyPlayer = legacyRoom.state.players.get("legacy")!;
assert.deepEqual(legacyRoom["questJournals"].get("legacy"), {completed: [], kills: 0}, "Migración de perfiles antiguos");
assert.equal(legacyPlayer.level, saved.level);
assert.equal(legacyPlayer.species, saved.species);
assert.equal(legacyPlayer.bits, saved.inventory!.bits);
assert.equal(legacyPlayer.hpPotion, saved.inventory!.hpPotion);
await legacyRoom.onLeave(legacyClient, 1000 as CloseCode);
assert.deepEqual(new ProfileStore(legacyDirectory).get(legacyKey)!.quests, {completed: [], kills: 0});
await room.onLeave(ally, 1000 as CloseCode);
await restarted.onDispose();
console.log("PASS: cadena de misiones, progreso privado/parcial, zonas, contribución al jefe, validaciones, recompensas exactas, límites, duplicados, disco y reinicio");
