/**
 * Local development database: PGlite (real Postgres compiled to WASM) served over the Postgres wire
 * protocol, so Prisma connects to it exactly like it connects to Neon in production. No Docker needed.
 *
 *   npm run db:local            -> postgresql://postgres:postgres@127.0.0.1:5433/postgres
 *
 * Data persists in <repo>/.data/pglite. Delete that folder for a clean database.
 *
 * PGlite is a single database, so `prisma migrate dev` (which needs a shadow database) doesn't work
 * against it. Create migrations with `npm run db:migration -- <name>` and apply them with `db:deploy`.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.data/pglite');
mkdirSync(dataDir, { recursive: true });

const db = await PGlite.create(dataDir);
// Prisma opens a small pool; PGlite serialises the queries internally.
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
await server.start();
console.log(`Local Postgres (PGlite) listening on postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
console.log(`Data directory: ${dataDir}`);

async function shutdown() {
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
