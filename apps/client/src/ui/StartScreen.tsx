import { useState } from "react";

import {
  getEvolutionTargets,
  SPECIES,
  STARTER_IDS,
  type Species,
  type StarterId,
} from "@digiworld/content";

import { CharacterStage } from "./CharacterStage";
import { getSavedProfile } from "../net/profile";
import { ProfileImport } from "./ProfileImport";

const STAT_MAX = {
  hp: 300,
  ep: 100,
  atk: 80,
  def: 60,
  spd: 45,
} as const;

const STAT_LABEL = {
  hp: "HP",
  ep: "EP",
  atk: "ATK",
  def: "DEF",
  spd: "VEL",
} as const;

function StatBars({ species }: { species: Species }) {
  return (
    <div className="stat-bars">
      {(Object.keys(STAT_MAX) as Array<keyof typeof STAT_MAX>).map((key) => (
        <div className="stat-row" key={key}>
          <span className="stat-label">{STAT_LABEL[key]}</span>
          <span className="stat-track">
            <span
              className={`stat-fill stat-${key}`}
              style={{
                width: `${Math.min(100, (species.stats[key] / STAT_MAX[key]) * 100)}%`,
              }}
            />
          </span>
          <span className="stat-value">{species.stats[key]}</span>
        </div>
      ))}
    </div>
  );
}

export function StartScreen({
  initialName,
  status,
  error,
  onJoin,
}: {
  initialName: string;
  status: "idle" | "connecting" | "error";
  error: string | null;
  onJoin: (name: string, species: string) => void;
}) {
  const [saved,setSaved] = useState(getSavedProfile);
  const [name, setName] = useState(saved?.name ?? initialName);
  const [selected, setSelected] = useState<StarterId>("koromon");
  const shouldAutoFocus =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: fine)").matches &&
    window.innerWidth > 700;

  const trimmed = name.trim();
  const validName = trimmed.length >= 2 && trimmed.length <= 16;
  const connecting = status === "connecting";
  const displaySpecies = saved?.species ?? selected;
  const species = SPECIES[displaySpecies]!;
  const evolutions = getEvolutionTargets(displaySpecies);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validName || connecting) {
      return;
    }
    onJoin(trimmed, displaySpecies);
  };

  return (
    <div className="start-screen">
      <div className="start-aurora" aria-hidden="true" />
      <div className="start-grid" aria-hidden="true" />

      <main className="start-shell">
        <section className="start-hero">
          <p className="eyebrow">
            <span className="live-dot" />
            Prototipo interno · Alfa 0.1
          </p>

          <h1 className="game-title">
            DIGIWORLD
            <span>ONLINE</span>
          </h1>

          <p className="lead">
            Un MMORPG 2.5D con sprites DS para navegador y Android. Explora el Bosque
            Digital con cámara elevada en tercera persona estilo Digimon World
            DS / Ragnarok y combate en tiempo real con tu Digimon.
          </p>

          <ul className="feature-pills">
            <li>Sprites DS</li>
            <li>Cámara 3ª persona elevada</li>
            <li>Web + Android</li>
          </ul>

          <div
            className="character-showcase"
          >
            <CharacterStage speciesId={displaySpecies} />
            <div className="character-showcase-top">
              <span className="character-showcase-title">
                Vista DS · <strong>{species.name}</strong>
              </span>
              <span className="detail-badge">Sprites DS</span>
            </div>
          </div>
          <p className="character-showcase-caption">
            Arrastra para ver las vistas disponibles del sprite DS
          </p>
        </section>

        <section className="start-panel">
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Nombre de domador</span>
              <input
                value={name}
                readOnly={Boolean(saved)}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="Ej. Alvaro"
                autoFocus={shouldAutoFocus}
              />
              <small>Entre 2 y 16 caracteres.</small>
            </label>

            {saved && <section className="saved-profile panel">
              <strong>Tu partida guardada</strong>
              <p>{saved.name} · {species.name} · Nivel {saved.level}</p>
              <small>XP {saved.xp}/{saved.xpNext} · {saved.duelWins} victorias / {saved.duelLosses} derrotas</small>
              <p>El servidor recuperará tu progreso real. Puedes vincular otro dispositivo y crear una clave de recuperación desde Mochila / Mapa → Partida. No borres los datos del sitio sin otro acceso.</p>
            </section>}
            {!saved && <fieldset className="starter-fieldset">
              <legend>Elige tu compañero</legend>
              <div className="starter-grid">
                {STARTER_IDS.map((id) => {
                  const starter = SPECIES[id]!;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`starter-card ${selected === id ? "is-selected" : ""}`}
                      onClick={() => setSelected(id)}
                      aria-pressed={selected === id}
                    >
                      <span
                        className="starter-orb"
                        style={{
                          background: `radial-gradient(circle at 35% 30%, ${starter.accent}, ${starter.color})`,
                        }}
                      />
                      <span className="starter-name">{starter.name}</span>
                      <span className="starter-meta">
                        {starter.stageLabel} · {starter.elementLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>}

            <div className="species-preview">
              <div className="species-heading">
                <span
                  className="species-orb"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${species.accent}, ${species.color})`,
                  }}
                />
                <div>
                  <h2>{species.name}</h2>
                  <div className="chips">
                    <span>{species.stageLabel}</span>
                    <span>{species.attributeLabel}</span>
                    <span>{species.elementLabel}</span>
                  </div>
                </div>
              </div>

              <p className="species-description">{species.description}</p>
              <StatBars species={species} />

              <p className="evolution-line">
                {evolutions.length > 0 ? (
                  <>
                    Evoluciona a <strong>{evolutions[0]!.name}</strong> al llegar
                    al nivel {species.evolvesTo[0]?.level ?? 8}.
                  </>
                ) : (
                  "Ruta evolutiva pendiente de contenido."
                )}
              </p>
            </div>

            <button
              type="submit"
              className="join-button"
              disabled={!validName || connecting}
            >
              {connecting ? "Recuperando partida..." : saved ? `Continuar con ${species.name} (Nv. ${saved.level})` : "Entrar al Bosque Digital"}
            </button>

            {error && <p className="form-error">{error}</p>}

            <p className="legal-note">
              Uso interno y privado. Los nombres y criaturas de Digimon
              pertenecen a sus titulares; no distribuir este prototipo.
            </p>
          </form>
          <ProfileImport hasSaved={Boolean(saved)} disabled={connecting} onImported={profile=>{setSaved(profile);setName(profile.name);}}/>
        </section>
      </main>
    </div>
  );
}
