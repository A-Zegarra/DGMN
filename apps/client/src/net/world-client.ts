import { Callbacks, Client, type Room } from "@colyseus/sdk";

import { getAbilitiesForSpecies, type Ability } from "@digiworld/content";
import { getPvEArea } from "@digiworld/content";
import type { InventoryPayload, LootReceivedPayload, ItemUsedPayload } from "@digiworld/shared/messages";
import type { EvolutionPayload, EvolutionErrorPayload } from "@digiworld/shared/messages";
import type { ProfileStatusPayload } from "@digiworld/shared/messages";
import type { QuestJournalData, QuestClaimedPayload } from "@digiworld/shared/messages";
import type { ShopPurchasePayload } from "@digiworld/shared/messages";
import type { ProfileAccessAction, ProfileAccessPayload } from "@digiworld/shared/messages";
import { getProfileToken, rememberProfile } from "./profile";
import { RUN_SPEED, WALK_SPEED, WORLD_HALF } from "@digiworld/shared/constants";
import type {
  AbilityErrorPayload,
  AbilityUsedPayload,
  AutoAttackPayload,
  ChatMessage,
  DuelDeclinedPayload,
  DuelEndPayload,
  DuelErrorPayload,
  DuelRequestPayload,
  DuelRequestSentPayload,
  DuelStartPayload,
  LevelUpPayload,
  WildDeathPayload,
} from "@digiworld/shared/messages";
import type { PlayerState, WildState, WorldState } from "@digiworld/shared/schema";

const INPUT_SEND_INTERVAL = 50;
import { loadCameraSettings, saveCameraSettings, validateCameraSettings, type CameraSettings, angleDelta, smoothFactor } from "../game/camera-settings";
const FP_PITCH_MIN = -1.1;
const FP_PITCH_MAX = 0.85;
const TP_PITCH_MIN = 20 * Math.PI / 180;
const TP_PITCH_MAX = 65 * Math.PI / 180;

export type CameraMode = "first-person" | "third-person";

export interface CombatVisual {
  attackAt: number;
  hitAt: number;
  healAt: number;
  evolutionAt?: number;
}

export interface PlayerView extends CombatVisual {
  id: string;
  name: string;
  species: string;
  level: number;
  moving: boolean;
  running: boolean;
  hp: number;
  maxHp: number;
  ep: number;
  maxEp: number;
  inCombat: boolean;
  duelOpponent: string;
  duelWins: number;
  duelLosses: number;
  xp: number;
  xpNext: number;

  /** Posición autoritativa del servidor. */
  serverX: number;
  serverZ: number;
  serverRot: number;

  /** Posición suavizada que se dibuja. */
  x: number;
  z: number;
  rot: number;
  partnerX: number;
  partnerZ: number;
  partnerRot: number;
  partnerMoving: boolean;
  serverPartnerX: number;
  serverPartnerZ: number;
  serverPartnerRot: number;
}

export interface WildView extends CombatVisual {
  id: string;
  name: string;
  species: string;
  level: number;
  hp: number;
  maxHp: number;
  moving: boolean;
  serverX: number;
  serverZ: number;
  serverRot: number;
  x: number;
  z: number;
  rot: number;
  isBoss: boolean;
  areaId: string;
  state: string;
  castEndsAt: number;
}

export interface DuelResult {
  won: boolean;
  opponentName: string;
}

export interface LevelUpNotice {
  level: number;
  at: number;
}

interface CombatError {
  text: string;
  at: number;
}

export type CombatFeedKind =
  | "damage-out"
  | "damage-in"
  | "ability-out"
  | "ability-in"
  | "heal"
  | "xp";

export interface CombatFeedEntry {
  id: number;
  kind: CombatFeedKind;
  amount: number;
  label: string;
  at: number;
}

export interface CombatEffect {
  id: number;
  x: number;
  z: number;
  fromX: number;
  fromZ: number;
  amount: number;
  heal: boolean;
  style: "hit" | "fire" | "ice" | "heal" | "defeat" | "level" | "evolution" | "energy";
  targetId: string;
  at: number;
}

interface MoveInput {
  x: number;
  z: number;
  run: boolean;
  yaw: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}

export class WorldClient {
  readonly room: Room<WorldState>;
  readonly localId: string;
  readonly players = new Map<string, PlayerView>();
  readonly wilds = new Map<string, WildView>();

  cameraMode: CameraMode = "third-person";
  yaw = 0;
  cameraSettings = loadCameraSettings();
  pitch = this.cameraSettings.initialPitch * Math.PI / 180;
  mouseLeft = false;
  mouseRight = false;
  lastCameraInputAt = 0;
  cameraTelemetry = { distance: 6, requestedDistance: 6, focusHeight: 1.17, obstructed: false,
    tamer: {x:0,y:0}, partner: {x:0,y:0} };

  targetId: string | null = null;
  targetWildId: string | null = null;
  incomingDuel: DuelRequestPayload | null = null;
  pendingDuelTargetName: string | null = null;
  duelResult: DuelResult | null = null;
  levelUp: LevelUpNotice | null = null;
  lastError: CombatError | null = null;
  readonly abilityCooldowns = new Map<string, number>();
  readonly combatFeed: CombatFeedEntry[] = [];

  onDisconnect: (() => void) | null = null;

  private readonly callbacks: ReturnType<typeof Callbacks.get<WorldState>>;
  private readonly keys = new Set<string>();
  private readonly inputBlocks = new Set<symbol>();
  private readonly inputResetListeners = new Set<() => void>();
  private readonly rosterListeners = new Set<() => void>();
  private readonly chatListeners = new Set<(message: ChatMessage) => void>();
  private readonly combatListeners = new Set<() => void>();
  private readonly wildListeners = new Set<() => void>();
  private incomingDuelTimer: ReturnType<typeof setTimeout> | null = null;
  private duelResultTimer: ReturnType<typeof setTimeout> | null = null;
  private levelUpTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private feedSequence = 0;
  private lastVitalsNotifyAt = 0;
  private lastAutoTargetAt = 0;
  readonly effects: CombatEffect[] = [];
  evolutionNotice: {from: string; to: string; until: number} | null = null;
  evolutionPendingUntil = 0;
  profilePersistent = false;
  profileSavedAt = 0;
  profileSaveError: string | null = null;
  isSavingExit = false;
  inventory: InventoryPayload = {hpPotion:0,epPotion:0,bits:0,devimonSeals:0,cooldownMs:0};
  inventoryLoaded = false;
  itemReadyAt = 0;
  companionPassive = false;
  lastLoot: {data:LootReceivedPayload;until:number} | null = null;
  quests: QuestJournalData = {completed: [], kills: 0};
  questsLoaded = false;
  lastQuestReward: {data: QuestClaimedPayload; until: number} | null = null;
  shopPendingUntil = 0;
  shopReadyAt = 0;
  lastShopPurchase: {data: ShopPurchasePayload; until: number} | null = null;
  profileAccessPendingUntil = 0;
  profileAccessReadyAt = 0;
  profileLink: {code:string;expiresAt:number} | null = null;
  profileRecoveryCode: string | null = null;
  profileAccessMessage: string | null = null;
  profileAccessError: string | null = null;
  private saveWaiter?: (ok: boolean) => void;
  private saveRequestId?: string;
  pendingAbility: { id: string; targetId: string; until: number } | null = null;
  private effectSequence = 0;

  private touchMove = { x: 0, y: 0 };
  private lastInputSignature = "";
  private lastInputSentAt = 0;
  private lastFrameAt = performance.now();
  private lastControlAt = performance.now();
  private inputWasMoving = false;
  private inputSeq = 0;
  private yawInitialized = false;

  private constructor(room: Room<WorldState>) {
    this.room = room;
    this.localId = room.sessionId;
    this.callbacks = Callbacks.get(room);

    this.callbacks.onAdd("players", (player: PlayerState, id: string) => {
      this.addPlayer(player, id);
    });

    this.callbacks.onRemove("players", (_player: PlayerState, id: string) => {
      this.players.delete(id);
      if (this.targetId === id) {
        this.targetId = null;
      }
      this.emitRoster();
      this.emitCombat();
    });

    this.callbacks.onAdd("wilds", (wild: WildState, id: string) => {
      this.addWild(wild, id);
    });

    this.callbacks.onRemove("wilds", (_wild: WildState, id: string) => {
      this.wilds.delete(id);
      if (this.targetWildId === id) {
        this.targetWildId = null;
      }
      this.emitWilds();
      this.emitCombat();
    });

    room.onMessage("chat", (message: ChatMessage) => {
      for (const listener of this.chatListeners) {
        listener(message);
      }
    });

    room.onMessage("duel_request", (message: DuelRequestPayload) => {
      this.clearIncomingDuelTimer();
      this.incomingDuel = message;
      this.lastError = null;
      this.emitCombat();
      this.incomingDuelTimer = setTimeout(
        () => {
          if (this.incomingDuel?.fromId === message.fromId) {
            this.incomingDuel = null;
            this.emitCombat();
          }
        },
        Math.max(3000, message.at + 15000 - Date.now()),
      );
    });

    room.onMessage("duel_request_sent", (message: DuelRequestSentPayload) => {
      this.pendingDuelTargetName = message.targetName;
      this.emitCombat();
    });

    room.onMessage("duel_declined", (message: DuelDeclinedPayload) => {
      this.pendingDuelTargetName = null;
      this.setError(`${message.byName} rechazó el duelo.`);
    });

    room.onMessage("duel_error", (message: DuelErrorPayload) => {
      this.pendingDuelTargetName = null;
      this.setError(message.reason);
    });

    room.onMessage("duel_start", (message: DuelStartPayload) => {
      this.clearIncomingDuelTimer();
      this.incomingDuel = null;
      this.pendingDuelTargetName = null;
      this.duelResult = null;
      this.targetId = message.opponentId;
      this.targetWildId = null;
      this.room.send("wild_target", { wildId: "" });
      this.abilityCooldowns.clear();
      this.combatFeed.length = 0;
      this.emitCombat();
    });

    room.onMessage("duel_end", (message: DuelEndPayload) => {
      const localWon = message.winnerId === this.localId;
      this.duelResult = {
        won: localWon,
        opponentName: localWon ? message.loserName : message.winnerName,
      };
      this.pendingDuelTargetName = null;
      this.targetId = null;
      this.targetWildId = null;
      this.abilityCooldowns.clear();
      this.emitCombat();
      if (this.duelResultTimer) {
        clearTimeout(this.duelResultTimer);
      }
      this.duelResultTimer = setTimeout(() => {
        this.duelResult = null;
        this.emitCombat();
      }, 5000);
    });

    room.onMessage("ability_used", (message: AbilityUsedPayload) => {
      this.addEffect(message.casterId, message.targetId, message.amount, message.kind === "heal", message.kind === "heal" ? "heal" : message.abilityId.includes("fire") || message.abilityId.includes("flame") || message.abilityId.startsWith("agumon") ? "fire" : message.abilityId.startsWith("gabumon") ? "ice" : "hit");
      if (message.casterId === this.localId) {
        this.abilityCooldowns.set(
          message.abilityId,
          Date.now() + message.cooldownMs,
        );
        if (message.kind === "damage" || message.amount > 0) {
          this.pushFeed({
            kind: message.kind === "heal" ? "heal" : "ability-out",
            amount: message.amount,
            label:
              message.kind === "heal"
                ? message.abilityName
                : `${message.abilityName} → ${message.targetName}`,
            at: Date.now(),
          });
        }
      } else if (message.targetId === this.localId) {
        this.pushFeed({
          kind: "ability-in",
          amount: message.amount,
          label: `${message.casterName}: ${message.abilityName}`,
          at: Date.now(),
        });
      }
      this.emitCombat();
    });

    room.onMessage("auto_attack", (message: AutoAttackPayload) => {
      this.addEffect(message.attackerId, message.targetId, message.amount, false);
      if (message.attackerId === this.localId) {
        this.pushFeed({
          kind: "damage-out",
          amount: message.amount,
          label: `Golpe → ${message.targetName}`,
          at: Date.now(),
        });
      } else if (message.targetId === this.localId) {
        this.pushFeed({
          kind: "damage-in",
          amount: message.amount,
          label: message.attackerName,
          at: Date.now(),
        });
      }
      this.emitCombat();
    });

    room.onMessage("inventory", (message:InventoryPayload) => {
      this.inventory=message;this.inventoryLoaded=true;
      this.itemReadyAt=Date.now()+message.cooldownMs;this.emitCombat();
    });
    room.onMessage("item_error", (message:{reason:string}) => this.setError(message.reason));
    room.onMessage("quests", (message: QuestJournalData) => {
      this.quests = message; this.questsLoaded = true; this.emitCombat();
    });
    room.onMessage("quest_error", (message: {reason: string}) => this.setError(message.reason));
    room.onMessage("shop_error", (message: {reason: string}) => {
      this.shopPendingUntil = 0; this.setError(message.reason);
    });
    room.onMessage("shop_purchase", (message: ShopPurchasePayload) => {
      this.shopPendingUntil = 0;
      this.shopReadyAt = Date.now() + message.cooldownMs;
      this.lastShopPurchase = {data: message, until: Date.now() + 8000};
      this.emitCombat();
    });
    room.onMessage("quest_claimed", (message: QuestClaimedPayload) => {
      this.lastQuestReward = {data: message, until: Date.now() + 8000};
      this.pushFeed({kind: "xp", amount: message.reward.xp, label: `Misión: ${message.questName}`, at: Date.now()});
      this.emitCombat();
    });
    room.onMessage("loot_received", (message:LootReceivedPayload) => {
      this.lastLoot={data:message,until:Date.now()+6000};this.emitCombat();
    });
    room.onMessage("item_used", (message:ItemUsedPayload) => {
      this.addEffect(message.playerId,message.playerId,message.amount,true,message.kind==="ep"?"energy":"heal");
      if(message.playerId===this.localId)this.pushFeed({kind:"heal",amount:message.amount,label:message.kind==="hp"?"Disco de vida":"Disco de energía (EP)",at:Date.now()});
      this.emitCombat();
    });
    room.onMessage("profile_status", (message: ProfileStatusPayload) => {
      this.profilePersistent = message.persistent;
      this.profileSaveError = message.error ?? null;
      if (message.savedAt > 0) this.profileSavedAt = message.savedAt;
      if (message.profile && !message.error) rememberProfile(message.profile);
      if (message.cooldowns) for (const [id, remaining] of Object.entries(message.cooldowns)) {
        this.abilityCooldowns.set(id, Math.max(this.abilityCooldowns.get(id) ?? 0, Date.now() + remaining));
      }
      if (message.requestId === this.saveRequestId && this.saveRequestId) this.saveWaiter?.(Boolean(message.savedAt > 0 && !message.error));
      this.emitRoster();
    });
    room.onMessage("profile_access", (message: ProfileAccessPayload) => {
      this.profileAccessPendingUntil=0;
      this.profileAccessError=null;
      if(message.action==="link"&&message.code&&message.expiresAt)this.profileLink={code:message.code,expiresAt:message.expiresAt};
      if(message.action==="recovery"&&message.code)this.profileRecoveryCode=message.code;
      if(message.action==="cancel_link"){this.profileLink=null;this.profileAccessMessage="Código de vinculación cancelado.";}
      if(message.action==="revoke_others"){
        this.profileLink=null;this.profileRecoveryCode=null;
        this.profileAccessMessage=`Se desvincularon ${message.revokedCount??0} dispositivos. Este acceso se conserva. Genera una nueva clave de recuperación.`;
      }
      this.emitCombat();
    });
    room.onMessage("profile_access_error", (message: {reason:string}) => {
      this.profileAccessPendingUntil=0;this.profileAccessError=message.reason;this.emitCombat();
    });
    room.onMessage("evolution", (message: EvolutionPayload) => {
      const player = this.players.get(message.playerId);
      if (player) player.evolutionAt = performance.now();
      this.addEffect(message.playerId, message.playerId, 0, true, "evolution");
      if (message.playerId === this.localId) {
        this.evolutionNotice = {from: message.fromSpecies, to: message.toSpecies, until: Date.now() + message.durationMs};
        this.evolutionPendingUntil = 0;
        this.pendingAbility = null;
        this.targetWildId = null;
        this.targetId = null;
        this.abilityCooldowns.clear();
      }
      this.emitCombat();
      this.emitRoster();
    });
    room.onMessage("evolution_error", (message: EvolutionErrorPayload) => {
      this.evolutionPendingUntil = 0;
      this.setError(message.reason);
    });
    room.onMessage("ability_error", (message: AbilityErrorPayload) => {
      this.setError(message.reason);
    });

    room.onMessage("level_up", (message: LevelUpPayload) => {
      this.addEffect(this.localId, this.localId, 0, true, "level");
      this.levelUp = { level: message.level, at: message.at };
      this.emitCombat();
      if (this.levelUpTimer) {
        clearTimeout(this.levelUpTimer);
      }
      this.levelUpTimer = setTimeout(() => {
        this.levelUp = null;
        this.emitCombat();
      }, 4500);
    });

    room.onMessage("wild_death", (message: WildDeathPayload) => {
      this.addEffect(message.killerId, message.wildId, 0, false, "defeat");
      if (message.killerId === this.localId) {
        this.pushFeed({
          kind: "xp",
          amount: message.xp,
          label: `${message.wildName} derrotado`,
          at: Date.now(),
        });
        this.emitCombat();
      }
    });

    room.onLeave(() => {
      this.saveWaiter?.(false);
      this.onDisconnect?.();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __dw?: WorldClient }).__dw = this;
    }
    room.send("save_profile");
    room.send("inventory_request");
    room.send("quests_request");
  }

  buyShopOffer(offerId: string): void {
    if (!this.inventoryLoaded || Date.now() < Math.max(this.shopPendingUntil, this.shopReadyAt)) return;
    this.shopPendingUntil = Date.now() + 5000;
    this.lastShopPurchase = null;
    this.lastError = null;
    this.room.send("shop_buy", {offerId});
    this.emitCombat();
  }

  requestProfileAccess(action: ProfileAccessAction): void {
    const now=Date.now();
    if(now<this.profileAccessPendingUntil||(action!=="cancel_link"&&now<this.profileAccessReadyAt))return;
    this.profileAccessPendingUntil=now+15000;
    if(action!=="cancel_link")this.profileAccessReadyAt=now+5500;
    this.profileAccessMessage=null;this.profileAccessError=null;
    if(action==="link")this.profileLink=null;
    if(action==="recovery")this.profileRecoveryCode=null;
    this.room.send("profile_access",{action});this.emitCombat();
  }

  static async connect(
    serverUrl: string,
    name: string,
    species: string,
  ): Promise<WorldClient> {
    const profileToken = getProfileToken();
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const client = new Client(serverUrl);
        const room = await client.joinOrCreate<WorldState>("world", {
          name,
          species,
          profileToken,
        });
        return new WorldClient(room);
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("No se pudo conectar con el servidor.");
  }

  async saveAndLeave(): Promise<void> {
    if (this.saveWaiter) throw new Error("Ya se está guardando la partida.");
    this.isSavingExit = true;
    this.emitRoster();
    try {
    const saved = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => finish(false), 10000);
      const finish = (ok: boolean) => {
        clearTimeout(timer); this.saveWaiter = undefined; this.saveRequestId = undefined; resolve(ok);
      };
      this.saveWaiter = finish;
      this.saveRequestId = `${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
      this.room.send("save_profile", {requestId: this.saveRequestId});
    });
    if (!saved) {
      this.profileSaveError ??= "El servidor no confirmó el guardado. Vuelve a intentarlo antes de salir.";
      throw new Error(this.profileSaveError);
    }
    await this.room.leave();
    } finally { this.isSavingExit = false; this.emitRoster(); }
  }

  subscribeRoster(listener: () => void): () => void {
    this.rosterListeners.add(listener);
    listener();
    return () => {
      this.rosterListeners.delete(listener);
    };
  }

  subscribeChat(listener: (message: ChatMessage) => void): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  subscribeCombat(listener: () => void): () => void {
    this.combatListeners.add(listener);
    listener();
    return () => {
      this.combatListeners.delete(listener);
    };
  }

  subscribeWilds(listener: () => void): () => void {
    this.wildListeners.add(listener);
    listener();
    return () => {
      this.wildListeners.delete(listener);
    };
  }

  getAbilities(): Ability[] {
    const local = this.players.get(this.localId);
    return local ? getAbilitiesForSpecies(local.species) : [];
  }

  getCooldownRemaining(abilityId: string): number {
    return Math.max(0, (this.abilityCooldowns.get(abilityId) ?? 0) - Date.now());
  }

  useItem(itemId:string): void {this.room.send("use_item",{itemId});}

  recallCompanion(): void {
    const local=this.players.get(this.localId);
    if(local?.duelOpponent){this.setError("No puedes retirar al compañero de un duelo.");return;}
    this.companionPassive=true;this.clearTarget();this.room.send("partner_recall");this.emitCombat();
  }

  evolve(targetSpecies: string): void {
    if (Date.now() < this.evolutionPendingUntil) return;
    this.evolutionPendingUntil = Date.now() + 5000;
    this.room.send("evolve", {targetSpecies});
    this.emitCombat();
  }

  useAbility(abilityId: string): void {
    const local = this.players.get(this.localId);
    const ability = this.getAbilities().find((entry) => entry.id === abilityId);
    if (!local || !ability || local.hp <= 0) return;
    if (this.getCooldownRemaining(abilityId) > 0) return;
    if (local.ep < ability.cost) {
      this.setError("No tienes suficiente energía.");
      return;
    }
    if (ability.kind === "damage") {
      if (!local.duelOpponent && !this.targetWildId) this.cycleTarget();
      const targetId = local.duelOpponent || this.targetWildId;
      const target = targetId ? this.players.get(targetId) ?? this.wilds.get(targetId) : undefined;
      if (!target || target.hp <= 0) {
        this.setError("Selecciona un salvaje o acepta un duelo para atacar.");
        return;
      }
      const position = this.getCombatPosition(target.id);
      if (position && Math.hypot(position.x - local.x, position.z - local.z) > 20) {
        this.setError("Acerca al domador: tu Digimon solo combate a menos de 20 m de ti.");
        return;
      }
      if (position && (Math.hypot(position.x - local.partnerX, position.z - local.partnerZ) > ability.range - 0.4 ||
          (!local.duelOpponent && getPvEArea(local.partnerX,local.partnerZ).safe))) {
        this.pendingAbility = { id: abilityId, targetId: target.id, until: Date.now() + 15000 };
        this.emitCombat();
        return;
      }
    }
    this.pendingAbility = null;
    this.room.send("use_ability", { abilityId });
  }

  cancelApproach(): void {
    this.pendingAbility = null;
    this.emitCombat();
  }

  getCombatPosition(id: string): { x: number; z: number } | undefined {
    const player = this.players.get(id);
    if (player) return { x: player.partnerX, z: player.partnerZ };
    return this.wilds.get(id);
  }

  private addEffect(fromId: string, targetId: string, amount: number, heal: boolean, style: CombatEffect["style"] = heal ? "heal" : "hit"): void {
    const target = this.getCombatPosition(targetId);
    const from = this.getCombatPosition(fromId);
    if (!target) return;
    const now = performance.now();
    const caster = this.players.get(fromId) ?? this.wilds.get(fromId);
    const defender = this.players.get(targetId) ?? this.wilds.get(targetId);
    if (style !== "defeat" && style !== "level" && style !== "evolution") {
      if (caster && !heal) caster.attackAt = now;
      if (defender) { if (heal) defender.healAt = now; else defender.hitAt = now; }
    }
    this.effects.push({ id: ++this.effectSequence, x: target.x, z: target.z,
      fromX: from?.x ?? target.x, fromZ: from?.z ?? target.z, amount, heal, style, targetId, at: now });
    if (this.effects.length > 40) this.effects.shift();
  }

  requestDuel(targetId: string): void {
    const target = this.players.get(targetId);
    if (!target) {
      return;
    }
    this.pendingDuelTargetName = target.name;
    this.room.send("duel_request", { targetId });
    this.emitCombat();
  }

  respondDuel(accept: boolean): void {
    const request = this.incomingDuel;
    if (!request) {
      return;
    }
    this.clearIncomingDuelTimer();
    this.incomingDuel = null;
    this.room.send("duel_response", {
      fromId: request.fromId,
      accept,
    });
    this.emitCombat();
  }

  forfeitDuel(): void {
    this.room.send("duel_forfeit");
  }

  setTarget(targetId: string | null): void {
    this.pendingAbility = null;
    this.targetId =
      targetId && targetId !== this.localId && this.players.has(targetId)
        ? targetId
        : null;
    this.targetWildId = null;
    this.room.send("wild_target", { wildId: "" });
    this.emitCombat();
  }

  setWildTarget(wildId: string | null): void {
    this.pendingAbility = null;
    const wild = wildId ? this.wilds.get(wildId) : undefined;
    if (!wild || wild.hp <= 0) {
      this.targetWildId = null;
      this.room.send("wild_target", { wildId: "" });
      this.emitCombat();
      return;
    }
    this.targetId = null;
    this.companionPassive=false;
    this.targetWildId = wild.id;
    this.room.send("wild_target", { wildId: wild.id });
    this.emitCombat();
  }

  cycleTarget(): void {
    const local = this.players.get(this.localId);
    if (!local || local.duelOpponent) {
      return;
    }

    const candidates: Array<{
      id: string;
      kind: "player" | "wild";
      distance: number;
    }> = [];

    for (const player of this.players.values()) {
      if (player.id === this.localId) {
        continue;
      }
      candidates.push({
        id: player.id,
        kind: "player",
        distance: Math.hypot(player.x - local.x, player.z - local.z),
      });
    }

    for (const wild of this.wilds.values()) {
      if (wild.hp <= 0) {
        continue;
      }
      candidates.push({
        id: wild.id,
        kind: "wild",
        distance: Math.hypot(wild.x - local.x, wild.z - local.z),
      });
    }

    candidates.sort((a, b) => Number(a.kind === "player") - Number(b.kind === "player") || a.distance - b.distance);
    if (candidates.length === 0) {
      this.clearTarget();
      return;
    }

    const currentIndex = candidates.findIndex((candidate) =>
      candidate.kind === "wild"
        ? candidate.id === this.targetWildId
        : candidate.id === this.targetId,
    );
    const next = candidates[(currentIndex + 1) % candidates.length]!;
    if (next.kind === "wild") {
      this.setWildTarget(next.id);
    } else {
      this.setTarget(next.id);
    }
  }

  clearTarget(): void {
    this.pendingAbility = null;
    this.targetId = null;
    this.targetWildId = null;
    this.room.send("wild_target", { wildId: "" });
    this.emitCombat();
  }

  clearError(): void {
    this.lastError = null;
    this.emitCombat();
  }

  getCombatFeed(): CombatFeedEntry[] {
    const cutoff = Date.now() - 7000;
    while (this.combatFeed.length > 0 && this.combatFeed[0]!.at < cutoff) {
      this.combatFeed.shift();
    }
    return this.combatFeed.slice();
  }

  toggleCameraMode(): CameraMode {
    this.cameraMode =
      this.cameraMode === "first-person" ? "third-person" : "first-person";

    const local = this.players.get(this.localId);
    this.yaw = local
      ? Math.atan2(Math.sin(local.rot), Math.cos(local.rot))
      : this.yaw;
    this.pitch = this.cameraMode === "first-person" ? 0 : this.cameraSettings.initialPitch * Math.PI / 180;
    this.releaseMouse();
    this.touchMove = { x: 0, y: 0 };
    this.emitRoster();
    return this.cameraMode;
  }

  /** Delta del ratón o del dedo, en píxeles. */
  addLook(deltaX: number, deltaY: number): void {
    if (this.inputBlocked || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    this.lastCameraInputAt = performance.now();
    this.yaw -= deltaX * this.cameraSettings.sensitivityX;
    const vertical = deltaY * this.cameraSettings.sensitivityY * (this.cameraSettings.invertY ? -1 : 1);

    if (this.cameraMode === "first-person") {
      this.pitch = clamp(
        this.pitch - vertical,
        FP_PITCH_MIN,
        FP_PITCH_MAX,
      );
      return;
    }

    this.pitch = clamp(
      this.pitch + vertical,
      TP_PITCH_MIN,
      TP_PITCH_MAX,
    );
  }

  updateCameraSettings(patch: Partial<CameraSettings>): void {
    this.cameraSettings = validateCameraSettings({ ...this.cameraSettings, ...patch });
    if (patch.initialPitch !== undefined) this.pitch = this.cameraSettings.initialPitch * Math.PI / 180;
    saveCameraSettings(this.cameraSettings);
    this.emitRoster();
  }

  zoomCamera(delta: number): void {
    if (this.inputBlocked) return;
    this.lastCameraInputAt = performance.now();
    this.updateCameraSettings({ distance: this.cameraSettings.distance + delta * 0.01 * this.cameraSettings.zoomSpeed });
  }

  releaseMouse(): void {
    this.mouseLeft = false;
    this.mouseRight = false;
  }

  /** Joystick táctil: x = derecha, y = adelante. */
  setTouchMove(x: number, y: number): void {
    if (this.inputBlocked && (x || y)) return;
    this.touchMove = {
      x: Number.isFinite(x) ? clamp(x, -1, 1) : 0,
      y: Number.isFinite(y) ? clamp(y, -1, 1) : 0,
    };
    this.refreshInput();
  }

  setKey(key: string, pressed: boolean, repeat = false): void {
    const normalized = key.toLowerCase();
    if (pressed) {
      if (this.inputBlocked || (repeat && !this.keys.has(normalized))) return;
      this.keys.add(normalized);
    } else {
      this.keys.delete(normalized);
    }
    this.refreshInput();
  }

  clearKeys(): void {
    this.keys.clear();
  }

  get inputBlocked(): boolean { return this.inputBlocks.size > 0; }
  get touchMoving(): boolean { return Math.hypot(this.touchMove.x, this.touchMove.y) > 0.01; }

  /** Una ventana nunca hereda teclas/dedos que estaban pulsados en el mundo. */
  blockInput(): () => void {
    const token = Symbol();
    this.inputBlocks.add(token);
    this.resetControls();
    return () => { this.inputBlocks.delete(token); this.resetControls(); };
  }

  subscribeInputReset(listener: () => void): () => void {
    this.inputResetListeners.add(listener);
    return () => { this.inputResetListeners.delete(listener); };
  }

  resetControls(): void {
    this.clearKeys();
    this.releaseMouse();
    this.setTouchMove(0, 0);
    for (const listener of this.inputResetListeners) listener();
    const yaw = this.players.get(this.localId)?.rot ?? this.yaw;
    this.sendInput({x:0, z:0, run:false, yaw}, performance.now());
  }

  /** Mantener 20 Hz de controles incluso si WebGL dibuja pocos fotogramas. */
  startControls(): () => void {
    this.lastControlAt = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - this.lastControlAt) / 1000, 0.25);
      this.lastControlAt = now;
      const local = this.players.get(this.localId);
      const input = this.readInput(local, dt);
      if (local) local.rot = input.yaw;
      this.sendInput(input, now);
    }, INPUT_SEND_INTERVAL);
    return () => { clearInterval(timer); this.resetControls(); };
  }

  refreshInput(): void {
    this.sendInput(this.readInput(this.players.get(this.localId), 0), performance.now());
  }

  /** Se llama una vez por frame dentro del Canvas. */
  update(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameAt) / 1000, 0.25);
    this.lastFrameAt = now;

    const local = this.players.get(this.localId);
    const input = this.readInput(local, 0);

    if (this.pendingAbility && local) {
      const pending = this.pendingAbility;
      const target = this.players.get(pending.targetId) ?? this.wilds.get(pending.targetId);
      const ability = this.getAbilities().find((entry) => entry.id === pending.id);
      if (input.x || input.z || !target || target.hp <= 0 || local.hp <= 0 || !ability || Date.now() > pending.until) {
        this.cancelApproach();
      } else {
        const point = this.getCombatPosition(target.id)!;
        const dx = point.x - local.partnerX;
        const dz = point.z - local.partnerZ;
        const distance = Math.hypot(dx, dz);
        if (distance <= ability.range - 0.4 && (local.duelOpponent || !getPvEArea(local.partnerX,local.partnerZ).safe)) {
          this.pendingAbility = null;
          this.useAbility(ability.id);
        } else {
          // Solo el compañero se acerca, siguiendo el objetivo validado en el servidor.
          if (Math.hypot(point.x - local.x, point.z - local.z) > 20) {
            this.cancelApproach();
            this.setError("Acerca al domador: objetivo fuera de la correa de 20 m.");
          }
        }
      }
    }
    while (this.effects.length && now - this.effects[0]!.at > 1400) this.effects.shift();

    if (local) {
      const isMoving = input.x !== 0 || input.z !== 0;
      if (isMoving) {
        const speed = input.run ? RUN_SPEED : WALK_SPEED;
        local.x = clamp(
          local.x + input.x * speed * dt,
          -WORLD_HALF,
          WORLD_HALF,
        );
        local.z = clamp(
          local.z + input.z * speed * dt,
          -WORLD_HALF,
          WORLD_HALF,
        );
        local.moving = true;
        local.running = input.run;
      } else {
        local.moving = false;
        local.running = false;
      }

      local.rot = input.yaw;

      const dx = local.serverX - local.x;
      const dz = local.serverZ - local.z;
      if (Math.hypot(dx, dz) > 1.1) {
        local.x = local.serverX;
        local.z = local.serverZ;
      }
    }

    const smoothing = 1 - Math.exp(-14 * dt);
    for (const view of this.players.values()) {
      view.partnerX += (view.serverPartnerX - view.partnerX) * smoothing;
      view.partnerZ += (view.serverPartnerZ - view.partnerZ) * smoothing;
      view.partnerRot = lerpAngle(view.partnerRot, view.serverPartnerRot, smoothing);
    }
    for (const [id, view] of this.players) {
      if (id === this.localId) {
        continue;
      }
      view.x += (view.serverX - view.x) * smoothing;
      view.z += (view.serverZ - view.z) * smoothing;
      view.rot = lerpAngle(view.rot, view.serverRot, smoothing);
    }

    for (const wild of this.wilds.values()) {
      wild.x += (wild.serverX - wild.x) * smoothing;
      wild.z += (wild.serverZ - wild.z) * smoothing;
      wild.rot = lerpAngle(wild.rot, wild.serverRot, smoothing);
    }

    // Si un salvaje te ataca y no tienes objetivo, fíjalo automáticamente para
    // que la barra de habilidades quede utilizable.
    const localView = this.players.get(this.localId);
    if (
      localView &&
      localView.inCombat &&
      !localView.duelOpponent &&
      !this.targetWildId &&
      !this.targetId &&
      !this.companionPassive &&
      now - this.lastAutoTargetAt > 1200
    ) {
      let nearest: WildView | undefined;
      let nearestDistance = 12;
      for (const wild of this.wilds.values()) {
        if (wild.hp <= 0) {
          continue;
        }
        const distance = Math.hypot(
          wild.x - localView.x,
          wild.z - localView.z,
        );
        if (distance < nearestDistance) {
          nearest = wild;
          nearestDistance = distance;
        }
      }
      if (nearest) {
        this.lastAutoTargetAt = now;
        this.setWildTarget(nearest.id);
      }
    }
  }

  private addPlayer(player: PlayerState, id: string): void {
    const view: PlayerView = {
      attackAt: -10000, hitAt: -10000, healAt: -10000,
      partnerX: player.partnerX, partnerZ: player.partnerZ, partnerRot: player.partnerRot,
      serverPartnerX: player.partnerX, serverPartnerZ: player.partnerZ, serverPartnerRot: player.partnerRot,
      partnerMoving: player.partnerMoving,
      id,
      name: player.name,
      species: player.species,
      level: player.level,
      moving: player.moving,
      running: player.running,
      hp: player.hp,
      maxHp: player.maxHp,
      ep: player.ep,
      maxEp: player.maxEp,
      inCombat: player.inCombat,
      duelOpponent: player.duelOpponent,
      duelWins: player.duelWins,
      duelLosses: player.duelLosses,
      xp: player.xp,
      xpNext: player.xpNext,
      serverX: player.x,
      serverZ: player.z,
      serverRot: player.rot,
      x: player.x,
      z: player.z,
      rot: player.rot,
    };

    this.players.set(id, view);

    if (id === this.localId && !this.yawInitialized) {
      this.yaw = Math.atan2(Math.sin(player.rot), Math.cos(player.rot));
      this.pitch = this.cameraMode === "first-person" ? 0 : this.cameraSettings.initialPitch * Math.PI / 180;
      this.yawInitialized = true;
    }

    this.bindPlayer(player, view);
    this.emitRoster();
  }

  private bindPlayer(player: PlayerState, view: PlayerView): void {
    this.callbacks.listen(player, "partnerX", (v: number) => { view.serverPartnerX = v; });
    this.callbacks.listen(player, "partnerZ", (v: number) => { view.serverPartnerZ = v; });
    this.callbacks.listen(player, "partnerRot", (v: number) => { view.serverPartnerRot = v; });
    this.callbacks.listen(player, "partnerMoving", (v: boolean) => { view.partnerMoving = v; });
    this.callbacks.listen(player, "x", (value: number) => {
      view.serverX = value;
    });
    this.callbacks.listen(player, "z", (value: number) => {
      view.serverZ = value;
    });
    this.callbacks.listen(player, "rot", (value: number) => {
      view.serverRot = value;
    });
    this.callbacks.listen(player, "moving", (value: boolean) => {
      view.moving = value;
    });
    this.callbacks.listen(player, "running", (value: boolean) => {
      view.running = value;
    });
    this.callbacks.listen(player, "level", (value: number) => {
      view.level = value;
      this.emitRoster();
    });
    this.callbacks.listen(player, "species", (value: string) => {
      view.species = value;
      this.emitRoster();
      this.emitCombat();
    });
    this.callbacks.listen(player, "name", (value: string) => {
      view.name = value;
      this.emitRoster();
    });
    this.callbacks.listen(player, "hp", (value: number) => {
      if (value <= 0 && view.hp > 0) this.addEffect(view.id, view.id, 0, false, "defeat");
      view.hp = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "maxHp", (value: number) => {
      view.maxHp = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "ep", (value: number) => {
      view.ep = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "maxEp", (value: number) => {
      view.maxEp = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "inCombat", (value: boolean) => {
      view.inCombat = value;
      if (view.id === this.localId) {
        this.emitCombat();
      }
    });
    this.callbacks.listen(player, "duelOpponent", (value: string) => {
      view.duelOpponent = value;
      if (view.id === this.localId) {
        this.emitCombat();
      }
    });
    this.callbacks.listen(player, "duelWins", (value: number) => {
      view.duelWins = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "duelLosses", (value: number) => {
      view.duelLosses = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "xp", (value: number) => {
      view.xp = value;
      this.notifyVitals(view.id);
    });
    this.callbacks.listen(player, "xpNext", (value: number) => {
      view.xpNext = value;
      this.notifyVitals(view.id);
    });
  }

  private addWild(wild: WildState, id: string): void {
    const view: WildView = {
      attackAt: -10000, hitAt: -10000, healAt: -10000,
      isBoss:wild.isBoss,areaId:wild.areaId,state:wild.state,castEndsAt:wild.castEndsAt,
      id,
      name: wild.name,
      species: wild.species,
      level: wild.level,
      hp: wild.hp,
      maxHp: wild.maxHp,
      moving: wild.moving,
      serverX: wild.x,
      serverZ: wild.z,
      serverRot: wild.rot,
      x: wild.x,
      z: wild.z,
      rot: wild.rot,
    };
    this.wilds.set(id, view);
    this.bindWild(wild, view);
    this.emitWilds();
  }

  private bindWild(wild: WildState, view: WildView): void {
    this.callbacks.listen(wild,"state",(value:string)=>{view.state=value;this.emitCombat();});
    this.callbacks.listen(wild,"castEndsAt",(value:number)=>{view.castEndsAt=value;this.emitCombat();});
    this.callbacks.listen(wild, "x", (value: number) => {
      view.serverX = value;
    });
    this.callbacks.listen(wild, "z", (value: number) => {
      view.serverZ = value;
    });
    this.callbacks.listen(wild, "rot", (value: number) => {
      view.serverRot = value;
    });
    this.callbacks.listen(wild, "moving", (value: boolean) => {
      view.moving = value;
      this.emitWilds();
    });
    this.callbacks.listen(wild, "hp", (value: number) => {
      view.hp = value;
      if (value <= 0 && this.targetWildId === view.id) {
        this.targetWildId = null;
        this.room.send("wild_target", { wildId: "" });
        this.emitCombat();
      }
      this.emitWilds();
    });
    this.callbacks.listen(wild, "maxHp", (value: number) => {
      view.maxHp = value;
    });
    this.callbacks.listen(wild, "name", (value: string) => {
      view.name = value;
      this.emitWilds();
    });
    this.callbacks.listen(wild, "level", (value: number) => {
      view.level = value;
      this.emitWilds();
    });
    this.callbacks.listen(wild, "species", (value: string) => {
      view.species = value;
      this.emitWilds();
    });
  }

  private readInput(local: PlayerView | undefined, dt: number): MoveInput {
    if (this.inputBlocked) return {x:0, z:0, run:false, yaw:local?.rot ?? this.yaw};
    const keyForward =
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) -
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const keyRight =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);

    const steering = this.mouseRight || this.cameraMode === "first-person";
    const touch = Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0.01;
    let yaw = local?.rot ?? this.yaw;
    if (steering) yaw += angleDelta(yaw, this.yaw) * smoothFactor(20, dt);
    else if (!touch) yaw -= keyRight * 2.2 * dt;
    const forward = keyForward + this.touchMove.y + (this.mouseLeft && this.mouseRight ? 1 : 0);
    const right = (steering ? keyRight : 0) + this.touchMove.x +
      (this.keys.has("e") ? 1 : 0) - (this.keys.has("q") ? 1 : 0);
    const movementYaw = touch ? this.yaw : steering ? this.yaw : yaw;

    let x = 0;
    let z = 0;

    if (Math.abs(forward) > 0.01 || Math.abs(right) > 0.01) {
      // Movimiento relativo a la dirección de la cámara (FP y TP).
      x = forward * Math.sin(movementYaw) - right * Math.cos(movementYaw);
      z = forward * Math.cos(movementYaw) + right * Math.sin(movementYaw);
    }

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    const moving = Math.hypot(x, z) > 0.01;
    if (touch && moving) yaw = Math.atan2(x, z);

    return {
      x: moving ? x : 0,
      z: moving ? z : 0,
      run: moving && this.keys.has("shift"),
      yaw,
    };
  }

  private sendInput(input: MoveInput, now: number): void {
    const moving = input.x !== 0 || input.z !== 0;
    const signature = `${input.x.toFixed(2)}:${input.z.toFixed(2)}:${input.run}:${input.yaw.toFixed(3)}`;
    const changed = signature !== this.lastInputSignature;

    if (!moving && !changed) {
      return;
    }
    if (now - this.lastInputSentAt < INPUT_SEND_INTERVAL - 2 && !(this.inputWasMoving && !moving)) {
      return;
    }

    this.lastInputSignature = signature;
    this.inputWasMoving = moving;
    this.lastInputSentAt = now;
    this.room.send("input", {
      x: input.x,
      z: input.z,
      run: input.run,
      yaw: input.yaw,
      seq: ++this.inputSeq,
    });
  }

  private emitRoster(): void {
    for (const listener of this.rosterListeners) {
      listener();
    }
  }

  private emitCombat(): void {
    for (const listener of this.combatListeners) {
      listener();
    }
  }

  private emitWilds(): void {
    for (const listener of this.wildListeners) {
      listener();
    }
  }

  private pushFeed(entry: Omit<CombatFeedEntry, "id">): void {
    this.combatFeed.push({ ...entry, id: this.feedSequence++ });
    while (this.combatFeed.length > 7) {
      this.combatFeed.shift();
    }
  }

  private notifyVitals(id: string): void {
    if (id !== this.localId) {
      return;
    }
    const now = Date.now();
    if (now - this.lastVitalsNotifyAt < 200) {
      return;
    }
    this.lastVitalsNotifyAt = now;
    this.emitCombat();
  }

  private setError(text: string): void {
    const error: CombatError = { text, at: Date.now() };
    this.lastError = error;
    this.emitCombat();
    if (this.errorTimer) {
      clearTimeout(this.errorTimer);
    }
    this.errorTimer = setTimeout(() => {
      if (this.lastError === error) {
        this.lastError = null;
        this.emitCombat();
      }
    }, 3000);
  }

  private clearIncomingDuelTimer(): void {
    if (this.incomingDuelTimer) {
      clearTimeout(this.incomingDuelTimer);
      this.incomingDuelTimer = null;
    }
  }
}
