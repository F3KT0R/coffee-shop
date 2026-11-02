import type { CatalogMetaResponse, Paginated } from './api.js';
import type { QuotableProduct } from './cart.js';
import { CATEGORIES, DRINK_KINDS, type Product, type ProductSummary } from './catalog.js';
import type { ProductQuery } from './schemas.js';
import { getSystem, type SystemSlug } from './systems.js';
import { normalizeSearch } from './text.js';

/**
 * Searching, sorting, paging and facet counts over the active catalog, in memory. The API serves the
 * public catalog with it, and the web app uses the same code on its copy of the catalog while the API
 * is asleep, so both give identical results.
 */

/** A product in the catalog copy: the public product plus the fields used for sorting and searching. */
export interface CatalogCopyProduct extends Product {
  popularity: number;
  /** Milliseconds since the epoch (sort "newest"). */
  firstSeenAt: number;
  /** Brand, name, slug and systems in search normal form (see normalizeSearch). */
  searchText: string;
}

/** The whole public catalog, as `GET /api/catalog/copy` returns it. */
export interface CatalogCopy {
  lastSyncAt: string | null;
  products: CatalogCopyProduct[];
}

export interface CatalogEntry {
  product: Product;
  summary: ProductSummary;
  popularity: number;
  firstSeenAt: number;
  searchText: string;
}

export function toSummary(p: Product): ProductSummary {
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    kind: p.kind,
    systems: p.systems,
    packCount: p.packCount,
    packUnit: p.packUnit,
    intensityLevel: p.intensityLevel,
    priceRsd: p.priceRsd,
    inStock: p.inStock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    image: p.images[0] ?? null,
  };
}

/** What cart pricing needs from a product. */
export function toQuotable(p: Product): QuotableProduct {
  return {
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.images[0] ?? null,
    priceRsd: p.priceRsd,
    inStock: p.inStock,
  };
}

/** Back to the copy's flat shape (what the API sends to the web app). */
export function toCopyProduct(entry: CatalogEntry): CatalogCopyProduct {
  return {
    ...entry.product,
    popularity: entry.popularity,
    firstSeenAt: entry.firstSeenAt,
    searchText: entry.searchText,
  };
}

export function fromCopyProduct(item: CatalogCopyProduct): CatalogEntry {
  const { popularity, firstSeenAt, searchText, ...product } = item;
  return { product, summary: toSummary(product), popularity, firstSeenAt, searchText };
}

function matcher(query: Partial<ProductQuery>): (entry: CatalogEntry) => boolean {
  const brand = query.brand?.toLowerCase();
  const intensity = query.intensity?.map(Number);
  // Every search word must appear in the accent-free search text (brand, name, slug, systems), so
  // "creme brulee" finds "Crème Brûlée". A lone number may also be a SKU.
  const words = normalizeSearch(query.q ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 6);
  const sku = words.length === 1 && /^\d+$/.test(words[0]!) ? words[0]! : null;

  return ({ product: p, searchText }) => {
    if (query.category && p.category !== query.category) return false;
    if (query.kind && p.kind !== query.kind) return false;
    if (query.system && !p.systems.includes(query.system as SystemSlug)) return false;
    if (brand !== undefined && p.brand.toLowerCase() !== brand) return false;
    if (query.diet?.length && !query.diet.every((d) => p.dietTags.includes(d))) return false;
    if (intensity?.length && (p.intensityLevel === null || !intensity.includes(p.intensityLevel)))
      return false;
    if (sku) return p.sku === sku || searchText.includes(sku);
    return words.every((word) => searchText.includes(word));
  };
}

type Compare = (a: CatalogEntry, b: CatalogEntry) => number;
const collator = new Intl.Collator('sr-Latn');
const descending = (a: number, b: number) => b - a;
const bySku: Compare = (a, b) => (a.product.sku < b.product.sku ? -1 : a.product.sku > b.product.sku ? 1 : 0);

function sortKey(sort: ProductQuery['sort']): Compare {
  switch (sort) {
    case 'price-asc':
      return (a, b) => a.product.priceRsd - b.product.priceRsd;
    case 'price-desc':
      return (a, b) => descending(a.product.priceRsd, b.product.priceRsd);
    case 'rating':
      return (a, b) =>
        descending(a.product.rating ?? -Infinity, b.product.rating ?? -Infinity) ||
        descending(a.product.reviewCount, b.product.reviewCount);
    case 'name':
      return (a, b) =>
        collator.compare(a.product.brand, b.product.brand) ||
        collator.compare(a.product.name, b.product.name);
    case 'newest':
      return (a, b) => descending(a.firstSeenAt, b.firstSeenAt);
    default:
      return (a, b) =>
        descending(a.popularity, b.popularity) || descending(a.product.reviewCount, b.product.reviewCount);
  }
}

/** In-stock first everywhere; SKU last so paging is stable when the other keys tie. */
function comparator(sort: ProductQuery['sort']): Compare {
  const key = sortKey(sort);
  return (a, b) => Number(b.product.inStock) - Number(a.product.inStock) || key(a, b) || bySku(a, b);
}

function countBy(entries: CatalogEntry[], keys: (entry: CatalogEntry) => readonly string[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const key of keys(entry)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

/** Highest count first; ties alphabetically. */
const byCount = (counts: Map<string, number>) =>
  [...counts].sort(([a, x], [b, y]) => y - x || collator.compare(a, b));

export function createCatalogIndex<E extends CatalogEntry>(entries: E[], lastSyncAt: string | null) {
  const bySkuMap = new Map(entries.map((e) => [e.product.sku, e]));
  const bySlugMap = new Map(entries.map((e) => [e.product.slug, e]));

  return {
    entries,
    lastSyncAt,
    bySku: (sku: string): E | undefined => bySkuMap.get(sku),
    bySlug: (slug: string): E | undefined => bySlugMap.get(slug),

    list(query: ProductQuery): Paginated<ProductSummary> {
      const matching = entries.filter(matcher(query)).sort(comparator(query.sort));
      const start = (query.page - 1) * query.pageSize;
      return {
        items: matching.slice(start, start + query.pageSize).map((e) => e.summary),
        page: query.page,
        pageSize: query.pageSize,
        total: matching.length,
        totalPages: Math.max(1, Math.ceil(matching.length / query.pageSize)),
      };
    },

    /** Same brand or same system and kind; in-stock and popular first. */
    related(product: Product, limit = 8): ProductSummary[] {
      return entries
        .filter(
          ({ product: p }) =>
            p.inStock &&
            p.sku !== product.sku &&
            p.category === product.category &&
            (product.systems.length === 0 || p.systems.some((s) => product.systems.includes(s))) &&
            (p.brand === product.brand || p.kind === product.kind),
        )
        .sort((a, b) => descending(a.popularity, b.popularity) || bySku(a, b))
        .slice(0, limit)
        .map((e) => e.summary);
    },

    /** Facet counts, narrowed by the category/system the shopper is looking at. */
    meta(context: { category?: string; system?: string }): CatalogMetaResponse {
      const scope = entries.filter(matcher(context as Partial<ProductQuery>));
      // Each facet ignores its own filter, so the shopper can switch category/system from the counts shown.
      const categories = countBy(entries.filter(matcher({ system: context.system })), (e) => [
        e.product.category,
      ]);
      const kinds = countBy(scope, (e) => [e.product.kind]);
      const brands = countBy(scope, (e) => [e.product.brand]);
      const systems = countBy(
        entries.filter((e) => !context.category || e.product.category === context.category),
        (e) => e.product.systems,
      );

      return {
        categories: CATEGORIES.map((c) => ({
          value: c.slug,
          label: c.name,
          count: categories.get(c.slug) ?? 0,
        })),
        kinds: DRINK_KINDS.map((k) => ({
          value: k.slug,
          label: k.name,
          count: kinds.get(k.slug) ?? 0,
        })).filter((k) => k.count > 0),
        brands: byCount(brands)
          .filter(([brand]) => brand !== '')
          .map(([brand, count]) => ({ value: brand, label: brand, count })),
        systems: byCount(systems)
          .filter(([value]) => getSystem(value))
          .map(([value, count]) => ({ value, label: getSystem(value)?.name ?? value, count })),
        productCount: scope.length,
        lastSyncAt,
      };
    },
  };
}

export type CatalogIndex<E extends CatalogEntry = CatalogEntry> = ReturnType<typeof createCatalogIndex<E>>;
