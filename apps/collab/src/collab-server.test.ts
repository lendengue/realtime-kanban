import type { Server } from '@hocuspocus/server';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCollabServer } from './collab-server.js';

describe('collab server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createCollabServer({ host: '127.0.0.1', port: 0, logger: pino({ level: 'silent' }) });
    await server.listen();
    baseUrl = `http://127.0.0.1:${server.address.port}`;
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('answers GET /health', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'collab' });
  });

  it('falls through to the default handler for other paths', async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Hocuspocus');
  });
});
