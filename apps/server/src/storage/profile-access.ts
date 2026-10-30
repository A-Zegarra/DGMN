import { createHash, randomBytes } from "node:crypto";
import type { ProfileImportRequest, SavedProfileSummary } from "@digiworld/shared/messages";
import { getProfileStore, profileKey, type ProfileStore } from "./profile-store";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LINK_TTL_MS = 5 * 60 * 1000;
const ACTION_INTERVAL_MS = 5000;
export class ProfileAccessError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function normalize(code: unknown, length: number): string {
  if (typeof code !== "string" || code.length > 100) throw new ProfileAccessError("Código inválido, usado o caducado.");
  const clean = code.toUpperCase().replace(/[\s-]/g, "");
  if (clean.length !== length || !/^[0-9A-HJKMNP-TV-Z]+$/.test(clean)) throw new ProfileAccessError("Código inválido, usado o caducado.");
  return clean;
}
export function accessHash(kind: "link" | "recovery", code: string): string {
  return createHash("sha256").update(`${kind}:${code}`).digest("hex");
}
function generate(length: number): string {
  return [...randomBytes(length)].map(value => ALPHABET[value & 31]).join("");
}
const display = (code: string) => code.match(/.{1,4}/g)!.join("-");

interface Link {key: string; revision: number; until: number;}
interface Grant extends Link {credential: string; result: Promise<SavedProfileSummary>;}

/** Códigos de enlace solo en memoria; claves de recuperación únicamente hasheadas. */
export class ProfileAccess {
  private links = new Map<string, Link>();
  private grants = new Map<string, Grant>();
  private recent = new Map<string, number>();
  constructor(readonly store: ProfileStore, private now = () => Date.now()) {}

  private cleanup() {
    const now = this.now();
    for (const [hash, entry] of this.links) if (entry.until <= now) this.links.delete(hash);
    for (const [hash, entry] of this.grants) if (entry.until <= now) this.grants.delete(hash);
    for (const [key, at] of this.recent) if (now - at >= 60000) this.recent.delete(key);
  }
  allowAction(key: string) {
    this.cleanup();
    const at = this.recent.get(key);
    if (at !== undefined && this.now() - at < ACTION_INTERVAL_MS) throw new ProfileAccessError("Espera 5 segundos antes de otra acción de acceso.", 429);
    if (this.recent.size >= 4096 && at === undefined) throw new ProfileAccessError("Demasiadas solicitudes. Vuelve a intentarlo más tarde.", 429);
    this.recent.set(key, this.now());
  }
  issueLink(key: string, owner: string): {code: string; expiresAt: number} {
    this.cleanup();
    const revision = this.store.ownedRevision(key, owner);
    this.cancelLink(key);
    if (this.links.size >= 4096) throw new ProfileAccessError("Demasiadas solicitudes. Vuelve a intentarlo más tarde.", 429);
    let code: string, hash: string;
    do {code = generate(16); hash = accessHash("link",code);} while (this.links.has(hash) || this.grants.has(hash));
    const expiresAt = this.now() + LINK_TTL_MS;
    this.links.set(hash, {key,revision,until:expiresAt});
    return {code:display(code),expiresAt};
  }
  cancelLink(key: string) {
    for (const [hash, entry] of this.links) if (entry.key === key) this.links.delete(hash);
  }
  async issueRecovery(key: string, owner: string): Promise<string> {
    const code = generate(32);
    await this.store.setRecovery(key, owner, accessHash("recovery",code));
    return display(code);
  }
  async revokeOthers(key: string, owner: string): Promise<number> {
    const count = await this.store.revokeOtherDevices(key,owner);
    this.cancelLink(key);
    for (const [hash, grant] of this.grants) if (grant.key === key) this.grants.delete(hash);
    return count;
  }
  async redeem(request: ProfileImportRequest): Promise<SavedProfileSummary> {
    this.cleanup();
    try { profileKey(request?.token); profileKey(request?.previousToken); }
    catch { throw new ProfileAccessError("Solicitud de acceso inválida."); }
    if (request.mode === "resume") {
      const summary = this.store.linkedSummary(request.token,request.previousToken);
      if (!summary) throw new ProfileAccessError("No hay una vinculación pendiente confirmada.");
      return summary;
    }
    if (request.mode !== "link" && request.mode !== "recovery") throw new ProfileAccessError("Solicitud de acceso inválida.");
    const code = normalize(request.code, request.mode === "link" ? 16 : 32);
    const hash = accessHash(request.mode,code);
    const existing = this.grants.get(hash);
    if (existing) {
      if (existing.credential !== profileKey(request.token) || existing.revision !== this.store.accessRevision(existing.key)) {
        throw new ProfileAccessError("Código inválido, usado o caducado.");
      }
      return existing.result;
    }
    const key = request.mode === "link" ? this.links.get(hash)?.key : this.store.recoveryKey(hash);
    const revision = request.mode === "link" ? this.links.get(hash)?.revision : key ? this.store.accessRevision(key) : undefined;
    if (!key || revision === undefined) throw new ProfileAccessError("Código inválido, usado o caducado.");
    if (this.grants.size >= 4096) throw new ProfileAccessError("Demasiadas solicitudes. Vuelve a intentarlo más tarde.", 429);
    const result = this.store.linkCredential(key,request.token,request.previousToken,revision,request.mode === "recovery" ? hash : undefined);
    const grant = {key,revision,until:this.now()+LINK_TTL_MS,credential:profileKey(request.token),result};
    this.grants.set(hash,grant);
    try {
      const summary = await result;
      this.links.delete(hash);
      return summary;
    } catch (error) {
      if (this.grants.get(hash) === grant) this.grants.delete(hash);
      throw error;
    }
  }
}

let access: ProfileAccess | undefined;
export function getProfileAccess() { return access ??= new ProfileAccess(getProfileStore()); }
