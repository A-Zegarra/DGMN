// Fixture visual exclusivamente local, sin cambiar API ni mecánicas del juego.
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { companionVitals } from "@digiworld/content";
import { ProfileStore } from "../src/storage/profile-store.js";

const base=join(tmpdir(),"opencode");mkdirSync(base,{recursive:true});
const directory=mkdtempSync(join(base,"party-ui-data-"));
const store=new ProfileStore(directory);
const tokens={garurumon:"c".repeat(64),angemon:"d".repeat(64)};
for(const [species,token] of Object.entries(tokens)){
  const key=store.acquire(token,"fixture");
  const {maxHp,maxEp}=companionVitals(species,8);
  await store.save(key,"fixture",{
    name:species,species,level:8,xp:0,xpNext:400,hp:maxHp,ep:maxEp,
    x:0,z:0,rot:0,partnerX:2,partnerZ:0,partnerRot:0,
    duelWins:0,duelLosses:0,updatedAt:Date.now(),
    inventory:{bits:0,hpPotion:3,epPotion:2,devimonSeals:0},
  });
  store.release(key,"fixture");
}
console.log(`PARTY_UI_DATA_DIR=${directory}`);
console.log(`PARTY_UI_TOKENS=${JSON.stringify(tokens)}`);
