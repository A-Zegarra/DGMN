import { useEffect, useReducer } from "react";

import { SPECIES } from "@digiworld/content";

import type { PlayerView, WorldClient } from "../net/world-client";

function useCombatTick(): void {
  const [, tick] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, []);
}

export function VitalBars({
  hp,
  maxHp,
  ep,
  maxEp,
  compact = false,
}: {
  hp: number;
  maxHp: number;
  ep: number;
  maxEp: number;
  compact?: boolean;
}) {
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const epPercent = maxEp > 0 ? Math.max(0, Math.min(100, (ep / maxEp) * 100)) : 0;

  return (
    <div className={`vital-bars ${compact ? "is-compact" : ""}`}>
      <div className="vital-row">
        <span className="vital-label">HP</span>
        <span className="vital-track">
          <span
            className="vital-fill vital-hp"
            style={{ width: `${hpPercent}%` }}
          />
        </span>
        <span className="vital-number">
          {Math.ceil(hp)}/{Math.ceil(maxHp)}
        </span>
      </div>
      <div className="vital-row">
        <span className="vital-label">EP</span>
        <span className="vital-track">
          <span
            className="vital-fill vital-ep"
            style={{ width: `${epPercent}%` }}
          />
        </span>
        <span className="vital-number">
          {Math.ceil(ep)}/{Math.ceil(maxEp)}
        </span>
      </div>
    </div>
  );
}

function CombatantRow({
  player,
  label,
}: {
  player: PlayerView;
  label: string;
}) {
  const species = SPECIES[player.species];
  return (
    <div className="combatant">
      <div className="combatant-head">
        <span className="combatant-label">{label}</span>
        <strong>{player.name}</strong>
        <span className="combatant-species">
          {species?.name ?? player.species} · Nv. {player.level}
        </span>
      </div>
      <VitalBars
        hp={player.hp}
        maxHp={player.maxHp}
        ep={player.ep}
        maxEp={player.maxEp}
        compact
      />
    </div>
  );
}

export function CombatHud({ client }: { client: WorldClient }) {
  const [, bump] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return client.subscribeCombat(() => bump());
  }, [client]);

  useCombatTick();

  const local = client.players.get(client.localId);
  if (!local) {
    return null;
  }

  const target = client.targetId
    ? client.players.get(client.targetId)
    : undefined;
  const opponent = local.duelOpponent
    ? client.players.get(local.duelOpponent)
    : undefined;
  const selectedTarget =
    target && target.id !== local.id && !opponent ? target : undefined;
  const abilities = client.getAbilities();

  return (
    <>
      {client.incomingDuel && (
        <div className="duel-backdrop">
          <section className="duel-modal panel">
            <span className="panel-title">Solicitud de duelo</span>
            <p>
              <strong>{client.incomingDuel.fromName}</strong> (
              {SPECIES[client.incomingDuel.fromSpecies]?.name ??
                client.incomingDuel.fromSpecies}{" "}
              Nv. {client.incomingDuel.fromLevel}) te reta a un duelo.
            </p>
            <div className="duel-actions">
              <button
                type="button"
                className="duel-accept"
                onClick={() => client.respondDuel(true)}
              >
                Aceptar
              </button>
              <button
                type="button"
                className="duel-decline"
                onClick={() => client.respondDuel(false)}
              >
                Rechazar
              </button>
            </div>
          </section>
        </div>
      )}

      {client.duelResult && (
        <div
          className={`duel-result ${client.duelResult.won ? "is-win" : "is-loss"}`}
        >
          <strong>{client.duelResult.won ? "¡Duelo ganado!" : "Duelo perdido"}</strong>
          <span>
            {client.duelResult.won
              ? `Venciste a ${client.duelResult.opponentName}`
              : `${client.duelResult.opponentName} te venció`}
          </span>
        </div>
      )}

      {client.lastError && (
        <button
          type="button"
          className="combat-error"
          onClick={() => client.clearError()}
        >
          {client.lastError.text}
        </button>
      )}

      {client.pendingDuelTargetName && !client.duelResult && (
        <div className="combat-pending">
          Esperando respuesta de {client.pendingDuelTargetName}…
        </div>
      )}

      {(() => {
        const feed = client.getCombatFeed();
        if (feed.length === 0) {
          return null;
        }
        return (
          <div className="combat-feed" aria-live="polite">
            {feed.map((entry) => (
              <div
                key={entry.id}
                className={`combat-feed-row is-${entry.kind}`}
              >
                <strong>
                  {entry.kind === "damage-in" || entry.kind === "ability-in"
                    ? `-${Math.round(entry.amount)}`
                    : entry.kind === "heal"
                      ? `+${Math.round(entry.amount)}`
                      : `${Math.round(entry.amount)}`}
                </strong>
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {(opponent || selectedTarget) && (
        <section className="combat-panel panel">
          <header className="combat-header">
            <span className="panel-title">
              {opponent ? "Duelo en curso" : "Objetivo"}
            </span>
            {!opponent && (
              <button
                type="button"
                className="combat-close"
                onClick={() => client.clearTarget()}
                aria-label="Quitar objetivo"
              >
                ×
              </button>
            )}
          </header>

          {opponent ? (
            <>
              <CombatantRow player={local} label="Tú" />
              <CombatantRow player={opponent} label="Rival" />
              <div className="combat-actions">
                <button
                  type="button"
                  className="duel-forfeit"
                  onClick={() => client.forfeitDuel()}
                >
                  Rendirse
                </button>
              </div>
              <span className="combat-hint">
                Usa 1–3 para atacar. Los ataques básicos son automáticos.
              </span>
            </>
          ) : (
            selectedTarget && (
              <>
                <CombatantRow player={selectedTarget} label="Objetivo" />
                <div className="combat-actions">
                  <button
                    type="button"
                    className="duel-challenge"
                    disabled={
                      local.inCombat ||
                      selectedTarget.inCombat ||
                      selectedTarget.hp <= 0
                    }
                    onClick={() => client.requestDuel(selectedTarget.id)}
                  >
                    {selectedTarget.hp <= 0
                      ? "Fuera de combate"
                      : selectedTarget.inCombat
                        ? "Ya está en combate"
                        : "Retar a duelo"}
                  </button>
                </div>
                <span className="combat-hint">
                  Acércate a menos de 15 m. Tab cambia de objetivo.
                </span>
              </>
            )
          )}
        </section>
      )}

      <div className="ability-bar panel">
        {abilities.map((ability, index) => {
          const remaining = client.getCooldownRemaining(ability.id);
          const disabled =
            !local.inCombat ||
            !local.duelOpponent ||
            local.hp <= 0 ||
            remaining > 0 ||
            local.ep < ability.cost ||
            (ability.kind === "heal" && local.hp >= local.maxHp - 0.5);
          const cooldownPercent =
            remaining > 0
              ? Math.min(100, (remaining / ability.cooldownMs) * 100)
              : 0;

          return (
            <button
              key={ability.id}
              type="button"
              className={`ability-button ${disabled ? "is-disabled" : ""}`}
              disabled={disabled}
              title={`${ability.name} — ${ability.description} (${ability.cost} EP)`}
              onClick={() => client.useAbility(ability.id)}
            >
              <span className="ability-key">{index + 1}</span>
              <span className="ability-icon">{ability.icon}</span>
              <span className="ability-cost">{ability.cost} EP</span>
              <span className="ability-name">{ability.name}</span>
              {remaining > 0 && (
                <span
                  className="ability-cooldown"
                  style={{ height: `${cooldownPercent}%` }}
                >
                  <span>{Math.ceil(remaining / 1000)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
