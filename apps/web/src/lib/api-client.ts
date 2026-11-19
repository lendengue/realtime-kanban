import { errorResponseSchema, type ErrorCode } from '@realtime-kanban/shared';
import type { z } from 'zod';

import { API_BASE } from './config';
import { session } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Validates and types the JSON response. */
  schema?: z.ZodType<T>;
  /** Retry once after refreshing the session on 401 (default: true). */
  retryOnUnauthorized?: boolean;
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = errorResponseSchema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', response.statusText || 'Request failed');
}

export async function apiRequest<T = void>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = 'GET', body, schema, retryOnUnauthorized = true } = options;

  const send = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const token = session.accessToken;
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  };

  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && retryOnUnauthorized && (await session.refresh())) {
      response = await send();
    }
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204 || !schema) return undefined as T;
  return schema.parse(await response.json());
}
