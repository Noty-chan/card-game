import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { GameState, RuleModule } from '../src/index';
import { GameEngine } from '../src/index';

const scenarioRule: RuleModule = {
  name: 'determinism-scenario',
  register: (engine) => {
    engine.bus.subscribe('turnStart', (_event, context) => {
      const roll = Math.floor(engine.rng.next() * 10);
      const playerId = context.state.activePlayerId;
      const resources = context.state.players[playerId].resources;
      resources.energy = (resources.energy ?? 0) + roll;
      context.state.log.push(
        `roll:${context.state.turn}:${playerId}:${roll}`,
      );
    });

    engine.bus.subscribe<{ phase: string }>('phaseStart', (event, context) => {
      context.state.log.push(
        `phase:${context.state.turn}:${event.payload?.phase ?? 'unknown'}`,
      );
    });
  },
};

const snapshotState = (state: GameState) =>
  JSON.parse(JSON.stringify(state)) as GameState;

const runScenario = (seed: number) => {
  const engine = GameEngine.create({
    seed,
    players: ['P1', 'P2'],
    rules: [scenarioRule],
  });

  engine.startTurn();

  for (let step = 0; step < 8; step += 1) {
    engine.nextPhase();
  }

  return snapshotState(engine.getState());
};

test('детерминированный сценарий с одинаковым seed выдаёт одинаковое состояние', () => {
  const firstRun = runScenario(1337);
  const secondRun = runScenario(1337);

  assert.deepEqual(firstRun, secondRun);
});
