import { QueryClient, keepPreviousData, queryOptions } from '@tanstack/react-query';
import { ApiError, api, type ProductListParams } from './api';

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

export const shopConfigQuery = queryOptions({
  queryKey: ['config'],
  queryFn: ({ signal }) => api.config(signal),
  staleTime: 5 * 60_000,
});

export const metaQuery = (context: { category?: string; system?: string }) =>
  queryOptions({
    queryKey: ['meta', context],
    queryFn: ({ signal }) => api.meta(context, signal),
    staleTime: 5 * 60_000,
  });

export const productsQuery = (params: ProductListParams) =>
  queryOptions({
    queryKey: ['products', params],
    queryFn: ({ signal }) => api.products(params, signal),
    placeholderData: keepPreviousData,
  });

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => api.product(slug, signal),
  });

export const orderQuery = (number: string, token: string) =>
  queryOptions({
    queryKey: ['order', number, token],
    queryFn: ({ signal }) => api.order(number, token, signal),
    retry: (count, error) => error instanceof ApiError && error.transient && count < 4,
  });
