import type { FastifyBaseLogger } from 'fastify';
import type { SyncService } from './syncService.js';

const CHECK_EVERY_MS = 15 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 20 * 1000;

/**
 * Keeps the catalog fresh from inside the API process, so no external cron is strictly required (the
 * keep-warm ping keeps the process alive; an external /api/sync call remains a welcome backup).
 * The last success time is read from the database once and then tracked in memory, so idle checks
 * never wake a scaled-to-zero database.
 */
export function startSyncScheduler(options: {
  sync: SyncService;
  intervalHours: number;
  log: FastifyBaseLogger;
}): { stop: () => void } {
  if (options.intervalHours <= 0) {
    options.log.info('Automatic catalog sync disabled (AUTO_SYNC_HOURS=0)');
    return { stop: () => {} };
  }
  const intervalMs = options.intervalHours * 60 * 60 * 1000;
  let lastSuccess: number | null = null;
  let lastAttempt = 0;
  let loaded = false;

  async function check() {
    try {
      if (!loaded) {
        lastSuccess = (await options.sync.lastSuccessAt())?.getTime() ?? null;
        loaded = true;
      }
      const now = Date.now();
      const due = lastSuccess === null || now - lastSuccess >= intervalMs;
      if (!due || options.sync.isRunning() || now - lastAttempt < RETRY_AFTER_FAILURE_MS) return;

      lastAttempt = now;
      const { run } = await options.sync.start('scheduler');
      const result = await run;
      if (result?.status === 'SUCCEEDED') lastSuccess = result.finishedAt?.getTime() ?? Date.now();
    } catch (error) {
      options.log.error({ err: error }, 'Scheduled sync check failed');
    }
  }

  const first = setTimeout(check, FIRST_CHECK_DELAY_MS);
  const timer = setInterval(check, CHECK_EVERY_MS);
  first.unref();
  timer.unref();
  return {
    stop: () => {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}
