import { describe, expect, it } from 'vitest';
import { CART_LIMITS, quoteCart, type QuotableProduct } from '../src/cart.js';
import { packLabel, pricePerKg } from '../src/catalog.js';
import { DEFAULT_PRICING, landedCostRsd, shopPriceRsd } from '../src/money.js';
import { priceProduct } from '../src/pricing.js';
import type { MappedProduct } from '../src/kaffek/mapper.js';

const catalog = new Map<string, QuotableProduct>([
  ['A', { sku: 'A', slug: 'a', name: 'Espresso', brand: 'X', image: null, priceRsd: 650, inStock: true }],
  ['B', { sku: 'B', slug: 'b', name: 'Lungo', brand: 'X', image: null, priceRsd: 1_200, inStock: true }],
  ['C', { sku: 'C', slug: 'c', name: 'Vanilla', brand: 'Y', image: null, priceRsd: 900, inStock: false }],
]);
const lookup = (sku: string) => catalog.get(sku);

describe('quoteCart', () => {
  it('prices lines from the catalog, ignoring anything the client might claim', () => {
    const quote = quoteCart(
      [
        { sku: 'A', quantity: 2 },
        { sku: 'B', quantity: 1 },
      ],
      lookup,
    );
    expect(quote.subtotalRsd).toBe(2 * 650 + 1_200);
    expect(quote.itemCount).toBe(3);
    expect(quote.issues).toEqual([]);
  });

  it('merges duplicate SKUs before applying the per-line limit', () => {
    const quote = quoteCart(
      [
        { sku: 'A', quantity: CART_LIMITS.maxQuantityPerLine },
        { sku: 'A', quantity: 5 },
      ],
      lookup,
    );
    expect(quote.lines).toHaveLength(1);
    expect(quote.lines[0]!.quantity).toBe(CART_LIMITS.maxQuantityPerLine);
    expect(quote.issues).toEqual([
      { sku: 'A', type: 'quantity-limited', name: 'Espresso', quantity: CART_LIMITS.maxQuantityPerLine },
    ]);
  });

  it('drops unknown and out-of-stock products and reports them', () => {
    const quote = quoteCart(
      [
        { sku: 'A', quantity: 1 },
        { sku: 'C', quantity: 1 },
        { sku: 'ZZZ', quantity: 1 },
      ],
      lookup,
    );
    expect(quote.lines.map((l) => l.sku)).toEqual(['A']);
    expect(quote.issues).toEqual([
      { sku: 'C', type: 'out-of-stock', name: 'Vanilla' },
      { sku: 'ZZZ', type: 'unavailable' },
    ]);
  });

  it('ignores non-positive and fractional quantities', () => {
    const quote = quoteCart(
      [
        { sku: 'A', quantity: 0 },
        { sku: 'B', quantity: 1.5 },
      ],
      lookup,
    );
    expect(quote.lines).toEqual([]);
  });
});

describe('priceProduct', () => {
  const rules = { ...DEFAULT_PRICING, gbpToRsdRate: 140 };
  const onSale = { priceGbp: 7.49, regularPriceGbp: 8.99, weightKg: 0.18 } as MappedProduct;

  it('prices from the regular UK price, so a source sale becomes extra profit', () => {
    const priced = priceProduct(onSale, rules);
    expect(priced.priceRsd).toBe(shopPriceRsd(8.99, 0.18, rules));
    expect(priced.costRsd).toBe(landedCostRsd(7.49, 0.18, rules));
    expect(priced.priceRsd - priced.costRsd).toBeGreaterThan(
      shopPriceRsd(7.49, 0.18, rules) - priced.costRsd,
    );
  });

  it('uses the current price when there is no sale', () => {
    const priced = priceProduct({ ...onSale, regularPriceGbp: null }, rules);
    expect(priced.priceRsd).toBe(shopPriceRsd(7.49, 0.18, rules));
  });

  it('passes transport on at cost for coffee beans only', () => {
    const bag = { category: 'zrno', priceGbp: 8.19, regularPriceGbp: null, weightKg: 1.01 } as MappedProduct;
    expect(priceProduct(bag, rules).priceRsd).toBe(
      shopPriceRsd(8.19, 1.01, rules, { marginOnTransport: false }),
    );
    expect(priceProduct({ ...bag, category: 'kapsule' }, rules).priceRsd).toBe(
      shopPriceRsd(8.19, 1.01, rules),
    );
  });
});

describe('pack labels', () => {
  it('shows beans in kilograms and prices them per kg', () => {
    expect(packLabel(1000, 'g')).toBe('1 kg');
    expect(packLabel(500, 'g')).toBe('500 g');
    expect(packLabel(16, 'kapsula')).toBe('16 kapsula');
    expect(pricePerKg(1_100, 500, 'g')).toBe(2_200);
    expect(pricePerKg(900, 16, 'kapsula')).toBeNull();
    expect(pricePerKg(2_100, 1000, 'g')).toBeNull(); // the price already is per kg
  });
});
