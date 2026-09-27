import { useQuery } from '@tanstack/react-query';
import { formatRsd } from '@kafeshop/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { api } from '../../lib/api';
import { InstagramChatLink } from '../../components/AdminCustomerTools';

const date = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'medium' });

export function AdminCustomers() {
  const [q, setQ] = useState('');
  const customers = useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: ({ signal }) => api.admin.customers(signal),
  });

  if (customers.error) return <ErrorState error={customers.error} onRetry={() => void customers.refetch()} />;
  if (customers.isPending) return <Spinner />;

  const needle = q.trim().toLowerCase();
  const list = needle
    ? customers.data.items.filter((c) =>
        [c.email, c.name, c.phone, c.city].some((v) => v.toLowerCase().includes(needle)),
      )
    : customers.data.items;

  return (
    <div>
      <p className="font-script text-2xl text-roast-500" aria-hidden="true">
        kafe klub
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl font-extrabold">Kupci</h1>
        <input
          type="search"
          className="input w-full py-2 sm:w-72"
          placeholder="Ime, email, telefon, mesto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Pretraga kupaca"
        />
      </div>
      <p className="mt-1 text-sm text-espresso-700">
        Kupci su prepoznati po email adresi. Kafe klub nivo se računa od preuzetih porudžbina.
      </p>

      {list.length === 0 ? (
        <EmptyState title="Nema kupaca" />
      ) : (
        <div className="card mt-5 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-espresso-900/10 text-xs text-espresso-600 uppercase">
              <tr>
                <th className="px-4 py-3">Kupac</th>
                <th className="px-4 py-3">Kontakt</th>
                <th className="px-4 py-3 text-right">Porudžbine</th>
                <th className="px-4 py-3 text-right">Preuzeto</th>
                <th className="px-4 py-3 text-right">Potrošeno</th>
                <th className="px-4 py-3">Kafe klub</th>
                <th className="px-4 py-3">Poslednja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-espresso-900/10">
              {list.map((c) => (
                <tr key={c.email} className="hover:bg-crema-100">
                  <td className="px-4 py-3">
                    <b>{c.name}</b>
                    <span className="block text-xs text-espresso-600">{c.city}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <Link
                      to={`/admin/porudzbine?q=${encodeURIComponent(c.email)}`}
                      className="text-roast-600 hover:underline"
                    >
                      {c.email}
                    </Link>
                    <span className="block text-espresso-600">{c.phone}</span>
                    {c.instagramHandle && <InstagramChatLink handle={c.instagramHandle} compact />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.orders}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{c.completedOrders}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatRsd(c.spentRsd)}</td>
                  <td className="px-4 py-3">
                    {c.tier ? <span className="chip bg-roast-400/25 text-espresso-900">{c.tier}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-espresso-700">{date.format(new Date(c.lastOrderAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminCustomers;
