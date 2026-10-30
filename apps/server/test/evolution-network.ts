/** Sala aislada de pruebas, nunca registrada en app.config ni en producción. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineRoom, defineServer, type Client } from "colyseus";
import { listen } from "@colyseus/tools";
import { AGUMON_LINE, getAbilitiesForSpecies } from "@digiworld/content";
import { WorldRoom } from "../src/rooms/WorldRoom.js";

const { Client: NetworkClient } = createRequire(resolve(import.meta.dirname,"../../client/package.json"))("@colyseus/sdk");
class EvolutionFixtureRoom extends WorldRoom {
  onCreate() { super.onCreate(); this.state.wilds.clear(); }
  onJoin(client: Client) {
    super.onJoin(client,{name:"EvolutionNetworkQA",species:"koromon"});
    const player=this.state.players.get(client.sessionId)!;
    while(player.level<20) this["grantXp"](client.sessionId,player.xpNext-player.xp);
    player.hp=player.maxHp/2; player.ep=player.maxEp/2;
  }
}
const server=await listen(defineServer({rooms:{world:defineRoom(EvolutionFixtureRoom)}}),2588);
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean) {
  const started=Date.now();
  while(!check()){if(Date.now()-started>8000)throw Error("Timeout de sincronización");await delay(40);}
}
try {
  const room=await new NetworkClient("http://localhost:2588").joinOrCreate("world");
  const evolutions:any[]=[];
  room.onMessage("*",(type:string,message:any)=>{if(type==="evolution")evolutions.push(message);});
  try {
    await until(()=>Boolean(room.state?.players?.get(room.sessionId)));
    const player=room.state.players.get(room.sessionId);
    assert.equal(player.species,"koromon");
    const xp=player.xp;
    for(const target of AGUMON_LINE.slice(1)){
      const hpRatio=player.hp/player.maxHp;
      const epRatio=player.ep/player.maxEp;
      room.send("evolve",{targetSpecies:target});
      await until(()=>player.species===target&&evolutions.some(e=>e.toSpecies===target));
      assert.equal(player.level,20);
      assert.equal(player.xp,xp);
      assert.ok(Math.abs(player.hp/player.maxHp-hpRatio)<0.01,"Se conserva la proporción de HP (con regeneración normal)");
      assert.ok(Math.abs(player.ep/player.maxEp-epRatio)<0.03,"Se conserva la proporción de EP (con regeneración normal)");
      assert.equal(getAbilitiesForSpecies(player.species).length,3);
      console.log(`PASS: especie sincronizada por WebSocket: ${player.species}, HP ${player.hp}/${player.maxHp}`);
      await delay(3100);
    }
    assert.equal(evolutions.length,4,"Una notificación por evolución");
  } finally { await room.leave(); }
} finally { await server.gracefullyShutdown(false); }
