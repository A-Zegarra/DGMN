/** Orden estable: los identificadores y los objetivos forman parte del guardado. */
export interface PvEQuest {
  id: string;
  name: string;
  description: string;
  objective: string;
  areaId: string;
  boss: boolean;
  count: number;
  recommendedLevel: number;
  reward: {xp: number; bits: number; hpPotion: number; epPotion: number; devimonSeals: number};
}

export const PVE_QUESTS: readonly PvEQuest[] = [
  {
    id: "pradera-datos", name: "Primeros datos",
    description: "Ayuda a despejar la pradera y aprende a combatir con tu compañero.",
    objective: "Derrota 3 salvajes de la Pradera de Datos",
    areaId: "pradera", boss: false, count: 3, recommendedLevel: 1,
    reward: {xp: 100, bits: 120, hpPotion: 2, epPotion: 1, devimonSeals: 0},
  },
  {
    id: "espesura-guardianes", name: "Guardianes del bosque",
    description: "Adéntrate en la espesura. Evoluciona y equipa discos antes de salir.",
    objective: "Derrota 4 salvajes de la Espesura Digital",
    areaId: "espesura", boss: false, count: 4, recommendedLevel: 5,
    reward: {xp: 300, bits: 300, hpPotion: 3, epPotion: 2, devimonSeals: 0},
  },
  {
    id: "devimon-sombra", name: "La sombra de las ruinas",
    description: "Vence a Devimon. La participación válida en grupo también cuenta.",
    objective: "Derrota a Devimon en las Ruinas Corruptas",
    areaId: "ruinas", boss: true, count: 1, recommendedLevel: 14,
    reward: {xp: 500, bits: 800, hpPotion: 3, epPotion: 3, devimonSeals: 1},
  },
];
