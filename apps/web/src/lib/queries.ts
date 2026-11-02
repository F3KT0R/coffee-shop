import { QueryClient, keepPreviousData, queryOptions } from '@tanstack/react-query';
import { productQuerySchema, type CatalogIndex } from '@kafeshop/core';
import { ApiError, api, type ProductListParams } from './api';
import { apiAwakeWithin, catalogCopy, refreshCatalogCopy, whenApiAwake } from './catalogCopy';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      // Retry only what can heal by itself (network blips, the API waking up), with backoff.
      retry: (failureCount, error) => error instanceof ApiError && error.transient && failureCount < 4,
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
    },
    mutations: { retry: false },
  },
});

/** How long an awake API gets to answer the ping before the catalog copy is used instead. */
const WAKE_GRACE_MS = 1_500;
const CATALOG_KEYS = new Set(['meta', 'products', 'product']);

let reloadScheduled = false;

/** When the API wakes up: reload everything that was shown from the copy (startCatalogCopy refreshes the copy). */
function reloadWhenAwake() {
  if (reloadScheduled) return;
  reloadScheduled = true;
  void whenApiAwake()
    .then(() =>
      queryClient.invalidateQueries({
        predicate: (query) => CATALOG_KEYS.has(String(query.queryKey[0])),
      }),
    )
    .catch(() => undefined)
    .finally(() => {
      reloadScheduled = false;
    });
}

/**
 * Live data if the API is awake; otherwise the answer from the catalog copy (if it has one), and the
 * live data replaces it as soon as the API wakes up.
 */
async function liveOrCopy<T>(live: () => Promise<T>, fromCopy: (copy: CatalogIndex) => T | undefined) {
  if (await apiAwakeWithin(WAKE_GRACE_MS)) return live();
  const copy = await catalogCopy();
  const answer = copy ? fromCopy(copy) : undefined;
  if (answer === undefined) return live();
  reloadWhenAwake();
  return answer;
}

/** Every page load: wake the API, and keep the browser's catalog copy current once it is up. */
export function startCatalogCopy() {
  void whenApiAwake()
    .then(() => refreshCatalogCopy())
    .catch(() => undefined);
}

export const shopConfigQuery = queryOptions({
  queryKey: ['config'],
  queryFn: ({ signal }) => api.config(signal),
  staleTime: 5 * 60_000,
});

export const metaQuery = (context: { category?: string; system?: string }) =>
  queryOptions({
    queryKey: ['meta', context],
    queryFn: ({ signal }) =>
      liveOrCopy(
        () => api.meta(context, signal),
        (copy) => copy.meta(context),
      ),
    staleTime: 5 * 60_000,
  });

export const productsQuery = (params: ProductListParams) =>
  queryOptions({
    queryKey: ['products', params],
    queryFn: ({ signal }) =>
      liveOrCopy(
        () => api.products(params, signal),
        (copy) => {
          const query = productQuerySchema.safeParse(params);
          return query.success ? copy.list(query.data) : undefined;
        },
      ),
    placeholderData: keepPreviousData,
  });

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ['product', slug],
    queryFn: ({ signal }) =>
      liveOrCopy(
        () => api.product(slug, signal),
        (copy) => {
          // A product newer than the copy: wait for the API.
          const entry = copy.bySlug(slug);
          return entry && { product: entry.product, related: copy.related(entry.product) };
        },
      ),
  });

export const orderQuery = (number: string, token: string) =>
  queryOptions({
    queryKey: ['order', number, token],
    queryFn: ({ signal }) => api.order(number, token, signal),
    retry: (count, error) => error instanceof ApiError && error.transient && count < 4,
  });
