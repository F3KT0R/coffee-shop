import { createCatalogIndex, fromCopyProduct, type CatalogCopy, type CatalogIndex } from '@kafeshop/core';

/**
 * A copy of the whole public catalog, so the shop can be browsed while the free-tier API sleeps
 * (it needs up to ~50 s to wake up). Two sources, newest first:
 *
 * - the browser's own copy (Cache Storage), refreshed from the API every time it is awake;
 * - `/catalog.json`, baked into every Netlify deploy (scripts/catalog-copy.mjs), for first visits.
 *
 * Every page load pings the API. If it doesn't answer within a moment, catalog queries are answered
 * from the copy, and as soon as it wakes up they are reloaded with live data (see queries.ts).
 */

const CACHE_NAME = 'kafeshop-catalog';
const COPY_URL = '/api/catalog/copy';
const STATIC_COPY_URL = '/catalog.json';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- Is the API awake? -------------------------------------------------------------------------------

let awake = false;
let waking: Promise<void> | null = null;

async function pingUntilAwake(): Promise<void> {
  // ~3 minutes of attempts; a later call starts again (e.g. after the device was offline).
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch('/api/ping', { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
      // While Render boots, the proxy may answer with an HTML error page instead of the API's JSON.
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        awake = true;
        return;
      }
    } catch {
      // Network error or timeout: try again.
    }
    await delay(3_000);
  }
  throw new Error('API did not wake up');
}

/** Resolves when the API answers (starting the ping on first use). */
export function whenApiAwake(): Promise<void> {
  waking ??= pingUntilAwake().catch((error: unknown) => {
    waking = null;
    throw error;
  });
  return waking;
}

/** True if the API is awake or answers within `ms`. */
export async function apiAwakeWithin(ms: number): Promise<boolean> {
  if (awake) return true;
  return Promise.race([
    whenApiAwake().then(
      () => true,
      () => false,
    ),
    delay(ms).then(() => false),
  ]);
}

// --- The copy -----------------------------------------------------------------------------------------

async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in globalThis ? await caches.open(CACHE_NAME) : null;
  } catch {
    return null; // Storage blocked (private mode, insecure context...).
  }
}

async function readCopy(response: Response | undefined | null): Promise<CatalogCopy | null> {
  // A missing /catalog.json gets the SPA's index.html (status 200), hence the content-type check.
  if (!response?.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
  try {
    const value = (await response.json()) as Partial<CatalogCopy> | null;
    return value && Array.isArray(value.products) ? (value as CatalogCopy) : null;
  } catch {
    return null;
  }
}

const toIndex = (copy: CatalogCopy) =>
  createCatalogIndex(copy.products.map(fromCopyProduct), copy.lastSyncAt ?? null);

async function loadCopy(): Promise<CatalogIndex | null> {
  const cache = await openCache();
  const stored = await readCopy(await cache?.match(COPY_URL).catch(() => undefined));
  if (stored) return toIndex(stored);
  const baked = await readCopy(
    await fetch(STATIC_COPY_URL, { signal: AbortSignal.timeout(20_000) }).catch(() => null),
  );
  return baked ? toIndex(baked) : null;
}

let index: Promise<CatalogIndex | null> | null = null;

/** The catalog copy, or null if there is none (first visit and no copy in the deploy). */
export function catalogCopy(): Promise<CatalogIndex | null> {
  index ??= loadCopy();
  return index;
}

/**
 * Updates the browser's copy from the awake API. The request carries the stored copy's ETag (the
 * sync it comes from), so an up-to-date copy costs an empty 304 instead of the whole catalog.
 */
export async function refreshCatalogCopy(): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    const stored = await cache.match(COPY_URL);
    const etag = stored?.headers.get('etag');
    const response = await fetch(COPY_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 304 || !response.ok) return;
    const copy = await readCopy(response.clone());
    if (!copy) return;
    await cache.put(COPY_URL, response);
    index = Promise.resolve(toIndex(copy));
  } catch {
    // Not worth bothering anyone: the old copy stays.
  }
}

/** Test helper: forget everything module-level. */
export function resetCatalogCopyForTests(): void {
  awake = false;
  waking = null;
  index = null;
}
