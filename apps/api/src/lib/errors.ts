import type { ErrorCode } from '@realtime-kanban/shared';

/** Error that maps directly to the API error format `{ error: { code, message, details } }`. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthenticated = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const forbidden = (message = 'You do not have permission to do this') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);
