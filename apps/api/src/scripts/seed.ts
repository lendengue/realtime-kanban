/**
 * Creates demo data: alice@demo.dev (owner) and bob@demo.dev (member), both with the password
 * "password", plus one workspace and one board. Safe to run more than once.
 */
import { createDatabase, schema } from '@realtime-kanban/db';
import { eq } from 'drizzle-orm';

import { hashPassword } from '../lib/password.js';

const DEMO_PASSWORD = 'password';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { db, close } = createDatabase(url);

try {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, 'alice@demo.dev'),
  });
  if (existing) {
    console.info('Demo data already present, nothing to do.');
  } else {
    await db.transaction(async (tx) => {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const [alice, bob] = await tx
        .insert(schema.users)
        .values([
          { email: 'alice@demo.dev', name: 'Alice', passwordHash },
          { email: 'bob@demo.dev', name: 'Bob', passwordHash },
        ])
        .returning();
      if (!alice || !bob) throw new Error('Failed to create demo users');

      const [workspace] = await tx
        .insert(schema.workspaces)
        .values({ name: 'Demo workspace', slug: 'demo', ownerId: alice.id })
        .returning();
      if (!workspace) throw new Error('Failed to create demo workspace');

      await tx.insert(schema.workspaceMembers).values([
        { workspaceId: workspace.id, userId: alice.id, role: 'owner' },
        { workspaceId: workspace.id, userId: bob.id, role: 'member' },
      ]);

      // Board content (columns and cards) is seeded once the Yjs document model lands (phase 2).
      await tx
        .insert(schema.boards)
        .values({ workspaceId: workspace.id, title: 'Product launch', createdBy: alice.id });
    });
    console.info('Seeded alice@demo.dev and bob@demo.dev (password: "password").');
  }
} finally {
  await close();
}
