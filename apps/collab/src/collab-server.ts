import { Server } from '@hocuspocus/server';
import type { Logger } from 'pino';

export interface CreateCollabServerOptions {
  host: string;
  /** Use `0` to let the OS pick a free port (useful in tests). */
  port: number;
  logger: Logger;
}

export function createCollabServer({ host, port, logger }: CreateCollabServerOptions): Server {
  return new Server({
    name: 'realtime-kanban-collab',
    address: host,
    port,
    quiet: true,
    // Shutdown is orchestrated by our entrypoint so documents can be flushed first.
    stopOnSignals: false,

    onListen: ({ port: boundPort }) => {
      logger.info({ host, port: boundPort }, 'collab server listening');
      return Promise.resolve();
    },

    onRequest: async ({ request, response }) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok', service: 'collab' }));
        // Hocuspocus convention: rejecting with an empty value stops the hook chain
        // and skips its default "Welcome to Hocuspocus!" response.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject();
      }
    },
  });
}
