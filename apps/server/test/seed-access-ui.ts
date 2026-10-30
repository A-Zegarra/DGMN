import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { companionVitals } from "@digiworld/content";
import { ProfileStore } from "../src/storage/profile-store.js";

// Base nueva y clave pública exclusivamente de prueba: nunca usar en producción.
const base=join(tmpdir(),"opencode");mkdirSync(base,{recursive:true});
const directory=mkdtempSync(join(base,"access-ui-data-")),store=new ProfileStore(directory);
const token="a".repeat(64),key=store.acquire(token,"fixture"),{maxHp,maxEp}=companionVitals("metalgreymon",14);
await store.save(key,"fixture",{name:"LinkKeeperQA",species:"metalgreymon",level:14,xp:78,xpNext:800,hp:maxHp,ep:maxEp,
  x:0,z:0,rot:0,partnerX:2,partnerZ:0,partnerRot:0,duelWins:4,duelLosses:2,updatedAt:Date.now(),
  inventory:{bits:1234,hpPotion:7,epPotion:4,devimonSeals:2},quests:{completed:["pradera-datos"],kills:2}});
store.release(key,"fixture");
console.log(`ACCESS_UI_DATA_DIR=${directory}`);
console.log(`ACCESS_UI_TOKEN=${token}`);
