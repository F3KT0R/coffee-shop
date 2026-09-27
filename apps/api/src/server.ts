import 'dotenv/config';
import { buildApp } from './app.js';
import { createDb } from './db.js';
import { EnvError, loadEnv, mailConfigured } from './env.js';
import { startSyncScheduler } from './ingestion/scheduler.js';

let env;
try {
  env = loadEnv();
} catch (error) {
  // Fail fast and loudly: a misconfigured shop must not start half-working.
  console.error(error instanceof EnvError ? error.message : error);
  process.exit(1);
}

const db = createDb(env.DATABASE_URL, env.DB_POOL_SIZE);
const { app, sync } = await buildApp({ env, db });

if (!mailConfigured(env)) app.log.warn('SMTP not set -- order emails will not be sent.');
if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET)
  app.log.warn('ADMIN_PASSWORD/SESSION_SECRET not set -- admin is disabled.');

const scheduler = startSyncScheduler({ sync, intervalHours: env.AUTO_SYNC_HOURS, log: app.log });

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  scheduler.stop();
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  try {
    await app.close();
    await db.$disconnect();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
}
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.fatal({ err: error }, 'Failed to start');
  process.exit(1);
}
