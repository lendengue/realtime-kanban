import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { ErrorResponse } from '@realtime-kanban/shared';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import type { AppContext } from './context.js';
import { AppError } from './lib/errors.js';
import { authRoutes } from './modules/auth/routes.js';
import { boardRoutes } from './modules/boards/routes.js';
import { workspaceRoutes } from './modules/workspaces/routes.js';

export const API_PREFIX = '/api/v1';

const errorBody = (code: ErrorResponse['error']['code'], message: string, details?: unknown) => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: ctx.config.LOG_LEVEL },
    // Trust X-Forwarded-* only behind a reverse proxy (production).
    trustProxy: ctx.config.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest('userId', null);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(errorBody(error.code, error.message, error.details));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .status(400)
        .send(errorBody('VALIDATION_ERROR', 'Request validation failed', error.validation));
    }
    if (error.statusCode === 429) {
      return reply.status(429).send(errorBody('RATE_LIMITED', 'Too many requests, slow down'));
    }
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      // Malformed JSON, unsupported media type, payload too large...
      return reply.status(error.statusCode).send(errorBody('VALIDATION_ERROR', error.message));
    }
    request.log.error(error);
    return reply.status(500).send(errorBody('INTERNAL_ERROR', 'Something went wrong'));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(errorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );

  await app.register(cors, {
    origin: [ctx.config.WEB_ORIGIN],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(cookie);
  // Opt-in per route (see the login route).
  await app.register(rateLimit, { global: false });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'realtime-kanban API',
        description: 'REST API for auth, workspaces, members, invitations and boards.',
        version: '1.0.0',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', { schema: { hide: true } }, () => ({ status: 'ok', service: 'api' }) as const);

  await app.register(
    async (api) => {
      await api.register(authRoutes(ctx), { prefix: '/auth' });
      await api.register(workspaceRoutes(ctx));
      await api.register(boardRoutes(ctx));
    },
    { prefix: API_PREFIX },
  );

  return app;
}
