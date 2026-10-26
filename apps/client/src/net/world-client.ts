import { Callbacks, Client, type Room } from "@colyseus/sdk";

import { getAbilitiesForSpecies, type Ability } from "@digiworld/content";
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
} from "@digiworld/shared/messages";
import type { PlayerState, WorldState } from "@digiworld/shared/schema";

const INPUT_SEND_INTERVAL = 50;
const LOOK_SENSITIVITY = 0.0026;
const FP_PITCH_MIN = -1.1;
const FP_PITCH_MAX = 0.85;
const TP_PITCH_MIN = -0.25;
const TP_PITCH_MAX = 0.75;

export type CameraMode = "first-person" | "third-person";

export interface PlayerView {
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

  /** Posición autoritativa del servidor. */
  serverX: number;
  serverZ: number;
  serverRot: number;

  /** Posición suavizada que se dibuja. */
  x: number;
  z: number;
  rot: number;
}

export interface DuelResult {
  won: boolean;
  opponentName: string;
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
  | "heal";

export interface CombatFeedEntry {
  id: number;
  kind: CombatFeedKind;
  amount: number;
  label: string;
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

  cameraMode: CameraMode = "third-person";
  yaw = 0;
  pitch = 0.2;

  targetId: string | null = null;
  incomingDuel: DuelRequestPayload | null = null;
  pendingDuelTargetName: string | null = null;
  duelResult: DuelResult | null = null;
  lastError: CombatError | null = null;
  readonly abilityCooldowns = new Map<string, number>();
  readonly combatFeed: CombatFeedEntry[] = [];

  onDisconnect: (() => void) | null = null;

  private readonly callbacks: ReturnType<typeof Callbacks.get<WorldState>>;
  private readonly keys = new Set<string>();
  private readonly rosterListeners = new Set<() => void>();
  private readonly chatListeners = new Set<(message: ChatMessage) => void>();
  private readonly combatListeners = new Set<() => void>();
  private incomingDuelTimer: ReturnType<typeof setTimeout> | null = null;
  private duelResultTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private feedSequence = 0;
  private lastVitalsNotifyAt = 0;

  private touchMove = { x: 0, y: 0 };
  private lastInputSignature = "";
  private lastInputSentAt = 0;
  private lastFrameAt = performance.now();
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

    room.onMessage("ability_error", (message: AbilityErrorPayload) => {
      this.setError(message.reason);
    });

    room.onLeave(() => {
      this.onDisconnect?.();
    });

    if (import.meta.env.DEV) {
      (window as unknown as { __dw?: WorldClient }).__dw = this;
    }
  }

  static async connect(
    serverUrl: string,
    name: string,
    species: string,
  ): Promise<WorldClient> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const client = new Client(serverUrl);
        const room = await client.joinOrCreate<WorldState>("world", {
          name,
          species,
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

  getAbilities(): Ability[] {
    const local = this.players.get(this.localId);
    return local ? getAbilitiesForSpecies(local.species) : [];
  }

  getCooldownRemaining(abilityId: string): number {
    return Math.max(0, (this.abilityCooldowns.get(abilityId) ?? 0) - Date.now());
  }

  useAbility(abilityId: string): void {
    this.room.send("use_ability", { abilityId });
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
    this.targetId =
      targetId && targetId !== this.localId && this.players.has(targetId)
        ? targetId
        : null;
    this.emitCombat();
  }

  cycleTarget(): void {
    const local = this.players.get(this.localId);
    if (!local) {
      return;
    }

    const others = Array.from(this.players.values())
      .filter((player) => player.id !== this.localId)
      .sort(
        (a, b) =>
          Math.hypot(a.x - local.x, a.z - local.z) -
          Math.hypot(b.x - local.x, b.z - local.z),
      );

    if (others.length === 0) {
      this.targetId = null;
      this.emitCombat();
      return;
    }

    const currentIndex = others.findIndex(
      (player) => player.id === this.targetId,
    );
    const next = others[(currentIndex + 1) % others.length] ?? others[0]!;
    this.targetId = next.id;
    this.emitCombat();
  }

  clearTarget(): void {
    this.targetId = null;
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
    this.pitch = this.cameraMode === "first-person" ? 0 : 0.2;
    this.touchMove = { x: 0, y: 0 };
    this.emitRoster();
    return this.cameraMode;
  }

  /** Delta del ratón o del dedo, en píxeles. */
  addLook(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * LOOK_SENSITIVITY;

    if (this.cameraMode === "first-person") {
      this.pitch = clamp(
        this.pitch - deltaY * LOOK_SENSITIVITY * 0.85,
        FP_PITCH_MIN,
        FP_PITCH_MAX,
      );
      return;
    }

    this.pitch = clamp(
      this.pitch + deltaY * LOOK_SENSITIVITY * 0.7,
      TP_PITCH_MIN,
      TP_PITCH_MAX,
    );
  }

  /** Joystick táctil: x = derecha, y = adelante. */
  setTouchMove(x: number, y: number): void {
    this.touchMove = {
      x: clamp(x, -1, 1),
      y: clamp(y, -1, 1),
    };
  }

  setKey(key: string, pressed: boolean): void {
    const normalized = key.toLowerCase();
    if (pressed) {
      this.keys.add(normalized);
    } else {
      this.keys.delete(normalized);
    }
  }

  clearKeys(): void {
    this.keys.clear();
  }

  /** Se llama una vez por frame dentro del Canvas. */
  update(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameAt) / 1000, 0.1);
    this.lastFrameAt = now;

    const local = this.players.get(this.localId);
    const input = this.readInput(local);

    this.sendInput(input, now);

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
    for (const [id, view] of this.players) {
      if (id === this.localId) {
        continue;
      }
      view.x += (view.serverX - view.x) * smoothing;
      view.z += (view.serverZ - view.z) * smoothing;
      view.rot = lerpAngle(view.rot, view.serverRot, smoothing);
    }
  }

  private addPlayer(player: PlayerState, id: string): void {
    const view: PlayerView = {
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
      this.pitch = this.cameraMode === "first-person" ? 0 : 0.2;
      this.yawInitialized = true;
    }

    this.bindPlayer(player, view);
    this.emitRoster();
  }

  private bindPlayer(player: PlayerState, view: PlayerView): void {
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
    this.callbacks.listen(player, "name", (value: string) => {
      view.name = value;
      this.emitRoster();
    });
    this.callbacks.listen(player, "hp", (value: number) => {
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
  }

  private readInput(local: PlayerView | undefined): MoveInput {
    const keyForward =
      (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) -
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const keyRight =
      (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);

    const forward = keyForward + this.touchMove.y;
    const right = keyRight + this.touchMove.x;

    let x = 0;
    let z = 0;

    if (Math.abs(forward) > 0.01 || Math.abs(right) > 0.01) {
      // Movimiento relativo a la dirección de la cámara (FP y TP).
      x = forward * Math.sin(this.yaw) - right * Math.cos(this.yaw);
      z = forward * Math.cos(this.yaw) + right * Math.sin(this.yaw);
    }

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    const moving = Math.hypot(x, z) > 0.01;
    let yaw = this.yaw;
    if (this.cameraMode === "third-person") {
      yaw = moving ? Math.atan2(x, z) : (local?.rot ?? this.yaw);
    }

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
    if (!changed && now - this.lastInputSentAt < INPUT_SEND_INTERVAL) {
      return;
    }

    this.lastInputSignature = signature;
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
