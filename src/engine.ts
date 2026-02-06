import type { Effect } from './effects';
import { resolveEffects } from './effects';
import { EventBus } from './events';
import type {
  ActionResult,
  ActionValidationError,
  GameAction,
  GameContext,
  GameState,
  Phase,
  PlayerId,
  SerializedEntity,
  SerializedGameState,
  TraceEntry,
  JsonValue,
} from './types';
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
  traceEnabled?: boolean;
  traceLimit?: number;
}

export interface NormalizedEngineConfig {
  seed: number;
  players: PlayerId[];
  zones: string[];
  rules: RuleModule[];
  plugins: EnginePlugin[];
  maxEventChain: number;
  traceEnabled: boolean;
  traceLimit: number;
}

export interface ScheduleActionInput {
  id: string;
  priority?: number;
  delayTurns?: number;
  phase?: Phase;
  run: (context: GameContext) => void;
}

interface ScheduledAction {
  id: string;
  priority: number;
  executeAtTurn: number;
  executeAtPhaseIndex: number;
  order: number;
  run: (context: GameContext) => void;
}

const DEFAULT_ZONES = ['hand', 'deck', 'discard', 'exile', 'field'];
const DEFAULT_PHASES: Phase[] = ['draw', 'main', 'combat', 'end'];
const DEFAULT_MAX_EVENT_CHAIN = 1024;
const DEFAULT_TRACE_LIMIT = 256;

const sortKeys = (values: string[]): string[] =>
  [...values].sort((left, right) => left.localeCompare(right));

const normalizeJsonValue = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeJsonValue(entryValue),
    ]) as Array<[string, JsonValue]>;
    entries.sort(([left], [right]) => left.localeCompare(right));
    const normalized: Record<string, JsonValue> = {};
    for (const [key, entryValue] of entries) {
      normalized[key] = entryValue;
    }
    return normalized;
  }

  return value;
};

const normalizeJsonRecord = (
  record: Record<string, JsonValue>,
): Record<string, JsonValue> => {
  const normalized: Record<string, JsonValue> = {};
  for (const key of sortKeys(Object.keys(record))) {
    normalized[key] = normalizeJsonValue(record[key]);
  }
  return normalized;
};

const serializeEntity = (entity: GameState['entities'][string]): SerializedEntity => ({
  id: entity.id,
  type: entity.type,
  stats: [...entity.stats.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  ),
  tags: [...entity.tags.values()].sort((left, right) =>
    left.localeCompare(right),
  ),
  state: entity.state
    ? normalizeJsonRecord(entity.state as Record<string, JsonValue>)
    : undefined,
});

const deserializeEntity = (entity: SerializedEntity): GameState['entities'][string] => ({
  id: entity.id,
  type: entity.type,
  stats: new Map(entity.stats),
  tags: new Set(entity.tags),
  state: entity.state,
});

const buildOrderedRecord = <T, U>(
  record: Record<string, T>,
  orderedKeys: string[],
  valueMapper: (value: T) => U,
): Record<string, U> => {
  const result: Record<string, U> = {};
  for (const key of orderedKeys) {
    result[key] = valueMapper(record[key]);
  }
  return result;
};

const resolveOrderedPlayerIds = (
  playerOrder: PlayerId[],
  players: Record<PlayerId, GameState['players'][PlayerId]>,
): PlayerId[] => {
  const ordered: PlayerId[] = [];
  const seen = new Set<PlayerId>();
  for (const id of playerOrder) {
    if (players[id]) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of sortKeys(Object.keys(players))) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
};

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
    traceEnabled: config.traceEnabled ?? false,
    traceLimit: Math.max(1, config.traceLimit ?? DEFAULT_TRACE_LIMIT),
  };
};

export class GameEngine {
  readonly bus = new EventBus();
  readonly rng: SeededRNG;
  readonly phases = [...DEFAULT_PHASES];
  readonly maxEventChain: number;
  private phaseIndex = 0;
  private activeEventChain = 0;
  private scheduledActions: ScheduledAction[] = [];
  private scheduledActionOrder = 0;
  private trace: TraceEntry[] = [];
  private traceEnabled: boolean;
  private traceLimit: number;
  private traceDepth = 0;

  constructor(
    private state: GameState,
    maxEventChain = DEFAULT_MAX_EVENT_CHAIN,
    traceEnabled = false,
    traceLimit = DEFAULT_TRACE_LIMIT,
  ) {
    this.rng = new SeededRNG(state.seed);
    this.maxEventChain = maxEventChain;
    this.traceEnabled = traceEnabled;
    this.traceLimit = traceLimit;
    const phaseIndex = this.phases.indexOf(state.phase);
    this.phaseIndex = phaseIndex === -1 ? 0 : phaseIndex;
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

    const engine = new GameEngine(
      initial,
      normalized.maxEventChain,
      normalized.traceEnabled,
      normalized.traceLimit,
    );

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

  exportState(): SerializedGameState {
    const orderedPlayerIds = resolveOrderedPlayerIds(
      this.state.playerOrder,
      this.state.players,
    );
    const players = buildOrderedRecord(
      this.state.players,
      orderedPlayerIds,
      (player) => ({
        id: player.id,
        zones: buildOrderedRecord(
          player.zones,
          sortKeys(Object.keys(player.zones)),
          (zone) => [...zone],
        ),
        resources: buildOrderedRecord(
          player.resources,
          sortKeys(Object.keys(player.resources)),
          (value) => value,
        ),
      }),
    );
    const entities = buildOrderedRecord(
      this.state.entities,
      sortKeys(Object.keys(this.state.entities)),
      (entity) => serializeEntity(entity),
    );

    return {
      seed: this.state.seed,
      turn: this.state.turn,
      phase: this.state.phase,
      activePlayerId: this.state.activePlayerId,
      playerOrder: [...this.state.playerOrder],
      players,
      entities,
      log: [...this.state.log],
    };
  }

  static importState(snapshot: SerializedGameState): GameEngine {
    const players = buildOrderedRecord(
      snapshot.players,
      Object.keys(snapshot.players),
      (player) => ({
        id: player.id,
        zones: buildOrderedRecord(
          player.zones,
          Object.keys(player.zones),
          (zone) => [...zone],
        ),
        resources: buildOrderedRecord(
          player.resources,
          Object.keys(player.resources),
          (value) => value,
        ),
      }),
    );
    const entities = buildOrderedRecord(
      snapshot.entities,
      Object.keys(snapshot.entities),
      (entity) => deserializeEntity(entity),
    );

    const state: GameState = {
      seed: snapshot.seed,
      turn: snapshot.turn,
      phase: snapshot.phase,
      activePlayerId: snapshot.activePlayerId,
      playerOrder: [...snapshot.playerOrder],
      players,
      entities,
      log: [...snapshot.log],
    };

    return new GameEngine(state);
  }

  getContext(): GameContext {
    return {
      state: this.state,
      activePlayerId: this.state.activePlayerId,
    };
  }

  getTrace(): TraceEntry[] {
    return [...this.trace];
  }

  clearTrace(): void {
    this.trace = [];
    this.traceDepth = 0;
  }

  startTurn(): void {
    this.phaseIndex = 0;
    this.state.phase = this.phases[this.phaseIndex];
    this.emitEvent('turnStart', { turn: this.state.turn });
    this.emitEvent('phaseStart', { phase: this.state.phase });
    this.flushScheduledActions();
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
    this.flushScheduledActions();
  }

  endTurn(): void {
    this.emitEvent('turnEnd', { turn: this.state.turn });
    this.state.turn += 1;
    this.phaseIndex = 0;
    this.state.phase = this.phases[this.phaseIndex];
    this.state.activePlayerId = this.getNextActivePlayerId();
    this.emitEvent('turnStart', { turn: this.state.turn });
    this.emitEvent('phaseStart', { phase: this.state.phase });
    this.flushScheduledActions();
  }

  applyEffects(effects: Effect[]): void {
    const traceStarted = this.beginTrace({
      sourceType: 'effects',
      sourceId: `batch:${effects.length}`,
      eventType: 'applyEffects',
    });
    try {
      resolveEffects(effects, this.getContext());
    } finally {
      this.endTrace(traceStarted);
    }
  }

  scheduleAction(input: ScheduleActionInput): void {
    const action: ScheduledAction = {
      id: input.id,
      priority: input.priority ?? 0,
      executeAtTurn: this.state.turn + (input.delayTurns ?? 0),
      executeAtPhaseIndex: this.resolvePhaseIndex(input.phase),
      order: this.scheduledActionOrder++,
      run: input.run,
    };
    this.scheduledActions.push(action);
  }

  flushScheduledActions(): void {
    const traceStarted = this.beginTrace({
      sourceType: 'scheduledActions',
      sourceId: `pending:${this.scheduledActions.length}`,
      eventType: 'flushScheduledActions',
    });
    let resolvedCount = 0;

    try {
      while (true) {
        const nextIndex = this.findNextReadyActionIndex();
        if (nextIndex === -1) {
          break;
        }

        const [action] = this.scheduledActions.splice(nextIndex, 1);
        resolvedCount += 1;
        if (resolvedCount > this.maxEventChain) {
          throw new Error(
            `Превышен лимит разрешения отложенных действий (${this.maxEventChain}). Возможен бесконечный цикл.`,
          );
        }

        this.emitEvent('scheduledActionStart', { id: action.id });
        action.run(this.getContext());
        this.emitEvent('scheduledActionEnd', { id: action.id });
      }
    } finally {
      this.endTrace(traceStarted);
    }
  }

  getScheduledActionsCount(): number {
    return this.scheduledActions.length;
  }

  emitEvent<TPayload>(type: string, payload?: TPayload): void {
    const traceStarted = this.beginTrace({
      sourceType: 'event',
      sourceId: type,
      eventType: type,
    });
    this.activeEventChain += 1;
    if (this.activeEventChain > this.maxEventChain) {
      this.activeEventChain -= 1;
      this.endTrace(traceStarted);
      throw new Error(
        `Превышен лимит цепочки событий (${this.maxEventChain}). Возможен бесконечный цикл.`,
      );
    }

    try {
      this.bus.emit({ type, payload }, this.getContext());
    } finally {
      this.activeEventChain -= 1;
      this.endTrace(traceStarted);
    }
  }

  log(message: string): void {
    this.state.log.push(message);
  }

  dispatchAction(action: GameAction): ActionResult {
    this.emitEvent('actionReceived', { action });

    const errors = this.validateAction(action);
    if (errors.length > 0) {
      const result: ActionResult = { ok: false, action, errors };
      this.emitEvent('actionRejected', { action, errors });
      return result;
    }

    this.applyAction(action);
    const result: ActionResult = { ok: true, action };
    this.emitEvent('actionApplied', { action });
    return result;
  }

  validateAction(action: GameAction): ActionValidationError[] {
    const errors: ActionValidationError[] = [];
    const player = this.state.players[action.playerId];

    if (!player) {
      errors.push({
        code: 'unknown_player',
        message: 'Игрок не найден.',
        details: { playerId: action.playerId },
      });
      return errors;
    }

    if (action.playerId !== this.state.activePlayerId) {
      errors.push({
        code: 'not_active_player',
        message: 'Ходит другой игрок.',
        details: { activePlayerId: this.state.activePlayerId },
      });
    }

    if (action.type === 'playCard') {
      const fromZone = action.fromZone ?? 'hand';
      const toZone = action.toZone ?? 'field';
      const fromList = player.zones[fromZone];
      const toList = player.zones[toZone];

      if (!fromList) {
        errors.push({
          code: 'unknown_zone',
          message: 'Зона источника не найдена.',
          details: { zone: fromZone },
        });
      } else if (!fromList.includes(action.cardId)) {
        errors.push({
          code: 'card_not_in_zone',
          message: 'Карта отсутствует в зоне.',
          details: { cardId: action.cardId, zone: fromZone },
        });
      }

      if (!toList) {
        errors.push({
          code: 'unknown_zone',
          message: 'Зона назначения не найдена.',
          details: { zone: toZone },
        });
      }
    }

    if (action.type === 'attack') {
      if (!this.state.entities[action.attackerId]) {
        errors.push({
          code: 'unknown_attacker',
          message: 'Атакующий объект не найден.',
          details: { attackerId: action.attackerId },
        });
      }

      if (action.targetId && !this.state.entities[action.targetId]) {
        errors.push({
          code: 'unknown_target',
          message: 'Цель атаки не найдена.',
          details: { targetId: action.targetId },
        });
      }
    }

    if (action.type === 'activateAbility') {
      if (!this.state.entities[action.sourceId]) {
        errors.push({
          code: 'unknown_source',
          message: 'Источник способности не найден.',
          details: { sourceId: action.sourceId },
        });
      }
    }

    return errors;
  }

  applyAction(action: GameAction): void {
    switch (action.type) {
      case 'playCard': {
        const fromZone = action.fromZone ?? 'hand';
        const toZone = action.toZone ?? 'field';
        const zones = this.state.players[action.playerId].zones;
        const fromList = zones[fromZone];
        const toList = zones[toZone];
        if (!fromList || !toList) {
          return;
        }
        const index = fromList.indexOf(action.cardId);
        if (index !== -1) {
          fromList.splice(index, 1);
        }
        toList.push(action.cardId);
        this.log(`action:playCard:${action.playerId}:${action.cardId}`);
        return;
      }
      case 'attack': {
        this.log(
          `action:attack:${action.playerId}:${action.attackerId}:${action.targetId ?? 'none'}`,
        );
        return;
      }
      case 'activateAbility': {
        this.log(
          `action:activateAbility:${action.playerId}:${action.sourceId}:${action.abilityId}`,
        );
        return;
      }
      case 'endPhase': {
        this.log(`action:endPhase:${action.playerId}:${this.state.phase}`);
        this.nextPhase();
        return;
      }
      default: {
        return;
      }
    }
  }

  private resolvePhaseIndex(phase?: Phase): number {
    if (!phase) {
      return this.phaseIndex;
    }

    const index = this.phases.indexOf(phase);
    if (index === -1) {
      throw new Error(`Неизвестная фаза для отложенного действия: ${String(phase)}`);
    }

    return index;
  }

  private findNextReadyActionIndex(): number {
    let winnerIndex = -1;

    for (let index = 0; index < this.scheduledActions.length; index += 1) {
      const candidate = this.scheduledActions[index];
      if (!this.isActionReady(candidate)) {
        continue;
      }

      if (winnerIndex === -1) {
        winnerIndex = index;
        continue;
      }

      const winner = this.scheduledActions[winnerIndex];
      if (this.compareScheduledActions(candidate, winner) < 0) {
        winnerIndex = index;
      }
    }

    return winnerIndex;
  }

  private isActionReady(action: ScheduledAction): boolean {
    if (action.executeAtTurn !== this.state.turn) {
      return false;
    }

    return action.executeAtPhaseIndex <= this.phaseIndex;
  }

  private compareScheduledActions(left: ScheduledAction, right: ScheduledAction): number {
    if (left.executeAtTurn !== right.executeAtTurn) {
      return left.executeAtTurn - right.executeAtTurn;
    }

    if (left.executeAtPhaseIndex !== right.executeAtPhaseIndex) {
      return left.executeAtPhaseIndex - right.executeAtPhaseIndex;
    }

    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.id.localeCompare(right.id);
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

  private beginTrace(input: {
    sourceType: string;
    sourceId: string;
    eventType: string;
  }): boolean {
    if (!this.traceEnabled) {
      return false;
    }

    const entry: TraceEntry = {
      timestamp: Date.now(),
      turn: this.state.turn,
      phase: this.state.phase,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      eventType: input.eventType,
      depth: this.traceDepth,
    };

    this.trace.push(entry);
    if (this.trace.length > this.traceLimit) {
      this.trace.splice(0, this.trace.length - this.traceLimit);
    }

    this.traceDepth += 1;
    return true;
  }

  private endTrace(started: boolean): void {
    if (!started) {
      return;
    }

    this.traceDepth = Math.max(0, this.traceDepth - 1);
  }
}
