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
import { Prisma, type Db } from '../db.js';
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

const summarySelect = {
  sku: true,
  slug: true,
  name: true,
  brand: true,
  category: true,
  kind: true,
  systems: true,
  packCount: true,
  packUnit: true,
  intensityLevel: true,
  priceRsd: true,
  inStock: true,
  rating: true,
  reviewCount: true,
  images: true,
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): ProductSummary {
  const { images, ...rest } = row;
  return {
    ...rest,
    category: rest.category as CategorySlug,
    kind: rest.kind as DrinkKind,
    systems: rest.systems as SystemSlug[],
    packUnit: rest.packUnit as PackUnit | null,
    intensityLevel: rest.intensityLevel as IntensityLevel | null,
    image: images[0] ?? null,
  };
}

function buildWhere(query: Partial<ProductQuery>): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ active: true }];
  if (query.category) and.push({ category: query.category });
  if (query.kind) and.push({ kind: query.kind });
  if (query.system) and.push({ systems: { has: query.system } });
  if (query.brand) and.push({ brand: { equals: query.brand, mode: 'insensitive' } });
  if (query.diet?.length) and.push({ dietTags: { hasEvery: query.diet } });
  if (query.intensity?.length) and.push({ intensityLevel: { in: query.intensity.map(Number) } });
  // Every search word must appear in the accent-free search text (brand, name, slug, systems), so
  // "creme brulee" finds "Crème Brûlée". A lone number may also be a SKU.
  const words = normalizeSearch(query.q ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 6);
  if (words.length === 1 && /^\d+$/.test(words[0]!)) {
    and.push({ OR: [{ sku: words[0] }, { searchText: { contains: words[0] } }] });
  } else {
    for (const word of words) and.push({ searchText: { contains: word } });
  }
  return { AND: and };
}

function buildOrderBy(sort: ProductQuery['sort']): Prisma.ProductOrderByWithRelationInput[] {
  // In-stock first everywhere; SKU last so paging is stable when the other keys tie.
  const byStock: Prisma.ProductOrderByWithRelationInput = { inStock: 'desc' };
  const tieBreak: Prisma.ProductOrderByWithRelationInput = { sku: 'asc' };
  switch (sort) {
    case 'price-asc':
      return [byStock, { priceRsd: 'asc' }, tieBreak];
    case 'price-desc':
      return [byStock, { priceRsd: 'desc' }, tieBreak];
    case 'rating':
      return [byStock, { rating: { sort: 'desc', nulls: 'last' } }, { reviewCount: 'desc' }, tieBreak];
    case 'name':
      return [byStock, { brand: 'asc' }, { name: 'asc' }, tieBreak];
    case 'newest':
      return [byStock, { firstSeenAt: 'desc' }, tieBreak];
    default:
      return [byStock, { popularity: 'desc' }, { reviewCount: 'desc' }, tieBreak];
  }
}

export function createCatalogRepository(db: Db) {
  return {
    async list(query: ProductQuery) {
      const where = buildWhere(query);
      const [total, rows] = await db.$transaction([
        db.product.count({ where }),
        db.product.findMany({
          where,
          orderBy: buildOrderBy(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: summarySelect,
        }),
      ]);
      return {
        items: rows.map(toSummary),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      };
    },

    async bySlug(slug: string): Promise<Product | null> {
      const row = await db.product.findFirst({ where: { slug, active: true } });
      return row ? toProduct(row) : null;
    },

    /** Same brand or same system and kind; in-stock and popular first. */
    async related(product: Product, limit = 8): Promise<ProductSummary[]> {
      const rows = await db.product.findMany({
        where: {
          active: true,
          inStock: true,
          sku: { not: product.sku },
          category: product.category,
          ...(product.systems.length > 0 ? { systems: { hasSome: product.systems } } : {}),
          OR: [{ brand: product.brand }, { kind: product.kind }],
        },
        orderBy: [{ popularity: 'desc' }, { sku: 'asc' }],
        take: limit,
        select: summarySelect,
      });
      return rows.map(toSummary);
    },

    /** Facet counts, narrowed by the category/system the shopper is looking at. */
    async meta(context: { category?: string; system?: string }): Promise<CatalogMetaResponse> {
      const scope = buildWhere(context);
      // Each facet ignores its own filter, so the shopper can switch category/system from the counts shown.
      const categoryScope = buildWhere({ system: context.system });

      const [categories, kinds, brands, systems, productCount, lastSync] = await Promise.all([
        db.product.groupBy({ by: ['category'], where: categoryScope, _count: { _all: true } }),
        db.product.groupBy({ by: ['kind'], where: scope, _count: { _all: true } }),
        db.product.groupBy({
          by: ['brand'],
          where: scope,
          _count: { _all: true },
          orderBy: { _count: { brand: 'desc' } },
        }),
        db.$queryRaw<{ value: string; count: bigint }[]>`
          SELECT s AS value, COUNT(*) AS count
          FROM "Product", unnest("systems") AS s
          WHERE "active" = true ${context.category ? Prisma.sql`AND "category" = ${context.category}` : Prisma.empty}
          GROUP BY s ORDER BY count DESC`,
        db.product.count({ where: scope }),
        db.syncRun.findFirst({ where: { status: 'SUCCEEDED' }, orderBy: { startedAt: 'desc' } }),
      ]);

      return {
        categories: CATEGORIES.map((c) => ({
          value: c.slug,
          label: c.name,
          count: categories.find((row) => row.category === c.slug)?._count._all ?? 0,
        })),
        kinds: DRINK_KINDS.map((k) => ({
          value: k.slug,
          label: k.name,
          count: kinds.find((row) => row.kind === k.slug)?._count._all ?? 0,
        })).filter((k) => k.count > 0),
        brands: brands
          .filter((b) => b.brand !== '')
          .map((b) => ({ value: b.brand, label: b.brand, count: b._count._all })),
        systems: systems
          .map((s) => ({
            value: s.value,
            label: getSystem(s.value)?.name ?? s.value,
            count: Number(s.count),
          }))
          .filter((s) => getSystem(s.value)),
        productCount,
        lastSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
      };
    },

    /** Current price/stock for the given SKUs, for server-side cart pricing. */
    async quotable(skus: readonly string[]): Promise<Map<string, QuotableProduct & { costRsd: number }>> {
      const rows = await db.product.findMany({
        where: { sku: { in: [...new Set(skus)] }, active: true },
        select: {
          sku: true,
          slug: true,
          name: true,
          brand: true,
          images: true,
          priceRsd: true,
          costRsd: true,
          inStock: true,
        },
      });
      return new Map(
        rows.map((r) => [
          r.sku,
          {
            sku: r.sku,
            slug: r.slug,
            name: r.name,
            brand: r.brand,
            image: r.images[0] ?? null,
            priceRsd: r.priceRsd,
            costRsd: r.costRsd,
            inStock: r.inStock,
          },
        ]),
      );
    },
  };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
