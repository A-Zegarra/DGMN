export interface Zone {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  halfSize: number;
  groundColor: string;
  fogColor: string;
}

export const ZONES: Record<string, Zone> = {
  "bosque-digital": {
    id: "bosque-digital",
    name: "Bosque Digital",
    subtitle: "Zona inicial · Archipiélago de File",
    description:
      "Un claro rodeado de árboles de datos. Aquí comienzan los nuevos domadores.",
    halfSize: 58,
    groundColor: "#a7c9b4",
    fogColor: "#a7c9b4",
  },
};

export const DEFAULT_ZONE_ID = "bosque-digital";

export function getZone(id: string): Zone {
  return ZONES[id] ?? ZONES[DEFAULT_ZONE_ID];
}
