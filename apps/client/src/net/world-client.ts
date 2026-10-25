import { Callbacks, Client, type Room } from "@colyseus/sdk";

import { RUN_SPEED, WALK_SPEED, WORLD_HALF } from "@digiworld/shared/constants";
import type { ChatMessage } from "@digiworld/shared/messages";
import type { PlayerState, WorldState } from "@digiworld/shared/schema";

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
]);

const INPUT_SEND_INTERVAL = 50;
const LOOK_SENSITIVITY = 0.0026;
const PITCH_MIN = -1.1;
const PITCH_MAX = 0.85;

export type CameraMode = "first-person" | "isometric";

export interface PlayerView {
  id: string;
  name: string;
  species: string;
  level: number;
  moving: boolean;
  running: boolean;

  /** Posición autoritativa del servidor. */
  serverX: number;
  serverZ: number;
  serverRot: number;

  /** Posición suavizada que se dibuja. */
  x: number;
  z: number;
  rot: number;
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

  cameraMode: CameraMode = "first-person";
  yaw = 0;
  pitch = 0;

  onDisconnect: (() => void) | null = null;

  private readonly callbacks: ReturnType<typeof Callbacks.get<WorldState>>;
  private readonly keys = new Set<string>();
  private readonly rosterListeners = new Set<() => void>();
  private readonly chatListeners = new Set<(message: ChatMessage) => void>();

  private moveTarget: { x: number; z: number } | null = null;
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
      this.emitRoster();
    });

    room.onMessage("chat", (message: ChatMessage) => {
      for (const listener of this.chatListeners) {
        listener(message);
      }
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

  toggleCameraMode(): CameraMode {
    this.cameraMode =
      this.cameraMode === "first-person" ? "isometric" : "first-person";

    if (this.cameraMode === "first-person") {
      const local = this.players.get(this.localId);
      this.yaw = local
        ? Math.atan2(Math.sin(local.rot), Math.cos(local.rot))
        : this.yaw;
      this.pitch = 0;
      this.moveTarget = null;
    } else {
      this.pitch = 0;
    }

    this.touchMove = { x: 0, y: 0 };
    this.emitRoster();
    return this.cameraMode;
  }

  /** Delta del ratón o del dedo, en píxeles. */
  addLook(deltaX: number, deltaY: number): void {
    if (this.cameraMode !== "first-person") {
      return;
    }
    this.yaw -= deltaX * LOOK_SENSITIVITY;
    this.pitch = clamp(
      this.pitch - deltaY * LOOK_SENSITIVITY * 0.85,
      PITCH_MIN,
      PITCH_MAX,
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
      if (MOVEMENT_KEYS.has(normalized)) {
        this.moveTarget = null;
      }
    } else {
      this.keys.delete(normalized);
    }
  }

  clearKeys(): void {
    this.keys.clear();
  }

  setMoveTarget(x: number, z: number): void {
    if (this.cameraMode !== "isometric") {
      return;
    }
    this.keys.clear();
    this.moveTarget = {
      x: clamp(x, -WORLD_HALF + 1, WORLD_HALF - 1),
      z: clamp(z, -WORLD_HALF + 1, WORLD_HALF - 1),
    };
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
        if (this.cameraMode === "isometric") {
          local.rot = local.serverRot;
        }
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
      this.pitch = 0;
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
      if (this.cameraMode === "first-person") {
        // Movimiento relativo a la dirección de la cámara.
        x = forward * Math.sin(this.yaw) - right * Math.cos(this.yaw);
        z = forward * Math.cos(this.yaw) + right * Math.sin(this.yaw);
      } else {
        // Base fija de la cámara isométrica (+x, +z).
        const inv = Math.SQRT1_2;
        x = (right - forward) * inv;
        z = (-right - forward) * inv;
      }
    } else if (this.moveTarget && local) {
      const dx = this.moveTarget.x - local.x;
      const dz = this.moveTarget.z - local.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.35) {
        this.moveTarget = null;
      } else {
        x = dx / distance;
        z = dz / distance;
      }
    }

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    const moving = Math.hypot(x, z) > 0.01;
    let yaw = this.yaw;
    if (this.cameraMode === "isometric") {
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
}
