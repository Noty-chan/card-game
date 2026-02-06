import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { RuleModule } from '../src/index';
import { GameEngine, normalizeEngineConfig } from '../src/index';

const recursiveRule: RuleModule = {
  name: 'recursive-rule',
  register: (engine) => {
    engine.bus.subscribe('loop', () => {
      engine.emitEvent('loop');
    });
  },
};

test('normalizeEngineConfig задаёт дефолтный лимит цепочки событий', () => {
  const config = normalizeEngineConfig({
    seed: 1,
    players: ['P1'],
  });

  assert.equal(config.maxEventChain, 1024);
});

test('движок прерывает бесконечную рекурсию событий по лимиту', () => {
  const engine = GameEngine.create({
    seed: 1,
    players: ['P1'],
    maxEventChain: 8,
    rules: [recursiveRule],
  });

  assert.throws(
    () => engine.emitEvent('loop'),
    /Превышен лимит цепочки событий \(8\)/,
  );
});
