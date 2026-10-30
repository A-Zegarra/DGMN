import { BITS_LIMIT, INVENTORY_LIMIT, PVE_QUESTS, getPvEArea } from "@digiworld/content";
import type { PlayerView, WorldClient } from "../net/world-client";

/** Se actualiza con las suscripciones y el reloj del diálogo de mochila. */
export function QuestJournal({client, local}: {client: WorldClient; local: PlayerView}) {
  const {completed, kills} = client.quests;
  const active = PVE_QUESTS[completed.length];
  const atRefuge = getPvEArea(local.x, local.z).safe && getPvEArea(local.partnerX, local.partnerZ).safe;
  const evolving = client.evolutionPendingUntil > Date.now() || (client.evolutionNotice?.until ?? 0) > Date.now();
  const canDeliver = atRefuge && local.hp > 0 && !local.inCombat && !local.duelOpponent && !evolving;
  const inventory = client.inventory;
  const notice = client.lastQuestReward && client.lastQuestReward.until > Date.now() ? client.lastQuestReward.data : null;
  return <section className="quest-journal" aria-label="Misiones PvE">
    <h3>Misiones del refugio</h3>
    <p className="evolution-note">Las misiones se activan en orden. Completa el objetivo y vuelve con tu Digimon al refugio para cobrar y desbloquear la siguiente. No cuentan bajas anteriores.</p>
    {!client.questsLoaded ? <p role="status">Recuperando misiones…</p> : <>
      {PVE_QUESTS.map((quest, index) => {
        const done = index < completed.length;
        const current = quest.id === active?.id;
        const ready = current && kills >= quest.count;
        const reward = quest.reward;
        const fits = inventory.bits + reward.bits <= BITS_LIMIT && inventory.hpPotion + reward.hpPotion <= INVENTORY_LIMIT &&
          inventory.epPotion + reward.epPotion <= INVENTORY_LIMIT && inventory.devimonSeals + reward.devimonSeals <= INVENTORY_LIMIT;
        return <article key={quest.id} data-quest={quest.id} className={`quest-card ${current ? "is-active" : ""}`}>
          <h4>{done ? "✓ " : ""}{quest.name} <small>{done ? "Entregada" : current ? `Nv. ${quest.recommendedLevel}+ recomendado` : "Bloqueada"}</small></h4>
          {current && <>
            <p>{quest.description}</p>
            <p className="quest-objective">{quest.objective} · <strong data-quest-progress>{kills} / {quest.count}</strong></p>
            <progress aria-label={`Progreso: ${quest.name}`} value={kills} max={quest.count} />
            <p>Recompensa: {reward.xp} XP · {reward.bits} Bits · {reward.hpPotion} discos de vida · {reward.epPotion} de energía{reward.devimonSeals > 0 ? ` · ${reward.devimonSeals} sello de Devimon` : ""}</p>
            <button type="button" data-quest-claim={quest.id}
              disabled={!ready || !canDeliver || !fits || !client.inventoryLoaded}
              onClick={() => client.room.send("quest_claim", {questId: quest.id})}>
              {ready ? "Entregar misión" : "Objetivo en curso"}
            </button>
            {ready && <p className="evolution-note">{!atRefuge ? "Vuelve con tu Digimon al Refugio del Inicio para entregar." : !canDeliver ? "Espera a estar fuera de combate y a que tu Digimon se recupere o termine de evolucionar." : !fits ? "Libera espacio en la mochila: se entrega la recompensa completa." : "Objetivo completado. Puedes cobrar la recompensa."}</p>}
          </>}
          {!done && !current && <p className="evolution-note">Entrega la misión anterior para desbloquearla.</p>}
        </article>;
      })}
      {!active && <p>¡Completaste las tres misiones del refugio!</p>}
    </>}
    {notice && <p className="quest-reward" role="status">Misión entregada: {notice.questName} · +{notice.reward.xp} XP · +{notice.reward.bits} Bits. Recompensa añadida a la mochila.</p>}
  </section>;
}
