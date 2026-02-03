import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameContext, GameState } from '../src/types';
import { resolveEffects, type Effect } from '../src/effects';

function createContext(): GameContext {
  const state: GameState = {
    seed: 1,
    turn: 1,
    phase: 'draw',
    activePlayerId: 'p1',
    playerOrder: ['p1'],
    players: {
      p1: {
        id: 'p1',
        zones: { hand: [] },
        resources: {},
      },
    },
    entities: {},
    log: [],
  };

  return { state, activePlayerId: 'p1' };
}

test('resolveEffects: сортировка по priority и id', () => {
  // Приоритет выше выполняется раньше, при равном приоритете сортировка по id.
  const context = createContext();
  const calls: string[] = [];
  const effects: Effect[] = [
    {
      id: 'b-effect',
      priority: 2,
      apply: () => calls.push('b-effect'),
    },
    {
      id: 'a-effect',
      priority: 2,
      apply: () => calls.push('a-effect'),
    },
    {
      id: 'c-effect',
      priority: 1,
      apply: () => calls.push('c-effect'),
    },
  ];

  resolveEffects(effects, context);

  assert.deepEqual(calls, ['a-effect', 'b-effect', 'c-effect']);
});
