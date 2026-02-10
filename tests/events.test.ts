import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventBus } from '../src/events';
import type { GameContext, GameState } from '../src/types';

function createContext(activePlayerId = 'p1'): GameContext {
  const state: GameState = {
    seed: 1,
    turn: 1,
    phase: 'draw',
    activePlayerId,
    playerOrder: [activePlayerId],
    players: {
      [activePlayerId]: {
        id: activePlayerId,
        zones: { hand: [] },
        resources: {},
      },
    },
    entities: {},
    log: [],
  };

  return { state, activePlayerId };
}

test('EventBus: приоритеты и порядок подписки', () => {
  // Проверяем, что приоритет выше выполняется раньше,
  // а при равном приоритете сохраняется порядок подписки.
  const bus = new EventBus();
  const calls: string[] = [];
  const context = createContext();

  bus.subscribe('ping', () => calls.push('низкий'), 0);
  bus.subscribe('ping', () => calls.push('высокий'), 10);
  bus.subscribe('ping', () => calls.push('средний-1'), 5);
  bus.subscribe('ping', () => calls.push('средний-2'), 5);

  bus.emit({ type: 'ping' }, context);

  assert.deepEqual(calls, ['высокий', 'средний-1', 'средний-2', 'низкий']);
});

test('EventBus: фильтр пропускает неподходящие события', () => {
  // Фильтр должен блокировать обработчик, если условие не выполнено.
  const bus = new EventBus();
  const calls: string[] = [];
  const context = createContext('p2');

  bus.subscribe(
    'turn',
    () => calls.push('должен-отработать'),
    0,
    (event, ctx) => event.payload === 'ok' && ctx.activePlayerId === 'p2',
  );
  bus.subscribe(
    'turn',
    () => calls.push('не-должен-отработать'),
    0,
    (event) => event.payload === 'skip',
  );

  bus.emit({ type: 'turn', payload: 'ok' }, context);

  assert.deepEqual(calls, ['должен-отработать']);
});
