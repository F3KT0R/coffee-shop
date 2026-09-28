import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ORDER_STATUSES,
  OPEN_STATUSES,
  allowedTransitions,
  canTransition,
  generateOrderNumber,
  loyaltyDiscountRsd,
  loyaltyStatus,
  normalizeEmail,
  normalizeInstagramHandle,
  quoteCart,
  type AdminCustomer,
  type AdminDashboard,
  type AdminOrderDetail,
  type AdminOrderSummary,
  type CreateOrderResponse,
  type LoyaltyResponse,
  type OrderStatus,
  type OrderView,
  type Paginated,
  type ProcurementItem,
  type ProcurementResponse,
  type ShipmentWeight,
  type ShippingResponse,
  type checkoutSchema,
} from '@kafeshop/core';
import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';
import { isUniqueViolation, type Db } from '../db.js';
import type { Env } from '../env.js';
import { mailConfigured } from '../env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError, notFound } from '../http/errors.js';
import type { CatalogRepository } from '../catalog/repository.js';
import type { Mailer } from '../mail/mailer.js';
import {
  NOTIFY_STATUSES,
  adminNewOrderEmail,
  orderConfirmationEmail,
  statusUpdateEmail,
  type EmailContext,
  type EmailOrder,
} from './emails.js';

type CheckoutData = z.output<typeof checkoutSchema>;

const orderInclude = {
  lines: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;
type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const ADMIN_PAGE_SIZE = 25;

function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function toEmailOrder(order: OrderWithRelations): EmailOrder {
  return { ...order, status: order.status };
}

function toSummary(
  order: Prisma.OrderGetPayload<{ include: { lines: { select: { quantity: true } } } }>,
): AdminOrderSummary {
  return {
    number: order.number,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    customerName: order.fullName,
    city: order.city,
    itemCount: order.lines.reduce((sum, l) => sum + l.quantity, 0),
    totalRsd: order.totalRsd,
    loyaltyTier: order.loyaltyTier,
    instagramHandle: order.instagramHandle,
  };
}

export function createOrderService(deps: {
  db: Db;
  env: Env;
  catalog: CatalogRepository;
  mailer: Mailer;
  log: FastifyBaseLogger;
}) {
  const { db, env, catalog, mailer, log } = deps;

  /** Summed KaffeK weights of some order lines, for comparing against the courier's billed weight. */
  async function shipmentWeight(lines: { sku: string; quantity: number }[]): Promise<ShipmentWeight> {
    const [products, latestRate] = await Promise.all([
      db.product.findMany({
        where: { sku: { in: [...new Set(lines.map((l) => l.sku))] } },
        select: { sku: true, weightKg: true },
      }),
      db.exchangeRate.findFirst({
        orderBy: [{ date: 'desc' }, { fetchedAt: 'desc' }],
        select: { gbpSell: true },
      }),
    ]);
    const weights = new Map(products.map((p) => [p.sku, p.weightKg]));
    const fallbackKg = env.FALLBACK_WEIGHT_KG;
    let totalKg = 0;
    let boxes = 0;
    let estimatedBoxes = 0;
    for (const line of lines) {
      const kg = weights.get(line.sku);
      const known = kg !== undefined && kg !== null && kg > 0;
      totalKg += (known ? kg : fallbackKg) * line.quantity;
      boxes += line.quantity;
      if (!known) estimatedBoxes += line.quantity;
    }
    return {
      totalKg: Math.round(totalKg * 1000) / 1000,
      boxes,
      estimatedBoxes,
      fallbackKg,
      transportGbpPerKg: env.TRANSPORT_GBP_PER_KG,
      gbpRsdRate: latestRate?.gbpSell ?? null,
    };
  }

  const emailContext = (order: { number: string; accessToken: string }): EmailContext => ({
    siteUrl: env.PUBLIC_SITE_URL,
    statusUrl: `${env.PUBLIC_SITE_URL}/porudzbina/${order.number}?t=${order.accessToken}`,
    deliveryEstimate: env.DELIVERY_ESTIMATE,
    postageNote: env.POSTAGE_NOTE,
    instagramUrl: env.INSTAGRAM_URL,
  });

  /** Sends one email and records the outcome on the order. Never throws: mail must not break ordering. */
  async function deliver(orderId: string, kind: string, send: () => Promise<void>): Promise<void> {
    try {
      await send();
      if (mailer.enabled) {
        await db.orderEvent.create({ data: { orderId, type: 'EMAIL_SENT', message: kind, actor: 'system' } });
      }
    } catch (error) {
      log.error({ err: error, orderId, kind }, 'Order email failed');
      await db.orderEvent
        .create({
          data: {
            orderId,
            type: 'EMAIL_FAILED',
            message: `${kind}: ${(error as Error).message}`.slice(0, 500),
            actor: 'system',
          },
        })
        .catch(() => {});
    }
  }

  async function notifyCreated(order: OrderWithRelations): Promise<void> {
    // The receipt shows the customer's Kafe klub progress (this new order doesn't count until picked up).
    const loyalty = await loyaltyFor(order.email).catch(() => undefined);
    const ctx = { ...emailContext(order), loyalty };
    await deliver(order.id, 'confirmation', () =>
      mailer.send(orderConfirmationEmail(toEmailOrder(order), ctx)),
    );
    if (env.ADMIN_EMAIL) {
      const adminUrl = `${env.PUBLIC_SITE_URL}/admin/porudzbine/${order.number}`;
      await deliver(order.id, 'admin-notification', () =>
        mailer.send(adminNewOrderEmail(toEmailOrder(order), adminUrl, env.ADMIN_EMAIL!, ctx)),
      );
    }
  }

  /** Kafe klub: only orders that were picked up and paid count. */
  async function loyaltyFor(email: string): Promise<LoyaltyResponse> {
    const completed = await db.order.count({
      where: { emailNormalized: normalizeEmail(email), status: 'DELIVERED' },
    });
    return loyaltyStatus(completed);
  }

  async function findByNumber(number: string): Promise<OrderWithRelations | null> {
    return db.order.findUnique({ where: { number }, include: orderInclude });
  }

  function statusHistory(order: OrderWithRelations) {
    return [
      { status: 'NEW' as OrderStatus, at: order.createdAt.toISOString() },
      ...order.events
        .filter((e) => e.type === 'STATUS_CHANGED' && e.toStatus)
        .map((e) => ({ status: e.toStatus as OrderStatus, at: e.createdAt.toISOString() })),
    ];
  }

  function toView(order: OrderWithRelations): OrderView {
    return {
      number: order.number,
      status: order.status,
      statusHistory: statusHistory(order),
      createdAt: order.createdAt.toISOString(),
      customer: {
        fullName: order.fullName,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        postalCode: order.postalCode,
      },
      lines: order.lines.map((l) => ({
        sku: l.sku,
        slug: l.slug,
        name: l.name,
        brand: l.brand,
        image: l.image,
        unitPriceRsd: l.unitPriceRsd,
        quantity: l.quantity,
        lineTotalRsd: l.lineTotalRsd,
      })),
      subtotalRsd: order.subtotalRsd,
      discountRsd: order.discountRsd,
      loyaltyTier: order.loyaltyTier,
      totalRsd: order.totalRsd,
      deliveryEstimate: env.DELIVERY_ESTIMATE,
      postageNote: env.POSTAGE_NOTE,
    };
  }

  async function detailForAdmin(number: string): Promise<AdminOrderDetail> {
    const order = await findByNumber(number);
    if (!order) throw notFound('Porudžbina nije pronađena.');
    const { statusHistory: _history, ...view } = toView(order);
    const costRsd = order.lines.reduce((sum, l) => sum + l.unitCostRsd * l.quantity, 0);
    return {
      ...view,
      costRsd,
      profitRsd: order.totalRsd - costRsd,
      customerNote: order.note,
      accessToken: order.accessToken,
      instagramHandle: order.instagramHandle,
      events: order.events.map((e) => ({
        type: e.type,
        message: e.message,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actor: e.actor,
        at: e.createdAt.toISOString(),
      })),
      allowedTransitions: [...allowedTransitions(order.status)],
    };
  }

  async function changeStatus(
    number: string,
    to: OrderStatus,
    note: string | undefined,
  ): Promise<AdminOrderDetail> {
    const order = await findByNumber(number);
    if (!order) throw notFound('Porudžbina nije pronađena.');
    if (!canTransition(order.status, to)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Status "${ORDER_STATUSES[order.status].name}" ne može da pređe u "${ORDER_STATUSES[to].name}".`,
      );
    }
    // Conditional update: a concurrent change (two admin tabs) fails instead of being overwritten.
    const updated = await db.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: to },
    });
    if (updated.count === 0)
      throw new AppError(409, 'CONFLICT', 'Porudžbina je u međuvremenu izmenjena. Osvežite stranicu.');
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: 'STATUS_CHANGED',
        fromStatus: order.status,
        toStatus: to,
        message: note || null,
        actor: 'admin',
      },
    });

    if (NOTIFY_STATUSES.includes(to)) {
      const fresh = (await findByNumber(number))!;
      void deliver(order.id, `status-${to}`, () =>
        mailer.send(statusUpdateEmail(toEmailOrder(fresh), emailContext(fresh))),
      );
    }
    return detailForAdmin(number);
  }

  return {
    loyaltyFor,

    async create(input: CheckoutData, idempotencyKey: string | undefined): Promise<CreateOrderResponse> {
      if (!env.ORDERS_OPEN) throw new AppError(503, 'ORDERS_CLOSED', env.ORDERS_CLOSED_MESSAGE);

      if (idempotencyKey) {
        const existing = await db.order.findUnique({ where: { idempotencyKey } });
        if (existing) return { number: existing.number, accessToken: existing.accessToken };
      }

      const products = await catalog.quotable(input.items.map((i) => i.sku));
      const quote = quoteCart(input.items, (sku) => products.get(sku));
      if (quote.issues.length > 0 || quote.lines.length === 0) {
        throw new AppError(409, 'CART_CHANGED', 'Neki proizvodi u korpi su se promenili. Proverite korpu.', {
          issues: quote.issues,
        });
      }

      const { customer } = input;
      const loyalty = await loyaltyFor(customer.email);
      // A returning customer keeps the Instagram handle the owner saved on an earlier order.
      const known = await db.order.findFirst({
        where: { emailNormalized: normalizeEmail(customer.email), instagramHandle: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { instagramHandle: true },
      });
      const discountRsd = loyalty.tier
        ? loyaltyDiscountRsd(quote.subtotalRsd, loyalty.tier.discountPercent)
        : 0;

      for (let attempt = 1; attempt <= 5; attempt++) {
        const number = generateOrderNumber(new Date());
        try {
          const order = await db.order.create({
            data: {
              number,
              accessToken: randomBytes(24).toString('base64url'),
              idempotencyKey: idempotencyKey ?? null,
              fullName: customer.fullName,
              email: customer.email,
              emailNormalized: normalizeEmail(customer.email),
              instagramHandle: known?.instagramHandle ?? null,
              phone: customer.phone,
              address: customer.address,
              city: customer.city,
              postalCode: customer.postalCode,
              note: customer.note,
              subtotalRsd: quote.subtotalRsd,
              discountRsd,
              loyaltyTier: discountRsd > 0 ? (loyalty.tier?.name ?? null) : null,
              totalRsd: quote.subtotalRsd - discountRsd,
              lines: {
                create: quote.lines.map((l) => ({
                  sku: l.sku,
                  slug: l.slug,
                  name: l.name,
                  brand: l.brand,
                  image: l.image,
                  unitPriceRsd: l.unitPriceRsd,
                  unitCostRsd: products.get(l.sku)?.costRsd ?? 0,
                  quantity: l.quantity,
                  lineTotalRsd: l.lineTotalRsd,
                })),
              },
              events: { create: { type: 'CREATED', toStatus: 'NEW', actor: 'customer' } },
            },
            include: orderInclude,
          });
          log.info({ order: order.number, total: order.totalRsd }, 'Order created');
          // Fire-and-forget: the customer gets their confirmation page immediately; delivery is recorded.
          void notifyCreated(order);
          return { number: order.number, accessToken: order.accessToken };
        } catch (error) {
          if (isUniqueViolation(error, 'idempotencyKey') && idempotencyKey) {
            const existing = await db.order.findUniqueOrThrow({ where: { idempotencyKey } });
            return { number: existing.number, accessToken: existing.accessToken };
          }
          if (isUniqueViolation(error, 'number') && attempt < 5) continue;
          throw error;
        }
      }
      throw new AppError(500, 'ORDER_NUMBER_EXHAUSTED', 'Pokušajte ponovo.');
    },

    /** Customer view. A wrong token looks exactly like a missing order. */
    async viewForCustomer(number: string, token: string): Promise<OrderView> {
      const order = await findByNumber(number);
      if (!order || !tokensMatch(order.accessToken, token)) throw notFound('Porudžbina nije pronađena.');
      return toView(order);
    },

    async listForAdmin(query: {
      status?: string;
      q?: string;
      page: number;
    }): Promise<Paginated<AdminOrderSummary>> {
      const where: Prisma.OrderWhereInput = {
        ...(query.status ? { status: query.status as OrderStatus } : {}),
        ...(query.q
          ? {
              OR: [
                { number: { contains: query.q } },
                { fullName: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
                { phone: { contains: query.q } },
              ],
            }
          : {}),
      };
      const [total, rows] = await db.$transaction([
        db.order.count({ where }),
        db.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * ADMIN_PAGE_SIZE,
          take: ADMIN_PAGE_SIZE,
          include: { lines: { select: { quantity: true } } },
        }),
      ]);
      return {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: ADMIN_PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
      };
    },

    detailForAdmin,

    changeStatus,

    /**
     * Saves the customer's Instagram handle (pasted as @name or a profile link) on this order and fills
     * it in on their other orders that don't have one yet. An empty value clears it on this order.
     */
    async setInstagramHandle(number: string, input: string): Promise<AdminOrderDetail> {
      const order = await db.order.findUnique({
        where: { number },
        select: { id: true, emailNormalized: true },
      });
      if (!order) throw notFound('Porudžbina nije pronađena.');
      const handle = input.trim() === '' ? null : normalizeInstagramHandle(input);
      if (input.trim() !== '' && !handle) {
        throw new AppError(400, 'VALIDATION_FAILED', 'Neispravan Instagram nalog.', {
          fields: { handle: 'Unesite korisničko ime (npr. @ana.kafa) ili link ka profilu.' },
        });
      }
      await db.$transaction([
        db.order.update({ where: { id: order.id }, data: { instagramHandle: handle } }),
        ...(handle
          ? [
              db.order.updateMany({
                where: { emailNormalized: order.emailNormalized, instagramHandle: null },
                data: { instagramHandle: handle },
              }),
            ]
          : []),
        db.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'NOTE',
            message: handle ? `Instagram: @${handle}` : 'Instagram nalog uklonjen',
            actor: 'admin',
          },
        }),
      ]);
      return detailForAdmin(number);
    },

    /** Orders bought at KaffeK and waiting to be sent, oldest first, with full shipping details. */
    async shipping(): Promise<ShippingResponse> {
      const orders = await db.order.findMany({
        where: { status: 'ORDERED' },
        orderBy: { createdAt: 'asc' },
        include: { lines: { select: { sku: true, brand: true, name: true, quantity: true } } },
      });
      const items = orders.map((o) => ({
        number: o.number,
        createdAt: o.createdAt.toISOString(),
        fullName: o.fullName,
        phone: o.phone,
        email: o.email,
        address: o.address,
        postalCode: o.postalCode,
        city: o.city,
        note: o.note,
        instagramHandle: o.instagramHandle,
        totalRsd: o.totalRsd,
        itemCount: o.lines.reduce((sum, l) => sum + l.quantity, 0),
        lines: o.lines.map(({ brand, name, quantity }) => ({ brand, name, quantity })),
      }));
      return { items, weight: await shipmentWeight(orders.flatMap((o) => o.lines)) };
    },

    /** Everything the owner needs at a glance. */
    async dashboard(now = new Date()): Promise<AdminDashboard> {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [grouped, ordersToday, ordersLast7Days, open, delivered, latest, lastSync] = await Promise.all([
        db.order.groupBy({ by: ['status'], _count: { _all: true } }),
        db.order.count({ where: { createdAt: { gte: startOfDay } } }),
        db.order.count({ where: { createdAt: { gte: weekAgo } } }),
        db.order.findMany({
          where: { status: { in: [...OPEN_STATUSES] } },
          select: { totalRsd: true, lines: { select: { unitCostRsd: true, quantity: true } } },
        }),
        // Delivered this month: the status change to DELIVERED happened this month.
        db.order.findMany({
          where: {
            status: 'DELIVERED',
            events: { some: { toStatus: 'DELIVERED', createdAt: { gte: startOfMonth } } },
          },
          select: { totalRsd: true, lines: { select: { unitCostRsd: true, quantity: true } } },
        }),
        db.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { lines: { select: { quantity: true } } },
        }),
        db.syncRun.findFirst({ where: { status: 'SUCCEEDED' }, orderBy: { startedAt: 'desc' } }),
      ]);

      const sum = (orders: typeof open) => {
        const revenue = orders.reduce((s, o) => s + o.totalRsd, 0);
        const cost = orders.reduce(
          (s, o) => s + o.lines.reduce((c, l) => c + l.unitCostRsd * l.quantity, 0),
          0,
        );
        return { revenue, profit: revenue - cost };
      };
      const openSum = sum(open);
      const monthSum = sum(delivered);
      const counts = Object.fromEntries(
        (Object.keys(ORDER_STATUSES) as OrderStatus[]).map((s) => [
          s,
          grouped.find((g) => g.status === s)?._count._all ?? 0,
        ]),
      ) as Record<OrderStatus, number>;

      return {
        counts,
        ordersToday,
        ordersLast7Days,
        openRevenueRsd: openSum.revenue,
        openProfitRsd: openSum.profit,
        monthRevenueRsd: monthSum.revenue,
        monthProfitRsd: monthSum.profit,
        latest: latest.map(toSummary),
        lastSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
        emailEnabled: mailConfigured(env) && !!env.ADMIN_EMAIL,
      };
    },

    /** Customers grouped by email, with their Kafe klub standing. */
    async customers(): Promise<AdminCustomer[]> {
      const orders = await db.order.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          emailNormalized: true,
          fullName: true,
          phone: true,
          city: true,
          status: true,
          totalRsd: true,
          createdAt: true,
          instagramHandle: true,
        },
      });
      const byEmail = new Map<string, AdminCustomer>();
      for (const o of orders) {
        // Orders are newest first, so the first one seen carries the current name/phone/city.
        const c = byEmail.get(o.emailNormalized) ?? {
          email: o.emailNormalized,
          name: o.fullName,
          phone: o.phone,
          city: o.city,
          orders: 0,
          completedOrders: 0,
          spentRsd: 0,
          lastOrderAt: o.createdAt.toISOString(),
          tier: null,
          instagramHandle: null,
        };
        c.instagramHandle ??= o.instagramHandle;
        c.orders += 1;
        if (o.status === 'DELIVERED') {
          c.completedOrders += 1;
          c.spentRsd += o.totalRsd;
        }
        byEmail.set(o.emailNormalized, c);
      }
      return [...byEmail.values()]
        .map((c) => ({ ...c, tier: loyaltyStatus(c.completedOrders).tier?.name ?? null }))
        .sort((a, b) => b.completedOrders - a.completedOrders || b.lastOrderAt.localeCompare(a.lastOrderAt));
    },

    /**
     * The next KaffeK purchase: every item of every confirmed order not yet ordered, summed per SKU,
     * with current availability and landed cost at the source.
     */
    async procurement(): Promise<ProcurementResponse> {
      const confirmed = await db.order.findMany({
        where: { status: 'CONFIRMED' },
        orderBy: { createdAt: 'asc' },
        include: { lines: true },
      });
      const skus = [...new Set(confirmed.flatMap((o) => o.lines.map((l) => l.sku)))];
      const products = new Map(
        (
          await db.product.findMany({
            where: { sku: { in: skus } },
            select: {
              sku: true,
              kaffekId: true,
              sourceUrl: true,
              inStock: true,
              active: true,
              costRsd: true,
            },
          })
        ).map((p) => [p.sku, p]),
      );

      const items = new Map<string, ProcurementItem>();
      for (const order of confirmed) {
        for (const line of order.lines) {
          const product = products.get(line.sku);
          const item = items.get(line.sku) ?? {
            sku: line.sku,
            kaffekId: product?.kaffekId ?? null,
            name: line.name,
            brand: line.brand,
            slug: line.slug,
            sourceUrl: product?.sourceUrl ?? null,
            quantity: 0,
            orders: [],
            inStockAtSource: product?.active ? product.inStock : null,
            // Today's landed cost if the product is still listed, else what it cost when ordered.
            unitCostRsd: product?.active && product.costRsd > 0 ? product.costRsd : line.unitCostRsd,
          };
          item.quantity += line.quantity;
          if (!item.orders.includes(order.number)) item.orders.push(order.number);
          items.set(line.sku, item);
        }
      }

      const list = [...items.values()].sort(
        (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
      );
      return {
        orders: confirmed.map((o) => ({
          number: o.number,
          customerName: o.fullName,
          createdAt: o.createdAt.toISOString(),
          totalRsd: o.totalRsd,
        })),
        items: list,
        totalCostRsd: list.reduce((sum, i) => sum + i.unitCostRsd * i.quantity, 0),
        totalRevenueRsd: confirmed.reduce((sum, o) => sum + o.totalRsd, 0),
        weight: await shipmentWeight(list),
      };
    },

    /** After buying at KaffeK: moves the given confirmed orders to ORDERED. Others are skipped. */
    async markOrdered(numbers: readonly string[]): Promise<{ updated: string[]; skipped: string[] }> {
      const updated: string[] = [];
      const skipped: string[] = [];
      for (const number of new Set(numbers)) {
        const order = await db.order.findUnique({ where: { number }, select: { status: true } });
        if (order?.status !== 'CONFIRMED') {
          skipped.push(number);
          continue;
        }
        await changeStatus(number, 'ORDERED', 'Poručeno na KaffeK');
        updated.push(number);
      }
      return { updated, skipped };
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
