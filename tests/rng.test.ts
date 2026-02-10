import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SeededRNG } from '../src/rng';

test('SeededRNG: повторяемость последовательности', () => {
  // Один и тот же сид должен давать одну и ту же последовательность.
  const rngA = new SeededRNG(42);
  const rngB = new SeededRNG(42);

  const sequenceA = Array.from({ length: 5 }, () => rngA.next());
  const sequenceB = Array.from({ length: 5 }, () => rngB.next());

  assert.deepEqual(sequenceA, sequenceB);
});

test('SeededRNG: разные сиды дают разные последовательности', () => {
  // Разные сиды должны давать отличающиеся значения.
  const rngA = new SeededRNG(1);
  const rngB = new SeededRNG(2);

  const valueA = rngA.next();
  const valueB = rngB.next();

  assert.notEqual(valueA, valueB);
});
