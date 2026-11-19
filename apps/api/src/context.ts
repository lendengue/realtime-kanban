import type { Database } from '@realtime-kanban/db';

import type { Env } from './env.js';
import type { AccessTokenService } from '@realtime-kanban/shared/access-token';
import type { Mailer } from './lib/mailer.js';

/** Dependencies shared by every route module. */
export interface AppContext {
  config: Env;
  db: Database;
  mailer: Mailer;
  accessTokens: AccessTokenService;
}
