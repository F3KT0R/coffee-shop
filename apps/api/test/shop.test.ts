import type { CreateOrderResponse, OrderView, ProductListResponse } from '@kafeshop/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import {
  createTestApp,
  flush,
  startTestDb,
  syncNow,
  TEST_SECRETS,
  type RecordingMailer,
  type TestDb,
} from './helpers.js';

let testDb: TestDb;
let ctx: App & { mailer: RecordingMailer };

beforeAll(async () => {
  testDb = await startTestDb();
});
afterAll(async () => {
  await testDb.stop();
});
beforeEach(async () => {
  await testDb.reset();
  ctx = await createTestApp(testDb);
  await syncNow(ctx);
});
afterEach(async () => {
  await ctx.app.close();
});

const customer = {
  fullName: 'Petar Petrović',
  email: 'petar@example.com',
  phone: '064 123 4567',
  address: 'Bulevar oslobođenja 12',
  city: 'Novi Sad',
  postalCode: '21000',
};

function checkout(items: { sku: string; quantity: number }[], extra: Record<string, unknown> = {}) {
  return { customer, items, acceptTerms: true, ...extra };
}

async function placeOrder(
  body = checkout([{ sku: '100341', quantity: 2 }]),
  headers: Record<string, string> = {},
) {
  return ctx.app.inject({ method: 'POST', url: '/api/orders', payload: body, headers });
}

async function login() {
  const response = await ctx.app.inject({
    method: 'POST',
    url: '/api/admin/login',
    payload: { password: TEST_SECRETS.ADMIN_PASSWORD },
  });
  expect(response.statusCode).toBe(200);
  const cookie = response.cookies.find((c) => c.name === 'kzv_admin')!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/admin' });
  return { cookie: `kzv_admin=${cookie.value}` };
}

describe('catalog API', () => {
  it('lists products with filters and stable sorting', async () => {
    const response = await ctx.app.inject('/api/products?category=kapsule&system=nespresso&sort=price-asc');
    const body = response.json<ProductListResponse>();
    expect(response.statusCode).toBe(200);
    expect(body.items.every((p) => p.systems.includes('nespresso'))).toBe(true);
    const inStock = body.items.filter((p) => p.inStock).map((p) => p.priceRsd);
    expect(inStock).toEqual([...inStock].sort((a, b) => a - b));
    expect(response.headers['cache-control']).toContain('max-age');
  });

  it('searches across name, brand and system', async () => {
    const byBrand = (await ctx.app.inject('/api/products?q=borbone')).json<ProductListResponse>();
    expect(byBrand.items.map((p) => p.sku)).toEqual(['100341']);
    const bySystem = (await ctx.app.inject('/api/products?q=dolce%20gusto')).json<ProductListResponse>();
    expect(bySystem.items.map((p) => p.sku)).toContain('100800');
  });

  it('finds products when typed without accents', async () => {
    const brulee = (await ctx.app.inject('/api/products?q=creme%20brulee')).json<ProductListResponse>();
    expect(brulee.items.map((p) => p.sku)).toEqual(['100575']);
    const caffe = (await ctx.app.inject('/api/products?q=CAFFE')).json<ProductListResponse>();
    expect(caffe.items.map((p) => p.sku)).toContain('100341');
  });

  it('paginates', async () => {
    const page1 = (await ctx.app.inject('/api/products?pageSize=4&page=1')).json<ProductListResponse>();
    const page3 = (await ctx.app.inject('/api/products?pageSize=4&page=3')).json<ProductListResponse>();
    expect(page1).toMatchObject({ total: 11, totalPages: 3 });
    expect(page3.items).toHaveLength(3);
  });

  it('rejects invalid query parameters with field messages', async () => {
    const response = await ctx.app.inject('/api/products?pageSize=1000');
    expect(response.statusCode).toBe(400);
    expect(response.json().error.fields).toHaveProperty('pageSize');
  });

  it('returns product detail with related products, and 404 for unknown slugs', async () => {
    const response = await ctx.app.inject('/api/products/miscela-blu-caffe-borbone-nespresso');
    expect(response.statusCode).toBe(200);
    expect(response.json().product).toMatchObject({ sku: '100341', priceRsd: 1_950 });
    expect(Array.isArray(response.json().related)).toBe(true);
    expect((await ctx.app.inject('/api/products/nope')).statusCode).toBe(404);
  });

  it('returns facet counts', async () => {
    const meta = (await ctx.app.inject('/api/catalog/meta?category=kapsule')).json();
    expect(meta.categories.find((c: { value: string }) => c.value === 'kapsule').count).toBe(8);
    expect(meta.systems.find((s: { value: string }) => s.value === 'nespresso')).toMatchObject({
      label: 'Nespresso',
    });
    expect(meta.lastSyncAt).not.toBeNull();
  });

  it('quotes a cart from server prices and reports problems', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/cart/quote',
      payload: {
        items: [
          { sku: '100341', quantity: 2 },
          { sku: '100744', quantity: 1 },
          { sku: 'GONE', quantity: 1 },
        ],
      },
    });
    const quote = response.json();
    expect(quote.subtotalRsd).toBe(3_900);
    expect(quote.issues.map((i: { type: string }) => i.type)).toEqual(['out-of-stock', 'unavailable']);
  });
});

describe('orders', () => {
  it('creates a cash-on-delivery order priced on the server, and emails both sides', async () => {
    const response = await placeOrder();
    expect(response.statusCode).toBe(201);
    const { number, accessToken } = response.json<CreateOrderResponse>();
    expect(number).toMatch(/^\d{6}-\d{4}$/);

    const order = await testDb.db.order.findUniqueOrThrow({ where: { number }, include: { lines: true } });
    expect(order).toMatchObject({
      status: 'NEW',
      subtotalRsd: 3_900,
      discountRsd: 0,
      totalRsd: 3_900,
      phone: '+381641234567',
      emailNormalized: 'petar@example.com',
    });
    expect(order.lines[0]).toMatchObject({
      sku: '100341',
      unitPriceRsd: 1_950,
      unitCostRsd: 1_474,
      quantity: 2,
    });

    await flush();
    expect(ctx.mailer.sent.map((m) => m.to).sort()).toEqual(['owner@shop.test', 'petar@example.com']);
    const confirmation = ctx.mailer.sent.find((m) => m.to === 'petar@example.com')!;
    expect(confirmation.html).toContain(accessToken);
    expect(confirmation.html).toContain(number);
    expect(confirmation.html).toContain('Instagram');
    expect(confirmation.html).toContain('pouzećem');
    // The receipt: branded header, product thumbnails, Kafe klub progress, DM link to the shop.
    expect(confirmation.html).toContain('https://shop.test/email/header-thanks.jpg');
    expect(confirmation.html).toMatch(/<img src="https:\/\/kaffek\.co\.uk\/media\/catalog\/product\/[^"]+"/);
    expect(confirmation.html).toContain('Kafe klub');
    expect(confirmation.html).toContain('https://ig.me/m/kafekapsule');
    expect(confirmation.html).not.toMatch(/uplat|račun|IPS|depozit/i);
  });

  it('is idempotent for a retried checkout', async () => {
    const headers = { 'idempotency-key': 'checkout-abc-12345' };
    const first = (await placeOrder(undefined, headers)).json<CreateOrderResponse>();
    const second = (await placeOrder(undefined, headers)).json<CreateOrderResponse>();
    expect(second.number).toBe(first.number);
    expect(await testDb.db.order.count()).toBe(1);
  });

  it('refuses a cart that changed (out of stock) with the exact issues', async () => {
    const response = await placeOrder(checkout([{ sku: '100744', quantity: 1 }]));
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'CART_CHANGED',
      issues: [{ sku: '100744', type: 'out-of-stock' }],
    });
    expect(await testDb.db.order.count()).toBe(0);
  });

  it('validates customer data with Serbian field messages', async () => {
    const response = await placeOrder({
      ...checkout([{ sku: '100341', quantity: 1 }]),
      customer: { ...customer, postalCode: '1' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.fields['customer.postalCode']).toBe('Poštanski broj ima 5 cifara.');
  });

  it('does not take orders while closed', async () => {
    await ctx.app.close();
    ctx = await createTestApp(testDb, { env: { ORDERS_OPEN: 'false' } });
    const response = await placeOrder();
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('ORDERS_CLOSED');
    expect((await ctx.app.inject('/api/config')).json().ordersOpen).toBe(false);
    // No SMTP in tests, so the site must not promise emails.
    expect((await ctx.app.inject('/api/config')).json().emailEnabled).toBe(false);
  });

  it('still creates the order when email delivery fails, and records the failure', async () => {
    ctx.mailer.failNext = true;
    const response = await placeOrder();
    expect(response.statusCode).toBe(201);
    await flush();
    const events = await testDb.db.orderEvent.findMany({ where: { type: 'EMAIL_FAILED' } });
    expect(events).toHaveLength(1);
  });

  it('shows the order to the holder of the link, with no payment step', async () => {
    const { number, accessToken } = (await placeOrder()).json<CreateOrderResponse>();
    const response = await ctx.app.inject(`/api/orders/${number}?t=${accessToken}`);
    const view = response.json<OrderView>();
    expect(view).toMatchObject({ number, status: 'NEW', totalRsd: 3_900, discountRsd: 0 });
    expect(view).not.toHaveProperty('payment');
  });

  it('hides the order from anyone with a wrong token', async () => {
    const { number } = (await placeOrder()).json<CreateOrderResponse>();
    const response = await ctx.app.inject(`/api/orders/${number}?t=wrong-token-value`);
    expect(response.statusCode).toBe(404);
  });

  it('rate-limits order creation per client', async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await placeOrder()).statusCode);
    expect(codes.slice(0, 5).every((c) => c === 201)).toBe(true);
    expect(codes[5]).toBe(429);
  });
});

describe('admin', () => {
  it('rejects a wrong password and unauthenticated access', async () => {
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/login',
      payload: { password: 'nope' },
    });
    expect(wrong.statusCode).toBe(401);
    expect((await ctx.app.inject('/api/admin/orders')).statusCode).toBe(401);
    const forged = await ctx.app.inject({
      url: '/api/admin/orders',
      headers: { cookie: 'kzv_admin=e30.forged' },
    });
    expect(forged.statusCode).toBe(401);
  });

  it('lists orders and moves them through the allowed statuses, notifying the customer', async () => {
    const { number } = (await placeOrder()).json<CreateOrderResponse>();
    const headers = await login();

    const list = (await ctx.app.inject({ url: '/api/admin/orders', headers })).json();
    expect(list.items[0]).toMatchObject({ number, status: 'NEW', itemCount: 2, totalRsd: 3_900 });

    const skip = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${number}/status`,
      headers,
      payload: { status: 'SHIPPED' },
    });
    expect(skip.statusCode).toBe(409);

    await flush();
    ctx.mailer.sent.length = 0;
    const confirmed = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${number}/status`,
      headers,
      payload: { status: 'CONFIRMED', note: 'Poslao broj na Instagramu' },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json()).toMatchObject({
      status: 'CONFIRMED',
      allowedTransitions: ['ORDERED', 'CANCELLED'],
    });

    await flush();
    expect(ctx.mailer.sent.map((m) => m.subject)).toEqual([`Porudžbina ${number}: Potvrđena`]);

    // Marked as ordered by mistake: back into the next purchase, without emailing the customer again.
    const status = (to: string) =>
      ctx.app.inject({
        method: 'POST',
        url: `/api/admin/orders/${number}/status`,
        headers,
        payload: { status: to },
      });
    expect((await status('ORDERED')).json().allowedTransitions).toEqual([
      'SHIPPED',
      'CONFIRMED',
      'CANCELLED',
    ]);
    ctx.mailer.sent.length = 0;
    const back = await status('CONFIRMED');
    expect(back.statusCode).toBe(200);
    expect(back.json()).toMatchObject({ status: 'CONFIRMED' });
    await flush();
    expect(ctx.mailer.sent).toEqual([]);
    const batch = (await ctx.app.inject({ url: '/api/admin/procurement', headers })).json();
    expect(batch.orders.map((o: { number: string }) => o.number)).toContain(number);
  });

  it('shows cost and profit per order', async () => {
    const { number } = (await placeOrder()).json<CreateOrderResponse>();
    const headers = await login();
    const detail = (await ctx.app.inject({ url: `/api/admin/orders/${number}`, headers })).json();
    expect(detail).toMatchObject({ totalRsd: 3_900, costRsd: 2 * 1_474, profitRsd: 3_900 - 2 * 1_474 });
  });

  it('builds the KaffeK purchase list from confirmed orders and marks the batch as ordered', async () => {
    const first = (await placeOrder()).json<CreateOrderResponse>();
    const second = (
      await placeOrder(
        checkout([
          { sku: '100341', quantity: 1 },
          { sku: '100800', quantity: 3 },
        ]),
      )
    ).json<CreateOrderResponse>();
    const unpaid = (await placeOrder(checkout([{ sku: '505055', quantity: 1 }]))).json<CreateOrderResponse>();
    const headers = await login();
    for (const n of [first.number, second.number]) {
      await ctx.app.inject({
        method: 'POST',
        url: `/api/admin/orders/${n}/status`,
        headers,
        payload: { status: 'CONFIRMED' },
      });
    }

    const batch = (await ctx.app.inject({ url: '/api/admin/procurement', headers })).json();
    expect(batch.orders.map((o: { number: string }) => o.number).sort()).toEqual(
      [first.number, second.number].sort(),
    );
    expect(batch.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: '100341', kaffekId: 4400, quantity: 3, inStockAtSource: true }),
        expect.objectContaining({ sku: '100800', quantity: 3 }),
      ]),
    );
    expect(batch.items.find((i: { sku: string }) => i.sku === '505055')).toBeUndefined(); // not confirmed
    // 3 × 0.56 kg + 3 × 0.26 kg, for comparing against the courier's billed weight.
    expect(batch.weight).toMatchObject({ totalKg: 2.46, estimatedBoxes: 0, transportGbpPerKg: 4 });
    expect(batch.weight.gbpRsdRate).toBeGreaterThan(0);

    const marked = await ctx.app.inject({
      method: 'POST',
      url: '/api/admin/procurement/mark-ordered',
      headers,
      payload: { orders: [first.number, second.number, unpaid.number] },
    });
    expect(marked.json()).toEqual({ updated: [first.number, second.number], skipped: [unpaid.number] });
    const after = (await ctx.app.inject({ url: '/api/admin/procurement', headers })).json();
    expect(after.items).toEqual([]);
  });

  it('triggers a sync and shows the run history', async () => {
    const headers = await login();
    const runs = (await ctx.app.inject({ url: '/api/admin/sync-runs', headers })).json();
    expect(runs.items[0]).toMatchObject({ status: 'SUCCEEDED', upserted: 11 });
  });
});

describe('sync endpoint and health', () => {
  it('requires the sync secret', async () => {
    expect((await ctx.app.inject({ method: 'POST', url: '/api/sync' })).statusCode).toBe(401);
    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${TEST_SECRETS.SYNC_SECRET}` },
    });
    expect(ok.statusCode).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  it('answers ping without touching the database, and reports health', async () => {
    expect((await ctx.app.inject('/api/ping')).json()).toEqual({ ok: true });
    const health = (await ctx.app.inject('/api/health')).json();
    expect(health).toMatchObject({ ok: true, database: 'up', catalog: { activeProducts: 11, stale: false } });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const response = await ctx.app.inject('/api/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

describe('Kafe klub and the admin overview', () => {
  async function deliver(number: string, headers: { cookie: string }) {
    for (const status of ['CONFIRMED', 'ORDERED', 'SHIPPED', 'DELIVERED']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/admin/orders/${number}/status`,
        headers,
        payload: { status },
      });
      expect(res.statusCode).toBe(200);
    }
  }

  it('gives a returning customer the tier discount once two orders were picked up', async () => {
    const headers = await login();
    const lookup = async (email: string) =>
      (await ctx.app.inject({ method: 'POST', url: '/api/loyalty', payload: { email } })).json();

    expect(await lookup('petar@example.com')).toMatchObject({ completedOrders: 0, tier: null });

    const one = (await placeOrder()).json<CreateOrderResponse>();
    const two = (await placeOrder()).json<CreateOrderResponse>();
    const cancelled = (await placeOrder()).json<CreateOrderResponse>();
    await deliver(one.number, headers);
    await deliver(two.number, headers);
    await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${cancelled.number}/status`,
      headers,
      payload: { status: 'CANCELLED' },
    });

    // Same person, different capitalisation: still recognised. The cancelled order doesn't count.
    expect(await lookup('PETAR@example.com ')).toMatchObject({
      completedOrders: 2,
      tier: { id: 'stalni-gost', discountPercent: 5 },
      next: { id: 'ljubitelj-kafe', ordersNeeded: 3 },
    });

    const third = (
      await placeOrder({
        ...checkout([{ sku: '100341', quantity: 2 }]),
        customer: { ...customer, email: 'Petar@Example.com' },
      })
    ).json<CreateOrderResponse>();
    const order = await testDb.db.order.findUniqueOrThrow({ where: { number: third.number } });
    // 5% of 3900 = 195 -> rounded down to 190
    expect(order).toMatchObject({
      subtotalRsd: 3_900,
      discountRsd: 190,
      totalRsd: 3_710,
      loyaltyTier: 'Stalni gost',
    });
  });

  it('summarises orders, revenue and profit on the dashboard and lists customers', async () => {
    const headers = await login();
    const a = (await placeOrder()).json<CreateOrderResponse>();
    await placeOrder(checkout([{ sku: '100800', quantity: 1 }]));
    await deliver(a.number, headers);

    const dash = (await ctx.app.inject({ url: '/api/admin/dashboard', headers })).json();
    expect(dash.counts).toMatchObject({ NEW: 1, DELIVERED: 1, CONFIRMED: 0 });
    expect(dash.ordersToday).toBe(2);
    expect(dash.monthRevenueRsd).toBe(3_900);
    expect(dash.monthProfitRsd).toBe(3_900 - 2 * 1_474);
    expect(dash.latest).toHaveLength(2);
    expect(dash.emailEnabled).toBe(false); // test env has no SMTP

    const customers = (await ctx.app.inject({ url: '/api/admin/customers', headers })).json();
    expect(customers.items).toEqual([
      expect.objectContaining({ email: 'petar@example.com', orders: 2, completedOrders: 1, spentRsd: 3_900 }),
    ]);
  });
});

describe('Instagram handle and shipping', () => {
  it('saves the handle from a pasted link, reuses it for the customer, and lists ORDERED orders to ship', async () => {
    const headers = await login();
    const first = (await placeOrder()).json<CreateOrderResponse>();
    const second = (await placeOrder()).json<CreateOrderResponse>();

    const bad = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${first.number}/instagram`,
      headers,
      payload: { handle: 'not a handle!' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.fields.handle).toBeDefined();

    const saved = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/orders/${first.number}/instagram`,
      headers,
      payload: { handle: 'https://www.instagram.com/Petar.Kafa/?igsh=x1' },
    });
    expect(saved.json()).toMatchObject({ instagramHandle: 'petar.kafa' });

    // Filled in on the customer's other order, and copied onto their next order automatically.
    const other = await testDb.db.order.findUniqueOrThrow({ where: { number: second.number } });
    expect(other.instagramHandle).toBe('petar.kafa');
    const third = (await placeOrder()).json<CreateOrderResponse>();
    expect(
      (await testDb.db.order.findUniqueOrThrow({ where: { number: third.number } })).instagramHandle,
    ).toBe('petar.kafa');
    const customers = (await ctx.app.inject({ url: '/api/admin/customers', headers })).json();
    expect(customers.items[0]).toMatchObject({ instagramHandle: 'petar.kafa' });

    for (const status of ['CONFIRMED', 'ORDERED']) {
      await ctx.app.inject({
        method: 'POST',
        url: `/api/admin/orders/${first.number}/status`,
        headers,
        payload: { status },
      });
    }
    const shipping = (await ctx.app.inject({ url: '/api/admin/shipping', headers })).json();
    expect(shipping.weight).toMatchObject({ totalKg: 1.12, boxes: 2, estimatedBoxes: 0 });
    expect(shipping.items).toEqual([
      expect.objectContaining({
        number: first.number,
        fullName: 'Petar Petrović',
        address: 'Bulevar oslobođenja 12',
        postalCode: '21000',
        city: 'Novi Sad',
        phone: '+381641234567',
        totalRsd: 3_900,
        instagramHandle: 'petar.kafa',
        itemCount: 2,
      }),
    ]);
  });
});
