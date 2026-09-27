import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createCatalogRepository } from './catalog/repository.js';
import type { Db } from './db.js';
import { pricingSettings, type Env } from './env.js';
import { registerErrorHandling } from './http/errors.js';
import { createSyncService, type SyncService } from './ingestion/syncService.js';
import { createMailer, type Mailer } from './mail/mailer.js';
import { createOrderService } from './orders/service.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerSyncRoutes } from './routes/sync.js';

export interface AppDeps {
  env: Env;
  db: Db;
  /** Overrides for tests. */
  mailer?: Mailer;
  fetch?: typeof fetch;
  logger?: FastifyServerOptions['logger'];
  syncPageDelayMs?: number;
}

export interface App {
  app: FastifyInstance;
  sync: SyncService;
}

export async function buildApp(deps: AppDeps): Promise<App> {
  const { env, db } = deps;
  const app = Fastify({
    logger: deps.logger ?? {
      level: env.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      // JSON logs in production (Render); readable ones locally.
      ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    // Behind Render's load balancer and the web host's /api proxy: take the client IP from X-Forwarded-For.
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  registerErrorHandling(app);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // A 429 goes through the error handler for a consistent, Serbian message.
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error('Too many requests'), { statusCode: context.statusCode }),
  });

  const mailer = deps.mailer ?? createMailer(env, app.log);
  const catalog = createCatalogRepository(db);
  const orders = createOrderService({ db, env, catalog, mailer, log: app.log });
  const sync = createSyncService({
    db,
    log: app.log,
    pricing: pricingSettings(env),
    fetch: deps.fetch,
    pageDelayMs: deps.syncPageDelayMs,
  });
  const version = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'dev';

  await registerPublicRoutes(app, { env, db, catalog, orders, version });
  await registerAdminRoutes(app, { env, db, orders, sync });
  await registerSyncRoutes(app, { env, sync });

  return { app, sync };
}
