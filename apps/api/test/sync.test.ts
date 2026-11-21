import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICING, landedCostRsd, shopPriceRsd, shopPrices } from '@kafeshop/core';
import { parseOtpGbpSellRate } from '../src/ingestion/exchangeRate.js';
import { parseListingPage } from '../src/ingestion/kaffekListing.js';
import { createTestApp, fixtureItems, listingHtml, startTestDb, syncNow, type TestDb } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

let testDb: TestDb;
beforeAll(async () => {
  testDb = await startTestDb();
});
afterAll(async () => {
  await testDb.stop();
});
beforeEach(async () => {
  await testDb.reset();
});

const SELLABLE = [
  '100341',
  '100575',
  '100678',
  '100699',
  '100742',
  '100744',
  '100752',
  '100800',
  '100863',
  '108905',
  '505055',
];

describe('catalog sync', () => {
  it('imports sellable products, priced in RSD at the bank sell rate plus markup', async () => {
    const app = await createTestApp(testDb);
    const run = await syncNow(app);

    expect(run).toMatchObject({
      status: 'SUCCEEDED',
      fetched: 13,
      upserted: 11,
      skipped: 2,
      complete: true,
      gbpRsdRate: 140,
    });
    const products = await testDb.db.product.findMany({ orderBy: { sku: 'asc' } });
    expect(products.map((p) => p.sku)).toEqual(SELLABLE);

    const miscela = products.find((p) => p.sku === '100341')!;
    // (£8.29 + 0.56 kg × £4) × 140 = 1474 landed; × 1.30 = 1916 -> rounded up to 1950
    expect(miscela).toMatchObject({ priceRsd: 1_950, costRsd: 1_474, weightKg: 0.56, kaffekId: 4400 });
    expect(miscela.brand).toBe('Caffè Borbone');
    expect(await testDb.db.exchangeRate.count()).toBe(1);
    await app.app.close();
  });

  it('keeps the regular price while the source runs a sale (the discount is extra profit)', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    // 100742 is on sale at KaffeK: £7.49 instead of £8.99, 0.18 kg
    const onSale = await testDb.db.product.findUniqueOrThrow({ where: { sku: '100742' } });
    const rules = { ...DEFAULT_PRICING, gbpToRsdRate: 140 };
    expect(onSale.priceRsd).toBe(shopPriceRsd(8.99, 0.18, rules));
    expect(onSale.costRsd).toBe(landedCostRsd(7.49, 0.18, rules));
    await app.app.close();
  });

  it('retires products that disappeared from a complete source listing', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    app.source.items = app.source.items.filter((i) => i.sku !== '100800');

    const run = await syncNow(app);
    expect(run).toMatchObject({ status: 'SUCCEEDED', retired: 1 });
    expect((await testDb.db.product.findUnique({ where: { sku: '100800' } }))?.active).toBe(false);
    await app.app.close();
  });

  it('retires nothing when the source listing is incomplete', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    app.source.items = app.source.items.filter((i) => i.sku !== '100800');
    app.source.totalCount = 13; // claims 13, delivers 12

    const run = await syncNow(app);
    expect(run).toMatchObject({ status: 'SUCCEEDED', retired: 0, complete: false });
    expect(run.error).toMatch(/nothing retired/);
    expect((await testDb.db.product.findUnique({ where: { sku: '100800' } }))?.active).toBe(true);
    await app.app.close();
  });

  it('gives SKUs that share a KaffeK URL key distinct, stable slugs', async () => {
    const app = await createTestApp(testDb);
    const shared = app.source.items.find((i) => i.sku === '100341')!.url_key;
    app.source.items = app.source.items.map((i) => (i.sku === '100800' ? { ...i, url_key: shared } : i));

    const run = await syncNow(app);
    expect(run.status).toBe('SUCCEEDED');
    const slugs = await testDb.db.product.findMany({
      where: { sku: { in: ['100341', '100800'] } },
      orderBy: { sku: 'asc' },
    });
    expect(slugs.map((p) => p.slug)).toEqual([shared, `${shared}--100800`]);
    await app.app.close();
  });

  it('keeps a product whose attributes failed to load instead of retiring it', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    app.source.items = app.source.items.map((i) =>
      i.sku === '100341' ? { ...i, custom_attributesV2: null } : i,
    );

    const run = await syncNow(app);
    expect(run.retired).toBe(0);
    expect((await testDb.db.product.findUnique({ where: { sku: '100341' } }))?.active).toBe(true);
    await app.app.close();
  });

  it('refuses to mass-retire the catalog when the source looks broken', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    // 25 more active products that the source no longer lists
    await testDb.db.product.createMany({
      data: Array.from({ length: 25 }, (_, n) => ({
        sku: `OLD${n}`,
        slug: `old-${n}`,
        name: 'Old',
        brand: 'X',
        category: 'kapsule',
        kind: 'kafa',
        description: '',
        priceGbp: 1,
        priceRsd: 300,
        inStock: true,
        sourceUrl: 'https://kaffek.co.uk/',
        lastSeenAt: new Date(),
      })),
    });

    const run = await syncNow(app);
    expect(run.retired).toBe(0);
    expect(run.error).toMatch(/Safety limit/);
    expect(await testDb.db.product.count({ where: { active: true } })).toBe(36);
    await app.app.close();
  });

  it('fails without touching prices when no exchange rate is available', async () => {
    const app = await createTestApp(testDb, {
      source: { items: Object.values(fixtureItems), otpSellRate: null, requests: [] },
    });
    const run = await syncNow(app);
    expect(run.status).toBe('FAILED');
    expect(run.error).toMatch(/exchange rate/);
    expect(await testDb.db.product.count()).toBe(0);
    await app.app.close();
  });

  it('falls back to the last stored rate when live sources are down', async () => {
    const app = await createTestApp(testDb, {
      source: { items: Object.values(fixtureItems), otpSellRate: null, requests: [] },
    });
    await testDb.db.exchangeRate.create({
      data: { date: new Date(Date.now() - 3 * 86_400_000), gbpSell: 138, source: 'otpbanka' },
    });
    const run = await syncNow(app);
    expect(run).toMatchObject({ status: 'SUCCEEDED', gbpRsdRate: 138 });
    await app.app.close();
  });

  it('rewrites only products that changed since the last sync', async () => {
    const app = await createTestApp(testDb);
    await syncNow(app);
    const before = await testDb.db.product.findUniqueOrThrow({ where: { sku: '100575' } });

    expect(await syncNow(app)).toMatchObject({ status: 'SUCCEEDED', upserted: 0 });

    app.source.items = app.source.items.map((i) => (i.sku === '100341' ? { ...i, quantity: 7 } : i));
    await testDb.db.product.update({ where: { sku: '100800' }, data: { active: false } });
    expect(await syncNow(app)).toMatchObject({ status: 'SUCCEEDED', upserted: 2 });
    expect((await testDb.db.product.findUniqueOrThrow({ where: { sku: '100341' } })).stockQuantity).toBe(7);
    expect((await testDb.db.product.findUniqueOrThrow({ where: { sku: '100800' } })).active).toBe(true);
    const after = await testDb.db.product.findUniqueOrThrow({ where: { sku: '100575' } });
    expect(after.updatedAt).toEqual(before.updatedAt);
    await app.app.close();
  });

  it('runs one sync at a time', async () => {
    const app = await createTestApp(testDb);
    const first = await app.sync.start('test');
    const second = await app.sync.start('test');
    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    await first.run;
    await app.app.close();
  });
});

describe('parseOtpGbpSellRate', () => {
  it('reads the sell column divided by the unit', () => {
    const html = `<tr><td>GBP</td><td><i></i></td><td>Funta</td><td>132.3869</td><td>136.4813</td><td>140.5757</td><td>1</td></tr>
      <tr><td>HUF</td><td></td><td>Forinta</td><td>30.4993</td><td>32.1045</td><td>33.7097</td><td>100</td></tr>`;
    expect(parseOtpGbpSellRate(html)).toBeCloseTo(140.5757);
  });

  it('returns null when GBP is missing', () => {
    expect(parseOtpGbpSellRate('<tr><td>EUR</td><td>1</td></tr>')).toBeNull();
  });
});

describe('category page fallback (GraphQL unavailable)', () => {
  const DG = 'https://kaffek.co.uk/dolce-gusto/pods-for-dolce-gusto.html';
  const NESPRESSO = 'https://kaffek.co.uk/nespresso/pods-for-nespresso.html';
  const rules = { ...DEFAULT_PRICING, gbpToRsdRate: 140 };

  /** Imports the fixture catalog over GraphQL, then blocks GraphQL with a 403. */
  async function blockedApp(listingPages: Record<string, string>) {
    const app = await createTestApp(testDb, { env: { KAFFEK_LISTING_URLS: `${DG},${NESPRESSO}` } });
    await syncNow(app);
    app.source.graphqlStatus = 403;
    app.source.listingPages = listingPages;
    return app;
  }

  it('reads the real KaffeK tile markup', () => {
    const html = readFileSync(resolve(here, 'fixtures/kaffek-listing-excerpt.html'), 'utf8');
    const page = parseListingPage(html);
    expect(page.totalCount).toBe(208);
    expect(page.offers.length).toBeGreaterThanOrEqual(2);
    // First tile in the excerpt: Flat White, £2.89, in stock.
    expect(page.offers[0]).toEqual({
      sku: '101330',
      priceGbp: 2.89,
      regularPriceGbp: null,
      inStock: true,
      systems: ['dolce-gusto'],
    });
  });

  it('refreshes price and stock of existing products, walking every page', async () => {
    const app = await blockedApp({
      [DG]: listingHtml(
        [{ id: 1, sku: '100800', price: 1.9, oldPrice: 2.1, inStock: false, compatibility: 'Dolce Gusto' }],
        2,
      ),
      [`${DG}?p=2`]: listingHtml(
        [{ id: 2, sku: '999999', price: 3, inStock: true, compatibility: 'Dolce Gusto' }],
        2,
      ),
      [NESPRESSO]: listingHtml(
        ['100341', '100575', '108905'].map((sku, i) => ({
          id: 10 + i,
          sku,
          price: 5,
          inStock: true,
          compatibility: 'Nespresso',
        })),
        3,
      ),
    });

    const run = await syncNow(app);
    expect(run).toMatchObject({ status: 'SUCCEEDED', fetched: 5, complete: true });
    expect(run.error).toContain('HTTP 403');
    const dg = await testDb.db.product.findUniqueOrThrow({ where: { sku: '100800' } });
    expect(dg).toMatchObject({
      inStock: false,
      syncHash: '',
      ...shopPrices(
        { priceGbp: 1.9, regularPriceGbp: 2.1, weightKg: dg.weightKg, category: 'kapsule' },
        rules,
      ),
    });
    expect(Number(dg.priceGbp)).toBe(1.9);
    expect(Number(dg.regularPriceGbp)).toBe(2.1);
    expect(await testDb.db.product.findUnique({ where: { sku: '999999' } })).toBeNull();
    await app.app.close();
  });

  it('marks products missing from a fully read listing of their system sold out, and nothing else', async () => {
    const app = await blockedApp({
      [DG]: listingHtml(
        [{ id: 1, sku: '100800', price: 1.7, inStock: true, compatibility: 'Dolce Gusto' }],
        1,
      ),
      [NESPRESSO]: listingHtml(
        [{ id: 10, sku: '100341', price: 8.29, inStock: true, compatibility: 'Nespresso' }],
        1,
      ),
    });

    await syncNow(app);
    const stock = Object.fromEntries(
      (await testDb.db.product.findMany({ select: { sku: true, inStock: true, active: true } })).map((p) => [
        p.sku,
        p,
      ]),
    );
    expect(stock['100575']).toEqual({ sku: '100575', inStock: false, active: true });
    expect(stock['108905']?.inStock).toBe(false);
    expect(stock['100341']?.inStock).toBe(true);
    expect(stock['100699']?.inStock).toBe(true); // Senseo: no listing covers it
    await app.app.close();
  });

  it('marks nothing sold out when a category page fails', async () => {
    const app = await blockedApp({
      [NESPRESSO]: listingHtml(
        [{ id: 10, sku: '100341', price: 8.29, inStock: true, compatibility: 'Nespresso' }],
        1,
      ),
    });

    const run = await syncNow(app);
    expect(run).toMatchObject({ status: 'SUCCEEDED', complete: false });
    expect((await testDb.db.product.findUniqueOrThrow({ where: { sku: '100575' } })).inStock).toBe(true);
    await app.app.close();
  });

  it('fails the run when the category pages return nothing either', async () => {
    const app = await blockedApp({});
    const run = await syncNow(app);
    expect(run.status).toBe('FAILED');
    expect(run.error).toContain('HTTP 403');
    await app.app.close();
  });
});
