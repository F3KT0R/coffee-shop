import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatRsd, type ShippingOrder } from '@kafeshop/core';
import { Link } from 'react-router';
import { CopyButton, InstagramChatLink, ShippingLabel } from '../../components/AdminCustomerTools';
import { shippingText } from '../../lib/shipping';
import { PrinterIcon } from '../../components/icons';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { ApiError, api } from '../../lib/api';

/**
 * CSV for courier portals' bulk import. Semicolon-separated with a UTF-8 BOM, which is what Excel with
 * Serbian regional settings expects (so č, ć, đ, š, ž survive).
 */
/** Byte-order mark: tells Excel the file is UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

function toCsv(orders: ShippingOrder[]): string {
  const header = [
    'Ime i prezime',
    'Adresa',
    'Poštanski broj',
    'Mesto',
    'Telefon',
    'Email',
    'Otkupnina (RSD)',
    'Broj porudžbine',
    'Sadržaj',
    'Napomena',
  ];
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = orders.map((o) =>
    [
      o.fullName,
      o.address,
      o.postalCode,
      o.city,
      o.phone,
      o.email,
      o.totalRsd,
      o.number,
      o.lines.map((l) => `${l.quantity}x ${l.brand} ${l.name}`).join(', '),
      o.note,
    ]
      .map(cell)
      .join(';'),
  );
  return `${UTF8_BOM}${[header.map(cell).join(';'), ...rows].join('\r\n')}`;
}

function downloadCsv(orders: ShippingOrder[]) {
  const url = URL.createObjectURL(new Blob([toCsv(orders)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `slanje-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ShipmentCard({ order }: { order: ShippingOrder }) {
  const queryClient = useQueryClient();
  const markShipped = useMutation({
    mutationFn: () => api.admin.setStatus(order.number, 'SHIPPED', 'Poslato kurirom'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <li className="card grid gap-4 p-5 md:grid-cols-[minmax(0,20rem)_1fr]">
      <ShippingLabel order={order} />
      <div className="grid content-start gap-3 text-sm">
        <p>
          <Link to={`/admin/porudzbine/${order.number}`} className="font-bold text-roast-600 hover:underline">
            Porudžbina {order.number}
          </Link>{' '}
          · {order.itemCount} kom · {order.email}
        </p>
        <ul className="list-disc pl-5 text-espresso-700">
          {order.lines.map((l, i) => (
            <li key={i}>
              {l.quantity}× {l.brand} {l.name}
            </li>
          ))}
        </ul>
        {order.note && <p className="rounded-xl bg-crema-100 p-3">Napomena kupca: {order.note}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={shippingText(order)} label="Kopiraj adresu" />
          {order.instagramHandle && <InstagramChatLink handle={order.instagramHandle} />}
          <button
            type="button"
            className="btn-accent"
            disabled={markShipped.isPending}
            onClick={() => markShipped.mutate()}
          >
            {markShipped.isPending ? 'Čuvam…' : 'Označi kao poslato'}
          </button>
        </div>
        {markShipped.error && (
          <p role="alert" className="text-red-700">
            {markShipped.error instanceof ApiError ? markShipped.error.message : 'Greška.'}
          </p>
        )}
        <p className="text-xs text-espresso-600">
          „Poslato“ šalje kupcu email sa iznosom koji plaća kuriru ({formatRsd(order.totalRsd)} + poštarina).
        </p>
      </div>
    </li>
  );
}

export function AdminShipping() {
  const shipping = useQuery({
    queryKey: ['admin', 'shipping'],
    queryFn: ({ signal }) => api.admin.shipping(signal),
  });

  if (shipping.error) return <ErrorState error={shipping.error} onRetry={() => void shipping.refetch()} />;
  if (shipping.isPending) return <Spinner />;
  const orders = shipping.data.items;

  return (
    <>
      <div className="no-print">
        <p className="font-script text-2xl text-roast-500" aria-hidden="true">
          na put
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl font-extrabold">Slanje</h1>
          {orders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={() => downloadCsv(orders)}>
                Preuzmi CSV za kurira
              </button>
              <button type="button" className="btn-primary" onClick={() => window.print()}>
                <PrinterIcon size={16} /> Štampaj sve nalepnice
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-sm text-espresso-700">
          Porudžbine koje su stigle iz Velike Britanije i čekaju slanje, sa adresama iz forme koju je kupac
          popunio. Otkupnina je iznos koji kurir naplaćuje za robu.
        </p>

        {orders.length === 0 ? (
          <EmptyState title="Nema porudžbina za slanje">
            <p>Porudžbine se pojavljuju ovde kada ih označite kao „Poručeno“ u Nabavci.</p>
          </EmptyState>
        ) : (
          <ul className="mt-6 grid gap-4">
            {orders.map((order) => (
              <ShipmentCard key={order.number} order={order} />
            ))}
          </ul>
        )}
      </div>

      <div className="print-sheet">
        {orders.map((order) => (
          <ShippingLabel key={order.number} order={order} />
        ))}
      </div>
    </>
  );
}

export default AdminShipping;
