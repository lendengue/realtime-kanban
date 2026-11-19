import { HocuspocusProvider } from '@hocuspocus/provider';
import type { Server } from '@hocuspocus/server';
import { createDatabase, schema, type DatabaseConnection } from '@realtime-kanban/db';
import type { WorkspaceRole } from '@realtime-kanban/shared';
import { AccessTokenService } from '@realtime-kanban/shared/access-token';
import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeAll, beforeEach, inject } from 'vitest';
import * as Y from 'yjs';

import { createCollabServer } from '../collab-server.js';

const SECRET = 'collab-test-secret-collab-test-secret-1';

export interface CollabHarness {
  database: DatabaseConnection;
  server: Server;
  url: string;
  tokens: AccessTokenService;
  /** Opens a provider; it is destroyed automatically after the test. */
  connect: (options: ConnectOptions) => ConnectedClient;
}

export interface ConnectOptions {
  boardId: string;
  token: string;
  documentName?: string;
}

export interface ConnectedClient {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  synced: Promise<void>;
  authFailure: Promise<string>;
}

/** Starts a collab server backed by the Testcontainers Postgres, with fast persistence. */
export function useCollabServer(): CollabHarness {
  const harness = {} as CollabHarness;
  const clients: HocuspocusProvider[] = [];

  beforeAll(() => {
    harness.database = createDatabase(inject('databaseUrl'));
    harness.tokens = new AccessTokenService(SECRET, 900);
    harness.connect = ({ boardId, token, documentName = `board:${boardId}` }) => {
      const doc = new Y.Doc();
      let resolveSynced: () => void = () => undefined;
      let resolveFailure: (reason: string) => void = () => undefined;
      const synced = new Promise<void>((resolve) => (resolveSynced = resolve));
      const authFailure = new Promise<string>((resolve) => (resolveFailure = resolve));
      const provider = new HocuspocusProvider({
        url: harness.url,
        name: documentName,
        document: doc,
        token,
        onSynced: () => resolveSynced(),
        onAuthenticationFailed: ({ reason }) => resolveFailure(reason),
      });
      clients.push(provider);
      return { doc, provider, synced, authFailure };
    };
  });

  beforeEach(async () => {
    await harness.database.db.execute(
      sql`TRUNCATE users, refresh_tokens, workspaces, workspace_members, invitations, boards, board_documents CASCADE`,
    );
    harness.server = createCollabServer({
      host: '127.0.0.1',
      port: 0,
      logger: pino({ level: 'silent' }),
      db: harness.database.db,
      accessTokens: new AccessTokenService(SECRET, 0),
      debounceMs: 20,
      maxDebounceMs: 100,
    });
    await harness.server.listen();
    harness.url = `ws://127.0.0.1:${harness.server.address.port}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.destroy();
    await harness.server.destroy();
  });

  afterAll(async () => {
    await harness.database.close();
  });

  return harness;
}

let counter = 0;

/** Creates users with the given roles in one workspace, plus one board (without a document). */
export async function seedBoard(
  harness: CollabHarness,
  roles: readonly WorkspaceRole[],
  { archived = false }: { archived?: boolean } = {},
) {
  const { db } = harness.database;
  const users = await db
    .insert(schema.users)
    .values(
      roles.map((role) => ({
        email: `${role}-${++counter}@demo.dev`,
        name: role,
        passwordHash: 'x',
      })),
    )
    .returning();
  const owner = users[0];
  if (!owner) throw new Error('at least one role is required');
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: 'W', slug: `w-${++counter}`, ownerId: owner.id })
    .returning();
  if (!workspace) throw new Error('workspace insert failed');
  await db.insert(schema.workspaceMembers).values(
    users.map((user, i) => ({
      workspaceId: workspace.id,
      userId: user.id,
      role: roles[i] ?? 'viewer',
    })),
  );
  const [board] = await db
    .insert(schema.boards)
    .values({
      workspaceId: workspace.id,
      title: 'Board',
      createdBy: owner.id,
      archivedAt: archived ? new Date() : null,
    })
    .returning();
  if (!board) throw new Error('board insert failed');

  const tokens = await Promise.all(users.map((user) => harness.tokens.sign({ userId: user.id })));
  return { boardId: board.id, users, tokens };
}
