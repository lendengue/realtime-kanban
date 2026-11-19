import { Database as DatabaseExtension } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import type { Database } from '@realtime-kanban/db';
import type { AccessTokenService } from '@realtime-kanban/shared/access-token';
import type { Logger } from 'pino';

import { getBoardAccess, type BoardAccess } from './access.js';
import { loadBoardState, parseDocumentName, storeBoardState } from './documents.js';

export interface CreateCollabServerOptions {
  host: string;
  /** Use `0` to let the OS pick a free port (useful in tests). */
  port: number;
  logger: Logger;
  db: Database;
  accessTokens: AccessTokenService;
  debounceMs?: number;
  maxDebounceMs?: number;
}

/** Per-connection context returned by `onAuthenticate`. */
export interface ConnectionContext extends BoardAccess {
  userId: string;
  boardId: string;
}

/** Thrown to reject a connection; Hocuspocus reports it to the client as an auth failure. */
export class AccessDeniedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AccessDeniedError';
  }
}

export function createCollabServer({
  host,
  port,
  logger,
  db,
  accessTokens,
  debounceMs = 2000,
  maxDebounceMs = 10_000,
}: CreateCollabServerOptions): Server {
  const requireBoardId = (documentName: string): string => {
    const boardId = parseDocumentName(documentName);
    if (!boardId) throw new Error(`Invalid document name: ${documentName}`);
    return boardId;
  };

  return new Server({
    name: 'realtime-kanban-collab',
    address: host,
    port,
    quiet: true,
    // Shutdown is orchestrated by our entrypoint so documents can be flushed first.
    stopOnSignals: false,
    debounce: debounceMs,
    maxDebounce: maxDebounceMs,

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

    onAuthenticate: async ({
      token,
      documentName,
      connectionConfig,
    }): Promise<ConnectionContext> => {
      const boardId = parseDocumentName(documentName);
      if (!boardId) throw new AccessDeniedError('invalid-document');

      const claims = await accessTokens.verify(token);
      if (!claims) throw new AccessDeniedError('invalid-token');

      const access = await getBoardAccess(db, boardId, claims.userId);
      if (!access) throw new AccessDeniedError('forbidden');

      connectionConfig.readOnly = access.readOnly;
      logger.debug(
        { boardId, userId: claims.userId, role: access.role },
        'connection authenticated',
      );
      return { userId: claims.userId, boardId, ...access };
    },

    extensions: [
      new DatabaseExtension({
        fetch: ({ documentName }) => loadBoardState(db, requireBoardId(documentName)),
        store: async ({ documentName, state, document }) => {
          await storeBoardState(db, requireBoardId(documentName), state, document);
          logger.debug({ documentName }, 'document stored');
        },
      }),
    ],
  });
}
