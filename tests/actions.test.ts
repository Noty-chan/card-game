import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { GameAction, GameState } from '../src/index';
import { GameEngine } from '../src/index';

const snapshotState = (state: GameState) =>
  JSON.parse(JSON.stringify(state)) as GameState;

test('валидная команда меняет состояние', () => {
  const engine = GameEngine.create({
    seed: 1,
    players: ['P1'],
  });

  engine.getState().players.P1.zones.hand.push('card-1');

  const result = engine.dispatchAction({
    type: 'playCard',
    playerId: 'P1',
    cardId: 'card-1',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(engine.getState().players.P1.zones.hand, []);
  assert.deepEqual(engine.getState().players.P1.zones.field, ['card-1']);
});

test('невалидная команда не меняет состояние', () => {
  const engine = GameEngine.create({
    seed: 2,
    players: ['P1'],
  });

  const before = snapshotState(engine.getState());
  const result = engine.dispatchAction({
    type: 'playCard',
    playerId: 'P1',
    cardId: 'missing-card',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(engine.getState(), before);
});

test('одинаковый seed и команды дают одинаковые состояние и лог', () => {
  const commands: GameAction[] = [
    {
      type: 'playCard',
      playerId: 'P1',
      cardId: 'card-1',
    },
    {
      type: 'endPhase',
      playerId: 'P1',
    },
  ];

  const run = () => {
    const engine = GameEngine.create({
      seed: 42,
      players: ['P1'],
    });
    engine.getState().players.P1.zones.hand.push('card-1');

    for (const command of commands) {
      engine.dispatchAction(command);
    }

    return snapshotState(engine.getState());
  };

  const firstRun = run();
  const secondRun = run();

  assert.deepEqual(firstRun, secondRun);
});
