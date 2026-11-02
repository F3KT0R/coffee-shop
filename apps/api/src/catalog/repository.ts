import {
  createCatalogIndex,
  toCopyProduct,
  toQuotable,
  toSummary,
  type CatalogCopy,
  type CatalogEntry,
  type CatalogIndex,
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

/** An active product: its public views plus the landed cost (never shown to shoppers). */
interface Entry extends CatalogEntry {
  costRsd: number;
}

interface Snapshot {
  index: CatalogIndex<Entry>;
  /** Whole public catalog for the web app's copy, serialised once per load. */
  copy: string;
}

function toEntry(row: ProductRow): Entry {
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

/**
 * The public catalog, served from memory. Products only change when the catalog sync runs in this
 * process, so the active products (~900) are loaded once and loaded again after each sync
 * (`invalidate`). Browsing the shop therefore doesn't wake the database: Neon bills compute for every
 * 5 minutes it stays awake, and visitors and search-engine bots would otherwise keep it running.
 */
export function createCatalogRepository(db: Db) {
  let snapshot: Snapshot | null = null;
  let loading: Promise<Snapshot> | null = null;
  let generation = 0;

  async function load(): Promise<Snapshot> {
    const [rows, lastSync] = await Promise.all([
      db.product.findMany({ where: { active: true }, orderBy: { sku: 'asc' } }),
      db.syncRun.findFirst({ where: { status: 'SUCCEEDED' }, orderBy: { startedAt: 'desc' } }),
    ]);
    const index = createCatalogIndex(rows.map(toEntry), lastSync?.finishedAt?.toISOString() ?? null);
    const copy: CatalogCopy = { lastSyncAt: index.lastSyncAt, products: index.entries.map(toCopyProduct) };
    return { index, copy: JSON.stringify(copy) };
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
      return (await current()).index.list(query);
    },

    async bySlug(slug: string): Promise<Product | null> {
      return (await current()).index.bySlug(slug)?.product ?? null;
    },

    async related(product: Product, limit = 8): Promise<ProductSummary[]> {
      return (await current()).index.related(product, limit);
    },

    async meta(context: { category?: string; system?: string }): Promise<CatalogMetaResponse> {
      return (await current()).index.meta(context);
    },

    /** The whole public catalog as JSON (the web app's copy) and the sync it comes from. */
    async copy(): Promise<{ json: string; lastSyncAt: string | null }> {
      const { index, copy } = await current();
      return { json: copy, lastSyncAt: index.lastSyncAt };
    },

    /** Current price/stock for the given SKUs, for server-side cart pricing. */
    async quotable(skus: readonly string[]): Promise<Map<string, QuotableProduct & { costRsd: number }>> {
      const { index } = await current();
      const found = new Map<string, QuotableProduct & { costRsd: number }>();
      for (const sku of new Set(skus)) {
        const entry = index.bySku(sku);
        if (!entry) continue;
        found.set(sku, { ...toQuotable(entry.product), costRsd: entry.costRsd });
      }
      return found;
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
