import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GameEngine } from '../src/engine';

function createEngine() {
  return GameEngine.create({
    seed: 7,
    players: ['p1', 'p2'],
  });
}

test('GameEngine: цикл фаз в пределах хода', () => {
  // Проверяем последовательность фаз draw → main → combat → end.
  const engine = createEngine();

  engine.startTurn();
  assert.equal(engine.getState().phase, 'draw');

  engine.nextPhase();
  assert.equal(engine.getState().phase, 'main');

  engine.nextPhase();
  assert.equal(engine.getState().phase, 'combat');

  engine.nextPhase();
  assert.equal(engine.getState().phase, 'end');
});

test('GameEngine: смена активного игрока и переход хода', () => {
  // После завершения всех фаз активный игрок должен смениться.
  const engine = createEngine();

  engine.startTurn();
  engine.nextPhase();
  engine.nextPhase();
  engine.nextPhase();
  engine.nextPhase();

  const state = engine.getState();

  assert.equal(state.turn, 2);
  assert.equal(state.phase, 'draw');
  assert.equal(state.activePlayerId, 'p2');
});
