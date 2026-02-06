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
  playerOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  entities: Record<string, Entity>;
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
