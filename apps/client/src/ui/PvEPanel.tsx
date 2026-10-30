import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { CONSUMABLES, PVE_AREAS, getPvEArea, type ConsumableId } from "@digiworld/content";
import type { WorldClient } from "../net/world-client";
import { useGameInputBlock } from "./use-game-input-block";
import { QuestJournal } from "./QuestJournal";
import { RefugeShop } from "./RefugeShop";
import { ProfileAccessPanel } from "./ProfileAccessPanel";

const PVE_TABS = [
  {id: "inventory", label: "Mochila / Mapa"},
  {id: "quests", label: "Misiones"},
  {id: "shop", label: "Tienda"},
  {id: "access", label: "Partida"},
] as const;

export function PvEPanel({client}:{client:WorldClient}) {
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<typeof PVE_TABS[number]["id"]>("inventory");
  useGameInputBlock(client, open);
  const [,bump]=useReducer((n:number)=>n+1,0);
  useEffect(()=>client.subscribeCombat(bump),[client]);
  useEffect(()=>{const timer=setInterval(bump,250);return()=>clearInterval(timer);},[]);
  const local=client.players.get(client.localId);
  if(!local)return null;
  const area=getPvEArea(local.x,local.z);
  const inventory=client.inventory;
  const cooldown=Math.max(0,client.itemReadyAt-Date.now());
  const boss=[...client.wilds.values()].find(w=>w.isBoss);
  return <>
    <button type="button" className="camera-button" onClick={()=>{client.clearKeys();client.releaseMouse();setOpen(!open);}}>Mochila / Mapa</button>
    {open&&createPortal(<div className="evolution-overlay" onKeyDown={event=>{event.stopPropagation();if(event.key==="Escape")setOpen(false);}}>
      <section className="evolution-dialog pve-dialog panel" role="dialog" aria-modal="true" aria-label="Mochila y mapa">
        <header><h2>Mochila y mapa</h2><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Cerrar mochila">×</button></header>
        <div className="pve-tabs" role="tablist" aria-label="Secciones de la mochila" onKeyDown={event=>{
          if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
          event.preventDefault();
          const index=PVE_TABS.findIndex(item=>item.id===tab);
          const nextIndex=event.key==="Home"?0:event.key==="End"?PVE_TABS.length-1:(index+(event.key==="ArrowLeft"?-1:1)+PVE_TABS.length)%PVE_TABS.length;
          const next=PVE_TABS[nextIndex]!.id;
          setTab(next);
          event.currentTarget.querySelector<HTMLButtonElement>(`[data-pve-tab="${next}"]`)?.focus();
        }}>
          {PVE_TABS.map(item=><button key={item.id} type="button" id={`pve-tab-${item.id}`} role="tab" data-pve-tab={item.id} aria-selected={tab===item.id} aria-controls={`pve-section-${item.id}`} tabIndex={tab===item.id?0:-1} onClick={()=>setTab(item.id)}>{item.label}</button>)}
        </div>
        {tab==="access"?<div id="pve-section-access" role="tabpanel" aria-labelledby="pve-tab-access"><ProfileAccessPanel client={client}/></div>:tab==="shop"?<div id="pve-section-shop" role="tabpanel" aria-labelledby="pve-tab-shop"><RefugeShop client={client} local={local} /></div>:tab==="quests"?<div id="pve-section-quests" role="tabpanel" aria-labelledby="pve-tab-quests"><QuestJournal client={client} local={local} /></div>:<div className="pve-columns" id="pve-section-inventory" role="tabpanel" aria-labelledby="pve-tab-inventory">
          <div>
            <h3>Tu mochila</h3><p>{inventory.bits} Bits · {inventory.devimonSeals} sellos de Devimon</p>
            {!client.inventoryLoaded&&<p>Recuperando inventario…</p>}
            {(Object.entries(CONSUMABLES) as Array<[ConsumableId,typeof CONSUMABLES.hp_potion]>).map(([id,item])=>{
              const count=id==="hp_potion"?inventory.hpPotion:inventory.epPotion;
              const full=id==="hp_potion"?local.hp>=local.maxHp:local.ep>=local.maxEp;
              const disabled=!client.inventoryLoaded||count<=0||cooldown>0||full||local.hp<=0||Boolean(local.duelOpponent);
              return <article className="inventory-item" key={id}>
                <strong>{item.icon} {item.name} ×{count}</strong><p>{item.description}</p>
                <button type="button" data-item={id} disabled={disabled} onClick={()=>client.useItem(id)}>
                  {cooldown>0?`Recarga ${Math.ceil(cooldown/1000)} s`:full?"Completo":"Usar en tu Digimon"}
                </button>
              </article>;
            })}
            <p className="evolution-note">Discos: recarga compartida de 8 s; no se permiten en duelos. En la pestaña Tienda puedes comprar discos con Bits o canjear sellos en el refugio.</p>
            <button type="button" onClick={()=>client.recallCompanion()} disabled={Boolean(local.duelOpponent)}>Retirar compañero (R)</button>
            <p>{client.companionPassive?"Tu compañero vuelve hacia ti. Selecciona otro enemigo para atacar de nuevo.":"R cancela el ataque y llama al compañero; muévete para alejarlo del jefe."}</p>
          </div>
          <div>
            <h3>{area.name}</h3>
            <svg className="pve-map" viewBox="-60 -60 120 120" role="img" aria-label="Mapa de zonas y jefe Devimon">
              <rect x="-58" y="-58" width="116" height="116" fill="#172b2d" />
              {[...PVE_AREAS].reverse().map(a=><circle key={a.id} r={a.radius} fill={a.color} fillOpacity="0.22" stroke={a.color} strokeWidth="0.5" />)}
              <text x="0" y="-53" textAnchor="middle" fill="#ffffff" fontSize="4">N (+Z)</text>
              <circle cx="44" cy="-44" r="3" fill={boss&&boss.hp>0?"#cf8fff":"#58646b"} />
              <circle cx={local.partnerX} cy={-local.partnerZ} r="1.6" fill="#8cffa9" />
              <circle cx={local.x} cy={-local.z} r="1.8" fill="#ffffff" />
            </svg>
            <p className="evolution-note">Blanco: tú · Verde: compañero · Violeta: Devimon (44, 44)</p>
            <ul className="pve-area-list">{PVE_AREAS.map(a=><li key={a.id} style={{color:a.color}}>{a.name}: {a.safe?"refugio":`Nv. ${a.minLevel}–${a.maxLevel}`}</li>)}</ul>
            <p>Devimon: {boss&&boss.hp>0?`Nv. ${boss.level} · ${Math.ceil(boss.hp)}/${boss.maxHp} HP`:"derrotado · reaparece tras 2 minutos"}</p>
            <p className="evolution-note">Jefe recomendado para nivel 14+ o un grupo. Su círculo violeta anuncia Garra de la Oscuridad: retira al compañero con R y aléjate para salir del círculo. Se enfurece por debajo del 30% de HP.</p>
          </div>
        </div>}
        {client.lastError&&Date.now()-client.lastError.at<5000&&<p role="alert" className="form-error">{client.lastError.text}</p>}
      </section>
    </div>,document.body)}
  </>;
}

export function PvEStatus({client}:{client:WorldClient}) {
  const [,bump]=useReducer((n:number)=>n+1,0);
  useEffect(()=>{const timer=setInterval(bump,250);return()=>clearInterval(timer);},[]);
  const local=client.players.get(client.localId);
  if(!local)return null;
  const area=getPvEArea(local.x,local.z);
  const loot=client.lastLoot&&client.lastLoot.until>Date.now()?client.lastLoot.data:null;
  return <div className="world-status">
    <div className="area-banner panel" style={{borderColor:area.color}}>
      <strong>{area.name}</strong> · {area.safe?"Zona segura":`Nv. ${area.minLevel}–${area.maxLevel}`}
      {!area.safe&&local.level<area.minLevel&&<span className="area-danger"> · Peligro</span>}
    </div>
    {loot&&<div className="loot-toast panel" role="status">Botín: +{loot.bits} Bits
      {loot.hpPotion>0&&` · ${loot.hpPotion} vida`}
      {loot.epPotion>0&&` · ${loot.epPotion} energía`}
      {loot.devimonSeals>0&&` · ${loot.devimonSeals} sello(s)`}
    </div>}
  </div>;
}
