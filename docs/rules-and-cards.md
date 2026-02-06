# Правила и данные карт (JSON5)

Этот документ описывает, как хранить данные карт в JSON5, как подключать их при запуске движка и как связывать карточные данные с правилами через `RuleModule`.

## Пример набора карт

Файл `examples/cards/basic.json5` содержит минимальный набор карт для демонстрации формата.

```json5
{
  set: 'basic',
  version: 1,
  cards: [
    {
      id: 'core:soldier',
      name: 'Пехотинец',
      type: 'unit',
      cost: 1,
      text: 'Простой юнит для ранних ходов.',
      tags: ['unit', 'human'],
      stats: {
        attack: 1,
        health: 1,
      },
      rules: ['unit.basicAttack'],
      effects: [
        {
          kind: 'summon',
          targetZone: 'field',
        },
      ],
    },
  ],
}
```

## Ключи и структура

- `set` — идентификатор набора карт (строка).
- `version` — версия схемы набора (число), полезно для миграций.
- `cards` — массив описаний карт.

### Поля карты

- `id` — уникальный идентификатор карты, желательно в формате `namespace:name`.
- `name` — отображаемое имя карты.
- `type` — тип карты (например, `unit`, `spell`).
- `cost` — базовая стоимость розыгрыша.
- `text` — краткое описание эффекта (для UI/логов).
- `tags` — массив тегов для фильтрации/поиска.
- `stats` — опциональные характеристики, например `{ attack, health }` для юнитов.
- `rules` — массив идентификаторов правил/эффектов, которые должны применяться к карте.
- `effects` — необязательный массив декларативных эффектов карты (минимальный DSL).

## Минимальный DSL эффектов

Минимальный набор эффектов хранится прямо в JSON5 и преобразуется в runtime-эффекты
ядра:

- `draw` — добор карт.
- `damage` — урон по ресурсу (по умолчанию `health`).
- `gainResource` — получение ресурса.
- `summon` — создание сущности и помещение её в зону.

Общие поля эффектов:
- `delayTurns` — задержка в ходах (опционально).
- `phase` — фаза, в которой эффект должен быть разрешён (опционально).
- `priority` — приоритет разрешения эффектов.

Пример эффектов:

```json5
{
  kind: 'draw',
  amount: 2,
  target: 'self',
}
{
  kind: 'damage',
  amount: 3,
  target: 'opponent',
  delayTurns: 1,
  phase: 'draw',
}
```

## Сценарии загрузки и инициализации

Ниже пример сценария, где данные карт загружаются из JSON5 и передаются в модуль правил.

```ts
import fs from 'node:fs';
import JSON5 from 'json5';
import { CardRegistry, GameEngine } from '../src/engine';
import { createCardRules } from '../src/rules/cards';

const raw = fs.readFileSync('examples/cards/basic.json5', 'utf8');
const cardSet = JSON5.parse(raw);
const cardRegistry = new CardRegistry();
cardRegistry.registerCardSet(cardSet);

const engine = GameEngine.create({
  seed: 42,
  players: ['p1', 'p2'],
  zones: ['hand', 'deck', 'discard'],
  rules: [createCardRules(cardSet)],
  cardRegistry,
});

engine.startTurn();
```

В таком сценарии:
- JSON5 хранит только данные карт.
- Логика находится в правилах, подключаемых через `RuleModule`.
- UI может отдельно использовать `cardSet` для отображения.

## Реестр карт и розыгрыш

`CardRegistry` хранит проверенные описания карт и позволяет ядру получать
определение карты при `dispatchAction({ type: 'playCard', ... })`. Это нужно для
преобразования DSL эффектов в runtime-эффекты и постановки отложенных действий.

## Связь данных карт с правилами через RuleModule

`RuleModule` получает данные карт и регистрирует соответствующие обработчики. Типовой подход:

1. Загрузить набор карт и построить индекс `id -> описание карты`.
2. Внутри `RuleModule.register(...)` зарегистрировать обработчики и эффекты для всех `rules` каждой карты.
3. При обработке события использовать данные из `effects` или `stats` конкретной карты.

Пример каркасного модуля:

```ts
import { RuleModule } from '../src/engine';

export function createCardRules(cardSet: { cards: Array<{ id: string; rules?: string[] }> }): RuleModule {
  return {
    name: 'card-rules',
    register(engine) {
      const cardIndex = new Map(cardSet.cards.map((card) => [card.id, card]));

      engine.bus.subscribe('cardPlayed', (event) => {
        const card = cardIndex.get(event.payload.cardId);
        if (!card?.rules) return;

        for (const ruleId of card.rules) {
          engine.bus.emit('ruleTriggered', { ruleId, cardId: card.id });
        }
      });
    },
  };
}
```

Такой подход сохраняет разделение данных и логики: JSON5 содержит только факты о карте, а правила описывают поведение.
