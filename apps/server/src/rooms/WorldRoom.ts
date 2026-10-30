import type { Client, CloseCode } from "colyseus";
import { Room, ServerError } from "colyseus";
import { getProfileStore, ProfileAccessConflict, ProfileClaimError, type ProfileStore, type StoredProfile } from "../storage/profile-store";
import { getProfileAccess, ProfileAccessError, type ProfileAccess } from "../storage/profile-access";
import type { ProfileStatusPayload } from "@digiworld/shared/messages";
import type { InventoryPayload, UseItemMessage, ItemUsedPayload, LootReceivedPayload } from "@digiworld/shared/messages";
import type { QuestJournalData, QuestClaimMessage, QuestClaimedPayload } from "@digiworld/shared/messages";
import type { ShopBuyMessage, ShopPurchasePayload } from "@digiworld/shared/messages";
import type { ProfileAccessAction, ProfileAccessPayload } from "@digiworld/shared/messages";

import {
  DEFAULT_ZONE_ID,
  getAbilitiesForSpecies,
  getStarter,
  SPECIES,
  STARTER_IDS,
  companionVitals,
  EVOLUTION_DURATION_MS,
  PVE_SPAWNS, getPvEArea, DEVIMON_CAST_RANGE, ITEM_COOLDOWN_MS,
  INVENTORY_LIMIT, BITS_LIMIT, rollPvELoot, wildXp,
  PVE_QUESTS,
  getShopOffer, shopBalanceAfter, shopPurchaseError, SHOP_ACTION_INTERVAL_MS,
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
  LevelUpPayload,
  WildDeathPayload,
  WildTargetMessage,
  EvolveMessage,
  EvolutionPayload,
  EvolutionErrorPayload,
} from "@digiworld/shared/messages";
import { PlayerState, WildState, WorldState } from "@digiworld/shared/schema";

const DUEL_RANGE = 15;
const AUTO_ATTACK_RANGE = 6;
const AUTO_ATTACK_INTERVAL = 2000;
const GLOBAL_ABILITY_COOLDOWN = 700;
const DUEL_REQUEST_TTL = 15000;
const RESPAWN_DELAY = 3500;
const HP_REGEN_OUT_OF_COMBAT = 0.03;
const EP_REGEN_OUT_OF_COMBAT = 0.08;
const EP_REGEN_IN_COMBAT = 0.045;

const WILD_AGGRO_RANGE = 9;
const WILD_ATTACK_RANGE = 3.2;
const WILD_ATTACK_INTERVAL = 1800;
const WILD_CHASE_SPEED = 3.4;
const WILD_WANDER_SPEED = 1.5;
const WILD_LEASH_RANGE = 22;
const WILD_RESPAWN_MS = 12000;
const BOSS_RESPAWN_MS = 120000;

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

function distanceToWild(player: PlayerState, wild: WildState): number {
  return Math.hypot(player.partnerX - wild.x, player.partnerZ - wild.z);
}

function partnerDistance(a: PlayerState, b: PlayerState): number {
  return Math.hypot(a.partnerX - b.partnerX, a.partnerZ - b.partnerZ);
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
  private readonly wildTargets = new Map<string, string>();
  private readonly wildEngaged = new Map<string, Set<string>>();
  private profileStore?: ProfileStore;
  private readonly profileKeys = new Map<string, string>();
  private nextProfileSaveAt = Date.now() + 10000;
  private contributors = new Map<string, Map<string, {damage:number; at:number}>>();
  private readonly questJournals = new Map<string, QuestJournalData>();
  private readonly lastShopAt = new Map<string, number>();
  private profileAccess?: ProfileAccess;

  onCreate() {
    this.state.zone = DEFAULT_ZONE_ID;
    this.spawnWilds();
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
    wild_target: (client: Client, message: WildTargetMessage) => {
      this.handleWildTarget(client, message);
    },
    evolve: (client: Client, message: EvolveMessage) => {
      this.handleEvolution(client, message);
    },
    inventory_request: (client: Client) => { this.sendInventory(client.sessionId); },
    quests_request: (client: Client) => { this.sendQuests(client.sessionId); },
    quest_claim: (client: Client, message: QuestClaimMessage) => { this.handleQuestClaim(client, message); },
    shop_buy: (client: Client, message: ShopBuyMessage) => { this.handleShopBuy(client, message); },
    profile_access: (client: Client, message: {action: ProfileAccessAction}) => { void this.handleProfileAccess(client,message); },
    use_item: (client: Client, message: UseItemMessage) => { this.handleItem(client, message); },
    partner_recall: (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.duelOpponent) return;
      p.partnerPassive = true;
      this.wildTargets.delete(client.sessionId);
    },
    save_profile: (client: Client, message?: {requestId?: string}) => {
      const requestId = typeof message?.requestId === "string" ? message.requestId.slice(0, 80) : undefined;
      void this.saveProfile(client.sessionId, undefined, requestId);
    },
  };

  onJoin(client: Client, options?: { name?: string; species?: string; profileToken?: string }) {
    let saved: StoredProfile | undefined;
    if (options?.profileToken !== undefined) {
      try {
        this.profileStore ??= getProfileStore();
        const key = this.profileStore.acquire(options.profileToken, this.profileOwner(client.sessionId));
        this.profileKeys.set(client.sessionId, key);
        saved = this.profileStore.get(key);
      } catch (error) {
        const message = error instanceof ProfileClaimError ? error.message : "No se pudo abrir la partida en el servidor. Vuelve a intentarlo o contacta al administrador.";
        throw new ServerError(4001, message);
      }
    }
    const requested = options?.species ? getStarter(options.species) : undefined;
    const speciesId = requested?.id ?? STARTER_IDS[0];
    const species = SPECIES[speciesId] ?? SPECIES.agumon!;

    const player = new PlayerState();
    player.name = sanitizeName(options?.name, client.sessionId);
    player.species = speciesId;
    player.level = 1;
    player.maxHp = companionVitals(speciesId, player.level).maxHp;
    player.hp = player.maxHp;
    player.maxEp = companionVitals(speciesId, player.level).maxEp;
    player.ep = player.maxEp;
    player.xp = 0;
    player.xpNext = 100;

    const spawn = this.findSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    player.rot = Math.atan2(-spawn.x, -spawn.z);
    player.partnerX = spawn.x + 2.5;
    player.partnerZ = spawn.z;
    player.partnerRot = player.rot;
    if (saved) {
      const {updatedAt: _updatedAt, cooldowns: _cooldowns, lastAbilityAt: _lastAbilityAt, transformUntil: _transformUntil, inventory: _inventory, quests: _quests, ...progress} = saved;
      Object.assign(player, progress);
      const vitals = companionVitals(player.species, player.level);
      player.maxHp = vitals.maxHp;
      player.maxEp = vitals.maxEp;
      if (player.hp <= 0) { player.hp = player.maxHp; player.ep = player.maxEp; }
      player.x = clamp(player.x, -WORLD_HALF, WORLD_HALF);
      player.z = clamp(player.z, -WORLD_HALF, WORLD_HALF);
      if (Math.hypot(player.partnerX - player.x, player.partnerZ - player.z) > 20) {
        player.partnerX = player.x + 2;
        player.partnerZ = player.z;
      }
      player.partnerX = clamp(player.partnerX, -WORLD_HALF, WORLD_HALF);
      player.partnerZ = clamp(player.partnerZ, -WORLD_HALF, WORLD_HALF);
      player.evolutionReadyAt = saved.transformUntil ?? 0;
      player.hpPotion = saved.inventory?.hpPotion ?? 3;
      player.epPotion = saved.inventory?.epPotion ?? 2;
      player.bits = saved.inventory?.bits ?? 0;
      player.devimonSeals = saved.inventory?.devimonSeals ?? 0;
    }
    player.lastInputAt = Date.now();

    this.abilityReadyAt.set(client.sessionId, new Map(Object.entries(saved?.cooldowns ?? {})));
    this.lastAbilityAt.set(client.sessionId, saved?.lastAbilityAt ?? 0);
    this.lastAutoAt.set(client.sessionId, 0);

    this.state.players.set(client.sessionId, player);
    this.questJournals.set(client.sessionId, structuredClone(saved?.quests ?? {completed: [], kills: 0}));
    this.sendInventory(client.sessionId);
    this.sendQuests(client.sessionId);
    if (this.profileKeys.has(client.sessionId)) void this.saveProfile(client.sessionId);
    else client.send("profile_status", {persistent: false, savedAt: 0} satisfies ProfileStatusPayload);

    console.log(
      `[world] ${player.name} (${player.species}) entró a ${this.state.zone}`,
    );
    this.systemChat(`${player.name} entró al Bosque Digital.`);
  }

  async onLeave(client: Client, _code: CloseCode) {
    const player = this.state.players.get(client.sessionId);

    this.wildTargets.delete(client.sessionId);
    for (const damage of this.contributors.values()) damage.delete(client.sessionId);
    this.disengageAllWilds(client.sessionId);
    for (const [wildId, wild] of this.state.wilds) {
      if (wild.targetId === client.sessionId) {
        this.resetWild(wildId, wild, Date.now());
      }
    }

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

    this.lastAutoAt.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
    this.state.players.delete(client.sessionId);

    if (player) {
      console.log(`[world] ${player.name} salió`);
      this.systemChat(`${player.name} salió del Bosque Digital.`);
    }
    try { if (player) await this.saveProfile(client.sessionId, player); }
    finally {
      this.abilityReadyAt.delete(client.sessionId);
      this.lastAbilityAt.delete(client.sessionId);
      const key = this.profileKeys.get(client.sessionId);
      if (key) this.profileStore?.release(key, this.profileOwner(client.sessionId));
      this.profileKeys.delete(client.sessionId);
      this.questJournals.delete(client.sessionId);
      this.lastShopAt.delete(client.sessionId);
    }
  }

  async onDispose() {
    for (const id of this.profileKeys.keys()) {
      await this.saveProfile(id);
      const key = this.profileKeys.get(id)!;
      this.profileStore?.release(key, this.profileOwner(id));
    }
    this.profileKeys.clear();
    await this.profileStore?.flush();
    this.pendingDuel.clear();
    this.duels.clear();
    this.playerDuel.clear();
    this.abilityReadyAt.clear();
    this.lastAbilityAt.clear();
    this.lastAutoAt.clear();
    this.wildTargets.clear();
    this.wildEngaged.clear();
    this.contributors.clear();
    this.questJournals.clear();
    this.lastShopAt.clear();
    console.log(`[world] sala destruida: ${this.roomId}`);
  }

  private profileOwner(id: string) { return `${this.roomId}:${id}`; }

  private async handleProfileAccess(client: Client, message: {action: ProfileAccessAction}) {
    const key=this.profileKeys.get(client.sessionId);
    if(!key||!this.state.players.has(client.sessionId)){client.send("profile_access_error",{reason:"Esta sesión no tiene una partida persistente."});return;}
    const action=message?.action;
    if(!["link","cancel_link","recovery","revoke_others"].includes(action)){client.send("profile_access_error",{reason:"Acción de acceso inválida."});return;}
    try{
      const access=this.profileAccess??=getProfileAccess();
      if(action==="cancel_link"){
        access.store.ownedRevision(key,this.profileOwner(client.sessionId));
        access.cancelLink(key);client.send("profile_access",{action} satisfies ProfileAccessPayload);return;
      }
      access.allowAction(key);
      if(!await this.saveProfile(client.sessionId))throw new ProfileAccessError("No se pudo confirmar el guardado. Vuelve a intentarlo antes de generar un acceso.");
      const owner=this.profileOwner(client.sessionId);
      if(action==="link")client.send("profile_access",{action,...access.issueLink(key,owner)} satisfies ProfileAccessPayload);
      else if(action==="recovery")client.send("profile_access",{action,code:await access.issueRecovery(key,owner)} satisfies ProfileAccessPayload);
      else client.send("profile_access",{action,revokedCount:await access.revokeOthers(key,owner)} satisfies ProfileAccessPayload);
    }catch(error){
      client.send("profile_access_error",{reason:error instanceof ProfileAccessError||error instanceof ProfileAccessConflict?error.message:"No se pudo confirmar la operación de acceso. Vuelve a intentarlo."});
    }
  }

  private async saveProfile(id: string, player = this.state.players.get(id), requestId?: string): Promise<boolean> {
    const key = this.profileKeys.get(id);
    if (!key || !this.profileStore || !player) return false;
    const profile: StoredProfile = {
      name: player.name, species: player.species, level: player.level, xp: player.xp, xpNext: player.xpNext,
      hp: player.hp, ep: player.ep, x: player.x, z: player.z, rot: player.rot,
      partnerX: player.partnerX, partnerZ: player.partnerZ, partnerRot: player.partnerRot,
      duelWins: player.duelWins, duelLosses: player.duelLosses, updatedAt: Date.now(),
      cooldowns: Object.fromEntries(this.abilityReadyAt.get(id) ?? []),
      lastAbilityAt: this.lastAbilityAt.get(id) ?? 0, transformUntil: player.evolutionReadyAt,
      inventory: {hpPotion:player.hpPotion,epPotion:player.epPotion,bits:player.bits,devimonSeals:player.devimonSeals},
      itemReadyAt: player.itemReadyAt,
      quests: structuredClone(this.questJournals.get(id) ?? {completed: [], kills: 0}),
    };
    try {
      await this.profileStore.save(key, this.profileOwner(id), profile);
      this.sendTo(id, "profile_status", {persistent: true, savedAt: profile.updatedAt, requestId,
        cooldowns: Object.fromEntries(Object.entries(profile.cooldowns ?? {}).map(([ability, until]) => [ability, Math.max(0, until - Date.now())])),
        profile: {name: profile.name, species: profile.species, level: profile.level, xp: profile.xp,
          xpNext: profile.xpNext, duelWins: profile.duelWins, duelLosses: profile.duelLosses, updatedAt: profile.updatedAt},
      } satisfies ProfileStatusPayload);
      return true;
    } catch (error) {
      console.error("[save] No se pudo guardar la partida:", error instanceof Error ? error.message : "error de disco");
      this.sendTo(id, "profile_status", {persistent: true, savedAt: 0, requestId, error: "No se pudo guardar en el servidor. No cierres la partida; vuelve a intentarlo."} satisfies ProfileStatusPayload);
      return false;
    }
  }

  private handleInput(client: Client, message: InputMessage) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
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
    if (Date.now() < challenger.evolutionReadyAt || Date.now() < target.evolutionReadyAt) {
      this.sendDuelError(client, "Espera a que termine la digievolución.");
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

  private sendInventory(id:string) {
    const p=this.state.players.get(id);
    if (!p) return;
    this.sendTo(id,"inventory",{hpPotion:p.hpPotion,epPotion:p.epPotion,bits:p.bits,
      devimonSeals:p.devimonSeals,cooldownMs:Math.max(0,p.itemReadyAt-Date.now())} satisfies InventoryPayload);
  }

  private sendQuests(id: string) {
    const journal = this.questJournals.get(id);
    if (journal) this.sendTo(id, "quests", structuredClone(journal));
  }

  private progressQuest(id: string, wild: WildState) {
    const journal = this.questJournals.get(id);
    if (!journal) return;
    const quest = PVE_QUESTS[journal.completed.length];
    // Usar la zona de origen, no el lugar al que se haya arrastrado al enemigo.
    if (!quest || wild.areaId !== quest.areaId || wild.isBoss !== quest.boss ||
        (quest.boss && wild.species !== "devimon") || journal.kills >= quest.count) return;
    journal.kills++;
    this.sendQuests(id);
  }

  private handleQuestClaim(client: Client, message: QuestClaimMessage) {
    const id = client.sessionId;
    const p = this.state.players.get(id);
    const journal = this.questJournals.get(id);
    if (!p || !journal) return;
    const quest = PVE_QUESTS[journal.completed.length];
    const reject = (reason: string) => client.send("quest_error", {reason});
    if (!quest || typeof message?.questId !== "string" || message.questId !== quest.id) {
      reject("Esta misión no está activa o ya fue entregada."); return;
    }
    if (journal.kills < quest.count) { reject("Todavía no has completado el objetivo."); return; }
    if (!getPvEArea(p.x, p.z).safe || !getPvEArea(p.partnerX, p.partnerZ).safe) {
      reject("Vuelve con tu Digimon al Refugio del Inicio para entregar la misión."); return;
    }
    if (p.hp <= 0 || p.inCombat || p.duelOpponent || Date.now() < p.evolutionReadyAt) {
      reject("Entrega la misión fuera de combate, con tu Digimon recuperado y sin evolucionar."); return;
    }
    const reward = quest.reward;
    if (p.bits + reward.bits > BITS_LIMIT || p.hpPotion + reward.hpPotion > INVENTORY_LIMIT ||
        p.epPotion + reward.epPotion > INVENTORY_LIMIT || p.devimonSeals + reward.devimonSeals > INVENTORY_LIMIT) {
      reject("No hay espacio para toda la recompensa. Libera espacio en la mochila y vuelve a intentarlo."); return;
    }
    // Modificar recompensa y entrega sin await: dos peticiones no pueden duplicarla.
    journal.completed.push(quest.id);
    journal.kills = 0;
    p.bits += reward.bits; p.hpPotion += reward.hpPotion;
    p.epPotion += reward.epPotion; p.devimonSeals += reward.devimonSeals;
    this.grantXp(id, reward.xp); // Guarda en una misma instantánea premio y entrega.
    this.sendInventory(id);
    this.sendQuests(id);
    this.sendTo(id, "quest_claimed", {questId: quest.id, questName: quest.name, reward} satisfies QuestClaimedPayload);
  }

  private handleItem(client:Client,message:UseItemMessage) {
    const p=this.state.players.get(client.sessionId);
    if (!p) return;
    const reject=(reason:string)=>client.send("item_error",{reason});
    const id=message?.itemId;
    if (id!=="hp_potion" && id!=="ep_potion") {reject("Objeto no utilizable.");return;}
    if (p.hp<=0 || Date.now()<p.evolutionReadyAt) {reject("Tu Digimon debe estar recuperado y no estar evolucionando.");return;}
    if (p.duelOpponent) {reject("No se permiten objetos en los duelos.");return;}
    if (Date.now()<p.itemReadyAt) {reject("Los discos están en recarga.");return;}
    const hp=id==="hp_potion";
    const count=hp?p.hpPotion:p.epPotion;
    if (count<=0) {reject("No tienes ese objeto.");return;}
    const before=hp?p.hp:p.ep, max=hp?p.maxHp:p.maxEp;
    if (before>=max) {reject(hp?"Tu Digimon ya tiene la vida llena.":"Tu Digimon ya tiene la energía llena.");return;}
    const after=Math.min(max,before+Math.round(max*0.35+(hp?20:10)));
    if (hp) {p.hp=after;p.hpPotion--;} else {p.ep=after;p.epPotion--;}
    p.itemReadyAt=Date.now()+ITEM_COOLDOWN_MS;
    this.sendInventory(client.sessionId);
    this.broadcast("item_used",{playerId:client.sessionId,itemId:id,amount:after-before,kind:hp?"hp":"ep"} satisfies ItemUsedPayload);
    void this.saveProfile(client.sessionId);
  }

  private handleShopBuy(client: Client, message: ShopBuyMessage) {
    const id = client.sessionId;
    const p = this.state.players.get(id);
    if (!p) return;
    const reject = (reason: string) => client.send("shop_error", {reason});
    const offer = getShopOffer(message?.offerId);
    if (!offer) { reject("Oferta no disponible."); return; }
    if (!getPvEArea(p.x, p.z).safe || !getPvEArea(p.partnerX, p.partnerZ).safe) {
      reject("La tienda solo atiende en el Refugio del Inicio. Vuelve con tu Digimon."); return;
    }
    const now = Date.now();
    if (p.hp <= 0 || p.inCombat || p.duelOpponent || now < p.evolutionReadyAt) {
      reject("Compra fuera de combate, con tu Digimon recuperado y sin evolucionar."); return;
    }
    if (now - (this.lastShopAt.get(id) ?? 0) < SHOP_ACTION_INTERVAL_MS) {
      reject("Espera un instante antes de otra compra."); return;
    }
    const error = shopPurchaseError(p, offer);
    if (error) { reject(error); return; }
    // Precio y cantidades del catálogo del servidor. Cobro y entrega sin await:
    // no se pueden gastar dos veces los mismos Bits o el mismo sello.
    Object.assign(p, shopBalanceAfter(p, offer));
    this.lastShopAt.set(id, now);
    this.sendInventory(id);
    this.sendTo(id, "shop_purchase", {offerId: offer.id, offerName: offer.name, cooldownMs: SHOP_ACTION_INTERVAL_MS} satisfies ShopPurchasePayload);
    void this.saveProfile(id);
  }

  private recordDamage(wildId:string,id:string,amount:number) {
    let damage=this.contributors.get(wildId);
    if (!damage) {damage=new Map();this.contributors.set(wildId,damage);}
    const old=damage.get(id);
    damage.set(id,{damage:(old?.damage??0)+amount,at:Date.now()});
  }

  private awardLoot(id:string,wild:WildState) {
    const p=this.state.players.get(id);
    if (!p) return;
    const roll=rollPvELoot(wild.level,wild.isBoss);
    const gain={hpPotion:Math.min(roll.hpPotion,INVENTORY_LIMIT-p.hpPotion),
      epPotion:Math.min(roll.epPotion,INVENTORY_LIMIT-p.epPotion),
      devimonSeals:Math.min(roll.devimonSeals,INVENTORY_LIMIT-p.devimonSeals),
      bits:Math.min(roll.bits,BITS_LIMIT-p.bits)};
    p.hpPotion+=gain.hpPotion;p.epPotion+=gain.epPotion;p.bits+=gain.bits;p.devimonSeals+=gain.devimonSeals;
    this.sendInventory(id);
    this.sendTo(id,"loot_received",{...gain,wildName:wild.name} satisfies LootReceivedPayload);
  }

  private spawnWilds() {
    const now = Date.now();
    for (const spawn of PVE_SPAWNS) {
      const {species:speciesId,level,x:homeX,z:homeZ}=spawn;
      const species = SPECIES[speciesId] ?? SPECIES.agumon!;
      const wild = new WildState();
      wild.isBoss=Boolean(spawn.boss);
      wild.areaId=getPvEArea(homeX,homeZ).id;
      wild.name = spawn.boss?"Devimon · Señor de las Ruinas":`${species.name} salvaje`;
      wild.species = speciesId;
      wild.level = level;
      wild.maxHp = spawn.boss?2400:Math.max(30,Math.round(species.stats.hp*(0.6+level*0.06)+(level-1)*12));
      wild.hp = wild.maxHp;
      wild.x = homeX;
      wild.z = homeZ;
      wild.rot = Math.random() * Math.PI * 2;
      wild.homeX = homeX;
      wild.homeZ = homeZ;
      wild.wanderX = homeX;
      wild.wanderZ = homeZ;
      wild.nextWanderAt = now + 1000 + Math.random() * 3000;
      wild.state = "idle";
      wild.nextSpecialAt=now+5000;
      this.state.wilds.set(spawn.id, wild);
    }

    console.log(`[world] ${this.state.wilds.size} Digimon salvajes preparados`);
  }

  private handleEvolution(client: Client, message: EvolveMessage) {
    const player = this.state.players.get(client.sessionId);
    const reject = (reason: string) => client.send("evolution_error", {reason} satisfies EvolutionErrorPayload);
    if (!player) return;
    const now = Date.now();
    if (player.hp <= 0 || player.respawnAt > 0) { reject("Tu Digimon debe estar recuperado para evolucionar."); return; }
    if (player.inCombat || player.duelOpponent) { reject("No puedes evolucionar durante el combate."); return; }
    if (now < player.evolutionReadyAt) { reject("La digievolución aún está en curso."); return; }
    for (const [targetId, invitation] of this.pendingDuel) {
      if (targetId === client.sessionId || invitation.fromId === client.sessionId) {
        reject("Resuelve la invitación a duelo antes de evolucionar."); return;
      }
    }
    const requirement = SPECIES[player.species]?.evolvesTo.find(entry => entry.id === message?.targetSpecies);
    if (!requirement || !SPECIES[requirement.id]) { reject("Esa evolución no pertenece a tu línea actual."); return; }
    if (player.level < requirement.level) { reject(`Necesitas nivel ${requirement.level} para evolucionar a ${SPECIES[requirement.id]!.name}.`); return; }
    const fromSpecies = player.species;
    const hpRatio = player.hp / player.maxHp;
    const epRatio = player.ep / player.maxEp;
    const vitals = companionVitals(requirement.id, player.level);
    player.species = requirement.id;
    player.maxHp = vitals.maxHp;
    player.maxEp = vitals.maxEp;
    player.hp = Math.max(1, Math.round(player.maxHp * hpRatio));
    player.ep = Math.round(player.maxEp * epRatio);
    player.evolutionReadyAt = now + EVOLUTION_DURATION_MS;
    player.partnerMoving = false;
    this.wildTargets.delete(client.sessionId);
    this.abilityReadyAt.set(client.sessionId, new Map());
    this.lastAbilityAt.set(client.sessionId, now);
    this.lastAutoAt.set(client.sessionId, now);
    this.broadcast("evolution", {playerId: client.sessionId, fromSpecies, toSpecies: player.species,
      durationMs: EVOLUTION_DURATION_MS, at: now} satisfies EvolutionPayload);
    void this.saveProfile(client.sessionId);
    this.systemChat(`✨ El ${SPECIES[fromSpecies]?.name} de ${player.name} digievolucionó a ${SPECIES[player.species]?.name}.`);
  }

  private handleWildTarget(client: Client, message: WildTargetMessage) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.hp <= 0) {
      this.wildTargets.delete(client.sessionId);
      return;
    }
    if (Date.now() < player.evolutionReadyAt) return;

    const wildId = typeof message?.wildId === "string" ? message.wildId : "";
    if (!wildId) {
      this.wildTargets.delete(client.sessionId);
      return;
    }

    if (player.duelOpponent) {
      this.wildTargets.delete(client.sessionId);
      return;
    }

    const wild = this.state.wilds.get(wildId);
    if (!wild || wild.hp <= 0 || wild.state === "return") {
      this.wildTargets.delete(client.sessionId);
      return;
    }

    this.wildTargets.set(client.sessionId, wildId);
    player.partnerPassive=false;
  }

  private engageWild(playerId: string, wildId: string) {
    const player = this.state.players.get(playerId);
    if (!player) {
      return;
    }

    let engaged = this.wildEngaged.get(playerId);
    if (!engaged) {
      engaged = new Set<string>();
      this.wildEngaged.set(playerId, engaged);
    }
    engaged.add(wildId);
    if (!player.duelOpponent) {
      player.inCombat = true;
    }
  }

  private disengageWild(playerId: string, wildId: string) {
    const engaged = this.wildEngaged.get(playerId);
    if (!engaged) {
      return;
    }
    engaged.delete(wildId);
    if (engaged.size > 0) {
      return;
    }

    this.wildEngaged.delete(playerId);
    const player = this.state.players.get(playerId);
    if (player && !player.duelOpponent) {
      player.inCombat = false;
    }
  }

  private disengageAllWilds(playerId: string) {
    const engaged = this.wildEngaged.get(playerId);
    if (!engaged) {
      return;
    }
    this.wildEngaged.delete(playerId);
    const player = this.state.players.get(playerId);
    if (player && !player.duelOpponent) {
      player.inCombat = false;
    }
  }

  private disengageWildFromAll(wildId: string) {
    for (const [playerId, engaged] of Array.from(this.wildEngaged)) {
      if (!engaged.delete(wildId)) {
        continue;
      }
      if (engaged.size === 0) {
        this.wildEngaged.delete(playerId);
        const player = this.state.players.get(playerId);
        if (player && !player.duelOpponent) {
          player.inCombat = false;
        }
      }
    }
  }

  private resetWild(wildId: string, wild: WildState, now: number) {
    wild.targetId = "";
    wild.state = "return";
    wild.moving = false;
    wild.hp=wild.maxHp;
    wild.castEndsAt=0;
    this.contributors.delete(wildId);
    wild.aggroCooldownUntil = now + 3000;
    for (const [id, targetId] of this.wildTargets) {
      if (targetId === wildId) this.wildTargets.delete(id);
    }
    this.disengageWildFromAll(wildId);
  }

  private respawnWild(wild: WildState, now: number) {
    wild.x = wild.homeX;
    wild.z = wild.homeZ;
    wild.hp = wild.maxHp;
    wild.state = "idle";
    wild.moving = false;
    wild.targetId = "";
    wild.respawnAt = 0;
    wild.nextWanderAt = now + 1000 + Math.random() * 3000;
    wild.aggroCooldownUntil = now + 1500;
    wild.castEndsAt=0;
    wild.nextSpecialAt=now+5000;
  }

  private grantXp(playerId: string, amount: number) {
    if (amount <= 0) {
      return;
    }

    const player = this.state.players.get(playerId);
    if (!player) {
      return;
    }

    player.xp += amount;
    let leveledUp = false;
    while (player.level < 20 && player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level += 1;
      player.xpNext = Math.round(player.xpNext * 1.22);
      const vitals = companionVitals(player.species, player.level);
      player.maxHp = vitals.maxHp;
      player.maxEp = vitals.maxEp;
      player.hp = player.maxHp;
      player.ep = player.maxEp;
      leveledUp = true;
    }

    if (leveledUp) {
      this.sendTo(playerId, "level_up", {
        level: player.level,
        xp: player.xp,
        xpNext: player.xpNext,
        maxHp: player.maxHp,
        maxEp: player.maxEp,
        at: Date.now(),
      } satisfies LevelUpPayload);
      this.systemChat(`✨ ${player.name} subió al nivel ${player.level}.`);
    }
    void this.saveProfile(playerId);
  }

  private killWild(
    wildId: string,
    wild: WildState,
    killerId: string,
    now: number,
  ) {
    if (wild.respawnAt>0 && wild.hp<=0) return;
    wild.hp = 0;
    wild.state = "dead";
    wild.moving = false;
    wild.targetId = "";
    wild.respawnAt = now + (wild.isBoss?BOSS_RESPAWN_MS:WILD_RESPAWN_MS);
    wild.castEndsAt=0;

    for (const [playerId, targetWildId] of Array.from(this.wildTargets)) {
      if (targetWildId === wildId) {
        this.wildTargets.delete(playerId);
      }
    }
    this.disengageWildFromAll(wildId);

    const killer = this.state.players.get(killerId);
    const xp = wildXp(wild.level,wild.isBoss);
    const eligible=new Set<string>();
    if (wild.isBoss) {
      for (const [id, contribution] of this.contributors.get(wildId)??[]) {
        const p=this.state.players.get(id);
        if (p && p.hp>0 && contribution.damage>=wild.maxHp*0.05 && now-contribution.at<30000 &&
          Math.hypot(p.partnerX-wild.x,p.partnerZ-wild.z)<30) eligible.add(id);
      }
    }
    if (killer) eligible.add(killerId);
    for (const id of eligible) {
      this.awardLoot(id,wild);
      this.progressQuest(id,wild);
      this.grantXp(id,xp);
    }
    this.contributors.delete(wildId);

    this.broadcast("wild_death", {
      wildId,
      wildName: wild.name,
      species: wild.species,
      killerId,
      killerName: killer?.name ?? "Digimon",
      xp,
      at: now,
    } satisfies WildDeathPayload);

    this.systemChat(
      `⚔️ ${killer?.name ?? "Un domador"} derrotó a ${wild.name} (+${xp} XP).`,
    );
  }

  private handlePlayerDefeatedByWild(
    player: PlayerState,
    wild: WildState,
    now: number,
  ) {
    const playerId = this.findPlayerId(player);
    if (playerId) {
      this.wildTargets.delete(playerId);
      this.disengageAllWilds(playerId);
    }

    this.resetWild(this.findWildId(wild), wild, now);

    player.hp = 0;
    player.ep = 0;
    player.respawnAt = now + RESPAWN_DELAY;
    player.moving = false;
    player.running = false;
    player.inputX = 0;
    player.inputZ = 0;

    this.systemChat(`💥 ${wild.name} debilitó al ${SPECIES[player.species]?.name ?? player.species} de ${player.name}.`);
  }

  private findPlayerId(player: PlayerState): string | undefined {
    for (const [id, candidate] of this.state.players) {
      if (candidate === player) {
        return id;
      }
    }
    return undefined;
  }

  /** El servidor mueve al compañero; ningún cliente decide su posición de combate. */
  private updatePartners(dt: number, now: number) {
    for (const [id, player] of this.state.players) {
      player.partnerMoving = false;
      if (player.hp <= 0 || now < player.evolutionReadyAt) continue;
      let target: { x: number; z: number } | undefined;
      const rival = player.duelOpponent ? this.state.players.get(player.duelOpponent) : undefined;
      if (rival && rival.hp > 0) target = { x: rival.partnerX, z: rival.partnerZ };
      const wildId = this.wildTargets.get(id);
      const wild = wildId ? this.state.wilds.get(wildId) : undefined;
      if (!rival && !player.partnerPassive && wild && wild.hp > 0 && wild.state !== "return") target = wild;
      if (!target && !player.partnerPassive && player.inCombat) {
        for (const enemy of this.state.wilds.values()) {
          if (enemy.targetId === id && enemy.hp > 0) { target = enemy; break; }
        }
      }
      // Correa: el domador puede observar desde distancia, pero no enviar al compañero por todo el mapa.
      if (target && Math.hypot(target.x - player.x, target.z - player.z) > 20) target = undefined;
      const angle = player.rot + 0.9;
      const goalX = target?.x ?? player.x + Math.sin(angle) * (2.6 + Math.sin(now / 2200) * 0.35);
      const goalZ = target?.z ?? player.z + Math.cos(angle) * (2.6 + Math.sin(now / 2200) * 0.35);
      const dx = goalX - player.partnerX;
      const dz = goalZ - player.partnerZ;
      const distance = Math.hypot(dx, dz);
      const stop = target ? 2 : 0.3;
      if (distance > stop) {
        const step = Math.min(distance - stop, (target ? 5.8 : 6) * dt);
        player.partnerX = clamp(player.partnerX + dx / distance * step, -WORLD_HALF, WORLD_HALF);
        player.partnerZ = clamp(player.partnerZ + dz / distance * step, -WORLD_HALF, WORLD_HALF);
        player.partnerMoving = true;
      }
      if (distance > 0.1) player.partnerRot = Math.atan2(dx, dz);
    }
  }

  private updateWilds(now: number, dt: number) {
    for (const [wildId, wild] of this.state.wilds) {
      if (wild.hp <= 0) {
        if (wild.respawnAt > 0 && now >= wild.respawnAt) {
          this.respawnWild(wild, now);
        }
        continue;
      }
      if (wild.state==="return") {
        if (Math.hypot(wild.x-wild.homeX,wild.z-wild.homeZ)<0.3) {
          wild.state="idle";wild.moving=false;wild.aggroCooldownUntil=now+1500;
        } else {this.moveWildToward(wild,wild.homeX,wild.homeZ,5,dt);wild.moving=true;}
        continue;
      }

      if (wild.targetId) {
        const target = this.state.players.get(wild.targetId);
        if (!target || target.hp <= 0 || target.duelOpponent || now < target.evolutionReadyAt || getPvEArea(target.partnerX,target.partnerZ).safe) {
          this.resetWild(wildId, wild, now);
          continue;
        }

        const homeDistance = Math.hypot(
          target.x - wild.homeX,
          target.z - wild.homeZ,
        );
        if (homeDistance > WILD_LEASH_RANGE) {
          this.resetWild(wildId, wild, now);
          continue;
        }

        const distance = distanceToWild(target, wild);
        if (wild.isBoss) {
          if (wild.state==="casting") {
            wild.moving=false;
            if (now>=wild.castEndsAt) {
              wild.castEndsAt=0;wild.state="chase";
              wild.nextSpecialAt=now+(wild.hp/wild.maxHp<0.3?5000:8000);
              if (distance<=DEVIMON_CAST_RANGE) {
                const damage=Math.max(1,Math.round(45+wild.level*2-(SPECIES[target.species]?.stats.def??10)*0.2));
                target.hp=Math.max(0,target.hp-damage);
                this.broadcast("ability_used",{casterId:wildId,casterName:wild.name,targetId:wild.targetId,
                  targetName:SPECIES[target.species]?.name??target.species,abilityId:"devimon_dark",abilityName:"Garra de la Oscuridad",
                  amount:damage,kind:"damage",cooldownMs:8000,at:now} satisfies AbilityUsedPayload);
                if (target.hp<=0) this.handlePlayerDefeatedByWild(target,wild,now);
              }
            }
            continue;
          }
          if (now>=wild.nextSpecialAt && distance<=DEVIMON_CAST_RANGE) {
            wild.state="casting";wild.castEndsAt=now+1500;wild.moving=false;continue;
          }
        }
        if (distance > WILD_ATTACK_RANGE) {
          this.moveWildToward(
            wild,
            target.partnerX,
            target.partnerZ,
            WILD_CHASE_SPEED,
            dt,
          );
          wild.moving = true;
          wild.state = "chase";
        } else {
          wild.moving = false;
          wild.state = "attack";
          if (now - wild.lastAttackAt >= WILD_ATTACK_INTERVAL) {
            wild.lastAttackAt = now;
            this.engageWild(wild.targetId, wildId);

            const attack = SPECIES[wild.species]?.stats.atk ?? 20;
            const defense = SPECIES[target.species]?.stats.def ?? 15;
            const damage = Math.max(
              1,
              Math.round(
                attack * 0.14 +
                  wild.level * 1.5 -
                  defense * 0.08 +
                  Math.random() * 3,
              ),
            );
            const finalDamage=wild.isBoss&&wild.hp/wild.maxHp<0.3?Math.round(damage*1.35):damage;
            target.hp = Math.max(0, target.hp - finalDamage);

            const payload: AutoAttackPayload = {
              attackerId: wildId,
              attackerName: wild.name,
              targetId: wild.targetId,
              targetName: SPECIES[target.species]?.name ?? target.species,
              amount: finalDamage,
              at: now,
            };
            this.broadcast("auto_attack", payload);

            if (target.hp <= 0) {
              this.handlePlayerDefeatedByWild(target, wild, now);
            }
          }
        }
        continue;
      }

      if (now >= wild.aggroCooldownUntil) {
        let nearest: PlayerState | undefined;
        let nearestDistance = WILD_AGGRO_RANGE;
        for (const player of this.state.players.values()) {
          if (player.hp <= 0 || player.duelOpponent || now < player.evolutionReadyAt || getPvEArea(player.partnerX,player.partnerZ).safe) {
            continue;
          }
          const distance = distanceToWild(player, wild);
          if (distance < nearestDistance) {
            nearest = player;
            nearestDistance = distance;
          }
        }

        if (nearest) {
          const playerId = this.findPlayerId(nearest);
          if (playerId) {
            wild.targetId = playerId;
            wild.state = "chase";
            wild.moving = false;
            this.engageWild(playerId, wildId);
            continue;
          }
        }
      }

      const wanderDistance = Math.hypot(
        wild.wanderX - wild.x,
        wild.wanderZ - wild.z,
      );
      if (now >= wild.nextWanderAt || wanderDistance < 0.3) {
        const angle = Math.random() * Math.PI * 2;
        const radius = wild.isBoss?2:3+Math.random()*2;
        wild.wanderX = clamp(
          wild.homeX + Math.cos(angle) * radius,
          -WORLD_HALF,
          WORLD_HALF,
        );
        wild.wanderZ = clamp(
          wild.homeZ + Math.sin(angle) * radius,
          -WORLD_HALF,
          WORLD_HALF,
        );
        if (getPvEArea(wild.wanderX,wild.wanderZ).id!==wild.areaId) {
          wild.wanderX=wild.homeX;wild.wanderZ=wild.homeZ;
        }
        wild.nextWanderAt = now + 2500 + Math.random() * 4000;
      }

      if (wanderDistance > 0.3) {
        this.moveWildToward(
          wild,
          wild.wanderX,
          wild.wanderZ,
          WILD_WANDER_SPEED,
          dt,
        );
        wild.moving = true;
        wild.state = "idle";
      } else {
        wild.moving = false;
        wild.state = "idle";
      }
    }
  }

  private moveWildToward(
    wild: WildState,
    tx: number,
    tz: number,
    speed: number,
    dt: number,
  ) {
    const dx = tx - wild.x;
    const dz = tz - wild.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.1) {
      return;
    }

    const step = Math.min(distance, speed * dt);
    wild.x = clamp(
      wild.x + (dx / distance) * step,
      -WORLD_HALF,
      WORLD_HALF,
    );
    wild.z = clamp(
      wild.z + (dz / distance) * step,
      -WORLD_HALF,
      WORLD_HALF,
    );
    wild.rot = Math.atan2(dx, dz);
  }

  private startDuel(aId: string, bId: string) {
    const a = this.state.players.get(aId);
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
      this.wildTargets.delete(id);
      this.disengageAllWilds(id);
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

    if (player.hp <= 0) {
      this.sendAbilityError(client, ability.id, "Estás fuera de combate.");
      return;
    }
    if (Date.now() < player.evolutionReadyAt) {
      this.sendAbilityError(client, ability.id, "Tu Digimon está digievolucionando.");
      return;
    }

    const duelOpponent = player.duelOpponent
      ? this.state.players.get(player.duelOpponent)
      : undefined;
    if (player.duelOpponent && (!duelOpponent || duelOpponent.hp <= 0)) {
      this.sendAbilityError(client, ability.id, "El rival no está disponible.");
      return;
    }
    if (!duelOpponent && ability.kind==="damage" && getPvEArea(player.partnerX,player.partnerZ).safe) {
      this.sendAbilityError(client,ability.id,"Tu Digimon debe salir del refugio para atacar salvajes.");return;
    }

    let targetWild: WildState | undefined;
    if (!duelOpponent) {
      const wildId = this.wildTargets.get(client.sessionId);
      targetWild = wildId ? this.state.wilds.get(wildId) : undefined;
      if (targetWild && (targetWild.hp <= 0 || targetWild.state === "return")) {
        this.wildTargets.delete(client.sessionId);
        targetWild = undefined;
      }
      if (ability.kind === "damage" && !targetWild) {
        this.sendAbilityError(
          client,
          ability.id,
          "Selecciona un Digimon salvaje con Tab o haciendo clic.",
        );
        return;
      }
      if (ability.kind === "heal" && !targetWild && !player.inCombat) {
        this.sendAbilityError(
          client,
          ability.id,
          "Solo puedes curarte en combate.",
        );
        return;
      }
    }

    const combatX = duelOpponent?.partnerX ?? targetWild?.x;
    const combatZ = duelOpponent?.partnerZ ?? targetWild?.z;
    if (ability.kind === "damage" && combatX !== undefined && combatZ !== undefined &&
        Math.hypot(combatX - player.x, combatZ - player.z) > 20) {
      this.sendAbilityError(client, ability.id, "Objetivo fuera de la correa de 20 m del domador.");
      return;
    }
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

    if (ability.range > 0) {
      const distance = duelOpponent
        ? partnerDistance(player, duelOpponent)
        : targetWild
          ? distanceToWild(player, targetWild)
          : Number.POSITIVE_INFINITY;
      if (distance > ability.range) {
        this.sendAbilityError(client, ability.id, "Fuera de alcance.");
        return;
      }
    }

    player.ep = Math.max(0, player.ep - ability.cost);
    this.lastAbilityAt.set(client.sessionId, now);
    this.abilityReadyAt
      .get(client.sessionId)
      ?.set(ability.id, now + ability.cooldownMs);

    let amount: number;
    let targetId = client.sessionId;
    let targetName = SPECIES[player.species]?.name ?? player.species;

    if (ability.kind === "damage") {
      const defenderSpecies = duelOpponent?.species ?? targetWild?.species;
      const defenderStats = defenderSpecies
        ? SPECIES[defenderSpecies]?.stats
        : undefined;
      const attackerStats = SPECIES[player.species]?.stats;
      amount = Math.max(
        1,
        Math.round(
          ability.amount +
            (attackerStats?.atk ?? 20) * 0.25 -
            (defenderStats?.def ?? 15) * 0.18 +
            (player.level - 1) * 2 +
            Math.random() * 4,
        ),
      );

      if (duelOpponent) {
        targetId = player.duelOpponent;
        targetName = SPECIES[duelOpponent.species]?.name ?? duelOpponent.species;
        duelOpponent.hp = Math.max(0, duelOpponent.hp - amount);
      } else if (targetWild) {
        targetId = this.findWildId(targetWild);
        targetName = targetWild.name;
        this.recordDamage(targetId,client.sessionId,Math.min(targetWild.hp,amount));
        targetWild.hp = Math.max(0, targetWild.hp - amount);
        if (targetWild.state !== "casting") {
          targetWild.targetId = client.sessionId;
          targetWild.state = "chase";
        }
        targetWild.moving = false;
        this.wildTargets.set(client.sessionId, targetId);
        this.engageWild(client.sessionId, targetId);
      }
    } else {
      const requested = Math.round(ability.amount + player.level * 2);
      const before = player.hp;
      player.hp = Math.min(player.maxHp, before + requested);
      amount = Math.round(player.hp - before);
    }

    const payload: AbilityUsedPayload = {
      casterId: client.sessionId,
      casterName: SPECIES[player.species]?.name ?? player.species,
      targetId,
      targetName,
      abilityId: ability.id,
      abilityName: ability.name,
      amount,
      kind: ability.kind,
      cooldownMs: ability.cooldownMs,
      at: now,
    };
    this.broadcast("ability_used", payload);

    this.systemChat(
      targetId === client.sessionId
        ? amount > 0
          ? `${payload.casterName} de ${player.name} usó ${ability.name} y recuperó ${amount} HP.`
          : `${payload.casterName} de ${player.name} usó ${ability.name}, pero ya tenía la vida llena.`
        : `${payload.casterName} de ${player.name} usó ${ability.name} sobre ${targetName}: ${amount} de daño.`,
    );

    if (duelOpponent && duelOpponent.hp <= 0) {
      this.endDuel(client.sessionId, player.duelOpponent, "habilidad");
      return;
    }

    if (targetWild && targetWild.hp <= 0) {
      const wildId = this.findWildId(targetWild);
      if (wildId) {
        this.killWild(wildId, targetWild, client.sessionId, now);
      }
    }
  }

  private findWildId(wild: WildState): string {
    for (const [id, candidate] of this.state.wilds) {
      if (candidate === wild) {
        return id;
      }
    }
    return "";
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
        if (player.respawnAt > 0 && now >= player.respawnAt) {
          player.hp = player.maxHp;
          player.ep = player.maxEp;
          player.respawnAt = 0;
        }
      }

      if (player.hp <= 0) {
        // El compañero se recupera; el domador puede seguir moviéndose.
      } else if (player.inCombat) {
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

    this.updatePartners(dt, now);

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

    for (const [playerId, wildId] of Array.from(this.wildTargets)) {
      const player = this.state.players.get(playerId);
      const wild = this.state.wilds.get(wildId);
      if (
        !player ||
        player.hp <= 0 ||
        player.duelOpponent ||
        !wild ||
        wild.hp <= 0 || wild.state === "return"
      ) {
        this.wildTargets.delete(playerId);
        continue;
      }

      if (getPvEArea(player.partnerX,player.partnerZ).safe || distanceToWild(player, wild) > AUTO_ATTACK_RANGE || Math.hypot(wild.x - player.x, wild.z - player.z) > 20) {
        continue;
      }

      const last = this.lastAutoAt.get(playerId) ?? 0;
      if (now - last < AUTO_ATTACK_INTERVAL) {
        continue;
      }

      this.lastAutoAt.set(playerId, now);
      const attack = SPECIES[player.species]?.stats.atk ?? 20;
      const defense = SPECIES[wild.species]?.stats.def ?? 15;
      const damage = Math.max(
        1,
        Math.round(
          attack * 0.18 -
            defense * 0.08 +
            3 +
            (player.level - 1) * 0.8 +
            Math.random() * 3,
        ),
      );
      this.recordDamage(wildId,playerId,Math.min(wild.hp,damage));
      wild.hp = Math.max(0, wild.hp - damage);
      if (wild.state !== "casting") {
        wild.targetId = playerId;
        wild.state = "chase";
      }
      wild.moving = false;
      this.engageWild(playerId, wildId);

      this.broadcast("auto_attack", {
        attackerId: playerId,
        attackerName: SPECIES[player.species]?.name ?? player.species,
        targetId: wildId,
        targetName: wild.name,
        amount: damage,
        at: now,
      } satisfies AutoAttackPayload);

      if (wild.hp <= 0) {
        this.killWild(wildId, wild, playerId, now);
      }
    }

    this.updateWilds(now, dt);
    if (now >= this.nextProfileSaveAt) {
      this.nextProfileSaveAt = now + 10000;
      for (const id of this.profileKeys.keys()) void this.saveProfile(id);
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

    if (partnerDistance(attacker, defender) > AUTO_ATTACK_RANGE ||
        Math.hypot(defender.partnerX - attacker.x, defender.partnerZ - attacker.z) > 20) {
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
      attackerName: SPECIES[attacker.species]?.name ?? attacker.species,
      targetId: defenderId,
      targetName: SPECIES[defender.species]?.name ?? defender.species,
      amount: damage,
      at: now,
    };
    this.broadcast("auto_attack", payload);

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
      this.grantXp(winnerId, 40 + (loser?.level ?? 1) * 10);
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
    void this.saveProfile(winnerId);
    void this.saveProfile(loserId);

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
