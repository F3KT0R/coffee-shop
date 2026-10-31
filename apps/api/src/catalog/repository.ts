import {
  CATEGORIES,
  DRINK_KINDS,
  getSystem,
  normalizeSearch,
  type CatalogMetaResponse,
  type CategorySlug,
  type DietTag,
  type DrinkKind,
  type IntensityLevel,
  type PackUnit,
  type Product,
  type ProductQuery,
  type ProductSummary,
  type QuotableProduct,
  type SystemSlug,
} from '@kafeshop/core';
import type { Db } from '../db.js';
import type { Product as ProductRow } from '../generated/prisma/client.js';

export function toProduct(row: ProductRow): Product {
  return {
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category as CategorySlug,
    kind: row.kind as DrinkKind,
    systems: row.systems as SystemSlug[],
    packCount: row.packCount,
    packUnit: row.packUnit as PackUnit | null,
    intensity: row.intensity,
    intensityMax: row.intensityMax,
    intensityLevel: row.intensityLevel as IntensityLevel | null,
    coffeeStyle: row.coffeeStyle,
    dietTags: row.dietTags as DietTag[],
    flavourNotes: row.flavourNotes,
    description: row.description,
    images: row.images,
    priceRsd: row.priceRsd,
    inStock: row.inStock,
    rating: row.rating,
    reviewCount: row.reviewCount,
    sourceUrl: row.sourceUrl,
  };
}

function toSummary(p: Product): ProductSummary {
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

/** An active product: its public views plus the fields used for sorting, searching and costing. */
interface CatalogEntry {
  product: Product;
  summary: ProductSummary;
  costRsd: number;
  popularity: number;
  firstSeenAt: number;
  searchText: string;
}

interface Snapshot {
  entries: CatalogEntry[];
  bySku: Map<string, CatalogEntry>;
  bySlug: Map<string, CatalogEntry>;
  lastSyncAt: string | null;
}

function toEntry(row: ProductRow): CatalogEntry {
  const product = toProduct(row);
  return {
    product,
    summary: toSummary(product),
    costRsd: row.costRsd,
    popularity: row.popularity,
    firstSeenAt: row.firstSeenAt.getTime(),
    searchText: row.searchText,
  };
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

/**
 * The public catalog, served from memory. Products only change when the catalog sync runs in this
 * process, so the active products (~850) are loaded once and loaded again after each sync
 * (`invalidate`). Browsing the shop therefore doesn't wake the database: Neon bills compute for every
 * 5 minutes it stays awake, and visitors and search-engine bots would otherwise keep it running.
 */
export function createCatalogRepository(db: Db) {
  let snapshot: Snapshot | null = null;
  let loading: Promise<Snapshot> | null = null;
  let generation = 0;

  async function load(): Promise<Snapshot> {
    const [rows, lastSync] = await Promise.all([
      db.product.findMany({ where: { active: true } }),
      db.syncRun.findFirst({ where: { status: 'SUCCEEDED' }, orderBy: { startedAt: 'desc' } }),
    ]);
    const entries = rows.map(toEntry);
    return {
      entries,
      bySku: new Map(entries.map((e) => [e.product.sku, e])),
      bySlug: new Map(entries.map((e) => [e.product.slug, e])),
      lastSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
    };
  }

  function current(): Promise<Snapshot> {
    if (snapshot) return Promise.resolve(snapshot);
    if (!loading) {
      const startedAt = generation;
      loading = load()
        .then((loaded) => {
          // If a sync finished while this was loading, serve the result to these callers only.
          if (startedAt === generation) snapshot = loaded;
          return loaded;
        })
        .finally(() => {
          loading = null;
        });
    }
    return loading;
  }

  return {
    /** Forgets the in-memory catalog; the next request loads it again. Called after every sync. */
    invalidate() {
      generation++;
      snapshot = null;
      loading = null;
    },

    async list(query: ProductQuery) {
      const { entries } = await current();
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

    async bySlug(slug: string): Promise<Product | null> {
      return (await current()).bySlug.get(slug)?.product ?? null;
    },

    /** Same brand or same system and kind; in-stock and popular first. */
    async related(product: Product, limit = 8): Promise<ProductSummary[]> {
      const { entries } = await current();
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
    async meta(context: { category?: string; system?: string }): Promise<CatalogMetaResponse> {
      const { entries, lastSyncAt } = await current();
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

    /** Current price/stock for the given SKUs, for server-side cart pricing. */
    async quotable(skus: readonly string[]): Promise<Map<string, QuotableProduct & { costRsd: number }>> {
      const snap = await current();
      const found = new Map<string, QuotableProduct & { costRsd: number }>();
      for (const sku of new Set(skus)) {
        const entry = snap.bySku.get(sku);
        if (!entry) continue;
        const { product: p } = entry;
        found.set(sku, {
          sku: p.sku,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          image: p.images[0] ?? null,
          priceRsd: p.priceRsd,
          costRsd: entry.costRsd,
          inStock: p.inStock,
        });
      }
      return found;
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
