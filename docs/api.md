# Публичный API движка

## EngineConfig

`EngineConfig` — входная конфигурация при создании движка.

| Поле | Тип | Описание |
| --- | --- | --- |
| `seed` | `number` | Сид для детерминированного RNG. |
| `players` | `PlayerId[]` | Список идентификаторов игроков в порядке ходов. Должен быть непустым. |
| `zones` | `string[]` | Список зон, которые будут созданы для каждого игрока. По умолчанию: `hand`, `deck`, `discard`, `exile`, `field`. |
| `rules` | `RuleModule[]` | Список модулей правил, регистрируемых при создании движка. |
| `plugins` | `EnginePlugin[]` | Список плагинов, подключаемых после регистрации правил. |

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
    engine.bus.on('turnStart', (event, context) => {
      engine.log(`Старт хода ${event.payload?.turn} для ${context.activePlayerId}`);
    });
  },
};

const debugPlugin = {
  name: 'debug-plugin',
  onRegister(engine: GameEngine) {
    engine.bus.on('*', (event) => {
      engine.log(`Событие: ${event.type}`);
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
