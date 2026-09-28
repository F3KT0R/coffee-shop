import { z } from 'zod';
import {
  cartQuoteSchema,
  loyaltyLookupSchema,
  checkoutSchema,
  productQuerySchema,
  quoteCart,
  type HealthResponse,
  type ShopConfigResponse,
} from '@kafeshop/core';
import type { FastifyInstance } from 'fastify';
import type { CatalogRepository } from '../catalog/repository.js';
import type { Db } from '../db.js';
import { mailConfigured, type Env } from '../env.js';
import { notFound, parseInput } from '../http/errors.js';
import type { OrderService } from '../orders/service.js';

const CATALOG_CACHE = 'public, max-age=60, stale-while-revalidate=600';
const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export async function registerPublicRoutes(
  app: FastifyInstance,
  deps: { env: Env; db: Db; catalog: CatalogRepository; orders: OrderService; version: string },
): Promise<void> {
  const { env, db, catalog, orders } = deps;

  /** Liveness only -- no database access, so keep-warm pings never wake a scaled-to-zero database. */
  app.get('/api/ping', { config: { rateLimit: false } }, async () => ({ ok: true }));

  /** Readiness: database reachable and catalog fresh. For monitoring, not for frequent pings. */
  app.get('/api/health', async (_request, reply) => {
    let body: HealthResponse;
    try {
      const [activeProducts, lastSync] = await Promise.all([
        db.product.count({ where: { active: true } }),
        db.syncRun.findFirst({ where: { status: 'SUCCEEDED' }, orderBy: { startedAt: 'desc' } }),
      ]);
      const lastSyncAt = lastSync?.finishedAt ?? null;
      body = {
        ok: true,
        database: 'up',
        catalog: {
          activeProducts,
          lastSyncAt: lastSyncAt?.toISOString() ?? null,
          stale: !lastSyncAt || Date.now() - lastSyncAt.getTime() > STALE_AFTER_MS,
        },
        version: deps.version,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Health check: database unreachable');
      body = { ok: false, database: 'down', catalog: null, version: deps.version };
    }
    return reply
      .status(body.ok ? 200 : 503)
      .header('Cache-Control', 'no-store')
      .send(body);
  });

  app.get('/api/config', async (_request, reply): Promise<ShopConfigResponse> => {
    reply.header('Cache-Control', CATALOG_CACHE);
    return {
      ordersOpen: env.ORDERS_OPEN,
      closedMessage: env.ORDERS_CLOSED_MESSAGE,
      deliveryEstimate: env.DELIVERY_ESTIMATE,
      postageNote: env.POSTAGE_NOTE,
      instagramUrl: env.INSTAGRAM_URL,
      emailEnabled: mailConfigured(env),
    };
  });

  app.get('/api/catalog/meta', async (request, reply) => {
    const context = parseInput(
      z.object({ category: z.string().max(40).optional(), system: z.string().max(40).optional() }),
      request.query,
    );
    reply.header('Cache-Control', CATALOG_CACHE);
    return catalog.meta(context);
  });

  app.get('/api/products', async (request, reply) => {
    const query = parseInput(productQuerySchema, request.query);
    reply.header('Cache-Control', CATALOG_CACHE);
    return catalog.list(query);
  });

  app.get('/api/products/:slug', async (request, reply) => {
    const { slug } = parseInput(z.object({ slug: z.string().min(1).max(200) }), request.params);
    const product = await catalog.bySlug(slug);
    if (!product) throw notFound('Proizvod nije pronađen.');
    reply.header('Cache-Control', CATALOG_CACHE);
    return { product, related: await catalog.related(product) };
  });

  app.post(
    '/api/cart/quote',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { items } = parseInput(cartQuoteSchema, request.body);
      const products = await catalog.quotable(items.map((i) => i.sku));
      reply.header('Cache-Control', 'no-store');
      return quoteCart(items, (sku) => products.get(sku));
    },
  );

  /**
   * Kafe klub status for an email, used at checkout to show the discount before ordering. Rate-limited:
   * it reveals only how many picked-up orders an address has (and so which discount applies).
   */
  app.post(
    '/api/loyalty',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email } = parseInput(loyaltyLookupSchema, request.body);
      reply.header('Cache-Control', 'no-store');
      return orders.loyaltyFor(email);
    },
  );

  app.post(
    '/api/orders',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const input = parseInput(checkoutSchema, request.body);
      const key = request.headers['idempotency-key'];
      const idempotencyKey = typeof key === 'string' && /^[\w-]{8,100}$/.test(key) ? key : undefined;
      const created = await orders.create(input, idempotencyKey);
      return reply.status(201).header('Cache-Control', 'no-store').send(created);
    },
  );

  app.get('/api/orders/:number', async (request, reply) => {
    const { number } = parseInput(z.object({ number: z.string().regex(/^\d{6}-\d{4}$/) }), request.params);
    const { t } = parseInput(z.object({ t: z.string().min(10).max(100) }), request.query);
    reply.header('Cache-Control', 'no-store');
    return orders.viewForCustomer(number, t);
  });
}
