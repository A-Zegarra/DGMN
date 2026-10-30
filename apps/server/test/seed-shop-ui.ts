// Solo prepara una base NUEVA temporal. Nunca se usa con datos de producción.
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { companionVitals } from "@digiworld/content";
import { ProfileStore } from "../src/storage/profile-store.js";

const base = join(tmpdir(), "opencode"); mkdirSync(base, {recursive: true});
const directory = mkdtempSync(join(base, "shop-ui-data-"));
const store = new ProfileStore(directory);
// Clave pública de PRUEBA: no usar en el servidor público.
const token = "e".repeat(64), key = store.acquire(token, "fixture");
const {maxHp, maxEp} = companionVitals("agumon", 5);
await store.save(key, "fixture", {
  name: "ShopUIQA", species: "agumon", level: 5, xp: 0, xpNext: 220,
  hp: maxHp, ep: maxEp, x: 0, z: 0, rot: 0, partnerX: 2, partnerZ: 0, partnerRot: 0,
  duelWins: 0, duelLosses: 0, updatedAt: Date.now(),
  inventory: {bits: 1000, hpPotion: 3, epPotion: 2, devimonSeals: 1},
  quests: {completed: [], kills: 0},
});
store.release(key, "fixture");
console.log(`SHOP_UI_DATA_DIR=${directory}`);
console.log(`SHOP_UI_TOKEN=${token}`);
