import { CART_LIMITS, type CartQuote, type ProductSummary, type QuotedLine } from '@kafeshop/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** What the cart remembers per line. The snapshot is only for instant display -- prices come from the server. */
export interface CartLine {
  sku: string;
  quantity: number;
  snapshot: { slug: string; name: string; brand: string; image: string | null; priceRsd: number };
}

interface CartState {
  lines: CartLine[];
  add: (
    product: Pick<ProductSummary, 'sku' | 'slug' | 'name' | 'brand' | 'image' | 'priceRsd'>,
    quantity?: number,
  ) => void;
  setQuantity: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  /** Aligns the cart with a server quote: fresh prices, dropped lines removed, quantities capped. */
  applyQuote: (quote: CartQuote) => void;
}

const clampQuantity = (quantity: number) =>
  Math.max(1, Math.min(CART_LIMITS.maxQuantityPerLine, Math.floor(quantity)));

function snapshotOf(line: QuotedLine): CartLine['snapshot'] {
  return {
    slug: line.slug,
    name: line.name,
    brand: line.brand,
    image: line.image,
    priceRsd: line.unitPriceRsd,
  };
}

/** Safe storage access: private browsing or blocked storage just means an in-memory cart. */
const storage = createJSONStorage(() => {
  try {
    const probe = '__kzv_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
});

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.sku === product.sku);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.sku === product.sku ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l,
              ),
            };
          }
          if (state.lines.length >= CART_LIMITS.maxLines) return state;
          const { sku, slug, name, brand, image, priceRsd } = product;
          return {
            lines: [
              ...state.lines,
              { sku, quantity: clampQuantity(quantity), snapshot: { slug, name, brand, image, priceRsd } },
            ],
          };
        }),
      setQuantity: (sku, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.sku !== sku)
              : state.lines.map((l) => (l.sku === sku ? { ...l, quantity: clampQuantity(quantity) } : l)),
        })),
      remove: (sku) => set((state) => ({ lines: state.lines.filter((l) => l.sku !== sku) })),
      clear: () => set({ lines: [] }),
      applyQuote: (quote) =>
        set((state) => {
          const bySku = new Map(quote.lines.map((l) => [l.sku, l]));
          const lines = state.lines
            .filter((l) => bySku.has(l.sku))
            .map((l) => {
              const quoted = bySku.get(l.sku)!;
              return { ...l, quantity: quoted.quantity, snapshot: snapshotOf(quoted) };
            });
          const unchanged =
            lines.length === state.lines.length &&
            lines.every((l, i) => {
              const before = state.lines[i]!;
              return before.quantity === l.quantity && before.snapshot.priceRsd === l.snapshot.priceRsd;
            });
          return unchanged ? state : { lines };
        }),
    }),
    { name: 'kzv-cart', version: 1, storage },
  ),
);

export const selectItemCount = (state: CartState) => state.lines.reduce((sum, l) => sum + l.quantity, 0);
export const selectCartInput = (state: CartState) =>
  state.lines.map((l) => ({ sku: l.sku, quantity: l.quantity }));
