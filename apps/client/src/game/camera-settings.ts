export interface CameraSettings {
  sensitivityX: number;
  sensitivityY: number;
  invertY: boolean;
  minDistance: number;
  maxDistance: number;
  distance: number;
  zoomSpeed: number;
  fov: number;
  focusRatio: number;
  initialPitch: number;
  follow: boolean;
  mode: "classic" | "follow" | "combat";
  targetLock: boolean;
}

export const CAMERA_DEFAULTS: CameraSettings = {
  sensitivityX: 0.0026, sensitivityY: 0.0026, invertY: false,
  minDistance: 3, maxDistance: 24, distance: 9, zoomSpeed: 1,
  fov: 58, focusRatio: 0.65, initialPitch: 38, follow: true,
  mode: "classic", targetLock: false,
};
const KEY = "digiworld:camera:v2";
export function validateCameraSettings(value: Partial<CameraSettings>): CameraSettings {
  const result = { ...CAMERA_DEFAULTS };
  const ranges = {
    sensitivityX: [0.0005, 0.01], sensitivityY: [0.0005, 0.01],
    minDistance: [0.5, 3], maxDistance: [6, 40], distance: [0.5, 40],
    zoomSpeed: [0.2, 3], fov: [40, 90], focusRatio: [0.3, 0.9], initialPitch: [20, 65],
  } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const v = value[key];
    const [min, max] = ranges[key];
    if (typeof v === "number" && Number.isFinite(v)) result[key] = Math.max(min, Math.min(max, v));
  }
  result.distance = Math.max(result.minDistance, Math.min(result.maxDistance, result.distance));
  for (const key of ["invertY", "follow", "targetLock"] as const) {
    if (typeof value[key] === "boolean") result[key] = value[key];
  }
  if (["classic", "follow", "combat"].includes(value.mode ?? "")) result.mode = value.mode!;
  return result;
}
export function loadCameraSettings(): CameraSettings {
  try { return validateCameraSettings(JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}); }
  catch { return { ...CAMERA_DEFAULTS }; }
}
export function saveCameraSettings(settings: CameraSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* Almacenamiento no disponible. */ }
}

export const smoothFactor = (speed: number, dt: number) => 1 - Math.exp(-speed * Math.min(dt, 0.1));
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function cameraFraming(height: number, width: number, settings: CameraSettings) {
  const size = Math.max(1.8, height, width * 0.8);
  return {
    focus: Math.max(1.8 * settings.focusRatio, height * settings.focusRatio),
    distance: Math.min(settings.maxDistance, Math.max(settings.minDistance, settings.distance * Math.max(1, size / 2.4))),
  };
}
