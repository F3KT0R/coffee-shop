import {
  getSystem,
  mapKaffekItem,
  normalizeSearch,
  priceProduct,
  type PricingRules,
  type SyncRunView,
} from '@kafeshop/core';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db.js';
import type { SyncRun } from '../generated/prisma/client.js';
import { resolveGbpRate } from './exchangeRate.js';
import { fetchKaffekCatalog } from './kaffekClient.js';

/** A RUNNING row older than this is a crashed run, not a live one. */
const STALE_RUN_MS = 30 * 60 * 1000;
/** Never retire more than this share of the active catalog in one run -- that smells like a source problem. */
const MAX_RETIRE_SHARE = 0.25;
const UPSERT_CHUNK = 50;

export function toSyncRunView(run: SyncRun): SyncRunView {
  return {
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    fetched: run.fetched,
    upserted: run.upserted,
    retired: run.retired,
    skipped: run.skipped,
    complete: run.complete,
    gbpRsdRate: run.gbpRsdRate,
    error: run.error,
  };
}

export interface SyncDeps {
  db: Db;
  log: FastifyBaseLogger;
  /** Pricing rules; the exchange rate is resolved per run. */
  pricing: Omit<PricingRules, 'gbpToRsdRate'>;
  fetch?: typeof fetch;
  /** Test hook: no pauses between source pages. */
  pageDelayMs?: number;
}

async function executeSync(deps: SyncDeps, run: SyncRun): Promise<SyncRun> {
  const { db, log } = deps;
  const { rate, source } = await resolveGbpRate({ db, log, fetch: deps.fetch });
  await db.syncRun.update({ where: { id: run.id }, data: { gbpRsdRate: rate, rateSource: source } });

  const catalog = await fetchKaffekCatalog({ fetch: deps.fetch, log, pageDelayMs: deps.pageDelayMs });
  const now = new Date();
  const rules: PricingRules = { ...deps.pricing, gbpToRsdRate: rate };

  const products = [];
  const keepAsIs = new Set<string>(); // present at the source but unreadable this time -- don't retire
  let skipped = 0;
  for (const item of catalog.items) {
    const result = mapKaffekItem(item);
    if (result.ok) products.push(priceProduct(result.product, rules));
    else {
      skipped++;
      if (result.reason === 'missing-attributes') keepAsIs.add(result.sku);
    }
  }

  // KaffeK occasionally gives two SKUs the same URL key. The lowest SKU keeps it and the others get a
  // SKU suffix -- decided by SKU, not page order, so links stay stable from one sync to the next.
  const slugOwners = new Map<string, string>();
  for (const p of [...products].sort((a, b) => a.sku.localeCompare(b.sku))) {
    if (slugOwners.has(p.slug)) p.slug = `${p.slug}--${p.sku}`;
    slugOwners.set(p.slug, p.sku);
  }

  // A product's URL key can move to a different SKU at the source; free the slug before upserting.
  const incomingSlugs = new Map(products.map((p) => [p.slug, p.sku]));
  const slugClashes = await db.product.findMany({
    where: { slug: { in: [...incomingSlugs.keys()] } },
    select: { sku: true, slug: true },
  });
  for (const clash of slugClashes.filter((c) => incomingSlugs.get(c.slug) !== c.sku)) {
    await db.product.update({ where: { sku: clash.sku }, data: { slug: `${clash.slug}--${clash.sku}` } });
  }

  for (let i = 0; i < products.length; i += UPSERT_CHUNK) {
    await db.$transaction(
      products.slice(i, i + UPSERT_CHUNK).map((p) => {
        const data = {
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          category: p.category,
          kind: p.kind,
          systems: p.systems,
          packCount: p.packCount,
          packUnit: p.packUnit,
          intensity: p.intensity,
          intensityMax: p.intensityMax,
          intensityLevel: p.intensityLevel,
          coffeeStyle: p.coffeeStyle,
          dietTags: p.dietTags,
          flavourNotes: p.flavourNotes,
          description: p.description,
          images: p.images,
          priceGbp: p.priceGbp,
          regularPriceGbp: p.regularPriceGbp,
          priceRsd: p.priceRsd,
          costRsd: p.costRsd,
          weightKg: p.weightKg,
          kaffekId: p.kaffekId,
          inStock: p.inStock,
          stockQuantity: p.stockQuantity,
          rating: p.rating,
          reviewCount: p.reviewCount,
          popularity: p.popularity,
          sourceUrl: p.sourceUrl,
          searchText: normalizeSearch(
            [p.brand, p.name, p.slug, ...p.systems.map((s) => getSystem(s)?.name ?? s)].join(' '),
          ),
          active: true,
          lastSeenAt: now,
        };
        return db.product.upsert({ where: { sku: p.sku }, create: { sku: p.sku, ...data }, update: data });
      }),
    );
  }

  let retired = 0;
  let note: string | null = null;
  if (catalog.complete) {
    const keep = [...products.map((p) => p.sku), ...keepAsIs];
    const [toRetire, activeCount] = await Promise.all([
      db.product.count({ where: { active: true, sku: { notIn: keep } } }),
      db.product.count({ where: { active: true } }),
    ]);
    if (toRetire > Math.max(20, activeCount * MAX_RETIRE_SHARE)) {
      note = `Safety limit: ${toRetire} of ${activeCount} products would be retired; left active for review.`;
      log.warn(note);
    } else if (toRetire > 0) {
      retired = (
        await db.product.updateMany({
          where: { active: true, sku: { notIn: keep } },
          data: { active: false },
        })
      ).count;
    }
  } else {
    note = `Source returned ${catalog.items.length} of ${catalog.totalCount} items; nothing retired this run.`;
    log.warn(note);
  }

  log.info(
    {
      fetched: catalog.items.length,
      upserted: products.length,
      skipped,
      retired,
      fieldErrors: catalog.fieldErrors,
    },
    'Catalog sync finished',
  );
  return db.syncRun.update({
    where: { id: run.id },
    data: {
      status: 'SUCCEEDED',
      finishedAt: new Date(),
      fetched: catalog.items.length,
      upserted: products.length,
      skipped,
      retired,
      complete: catalog.complete,
      error: note,
    },
  });
}

/**
 * Owns catalog syncing for this process: one run at a time (in-process flag plus a RUNNING row that
 * also covers a second instance), every run recorded in SyncRun, failures recorded instead of thrown.
 */
export function createSyncService(deps: SyncDeps) {
  let current: Promise<SyncRun> | null = null;

  async function start(trigger: string): Promise<{ started: boolean; run: Promise<SyncRun> | null }> {
    if (current) return { started: false, run: current };
    const { db, log } = deps;

    const running = await db.syncRun.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });
    if (running && Date.now() - running.startedAt.getTime() < STALE_RUN_MS)
      return { started: false, run: null };
    if (running) {
      await db.syncRun.update({
        where: { id: running.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: 'Abandoned (process stopped mid-run)' },
      });
    }

    const run = await db.syncRun.create({ data: { trigger } });
    log.info({ runId: run.id, trigger }, 'Catalog sync started');
    current = executeSync(deps, run)
      .catch(async (error: unknown) => {
        log.error({ err: error, runId: run.id }, 'Catalog sync failed');
        return db.syncRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', finishedAt: new Date(), error: (error as Error).message.slice(0, 1000) },
        });
      })
      .finally(() => {
        current = null;
      });
    return { started: true, run: current };
  }

  return {
    start,
    isRunning: () => current !== null,
    async lastSuccessAt(): Promise<Date | null> {
      const last = await deps.db.syncRun.findFirst({
        where: { status: 'SUCCEEDED' },
        orderBy: { startedAt: 'desc' },
      });
      return last?.finishedAt ?? null;
    },
  };
}

export type SyncService = ReturnType<typeof createSyncService>;
