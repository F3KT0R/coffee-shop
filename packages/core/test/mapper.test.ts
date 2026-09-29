import { describe, expect, it } from 'vitest';
import { mapKaffekItem, type MappedProduct } from '../src/kaffek/mapper.js';
import type { KaffekItem } from '../src/kaffek/types.js';
import beanFixtures from './fixtures/kaffek-beans.json' with { type: 'json' };
import fixtures from './fixtures/kaffek-items.json' with { type: 'json' };

/** Real items captured from kaffek.co.uk with KAFFEK_PRODUCTS_QUERY. */
const items = { ...fixtures, ...beanFixtures } as unknown as Record<string, KaffekItem>;

function mapped(sku: string): MappedProduct {
  const item = items[sku];
  if (!item) throw new Error(`fixture ${sku} missing`);
  const result = mapKaffekItem(item);
  if (!result.ok) throw new Error(`expected ${sku} to map, got ${result.reason}`);
  return result.product;
}

function skipReason(sku: string) {
  const result = mapKaffekItem(items[sku]!);
  return result.ok ? null : result.reason;
}

describe('mapKaffekItem', () => {
  it('maps a Nespresso coffee capsule with the real brand (not the system)', () => {
    const p = mapped('100341');
    expect(p).toMatchObject({
      sku: '100341',
      slug: 'miscela-blu-caffe-borbone-nespresso',
      name: 'Miscela Blu',
      brand: 'Caffè Borbone',
      category: 'kapsule',
      kind: 'kafa',
      systems: ['nespresso'],
      packCount: 50,
      packUnit: 'kapsula',
      intensity: 8,
      intensityLevel: 4,
      coffeeStyle: 'Espresso',
      priceGbp: 8.29,
      regularPriceGbp: null,
      inStock: true,
      sourceUrl: 'https://kaffek.co.uk/miscela-blu-caffe-borbone-nespresso.html',
    });
    expect(p.rating).toBeCloseTo(4.3);
    expect(p.weightKg).toBe(0.56);
    expect(p.kaffekId).toBe(4400); // uid "NDQwMA==" -- matches KaffeK's own add-to-cart id
    expect(p.dietTags).toEqual(expect.arrayContaining(['dairy-free', 'gluten-free', 'lactose-free']));
    expect(p.images.length).toBeGreaterThan(1);
    expect(p.description).not.toMatch(/<[^>]+>/);
  });

  it('classifies cocoa capsules as capsules of kind chocolate', () => {
    expect(mapped('100575')).toMatchObject({ category: 'kapsule', kind: 'cokolada', systems: ['nespresso'] });
  });

  it('maps tea bags without a machine system into the tea section', () => {
    expect(mapped('100678')).toMatchObject({
      category: 'caj',
      kind: 'caj',
      systems: [],
      packUnit: 'kesica',
      packCount: 17,
    });
  });

  it('maps coffee syrups by volume', () => {
    expect(mapped('505055')).toMatchObject({
      category: 'sirupi',
      kind: 'sirup',
      packUnit: 'ml',
      packCount: 200,
    });
  });

  it('maps coffee beans by weight, with the real shipping weight', () => {
    expect(mapped('100863')).toMatchObject({ category: 'zrno', packUnit: 'g', packCount: 500 });
    expect(mapped('100808')).toMatchObject({
      category: 'zrno',
      kind: 'kafa',
      systems: [],
      packUnit: 'g',
      packCount: 1000,
      weightKg: 1.01,
    });
  });

  it('calls Senseo pods "jastučići"', () => {
    expect(mapped('100699')).toMatchObject({ systems: ['senseo'], packUnit: 'jastučića' });
  });

  it('keeps the pre-discount price while the source runs a sale', () => {
    const p = mapped('100742');
    expect(p.regularPriceGbp).toBeGreaterThan(p.priceGbp);
    expect(p.intensityMax).toBe(13);
  });

  it('reports out-of-stock items as not in stock', () => {
    expect(mapped('100744').inStock).toBe(false);
  });

  it('skips products the shop does not sell', () => {
    expect(skipReason('100747')).toBe('unsupported-group'); // descaler
    expect(skipReason('100844')).toBe('not-simple-product'); // bundle
  });

  it('skips items whose attributes Magento failed to return', () => {
    const broken = { ...items['100341']!, custom_attributesV2: null };
    expect(mapKaffekItem(broken)).toEqual({ ok: false, sku: '100341', reason: 'missing-attributes' });
  });

  it('refuses prices in a currency other than GBP (wrong store view)', () => {
    const item = structuredClone(items['100341']!);
    item.price_range!.minimum_price.final_price.currency = 'DKK';
    expect(mapKaffekItem(item)).toMatchObject({ ok: false, reason: 'wrong-currency' });
  });
});
