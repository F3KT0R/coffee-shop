import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OPEN_STATUSES, ORDER_STATUSES, formatRsd, isStepBack, type OrderStatus } from '@kafeshop/core';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState, Spinner } from '../../components/States';
import { ApiError, api } from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { CopyButton, InstagramHandleCard, ShippingLabel } from '../../components/AdminCustomerTools';
import { shippingText } from '../../lib/shipping';
import { PrinterIcon } from '../../components/icons';

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'medium', timeStyle: 'short' });

const EVENT_LABELS: Record<string, string> = {
  CREATED: 'Porudžbina kreirana',
  STATUS_CHANGED: 'Promena statusa',
  EMAIL_SENT: 'Email poslat',
  EMAIL_FAILED: 'Email NIJE poslat',
  NOTE: 'Beleška',
};

const ACTION_LABELS: Record<OrderStatus, string> = {
  NEW: 'Vrati na primljeno',
  CONFIRMED: 'Potvrdi porudžbinu',
  ORDERED: 'Poručeno od dobavljača',
  SHIPPED: 'Poslato kurirom',
  DELIVERED: 'Preuzeto i plaćeno',
  CANCELLED: 'Otkaži porudžbinu',
};

/** Corrections back to an earlier step. */
const STEP_BACK_LABELS: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Vrati u nabavku (nije poručeno)',
};

export function AdminOrderDetail() {
  const { number = '' } = useParams();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const order = useQuery({
    queryKey: ['admin', 'order', number],
    queryFn: ({ signal }) => api.admin.order(number, signal),
  });
  const change = useMutation({
    mutationFn: ({ status, note }: { status: OrderStatus; note: string }) =>
      api.admin.setStatus(number, status, note),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'order', number], data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setPending(null);
      setNote('');
    },
  });

  const resend = useMutation({
    mutationFn: () => api.admin.resendEmail(number),
    onSuccess: (data) => queryClient.setQueryData(['admin', 'order', number], data),
  });

  if (order.error) return <ErrorState error={order.error} onRetry={() => void order.refetch()} />;
  if (order.isPending) return <Spinner />;
  const o = order.data;
  const customerLink = `${window.location.origin}/porudzbina/${o.number}?t=${encodeURIComponent(o.accessToken)}`;

  const label = {
    number: o.number,
    fullName: o.customer.fullName,
    address: o.customer.address,
    postalCode: o.customer.postalCode,
    city: o.customer.city,
    phone: o.customer.phone,
    totalRsd: o.totalRsd,
  };

  return (
    <>
      <div className="no-print grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div>
            <Link to="/admin/porudzbine" className="text-sm font-semibold text-roast-600 hover:underline">
              ← Sve porudžbine
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tabular-nums">{o.number}</h1>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-sm text-espresso-600">
              {dateTime.format(new Date(o.createdAt))} · Plaćanje pouzećem
              {o.loyaltyTier && ` · Kafe klub: ${o.loyaltyTier}`}
            </p>
          </div>

          <section className="card p-6" aria-labelledby="actions">
            <h2 id="actions" className="text-lg font-bold">
              Sledeći korak
            </h2>
            {o.allowedTransitions.length === 0 ? (
              <p className="mt-2 text-sm text-espresso-700">Porudžbina je završena.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {o.allowedTransitions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={
                      s === 'CANCELLED'
                        ? 'btn-ghost text-red-700'
                        : isStepBack(o.status, s)
                          ? 'btn-ghost'
                          : 'btn-primary'
                    }
                    onClick={() => setPending(s)}
                    aria-pressed={pending === s}
                  >
                    {isStepBack(o.status, s) ? STEP_BACK_LABELS[s] : ACTION_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
            {pending && (
              <div className="mt-4 rounded-2xl bg-crema-100 p-4">
                <p className="text-sm">
                  Promeniti status u <b>{ORDER_STATUSES[pending].name}</b>?
                  {isStepBack(o.status, pending)
                    ? ' Kupac ne dobija obaveštenje.'
                    : ['CONFIRMED', 'SHIPPED', 'CANCELLED'].includes(pending) &&
                      ' Kupac dobija email obaveštenje.'}
                </p>
                <label htmlFor="note" className="label mt-3">
                  Interna napomena (opciono)
                </label>
                <input
                  id="note"
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-accent"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ status: pending, note })}
                  >
                    {change.isPending ? 'Čuvam…' : 'Potvrdi'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setPending(null)}>
                    Odustani
                  </button>
                </div>
                {change.error && (
                  <p role="alert" className="mt-2 text-sm text-red-700">
                    {change.error instanceof ApiError ? change.error.message : 'Greška.'}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="card p-6" aria-labelledby="lines">
            <h2 id="lines" className="text-lg font-bold">
              Proizvodi
            </h2>
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-espresso-900/10">
                {o.lines.map((l) => (
                  <tr key={l.sku}>
                    <td className="py-2 pr-3">
                      {l.brand} {l.name}
                      <span className="block text-xs text-espresso-600">SKU {l.sku}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{l.quantity}×</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{formatRsd(l.unitPriceRsd)}</td>
                    <td className="py-2 pl-3 text-right font-semibold tabular-nums">
                      {formatRsd(l.lineTotalRsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-3 space-y-1 border-t border-espresso-900/10 pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Proizvodi</dt>
                <dd>{formatRsd(o.subtotalRsd)}</dd>
              </div>
              {o.discountRsd > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <dt>Kafe klub popust</dt>
                  <dd>−{formatRsd(o.discountRsd)}</dd>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <dt>Kupac plaća pouzećem</dt>
                <dd>{formatRsd(o.totalRsd)}</dd>
              </div>
              <div className="flex justify-between border-t border-espresso-900/10 pt-2 text-espresso-600">
                <dt>Nabavna cena sa transportom (procena)</dt>
                <dd>{formatRsd(o.costRsd)}</dd>
              </div>
              <div className="flex justify-between font-bold text-emerald-800">
                <dt>Zarada (procena)</dt>
                <dd>{formatRsd(o.profitRsd)}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-6" aria-labelledby="history">
            <h2 id="history" className="text-lg font-bold">
              Istorija
            </h2>
            <ol className="mt-3 space-y-3 text-sm">
              {o.events.map((e, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-32 shrink-0 text-espresso-600">{dateTime.format(new Date(e.at))}</span>
                  <span className={e.type === 'EMAIL_FAILED' ? 'text-red-700' : ''}>
                    {EVENT_LABELS[e.type] ?? e.type}
                    {e.toStatus && `: ${ORDER_STATUSES[e.toStatus].name}`}
                    {e.message && <span className="block text-espresso-600">{e.message}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <InstagramHandleCard key={o.instagramHandle ?? 'none'} order={o} />

          <section className="card p-6 text-sm" aria-labelledby="ship">
            <h2 id="ship" className="mb-3 text-lg font-bold">
              Adresa za slanje
            </h2>
            <ShippingLabel order={label} />
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={shippingText(label)} label="Kopiraj adresu" />
              <button type="button" className="btn-ghost" onClick={() => window.print()}>
                <PrinterIcon size={16} /> Štampaj
              </button>
            </div>
          </section>

          <section className="card p-6 text-sm" aria-labelledby="customer">
            <h2 id="customer" className="mb-2 text-lg font-bold">
              Kontakt
            </h2>
            <p className="leading-relaxed">
              <a href={`tel:${o.customer.phone}`} className="text-roast-600 hover:underline">
                {o.customer.phone}
              </a>
              <br />
              <a href={`mailto:${o.customer.email}`} className="text-roast-600 hover:underline">
                {o.customer.email}
              </a>
            </p>
            {o.customerNote && <p className="mt-3 rounded-xl bg-crema-100 p-3">Napomena: {o.customerNote}</p>}
            {OPEN_STATUSES.includes(o.status) && (
              <div className="mt-4 border-t border-espresso-900/10 pt-4">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate()}
                >
                  {resend.isPending ? 'Šaljem…' : 'Pošalji email kupcu'}
                </button>
                <p className="mt-1 text-xs text-espresso-600">
                  {o.status === 'NEW'
                    ? 'Šalje potvrdu porudžbine (račun sa proizvodima).'
                    : `Šalje obaveštenje „${ORDER_STATUSES[o.status].name}“ sa proizvodima.`}
                </p>
                {resend.isSuccess && (
                  <p role="status" className="mt-2 text-emerald-800">
                    Poslato na {o.customer.email}.
                  </p>
                )}
                {resend.error && (
                  <p role="alert" className="mt-2 text-red-700">
                    {resend.error instanceof ApiError ? resend.error.message : 'Slanje nije uspelo.'}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="card p-6 text-sm" aria-labelledby="links">
            <h2 id="links" className="mb-2 text-lg font-bold">
              Link za kupca
            </h2>
            <p className="text-espresso-700">Stranica za praćenje (ako kupac izgubi email):</p>
            <input
              readOnly
              value={customerLink}
              className="input mt-2 text-xs"
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Link za kupca"
            />
          </section>
        </aside>
      </div>
      <div className="print-sheet">
        <ShippingLabel order={label} />
      </div>
    </>
  );
}

export default AdminOrderDetail;
