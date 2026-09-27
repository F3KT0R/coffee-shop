import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Env } from '../env.js';
import { AppError } from '../http/errors.js';
import type { SyncService } from '../ingestion/syncService.js';

function presentedSecret(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const token = (request.query as { token?: unknown }).token;
  return typeof token === 'string' ? token : undefined;
}

function secretMatches(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * External trigger for the catalog sync (cron-job.org, GitHub Actions...). Accepts the secret as a
 * Bearer token or ?token= for schedulers that can't set headers. Responds immediately; the sync runs
 * in the background and is recorded in SyncRun.
 */
export async function registerSyncRoutes(app: FastifyInstance, deps: { env: Env; sync: SyncService }) {
  app.post(
    '/api/sync',
    { config: { rateLimit: { max: 6, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const expected = deps.env.SYNC_SECRET;
      if (!expected) throw new AppError(503, 'SYNC_DISABLED', 'SYNC_SECRET is not configured.');
      const candidate = presentedSecret(request);
      if (!candidate || !secretMatches(candidate, expected))
        throw new AppError(401, 'UNAUTHORIZED', 'Invalid sync token.');
      const { started } = await deps.sync.start('api');
      return reply
        .status(202)
        .send({ started, message: started ? 'Sync started' : 'A sync is already running' });
    },
  );
}
