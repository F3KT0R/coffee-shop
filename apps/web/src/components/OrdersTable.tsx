import { formatRsd, type AdminOrderSummary } from '@kafeshop/core';
import { Link } from 'react-router';
import { InstagramChatLink } from './AdminCustomerTools';
import { StatusBadge } from './StatusBadge';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'short', timeStyle: 'short' });

export function OrdersTable({ orders }: { orders: AdminOrderSummary[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-espresso-900/10 text-xs text-espresso-600 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Broj</th>
            <th className="px-4 py-3 font-semibold">Datum</th>
            <th className="px-4 py-3 font-semibold">Kupac</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Pouzećem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-espresso-900/10">
          {orders.map((o) => (
            <tr key={o.number} className="hover:bg-crema-100">
              <td className="px-4 py-3 font-bold tabular-nums">
                <Link to={`/admin/porudzbine/${o.number}`} className="hover:underline">
                  {o.number}
                </Link>
              </td>
              <td className="px-4 py-3 text-espresso-700">{dateTime.format(new Date(o.createdAt))}</td>
              <td className="px-4 py-3">
                {o.customerName}
                <span className="block text-xs text-espresso-600">
                  {o.city} · {o.itemCount} kom{o.loyaltyTier && ` · ${o.loyaltyTier}`}
                </span>
                {o.instagramHandle && <InstagramChatLink handle={o.instagramHandle} compact />}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatRsd(o.totalRsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
