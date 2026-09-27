/** Server-authoritative cart pricing. The browser only ever sends SKUs and quantities. */

export const CART_LIMITS = {
  maxLines: 50,
  maxQuantityPerLine: 24,
} as const;

export interface CartLineInput {
  sku: string;
  quantity: number;
}

export interface QuotableProduct {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  priceRsd: number;
  inStock: boolean;
}

export interface QuotedLine {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  image: string | null;
  unitPriceRsd: number;
  quantity: number;
  lineTotalRsd: number;
}

export type CartIssue =
  | { sku: string; type: 'unavailable' }
  | { sku: string; type: 'out-of-stock'; name: string }
  | { sku: string; type: 'quantity-limited'; name: string; quantity: number };

export interface CartQuote {
  lines: QuotedLine[];
  itemCount: number;
  subtotalRsd: number;
  /** Lines that were dropped or adjusted. Orders are only accepted when this is empty. */
  issues: CartIssue[];
}

export function quoteCart(
  input: readonly CartLineInput[],
  lookup: (sku: string) => QuotableProduct | undefined,
): CartQuote {
  // Merge duplicate SKUs so a tampered or double-submitted cart can't bypass the per-line limit.
  const merged = new Map<string, number>();
  for (const line of input) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    merged.set(line.sku, (merged.get(line.sku) ?? 0) + line.quantity);
  }

  const lines: QuotedLine[] = [];
  const issues: CartIssue[] = [];
  for (const [sku, requested] of [...merged].slice(0, CART_LIMITS.maxLines)) {
    const product = lookup(sku);
    if (!product) {
      issues.push({ sku, type: 'unavailable' });
      continue;
    }
    if (!product.inStock) {
      issues.push({ sku, type: 'out-of-stock', name: product.name });
      continue;
    }
    const quantity = Math.min(requested, CART_LIMITS.maxQuantityPerLine);
    if (quantity !== requested) issues.push({ sku, type: 'quantity-limited', name: product.name, quantity });
    lines.push({
      sku,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image: product.image,
      unitPriceRsd: product.priceRsd,
      quantity,
      lineTotalRsd: product.priceRsd * quantity,
    });
  }

  return {
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotalRsd: lines.reduce((sum, l) => sum + l.lineTotalRsd, 0),
    issues,
  };
}
