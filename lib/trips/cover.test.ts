import { test, expect } from 'vitest';
import { coverAfterAdd, coverAfterDelete } from './cover';

const img = (id: string, position: number) => ({ id, position });

test('coverAfterAdd promotes the first image of a coverless trip', () => {
  expect(coverAfterAdd(null, 'i1')).toBe('i1');
});

test('coverAfterAdd leaves an existing cover alone', () => {
  expect(coverAfterAdd('i1', 'i2')).toBe('i1');
});

test('coverAfterDelete leaves the cover alone when another image goes', () => {
  expect(coverAfterDelete('i1', 'i2', [img('i1', 0)])).toBe('i1');
  expect(coverAfterDelete(null, 'i2', [img('i1', 0)])).toBeNull();
});

test('coverAfterDelete promotes the lowest position, not the array order', () => {
  const remaining = [img('c', 2), img('b', 1)];
  expect(coverAfterDelete('a', 'a', remaining)).toBe('b');
});

test('coverAfterDelete clears the cover when the last image goes', () => {
  expect(coverAfterDelete('a', 'a', [])).toBeNull();
});
