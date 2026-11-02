import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/**
 * Database backups to a local folder (scripts/backup-db.ts, run nightly by Windows Task Scheduler).
 *
 * A new backup is written only when the order data changed since the last one. The catalog tables
 * change every night (the sync re-prices products with the day's exchange rate), so they would make
 * every night "changed"; they are still included in every backup, they just don't trigger one.
 */

/** Every table, parents before children (the order a restore inserts them in). */
export const TABLES = ['Product', 'SyncRun', 'ExchangeRate', 'Order', 'OrderLine', 'OrderEvent'] as const;
/** Changes here (new orders, status changes, notes, emails sent...) trigger a new backup. */
export const TRIGGER_TABLES = ['Order', 'OrderLine', 'OrderEvent'] as const;

type Table = (typeof TABLES)[number];

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface BackupFile {
  format: 1;
  createdAt: string;
  /** Fingerprint of TRIGGER_TABLES: equal fingerprints mean the order data didn't change. */
  fingerprint: string;
  /** Applied Prisma migrations: restore into a database migrated to the same point. */
  migrations: string[];
  tables: Record<Table, Record<string, unknown>[]>;
}

/** Content hash of the given tables, computed in the database (only a few bytes travel). */
export async function fingerprint(
  db: Queryable,
  tables: readonly string[] = TRIGGER_TABLES,
): Promise<string> {
  const parts: string[] = [];
  for (const table of tables) {
    const { rows } = await db.query(
      `SELECT count(*)::text AS n, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS h
         FROM (SELECT md5(t::text) AS h FROM "${table}" t) rows`,
    );
    parts.push(`${table}:${String(rows[0]!.n)}:${String(rows[0]!.h)}`);
  }
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}

/** Rows as Postgres renders them in JSON: timestamps and decimals come back exactly as stored. */
async function rowsOf(db: Queryable, table: string): Promise<Record<string, unknown>[]> {
  const { rows } = await db.query(`SELECT row_to_json(t)::text AS j FROM "${table}" t`);
  return rows.map((r) => JSON.parse(String(r.j)) as Record<string, unknown>);
}

async function migrationsOf(db: Queryable): Promise<string[]> {
  const { rows } = await db.query(`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS present`);
  if (!rows[0]?.present) return [];
  const applied = await db.query(
    `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`,
  );
  return applied.rows.map((r) => String(r.migration_name));
}

interface State {
  fingerprint: string;
  file: string;
  createdAt: string;
}

const STATE_FILE = 'last-backup.json';

async function readState(dir: string): Promise<State | null> {
  try {
    return JSON.parse(await readFile(join(dir, STATE_FILE), 'utf8')) as State;
  } catch {
    return null;
  }
}

/** Writes via a temporary file, so a crash never leaves a half-written backup behind. */
async function writeAtomic(path: string, data: string | Buffer) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

/** Local time, e.g. kafeshop-2026-11-02_03-30: sorts by date and reads like the clock on this computer. */
const stamp = (d: Date) => {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}_${two(d.getHours())}-${two(d.getMinutes())}`;
};

export type BackupResult =
  | { status: 'unchanged'; since: string }
  | { status: 'created'; file: string; rows: Record<string, number>; bytes: number };

/**
 * Backs up the database into `dir` if the order data changed since the last backup (or `force`).
 * Reads everything in one read-only snapshot, so the backup is consistent.
 */
export async function runBackup(
  db: Queryable,
  dir: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<BackupResult> {
  await mkdir(dir, { recursive: true });
  const state = await readState(dir);
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const print = await fingerprint(db);
    if (!options.force && state?.fingerprint === print) {
      return { status: 'unchanged', since: state.file };
    }
    const now = options.now ?? new Date();
    const tables = {} as BackupFile['tables'];
    for (const table of TABLES) tables[table] = await rowsOf(db, table);
    const backup: BackupFile = {
      format: 1,
      createdAt: now.toISOString(),
      fingerprint: print,
      migrations: await migrationsOf(db),
      tables,
    };
    const file = `kafeshop-${stamp(now)}.json.gz`;
    const data = gzipSync(JSON.stringify(backup));
    await writeAtomic(join(dir, file), data);
    await writeAtomic(
      join(dir, STATE_FILE),
      JSON.stringify({ fingerprint: print, file, createdAt: backup.createdAt }),
    );
    return {
      status: 'created',
      file,
      bytes: data.length,
      rows: Object.fromEntries(TABLES.map((t) => [t, tables[t].length])),
    };
  } finally {
    await db.query('ROLLBACK');
  }
}

export async function readBackupFile(path: string): Promise<BackupFile> {
  const backup = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')) as BackupFile;
  if (backup.format !== 1 || !backup.tables) throw new Error(`${path} is not a backup file`);
  return backup;
}

/** Newest backup file in `dir`, or null. */
export async function latestBackup(dir: string): Promise<string | null> {
  const files = (await readdir(dir)).filter((f) => /^kafeshop-.*\.json\.gz$/.test(f)).sort();
  return files.length ? join(dir, files.at(-1)!) : null;
}

/**
 * Loads a backup into a database that has the schema (run `prisma migrate deploy` first) but no data.
 * Refuses to touch a database that already holds data. All or nothing.
 */
export async function restoreBackup(db: Queryable, backup: BackupFile): Promise<Record<string, number>> {
  await db.query('BEGIN');
  try {
    for (const table of TABLES) {
      const { rows } = await db.query(`SELECT EXISTS (SELECT 1 FROM "${table}") AS taken`);
      if (rows[0]?.taken)
        throw new Error(`Table "${table}" is not empty: restore only into an empty database.`);
    }
    const restored: Record<string, number> = {};
    for (const table of TABLES) {
      const rows = backup.tables[table] ?? [];
      // Postgres converts the JSON back to the column types itself (timestamps, decimals, arrays, enums).
      if (rows.length)
        await db.query(
          `INSERT INTO "${table}" SELECT * FROM json_populate_recordset(NULL::"${table}", $1::json)`,
          [JSON.stringify(rows)],
        );
      restored[table] = rows.length;
    }
    await db.query('COMMIT');
    return restored;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
