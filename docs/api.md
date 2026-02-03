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

## normalizeEngineConfig

`normalizeEngineConfig(config)` возвращает нормализованную конфигурацию с заполненными
значениями по умолчанию (`zones`, `rules`, `plugins`). Функция также валидирует базовые
условия, например наличие хотя бы одного игрока.

### NormalizedEngineConfig

Результат нормализации всегда содержит полные списки:

| Поле | Тип | Описание |
| --- | --- | --- |
| `zones` | `string[]` | Зоны с учётом дефолтов. |
| `rules` | `RuleModule[]` | Модули правил (может быть пустым массивом). |
| `plugins` | `EnginePlugin[]` | Плагины (может быть пустым массивом). |

## Контракты RuleModule и EnginePlugin

```ts
export interface RuleModule {
  name: string;
  register: (engine: GameEngine) => void;
}

export interface EnginePlugin {
  name: string;
  onRegister?: (engine: GameEngine) => void;
}
```

- `RuleModule.register(...)` вызывается всегда и служит для регистрации правил, обработчиков событий и эффектов.
- `EnginePlugin.onRegister(...)` опционален и вызывается при подключении плагина.

### Порядок регистрации

При вызове `GameEngine.create(...)` сначала регистрируются все правила из `config.rules`, затем подключаются плагины из `config.plugins`. Это позволяет плагинам опираться на уже зарегистрированные правила.

## Пример инициализации

```ts
import { GameEngine } from '../src/engine';

const coreRules = {
  name: 'core-rules',
  register(engine: GameEngine) {
    engine.bus.subscribe('turnStart', (event, context) => {
      engine.log(`Старт хода ${event.payload?.turn} для ${context.activePlayerId}`);
    });
  },
};

const debugPlugin = {
  name: 'debug-plugin',
  onRegister(engine: GameEngine) {
    engine.bus.subscribe('phaseStart', (event) => {
      engine.log(`Фаза: ${event.payload?.phase ?? 'unknown'}`);
    });
    engine.bus.subscribe('turnEnd', (event) => {
      engine.log(`Конец хода ${event.payload?.turn ?? 'unknown'}`);
    });
  },
};

const engine = GameEngine.create({
  seed: 42,
  players: ['p1', 'p2'],
  zones: ['hand', 'deck', 'discard'],
  rules: [coreRules],
  plugins: [debugPlugin],
});

engine.startTurn();
```
