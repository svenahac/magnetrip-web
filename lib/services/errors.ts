export type ServiceErrorKind =
  | 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'internal';

export class ServiceError extends Error {
  constructor(public readonly kind: ServiceErrorKind, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const httpStatusForKind: Record<ServiceErrorKind, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
};
