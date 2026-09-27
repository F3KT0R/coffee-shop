import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUSES, formatRsd, type OrderStatus } from '@kafeshop/core';
import { Link } from 'react-router';
import { OrdersTable } from '../../components/OrdersTable';
import { ErrorState, Spinner } from '../../components/States';
import { StatusBadge } from '../../components/StatusBadge';
import { adminDashboardQuery } from '../../lib/adminQueries';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'medium', timeStyle: 'short' });
const PIPELINE: OrderStatus[] = ['NEW', 'CONFIRMED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-espresso-600">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-espresso-600">{hint}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const { data, error, isPending, refetch } = useQuery(adminDashboardQuery);
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Spinner />;

  const open = data.counts.NEW + data.counts.CONFIRMED + data.counts.ORDERED + data.counts.SHIPPED;

  return (
    <div>
      <p className="font-script text-2xl text-roast-500" aria-hidden="true">
        dobrodošli
      </p>
      <h1 className="text-4xl font-extrabold">Pregled</h1>

      {data.counts.NEW > 0 ? (
        <Link
          to="/admin/porudzbine?status=NEW"
          className="mt-6 flex items-center justify-between gap-4 rounded-3xl bg-amber-100 p-5 text-amber-950 ring-1 ring-amber-300 transition hover:bg-amber-200"
        >
          <span>
            <b className="text-lg">
              {data.counts.NEW} {data.counts.NEW === 1 ? 'nova porudžbina čeka' : 'nove porudžbine čekaju'}{' '}
              potvrdu
            </b>
            <span className="block text-sm">
              Kad vam kupac pošalje broj porudžbine na Instagramu, otvorite je i kliknite „Potvrdi
              porudžbinu“.
            </span>
          </span>
          <span className="btn-primary shrink-0">Otvori</span>
        </Link>
      ) : (
        <p className="mt-6 rounded-3xl bg-emerald-50 p-5 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Sve nove porudžbine su obrađene.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Porudžbine danas"
          value={String(data.ordersToday)}
          hint={`${data.ordersLast7Days} u poslednjih 7 dana`}
        />
        <Stat
          label="Otvorene porudžbine"
          value={String(open)}
          hint={`${formatRsd(data.openRevenueRsd)} pouzećem`}
        />
        <Stat label="Procena zarade (otvorene)" value={formatRsd(data.openProfitRsd)} />
        <Stat
          label="Zarada ovog meseca"
          value={formatRsd(data.monthProfitRsd)}
          hint={`preuzeto za ${formatRsd(data.monthRevenueRsd)}`}
        />
      </div>

      <section className="card mt-6 p-5" aria-labelledby="pipeline">
        <h2 id="pipeline" className="text-lg font-bold">
          Porudžbine po statusu
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PIPELINE.map((status) => (
            <li key={status}>
              <Link
                to={`/admin/porudzbine?status=${status}`}
                className="flex items-center gap-2 rounded-full bg-crema-100 py-1.5 pr-4 pl-1.5 hover:bg-crema-200"
                title={ORDER_STATUSES[status].description}
              >
                <StatusBadge status={status} />
                <b className="tabular-nums">{data.counts[status]}</b>
              </Link>
            </li>
          ))}
        </ul>
        {data.counts.CONFIRMED > 0 && (
          <p className="mt-4 text-sm">
            {data.counts.CONFIRMED} potvrđenih porudžbina čeka nabavku —{' '}
            <Link to="/admin/nabavka" className="font-bold text-roast-600 hover:underline">
              otvori Nabavku
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-6" aria-labelledby="latest">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="latest" className="text-lg font-bold">
            Poslednje porudžbine
          </h2>
          <Link to="/admin/porudzbine" className="text-sm font-bold text-roast-600 hover:underline">
            Sve porudžbine
          </Link>
        </div>
        {data.latest.length > 0 ? (
          <OrdersTable orders={data.latest} />
        ) : (
          <p className="text-sm text-espresso-600">Još nema porudžbina.</p>
        )}
      </section>

      <ul className="mt-6 space-y-1 text-xs text-espresso-600">
        <li>
          Email obaveštenja o novim porudžbinama:{' '}
          {data.emailEnabled ? (
            <b className="text-emerald-800">uključena</b>
          ) : (
            <b className="text-red-700">nisu podešena (SMTP_* i ADMIN_EMAIL)</b>
          )}
        </li>
        <li>
          Katalog poslednji put osvežen:{' '}
          {data.lastSyncAt ? dateTime.format(new Date(data.lastSyncAt)) : 'nikad'}
        </li>
      </ul>
    </div>
  );
}

export default AdminDashboard;
