import { useQuery } from '@tanstack/react-query';
import type { CartQuote } from '@kafeshop/core';
import { useEffect, useMemo } from 'react';
import { api } from './api';
import { useCart } from './cart';

/**
 * Server-authoritative pricing for the current cart. The quote also reconciles the stored cart
 * (fresh prices, removed products, capped quantities) so what the shopper sees is what they'll pay.
 */
export function useCartQuote() {
  // Subscribe to a primitive key: selecting fresh {sku, quantity} objects would re-render forever.
  const key = useCart((s) => s.lines.map((l) => `${l.sku}:${l.quantity}`).join(','));
  const input = useMemo(
    () =>
      key
        ? key.split(',').map((pair) => {
            const [sku = '', quantity = '0'] = pair.split(':');
            return { sku, quantity: Number(quantity) };
          })
        : [],
    [key],
  );
  const applyQuote = useCart((s) => s.applyQuote);
  const query = useQuery({
    queryKey: ['quote', key],
    queryFn: ({ signal }) => api.quote(input, signal),
    enabled: input.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (query.data) applyQuote(query.data);
  }, [query.data, applyQuote]);

  return { ...query, isEmpty: input.length === 0 };
}

export function describeIssue(issue: CartQuote['issues'][number]): string {
  switch (issue.type) {
    case 'out-of-stock':
      return `„${issue.name}“ trenutno nije dostupan i uklonjen je iz korpe.`;
    case 'quantity-limited':
      return `Količina za „${issue.name}“ je ograničena na ${issue.quantity}.`;
    default:
      return 'Jedan proizvod više nije u ponudi i uklonjen je iz korpe.';
  }
}
