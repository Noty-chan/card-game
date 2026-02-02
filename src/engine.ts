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
}

const DEFAULT_PHASES: Phase[] = ['draw', 'main', 'combat', 'end'];

export class GameEngine {
  readonly bus = new EventBus();
  readonly rng: SeededRNG;
  readonly phases = [...DEFAULT_PHASES];
  private readonly plugins: EnginePlugin[] = [];
  private readonly rules: RuleModule[] = [];
  private phaseIndex = 0;

  constructor(private state: GameState) {
    this.rng = new SeededRNG(state.seed);
  }

  static create(config: EngineConfig): GameEngine {
    if (config.players.length === 0) {
      throw new Error('Нельзя создать движок без игроков.');
    }

    const zones = config.zones ?? ['hand', 'deck', 'discard', 'exile', 'field'];
    const players = config.players.reduce<Record<PlayerId, GameState['players'][PlayerId]>>(
      (acc, id) => {
        const playerZones = zones.reduce<Record<string, string[]>>((zonesAcc, zone) => {
          zonesAcc[zone] = [];
          return zonesAcc;
        }, {});
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
      seed: config.seed,
      turn: 1,
      phase: 'draw',
      activePlayerId: config.players[0],
      playerOrder: [...config.players],
      players,
      entities: {},
      log: [],
    };

    const engine = new GameEngine(initial);

    for (const rule of config.rules ?? []) {
      engine.addRule(rule);
    }

    for (const plugin of config.plugins ?? []) {
      engine.use(plugin);
    }

    return engine;
  }

  use(plugin: EnginePlugin): void {
    this.plugins.push(plugin);
    plugin.onRegister?.(this);
  }

  addRule(rule: RuleModule): void {
    this.rules.push(rule);
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
    this.bus.emit({ type, payload }, this.getContext());
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
