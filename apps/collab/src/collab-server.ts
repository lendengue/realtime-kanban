import { Database as DatabaseExtension } from '@hocuspocus/extension-database';
import { Server, type onTokenSyncPayload } from '@hocuspocus/server';
import { upgradeBoard } from '@realtime-kanban/board-doc';
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

/**
 * Thrown to reject a connection (reported to the client as an authentication failure) or, from
 * `onTokenSync`, to close it. Hocuspocus reads `reason` and sends it to the client.
 */
export class AccessDeniedError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'AccessDeniedError';
    this.reason = reason;
  }
}

/** Close reason sent when a renewed token carries a different role: the client reconnects. */
export const PERMISSIONS_CHANGED = 'permissions-changed';

/** Transaction origin of server-side schema upgrades. */
const UPGRADE_ORIGIN = 'realtime-kanban:upgrade';

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

    // Clients send a renewed access token on the open connection whenever their session is
    // refreshed (ADR 0022). It must still be valid and belong to the same user; the role is
    // checked again, so a removed member is disconnected and a changed role reconnects with the
    // new scope.
    onTokenSync: async ({ token, context, connection }: onTokenSyncPayload<ConnectionContext>) => {
      const claims = await accessTokens.verify(token);
      if (claims?.userId !== context.userId) {
        throw new AccessDeniedError('invalid-token');
      }
      const access = await getBoardAccess(db, context.boardId, context.userId);
      if (!access) throw new AccessDeniedError('forbidden');
      if (access.readOnly !== connection.readOnly) {
        logger.debug({ boardId: context.boardId, userId: context.userId }, 'scope changed');
        connection.close({ code: 4000, reason: PERMISSIONS_CHANGED });
      }
    },

    afterLoadDocument: ({ document, documentName }) => {
      const upgraded = upgradeBoard(document, { origin: UPGRADE_ORIGIN });
      if (upgraded > 0) logger.info({ documentName, upgraded }, 'document upgraded');
      return Promise.resolve();
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
