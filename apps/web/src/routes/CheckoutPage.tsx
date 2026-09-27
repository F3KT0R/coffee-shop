import { useMutation, useQuery } from '@tanstack/react-query';
import { customerSchema, formatRsd, loyaltyDiscountRsd, loyaltyLookupSchema } from '@kafeshop/core';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { HeartDoodle } from '../components/Decor';
import { TruckIcon } from '../components/icons';
import { ProductImage } from '../components/ProductImage';
import { Spinner } from '../components/States';
import { ApiError, api } from '../lib/api';
import { selectCartInput, useCart } from '../lib/cart';
import { queryClient, shopConfigQuery } from '../lib/queries';
import { describeIssue, useCartQuote } from '../lib/useCartQuote';

type FieldErrors = Record<string, string>;

const FIELDS = [
  { name: 'fullName', label: 'Ime i prezime', autoComplete: 'name', span: 2 },
  { name: 'email', label: 'Email', autoComplete: 'email', type: 'email', span: 1 },
  { name: 'phone', label: 'Telefon', autoComplete: 'tel', type: 'tel', span: 1, placeholder: '064 123 4567' },
  { name: 'address', label: 'Ulica i broj', autoComplete: 'street-address', span: 2 },
  { name: 'postalCode', label: 'Poštanski broj', autoComplete: 'postal-code', inputMode: 'numeric', span: 1 },
  { name: 'city', label: 'Mesto', autoComplete: 'address-level2', span: 1 },
] as const;

function Field({
  field,
  error,
  onBlur,
}: {
  field: (typeof FIELDS)[number];
  error: string | undefined;
  onBlur?: (value: string) => void;
}) {
  const id = `f-${field.name}`;
  return (
    <div className={field.span === 2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="label">
        {field.label}
      </label>
      <input
        id={id}
        name={field.name}
        type={'type' in field ? field.type : 'text'}
        autoComplete={field.autoComplete}
        inputMode={'inputMode' in field ? field.inputMode : undefined}
        placeholder={'placeholder' in field ? field.placeholder : undefined}
        className="input"
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const quote = useCartQuote();
  const { data: config } = useQuery(shopConfigQuery);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // One key per checkout attempt: resubmits (double click, flaky network) can't create a second order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  // Set once the order exists (batched with the cart clear), so the empty-cart redirect below can't fire.
  const [completed, setCompleted] = useState(false);
  // Kafe klub: looked up when the email field is left, so a returning customer sees the discount upfront.
  const [loyaltyEmail, setLoyaltyEmail] = useState<string | null>(null);
  const loyalty = useQuery({
    queryKey: ['loyalty', loyaltyEmail],
    queryFn: ({ signal }) => api.loyalty(loyaltyEmail!, signal),
    enabled: !!loyaltyEmail,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const placeOrder = useMutation({
    mutationFn: (body: Parameters<typeof api.createOrder>[0]) => api.createOrder(body, idempotencyKey),
    onSuccess: ({ number, accessToken }) => {
      setCompleted(true);
      navigate(`/porudzbina/${number}?t=${encodeURIComponent(accessToken)}&nova=1`, { replace: true });
      clear();
      queryClient.removeQueries({ queryKey: ['quote'] });
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === 'CART_CHANGED') void quote.refetch();
        const fieldErrors = Object.fromEntries(
          Object.entries(error.fields).map(([path, message]) => [path.replace(/^customer\./, ''), message]),
        );
        setErrors(fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Porudžbina nije poslata. Proverite internet konekciju i pokušajte ponovo.');
      }
    },
  });

  if (completed) return <Spinner label="Otvaram porudžbinu…" />;
  if (quote.isEmpty) return <Navigate to="/korpa" replace />;
  if (config && !config.ordersOpen) return <Navigate to="/korpa" replace />;
  if (!quote.data || !config) return <Spinner />;

  const subtotal = quote.data.subtotalRsd;
  const tier = loyalty.data?.tier ?? null;
  const discount = tier ? loyaltyDiscountRsd(subtotal, tier.discountPercent) : 0;

  function checkLoyalty(value: string) {
    const parsed = loyaltyLookupSchema.safeParse({ email: value });
    setLoyaltyEmail(parsed.success ? parsed.data.email.toLowerCase() : null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const customer = Object.fromEntries(
      ['fullName', 'email', 'phone', 'address', 'postalCode', 'city', 'note'].map((k) => [
        k,
        String(form.get(k) ?? ''),
      ]),
    );
    const parsed = customerSchema.safeParse(customer);
    const acceptTerms = form.get('acceptTerms') === 'on';
    const nextErrors: FieldErrors = {};
    if (!parsed.success)
      for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] ??= issue.message;
    if (!acceptTerms) nextErrors.acceptTerms = 'Potrebno je da prihvatite uslove kupovine.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(`f-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    placeOrder.mutate({
      customer: customer as Parameters<typeof api.createOrder>[0]['customer'],
      items: selectCartInput(useCart.getState()),
      acceptTerms: true,
      website: String(form.get('website') ?? ''),
    });
  }

  return (
    <div className="container-page py-8">
      <title>Porudžbina | Kafe za Vas</title>
      <h1 className="text-4xl font-extrabold sm:text-5xl">Završetak porudžbine</h1>

      <form onSubmit={submit} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-8">
          <section className="card p-6" aria-labelledby="delivery">
            <h2 id="delivery" className="text-xl font-bold">
              Podaci za dostavu
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  error={errors[field.name]}
                  onBlur={field.name === 'email' ? checkLoyalty : undefined}
                />
              ))}
              {loyalty.data && (
                <div className="rounded-2xl bg-crema-100 p-4 text-sm sm:col-span-2" role="status">
                  {tier ? (
                    <p className="flex items-center gap-2">
                      <HeartDoodle className="size-6 shrink-0 text-roast-500" />
                      <span>
                        Dobrodošli nazad! Vi ste u Kafe klubu kao <b>{tier.name}</b> — ostvarujete{' '}
                        <b>{tier.discountPercent}% popusta</b> na ovu porudžbinu.
                      </span>
                    </p>
                  ) : (
                    loyalty.data.next && (
                      <p>
                        Kafe klub: još <b>{loyalty.data.next.ordersNeeded}</b> preuzet
                        {loyalty.data.next.ordersNeeded === 1 ? 'a porudžbina' : 'e porudžbine'} do{' '}
                        <b>{loyalty.data.next.discountPercent}% popusta</b> na svaku sledeću kupovinu.
                      </p>
                    )
                  )}
                </div>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="f-note" className="label">
                  Napomena <span className="font-normal text-espresso-600">(opciono)</span>
                </label>
                <textarea id="f-note" name="note" rows={3} maxLength={500} className="input" />
              </div>
              {/* Honeypot: invisible to people, tempting for bots. */}
              <div aria-hidden="true" className="absolute left-[-9999px]">
                <label htmlFor="f-website">Website</label>
                <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
              </div>
            </div>
          </section>

          <section className="card flex gap-4 p-6" aria-labelledby="cod">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-espresso-900 text-crema-100">
              <TruckIcon size={22} />
            </span>
            <div>
              <h2 id="cod" className="text-xl font-bold">
                Plaćanje pouzećem
              </h2>
              <p className="mt-1 text-sm text-espresso-700">
                Ništa ne plaćate unapred. Iznos porudžbine plaćate kuriru kada preuzmete paket.{' '}
                {config.postageNote}
              </p>
            </div>
          </section>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24" aria-label="Vaša porudžbina">
          <h2 className="text-xl font-bold">Vaša porudžbina</h2>
          {/* Padding keeps the quantity badges (which stick out of the thumbnails) inside the scroll area. */}
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pt-2 pr-2">
            {quote.data.lines.map((line) => (
              <li key={line.sku} className="flex items-center gap-3 text-sm">
                <span className="relative size-12 shrink-0 rounded-lg bg-white p-1">
                  <ProductImage src={line.image} alt="" className="size-full object-contain" />
                  <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-espresso-900 text-[0.65rem] font-bold text-white ring-2 ring-milk">
                    {line.quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {line.brand} {line.name}
                </span>
                <span className="font-medium tabular-nums">{formatRsd(line.lineTotalRsd)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-espresso-900/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Proizvodi</dt>
              <dd className="font-semibold tabular-nums">{formatRsd(subtotal)}</dd>
            </div>
            {discount > 0 && tier && (
              <div className="flex justify-between text-emerald-800">
                <dt>Kafe klub popust ({tier.discountPercent}%)</dt>
                <dd className="font-semibold tabular-nums">−{formatRsd(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-espresso-600">
              <dt>Poštarina</dt>
              <dd>plaća se kuriru</dd>
            </div>
            <div className="flex justify-between border-t border-espresso-900/10 pt-2 text-base">
              <dt className="font-bold">Plaćate pouzećem</dt>
              <dd className="font-extrabold tabular-nums">{formatRsd(subtotal - discount)}</dd>
            </div>
          </dl>

          {quote.data.issues.length > 0 && (
            <ul role="status" className="mt-4 space-y-1 rounded-xl bg-crema-200 p-3 text-sm">
              {quote.data.issues.map((issue) => (
                <li key={issue.sku}>{describeIssue(issue)}</li>
              ))}
            </ul>
          )}

          <label className="mt-5 flex items-start gap-2.5 text-sm">
            <input
              id="f-acceptTerms"
              name="acceptTerms"
              type="checkbox"
              className="mt-0.5 accent-espresso-900"
              aria-invalid={!!errors.acceptTerms}
            />
            <span>
              Prihvatam{' '}
              <Link
                to="/kako-poruciti#uslovi"
                target="_blank"
                className="font-semibold text-roast-600 hover:underline"
              >
                uslove kupovine
              </Link>{' '}
              i razumem da se proizvodi poručuju iz inostranstva.
            </span>
          </label>
          {errors.acceptTerms && <p className="mt-1 text-sm text-red-700">{errors.acceptTerms}</p>}

          {formError && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {formError}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary mt-5 w-full py-3 text-base"
            disabled={placeOrder.isPending || lines.length === 0}
          >
            {placeOrder.isPending ? 'Šaljem porudžbinu…' : 'Pošalji porudžbinu'}
          </button>
        </aside>
      </form>
    </div>
  );
}
