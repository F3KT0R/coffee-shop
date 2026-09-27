/**
 * Creates a migration from the difference between the database in DATABASE_URL (migrated to the latest
 * migration) and prisma/schema.prisma. Works with the local PGlite database, which can't host the
 * shadow database `prisma migrate dev` requires.
 *
 *   npm run db:deploy                      # bring the local database up to date first
 *   npm run db:migration -- add_something  # writes prisma/migrations/<timestamp>_add_something
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const name = process.argv[2]?.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
if (!name) {
  console.error('Usage: npm run db:migration -- <name>');
  process.exit(1);
}

const migrationsDir = resolve('prisma/migrations');
const isFirst = !existsSync(migrationsDir) || readdirSync(migrationsDir).every((f) => !/^\d+_/.test(f));

// Run the Prisma CLI through the current Node binary: no shell, identical on Windows and Linux.
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const sql = execFileSync(
  process.execPath,
  [
    prismaCli,
    'migrate',
    'diff',
    isFirst ? '--from-empty' : '--from-config-datasource',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
  ],
  { encoding: 'utf8' },
);

if (!/\b(CREATE|ALTER|DROP)\b/i.test(sql)) {
  console.log('No schema changes -- nothing to migrate.');
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const dir = resolve(migrationsDir, `${timestamp}_${name}`);
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'migration.sql'), sql);
if (isFirst) writeFileSync(resolve(migrationsDir, 'migration_lock.toml'), 'provider = "postgresql"\n');
console.log(`Created ${dir}\nReview it, then run: npm run db:deploy`);
