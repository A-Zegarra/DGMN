import { useState } from "react";

import {
  getEvolutionTargets,
  SPECIES,
  STARTER_IDS,
  type Species,
  type StarterId,
} from "@digiworld/content";

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
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<StarterId>("agumon");

  const trimmed = name.trim();
  const validName = trimmed.length >= 2 && trimmed.length <= 16;
  const connecting = status === "connecting";
  const species = SPECIES[selected]!;
  const evolutions = getEvolutionTargets(selected);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validName || connecting) {
      return;
    }
    onJoin(trimmed, selected);
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
            Un MMORPG 3D ligero para navegador y Android. Explora el Bosque
            Digital en primera persona junto a tu Digimon, en tiempo real y con
            una vista isométrica cuando la necesites.
          </p>

          <ul className="feature-pills">
            <li>Primera persona + isométrico</li>
            <li>Tu Digimon te acompaña</li>
            <li>Web + Android</li>
          </ul>

          <div className="roadmap-card">
            <span className="panel-title">En esta primera prueba</span>
            <ul>
              <li>Cámara en primera persona y vista isométrica</li>
              <li>Tu Digimon camina delante de ti</li>
              <li>Varios jugadores en la misma zona</li>
              <li>Chat de zona y compañero inicial</li>
            </ul>
          </div>
        </section>

        <section className="start-panel">
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Nombre de domador</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={16}
                placeholder="Ej. Alvaro"
                autoFocus
              />
              <small>Entre 2 y 16 caracteres.</small>
            </label>

            <fieldset className="starter-fieldset">
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
            </fieldset>

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
              {connecting ? "Conectando..." : "Entrar al Bosque Digital"}
            </button>

            {error && <p className="form-error">{error}</p>}

            <p className="legal-note">
              Uso interno y privado. Los nombres y criaturas de Digimon
              pertenecen a sus titulares; no distribuir este prototipo.
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
