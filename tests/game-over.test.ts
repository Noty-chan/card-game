import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { RuleModule } from '../src/index';
import { GameEngine } from '../src/index';

test('одиночный победитель завершает игру', () => {
  const victoryRule: RuleModule = {
    name: 'single-winner',
    register: (engine) => {
      engine.registerVictoryRule({
        id: 'single-winner-rule',
        evaluate: () => ({
          winnerIds: ['P1'],
          finishedReason: 'победа по тесту',
        }),
      });
    },
  };

  const engine = GameEngine.create({
    seed: 1,
    players: ['P1', 'P2'],
    rules: [victoryRule],
  });

  let finishedPayload: { winnerIds: string[]; reason?: string } | undefined;
  engine.bus.subscribe('gameFinished', (event) => {
    finishedPayload = event.payload as typeof finishedPayload;
  });

  engine.dispatchAction({
    type: 'endPhase',
    playerId: 'P1',
  });

  assert.equal(engine.getState().status, 'finished');
  assert.deepEqual(engine.getState().winnerIds, ['P1']);
  assert.equal(engine.getState().finishedReason, 'победа по тесту');
  assert.deepEqual(finishedPayload, {
    winnerIds: ['P1'],
    reason: 'победа по тесту',
  });
});

test('ничья и несколько победителей поддерживаются', () => {
  const victoryRule: RuleModule = {
    name: 'multi-winner',
    register: (engine) => {
      engine.registerVictoryRule({
        id: 'multi-winner-rule',
        evaluate: () => ({
          winnerIds: ['P2', 'P1'],
          finishedReason: 'ничья',
        }),
      });
    },
  };

  const engine = GameEngine.create({
    seed: 7,
    players: ['P1', 'P2'],
    rules: [victoryRule],
  });

  engine.dispatchAction({
    type: 'endPhase',
    playerId: 'P1',
  });

  assert.equal(engine.getState().status, 'finished');
  assert.deepEqual(engine.getState().winnerIds, ['P1', 'P2']);
  assert.equal(engine.getState().finishedReason, 'ничья');
});

test('после завершения игры команды блокируются', () => {
  const victoryRule: RuleModule = {
    name: 'instant-win',
    register: (engine) => {
      engine.registerVictoryRule({
        id: 'instant-win-rule',
        evaluate: () => ({
          winnerIds: ['P1'],
        }),
      });
    },
  };

  const engine = GameEngine.create({
    seed: 3,
    players: ['P1', 'P2'],
    rules: [victoryRule],
  });

  engine.dispatchAction({
    type: 'endPhase',
    playerId: 'P1',
  });

  const blocked = engine.dispatchAction({
    type: 'endPhase',
    playerId: 'P1',
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors?.[0]?.code, 'game_finished');
});
