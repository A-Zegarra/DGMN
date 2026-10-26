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
