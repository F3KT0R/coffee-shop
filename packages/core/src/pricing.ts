import type { CategorySlug, Product } from './catalog.js';
import type { MappedProduct } from './kaffek/mapper.js';
import { landedCostRsd, shopPriceRsd, type PricingRules } from './money.js';

export type PricedProduct = Product &
  Pick<
    MappedProduct,
    'priceGbp' | 'regularPriceGbp' | 'popularity' | 'stockQuantity' | 'weightKg' | 'kaffekId'
  > & {
    /** What the pack costs the shop right now (sale price at the source, transport included). */
    costRsd: number;
  };

/** Heavy goods whose transport is passed on at cost (see `shopPriceRsd`). */
const TRANSPORT_AT_COST: ReadonlySet<CategorySlug> = new Set(['zrno']);

/**
 * Applies the shop's pricing rules to a mapped source product.
 *
 * The selling price is always based on the source's *regular* price: when KaffeK runs a sale, the shop
 * keeps its normal price and the discount becomes extra profit. `costRsd` uses what is actually paid.
 */
export function priceProduct(product: MappedProduct, rules: PricingRules): PricedProduct {
  const listGbp = product.regularPriceGbp ?? product.priceGbp;
  return {
    ...product,
    priceRsd: shopPriceRsd(listGbp, product.weightKg, rules, {
      marginOnTransport: !TRANSPORT_AT_COST.has(product.category),
    }),
    costRsd: landedCostRsd(product.priceGbp, product.weightKg, rules),
  };
}
