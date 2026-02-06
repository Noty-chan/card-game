import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { GameEngine } from '../src/index';

test('отложенные действия выполняются в детерминированном порядке по фазе и приоритету', () => {
  const engine = GameEngine.create({
    seed: 7,
    players: ['P1', 'P2'],
  });

  engine.scheduleAction({
    id: 'draw-low',
    phase: 'draw',
    priority: 1,
    run: (context) => {
      context.state.log.push('draw-low');
    },
  });

  engine.scheduleAction({
    id: 'draw-high',
    phase: 'draw',
    priority: 10,
    run: (context) => {
      context.state.log.push('draw-high');
    },
  });

  engine.scheduleAction({
    id: 'combat',
    phase: 'combat',
    priority: 5,
    run: (context) => {
      context.state.log.push('combat');
    },
  });

  engine.startTurn();
  assert.deepEqual(engine.getState().log, ['draw-high', 'draw-low']);

  engine.nextPhase();
  assert.deepEqual(engine.getState().log, ['draw-high', 'draw-low']);

  engine.nextPhase();
  assert.deepEqual(engine.getState().log, ['draw-high', 'draw-low', 'combat']);
});

test('отложенные действия могут безопасно планировать новые действия на следующую фазу', () => {
  const engine = GameEngine.create({
    seed: 9,
    players: ['P1'],
  });

  engine.scheduleAction({
    id: 'setup',
    phase: 'draw',
    run: (context) => {
      context.state.log.push('setup');
      engine.scheduleAction({
        id: 'main-follow-up',
        phase: 'main',
        run: (nextContext) => {
          nextContext.state.log.push('main-follow-up');
        },
      });
    },
  });

  engine.startTurn();
  assert.deepEqual(engine.getState().log, ['setup']);

  engine.nextPhase();
  assert.deepEqual(engine.getState().log, ['setup', 'main-follow-up']);
});

test('движок ограничивает бесконечное самопланирование отложенных действий', () => {
  const engine = GameEngine.create({
    seed: 1,
    players: ['P1'],
    maxEventChain: 6,
  });

  const planLoop = (): void => {
    engine.scheduleAction({
      id: 'loop',
      phase: 'draw',
      run: () => {
        planLoop();
      },
    });
  };

  planLoop();

  assert.throws(
    () => engine.startTurn(),
    /Превышен лимит разрешения отложенных действий \(6\)/,
  );
});
