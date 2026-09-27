import type { ProductListParams } from './api';

/**
 * Catalog filters live in the URL (shareable, back-button friendly) under Serbian names,
 * and map 1:1 onto the API's query parameters.
 */
export const URL_TO_API = {
  kategorija: 'category',
  sistem: 'system',
  brend: 'brand',
  vrsta: 'kind',
  jacina: 'intensity',
  dijeta: 'diet',
  q: 'q',
  sort: 'sort',
} as const satisfies Record<string, keyof ProductListParams>;

export type UrlFilterKey = keyof typeof URL_TO_API;

export const PAGE_SIZE = 24;

export function paramsFromUrl(search: URLSearchParams): ProductListParams {
  const params: ProductListParams = { pageSize: PAGE_SIZE };
  for (const [urlKey, apiKey] of Object.entries(URL_TO_API)) {
    const value = search.get(urlKey)?.trim();
    if (value) (params as Record<string, string>)[apiKey] = value;
  }
  const page = Number(search.get('strana'));
  if (Number.isInteger(page) && page > 1) params.page = page;
  return params;
}

/** Updates one filter; any filter change resets paging. Multi-value filters are comma lists. */
export function withFilter(
  search: URLSearchParams,
  key: UrlFilterKey,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(search);
  if (value) next.set(key, value);
  else next.delete(key);
  next.delete('strana');
  if (key === 'kategorija') {
    // A different section has different systems/brands.
    next.delete('sistem');
    next.delete('brend');
    next.delete('vrsta');
  }
  if (key === 'sistem') next.delete('brend');
  return next;
}

export function toggleListValue(list: string | null, value: string): string | null {
  const values = new Set((list ?? '').split(',').filter(Boolean));
  if (values.has(value)) values.delete(value);
  else values.add(value);
  return values.size ? [...values].join(',') : null;
}

export function activeFilterCount(search: URLSearchParams): number {
  return (['kategorija', 'sistem', 'brend', 'vrsta', 'jacina', 'dijeta'] as const).filter((k) =>
    search.get(k),
  ).length;
}
