/**
 * Runs one catalog sync in the foreground and prints the result.
 *   npm run sync:now --workspace @kafeshop/api
 */
import pino from 'pino';
import { createDb } from '../src/db.js';
import { loadEnv, pricingSettings } from '../src/env.js';
import { createSyncService, toSyncRunView } from '../src/ingestion/syncService.js';

const env = loadEnv();
const db = createDb(env.DATABASE_URL, env.DB_POOL_SIZE);
const log = pino({ level: 'info', transport: { target: 'pino-pretty' } });

const sync = createSyncService({ db, log, pricing: pricingSettings(env) });
const { started, run } = await sync.start('cli');
if (!started || !run) {
  console.error('Another sync is already running.');
  process.exit(1);
}
const result = await run;
console.log(toSyncRunView(result));
await db.$disconnect();
process.exit(result.status === 'SUCCEEDED' ? 0 : 1);
