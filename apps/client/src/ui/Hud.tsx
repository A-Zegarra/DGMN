import { useEffect, useReducer, useRef, useState } from "react";

import { SPECIES } from "@digiworld/content";

import type { WorldClient } from "../net/world-client";
import { CameraSettings } from "./CameraSettings";
import { ChatPanel } from "./ChatPanel";
import { CombatHud, VitalBars } from "./CombatHud";
import { TouchLookArea } from "./TouchLookArea";
import { VirtualJoystick } from "./VirtualJoystick";
import { EvolutionPanel } from "./EvolutionPanel";
import { PvEPanel, PvEStatus } from "./PvEPanel";

export function Hud({
  client,
  onExit,
}: {
  client: WorldClient;
  onExit: () => void;
}) {
  const [, bumpRoster] = useReducer((value: number) => value + 1, 0);
  const [, bumpCombat] = useReducer((value: number) => value + 1, 0);
  const [chatOpen, setChatOpen] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    const hud = hudRef.current;
    if (!header || !hud) return;
    const measure = () => hud.style.setProperty("--hud-top-end", `${header.offsetTop + header.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(hud);
    measure();
    return () => observer.disconnect();
  }, []);
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
    return client.subscribeCombat(() => bumpCombat());
  }, [client]);


  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const updateTouch = () => setIsTouch(media.matches);
    const updateNarrow = () => setIsNarrow(window.innerWidth <= 700);

    updateTouch();
    updateNarrow();
    media.addEventListener("change", updateTouch);
    window.addEventListener("resize", updateNarrow);

    return () => {
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
  const isMobile = isTouch || isNarrow;
  const hasCombatPanel = Boolean(
    local?.inCombat || client.targetId || client.targetWildId,
  );

  const roster = players
    .slice()
    .sort((a, b) =>
      a.id === client.localId ? -1 : b.id === client.localId ? 1 : 0,
    )
    .slice(0, 7);


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
    <div ref={hudRef} className={`hud ${hasCombatPanel ? "has-combat" : ""} ${isMobile ? "is-mobile" : ""} ${chatOpen ? "chat-open" : ""}`}>
      {isTouch && <TouchLookArea client={client} />}

      <header ref={headerRef} className="hud-top">
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
            <span className="online-count">{players.length} en línea</span>
            <CameraSettings client={client} />
            <EvolutionPanel client={client} />
            <PvEPanel client={client} />
            <span className="sprite-mode-label">Sprites DS</span>
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
            <span className={`save-status ${client.profileSaveError ? "has-error" : ""}`} role="status"
              title={client.profileSaveError ?? (client.profileSavedAt ? `Último guardado: ${new Date(client.profileSavedAt).toLocaleTimeString()}` : "Esperando confirmación del servidor")}>
              {client.profileSaveError ? "Error al guardar" : client.profileSavedAt ? "Guardado ✓" : "Guardando…"}
            </span>
            <button type="button" className="exit-button" disabled={client.isSavingExit} onClick={onExit}>
              {client.isSavingExit ? "Guardando…" : "Guardar y salir"}
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
      <PvEStatus client={client} />
      {client.profileSaveError && <div className="save-error panel" role="alert">{client.profileSaveError}</div>}


      {isMobile && <VirtualJoystick client={client} />}
      <CombatHud client={client} />

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
            <div className="partner-copy">
              <span className="panel-title">Tu compañero</span>
              <strong>{species?.name ?? "Conectando…"}</strong>
              <small>
                {species
                  ? `${species.stageLabel} · ${species.elementLabel} · Nv. ${local?.level ?? 1} · ${local?.duelWins ?? 0}V/${local?.duelLosses ?? 0}D`
                  : "Esperando estado del servidor"}
              </small>
              {local && (
                <VitalBars
                  hp={local.hp}
                  maxHp={local.maxHp}
                  ep={local.ep}
                  maxEp={local.maxEp}
                  xp={local.xp}
                  xpNext={local.xpNext}
                  compact
                />
              )}
            </div>
          </div>

          <details className="controls-panel panel">
            <summary>Controles de teclado y ratón</summary>
            <span>
              <kbd>W</kbd>
              <kbd>S</kbd> avanzar
            </span>
            <span>
              <kbd>A</kbd>
              <kbd>D</kbd> girar · <kbd>Q</kbd>
              <kbd>E</kbd> lateral
            </span>
            <span>
              <kbd>Ratón</kbd> izq. orbitar · der. orientar
            </span>
            <span>
              <kbd>Rueda</kbd> zoom · <kbd>Shift</kbd> correr
            </span>
            <span>
              <kbd>Tab</kbd> objetivo
            </span>
            <span>
              <kbd>1</kbd>–<kbd>3</kbd> habilidades
            </span>
            <span>
              <kbd>Enter</kbd> chat
            </span>
          </details>
        </div>

        <ChatPanel
          client={client}
          open={chatOpen}
          onOpen={() => setChatOpen(true)}
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
