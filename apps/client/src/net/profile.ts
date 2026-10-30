import { SPECIES } from "@digiworld/content";
import type { SavedProfileSummary } from "@digiworld/shared/messages";

const TOKEN_KEY = "digiworld:profile-token:v1";
const SUMMARY_KEY = "digiworld:saved-profile:v1";

export function createProfileToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

/** Clave privada tipo bearer. No se incluye en el estado público ni en el chat. */
export function getProfileToken(): string {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("invalid");
      return token;
    }
    const next = createProfileToken();
    localStorage.setItem(TOKEN_KEY, next);
    return next;
  } catch {
    throw new Error("Permite el almacenamiento del navegador para conservar la clave de tu partida. No borres los datos del sitio.");
  }
}

export function getSavedProfile(): SavedProfileSummary | null {
  try {
    const data = JSON.parse(localStorage.getItem(SUMMARY_KEY) ?? "null");
    if (!localStorage.getItem(TOKEN_KEY) || !data || typeof data.name !== "string" ||
      !Object.hasOwn(SPECIES, data.species) || !Number.isInteger(data.level) || data.level < 1 || data.level > 20) return null;
    return data as SavedProfileSummary; // Es solo un resumen visual; el servidor nunca lo acepta como progreso.
  } catch { return null; }
}

export function rememberProfile(profile: SavedProfileSummary): void {
  try { localStorage.setItem(SUMMARY_KEY, JSON.stringify(profile)); }
  catch { /* El guardado en servidor sigue intacto. */ }
}

export function applyImportedProfile(token: string, profile: SavedProfileSummary): void {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Acceso recibido inválido.");
  localStorage.setItem(TOKEN_KEY,token);
  localStorage.setItem(SUMMARY_KEY,JSON.stringify(profile));
  try {localStorage.setItem("digiworld:name",profile.name);} catch { /* No es parte de la credencial. */ }
}
