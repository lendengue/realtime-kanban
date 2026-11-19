import { createDatabase } from '@realtime-kanban/db';

import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { AccessTokenService } from '@realtime-kanban/shared/access-token';
import { SmtpMailer } from './lib/mailer.js';

const config = loadEnv();
const database = createDatabase(config.DATABASE_URL);
const app = await buildApp({
  config,
  db: database.db,
  mailer: new SmtpMailer(config.SMTP_URL, config.MAIL_FROM),
  accessTokens: new AccessTokenService(config.JWT_SECRET, config.ACCESS_TOKEN_TTL_SECONDS),
});

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await database.close();
  process.exit(0);
};

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
