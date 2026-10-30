import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { AGUMON_LINE, SPECIES, companionVitals, getAbilitiesForSpecies } from "@digiworld/content";
import type { WorldClient } from "../net/world-client";
import { useGameInputBlock } from "./use-game-input-block";

export function EvolutionPanel({client}: {client: WorldClient}) {
  const [open, setOpen] = useState(false);
  useGameInputBlock(client, open);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => client.subscribeCombat(bump), [client]);
  useEffect(() => client.subscribeRoster(bump), [client]);
  useEffect(() => {
    const timer = setInterval(bump, 250);
    return () => clearInterval(timer);
  }, []);
  const local = client.players.get(client.localId);
  if (!local) return null;
  const species = SPECIES[local.species];
  const requirements = species?.evolvesTo ?? [];
  const transforming = Boolean(client.evolutionNotice && client.evolutionNotice.until > Date.now());
  const notice = client.evolutionNotice;
  const pending = client.evolutionPendingUntil > Date.now();
  return <>
    <button type="button" className="camera-button" onClick={() => {
      client.releaseMouse(); client.clearKeys(); setOpen(!open);
    }}>Evolución</button>
    {transforming && notice && createPortal(<div className="evolution-toast panel" role="status">
      ✨ {SPECIES[notice.from]?.name} → <strong>{SPECIES[notice.to]?.name}</strong>
    </div>, document.body)}
    {open && createPortal(<div className="evolution-overlay" onKeyDown={event => {
      event.stopPropagation(); if (event.key === "Escape") setOpen(false);
    }}>
      <section className="evolution-dialog panel" role="dialog" aria-modal="true" aria-label="Digievolución">
        <header><h2>Digievolución</h2><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Cerrar evolución">×</button></header>
        <p>Tu compañero: <strong>{species?.name}</strong> · Nivel {local.level}</p>
        <ol className="evolution-line">
          {AGUMON_LINE.map((id, index) => {
            const stage = SPECIES[id]!;
            const level = index === 0 ? 1 : SPECIES[AGUMON_LINE[index - 1]!]!.evolvesTo.find(e => e.id === id)!.level;
            return <li key={id} className={local.species === id ? "is-current" : ""}>
              <span style={{color: stage.color}}>●</span><strong>{stage.name}</strong>
              <small>{stage.stageLabel} · Nv. {level}</small>
            </li>;
          })}
        </ol>
        <p className="evolution-note">La evolución se guarda en el servidor. Conservas nivel y XP y el porcentaje de HP/EP. Debes estar fuera de combate.</p>
        {requirements.length === 0 && <p>{local.species === "wargreymon" ? "¡Has alcanzado WarGreymon, etapa Mega de esta línea!" : "No hay más evoluciones disponibles para este compañero."}</p>}
        {requirements.map(requirement => {
          const next = SPECIES[requirement.id]!;
          const previewLevel = Math.max(local.level, requirement.level);
          const vitals = companionVitals(next.id, previewLevel);
          const reason = transforming ? "Digievolucionando…" : pending ? "Solicitando…" : local.hp <= 0 ? "Tu Digimon debe recuperarse" : local.inCombat || local.duelOpponent ? "Sal del combate para evolucionar" : local.level < requirement.level ? `Necesitas nivel ${requirement.level}` : null;
          return <section className="evolution-option" key={next.id}>
            <h3>{species?.name} → {next.name}</h3>
            <p>{next.description}</p>
            <p>Al nivel {previewLevel}: HP máx. {vitals.maxHp} · EP máx. {vitals.maxEp} · ATK {next.stats.atk} · DEF {next.stats.def}</p>
            <p>Habilidades: {getAbilitiesForSpecies(next.id).map(a => a.name).join(" · ")}</p>
            <button type="button" className="evolve-button" data-target={next.id} disabled={Boolean(reason)}
              onClick={() => client.evolve(next.id)}>{reason ?? `Digievolucionar a ${next.name}`}</button>
          </section>;
        })}
        {client.lastError && Date.now() - client.lastError.at < 5000 && <p role="alert" className="form-error">{client.lastError.text}</p>}
        <p className="evolution-note">Toda esta línea usa sprites originales de Digimon World DS. Los ángulos ausentes reutilizan o reflejan las vistas disponibles. No borres los datos del navegador: contienen la clave privada de tu partida.</p>
      </section>
    </div>, document.body)}
  </>;
}
