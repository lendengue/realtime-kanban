import { createDatabase } from '@realtime-kanban/db';
import { AccessTokenService } from '@realtime-kanban/shared/access-token';
import { pino } from 'pino';

import { createCollabServer } from './collab-server.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const logger = pino({ name: 'collab', level: env.LOG_LEVEL });
const database = createDatabase(env.DATABASE_URL);
const server = createCollabServer({
  host: env.HOST,
  port: env.PORT,
  logger,
  db: database.db,
  // The TTL is irrelevant here: this service only verifies tokens.
  accessTokens: new AccessTokenService(env.JWT_SECRET, 0),
  debounceMs: env.STORE_DEBOUNCE_MS,
  maxDebounceMs: env.STORE_MAX_DEBOUNCE_MS,
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  // Closes connections and unloads documents, which stores them first.
  await server.destroy();
  await database.close();
  process.exit(0);
};

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await server.listen();
} catch (error) {
  logger.error(error, 'failed to start collab server');
  process.exit(1);
}
