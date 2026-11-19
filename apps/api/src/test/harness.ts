import { createDatabase, type DatabaseConnection } from '@realtime-kanban/db';
import type { AuthResponse } from '@realtime-kanban/shared';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';

import { buildApp } from '../app.js';
import { loadEnv } from '../env.js';
import { AccessTokenService } from '../lib/access-token.js';
import { MemoryMailer } from '../lib/mailer.js';
import { REFRESH_COOKIE } from '../modules/auth/routes.js';

export interface TestHarness {
  app: FastifyInstance;
  mailer: MemoryMailer;
  database: DatabaseConnection;
  /** Accept link from the most recent e-mail sent. */
  lastAcceptUrl: () => string;
}

export interface TestUser extends AuthResponse {
  refreshToken: string;
  /** Ready-to-use `authorization` header. */
  headers: { authorization: string };
}

/**
 * Registers lifecycle hooks that build a fresh app against the shared test database
 * and truncate every table before each test.
 */
export function useTestApp(): TestHarness {
  const harness = {
    lastAcceptUrl: () => {
      const text = harness.mailer.messages.at(-1)?.text ?? '';
      const url = /https?:\/\/\S+\/invite\/\S+/.exec(text)?.[0];
      if (!url) throw new Error('No invitation e-mail was sent');
      return url;
    },
  } as TestHarness;

  beforeAll(async () => {
    const config = loadEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: inject('databaseUrl'),
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      COOKIE_SECURE: 'false',
    });
    harness.database = createDatabase(config.DATABASE_URL);
    harness.mailer = new MemoryMailer();
    harness.app = await buildApp({
      config,
      db: harness.database.db,
      mailer: harness.mailer,
      accessTokens: new AccessTokenService(config.JWT_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
    });
    await harness.app.ready();
  });

  beforeEach(async () => {
    harness.mailer.messages.length = 0;
    await harness.database.db.execute(
      sql`TRUNCATE users, refresh_tokens, workspaces, workspace_members, invitations, boards, board_documents CASCADE`,
    );
  });

  afterAll(async () => {
    await harness.app.close();
    await harness.database.close();
  });

  return harness;
}

export function refreshCookieOf(response: { cookies: { name: string; value: string }[] }) {
  return response.cookies.find((cookie) => cookie.name === REFRESH_COOKIE);
}

export async function registerUser(
  app: FastifyInstance,
  {
    email,
    name = email.split('@')[0] ?? 'user',
    password = 'password123',
  }: {
    email: string;
    name?: string;
    password?: string;
  },
): Promise<TestUser> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { email, name, password },
  });
  if (response.statusCode !== 201) {
    throw new Error(`register failed: ${response.statusCode} ${response.body}`);
  }
  const body = response.json<AuthResponse>();
  const cookie = refreshCookieOf(response);
  if (!cookie) throw new Error('register did not set a refresh cookie');
  return {
    ...body,
    refreshToken: cookie.value,
    headers: { authorization: `Bearer ${body.accessToken}` },
  };
}
