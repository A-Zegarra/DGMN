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
    moving: t.boolean().default(false),
    running: t.boolean().default(false),
    level: t.uint8().default(1),

    inputX: t.number().noSync().default(0),
    inputZ: t.number().noSync().default(0),
    inputRunning: t.boolean().noSync().default(false),
    lastInputAt: t.number().noSync().default(0),
    lastYawAt: t.number().noSync().default(0),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;

/** Estado completo de la sala del mundo. */
export const WorldState = schema(
  {
    zone: t.string().default("bosque-digital"),
    players: t.map(PlayerState),
  },
  "WorldState",
);
export type WorldState = SchemaType<typeof WorldState>;
