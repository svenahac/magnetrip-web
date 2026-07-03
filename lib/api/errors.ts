import { ZodError } from 'zod';
import { ServiceError, httpStatusForKind } from '@/lib/services/errors';

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof ServiceError) {
    return { status: httpStatusForKind[err.kind], message: err.message };
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return { status: 400, message: first?.message ?? 'Invalid request' };
  }
  return { status: 500, message: 'Internal server error' };
}
