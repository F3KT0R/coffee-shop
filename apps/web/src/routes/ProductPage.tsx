import { useQuery } from '@tanstack/react-query';
import {
  DIET_TAGS,
  DRINK_KINDS,
  categoryName,
  formatRsd,
  getSystem,
  packLabel,
  pricePerUnit,
  type Product,
} from '@kafeshop/core';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { BrushText, HeartDoodle } from '../components/Decor';
import { CheckIcon, ChevronRightIcon, StarIcon, TruckIcon } from '../components/icons';
import { IntensityMeter } from '../components/IntensityMeter';
import { Price } from '../components/Price';
import { ProductCard } from '../components/ProductCard';
import { ProductImage } from '../components/ProductImage';
import { QuantityStepper } from '../components/QuantityStepper';
import { ErrorState, Spinner } from '../components/States';
import { ApiError } from '../lib/api';
import { useCart } from '../lib/cart';
import { productQuery, shopConfigQuery } from '../lib/queries';
import { NotFound } from './NotFound';

/** Locative case for "price per ..." */
const PER_UNIT: Partial<Record<NonNullable<Product['packUnit']>, string>> = {
  kapsula: 'kapsuli',
  jastučića: 'jastučiću',
  kesica: 'kesici',
  kom: 'komadu',
};

function Gallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const images = product.images.slice(0, 6);
  return (
    <div>
      <div className="card aspect-square overflow-hidden bg-white p-6 sm:p-10">
        <ProductImage
          src={images[active] ?? null}
          alt={`${product.brand} ${product.name}`}
          className="size-full object-contain"
          eager
        />
      </div>
      {images.length > 1 && (
        <ul className="mt-3 grid grid-cols-6 gap-2" aria-label="Slike proizvoda">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Slika ${i + 1}`}
                aria-current={i === active}
                className={`aspect-square w-full overflow-hidden rounded-xl bg-white p-1.5 ring-2 transition ${
                  i === active ? 'ring-roast-500' : 'ring-transparent hover:ring-espresso-900/15'
                }`}
              >
                <ProductImage src={src} alt="" className="size-full object-contain" eager />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Specs({ product }: { product: Product }) {
  const rows: [string, React.ReactNode][] = [];
  if (product.systems.length)
    rows.push(['Aparat', product.systems.map((s) => getSystem(s)?.name ?? s).join(', ')]);
  rows.push(['Vrsta', DRINK_KINDS.find((k) => k.slug === product.kind)?.name ?? product.kind]);
  const pack = packLabel(product.packCount, product.packUnit);
  if (pack) rows.push(['Pakovanje', pack]);
  if (product.intensityLevel) {
    rows.push([
      'Jačina',
      <span className="inline-flex items-center gap-2" key="i">
        <IntensityMeter level={product.intensityLevel} />
        {product.intensity && product.intensityMax && (
          <span className="text-xs text-espresso-600/70">
            ({product.intensity}/{product.intensityMax})
          </span>
        )}
      </span>,
    ]);
  }
  if (product.coffeeStyle) rows.push(['Stil', product.coffeeStyle]);
  if (product.flavourNotes.length) rows.push(['Ukus', product.flavourNotes.join(', ')]);
  if (product.dietTags.length) {
    rows.push([
      'Ishrana',
      <ul className="flex flex-wrap gap-1.5" key="d">
        {product.dietTags.map((t) => (
          <li key={t} className="chip">
            {DIET_TAGS[t].name}
          </li>
        ))}
      </ul>,
    ]);
  }
  return (
    <dl className="divide-y divide-espresso-900/10 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[7rem_1fr] gap-3 py-2.5">
          <dt className="text-espresso-600">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function AddToCart({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.lines.find((l) => l.sku === product.sku)?.quantity ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper value={quantity} onChange={setQuantity} label="Količina" />
      <button
        type="button"
        className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8"
        onClick={() => {
          add({ ...product, image: product.images[0] ?? null }, quantity);
          setAdded(true);
          window.setTimeout(() => setAdded(false), 2_000);
        }}
      >
        {added ? (
          <>
            <CheckIcon size={18} /> Dodato u korpu
          </>
        ) : (
          'Dodaj u korpu'
        )}
      </button>
      <p className="w-full text-sm text-espresso-700" aria-live="polite">
        {inCart > 0 && (
          <>
            U korpi: <b>{inCart}</b> ·{' '}
            <Link to="/korpa" className="font-semibold text-roast-600 hover:underline">
              Idi u korpu
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const { data, error, isPending, refetch } = useQuery(productQuery(slug));
  const { data: config } = useQuery(shopConfigQuery);

  if (error instanceof ApiError && error.status === 404) return <NotFound />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Spinner />;

  const { product, related } = data;
  const perUnit = pricePerUnit(product.priceRsd, product.packCount, product.packUnit);
  const system = product.systems[0];
  const description = product.description.split('\n').filter((line) => !/^get yours today/i.test(line));

  return (
    <div className="container-page py-8">
      <title>{`${product.brand} ${product.name} | Kafe za Vas`}</title>
      <meta
        name="description"
        content={`${product.brand} ${product.name} — ${packLabel(product.packCount, product.packUnit) ?? ''}, ${formatRsd(product.priceRsd)}.`}
      />

      <nav aria-label="Putanja" className="mb-6 text-sm text-espresso-600">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/prodavnica" className="hover:underline">
              Prodavnica
            </Link>
          </li>
          <ChevronRightIcon size={14} aria-hidden="true" />
          <li>
            <Link to={`/prodavnica?kategorija=${product.category}`} className="hover:underline">
              {categoryName(product.category)}
            </Link>
          </li>
          {system && (
            <>
              <ChevronRightIcon size={14} aria-hidden="true" />
              <li>
                <Link
                  to={`/prodavnica?kategorija=${product.category}&sistem=${system}`}
                  className="hover:underline"
                >
                  {getSystem(system)?.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <Gallery product={product} />

        <div>
          <p className="text-sm font-bold tracking-[0.14em] text-roast-600 uppercase">
            <Link to={`/prodavnica?brend=${encodeURIComponent(product.brand)}`} className="hover:underline">
              {product.brand}
            </Link>
          </p>
          <h1 className="mt-1 text-4xl leading-tight font-extrabold uppercase sm:text-5xl">{product.name}</h1>
          {product.inStock && (
            <p className="mt-3 flex items-center gap-2">
              <BrushText className="text-3xl">Odmah dostupno!</BrushText>
              <HeartDoodle className="size-8 text-roast-400" />
            </p>
          )}
          {product.rating !== null && product.reviewCount > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-espresso-700">
              <StarIcon size={16} className="text-roast-400" />
              <b>{product.rating.toFixed(1)}</b> / 5 · {product.reviewCount} ocena kupaca
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-1">
            <Price priceRsd={product.priceRsd} size="lg" />
            {perUnit && (
              <span className="pb-1 text-sm text-espresso-600">
                {formatRsd(perUnit)} po {PER_UNIT[product.packUnit ?? 'kom'] ?? 'komadu'}
              </span>
            )}
          </div>

          <div className="mt-6">
            {!product.inStock ? (
              <p className="rounded-2xl bg-crema-200 p-4 text-sm font-medium">
                Trenutno nije dostupno kod dobavljača. Proverite ponovo za nekoliko dana.
              </p>
            ) : config?.ordersOpen ? (
              <AddToCart product={product} />
            ) : (
              <p className="rounded-2xl bg-crema-200 p-4 text-sm">{config?.closedMessage}</p>
            )}
          </div>

          <p className="mt-5 flex items-start gap-2 text-sm text-espresso-700">
            <TruckIcon size={18} className="mt-0.5 shrink-0 text-roast-500" />
            <span>
              Isporuka za <b>{config?.deliveryEstimate ?? '5–6 nedelja'}</b> od potvrde, plaćanje pouzećem.{' '}
              <Link to="/kako-poruciti" className="font-semibold text-roast-600 hover:underline">
                Kako funkcioniše?
              </Link>
            </span>
          </p>

          <section className="mt-8" aria-labelledby="specs">
            <h2 id="specs" className="mb-2 text-xl font-bold">
              Karakteristike
            </h2>
            <Specs product={product} />
          </section>

          {description.length > 0 && (
            <section className="mt-8" aria-labelledby="desc">
              <h2 id="desc" className="text-xl font-bold">
                Opis proizvođača
              </h2>
              <p className="mt-1 text-xs text-espresso-600/80">Originalni opis na engleskom jeziku.</p>
              <div lang="en" className="mt-3 space-y-2 text-sm leading-relaxed text-espresso-800">
                {description.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="related">
          <h2 id="related" className="mb-5 text-2xl font-bold">
            Možda će vam se dopasti
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {related.slice(0, 4).map((p) => (
              <ProductCard key={p.sku} product={p} ordersOpen={config?.ordersOpen ?? false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
