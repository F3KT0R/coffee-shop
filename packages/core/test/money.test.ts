import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRICING,
  formatRsd,
  landedCostRsd,
  roundToSerbianPrice,
  shopPriceRsd,
  type PricingRules,
} from '../src/money.js';

const rules: PricingRules = { ...DEFAULT_PRICING, gbpToRsdRate: 140.5757 };

describe('roundToSerbianPrice', () => {
  it.each([
    [1, 50],
    [50, 50],
    [51, 100],
    [620, 650],
    [670, 700],
    [1_249.6, 1_250],
    [1_250.4, 1_300],
    [1_050.0000000001, 1_050],
  ])('%d -> %d', (input, expected) => {
    expect(roundToSerbianPrice(input)).toBe(expected);
  });

  it('returns 0 for non-positive or non-finite input', () => {
    expect(roundToSerbianPrice(0)).toBe(0);
    expect(roundToSerbianPrice(-5)).toBe(0);
    expect(roundToSerbianPrice(Number.NaN)).toBe(0);
  });
});

describe('landedCostRsd', () => {
  it('adds transport of weight × £4 before converting (owner formula kg × 4 × rate)', () => {
    // Dynamite Coffee: £2.89, 0.21 kg -> (2.89 + 0.84) × 140.5757 = 524.35
    expect(landedCostRsd(2.89, 0.21, rules)).toBe(524);
  });

  it('uses the fallback weight when the source has none', () => {
    expect(landedCostRsd(2, null, rules)).toBe(Math.round((2 + 0.3 * 4) * 140.5757));
  });
});

describe('shopPriceRsd', () => {
  it('adds the margin to the landed cost and rounds up to 50', () => {
    // 524 × 1.30 = 681 -> 700 (the old shop sold this at 680)
    expect(shopPriceRsd(2.89, 0.21, rules)).toBe(700);
  });

  it('applies the minimum profit on cheap packs', () => {
    // KaffeK budget 10 pods: £1.10, 0.09 kg -> cost 205; 30% would be only 62 RSD profit
    const price = shopPriceRsd(1.1, 0.09, rules);
    expect(price - landedCostRsd(1.1, 0.09, rules)).toBeGreaterThanOrEqual(rules.minProfitRsd);
    expect(price).toBe(350);
  });

  it('never prices below cost plus margin', () => {
    for (const [gbp, kg] of [
      [8.29, 0.56],
      [6.89, 0.33],
      [2.69, 0.56],
      [4.49, 0.24],
    ] as const) {
      const cost = landedCostRsd(gbp, kg, rules);
      expect(shopPriceRsd(gbp, kg, rules)).toBeGreaterThanOrEqual(cost * 1.3);
    }
  });

  it('rejects an invalid rate instead of producing free products', () => {
    expect(() => shopPriceRsd(5, 0.2, { ...rules, gbpToRsdRate: 0 })).toThrow(RangeError);
  });
});

describe('formatRsd', () => {
  it('uses the Serbian thousands separator', () => {
    expect(formatRsd(1_250)).toBe('1.250 RSD');
    expect(formatRsd(950)).toBe('950 RSD');
  });
});
