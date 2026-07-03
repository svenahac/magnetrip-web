import { test, expect } from 'vitest';
import { ServiceError, httpStatusForKind } from './errors';

test('ServiceError carries kind and message', () => {
  const e = new ServiceError('not_found', 'Trip not found');
  expect(e.kind).toBe('not_found');
  expect(e.message).toBe('Trip not found');
  expect(e instanceof Error).toBe(true);
});

test('httpStatusForKind maps every kind', () => {
  expect(httpStatusForKind.unauthorized).toBe(401);
  expect(httpStatusForKind.forbidden).toBe(403);
  expect(httpStatusForKind.not_found).toBe(404);
  expect(httpStatusForKind.validation).toBe(400);
  expect(httpStatusForKind.conflict).toBe(409);
  expect(httpStatusForKind.internal).toBe(500);
});
