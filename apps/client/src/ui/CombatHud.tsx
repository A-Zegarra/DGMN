import { useEffect, useReducer } from "react";
import { useGameInputBlock } from "./use-game-input-block";

import { SPECIES } from "@digiworld/content";

import type { PlayerView, WildView, WorldClient } from "../net/world-client";

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
  showEp = true,
  xp,
  xpNext,
}: {
  hp: number;
  maxHp: number;
  ep: number;
  maxEp: number;
  compact?: boolean;
  showEp?: boolean;
  xp?: number;
  xpNext?: number;
}) {
  const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
  const epPercent = maxEp > 0 ? Math.max(0, Math.min(100, (ep / maxEp) * 100)) : 0;
  const xpPercent =
    xpNext && xpNext > 0 && xp !== undefined
      ? Math.max(0, Math.min(100, (xp / xpNext) * 100))
      : 0;

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
      {showEp && (
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
      )}
      {xp !== undefined && xpNext !== undefined && (
        <div className="vital-row">
          <span className="vital-label">XP</span>
          <span className="vital-track">
            <span
              className="vital-fill vital-xp"
              style={{ width: `${xpPercent}%` }}
            />
          </span>
          <span className="vital-number">
            {Math.ceil(xp)}/{Math.ceil(xpNext)}
          </span>
        </div>
      )}
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
        <strong>{species?.name ?? player.species}</strong>
        <span className="combatant-species">
          Compañero de {player.name} · Nv. {player.level}
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

function WildCombatantRow({ wild }: { wild: WildView }) {
  const species = SPECIES[wild.species];
  return (
    <div className="combatant">
      <div className="combatant-head">
        <span className="combatant-label">{wild.isBoss ? "Jefe de zona" : "Salvaje"}</span>
        <strong>{wild.name}</strong>
        <span className="combatant-species">
          {species?.name ?? wild.species} · Nv. {wild.level}
        </span>
      </div>
      <VitalBars
        hp={wild.hp}
        maxHp={wild.maxHp}
        ep={0}
        maxEp={0}
        compact
        showEp={false}
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
  useGameInputBlock(client, Boolean(client.incomingDuel));

  const local = client.players.get(client.localId);
  if (!local) {
    return null;
  }

  const target = client.targetId
    ? client.players.get(client.targetId)
    : undefined;
  const wildTarget = client.targetWildId
    ? client.wilds.get(client.targetWildId)
    : undefined;
  const opponent = local.duelOpponent
    ? client.players.get(local.duelOpponent)
    : undefined;
  const selectedTarget =
    target && target.id !== local.id && !opponent ? target : undefined;
  const validWildTarget =
    wildTarget && wildTarget.hp > 0 && !opponent ? wildTarget : undefined;
  const abilities = client.getAbilities();
  const hasCombatTarget = Boolean(opponent || validWildTarget);
  const hasTarget = Boolean(opponent || validWildTarget || selectedTarget);
  const wildDistance = validWildTarget
    ? Math.hypot(validWildTarget.x - local.partnerX, validWildTarget.z - local.partnerZ)
    : 0;
  const targetDistance = opponent
    ? Math.hypot(opponent.partnerX - local.partnerX, opponent.partnerZ - local.partnerZ)
    : validWildTarget
      ? wildDistance
      : null;

  return (
    <>
      {client.incomingDuel && (
        <div className="duel-backdrop">
          <section className="duel-modal panel" role="dialog" aria-modal="true" aria-label="Solicitud de duelo">
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

      {client.levelUp && (
        <div className="level-up-toast">
          <strong>¡Nivel {client.levelUp.level}!</strong>
          <span>Vida y energía mejoradas</span>
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

      {(opponent || validWildTarget || selectedTarget) && (
        <section className="combat-panel panel">
          <header className="combat-header">
            <span className="panel-title">
              {opponent
                ? "Duelo en curso"
                : validWildTarget
                  ? "Digimon salvaje"
                  : "Objetivo"}
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
          ) : validWildTarget ? (
            <>
              <WildCombatantRow wild={validWildTarget} />
              <span className="combat-hint">
                {Math.round(wildDistance)} m · Correa 20 m · R: retirar
              </span>
              {validWildTarget.isBoss && <span className="combat-hint" style={{color:"#e0b2ff"}}>
                {validWildTarget.state === "casting" ? `⚠ Garra de la Oscuridad · ${Math.max(0,(validWildTarget.castEndsAt-Date.now())/1000).toFixed(1)} s · R y aléjate` : validWildTarget.hp/validWildTarget.maxHp<0.3 ? "¡Devimon está enfurecido!" : "Jefe Nv. 14 · Grupo recomendado"}
              </span>}
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
                  Distancia {Math.round(Math.hypot(selectedTarget.x - local.x, selectedTarget.z - local.z))} m · Tab o 🎯 cambia
                  de objetivo. Reta a menos de 15 m.
                </span>
              </>
            )
          )}
        </section>
      )}

      <div className="ability-bar panel">
        <div className="combat-command-status" aria-live="polite">
          {client.pendingAbility ? (
            <button onClick={() => client.cancelApproach()}>Tu Digimon se acerca · Cancelar habilidad (Esc)</button>
          ) : hasCombatTarget ? "Tu Digimon combate · R: retirar" : "🎯 Objetivo · 1–3: habilidades"}
        </div>
        <button
          type="button"
          className={`target-button ${hasTarget ? "" : "is-urgent"}`}
          onClick={() => client.cycleTarget()}
          disabled={Boolean(opponent) || local.hp <= 0}
          title="Fijar o cambiar el objetivo (Tab)"
          aria-label="Fijar o cambiar el objetivo"
        >
          <span className="target-icon" aria-hidden="true">
            🎯
          </span>
          <span className="target-label">
            {opponent
              ? "Duelo"
              : validWildTarget
                ? "Salvaje"
                : selectedTarget
                  ? "Jugador"
                  : "Objetivo"}
          </span>
          <span className="target-key">Tab</span>
        </button>

        {abilities.map((ability, index) => {
          const remaining = client.getCooldownRemaining(ability.id);
          const outOfRange =
            ability.kind === "damage" &&
            targetDistance !== null &&
            targetDistance > ability.range;
          const disabled =
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
              title={`${ability.name} — ${ability.description} (${ability.cost} EP) · Alcance ${ability.range} m${outOfRange ? " · Acercarse y atacar" : ""}`}
              onClick={() => client.useAbility(ability.id)}
            >
              <span className="ability-key">{index + 1}</span>
              <span className="ability-icon">{ability.icon}</span>
              <span className="ability-cost">{ability.cost} EP</span>
              <span className="ability-name">{ability.name}</span>
              <span className="ability-state">{remaining > 0 ? "Recargando" : local.ep < ability.cost ? "Sin energía" : outOfRange ? "Acercarse" : "Lista"}</span>
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
