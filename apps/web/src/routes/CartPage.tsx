import { useQuery } from '@tanstack/react-query';
import { formatRsd } from '@kafeshop/core';
import { Link } from 'react-router';
import { TrashIcon } from '../components/icons';
import { ProductImage } from '../components/ProductImage';
import { QuantityStepper } from '../components/QuantityStepper';
import { EmptyState, ErrorState } from '../components/States';
import { useCart } from '../lib/cart';
import { shopConfigQuery } from '../lib/queries';
import { describeIssue, useCartQuote } from '../lib/useCartQuote';

export function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const quote = useCartQuote();
  const { data: config } = useQuery(shopConfigQuery);

  if (quote.isEmpty) {
    return (
      <div className="container-page py-12">
        <title>Korpa | Kafe za Vas</title>
        <EmptyState title="Korpa je prazna">
          <Link to="/prodavnica" className="btn-primary mt-4">
            Pogledaj ponudu
          </Link>
        </EmptyState>
      </div>
    );
  }

  const subtotal =
    quote.data?.subtotalRsd ?? lines.reduce((sum, l) => sum + l.snapshot.priceRsd * l.quantity, 0);

  return (
    <div className="container-page py-8">
      <title>Korpa | Kafe za Vas</title>
      <h1 className="text-4xl font-extrabold sm:text-5xl">Korpa</h1>

      {quote.data && quote.data.issues.length > 0 && (
        <ul role="status" className="mt-5 space-y-1 rounded-2xl bg-crema-200 p-4 text-sm">
          {quote.data.issues.map((issue) => (
            <li key={issue.sku}>{describeIssue(issue)}</li>
          ))}
        </ul>
      )}
      {quote.error && <ErrorState error={quote.error} onRetry={() => void quote.refetch()} />}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="card divide-y divide-espresso-900/10" aria-label="Proizvodi u korpi">
          {lines.map((line) => (
            <li key={line.sku} className="flex gap-4 p-4 sm:p-5">
              <Link
                to={`/proizvod/${line.snapshot.slug}`}
                className="size-20 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 sm:size-24"
              >
                <ProductImage src={line.snapshot.image} alt="" className="size-full object-contain" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-roast-600 uppercase">{line.snapshot.brand}</p>
                  <Link to={`/proizvod/${line.snapshot.slug}`} className="font-semibold hover:underline">
                    {line.snapshot.name}
                  </Link>
                  <p className="text-sm text-espresso-600">{formatRsd(line.snapshot.priceRsd)} / kom</p>
                </div>
                <div className="flex items-center gap-3">
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(q) => setQuantity(line.sku, q)}
                    label={`Količina: ${line.snapshot.name}`}
                  />
                  <span className="w-24 text-right font-semibold tabular-nums">
                    {formatRsd(line.snapshot.priceRsd * line.quantity)}
                  </span>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-espresso-600 hover:bg-crema-200 hover:text-red-700"
                    onClick={() => remove(line.sku)}
                    aria-label={`Ukloni ${line.snapshot.name}`}
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Pregled porudžbine">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Proizvodi</dt>
              <dd className="font-semibold tabular-nums" aria-live="polite">
                {formatRsd(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-espresso-600">
              <dt>Poštarina</dt>
              <dd>plaća se kuriru</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-crema-100 p-3 text-sm">
            Ništa ne plaćate unapred — sve plaćate <b>pouzećem</b>, kuriru pri preuzimanju paketa.
          </p>
          {config?.ordersOpen ? (
            <Link
              to="/kasa"
              className={`btn-primary mt-5 w-full py-3 text-base ${quote.isFetching || !quote.data ? 'pointer-events-none opacity-60' : ''}`}
              aria-disabled={quote.isFetching || !quote.data}
            >
              Nastavi na plaćanje
            </Link>
          ) : (
            <p className="mt-5 rounded-xl bg-crema-200 p-3 text-sm">{config?.closedMessage}</p>
          )}
          <Link
            to="/prodavnica"
            className="mt-3 block text-center text-sm font-semibold text-roast-600 hover:underline"
          >
            Nastavi kupovinu
          </Link>
        </aside>
      </div>
    </div>
  );
}
