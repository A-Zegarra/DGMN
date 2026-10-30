import { schema, t, type SchemaType } from "@colyseus/schema";

/**
 * Estado sincronizado de un jugador.
 *
 * Los campos con `.noSync()` viven solo en el servidor: reciben la intención
 * de movimiento del cliente y nunca se envían por la red.
 */
export const PlayerState = schema(
  {
    name: t.string().default("Digi"),
    species: t.string().default("agumon"),
    x: t.number().default(0),
    z: t.number().default(0),
    rot: t.number().default(0),
    /** Posición del compañero combatiente (x/z siguen siendo del domador). */
    partnerX: t.number().default(0),
    partnerZ: t.number().default(0),
    partnerRot: t.number().default(0),
    partnerMoving: t.boolean().default(false),
    moving: t.boolean().default(false),
    running: t.boolean().default(false),
    level: t.uint8().default(1),

    /** Vida y energía pertenecen al Digimon; el domador no recibe daño. */
    hp: t.number().default(100),
    maxHp: t.number().default(100),
    ep: t.number().default(100),
    maxEp: t.number().default(100),
    inCombat: t.boolean().default(false),
    duelOpponent: t.string().default(""),
    duelWins: t.uint16().default(0),
    duelLosses: t.uint16().default(0),
    xp: t.uint32().default(0),
    xpNext: t.uint32().default(100),

    inputX: t.number().noSync().default(0),
    inputZ: t.number().noSync().default(0),
    inputRunning: t.boolean().noSync().default(false),
    lastInputAt: t.number().noSync().default(0),
    lastYawAt: t.number().noSync().default(0),
    respawnAt: t.number().noSync().default(0),
    evolutionReadyAt: t.number().noSync().default(0),
    hpPotion: t.uint16().noSync().default(3),
    epPotion: t.uint16().noSync().default(2),
    bits: t.uint32().noSync().default(0),
    devimonSeals: t.uint16().noSync().default(0),
    itemReadyAt: t.number().noSync().default(0),
    partnerPassive: t.boolean().noSync().default(false),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

/** Digimon salvaje controlado por el servidor. */
export const WildState = schema(
  {
    name: t.string().default("Digimon salvaje"),
    species: t.string().default("agumon"),
    level: t.uint8().default(1),
    x: t.number().default(0),
    z: t.number().default(0),
    rot: t.number().default(0),
    moving: t.boolean().default(false),
    hp: t.number().default(60),
    maxHp: t.number().default(60),
    state: t.string().default("idle"),
    isBoss: t.boolean().default(false),
    areaId: t.string().default("pradera"),
    castEndsAt: t.number().default(0),

    homeX: t.number().noSync().default(0),
    homeZ: t.number().noSync().default(0),
    wanderX: t.number().noSync().default(0),
    wanderZ: t.number().noSync().default(0),
    nextWanderAt: t.number().noSync().default(0),
    lastAttackAt: t.number().noSync().default(0),
    respawnAt: t.number().noSync().default(0),
    targetId: t.string().noSync().default(""),
    aggroCooldownUntil: t.number().noSync().default(0),
    nextSpecialAt: t.number().noSync().default(0),
  },
  "WildState",
);
export type WildState = SchemaType<typeof WildState>;

/** Estado completo de la sala del mundo. */
export const WorldState = schema(
  {
    zone: t.string().default("bosque-digital"),
    players: t.map(PlayerState),
    wilds: t.map(WildState),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
