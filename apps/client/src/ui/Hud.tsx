import { useEffect, useReducer } from "react";

import { SPECIES } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { ChatPanel } from "./ChatPanel";

export function Hud({
  client,
  onExit,
}: {
  client: WorldClient;
  onExit: () => void;
}) {
  const [, bumpRoster] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return client.subscribeRoster(() => bumpRoster());
  }, [client]);

  const players = Array.from(client.players.values());
  const local = client.players.get(client.localId);
  const species = local ? SPECIES[local.species] : undefined;

  const roster = players
    .slice()
    .sort((a, b) =>
      a.id === client.localId ? -1 : b.id === client.localId ? 1 : 0,
    )
    .slice(0, 7);

  return (
    <div className="hud">
      <header className="hud-top">
        <div className="brand-panel panel">
          <span className="brand-mark">DW</span>
          <span className="brand-copy">
            <strong>DIGIWORLD ONLINE</strong>
            <small>Bosque Digital · Alfa 0.1</small>
          </span>
        </div>

        <div className="hud-top-right">
          <div className="status-panel panel">
            <span className="live-dot" />
            <span>{players.length} en línea</span>
            <button type="button" className="exit-button" onClick={onExit}>
              Salir
            </button>
          </div>

          <div className="roster-panel panel">
            <span className="panel-title">Domadores</span>
            <ul>
              {roster.map((player) => {
                const playerSpecies = SPECIES[player.species];
                return (
                  <li key={player.id}>
                    <span
                      className="roster-dot"
                      style={{ background: playerSpecies?.color ?? "#7cffb2" }}
                    />
                    <span className="roster-name">
                      {player.name}
                      {player.id === client.localId ? " (tú)" : ""}
                    </span>
                    <span className="roster-level">Nv. {player.level}</span>
                  </li>
                );
              })}
            </ul>
            {players.length > roster.length && (
              <span className="roster-more">
                +{players.length - roster.length} más
              </span>
            )}
          </div>
        </div>
      </header>

      <footer className="hud-bottom">
        <div className="hud-bottom-left">
          <div className="partner-panel panel">
            <span
              className="partner-orb"
              style={{
                background: species
                  ? `radial-gradient(circle at 35% 30%, ${species.accent}, ${species.color})`
                  : "radial-gradient(circle at 35% 30%, #3d6b55, #163a2a)",
              }}
            />
            <span className="partner-copy">
              <span className="panel-title">Tu compañero</span>
              <strong>{species?.name ?? "Conectando…"}</strong>
              <small>
                {species
                  ? `${species.stageLabel} · ${species.elementLabel} · Nv. ${local?.level ?? 1}`
                  : "Esperando estado del servidor"}
              </small>
            </span>
          </div>

          <div className="controls-panel panel">
            <span>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> mover
            </span>
            <span>
              <kbd>Shift</kbd> correr
            </span>
            <span>
              <kbd>Clic</kbd> ir al punto
            </span>
            <span>
              <kbd>Enter</kbd> chat
            </span>
          </div>

          <div className="touch-hint panel">Toca el suelo para moverte</div>
        </div>

        <ChatPanel client={client} />
      </footer>
    </div>
  );
}
