import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { SPECIES, companionVitals } from "@digiworld/content";
import { INVENTORY_LIMIT, BITS_LIMIT, PVE_QUESTS } from "@digiworld/content";
import type { InventoryData, QuestJournalData, SavedProfileSummary } from "@digiworld/shared/messages";

interface AccessData {
  aliases: Record<string, string>;
  recovery: Record<string, string>;
  revoked: Record<string, string>;
  revisions: Record<string, number>;
}
const emptyAccess = (): AccessData => ({aliases: {}, recovery: {}, revoked: {}, revisions: {}});
const isHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export class ProfileAccessConflict extends Error {}
export class ProfileClaimError extends Error {}
export function profileSummary(p: StoredProfile): SavedProfileSummary {
  return {name:p.name,species:p.species,level:p.level,xp:p.xp,xpNext:p.xpNext,
    duelWins:p.duelWins,duelLosses:p.duelLosses,updatedAt:p.updatedAt};
}

export interface StoredProfile {
  name: string;
  species: string;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  ep: number;
  x: number;
  z: number;
  rot: number;
  partnerX: number;
  partnerZ: number;
  partnerRot: number;
  duelWins: number;
  duelLosses: number;
  updatedAt: number;
  cooldowns?: Record<string, number>;
  lastAbilityAt?: number;
  transformUntil?: number;
  inventory?: InventoryData;
  itemReadyAt?: number;
  quests?: QuestJournalData;
}

export function profileKey(token: unknown): string {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    throw new ProfileClaimError("Clave de partida inválida.");
  }
  return createHash("sha256").update(token).digest("hex");
}

function validate(value: unknown): asserts value is StoredProfile {
  if (!value || typeof value !== "object") throw new Error("Perfil de disco inválido.");
  const p = value as StoredProfile;
  if (typeof p.name !== "string" || p.name.length < 1 || p.name.length > 16 ||
      typeof p.species !== "string" || !Object.hasOwn(SPECIES, p.species) ||
      !Number.isInteger(p.level) || p.level < 1 || p.level > 20) throw new Error("Perfil de disco inválido.");
  const keys = ["xp", "xpNext", "hp", "ep", "x", "z", "rot", "partnerX", "partnerZ", "partnerRot", "duelWins", "duelLosses", "updatedAt"] as const;
  if (keys.some(k => typeof p[k] !== "number" || !Number.isFinite(p[k]))) throw new Error("Valores de perfil inválidos.");
  if (p.cooldowns && (typeof p.cooldowns !== "object" || Array.isArray(p.cooldowns) ||
      Object.values(p.cooldowns).some(v => !Number.isFinite(v) || v < 0))) throw new Error("Recargas inválidas.");
  if ([p.lastAbilityAt, p.transformUntil, p.itemReadyAt].some(v => v !== undefined && (!Number.isFinite(v) || v < 0))) throw new Error("Temporizador inválido.");
  if (p.inventory !== undefined) {
    if (!p.inventory || typeof p.inventory !== "object" ||
      ["hpPotion", "epPotion", "devimonSeals", "bits"].some(key => {
        const value = p.inventory![key as keyof InventoryData];
        return !Number.isInteger(value) || value < 0 || value > (key === "bits" ? BITS_LIMIT : INVENTORY_LIMIT);
      })) throw new Error("Inventario inválido.");
  }
  if (p.quests !== undefined) {
    const q = p.quests;
    if (!q || typeof q !== "object" || !Array.isArray(q.completed) ||
        q.completed.length > PVE_QUESTS.length ||
        q.completed.some((id, i) => id !== PVE_QUESTS[i]?.id) ||
        !Number.isInteger(q.kills) || q.kills < 0 ||
        q.kills > (PVE_QUESTS[q.completed.length]?.count ?? 0)) {
      throw new Error("Misiones de perfil inválidas.");
    }
  }
  const vitals = companionVitals(p.species, p.level);
  if (!Number.isSafeInteger(p.xp) || p.xp < 0 || !Number.isSafeInteger(p.xpNext) || p.xpNext < 1 ||
      p.hp < 0 || p.hp > vitals.maxHp || p.ep < 0 || p.ep > vitals.maxEp ||
      !Number.isInteger(p.duelWins) || p.duelWins < 0 || p.duelWins > 65535 ||
      !Number.isInteger(p.duelLosses) || p.duelLosses < 0 || p.duelLosses > 65535 || p.updatedAt < 0) {
    throw new Error("Progreso de perfil inválido.");
  }
}

/** Un único escritor por proceso. Los tokens nunca se guardan en disco. */
export class ProfileStore {
  readonly file: string;
  private profiles = new Map<string, StoredProfile>();
  private claims = new Map<string, string>();
  private claimCredentials = new Map<string, string>();
  private reservedCredentials = new Set<string>();
  private access: AccessData = emptyAccess();
  private queue: Promise<void> = Promise.resolve();

  constructor(readonly directory: string) {
    this.file = resolve(directory, "profiles.json");
    if (existsSync(this.file)) {
      const data = JSON.parse(readFileSync(this.file, "utf8"));
      if (![1, 2].includes(data.version) || !data.profiles || typeof data.profiles !== "object" || Array.isArray(data.profiles)) {
        throw new Error("Formato de guardado no compatible. No se sobrescribirá el archivo.");
      }
      for (const [key, profile] of Object.entries(data.profiles)) {
        if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Índice de perfil inválido.");
        validate(profile);
        this.profiles.set(key, profile);
      }
      if (data.version === 2) {
        this.validateAccess(data.access);
        this.access = data.access;
      }
    }
  }

  acquire(token: unknown, owner: string): string {
    const credential = profileKey(token);
    if (this.reservedCredentials.has(credential)) throw new ProfileClaimError("Se está confirmando el acceso de este dispositivo. Vuelve a intentarlo en unos segundos.");
    if (Object.hasOwn(this.access.revoked, credential)) throw new ProfileClaimError("El acceso de este dispositivo fue revocado. Vuelve a vincularlo desde un navegador sin partida.");
    const key = this.access.aliases[credential] ?? credential;
    if (this.claims.has(key)) throw new ProfileClaimError("Esta partida ya está abierta. Cierra la otra pestaña y vuelve a intentarlo.");
    this.claims.set(key, owner);
    this.claimCredentials.set(key, credential);
    return key;
  }

  release(key: string, owner: string) {
    if (this.claims.get(key) === owner) { this.claims.delete(key); this.claimCredentials.delete(key); }
  }

  get(key: string): StoredProfile | undefined {
    const p = this.profiles.get(key);
    return p ? structuredClone(p) : undefined;
  }

  save(key: string, owner: string, profile: StoredProfile): Promise<void> {
    if (this.claims.get(key) !== owner) return Promise.reject(new Error("El perfil no pertenece a esta sesión."));
    validate(profile);
    this.profiles.set(key, structuredClone(profile));
    return this.enqueue(() => this.writeSnapshot(this.access));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.then(() => {}, () => {});
    return result;
  }

  private async writeSnapshot(access: AccessData): Promise<void> {
    // La instantánea se construye al ejecutar la cola, no antes: un autoguardado
    // encolado durante una vinculación nunca puede borrar las credenciales nuevas.
    const snapshot = JSON.stringify({version: 2, profiles: Object.fromEntries(this.profiles), access}, null, 2);
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    const temp = `${this.file}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temp, "wx", 0o600);
      try { await handle.writeFile(snapshot, "utf8"); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temp, this.file);
      if (process.platform !== "win32") {
        const directory = await open(this.directory, "r");
        try { await directory.sync(); } finally { await directory.close(); }
      }
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
  }

  private validateAccess(value: unknown): asserts value is AccessData {
    if (!value || typeof value !== "object") throw new Error("Accesos de perfil inválidos.");
    const a = value as AccessData;
    for (const part of [a.aliases,a.recovery,a.revoked,a.revisions]) {
      if (!part || typeof part !== "object" || Array.isArray(part)) throw new Error("Accesos de perfil inválidos.");
    }
    for (const [credential, key] of Object.entries(a.aliases)) {
      if (!isHash(credential) || !isHash(key) || !this.profiles.has(key) || this.profiles.has(credential) ||
          Object.hasOwn(a.revoked,credential)) throw new Error("Alias de perfil inválido.");
    }
    const recoveryHashes = new Set<string>();
    for (const [key, hash] of Object.entries(a.recovery)) {
      if (!this.profiles.has(key) || !isHash(hash) || recoveryHashes.has(hash)) throw new Error("Recuperación de perfil inválida.");
      recoveryHashes.add(hash);
    }
    for (const [credential, key] of Object.entries(a.revoked)) {
      if (!isHash(credential) || !isHash(key) || !this.profiles.has(key) ||
          (this.profiles.has(credential) && credential !== key)) throw new Error("Revocación de perfil inválida.");
    }
    for (const [key, revision] of Object.entries(a.revisions)) {
      if (!this.profiles.has(key) || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Revisión de perfil inválida.");
    }
  }

  private requireOwner(key: string, owner: string) {
    if (this.claims.get(key) !== owner || !this.profiles.has(key)) throw new ProfileAccessConflict("El perfil no pertenece a esta sesión.");
  }

  accessRevision(key: string): number { return this.access.revisions[key] ?? 0; }

  ownedRevision(key: string, owner: string): number {
    this.requireOwner(key, owner);
    return this.accessRevision(key);
  }

  recoveryKey(hash: string): string | undefined {
    return Object.keys(this.access.recovery).find(key => this.access.recovery[key] === hash);
  }

  linkedSummary(token: unknown, previousToken: unknown): SavedProfileSummary | undefined {
    const credential = profileKey(token), previous = profileKey(previousToken);
    const previousKey = this.access.aliases[previous] ?? this.access.revoked[previous] ?? previous;
    if (this.profiles.has(previousKey)) throw new ProfileAccessConflict("Este navegador ya tiene una partida. No se reemplaza ni se fusiona; usa otro perfil de navegador sin partida.");
    const key = this.access.aliases[credential];
    if (!key || Object.hasOwn(this.access.revoked,credential)) return undefined;
    const profile = this.profiles.get(key);
    return profile ? profileSummary(profile) : undefined;
  }

  async setRecovery(key: string, owner: string, hash: string): Promise<void> {
    this.requireOwner(key, owner);
    if (!isHash(hash)) throw new ProfileAccessConflict("Recuperación inválida.");
    return this.enqueue(async () => {
      this.requireOwner(key, owner);
      const next = structuredClone(this.access);
      next.recovery[key] = hash;
      await this.writeSnapshot(next);
      this.access = next;
    });
  }

  /** Solo invocar después de validar un código en ProfileAccess. No copia progreso. */
  async linkCredential(key: string, token: unknown, previousToken: unknown, revision: number, recoveryHash?: string): Promise<SavedProfileSummary> {
    const credential = profileKey(token), previous = profileKey(previousToken);
    return this.enqueue(async () => {
      if (!this.profiles.has(key) || this.accessRevision(key) !== revision ||
          (recoveryHash !== undefined && this.access.recovery[key] !== recoveryHash)) throw new ProfileAccessConflict("Código inválido, usado o caducado.");
      const previousKey = this.access.aliases[previous] ?? this.access.revoked[previous] ?? previous;
      if (this.profiles.has(previousKey)) throw new ProfileAccessConflict("Este navegador ya tiene una partida. No se reemplaza ni se fusiona; usa otro perfil de navegador sin partida.");
      if (this.profiles.has(credential) || this.claims.has(credential) || Object.hasOwn(this.access.aliases,credential) ||
          Object.hasOwn(this.access.revoked,credential)) throw new ProfileAccessConflict("El acceso de destino ya está en uso. Vuelve a intentarlo desde el inicio.");
      if (Object.values(this.access.aliases).filter(value => value === key).length >= 16) throw new ProfileAccessConflict("Límite de dispositivos alcanzado. Desvincula los otros dispositivos desde tu partida.");
      const next = structuredClone(this.access);
      next.aliases[credential] = key;
      if (recoveryHash !== undefined) delete next.recovery[key];
      // Impedir que un join concurrente cree un perfil primario con el mismo
      // hash mientras se está confirmando su alias (o el acceso anterior).
      this.reservedCredentials.add(credential);this.reservedCredentials.add(previous);
      try {
        await this.writeSnapshot(next);
        this.access = next;
      } finally {
        this.reservedCredentials.delete(credential);this.reservedCredentials.delete(previous);
      }
      return profileSummary(this.profiles.get(key)!);
    });
  }

  async revokeOtherDevices(key: string, owner: string): Promise<number> {
    this.requireOwner(key, owner);
    return this.enqueue(async () => {
      this.requireOwner(key, owner);
      const credential = this.claimCredentials.get(key)!;
      const next = structuredClone(this.access);
      let count = 0;
      for (const [alias, profile] of Object.entries(next.aliases)) {
        if (profile === key && alias !== credential) { delete next.aliases[alias]; next.revoked[alias] = key; count++; }
      }
      if (credential !== key && !Object.hasOwn(next.revoked,key)) { next.revoked[key] = key; count++; }
      delete next.recovery[key];
      next.revisions[key] = this.accessRevision(key) + 1;
      await this.writeSnapshot(next);
      this.access = next;
      return count;
    });
  }

  async flush() { await this.queue; }
}

let store: ProfileStore | undefined;
export function getProfileStore(): ProfileStore {
  return store ??= new ProfileStore(process.env.DIGIWORLD_DATA_DIR
    ? resolve(process.env.DIGIWORLD_DATA_DIR)
    : resolve(import.meta.dirname, "../../data"));
}
