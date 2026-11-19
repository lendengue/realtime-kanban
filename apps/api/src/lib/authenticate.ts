import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';

import type { AccessTokenService } from './access-token.js';
import { unauthenticated } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the `authenticate` hook on protected routes. */
    userId: string | null;
  }
}

/** preHandler that requires a valid `Authorization: Bearer <access token>` header. */
export function createAuthenticate(accessTokens: AccessTokenService): preHandlerAsyncHookHandler {
  return async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw unauthenticated();

    const claims = await accessTokens.verify(token);
    if (!claims) throw unauthenticated('Access token is invalid or expired');

    request.userId = claims.userId;
  };
}

/** Reads the authenticated user id; only valid inside routes guarded by `authenticate`. */
export function requireUserId(request: FastifyRequest): string {
  if (!request.userId) throw unauthenticated();
  return request.userId;
}
