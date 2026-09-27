import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.js';

export { Prisma };
export type Db = PrismaClient;

/**
 * @param poolSize Use 1 against the local PGlite server: it runs every connection on one engine, so
 *   parallel queries from several connections interleave their prepared statements. Real Postgres
 *   (Neon) is fine with a normal pool.
 */
export function createDb(connectionString: string, poolSize = 5): Db {
  const adapter = new PrismaPg({
    connectionString,
    // Neon's free tier suspends idle compute; a cold database needs a few seconds to accept connections.
    connectionTimeoutMillis: 15_000,
    idleTimeoutMillis: 30_000,
    max: poolSize,
  });
  return new PrismaClient({ adapter });
}

/** True for a unique-constraint violation, optionally on a specific field. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}
