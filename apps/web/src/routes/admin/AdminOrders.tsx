import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ORDER_STATUSES, type OrderStatus } from '@kafeshop/core';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { OrdersTable } from '../../components/OrdersTable';
import { StatusFilterChip } from '../../components/StatusBadge';
import { api } from '../../lib/api';

export function AdminOrders() {
  const [search, setSearch] = useSearchParams();
  const status = search.get('status') ?? undefined;
  const q = search.get('q') ?? undefined;
  const page = Number(search.get('strana') ?? 1) || 1;
  const [text, setText] = useState(q ?? '');
  const orders = useQuery({
    queryKey: ['admin', 'orders', { status, q, page }],
    queryFn: ({ signal }) => api.admin.orders({ status, q, page }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('strana');
    setSearch(next);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    set('q', text.trim() || null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => set('status', null)}
          className={`chip py-1.5 ${!status ? 'ring-2 ring-espresso-900' : ''}`}
        >
          Sve
        </button>
        {(Object.keys(ORDER_STATUSES) as OrderStatus[]).map((s) => (
          <StatusFilterChip key={s} status={s} active={status === s} onClick={() => set('status', s)} />
        ))}
        <form onSubmit={submit} className="ml-auto w-full sm:w-64" role="search">
          <input
            type="search"
            className="input py-2"
            placeholder="Broj, ime, email, telefon"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Pretraga porudžbina"
          />
        </form>
      </div>

      {orders.error ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.isPending ? (
        <Spinner />
      ) : orders.data.items.length === 0 ? (
        <EmptyState title="Nema porudžbina" />
      ) : (
        <>
          <div className="mt-5">
            <OrdersTable orders={orders.data.items} />
          </div>
          <Pagination page={orders.data.page} totalPages={orders.data.totalPages} />
        </>
      )}
    </div>
  );
}

export default AdminOrders;
