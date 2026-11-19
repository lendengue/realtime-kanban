import {
  authResponseSchema,
  errorResponseSchema,
  loginBodySchema,
  meResponseSchema,
  registerBodySchema,
} from '@realtime-kanban/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { AppContext } from '../../context.js';
import { createAuthenticate, requireUserId } from '../../lib/authenticate.js';
import { notFound } from '../../lib/errors.js';
import { toUser } from '../../lib/mappers.js';
import { AuthService, invalidRefreshToken, type ClientInfo, type Session } from './service.js';

export const REFRESH_COOKIE = 'realtime_kanban_rt';
/** Mounted under /api/v1, so the cookie is only sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const;

const clientInfo = (request: FastifyRequest): ClientInfo => ({
  userAgent: request.headers['user-agent'],
  ip: request.ip,
});

export function authRoutes(ctx: AppContext): FastifyPluginCallbackZod {
  return (app, _options, done) => {
    const auth = new AuthService(ctx);
    const authenticate = createAuthenticate(ctx.accessTokens);

    const setRefreshCookie = (reply: FastifyReply, token: string) =>
      reply.setCookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: ctx.config.COOKIE_SECURE,
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
        maxAge: ctx.config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      });

    const clearRefreshCookie = (reply: FastifyReply) =>
      reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });

    const sessionResponse = (reply: FastifyReply, session: Session) => {
      setRefreshCookie(reply, session.refreshToken);
      return {
        accessToken: session.accessToken,
        expiresIn: ctx.config.ACCESS_TOKEN_TTL_SECONDS,
        user: toUser(session.user),
      };
    };

    app.post(
      '/register',
      {
        schema: {
          tags: ['auth'],
          summary: 'Create an account and start a session',
          body: registerBodySchema,
          response: { 201: authResponseSchema, 409: errorResponseSchema },
        },
      },
      async (request, reply) => {
        const session = await auth.register(request.body, clientInfo(request));
        return reply.status(201).send(sessionResponse(reply, session));
      },
    );

    app.post(
      '/login',
      {
        schema: {
          tags: ['auth'],
          summary: 'Start a session with e-mail and password',
          body: loginBodySchema,
          response: { 200: authResponseSchema, 401: errorResponseSchema, 429: errorResponseSchema },
        },
        config: {
          rateLimit: {
            ...LOGIN_RATE_LIMIT,
            // Runs after body parsing so the key can combine IP and e-mail.
            hook: 'preHandler',
            keyGenerator: (request: FastifyRequest) => {
              const body = request.body as { email?: unknown } | undefined;
              const email = typeof body?.email === 'string' ? body.email.toLowerCase() : '';
              return `login:${request.ip}:${email}`;
            },
          },
        },
      },
      async (request, reply) => {
        const session = await auth.login(request.body, clientInfo(request));
        return sessionResponse(reply, session);
      },
    );

    app.post(
      '/refresh',
      {
        schema: {
          tags: ['auth'],
          summary: 'Rotate the refresh token cookie and get a new access token',
          response: { 200: authResponseSchema, 401: errorResponseSchema },
        },
      },
      async (request, reply) => {
        const token = request.cookies[REFRESH_COOKIE];
        try {
          if (!token) throw invalidRefreshToken();
          const session = await auth.refresh(token, clientInfo(request));
          return sessionResponse(reply, session);
        } catch (error) {
          clearRefreshCookie(reply);
          throw error;
        }
      },
    );

    app.post(
      '/logout',
      {
        schema: {
          tags: ['auth'],
          summary: 'End the current session',
          response: { 204: z.null() },
        },
      },
      async (request, reply) => {
        const token = request.cookies[REFRESH_COOKIE];
        if (token) await auth.logout(token);
        clearRefreshCookie(reply);
        return reply.status(204).send(null);
      },
    );

    app.get(
      '/me',
      {
        preHandler: authenticate,
        schema: {
          tags: ['auth'],
          summary: 'Current user',
          security: [{ bearerAuth: [] }],
          response: { 200: meResponseSchema, 401: errorResponseSchema },
        },
      },
      async (request) => {
        const user = await auth.getUser(requireUserId(request));
        if (!user) throw notFound('User');
        return { user: toUser(user) };
      },
    );
    done();
  };
}
