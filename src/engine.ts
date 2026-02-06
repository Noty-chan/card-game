import type { Effect } from './effects';
import { resolveEffects } from './effects';
import { EventBus } from './events';
import type { GameContext, GameState, Phase, PlayerId } from './types';
import { SeededRNG } from './rng';

export interface EnginePlugin {
  name: string;
  onRegister?: (engine: GameEngine) => void;
}

export interface RuleModule {
  name: string;
  register: (engine: GameEngine) => void;
}

export interface EngineConfig {
  seed: number;
  players: PlayerId[];
  zones?: string[];
  rules?: RuleModule[];
  plugins?: EnginePlugin[];
  maxEventChain?: number;
}

export interface NormalizedEngineConfig {
  seed: number;
  players: PlayerId[];
  zones: string[];
  rules: RuleModule[];
  plugins: EnginePlugin[];
  maxEventChain: number;
}

const DEFAULT_ZONES = ['hand', 'deck', 'discard', 'exile', 'field'];
const DEFAULT_PHASES: Phase[] = ['draw', 'main', 'combat', 'end'];
const DEFAULT_MAX_EVENT_CHAIN = 1024;

export const normalizeEngineConfig = (
  config: EngineConfig,
): NormalizedEngineConfig => {
  if (config.players.length === 0) {
    throw new Error('Нельзя создать движок без игроков.');
  }

  return {
    seed: config.seed,
    players: [...config.players],
    zones: config.zones ? [...config.zones] : [...DEFAULT_ZONES],
    rules: config.rules ? [...config.rules] : [],
    plugins: config.plugins ? [...config.plugins] : [],
    maxEventChain: config.maxEventChain ?? DEFAULT_MAX_EVENT_CHAIN,
  };
};

export class GameEngine {
  readonly bus = new EventBus();
  readonly rng: SeededRNG;
  readonly phases = [...DEFAULT_PHASES];
  readonly maxEventChain: number;
  private phaseIndex = 0;
  private activeEventChain = 0;

  constructor(private state: GameState, maxEventChain = DEFAULT_MAX_EVENT_CHAIN) {
    this.rng = new SeededRNG(state.seed);
    this.maxEventChain = maxEventChain;
  }

  static create(config: EngineConfig): GameEngine {
    const normalized = normalizeEngineConfig(config);
    const players = normalized.players.reduce<
      Record<PlayerId, GameState['players'][PlayerId]>
    >(
      (acc, id) => {
        const playerZones = normalized.zones.reduce<Record<string, string[]>>(
          (zonesAcc, zone) => {
            zonesAcc[zone] = [];
            return zonesAcc;
          },
          {},
        );
        acc[id] = {
          id,
          zones: playerZones,
          resources: {},
        };
        return acc;
      },
      {},
    );

    const initial: GameState = {
      seed: normalized.seed,
      turn: 1,
      phase: 'draw',
      activePlayerId: normalized.players[0],
      playerOrder: [...normalized.players],
      players,
      entities: {},
      log: [],
    };

    const engine = new GameEngine(initial, normalized.maxEventChain);

    for (const rule of normalized.rules) {
      engine.addRule(rule);
    }

    for (const plugin of normalized.plugins) {
      engine.use(plugin);
    }

    return engine;
  }

  use(plugin: EnginePlugin): void {
    plugin.onRegister?.(this);
  }

  addRule(rule: RuleModule): void {
    rule.register(this);
  }

  getState(): GameState {
    return this.state;
  }

  getContext(): GameContext {
    return {
      state: this.state,
      activePlayerId: this.state.activePlayerId,
    };
  }

  startTurn(): void {
    this.phaseIndex = 0;
    this.state.phase = this.phases[this.phaseIndex];
    this.emitEvent('turnStart', { turn: this.state.turn });
    this.emitEvent('phaseStart', { phase: this.state.phase });
  }

  nextPhase(): void {
    this.emitEvent('phaseEnd', { phase: this.state.phase });
    this.phaseIndex += 1;

    if (this.phaseIndex >= this.phases.length) {
      this.endTurn();
      return;
    }

    this.state.phase = this.phases[this.phaseIndex];
    this.emitEvent('phaseStart', { phase: this.state.phase });
  }

  endTurn(): void {
    this.emitEvent('turnEnd', { turn: this.state.turn });
    this.state.turn += 1;
    this.phaseIndex = 0;
    this.state.phase = this.phases[this.phaseIndex];
    this.state.activePlayerId = this.getNextActivePlayerId();
    this.emitEvent('turnStart', { turn: this.state.turn });
    this.emitEvent('phaseStart', { phase: this.state.phase });
  }

  applyEffects(effects: Effect[]): void {
    resolveEffects(effects, this.getContext());
  }

  emitEvent<TPayload>(type: string, payload?: TPayload): void {
    this.activeEventChain += 1;
    if (this.activeEventChain > this.maxEventChain) {
      this.activeEventChain -= 1;
      throw new Error(
        `Превышен лимит цепочки событий (${this.maxEventChain}). Возможен бесконечный цикл.`,
      );
    }

    this.bus.emit({ type, payload }, this.getContext());
    this.activeEventChain -= 1;
  }

  log(message: string): void {
    this.state.log.push(message);
  }

  private getNextActivePlayerId(): PlayerId {
    const order = this.state.playerOrder;
    if (order.length === 0) {
      return this.state.activePlayerId;
    }

    const currentIndex = order.indexOf(this.state.activePlayerId);
    if (currentIndex === -1) {
      return order[0];
    }

    return order[(currentIndex + 1) % order.length];
  }
}
