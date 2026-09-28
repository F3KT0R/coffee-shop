import { z } from 'zod';
import {
  adminLoginSchema,
  adminOrdersQuerySchema,
  instagramHandleSchema,
  orderStatusUpdateSchema,
} from '@kafeshop/core';
import type { FastifyInstance } from 'fastify';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  makeRequireAdmin,
  passwordMatches,
} from '../auth/session.js';
import type { Db } from '../db.js';
import type { Env } from '../env.js';
import { AppError, parseInput } from '../http/errors.js';
import { toSyncRunView, type SyncService } from '../ingestion/syncService.js';
import type { OrderService } from '../orders/service.js';

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: { env: Env; db: Db; orders: OrderService; sync: SyncService },
): Promise<void> {
  const { env, db, orders, sync } = deps;
  const requireAdmin = makeRequireAdmin(env.SESSION_SECRET);
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/admin',
  };

  app.post(
    '/api/admin/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
        throw new AppError(
          503,
          'ADMIN_DISABLED',
          'Administracija nije podešena (ADMIN_PASSWORD, SESSION_SECRET).',
        );
      }
      const { password } = parseInput(adminLoginSchema, request.body);
      if (!passwordMatches(password, env.ADMIN_PASSWORD)) {
        request.log.warn('Failed admin login');
        throw new AppError(401, 'INVALID_PASSWORD', 'Pogrešna lozinka.');
      }
      reply.setCookie(SESSION_COOKIE, createSessionToken(env.SESSION_SECRET), {
        ...cookieOptions,
        maxAge: SESSION_TTL_SECONDS,
      });
      return { ok: true };
    },
  );

  app.post('/api/admin/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });

  // Everything below requires a valid session.
  await app.register(async (secured) => {
    secured.addHook('preHandler', requireAdmin);
    secured.addHook('onSend', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
    });

    secured.get('/api/admin/session', async () => ({ ok: true }));

    secured.get('/api/admin/dashboard', async () => orders.dashboard());

    secured.get('/api/admin/customers', async () => ({ items: await orders.customers() }));

    secured.get('/api/admin/orders', async (request) =>
      orders.listForAdmin(parseInput(adminOrdersQuerySchema, request.query)),
    );

    secured.get('/api/admin/orders/:number', async (request) => {
      const { number } = parseInput(z.object({ number: z.string().max(20) }), request.params);
      return orders.detailForAdmin(number);
    });

    secured.post('/api/admin/orders/:number/status', async (request) => {
      const { number } = parseInput(z.object({ number: z.string().max(20) }), request.params);
      const { status, note } = parseInput(orderStatusUpdateSchema, request.body);
      return orders.changeStatus(number, status, note);
    });

    secured.post('/api/admin/orders/:number/instagram', async (request) => {
      const { number } = parseInput(z.object({ number: z.string().max(20) }), request.params);
      const { handle } = parseInput(instagramHandleSchema, request.body);
      return orders.setInstagramHandle(number, handle);
    });

    secured.get('/api/admin/shipping', async () => orders.shipping());

    secured.get('/api/admin/procurement', async () => orders.procurement());

    secured.post('/api/admin/procurement/mark-ordered', async (request) => {
      const { orders: numbers } = parseInput(
        z.object({ orders: z.array(z.string().max(20)).min(1).max(500) }),
        request.body,
      );
      return orders.markOrdered(numbers);
    });

    secured.get('/api/admin/sync-runs', async () => {
      const runs = await db.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 });
      return { items: runs.map(toSyncRunView), running: sync.isRunning() };
    });

    secured.post('/api/admin/sync', async (_request, reply) => {
      const { started } = await sync.start('admin');
      return reply.status(202).send({ started });
    });
  });
}
