import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { ServiceError } from '@/lib/services/errors';
import { toHttpError } from './errors';

export interface RouteCtx {
  params: Promise<Record<string, string>>;
}

type Handler = (request: Request, ctx: RouteCtx) => Promise<Response>;

export function route(handler: Handler): Handler {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      const { status, message } = toHttpError(err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ServiceError('validation', 'Request body must be valid JSON');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ServiceError('validation', result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
