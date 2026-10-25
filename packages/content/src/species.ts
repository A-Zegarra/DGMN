export type DigiStage =
  | "rookie"
  | "champion"
  | "ultimate"
  | "mega"
  | "salvaje"
  | "jefe";

export type DigiAttribute = "vaccine" | "data" | "virus" | "free";

export type DigiElement =
  | "fuego"
  | "hielo"
  | "luz"
  | "oscuridad"
  | "naturaleza"
  | "trueno";

export interface DigiStats {
  hp: number;
  ep: number;
  atk: number;
  def: number;
  spd: number;
}

export interface EvolutionRequirement {
  id: string;
  level: number;
  affinity?: number;
}

export interface Species {
  id: string;
  name: string;
  stage: DigiStage;
  stageLabel: string;
  attribute: DigiAttribute;
  attributeLabel: string;
  element: DigiElement;
  elementLabel: string;
  /** Color principal del modelo provisional. */
  color: string;
  /** Color secundario (detalles). */
  accent: string;
  /** Escala visual del modelo. */
  scale: number;
  description: string;
  stats: DigiStats;
  evolvesTo: EvolutionRequirement[];
}

export const SPECIES: Record<string, Species> = {
  agumon: {
    id: "agumon",
    name: "Agumon",
    stage: "rookie",
    stageLabel: "Rookie",
    attribute: "vaccine",
    attributeLabel: "Vacuna",
    element: "fuego",
    elementLabel: "Fuego",
    color: "#f59e0b",
    accent: "#fde68a",
    scale: 1,
    description:
      "Dinosaurio pequeño de carácter curioso. Su aliento ardiente es su primera arma.",
    stats: { hp: 120, ep: 40, atk: 28, def: 18, spd: 22 },
    evolvesTo: [{ id: "greymon", level: 8 }],
  },
  greymon: {
    id: "greymon",
    name: "Greymon",
    stage: "champion",
    stageLabel: "Champion",
    attribute: "vaccine",
    attributeLabel: "Vacuna",
    element: "fuego",
    elementLabel: "Fuego",
    color: "#d97706",
    accent: "#fbbf24",
    scale: 1.35,
    description:
      "Dinosaurio de casco córneo y cola poderosa. Su Mega Flame arrasa la línea defensiva.",
    stats: { hp: 260, ep: 70, atk: 58, def: 42, spd: 30 },
    evolvesTo: [],
  },
  gabumon: {
    id: "gabumon",
    name: "Gabumon",
    stage: "rookie",
    stageLabel: "Rookie",
    attribute: "data",
    attributeLabel: "Datos",
    element: "hielo",
    elementLabel: "Hielo",
    color: "#3b82f6",
    accent: "#bfdbfe",
    scale: 1,
    description:
      "Criatura tímida cubierta con una piel de datos. Dispara proyectiles azules a distancia.",
    stats: { hp: 115, ep: 45, atk: 24, def: 22, spd: 24 },
    evolvesTo: [{ id: "garurumon", level: 8 }],
  },
  garurumon: {
    id: "garurumon",
    name: "Garurumon",
    stage: "champion",
    stageLabel: "Champion",
    attribute: "data",
    attributeLabel: "Datos",
    element: "hielo",
    elementLabel: "Hielo",
    color: "#60a5fa",
    accent: "#e0f2fe",
    scale: 1.3,
    description:
      "Lobo veloz de pelaje blanco y azul. Congela el terreno con su aliento glacial.",
    stats: { hp: 240, ep: 60, atk: 52, def: 38, spd: 40 },
    evolvesTo: [],
  },
  patamon: {
    id: "patamon",
    name: "Patamon",
    stage: "rookie",
    stageLabel: "Rookie",
    attribute: "data",
    attributeLabel: "Datos",
    element: "luz",
    elementLabel: "Luz",
    color: "#fcd34d",
    accent: "#fff7ed",
    scale: 0.85,
    description:
      "Pequeño digimon con alas en la cabeza. Su energía luminosa cura y protege.",
    stats: { hp: 90, ep: 50, atk: 18, def: 16, spd: 28 },
    evolvesTo: [{ id: "angemon", level: 8 }],
  },
  angemon: {
    id: "angemon",
    name: "Angemon",
    stage: "champion",
    stageLabel: "Champion",
    attribute: "data",
    attributeLabel: "Datos",
    element: "luz",
    elementLabel: "Luz",
    color: "#e5e7eb",
    accent: "#fbbf24",
    scale: 1.2,
    description:
      "Ángel de seis alas y bastón sagrado. Su luz purifica a los enemigos oscuros.",
    stats: { hp: 210, ep: 80, atk: 48, def: 36, spd: 36 },
    evolvesTo: [],
  },
  koromon: {
    id: "koromon",
    name: "Koromon",
    stage: "salvaje",
    stageLabel: "Salvaje",
    attribute: "vaccine",
    attributeLabel: "Vacuna",
    element: "fuego",
    elementLabel: "Fuego",
    color: "#fb7185",
    accent: "#fecdd3",
    scale: 0.55,
    description:
      "Cabeza redonda y saltarina. Aparece en claros del bosque buscando comida.",
    stats: { hp: 40, ep: 10, atk: 8, def: 6, spd: 10 },
    evolvesTo: [{ id: "agumon", level: 5, affinity: 10 }],
  },
  pagumon: {
    id: "pagumon",
    name: "Pagumon",
    stage: "salvaje",
    stageLabel: "Salvaje",
    attribute: "virus",
    attributeLabel: "Virus",
    element: "oscuridad",
    elementLabel: "Oscuridad",
    color: "#a78bfa",
    accent: "#ddd6fe",
    scale: 0.55,
    description:
      "Criatura traviesa de orejas grandes. Se esconde entre la maleza y muerde si la acorralan.",
    stats: { hp: 45, ep: 15, atk: 7, def: 8, spd: 12 },
    evolvesTo: [],
  },
  gazimon: {
    id: "gazimon",
    name: "Gazimon",
    stage: "salvaje",
    stageLabel: "Salvaje",
    attribute: "virus",
    attributeLabel: "Virus",
    element: "trueno",
    elementLabel: "Trueno",
    color: "#64748b",
    accent: "#cbd5e1",
    scale: 0.95,
    description:
      "Mamífero de garras afiladas que defiende su territorio con descargas eléctricas.",
    stats: { hp: 70, ep: 20, atk: 16, def: 10, spd: 18 },
    evolvesTo: [],
  },
  devimon: {
    id: "devimon",
    name: "Devimon",
    stage: "jefe",
    stageLabel: "Jefe",
    attribute: "virus",
    attributeLabel: "Virus",
    element: "oscuridad",
    elementLabel: "Oscuridad",
    color: "#1e293b",
    accent: "#7f1d1d",
    scale: 1.45,
    description:
      "Ángel caído que corrompe el Bosque Digital. Guarda el primer fragmento del sello.",
    stats: { hp: 420, ep: 120, atk: 70, def: 55, spd: 38 },
    evolvesTo: [],
  },
};

export const STARTER_IDS = ["agumon", "gabumon", "patamon"] as const;
export type StarterId = (typeof STARTER_IDS)[number];

export const WILD_IDS = ["koromon", "pagumon", "gazimon"] as const;

export const BOSS_ID = "devimon";

export function getSpecies(id: string): Species | undefined {
  return SPECIES[id];
}

export function getStarter(id: string): Species | undefined {
  return STARTER_IDS.includes(id as StarterId) ? SPECIES[id] : undefined;
}

export function isStarter(id: string): id is StarterId {
  return STARTER_IDS.includes(id as StarterId);
}

export function getEvolutionTargets(id: string): Species[] {
  return (SPECIES[id]?.evolvesTo ?? [])
    .map((requirement) => SPECIES[requirement.id])
    .filter((species): species is Species => Boolean(species));
}
