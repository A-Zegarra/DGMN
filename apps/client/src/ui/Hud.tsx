import { useEffect, useReducer, useState } from "react";

import { SPECIES } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { exitPointerLockSafe, requestPointerLockSafe } from "../pointer-lock";
import { ChatPanel } from "./ChatPanel";
import { VirtualJoystick } from "./VirtualJoystick";

export function Hud({
  client,
  onExit,
}: {
  client: WorldClient;
  onExit: () => void;
}) {
  const [, bumpRoster] = useReducer((value: number) => value + 1, 0);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isTouch, setIsTouch] = useState(() =>
    window.matchMedia("(pointer: coarse)").matches,
  );
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth <= 700);

  useEffect(() => {
    return client.subscribeRoster(() => bumpRoster());
  }, [client]);

  useEffect(() => {
    const update = () => setPointerLocked(Boolean(document.pointerLockElement));
    const media = window.matchMedia("(pointer: coarse)");
    const updateTouch = () => setIsTouch(media.matches);
    const updateNarrow = () => setIsNarrow(window.innerWidth <= 700);

    update();
    updateTouch();
    updateNarrow();
    document.addEventListener("pointerlockchange", update);
    media.addEventListener("change", updateTouch);
    window.addEventListener("resize", updateNarrow);

    return () => {
      document.removeEventListener("pointerlockchange", update);
      media.removeEventListener("change", updateTouch);
      window.removeEventListener("resize", updateNarrow);
    };
  }, []);

  const players = Array.from(client.players.values());
  const local = client.players.get(client.localId);
  const species = local ? SPECIES[local.species] : undefined;
  const isFirstPerson = client.cameraMode === "first-person";
  const isMobile = isTouch || isNarrow;

  const roster = players
    .slice()
    .sort((a, b) =>
      a.id === client.localId ? -1 : b.id === client.localId ? 1 : 0,
    )
    .slice(0, 7);

  const toggleCamera = () => {
    const next = client.toggleCameraMode();
    if (next === "first-person") {
      requestPointerLockSafe();
    } else {
      exitPointerLockSafe();
    }
  };

  return (
    <div className="hud">
      {isFirstPerson && <div className="crosshair" aria-hidden="true" />}

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
            <button
              type="button"
              className="camera-button"
              onClick={toggleCamera}
              title="Cambiar cámara (V)"
            >
              {isFirstPerson ? "1ª persona" : "Isométrica"}
            </button>
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

      {isFirstPerson && !isMobile && !pointerLocked && (
        <div className="fp-hint panel">Haz clic en el mundo para mirar</div>
      )}

      {isFirstPerson && isMobile && <VirtualJoystick client={client} />}

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
            {isFirstPerson ? (
              <>
                <span>
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> mover
                </span>
                <span>
                  <kbd>Ratón</kbd> mirar
                </span>
                <span>
                  <kbd>Shift</kbd> correr
                </span>
                <span>
                  <kbd>V</kbd> cambiar vista
                </span>
                <span>
                  <kbd>Enter</kbd> chat
                </span>
              </>
            ) : (
              <>
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
                  <kbd>V</kbd> cambiar vista
                </span>
                <span>
                  <kbd>Enter</kbd> chat
                </span>
              </>
            )}
          </div>

          {!(isFirstPerson && isMobile) && (
            <div className="touch-hint panel">Toca el suelo para moverte</div>
          )}
        </div>

        <ChatPanel
          client={client}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </footer>

      <button
        type="button"
        className="chat-toggle panel"
        onClick={() => setChatOpen((value) => !value)}
      >
        {chatOpen ? "Cerrar chat" : "Chat"}
      </button>
    </div>
  );
}
