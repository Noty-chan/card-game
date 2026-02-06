# Публичный API движка

## EngineConfig

`EngineConfig` — входная конфигурация при создании движка.

| Поле | Тип | Описание |
| --- | --- | --- |
| `seed` | `number` | Сид для детерминированного RNG. |
| `players` | `PlayerId[]` | Список идентификаторов игроков в порядке ходов. Должен быть непустым. |
| `zones` | `string[]` | Список зон, которые будут созданы для каждого игрока. По умолчанию: `hand`, `deck`, `discard`, `exile`, `field`. |
| `rules` | `RuleModule[]` | Список модулей правил, регистрируемых при создании движка. По умолчанию: пустой массив. |
| `plugins` | `EnginePlugin[]` | Список плагинов, подключаемых после регистрации правил. По умолчанию: пустой массив. |
| `cardRegistry` | `CardRegistry` | Реестр карт, используемый для поиска определений карт при `playCard`. |
| `maxEventChain` | `number` | Лимит глубины цепочки событий и лимит разрешения отложенных действий. По умолчанию: `1024`. |
| `traceEnabled` | `boolean` | Включает сбор трассировки событий движка. По умолчанию: `false`. |
| `traceLimit` | `number` | Максимальный размер буфера трассировки. По умолчанию: `256`. |

## normalizeEngineConfig

`normalizeEngineConfig(config)` возвращает нормализованную конфигурацию с заполненными
значениями по умолчанию (`zones`, `rules`, `plugins`, `maxEventChain`). Функция также валидирует базовые
условия, например наличие хотя бы одного игрока.

### NormalizedEngineConfig

Результат нормализации всегда содержит полные списки:

| Поле | Тип | Описание |
| --- | --- | --- |
| `zones` | `string[]` | Зоны с учётом дефолтов. |
| `rules` | `RuleModule[]` | Модули правил (может быть пустым массивом). |
| `plugins` | `EnginePlugin[]` | Плагины (может быть пустым массивом). |
| `cardRegistry` | `CardRegistry` | Реестр карт (может быть пустым). |
| `maxEventChain` | `number` | Эффективный лимит глубины цепочки событий и разрешения отложенных действий. |
| `traceEnabled` | `boolean` | Признак включённой трассировки. |
| `traceLimit` | `number` | Эффективный лимит буфера трассировки. |

## Контракты RuleModule и EnginePlugin

```ts
export interface RuleModule {
  name: string;
  register: (engine: GameEngine) => void;
}

export interface VictoryRule {
  id: string;
  evaluate: (context: GameContext) => {
    winnerIds: PlayerId[];
    finishedReason?: string;
  } | null;
}

export interface EliminationRule {
  id: string;
  evaluate: (context: GameContext) => {
    eliminatedIds: PlayerId[];
    reason?: string;
  } | null;
}

export interface EnginePlugin {
  name: string;
  onRegister?: (engine: GameEngine) => void;
}
```

- `RuleModule.register(...)` вызывается всегда и служит для регистрации правил, обработчиков событий и эффектов.
- `EnginePlugin.onRegister(...)` опционален и вызывается при подключении плагина.

### Регистрация условий победы и устранения

Внутри `RuleModule.register(...)` можно подключать условия завершения игры:

```ts
engine.registerVictoryRule(victoryRule);
engine.registerEliminationRule(eliminationRule);
```

`VictoryRule` возвращает список победителей и опциональную причину завершения.
`EliminationRule` используется для уведомлений об устранении игроков через событие
`playerEliminated`.

### Порядок регистрации

При вызове `GameEngine.create(...)` сначала регистрируются все правила из `config.rules`, затем подключаются плагины из `config.plugins`. Это позволяет плагинам опираться на уже зарегистрированные правила.

## Планировщик отложенных действий

Для расширенных правил доступен встроенный deterministic-планировщик:

```ts
export interface ScheduleActionInput {
  id: string;
  priority?: number;
  delayTurns?: number;
  phase?: Phase;
  run: (context: GameContext) => void;
}
```

### `engine.scheduleAction(input)`

Регистрирует отложенное действие. Порядок разрешения всегда детерминирован:
1. Ход (`delayTurns` + текущий ход).
2. Фаза (`phase`, либо текущая фаза, если поле пропущено).
3. Приоритет (`priority`, по убыванию).
4. Порядок регистрации.
5. `id` (лексикографически, как последний tie-breaker).

### `engine.flushScheduledActions()`

Принудительно пытается разрешить все готовые действия для текущих хода/фазы. Обычно
вызывать вручную не нужно: движок делает это автоматически после `phaseStart` в
`startTurn`, `nextPhase` и `endTurn`.

### `engine.getScheduledActionsCount()`

Возвращает текущее число ожидающих отложенных действий.

### Защита от бесконечного самопланирования

Если во время `flushScheduledActions()` правила бесконечно планируют новые «готовые сейчас»
действия, движок прерывает цикл по `maxEventChain` и выбрасывает ошибку.

## Защита от бесконечных цепочек событий

Метод `emitEvent(...)` отслеживает глубину вложенных вызовов событий. Если глубина
превышает `maxEventChain`, движок выбрасывает ошибку и прерывает обработку.
Это защищает ядро от неконтролируемой рекурсии в правилах и плагинах.

## TraceEntry и трассировка

Трассировка — лёгкий буфер последних событий движка. Записи собираются для
`emitEvent`, `applyEffects` и `flushScheduledActions`, если включён `traceEnabled`.

```ts
export interface TraceEntry {
  timestamp: number;
  turn: number;
  phase: Phase;
  sourceType: string;
  sourceId: string;
  eventType: string;
  depth: number;
}
```

### `engine.getTrace()`

Возвращает копию текущего буфера трассировки.

### `engine.clearTrace()`

Полностью очищает буфер трассировки и сбрасывает счётчик глубины.

## Сериализация состояния

Для сохранения, реплеев и синхронизации предусмотрены сериализация/десериализация
снимков состояния. Снимок использует только JSON-совместимые типы и фиксированный
порядок полей/коллекций для детерминированного `JSON.stringify`.

```ts
export interface SerializedEntity {
  id: string;
  type: string;
  stats: Array<[string, number]>;
  tags: string[];
  state?: Record<string, JsonValue>;
}

export interface SerializedGameState {
  seed: number;
  turn: number;
  phase: Phase;
  status: 'running' | 'finished';
  winnerIds: PlayerId[];
  finishedReason?: string;
  activePlayerId: PlayerId;
  playerOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  entities: Record<string, SerializedEntity>;
  log: string[];
}
```

### `engine.exportState()`

Возвращает снимок `SerializedGameState` с детерминированным порядком ключей.
`Map`/`Set` сущностей преобразуются в отсортированные массивы, вложенные JSON-объекты
нормализуются по ключам.

### `GameEngine.importState(snapshot)`

Статический метод, создающий движок из `SerializedGameState`. Восстанавливает
`Map`/`Set` в сущностях, копирует массивы и словари, после чего возвращает готовый
экземпляр `GameEngine`.

## Команды и dispatchAction

Движок поддерживает двухэтапный пайплайн команд: чистая валидация и применение
(мутация состояния и событий).

```ts
export type GameAction =
  | { type: 'playCard'; playerId: PlayerId; cardId: string; fromZone?: string; toZone?: string }
  | { type: 'attack'; playerId: PlayerId; attackerId: string; targetId?: string }
  | { type: 'endPhase'; playerId: PlayerId }
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
```

### `engine.dispatchAction(action)`

Публичная точка входа для команд. Внутри выполняется:

1. `actionReceived` — событие о принятой команде.
2. `validateAction(action)` — чистая проверка без мутаций.
3. При ошибках: `actionRejected` и возврат `ActionResult` с `ok = false`.
4. При успехе: `applyAction(action)` → `actionApplied` → `ActionResult` с `ok = true`.

Если `state.status === 'finished'`, валидация возвращает ошибку `game_finished`,
и команда отклоняется без мутаций.

### `engine.validateAction(action)`

Возвращает список ошибок валидации. Не изменяет `GameState`.

### `engine.applyAction(action)`

Применяет команду к `GameState` и при необходимости вызывает события и фазовые переходы.

## Реестр карт и схемы

```ts
export class CardRegistry {
  registerCard(card: CardDefinition): void;
  registerCards(cards: CardDefinition[]): void;
  registerCardSet(cardSet: CardSetDefinition): void;
  getCard(cardId: string): CardDefinition | undefined;
}
```

`CardRegistry` хранит описания карт и валидирует схему. Движок использует реестр
в `dispatchAction(playCard)` для поиска карты и преобразования декларативных
эффектов в runtime-эффекты.

### `engine.getCardDefinition(cardId)`

Возвращает определение карты из реестра или `undefined`, если карта не найдена.

### Минимальный DSL эффектов

```ts
type CardEffectDefinition =
  | { kind: 'draw'; amount: number; target?: 'self' | 'opponent'; delayTurns?: number; phase?: Phase }
  | { kind: 'damage'; amount: number; resource?: string; target?: 'self' | 'opponent'; delayTurns?: number; phase?: Phase }
  | {
      kind: 'gainResource';
      amount: number;
      resource: string;
      target?: 'self' | 'opponent';
      delayTurns?: number;
      phase?: Phase;
    }
  | {
      kind: 'summon';
      entityId?: string;
      targetZone?: string;
      stats?: Record<string, number>;
      tags?: string[];
      target?: 'self' | 'opponent';
      delayTurns?: number;
      phase?: Phase;
    };
```

## Завершение игры

Метод `engine.evaluateGameOver()` проверяет условия завершения. Он автоматически
вызывается после ключевых точек: окончания действия, окончания фазы и окончания хода.
Если обнаружены победители, движок выставляет `state.status = 'finished'`,
заполняет `winnerIds` и `finishedReason`, а также эмитит `gameFinished`.

### События завершения игры

- `playerEliminated` — игрок устранён (payload: `{ playerId, reason?, ruleId }`).
- `gameFinished` — игра завершена (payload: `{ winnerIds, reason? }`).
