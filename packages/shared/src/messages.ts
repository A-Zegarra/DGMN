export interface JoinOptions {
  name: string;
  species: string;
}

export interface InputMessage {
  x: number;
  z: number;
  run: boolean;
  seq: number;
  /** Orientación deseada del tamer, en radianes. */
  yaw?: number;
}

export interface ChatMessage {
  sessionId: string;
  name: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface WelcomeMessage {
  sessionId: string;
  zone: string;
}

export interface DuelRequestMessage {
  targetId: string;
}

export interface DuelResponseMessage {
  fromId: string;
  accept: boolean;
}

export interface AbilityMessage {
  abilityId: string;
}

export interface WildTargetMessage {
  wildId: string;
}

export interface DuelRequestPayload {
  fromId: string;
  fromName: string;
  fromSpecies: string;
  fromLevel: number;
  at: number;
}

export interface DuelRequestSentPayload {
  targetId: string;
  targetName: string;
}

export interface DuelDeclinedPayload {
  byName: string;
}

export interface DuelErrorPayload {
  reason: string;
}

export interface DuelStartPayload {
  opponentId: string;
  opponentName: string;
}

export interface DuelEndPayload {
  winnerId: string;
  loserId: string;
  winnerName: string;
  loserName: string;
}

export interface AbilityUsedPayload {
  casterId: string;
  casterName: string;
  targetId: string;
  targetName: string;
  abilityId: string;
  abilityName: string;
  amount: number;
  kind: "damage" | "heal";
  cooldownMs: number;
  at: number;
}

export interface AbilityErrorPayload {
  abilityId: string;
  reason: string;
}

export interface AutoAttackPayload {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  amount: number;
  at: number;
}

export interface WildDeathPayload {
  wildId: string;
  wildName: string;
  species: string;
  killerId: string;
  killerName: string;
  xp: number;
  at: number;
}

export interface LevelUpPayload {
  level: number;
  xp: number;
  xpNext: number;
  maxHp: number;
  maxEp: number;
  at: number;
}

export interface EvolveMessage {
  targetSpecies: string;
}

export interface EvolutionPayload {
  playerId: string;
  fromSpecies: string;
  toSpecies: string;
  durationMs: number;
  at: number;
}

export interface EvolutionErrorPayload {
  reason: string;
}

export interface SavedProfileSummary {
  name: string;
  species: string;
  level: number;
  xp: number;
  xpNext: number;
  duelWins: number;
  duelLosses: number;
  updatedAt: number;
}

export interface ProfileStatusPayload {
  persistent: boolean;
  savedAt: number;
  profile?: SavedProfileSummary;
  error?: string;
  requestId?: string;
  cooldowns?: Record<string, number>;
}

export interface InventoryData {hpPotion:number;epPotion:number;bits:number;devimonSeals:number;}
export interface InventoryPayload extends InventoryData {cooldownMs:number;}
export interface UseItemMessage {itemId:string;}
export interface ItemUsedPayload {playerId:string;itemId:string;amount:number;kind:"hp"|"ep";}
export interface LootReceivedPayload extends InventoryData {wildName:string;}

/** Misiones privadas: solo el servidor modifica las bajas y las entregas. */
export interface QuestJournalData {completed: string[]; kills: number;}
export interface QuestClaimMessage {questId: string;}
export interface QuestClaimedPayload {
  questId: string;
  questName: string;
  reward: InventoryData & {xp: number};
}

/** El cliente elige una oferta; nunca envía el precio ni la cantidad. */
export interface ShopBuyMessage {offerId: string;}
export interface ShopPurchasePayload {offerId: string; offerName: string; cooldownMs: number;}

export type ProfileAccessAction = "link" | "cancel_link" | "recovery" | "revoke_others";
export interface ProfileAccessPayload {
  action: ProfileAccessAction;
  code?: string;
  expiresAt?: number;
  revokedCount?: number;
}
export interface ProfileImportRequest {
  mode: "link" | "recovery" | "resume";
  code?: string;
  token: string;
  previousToken: string;
}
