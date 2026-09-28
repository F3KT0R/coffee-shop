import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUSES, formatRsd, type OrderStatus, type OrderView } from '@kafeshop/core';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { BrushText, HeartDoodle } from '../components/Decor';
import { CheckIcon, CopyIcon } from '../components/icons';
import { ProductImage } from '../components/ProductImage';
import { ErrorState, Spinner } from '../components/States';
import { ApiError } from '../lib/api';
import { orderQuery, shopConfigQuery } from '../lib/queries';

const FLOW: OrderStatus[] = ['NEW', 'CONFIRMED', 'ORDERED', 'SHIPPED', 'DELIVERED'];

const dateTime = new Intl.DateTimeFormat('sr-Latn-RS', { dateStyle: 'medium', timeStyle: 'short' });

/** The order number is what customers send on Instagram, so it's big, copyable and explained. */
function OrderNumberCard({ order, isNew }: { order: OrderView; isNew: boolean }) {
  const { data: config } = useQuery(shopConfigQuery);
  const [copied, setCopied] = useState(false);
  const awaitingConfirmation = order.status === 'NEW';
  const emailEnabled = config?.emailEnabled ?? false;

  return (
    <section className="relative overflow-hidden rounded-4xl bg-espresso-900 p-6 text-crema-100 sm:p-8">
      <HeartDoodle className="absolute top-6 right-6 size-12 rotate-12 text-crema-100/40" />
      {isNew && <BrushText className="text-3xl sm:text-4xl">Hvala na porudžbini!</BrushText>}
      <p className="mt-5 text-sm font-bold tracking-[0.14em] text-crema-200/80 uppercase">Broj porudžbine</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="font-display text-5xl font-extrabold tabular-nums sm:text-6xl">{order.number}</p>
        <button
          type="button"
          className="btn bg-crema-100/10 text-crema-100 ring-1 ring-crema-100/30 hover:bg-crema-100/20"
          onClick={() => {
            void navigator.clipboard?.writeText(order.number).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1_800);
            });
          }}
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} {copied ? 'Kopirano' : 'Kopiraj broj'}
        </button>
      </div>

      {awaitingConfirmation && (
        <div className="mt-6 rounded-3xl bg-crema-100 p-5 text-espresso-900">
          <p className="font-bold">Poslednji korak: pošaljite nam ovaj broj u Instagram poruci.</p>
          <p className="mt-1 text-sm text-espresso-700">
            Tako potvrđujemo da je porudžbina vaša i uključujemo je u narednu nabavku.
            {emailEnabled
              ? ' Nakon potvrde dobijate email.'
              : ' Potvrdu vam šaljemo u istom Instagram razgovoru.'}
          </p>
          {config?.instagramUrl && (
            <a
              href={config.instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary mt-4 px-6 py-3"
            >
              Otvori Instagram
            </a>
          )}
        </div>
      )}
      {isNew && (
        <p className="mt-4 text-sm text-crema-200/80">
          {emailEnabled ? (
            <>
              Potvrdu smo poslali na <b className="text-crema-100">{order.customer.email}</b>. Sačuvajte ovu
              stranicu — preko nje pratite status porudžbine.
            </>
          ) : (
            <>Sačuvajte ovu stranicu (npr. u obeleživače) — preko nje pratite status porudžbine.</>
          )}
        </p>
      )}
    </section>
  );
}

function Timeline({ order }: { order: OrderView }) {
  if (order.status === 'CANCELLED') {
    return (
      <p className="rounded-2xl bg-crema-200 p-4 text-sm font-medium">
        {ORDER_STATUSES.CANCELLED.description}
      </p>
    );
  }
  const reached = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const currentIndex = FLOW.indexOf(order.status);
  return (
    <ol className="space-y-4">
      {FLOW.map((status, i) => {
        const done = i <= currentIndex;
        const at = reached.get(status);
        return (
          <li key={status} className="flex gap-3" aria-current={i === currentIndex ? 'step' : undefined}>
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                done ? 'bg-espresso-900 text-crema-100' : 'bg-crema-200 text-espresso-600'
              }`}
            >
              {done ? <CheckIcon size={14} /> : <span className="text-xs">{i + 1}</span>}
            </span>
            <div>
              <p className={`text-sm font-semibold ${done ? '' : 'text-espresso-600'}`}>
                {ORDER_STATUSES[status].name}
              </p>
              {i === currentIndex && (
                <p className="text-sm text-espresso-700">{ORDER_STATUSES[status].description}</p>
              )}
              {at && <p className="text-xs text-espresso-600/80">{dateTime.format(new Date(at))}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderPage() {
  const { number = '' } = useParams();
  const [search] = useSearchParams();
  const token = search.get('t') ?? '';
  const isNew = search.get('nova') === '1';
  const {
    data: order,
    error,
    isPending,
    refetch,
  } = useQuery({ ...orderQuery(number, token), enabled: !!token });

  if (!token || (error instanceof ApiError && error.status === 404)) {
    return (
      <div className="container-page py-12">
        <ErrorState
          error={
            new ApiError(
              404,
              'NOT_FOUND',
              'Porudžbina nije pronađena. Otvorite link porudžbine koji ste sačuvali ili dobili emailom.',
            )
          }
        />
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Spinner label="Učitavam porudžbinu…" />;

  return (
    <div className="container-page max-w-5xl py-8">
      <title>{`Porudžbina ${order.number} | Kafe za Vas`}</title>
      <OrderNumberCard order={order} isNew={isNew} />
      <p className="mt-3 text-sm text-espresso-600">Poručeno {dateTime.format(new Date(order.createdAt))}</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section className="card h-fit p-6" aria-labelledby="items">
          <h2 id="items" className="text-xl font-bold">
            Proizvodi
          </h2>
          <ul className="mt-4 divide-y divide-espresso-900/10">
            {order.lines.map((line) => (
              <li key={line.sku} className="flex items-center gap-3 py-3 text-sm">
                <span className="size-12 shrink-0 rounded-lg bg-white p-1">
                  <ProductImage src={line.image} alt="" className="size-full object-contain" />
                </span>
                <Link to={`/proizvod/${line.slug}`} className="min-w-0 flex-1 hover:underline">
                  {line.brand} {line.name}
                </Link>
                <span className="text-espresso-600 tabular-nums">{line.quantity}×</span>
                <span className="w-24 text-right font-medium tabular-nums">
                  {formatRsd(line.lineTotalRsd)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1.5 border-t border-espresso-900/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Proizvodi</dt>
              <dd className="tabular-nums">{formatRsd(order.subtotalRsd)}</dd>
            </div>
            {order.discountRsd > 0 && (
              <div className="flex justify-between text-emerald-800">
                <dt>Kafe klub popust{order.loyaltyTier ? ` (${order.loyaltyTier})` : ''}</dt>
                <dd className="tabular-nums">−{formatRsd(order.discountRsd)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>Plaćate pouzećem</dt>
              <dd className="tabular-nums">{formatRsd(order.totalRsd)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-espresso-600">{order.postageNote}</p>
        </section>

        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="status">
            <h2 id="status" className="mb-4 text-xl font-bold">
              Status
            </h2>
            <Timeline order={order} />
            <p className="mt-5 text-xs text-espresso-600">
              Očekivana isporuka: {order.deliveryEstimate} od potvrde.
            </p>
          </section>
          <section className="card p-6 text-sm" aria-labelledby="address">
            <h2 id="address" className="mb-2 text-xl font-bold">
              Dostava
            </h2>
            <address className="leading-relaxed not-italic">
              {order.customer.fullName}
              <br />
              {order.customer.address}
              <br />
              {order.customer.postalCode} {order.customer.city}
              <br />
              {order.customer.phone}
            </address>
          </section>
        </aside>
      </div>
    </div>
  );
}
