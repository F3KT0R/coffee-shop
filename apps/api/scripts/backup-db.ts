/**
 * Local database backups (see README "Backups").
 *
 *   npm run db:backup --workspace @kafeshop/api              back up if the orders changed
 *   npm run db:backup --workspace @kafeshop/api -- --force   back up anyway
 *   npm run db:backup --workspace @kafeshop/api -- restore <file | latest>
 *
 * Settings (environment, or the env file passed with --env-file):
 *   BACKUP_DATABASE_URL   database to back up (the production Neon URL)
 *   BACKUP_DIR            folder for the backups, e.g. D:\backups\coffee-shop
 *   RESTORE_DATABASE_URL  restore target: must be migrated (prisma migrate deploy) and empty
 */
import pg from 'pg';
import { latestBackup, readBackupFile, restoreBackup, runBackup } from '../src/backup/backup.js';

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/** pg treats sslmode=require as verify-full already; saying so silences its deprecation warning. */
const client = (url: string) =>
  new pg.Client({ connectionString: url.replace(/sslmode=require\b/, 'sslmode=verify-full') });

async function backup(force: boolean) {
  const dir = required('BACKUP_DIR');
  const db = client(required('BACKUP_DATABASE_URL'));
  await db.connect();
  try {
    const result = await runBackup(db, dir, { force });
    if (result.status === 'unchanged') log(`No order changes since ${result.since}: no new backup.`);
    else
      log(
        `Created ${result.file} (${Math.round(result.bytes / 1024)} KB): ` +
          Object.entries(result.rows)
            .map(([table, n]) => `${table} ${n}`)
            .join(', '),
      );
  } finally {
    await db.end();
  }
}

async function restore(which: string | undefined) {
  if (!which) throw new Error('Usage: restore <file | latest>');
  const path = which === 'latest' ? await latestBackup(required('BACKUP_DIR')) : which;
  if (!path) throw new Error('No backup found.');
  const data = await readBackupFile(path);
  const db = client(required('RESTORE_DATABASE_URL'));
  await db.connect();
  try {
    const restored = await restoreBackup(db, data);
    log(`Restored ${path} (from ${data.createdAt}): ${JSON.stringify(restored)}`);
  } finally {
    await db.end();
  }
}

const [command, argument] = process.argv.slice(2);
try {
  if (command === 'restore') await restore(argument);
  else await backup(command === '--force');
} catch (error) {
  log(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
