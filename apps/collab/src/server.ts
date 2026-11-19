import { pino } from 'pino';

import { createCollabServer } from './collab-server.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const logger = pino({ name: 'collab', level: env.LOG_LEVEL });
const server = createCollabServer({ host: env.HOST, port: env.PORT, logger });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  await server.destroy();
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
