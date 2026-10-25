import type { Client, CloseCode } from "colyseus";
import { Room } from "colyseus";

import { DEFAULT_ZONE_ID, getStarter, STARTER_IDS } from "@digiworld/content";
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
import type { ChatMessage, InputMessage } from "@digiworld/shared/messages";
import { PlayerState, WorldState } from "@digiworld/shared/schema";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  };

  onJoin(client: Client, options?: { name?: string; species?: string }) {
    const requested = options?.species ? getStarter(options.species) : undefined;
    const speciesId = requested?.id ?? STARTER_IDS[0];

    const player = new PlayerState();
    player.name = sanitizeName(options?.name, client.sessionId);
    player.species = speciesId;
    player.level = 1;

    const angle = Math.random() * Math.PI * 2;
    const radius =
      SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    player.x = Math.cos(angle) * radius;
    player.z = Math.sin(angle) * radius;
    player.rot = angle + Math.PI;
    player.lastInputAt = Date.now();

    this.state.players.set(client.sessionId, player);

    console.log(
      `[world] ${player.name} (${player.species}) entró a ${this.state.zone}`,
    );
    this.systemChat(`${player.name} entró al Bosque Digital.`);
  }

  onLeave(client: Client, _code: CloseCode) {
    const player = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);

    if (player) {
      console.log(`[world] ${player.name} salió`);
      this.systemChat(`${player.name} salió del Bosque Digital.`);
    }
  }

  onDispose() {
    console.log(`[world] sala destruida: ${this.roomId}`);
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

  private update(deltaMs: number) {
    const dt = Math.min(deltaMs, 100) / 1000;
    const now = Date.now();

    for (const player of this.state.players.values()) {
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
        player.rot = Math.atan2(inputX, inputZ);
        player.moving = true;
        player.running = player.inputRunning;
      } else if (player.moving) {
        player.moving = false;
        player.running = false;
      }
    }
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
}
