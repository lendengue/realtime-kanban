import Fastify, { type FastifyInstance } from 'fastify';

export interface BuildAppOptions {
  logLevel?: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.logLevel ?? 'info' },
  });

  app.get('/health', () => ({ status: 'ok', service: 'api' }) as const);

  return app;
}
