import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CardRegistry, GameEngine } from '../src/index';

test('реестр карт загружает несколько описаний', () => {
  const registry = new CardRegistry();
  registry.registerCards([
    {
      id: 'core:alpha',
      name: 'Альфа',
      type: 'spell',
      cost: 1,
      effects: [{ kind: 'gainResource', amount: 1, resource: 'mana' }],
    },
    {
      id: 'core:beta',
      name: 'Бета',
      type: 'unit',
      cost: 2,
      effects: [{ kind: 'summon', targetZone: 'field' }],
    },
  ]);

  assert.equal(registry.getCard('core:alpha')?.name, 'Альфа');
  assert.equal(registry.getCard('core:beta')?.type, 'unit');
});

test('эффекты карты применяются детерминированно', () => {
  const registry = new CardRegistry();
  const ritualCard = {
    id: 'core:ritual',
    name: 'Ритуал',
    type: 'spell',
    cost: 1,
    effects: [
      {
        kind: 'gainResource',
        amount: 2,
        resource: 'mana',
      },
      {
        kind: 'draw',
        amount: 1,
        delayTurns: 1,
        phase: 'draw',
      },
    ],
  } as const;

  registry.registerCard(ritualCard);

  const run = () => {
    const engine = GameEngine.create({
      seed: 11,
      players: ['P1', 'P2'],
      cardRegistry: registry,
    });

    engine.getState().players.P1.zones.hand.push(ritualCard.id);
    engine.getState().players.P1.zones.deck.push('deck-card');

    engine.dispatchAction({
      type: 'playCard',
      playerId: 'P1',
      cardId: ritualCard.id,
    });

    engine.endTurn();

    return JSON.parse(JSON.stringify(engine.getState()));
  };

  const first = run();
  const second = run();

  assert.equal(first.players.P1.resources.mana, 2);
  assert.deepEqual(first.players.P1.zones.hand, ['deck-card']);
  assert.deepEqual(first, second);
});

test('ошибка поднимается при некорректной схеме карты', () => {
  const registry = new CardRegistry();

  assert.throws(
    () =>
      registry.registerCard({
        id: 'core:broken',
        name: 'Сломанная карта',
        type: 'spell',
        cost: 1,
        effects: [
          {
            kind: 'teleport',
            amount: 1,
          },
        ],
      } as never),
    /Некорректная схема карты/,
  );
});
