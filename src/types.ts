export type Phase = 'draw' | 'main' | 'combat' | 'end';

export type PlayerId = string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Entity {
  id: string;
  type: string;
  stats: Map<string, number>;
  tags: Set<string>;
  state?: Record<string, unknown>;
}

export interface SerializedEntity {
  id: string;
  type: string;
  stats: Array<[string, number]>;
  tags: string[];
  state?: Record<string, JsonValue>;
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
  playerOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  entities: Record<string, Entity>;
  log: string[];
}

export interface SerializedGameState {
  seed: number;
  turn: number;
  phase: Phase;
  activePlayerId: PlayerId;
  playerOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  entities: Record<string, SerializedEntity>;
  log: string[];
}

export interface GameContext {
  state: GameState;
  activePlayerId: PlayerId;
}

export interface TraceEntry {
  timestamp: number;
  turn: number;
  phase: Phase;
  sourceType: string;
  sourceId: string;
  eventType: string;
  depth: number;
}

export type GameAction =
  | {
      type: 'playCard';
      playerId: PlayerId;
      cardId: string;
      fromZone?: string;
      toZone?: string;
    }
  | {
      type: 'attack';
      playerId: PlayerId;
      attackerId: string;
      targetId?: string;
    }
  | {
      type: 'endPhase';
      playerId: PlayerId;
    }
  | {
      type: 'activateAbility';
      playerId: PlayerId;
      sourceId: string;
      abilityId: string;
      targetId?: string;
    };

export interface ActionValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ActionResult {
  ok: boolean;
  action: GameAction;
  errors?: ActionValidationError[];
}
