import { test, expect } from 'vitest';
import { z } from 'zod';
import { extractBearerToken, toHttpError } from './errors';
import { ServiceError } from '@/lib/services/errors';

test('extractBearerToken parses a Bearer header, else null', () => {
  expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
  expect(extractBearerToken('bearer abc')).toBe('abc'); // case-insensitive scheme
  expect(extractBearerToken('Basic xyz')).toBeNull();
  expect(extractBearerToken(null)).toBeNull();
  expect(extractBearerToken('')).toBeNull();
});

test('toHttpError maps ServiceError to its status + message', () => {
  expect(toHttpError(new ServiceError('not_found', 'nope'))).toEqual({ status: 404, message: 'nope' });
  expect(toHttpError(new ServiceError('validation', 'bad'))).toEqual({ status: 400, message: 'bad' });
});

test('toHttpError maps ZodError to 400 with a message', () => {
  const zerr = z.object({ a: z.string() }).safeParse({});
  const out = toHttpError((zerr as { error: unknown }).error);
  expect(out.status).toBe(400);
  expect(out.message.length).toBeGreaterThan(0);
});

test('toHttpError maps unknown errors to 500 generic', () => {
  expect(toHttpError(new Error('leak me'))).toEqual({ status: 500, message: 'Internal server error' });
  expect(toHttpError('weird')).toEqual({ status: 500, message: 'Internal server error' });
});
