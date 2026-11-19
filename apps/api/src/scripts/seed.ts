/**
 * Creates demo data: alice@demo.dev (owner) and bob@demo.dev (member), both with the password
 * "password", plus one workspace and a populated board. Safe to run more than once.
 */
import {
  addChecklistItem,
  createCard,
  createLabel,
  initializeBoard,
  readBoard,
  toggleCardLabel,
  toggleChecklistItem,
} from '@realtime-kanban/board-doc';
import { createDatabase, schema, type Database } from '@realtime-kanban/db';
import { eq } from 'drizzle-orm';
import * as Y from 'yjs';

import { hashPassword } from '../lib/password.js';

const DEMO_PASSWORD = 'password';
const DEMO_BOARD_TITLE = 'Product launch';

function demoBoardState(aliceId: string, bobId: string): Uint8Array {
  const doc = new Y.Doc();
  initializeBoard(doc, { title: DEMO_BOARD_TITLE });
  const [todo, doing, done] = readBoard(doc).columns.map((column) => column.id);
  if (!todo || !doing || !done) throw new Error('Default columns missing');

  const urgent = createLabel(doc, { name: 'Urgent', color: 'red' });
  const design = createLabel(doc, { name: 'Design', color: 'violet' });

  const card = (columnId: string, title: string, createdBy: string) =>
    createCard(doc, { columnId, title, createdBy });

  const landing = card(todo, 'Write landing page copy', aliceId);
  toggleCardLabel(doc, landing, design);
  card(todo, 'Prepare launch announcement', bobId);
  card(todo, 'Collect beta feedback', aliceId);

  const pricing = card(doing, 'Finalize pricing page', bobId);
  toggleCardLabel(doc, pricing, urgent);
  const qa = card(doing, 'QA the onboarding flow', aliceId);
  toggleChecklistItem(doc, qa, addChecklistItem(doc, qa, { text: 'Sign-up' }));
  addChecklistItem(doc, qa, { text: 'Invite teammates' });

  card(done, 'Set up analytics', bobId);
  card(done, 'Record demo video', aliceId);

  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

async function ensureDemoData(db: Database): Promise<void> {
  let alice = await db.query.users.findFirst({ where: eq(schema.users.email, 'alice@demo.dev') });

  if (!alice) {
    await db.transaction(async (tx) => {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const [createdAlice, bob] = await tx
        .insert(schema.users)
        .values([
          { email: 'alice@demo.dev', name: 'Alice', passwordHash },
          { email: 'bob@demo.dev', name: 'Bob', passwordHash },
        ])
        .returning();
      if (!createdAlice || !bob) throw new Error('Failed to create demo users');

      const [workspace] = await tx
        .insert(schema.workspaces)
        .values({ name: 'Demo workspace', slug: 'demo', ownerId: createdAlice.id })
        .returning();
      if (!workspace) throw new Error('Failed to create demo workspace');

      await tx.insert(schema.workspaceMembers).values([
        { workspaceId: workspace.id, userId: createdAlice.id, role: 'owner' },
        { workspaceId: workspace.id, userId: bob.id, role: 'member' },
      ]);
      await tx
        .insert(schema.boards)
        .values({ workspaceId: workspace.id, title: DEMO_BOARD_TITLE, createdBy: createdAlice.id });
    });
    console.info('Seeded alice@demo.dev and bob@demo.dev (password: "password").');
    alice = await db.query.users.findFirst({ where: eq(schema.users.email, 'alice@demo.dev') });
  } else {
    console.info('Demo users already present.');
  }

  const bob = await db.query.users.findFirst({ where: eq(schema.users.email, 'bob@demo.dev') });
  const board = await db.query.boards.findFirst({
    where: eq(schema.boards.title, DEMO_BOARD_TITLE),
  });
  if (!alice || !bob || !board) throw new Error('Demo data is incomplete');

  const inserted = await db
    .insert(schema.boardDocuments)
    .values({ boardId: board.id, state: demoBoardState(alice.id, bob.id) })
    .onConflictDoNothing()
    .returning({ boardId: schema.boardDocuments.boardId });
  console.info(
    inserted.length > 0 ? 'Populated the demo board.' : 'Demo board already has a document.',
  );
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { db, close } = createDatabase(url);
try {
  await ensureDemoData(db);
} finally {
  await close();
}
