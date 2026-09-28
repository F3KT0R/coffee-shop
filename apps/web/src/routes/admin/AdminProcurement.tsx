import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRsd, type ProcurementItem } from '@kafeshop/core';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ShipmentWeightCard } from '../../components/ShipmentWeightCard';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { ApiError, api } from '../../lib/api';
import { buildKaffekBookmarklet } from '../../lib/kaffekBookmarklet';

/**
 * React refuses `javascript:` URLs in props, so the bookmark's href is set directly on the element.
 * The link is only meant to be dragged to the bookmarks bar; clicking it here does nothing.
 */
function BookmarkletLink({ items }: { items: ProcurementItem[] }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const addable = items
      .filter((i) => i.kaffekId !== null)
      .map((i) => ({ id: i.kaffekId!, qty: i.quantity, sku: i.sku }));
    ref.current?.setAttribute('href', buildKaffekBookmarklet(addable));
  }, [items]);
  return (
    <a
      ref={ref}
      href="#"
      onClick={(e) => e.preventDefault()}
      draggable
      className="btn-accent cursor-grab px-6 py-3 text-base active:cursor-grabbing"
      title="Prevucite me na traku sa obeleživačima"
    >
      ☕ KaffeK korpa
    </a>
  );
}

export function AdminProcurement() {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const batch = useQuery({
    queryKey: ['admin', 'procurement'],
    queryFn: ({ signal }) => api.admin.procurement(signal),
  });
  const markOrdered = useMutation({
    mutationFn: (orders: string[]) => api.admin.markOrdered(orders),
    onSuccess: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  if (batch.error) return <ErrorState error={batch.error} onRetry={() => void batch.refetch()} />;
  if (batch.isPending) return <Spinner />;
  const { items, orders, totalCostRsd, totalRevenueRsd, weight } = batch.data;

  return (
    <div>
      <p className="font-script text-2xl text-roast-500" aria-hidden="true">
        sledeća nabavka
      </p>
      <h1 className="text-4xl font-extrabold">Nabavka sa KaffeK</h1>
      <p className="mt-1 max-w-2xl text-sm text-espresso-700">
        Svi proizvodi iz potvrđenih porudžbina koje još nisu poručene. Kad ih poručite na KaffeK, označite
        porudžbine kao poručene.
      </p>

      {markOrdered.data && (
        <p role="status" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
          Označeno kao poručeno: {markOrdered.data.updated.length} porudžbina.
          {markOrdered.data.skipped.length > 0 &&
            ` Preskočeno (promenjen status): ${markOrdered.data.skipped.join(', ')}.`}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title="Nema potvrđenih porudžbina za nabavku">
          <p>Kad potvrdite porudžbinu, njeni proizvodi se pojavljuju ovde.</p>
        </EmptyState>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['Porudžbina', String(orders.length)],
              ['Komada', String(items.reduce((sum, i) => sum + i.quantity, 0))],
              ['Procena zarade', formatRsd(totalRevenueRsd - totalCostRsd)],
            ].map(([label, value]) => (
              <div key={label} className="card p-5">
                <p className="text-sm text-espresso-600">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <ShipmentWeightCard weight={weight} />

          <section className="card mt-6 p-6" aria-labelledby="bm-title">
            <h2 id="bm-title" className="text-xl font-bold">
              Dodaj sve u KaffeK korpu jednim klikom
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-espresso-700">
              <li>
                Prevucite dugme ispod na traku sa obeleživačima u pregledaču (Ctrl+Shift+B je prikazuje).
              </li>
              <li>
                Otvorite{' '}
                <a
                  href="https://kaffek.co.uk"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-roast-600 hover:underline"
                >
                  kaffek.co.uk
                </a>{' '}
                i prijavite se na svoj nalog.
              </li>
              <li>Kliknite obeleživač — proizvodi se dodaju u korpu i otvara se korpa.</li>
            </ol>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <BookmarkletLink items={items} />
              <span className="text-xs text-espresso-600">
                Obeleživač sadrži tačno ovu listu — posle novih potvrda prevucite novi.
              </span>
            </div>
          </section>

          <div className="card mt-6 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-espresso-900/10 text-xs text-espresso-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Proizvod</th>
                  <th className="px-4 py-3 text-right">Kom</th>
                  <th className="px-4 py-3">KaffeK</th>
                  <th className="px-4 py-3 text-right">Nabavna cena</th>
                  <th className="px-4 py-3">Porudžbine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso-900/10">
                {items.map((item) => (
                  <tr key={item.sku} className="align-top">
                    <td className="px-4 py-3">
                      <b>{item.brand}</b> {item.name}
                      <span className="block text-xs text-espresso-600">SKU {item.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-base font-bold tabular-nums">{item.quantity}</td>
                    <td className="px-4 py-3">
                      {item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-roast-600 hover:underline"
                        >
                          Otvori
                        </a>
                      ) : (
                        '—'
                      )}
                      {item.inStockAtSource === false && (
                        <span className="chip mt-1 block w-fit bg-red-100 text-red-800">Nema na stanju</span>
                      )}
                      {item.inStockAtSource === null && (
                        <span className="chip mt-1 block w-fit bg-red-100 text-red-800">
                          Povučen iz ponude
                        </span>
                      )}
                      {item.kaffekId === null && (
                        <span className="mt-1 block text-xs text-espresso-600">dodati ručno</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatRsd(item.unitCostRsd * item.quantity)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.orders.map((n) => (
                        <Link
                          key={n}
                          to={`/admin/porudzbine/${n}`}
                          className="mr-2 whitespace-nowrap text-roast-600 hover:underline"
                        >
                          {n}
                        </Link>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="card mt-6 p-6" aria-labelledby="done-title">
            <h2 id="done-title" className="text-xl font-bold">
              Poručili ste na KaffeK?
            </h2>
            <p className="mt-1 text-sm text-espresso-700">
              Označite ovih {orders.length} porudžbina kao „Poručeno“. Porudžbine potvrđene u međuvremenu
              ostaju za sledeću nabavku.
            </p>
            {confirming ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={markOrdered.isPending}
                  onClick={() => markOrdered.mutate(orders.map((o) => o.number))}
                >
                  {markOrdered.isPending ? 'Čuvam…' : 'Da, označi kao poručeno'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
                  Odustani
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary mt-4" onClick={() => setConfirming(true)}>
                Označi sve kao poručeno
              </button>
            )}
            {markOrdered.error && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {markOrdered.error instanceof ApiError ? markOrdered.error.message : 'Greška.'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AdminProcurement;
