import {
  KAFFEK_GRAPHQL_URL,
  KAFFEK_PRODUCTS_QUERY,
  KAFFEK_UK_STORE_CODE,
  type KaffekItem,
  type KaffekProductsPage,
} from '@kafeshop/core';
import type { FastifyBaseLogger } from 'fastify';

export interface KaffekFetchOptions {
  fetch?: typeof fetch;
  log: FastifyBaseLogger;
  pageSize?: number;
  /** Pause between pages -- the source is a shop, not a bulk API. */
  pageDelayMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface KaffekCatalog {
  items: KaffekItem[];
  totalCount: number;
  /** Every product the source reported was received (safe to retire products missing from it). */
  complete: boolean;
  /** Items whose attributes Magento failed to return (field-level GraphQL errors). */
  fieldErrors: number;
}

const USER_AGENT = 'KafeZaVasCatalogSync/2.0 (+https://kafeshop.netlify.app)';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class RetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

interface GraphQlResponse {
  data?: { products?: KaffekProductsPage | null } | null;
  errors?: { message: string; path?: (string | number)[] }[];
}

async function fetchPage(
  page: number,
  options: Required<Omit<KaffekFetchOptions, 'log'>>,
): Promise<GraphQlResponse> {
  let response: Response;
  try {
    response = await options.fetch(KAFFEK_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Store: KAFFEK_UK_STORE_CODE,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ query: KAFFEK_PRODUCTS_QUERY, variables: { page, pageSize: options.pageSize } }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new RetryableError(`Network error on page ${page}: ${(error as Error).message}`);
  }
  if (response.status === 429 || response.status >= 500) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new RetryableError(
      `HTTP ${response.status} on page ${page}`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
    );
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} on page ${page}`);
  const json = (await response.json()) as GraphQlResponse;
  // Field-level errors still come with data; only a missing products block means the page failed.
  if (!json.data?.products) {
    throw new RetryableError(`GraphQL error on page ${page}: ${json.errors?.[0]?.message ?? 'no data'}`);
  }
  return json;
}

async function fetchPageWithRetry(
  page: number,
  options: Required<Omit<KaffekFetchOptions, 'log'>>,
  log: FastifyBaseLogger,
): Promise<GraphQlResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchPage(page, options);
    } catch (error) {
      if (!(error instanceof RetryableError) || attempt >= options.maxAttempts) throw error;
      const backoff = error.retryAfterMs ?? 2 ** attempt * 1_000;
      log.warn({ page, attempt, backoff }, `KaffeK page failed, retrying: ${error.message}`);
      await sleep(Math.min(backoff, 60_000));
    }
  }
}

/**
 * Downloads the full UK catalog. Because Magento's page order is not guaranteed stable, a pass that
 * comes back short is repeated once and merged, so a concurrent change at the source rarely costs us items.
 */
export async function fetchKaffekCatalog(options: KaffekFetchOptions): Promise<KaffekCatalog> {
  const resolved = {
    fetch: options.fetch ?? globalThis.fetch,
    pageSize: options.pageSize ?? 100,
    pageDelayMs: options.pageDelayMs ?? 750,
    timeoutMs: options.timeoutMs ?? 45_000,
    maxAttempts: options.maxAttempts ?? 4,
  };
  const bySku = new Map<string, KaffekItem>();
  let totalCount = 0;
  let fieldErrors = 0;

  for (let pass = 1; pass <= 2; pass++) {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      if (page > 1) await sleep(resolved.pageDelayMs);
      const json = await fetchPageWithRetry(page, resolved, options.log);
      const products = json.data!.products!;
      totalCount = products.total_count;
      totalPages = products.page_info.total_pages;
      for (const item of products.items) {
        // Keep an earlier copy that has attributes over a later one that lost them to a field error.
        if (item && (!bySku.has(item.sku) || item.custom_attributesV2)) bySku.set(item.sku, item);
      }
      if (pass === 1) fieldErrors += json.errors?.length ?? 0;
    }
    if (bySku.size >= totalCount) break;
    options.log.warn({ received: bySku.size, totalCount }, 'KaffeK catalog pass incomplete, repeating once');
  }

  return { items: [...bySku.values()], totalCount, complete: bySku.size >= totalCount, fieldErrors };
}
