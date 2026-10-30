import { SPECIES } from "./species";

export const AGUMON_LINE = ["koromon", "agumon", "greymon", "metalgreymon", "wargreymon"] as const;
export const EVOLUTION_DURATION_MS = 3000;

/** Misma fórmula al iniciar, subir nivel y evolucionar: no acumula bonos duplicados. */
export function companionVitals(speciesId: string, level: number) {
  const stats = SPECIES[speciesId]?.stats ?? SPECIES.koromon!.stats;
  const bonus = Math.max(0, level - 1);
  return { maxHp: stats.hp + bonus * 8, maxEp: stats.ep + bonus * 3 };
}
