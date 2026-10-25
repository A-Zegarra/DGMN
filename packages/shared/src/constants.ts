/** Frecuencia de simulación del servidor (Hz). */
export const TICK_RATE = 20;

/** Frecuencia de envío de parches de estado (Hz). */
export const PATCH_RATE = 15;

export const WALK_SPEED = 4.2;
export const RUN_SPEED = 7.0;

/** Mitad del lado del mapa jugable, en metros. */
export const WORLD_HALF = 58;

export const MAX_PLAYERS = 30;

export const CHAT_MAX_LENGTH = 140;
export const MAX_NAME_LENGTH = 16;

/** Si el servidor no recibe input en este tiempo, detiene al jugador. */
export const INPUT_TIMEOUT_MS = 250;

export const SPAWN_RADIUS_MIN = 4;
export const SPAWN_RADIUS_MAX = 10;

export const SERVER_TICK_MS = 1000 / TICK_RATE;
export const PATCH_INTERVAL_MS = 1000 / PATCH_RATE;
