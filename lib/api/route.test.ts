import { test, expect } from 'vitest';
import { z } from 'zod';
import { parseBody } from './route';

const req = (body: unknown) =>
  new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

test('parseBody returns validated data', async () => {
  const schema = z.object({ name: z.string() });
  await expect(parseBody(req({ name: 'ok' }), schema)).resolves.toEqual({ name: 'ok' });
});

test('parseBody throws a validation ServiceError on bad input', async () => {
  const schema = z.object({ name: z.string() });
  await expect(parseBody(req({ name: 1 }), schema)).rejects.toMatchObject({ kind: 'validation' });
});

test('parseBody throws validation on non-JSON body', async () => {
  const bad = new Request('http://x/api', { method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' } });
  await expect(parseBody(bad, z.object({ name: z.string() }))).rejects.toMatchObject({ kind: 'validation' });
});
