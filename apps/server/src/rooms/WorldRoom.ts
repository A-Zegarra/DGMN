import type { Client, CloseCode } from "colyseus";
import { Room } from "colyseus";

import {
  DEFAULT_ZONE_ID,
  getAbilitiesForSpecies,
  getStarter,
  SPECIES,
  STARTER_IDS,
} from "@digiworld/content";
import {
  CHAT_MAX_LENGTH,
  INPUT_TIMEOUT_MS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  PATCH_INTERVAL_MS,
  RUN_SPEED,
  SERVER_TICK_MS,
  SPAWN_RADIUS_MAX,
  SPAWN_RADIUS_MIN,
  WALK_SPEED,
  WORLD_HALF,
} from "@digiworld/shared/constants";
import type {
  AbilityErrorPayload,
  AbilityMessage,
  AbilityUsedPayload,
  AutoAttackPayload,
  ChatMessage,
  DuelDeclinedPayload,
  DuelEndPayload,
  DuelErrorPayload,
  DuelRequestMessage,
  DuelRequestPayload,
  DuelRequestSentPayload,
  DuelResponseMessage,
  DuelStartPayload,
  InputMessage,
} from "@digiworld/shared/messages";
import { PlayerState, WorldState } from "@digiworld/shared/schema";

const DUEL_RANGE = 15;
const AUTO_ATTACK_RANGE = 6;
const AUTO_ATTACK_INTERVAL = 2000;
const GLOBAL_ABILITY_COOLDOWN = 700;
const DUEL_REQUEST_TTL = 15000;
const RESPAWN_DELAY = 3500;
const HP_REGEN_OUT_OF_COMBAT = 0.03;
const EP_REGEN_OUT_OF_COMBAT = 0.08;
const EP_REGEN_IN_COMBAT = 0.045;

interface PendingDuel {
  fromId: string;
  at: number;
}

interface Duel {
  a: string;
  b: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceBetween(a: PlayerState, b: PlayerState): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function sanitizeName(raw: unknown, sessionId: string): string {
  const base = typeof raw === "string" ? raw : "";
  const clean = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return clean || `Digi-${sessionId.slice(0, 4)}`;
}

function sanitizeChat(raw: unknown): string {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX_LENGTH);
}

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = MAX_PLAYERS;
  state = new WorldState();

  private readonly lastChatAt = new Map<string, number>();
  private readonly pendingDuel = new Map<string, PendingDuel>();
  private readonly duels = new Map<string, Duel>();
  private readonly playerDuel = new Map<string, string>();
  private readonly abilityReadyAt = new Map<string, Map<string, number>>();
  private readonly lastAbilityAt = new Map<string, number>();
  private readonly lastAutoAt = new Map<string, number>();

  onCreate() {
    this.state.zone = DEFAULT_ZONE_ID;
    this.setPatchRate(PATCH_INTERVAL_MS);
    this.setSimulationInterval((deltaMs) => this.update(deltaMs), SERVER_TICK_MS);
    console.log(`[world] sala creada: ${this.roomId}`);
  }

  messages = {
    input: (client: Client, message: InputMessage) => {
      this.handleInput(client, message);
    },
    chat: (client: Client, message: { text?: string }) => {
      this.handleChat(client, message);
    },
    duel_request: (client: Client, message: DuelRequestMessage) => {
      this.handleDuelRequest(client, message);
    },
    duel_response: (client: Client, message: DuelResponseMessage) => {
      this.handleDuelResponse(client, message);
    },
    use_ability: (client: Client, message: AbilityMessage) => {
      this.handleAbility(client, message);
    },
    duel_forfeit: (client: Client) => {
      this.handleDuelForfeit(client);
    },
  };

  onJoin(client: Client, options?: { name?: string; species?: string }) {
    const requested = options?.species ? getStarter(options.species) : undefined;
    const speciesId = requested?.id ?? STARTER_IDS[0];
    const species = SPECIES[speciesId] ?? SPECIES.agumon!;

    const player = new PlayerState();
    player.name = sanitizeName(options?.name, client.sessionId);
    player.species = speciesId;
    player.level = 1;
    player.maxHp = species.stats.hp;
    player.hp = player.maxHp;
    player.maxEp = species.stats.ep;
    player.ep = player.maxEp;

    const spawn = this.findSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    player.rot = Math.atan2(-spawn.x, -spawn.z);
    player.lastInputAt = Date.now();

    this.abilityReadyAt.set(client.sessionId, new Map());
    this.lastAbilityAt.set(client.sessionId, 0);
    this.lastAutoAt.set(client.sessionId, 0);

    this.state.players.set(client.sessionId, player);

    console.log(
      `[world] ${player.name} (${player.species}) entró a ${this.state.zone}`,
    );
    this.systemChat(`${player.name} entró al Bosque Digital.`);
  }

  onLeave(client: Client, _code: CloseCode) {
    const player = this.state.players.get(client.sessionId);

    const duelId = this.playerDuel.get(client.sessionId);
    if (duelId) {
      const duel = this.duels.get(duelId);
      if (duel) {
        const opponentId =
          duel.a === client.sessionId ? duel.b : duel.a;
        this.endDuel(opponentId, client.sessionId, "desconexión");
      }
    }

    for (const [targetId, pending] of Array.from(this.pendingDuel)) {
      if (pending.fromId === client.sessionId || targetId === client.sessionId) {
        this.pendingDuel.delete(targetId);
      }
    }

    this.abilityReadyAt.delete(client.sessionId);
    this.lastAbilityAt.delete(client.sessionId);
    this.lastAutoAt.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    if (player) {
      console.log(`[world] ${player.name} salió`);
      this.systemChat(`${player.name} salió del Bosque Digital.`);
    }
  }

  onDispose() {
    this.pendingDuel.clear();
    this.duels.clear();
    this.playerDuel.clear();
    this.abilityReadyAt.clear();
    this.lastAbilityAt.clear();
    this.lastAutoAt.clear();
    console.log(`[world] sala destruida: ${this.roomId}`);
  }

  private handleInput(client: Client, message: InputMessage) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    if (player.hp <= 0) {
      player.inputX = 0;
      player.inputZ = 0;
      return;
    }

    const rawX = Number(message?.x);
    const rawZ = Number(message?.z);
    if (!Number.isFinite(rawX) || !Number.isFinite(rawZ)) {
      return;
    }

    let x = clamp(rawX, -1, 1);
    let z = clamp(rawZ, -1, 1);
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    player.inputX = x;
    player.inputZ = z;
    player.inputRunning = Boolean(message?.run);
    player.lastInputAt = Date.now();

    const yaw = Number(message?.yaw);
    if (Number.isFinite(yaw)) {
      player.rot = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      player.lastYawAt = Date.now();
    }
  }

  private handleChat(client: Client, message: { text?: string }) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    const now = Date.now();
    const previous = this.lastChatAt.get(client.sessionId) ?? 0;
    if (now - previous < 800) {
      return;
    }

    const text = sanitizeChat(message?.text);
    if (!text) {
      return;
    }

    this.lastChatAt.set(client.sessionId, now);
    const payload: ChatMessage = {
      sessionId: client.sessionId,
      name: player.name,
      text,
      at: now,
    };
    this.broadcast("chat", payload);
  }

  private handleDuelRequest(client: Client, message: DuelRequestMessage) {
    const challenger = this.state.players.get(client.sessionId);
    const targetId =
      typeof message?.targetId === "string" ? message.targetId : "";
    const target = this.state.players.get(targetId);

    if (!challenger || !target || targetId === client.sessionId) {
      this.sendDuelError(client, "Objetivo no válido.");
      return;
    }

    if (challenger.hp <= 0) {
      this.sendDuelError(client, "Debes recuperarte antes de retar a alguien.");
      return;
    }

    if (target.hp <= 0) {
      this.sendDuelError(client, "Ese Digimon está fuera de combate.");
      return;
    }

    if (challenger.inCombat || challenger.duelOpponent) {
      this.sendDuelError(client, "Ya estás en un duelo.");
      return;
    }

    if (target.inCombat || target.duelOpponent) {
      this.sendDuelError(client, "Ese Digimon ya está en combate.");
      return;
    }

    if (this.pendingDuel.has(targetId)) {
      this.sendDuelError(client, "Ese jugador ya tiene una invitación pendiente.");
      return;
    }

    for (const pending of this.pendingDuel.values()) {
      if (pending.fromId === client.sessionId) {
        this.sendDuelError(client, "Ya enviaste una invitación. Espera la respuesta.");
        return;
      }
    }

    if (distanceBetween(challenger, target) > DUEL_RANGE) {
      this.sendDuelError(
        client,
        "Acércate a tu rival para retarlo (máximo 15 m).",
      );
      return;
    }

    const at = Date.now();
    this.pendingDuel.set(targetId, {
      fromId: client.sessionId,
      at,
    });

    const request: DuelRequestPayload = {
      fromId: client.sessionId,
      fromName: challenger.name,
      fromSpecies: challenger.species,
      fromLevel: challenger.level,
      at,
    };
    this.sendTo(targetId, "duel_request", request);
    this.sendTo(client.sessionId, "duel_request_sent", {
      targetId,
      targetName: target.name,
    } satisfies DuelRequestSentPayload);
  }

  private handleDuelResponse(client: Client, message: DuelResponseMessage) {
    const targetId = client.sessionId;
    const pending = this.pendingDuel.get(targetId);

    if (!pending || pending.fromId !== message?.fromId) {
      this.sendDuelError(client, "La invitación ya no está disponible.");
      return;
    }

    this.pendingDuel.delete(targetId);
    const from = this.state.players.get(pending.fromId);
    const target = this.state.players.get(targetId);

    if (!from || !target) {
      return;
    }

    if (!message.accept) {
      this.sendTo(
        pending.fromId,
        "duel_declined",
        { byName: target.name } satisfies DuelDeclinedPayload,
      );
      return;
    }

    if (
      from.inCombat ||
      target.inCombat ||
      from.duelOpponent ||
      target.duelOpponent ||
      from.hp <= 0 ||
      target.hp <= 0
    ) {
      this.sendDuelError(client, "Uno de los Digimon ya no puede combatir.");
      return;
    }

    if (distanceBetween(from, target) > DUEL_RANGE) {
      this.sendDuelError(client, "El rival se alejó demasiado.");
      this.sendTo(pending.fromId, "duel_error", {
        reason: "Tu rival se alejó demasiado.",
      } satisfies DuelErrorPayload);
      return;
    }

    this.startDuel(pending.fromId, targetId);
  }

  private handleDuelForfeit(client: Client) {
    const duelId = this.playerDuel.get(client.sessionId);
    if (!duelId) {
      this.sendDuelError(client, "No estás en un duelo.");
      return;
    }

    const duel = this.duels.get(duelId);
    if (!duel) {
      this.playerDuel.delete(client.sessionId);
      return;
    }

    const opponentId = duel.a === client.sessionId ? duel.b : duel.a;
    this.endDuel(opponentId, client.sessionId, "rendición");
  }

  private startDuel(aId: string, bId: string) {    const a = this.state.players.get(aId);
    const b = this.state.players.get(bId);
    if (!a || !b) {
      return;
    }

    const duelId = `${aId}:${bId}:${Date.now()}`;
    const now = Date.now();
    this.duels.set(duelId, { a: aId, b: bId });
    this.playerDuel.set(aId, duelId);
    this.playerDuel.set(bId, duelId);

    for (const [targetId, pending] of Array.from(this.pendingDuel)) {
      if (
        pending.fromId === aId ||
        pending.fromId === bId ||
        targetId === aId ||
        targetId === bId
      ) {
        this.pendingDuel.delete(targetId);
      }
    }

    for (const [id, player] of [
      [aId, a],
      [bId, b],
    ] as const) {
      player.inCombat = true;
      player.duelOpponent = id === aId ? bId : aId;
      player.hp = player.maxHp;
      player.ep = player.maxEp;
      player.respawnAt = 0;
      player.moving = false;
      player.running = false;
      this.abilityReadyAt.get(id)?.clear();
      this.lastAbilityAt.set(id, now);
      this.lastAutoAt.set(id, now);
    }

    this.sendTo(aId, "duel_start", {
      opponentId: bId,
      opponentName: b.name,
    } satisfies DuelStartPayload);
    this.sendTo(bId, "duel_start", {
      opponentId: aId,
      opponentName: a.name,
    } satisfies DuelStartPayload);

    this.systemChat(`⚔️ ${a.name} y ${b.name} comenzaron un duelo.`);
  }

  private handleAbility(client: Client, message: AbilityMessage) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    const abilityId =
      typeof message?.abilityId === "string" ? message.abilityId : "";
    const ability = getAbilitiesForSpecies(player.species).find(
      (entry) => entry.id === abilityId,
    );

    if (!ability) {
      this.sendAbilityError(client, abilityId, "Habilidad no válida.");
      return;
    }

    if (!player.inCombat || !player.duelOpponent) {
      this.sendAbilityError(
        client,
        ability.id,
        "Solo puedes usar habilidades en un duelo.",
      );
      return;
    }

    if (player.hp <= 0) {
      this.sendAbilityError(client, ability.id, "Estás fuera de combate.");
      return;
    }

    const opponent = this.state.players.get(player.duelOpponent);
    if (!opponent || opponent.hp <= 0) {
      this.sendAbilityError(client, ability.id, "El rival no está disponible.");
      return;
    }

    const opponentId = player.duelOpponent;
    const now = Date.now();
    const lastAbility = this.lastAbilityAt.get(client.sessionId) ?? 0;
    if (now - lastAbility < GLOBAL_ABILITY_COOLDOWN) {
      this.sendAbilityError(client, ability.id, "Espera un instante.");
      return;
    }

    const readyAt =
      this.abilityReadyAt.get(client.sessionId)?.get(ability.id) ?? 0;
    if (now < readyAt) {
      this.sendAbilityError(client, ability.id, "La habilidad está en recarga.");
      return;
    }

    if (player.ep < ability.cost) {
      this.sendAbilityError(client, ability.id, "Energía insuficiente.");
      return;
    }

    if (ability.kind === "heal" && player.hp >= player.maxHp) {
      this.sendAbilityError(client, ability.id, "Ya tienes la vida llena.");
      return;
    }

    const target = ability.range === 0 ? player : opponent;
    if (
      ability.range > 0 &&
      distanceBetween(player, opponent) > ability.range
    ) {
      this.sendAbilityError(client, ability.id, "Fuera de alcance.");
      return;
    }

    player.ep = Math.max(0, player.ep - ability.cost);
    this.lastAbilityAt.set(client.sessionId, now);
    this.abilityReadyAt
      .get(client.sessionId)
      ?.set(ability.id, now + ability.cooldownMs);

    let amount: number;
    if (ability.kind === "damage") {
      const attackerStats = SPECIES[player.species]?.stats;
      const defenderStats = SPECIES[opponent.species]?.stats;
      amount = Math.max(
        1,
        Math.round(
          ability.amount +
            (attackerStats?.atk ?? 20) * 0.25 -
            (defenderStats?.def ?? 15) * 0.18 +
            Math.random() * 4,
        ),
      );
      opponent.hp = Math.max(0, opponent.hp - amount);
      opponent.respawnAt = opponent.hp <= 0 ? now + RESPAWN_DELAY : 0;
    } else {
      const requested = Math.round(ability.amount + player.level * 2);
      const before = player.hp;
      player.hp = Math.min(player.maxHp, before + requested);
      amount = Math.round(player.hp - before);
    }

    const payload: AbilityUsedPayload = {
      casterId: client.sessionId,
      casterName: player.name,
      targetId: target === player ? client.sessionId : opponentId,
      targetName: target.name,
      abilityId: ability.id,
      abilityName: ability.name,
      amount,
      kind: ability.kind,
      cooldownMs: ability.cooldownMs,
      at: now,
    };
    this.broadcast("ability_used", payload);

    this.systemChat(
      target === player
        ? amount > 0
          ? `${player.name} usó ${ability.name} y recuperó ${amount} HP.`
          : `${player.name} usó ${ability.name}, pero ya tenía la vida llena.`
        : `${player.name} usó ${ability.name} sobre ${target.name}: ${amount} de daño.`,
    );

    if (ability.kind === "damage" && opponent.hp <= 0) {
      this.endDuel(client.sessionId, opponentId, "habilidad");
    }
  }

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;
    const now = Date.now();

    for (const [targetId, pending] of Array.from(this.pendingDuel)) {
      if (now - pending.at > DUEL_REQUEST_TTL) {
        this.pendingDuel.delete(targetId);
        this.sendTo(pending.fromId, "duel_error", {
          reason: "La invitación expiró.",
        } satisfies DuelErrorPayload);
      }
    }

    for (const player of this.state.players.values()) {
      if (player.hp <= 0) {
        player.moving = false;
        player.running = false;
        if (player.respawnAt > 0 && now >= player.respawnAt) {
          player.hp = player.maxHp;
          player.ep = player.maxEp;
          player.respawnAt = 0;
        }
        continue;
      }

      if (player.inCombat) {
        player.ep = Math.min(
          player.maxEp,
          player.ep + player.maxEp * EP_REGEN_IN_COMBAT * dt,
        );
      } else {
        player.hp = Math.min(
          player.maxHp,
          player.hp + player.maxHp * HP_REGEN_OUT_OF_COMBAT * dt,
        );
        player.ep = Math.min(
          player.maxEp,
          player.ep + player.maxEp * EP_REGEN_OUT_OF_COMBAT * dt,
        );
      }

      const stale = now - player.lastInputAt > INPUT_TIMEOUT_MS;
      const inputX = stale ? 0 : player.inputX;
      const inputZ = stale ? 0 : player.inputZ;
      const length = Math.hypot(inputX, inputZ);

      if (length > 0.02) {
        const speed = player.inputRunning ? RUN_SPEED : WALK_SPEED;
        player.x = clamp(
          player.x + (inputX / Math.max(1, length)) * speed * dt,
          -WORLD_HALF,
          WORLD_HALF,
        );
        player.z = clamp(
          player.z + (inputZ / Math.max(1, length)) * speed * dt,
          -WORLD_HALF,
          WORLD_HALF,
        );
        if (now - player.lastYawAt > 500) {
          player.rot = Math.atan2(inputX, inputZ);
        }
        player.moving = true;
        player.running = player.inputRunning;
      } else if (player.moving) {
        player.moving = false;
        player.running = false;
      }
    }

    for (const [duelId, duel] of Array.from(this.duels)) {
      if (!this.duels.has(duelId)) {
        continue;
      }

      const a = this.state.players.get(duel.a);
      const b = this.state.players.get(duel.b);
      if (!a || !b) {
        this.endDuel(duel.a, duel.b, "desconexión");
        continue;
      }
      if (!a.inCombat || !b.inCombat) {
        this.endDuel(duel.a, duel.b, "fin del combate");
        continue;
      }

      this.autoAttack(duel.a, duel.b, now);
      if (!this.duels.has(duelId)) {
        continue;
      }
      this.autoAttack(duel.b, duel.a, now);
    }
  }

  private autoAttack(attackerId: string, defenderId: string, now: number) {
    const attacker = this.state.players.get(attackerId);
    const defender = this.state.players.get(defenderId);
    if (!attacker || !defender || attacker.hp <= 0 || defender.hp <= 0) {
      return;
    }

    if (!attacker.inCombat || !defender.inCombat) {
      return;
    }

    const last = this.lastAutoAt.get(attackerId) ?? 0;
    if (now - last < AUTO_ATTACK_INTERVAL) {
      return;
    }

    if (distanceBetween(attacker, defender) > AUTO_ATTACK_RANGE) {
      return;
    }

    this.lastAutoAt.set(attackerId, now);
    const attack = SPECIES[attacker.species]?.stats.atk ?? 20;
    const defense = SPECIES[defender.species]?.stats.def ?? 15;
    const damage = Math.max(
      1,
      Math.round(attack * 0.18 - defense * 0.08 + 3 + Math.random() * 3),
    );
    defender.hp = Math.max(0, defender.hp - damage);

    const payload: AutoAttackPayload = {
      attackerId,
      attackerName: attacker.name,
      targetId: defenderId,
      targetName: defender.name,
      amount: damage,
      at: now,
    };
    this.sendTo(attackerId, "auto_attack", payload);
    this.sendTo(defenderId, "auto_attack", payload);

    if (defender.hp <= 0) {
      this.endDuel(attackerId, defenderId, "ataque básico");
    }
  }

  private endDuel(winnerId: string, loserId: string, reason: string) {
    const duelId =
      this.playerDuel.get(winnerId) ?? this.playerDuel.get(loserId);
    if (!duelId) {
      return;
    }

    const duel = this.duels.get(duelId);
    if (!duel) {
      this.playerDuel.delete(winnerId);
      this.playerDuel.delete(loserId);
      return;
    }

    this.duels.delete(duelId);
    this.playerDuel.delete(duel.a);
    this.playerDuel.delete(duel.b);

    const winner = this.state.players.get(winnerId);
    const loser = this.state.players.get(loserId);
    const now = Date.now();

    for (const id of [duel.a, duel.b]) {
      const player = this.state.players.get(id);
      if (!player) {
        continue;
      }
      player.inCombat = false;
      player.duelOpponent = "";
      player.moving = false;
      player.running = false;
      this.abilityReadyAt.get(id)?.clear();
      this.lastAbilityAt.set(id, 0);
      this.lastAutoAt.set(id, 0);
    }

    if (winner) {
      winner.duelWins += 1;
      winner.hp = winner.maxHp;
      winner.ep = winner.maxEp;
    }

    if (loser) {
      loser.duelLosses += 1;
      loser.hp = 0;
      loser.ep = 0;
      loser.respawnAt = now + RESPAWN_DELAY;
    }

    const payload: DuelEndPayload = {
      winnerId,
      loserId,
      winnerName: winner?.name ?? "Digimon",
      loserName: loser?.name ?? "Digimon",
    };
    this.broadcast("duel_end", payload);

    const detail = reason ? ` (${reason})` : "";
    this.systemChat(
      `🏆 ${payload.winnerName} ganó el duelo contra ${payload.loserName}${detail}.`,
    );
  }

  private findClient(sessionId: string): Client | undefined {
    return this.clients.find((client) => client.sessionId === sessionId);
  }

  private sendTo(sessionId: string, type: string, payload: unknown) {
    this.findClient(sessionId)?.send(type, payload);
  }

  private sendAbilityError(
    client: Client,
    abilityId: string,
    reason: string,
  ) {
    client.send("ability_error", {
      abilityId,
      reason,
    } satisfies AbilityErrorPayload);
  }

  private sendDuelError(client: Client, reason: string) {
    client.send("duel_error", { reason } satisfies DuelErrorPayload);
  }

  private systemChat(text: string) {
    this.broadcast("chat", {
      sessionId: "system",
      name: "Sistema",
      text,
      at: Date.now(),
      system: true,
    } satisfies ChatMessage);
  }

  /** Busca un punto de aparición alejado de los jugadores existentes. */
  private findSpawn(): { x: number; z: number } {
    let best = { x: 0, z: 0 };
    let bestNearest = -1;

    for (let attempt = 0; attempt < 64; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius =
        SPAWN_RADIUS_MIN +
        Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      let nearest = Number.POSITIVE_INFINITY;
      for (const other of this.state.players.values()) {
        nearest = Math.min(nearest, Math.hypot(other.x - x, other.z - z));
      }

      if (nearest > bestNearest) {
        bestNearest = nearest;
        best = { x, z };
      }
      if (nearest > 6.5) {
        break;
      }
    }

    return best;
  }
}
