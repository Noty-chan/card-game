import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { GameState } from '../src/index';
import { GameEngine } from '../src/index';

const createState = (variant: 'a' | 'b'): GameState => {
  const stats =
    variant === 'a'
      ? new Map([
          ['attack', 3],
          ['hp', 5],
        ])
      : new Map([
          ['hp', 5],
          ['attack', 3],
        ]);
  const tags =
    variant === 'a'
      ? new Set(['elite', 'flying'])
      : new Set(['flying', 'elite']);
  const entityState =
    variant === 'a'
      ? { meta: { tier: 2, name: 'Alpha' }, effects: ['shield'] }
      : { effects: ['shield'], meta: { name: 'Alpha', tier: 2 } };

  const entity = {
    id: 'e1',
    type: 'unit',
    stats,
    tags,
    state: entityState,
  };
  const supportEntity = {
    id: 'e2',
    type: 'artifact',
    stats:
      variant === 'a'
        ? new Map([
            ['charge', 1],
            ['durability', 2],
          ])
        : new Map([
            ['durability', 2],
            ['charge', 1],
          ]),
    tags: variant === 'a' ? new Set(['rare']) : new Set(['rare']),
    state: variant === 'a' ? { bonus: 1 } : { bonus: 1 },
  };

  const playerOneZones =
    variant === 'a'
      ? { deck: ['c1'], hand: ['c2'], field: [] }
      : { field: [], hand: ['c2'], deck: ['c1'] };
  const playerTwoZones =
    variant === 'a'
      ? { deck: ['c3'], hand: [], field: ['e1'] }
      : { field: ['e1'], deck: ['c3'], hand: [] };

  const playerOne = {
    id: 'P1',
    zones: playerOneZones,
    resources: variant === 'a' ? { gold: 2, energy: 1 } : { energy: 1, gold: 2 },
  };
  const playerTwo = {
    id: 'P2',
    zones: playerTwoZones,
    resources: variant === 'a' ? { gold: 0, energy: 3 } : { energy: 3, gold: 0 },
  };

  const players =
    variant === 'a'
      ? { P1: playerOne, P2: playerTwo }
      : { P2: playerTwo, P1: playerOne };

  const entities =
    variant === 'a'
      ? { e1: entity, e2: supportEntity }
      : { e2: supportEntity, e1: entity };

  return {
    seed: 42,
    turn: 3,
    phase: 'main',
    activePlayerId: 'P1',
    playerOrder: ['P1', 'P2'],
    players,
    entities,
    log: ['turn:3'],
  };
};

test('снимок состояния восстанавливается без потерь', () => {
  const engine = new GameEngine(createState('a'));
  const snapshot = engine.exportState();
  const restored = GameEngine.importState(snapshot);

  assert.deepEqual(restored.exportState(), snapshot);
});

test('одинаковые состояния дают одинаковый JSON-снимок', () => {
  const engineA = new GameEngine(createState('a'));
  const engineB = new GameEngine(createState('b'));

  const jsonA = JSON.stringify(engineA.exportState());
  const jsonB = JSON.stringify(engineB.exportState());

  assert.equal(jsonA, jsonB);
});
