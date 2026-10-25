import { useEffect, useReducer, useState } from "react";

import { SPECIES } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { requestPointerLockSafe } from "../pointer-lock";
import { ChatPanel } from "./ChatPanel";
import { TouchLookArea } from "./TouchLookArea";
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
  const [fullscreen, setFullscreen] = useState(() =>
    Boolean(document.fullscreenElement),
  );

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

  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener(
        "webkitfullscreenchange",
        update as EventListener,
      );
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
    client.toggleCameraMode();
    requestPointerLockSafe();
  };

  const toggleScreen = async () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const element = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape" | "portrait") => Promise<void>;
      unlock?: () => void;
    };

    try {
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        }

        try {
          await orientation.lock?.("landscape");
        } catch {
          // El navegador puede no permitir bloquear la orientación.
        }
      } else {
        try {
          orientation.unlock?.();
        } catch {
          // Sin bloqueo previo.
        }

        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch {
      // Pantalla completa no disponible (por ejemplo, iPhone).
    }
  };

  const screenLabel = isMobile
    ? fullscreen
      ? "Vertical"
      : "Horizontal"
    : fullscreen
      ? "Salir"
      : "Pantalla";

  return (
    <div className="hud">
      {isMobile && <TouchLookArea client={client} />}
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
              {isFirstPerson ? "1ª persona" : "3ª persona"}
            </button>
            <button
              type="button"
              className="screen-button"
              onClick={() => void toggleScreen()}
              title="Pantalla completa horizontal o volver a vertical"
            >
              <span className="screen-label">{screenLabel}</span>
              <span className="screen-icon" aria-hidden="true">
                {fullscreen ? "↺" : "⛶"}
              </span>
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

      {!isMobile && !pointerLocked && (
        <div className="fp-hint panel">Haz clic para mirar</div>
      )}

      {isMobile && <VirtualJoystick client={client} />}

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
              <kbd>Ratón</kbd> {isFirstPerson ? "mirar" : "orbitar"}
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
          </div>
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
