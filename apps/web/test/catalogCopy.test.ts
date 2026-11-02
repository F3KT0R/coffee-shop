import type { CatalogCopy, CatalogCopyProduct, ProductListResponse } from '@kafeshop/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCatalogCopyForTests } from '../src/lib/catalogCopy';
import { productQuery, productsQuery, queryClient } from '../src/lib/queries';

const product = (sku: string, name: string): CatalogCopyProduct => ({
  sku,
  slug: `p-${sku}`,
  name,
  brand: 'Lavazza',
  category: 'kapsule',
  kind: 'kafa',
  systems: ['nespresso'],
  packCount: 10,
  packUnit: 'kapsula',
  intensity: null,
  intensityMax: null,
  intensityLevel: 3,
  coffeeStyle: null,
  dietTags: [],
  flavourNotes: [],
  description: '',
  images: [],
  priceRsd: 500,
  inStock: true,
  rating: null,
  reviewCount: 0,
  sourceUrl: 'https://kaffek.co.uk/x',
  popularity: Number(sku),
  firstSeenAt: 0,
  searchText: `lavazza ${name.toLowerCase()} nespresso`,
});

const copy: CatalogCopy = {
  lastSyncAt: '2026-11-01T04:00:00.000Z',
  products: [product('1', 'Old one'), product('2', 'Old two')],
};
const live: ProductListResponse = { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 };

/** Fake network: the ping answers only once `wake()` is called. */
function network(options: { asleep: boolean; withCopy?: boolean }) {
  let wake = () => {};
  const woken = new Promise<void>((resolve) => (wake = resolve));
  if (!options.asleep) wake();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/ping') return woken.then(() => Response.json({ ok: true }));
    if (url === '/catalog.json')
      return options.withCopy === false
        ? new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
        : Response.json(copy);
    if (url.startsWith('/api/products')) return Response.json(live);
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const calls = (prefix: string) => fetchMock.mock.calls.filter(([u]) => String(u).startsWith(prefix)).length;
  return { wake, calls };
}

beforeEach(() => {
  resetCatalogCopyForTests();
  queryClient.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('catalog copy', () => {
  it('uses live data when the API is awake, without loading the copy', async () => {
    const net = network({ asleep: false });
    expect(await queryClient.fetchQuery(productsQuery({}))).toEqual(live);
    expect(net.calls('/catalog.json')).toBe(0);
  });

  it('answers from the copy while the API sleeps, and reloads live data when it wakes', async () => {
    const net = network({ asleep: true });
    const fromCopy = await queryClient.fetchQuery(productsQuery({ q: 'two' }));
    expect(fromCopy.items.map((p) => p.sku)).toEqual(['2']);
    const detail = await queryClient.fetchQuery(productQuery('p-1'));
    expect(detail.product.name).toBe('Old one');
    expect(net.calls('/api/products')).toBe(0);

    net.wake();
    await vi.waitFor(() =>
      expect(queryClient.getQueryState(productsQuery({ q: 'two' }).queryKey)?.isInvalidated).toBe(true),
    );
    expect(await queryClient.fetchQuery(productsQuery({ q: 'two' }))).toEqual(live);
  });

  it('waits for the API when there is no copy', async () => {
    const net = network({ asleep: true, withCopy: false });
    const pending = queryClient.fetchQuery(productsQuery({}));
    await vi.waitFor(() => expect(net.calls('/catalog.json')).toBe(1), { timeout: 3_000 });
    net.wake();
    expect(await pending).toEqual(live);
  });
});
