export interface JoinOptions {
  name: string;
  species: string;
}

export interface InputMessage {
  x: number;
  z: number;
  run: boolean;
  seq: number;
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
