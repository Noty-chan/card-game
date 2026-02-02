export type Phase = 'draw' | 'main' | 'combat' | 'end';

export type PlayerId = string;

export interface Entity {
  id: string;
  type: string;
  stats: Map<string, number>;
  tags: Set<string>;
  state?: Record<string, unknown>;
}

export interface Zones {
  [zone: string]: string[];
}

export interface PlayerState {
  id: PlayerId;
  zones: Zones;
  resources: Record<string, number>;
}

export interface GameState {
  seed: number;
  turn: number;
  phase: Phase;
  activePlayerId: PlayerId;
  players: Record<PlayerId, PlayerState>;
  entities: Record<string, Entity>;
  log: string[];
}

export interface GameContext {
  state: GameState;
  activePlayerId: PlayerId;
}
