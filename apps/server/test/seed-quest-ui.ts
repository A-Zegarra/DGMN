// Fixture opcional para navegador. Solo escribe en un directorio temporal nuevo;
// no añade rutas ni atajos de progreso al servidor del juego.
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { companionVitals } from "@digiworld/content";
import { ProfileStore } from "../src/storage/profile-store.js";

const base = join(tmpdir(), "opencode"); mkdirSync(base, {recursive: true});
const directory = mkdtempSync(join(base, "quest-ui-data-"));
const store = new ProfileStore(directory);
// Clave pública de PRUEBA, sin valor fuera de esta base temporal.
const token = "f".repeat(64);
const key = store.acquire(token, "fixture");
const {maxHp, maxEp} = companionVitals("agumon", 5);
await store.save(key, "fixture", {
  name: "QuestUIQA", species: "agumon", level: 5, xp: 0, xpNext: 220,
  hp: maxHp, ep: maxEp, x: 0, z: 0, rot: 0, partnerX: 2, partnerZ: 0, partnerRot: 0,
  duelWins: 0, duelLosses: 0, updatedAt: Date.now(),
  inventory: {bits: 0, hpPotion: 3, epPotion: 2, devimonSeals: 0},
  quests: {completed: [], kills: 3},
});
store.release(key, "fixture");
console.log(`QUEST_UI_DATA_DIR=${directory}`);
console.log(`QUEST_UI_TOKEN=${token}`);
