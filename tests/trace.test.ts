import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Effect, RuleModule } from '../src/index';
import { GameEngine } from '../src/index';

const runTraceScenario = () => {
  const engine = GameEngine.create({
    seed: 42,
    players: ['P1'],
    traceEnabled: true,
    traceLimit: 20,
  });

  engine.startTurn();

  const effects: Effect[] = [
    {
      id: 'effect-1',
      priority: 1,
      apply: () => {
        engine.emitEvent('customEvent');
      },
    },
  ];

  engine.applyEffects(effects);

  return engine.getTrace().map((entry) => ({
    sourceType: entry.sourceType,
    eventType: entry.eventType,
    sourceId: entry.sourceId,
  }));
};

test('trace сохраняет детерминированный порядок', () => {
  const firstRun = runTraceScenario();
  const secondRun = runTraceScenario();

  assert.deepEqual(firstRun, secondRun);
});

test('trace сохраняет корректную глубину вложенности', () => {
  const nestedRule: RuleModule = {
    name: 'trace-depth',
    register: (engine) => {
      engine.bus.subscribe('turnStart', () => {
        engine.emitEvent('nestedEvent');
      });
    },
  };

  const engine = GameEngine.create({
    seed: 1,
    players: ['P1'],
    rules: [nestedRule],
    traceEnabled: true,
    traceLimit: 20,
  });

  engine.startTurn();

  const trace = engine.getTrace();
  const turnStartEntry = trace.find((entry) => entry.eventType === 'turnStart');
  const nestedEntry = trace.find((entry) => entry.eventType === 'nestedEvent');

  assert.ok(turnStartEntry);
  assert.ok(nestedEntry);
  assert.equal(turnStartEntry.depth, 0);
  assert.equal(nestedEntry.depth, 1);
});

test('trace соблюдает лимит буфера', () => {
  const engine = GameEngine.create({
    seed: 7,
    players: ['P1'],
    traceEnabled: true,
    traceLimit: 2,
  });

  engine.startTurn();

  const trace = engine.getTrace();

  assert.equal(trace.length, 2);
  assert.deepEqual(
    trace.map((entry) => entry.eventType),
    ['phaseStart', 'flushScheduledActions'],
  );
});
