import { test, expect } from 'vitest';
import { assertValidReorder } from './images.service';

test('assertValidReorder accepts an exact bijection of the owned ids', () => {
  expect(() => assertValidReorder(['a', 'b'], ['b', 'a'])).not.toThrow();
});
test('assertValidReorder rejects duplicates even when length matches', () => {
  expect(() => assertValidReorder(['a', 'a'], ['a', 'b'])).toThrow();
});
test('assertValidReorder rejects a size mismatch', () => {
  expect(() => assertValidReorder(['a'], ['a', 'b'])).toThrow();
});
test('assertValidReorder rejects ids not owned by the trip', () => {
  expect(() => assertValidReorder(['a', 'x'], ['a', 'b'])).toThrow();
});
