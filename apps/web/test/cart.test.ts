import { CART_LIMITS } from '@kafeshop/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { selectItemCount, useCart } from '../src/lib/cart';

const espresso = { sku: 'A', slug: 'a', name: 'Espresso', brand: 'X', image: null, priceRsd: 650 };
const lungo = { sku: 'B', slug: 'b', name: 'Lungo', brand: 'X', image: null, priceRsd: 700 };

beforeEach(() => useCart.getState().clear());

describe('cart store', () => {
  it('merges repeated adds of the same product', () => {
    useCart.getState().add(espresso);
    useCart.getState().add(espresso, 2);
    expect(useCart.getState().lines).toHaveLength(1);
    expect(selectItemCount(useCart.getState())).toBe(3);
  });

  it('caps quantities at the per-line limit', () => {
    useCart.getState().add(espresso, 500);
    expect(useCart.getState().lines[0]!.quantity).toBe(CART_LIMITS.maxQuantityPerLine);
  });

  it('removes a line when its quantity drops to zero', () => {
    useCart.getState().add(espresso);
    useCart.getState().setQuantity('A', 0);
    expect(useCart.getState().lines).toEqual([]);
  });

  it('adopts server prices and drops lines the server rejected', () => {
    useCart.getState().add(espresso);
    useCart.getState().add(lungo);
    useCart.getState().applyQuote({
      lines: [
        {
          sku: 'A',
          slug: 'a',
          name: 'Espresso',
          brand: 'X',
          image: null,
          unitPriceRsd: 700,
          quantity: 1,
          lineTotalRsd: 700,
        },
      ],
      itemCount: 1,
      subtotalRsd: 700,
      issues: [{ sku: 'B', type: 'unavailable' }],
    });
    const { lines } = useCart.getState();
    expect(lines.map((l) => l.sku)).toEqual(['A']);
    expect(lines[0]!.snapshot.priceRsd).toBe(700);
  });

  it('keeps the same state object when a quote changes nothing (no render loops)', () => {
    useCart.getState().add(espresso);
    const before = useCart.getState().lines;
    useCart.getState().applyQuote({
      lines: [
        {
          sku: 'A',
          slug: 'a',
          name: 'Espresso',
          brand: 'X',
          image: null,
          unitPriceRsd: 650,
          quantity: 1,
          lineTotalRsd: 650,
        },
      ],
      itemCount: 1,
      subtotalRsd: 650,
      issues: [],
    });
    expect(useCart.getState().lines).toBe(before);
  });

  it('persists to localStorage', () => {
    useCart.getState().add(espresso);
    expect(window.localStorage.getItem('kzv-cart')).toContain('"sku":"A"');
  });
});
