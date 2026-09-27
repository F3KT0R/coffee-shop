import { Link } from 'react-router';
import { useCart } from '../lib/cart';
import { CART_LIMITS, getSystem, packLabel, type ProductSummary } from '@kafeshop/core';
import { CartIcon, StarIcon } from './icons';
import { IntensityMeter } from './IntensityMeter';
import { Price } from './Price';
import { ProductImage } from './ProductImage';

export function ProductCard({ product, ordersOpen }: { product: ProductSummary; ordersOpen: boolean }) {
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const inCart = useCart((s) => s.lines.find((l) => l.sku === product.sku)?.quantity ?? 0);
  const system = product.systems[0] ? getSystem(product.systems[0])?.name : null;
  const pack = packLabel(product.packCount, product.packUnit);

  return (
    <article className="card group relative flex flex-col overflow-hidden p-2 transition hover:-translate-y-0.5 hover:shadow-(--shadow-lift)">
      {/* Packshots are on white; a soft white "plate" on the cream card keeps them looking intentional. */}
      <div className="relative aspect-square rounded-[1.1rem] bg-white p-4">
        <ProductImage
          src={product.image}
          alt=""
          className="size-full object-contain transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute top-2 left-1 flex flex-col items-start gap-1.5">
          {!product.inStock && <span className="chip bg-espresso-900/85 text-crema-100">Nema na stanju</span>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-2.5 pt-3 pb-2">
        <p className="text-[0.7rem] font-bold tracking-[0.12em] text-roast-600 uppercase">
          {product.brand}
          {system && <span className="text-espresso-600/60"> · {system}</span>}
        </p>
        <h3 className="font-display text-[1.05rem] leading-snug font-bold text-espresso-900">
          {/* The whole card is clickable through this link's pseudo-element. */}
          <Link
            to={`/proizvod/${product.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-espresso-700">
          {pack && <span>{pack}</span>}
          <IntensityMeter level={product.intensityLevel} compact />
          {product.rating !== null && product.reviewCount > 0 && (
            <span className="inline-flex items-center gap-0.5" title={`${product.reviewCount} ocena`}>
              <StarIcon size={13} className="text-roast-400" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div className="mt-auto pt-2">
          <Price priceRsd={product.priceRsd} />
        </div>
        {ordersOpen && product.inStock && (
          // Above the card-wide link (z-10), so these controls stay clickable.
          <div className="relative z-10 mt-2">
            {inCart === 0 ? (
              <button
                type="button"
                onClick={() => add(product)}
                className="btn-primary w-full py-2.5"
                aria-label={`Dodaj ${product.name} u korpu`}
              >
                <CartIcon size={17} /> Dodaj u korpu
              </button>
            ) : (
              <div
                className="flex items-center justify-between rounded-full bg-espresso-900 p-1 text-crema-100"
                role="group"
                aria-label={`Količina u korpi: ${product.name}`}
              >
                <button
                  type="button"
                  onClick={() => setQuantity(product.sku, inCart - 1)}
                  className="grid size-9 place-items-center rounded-full text-lg font-bold hover:bg-white/15"
                  aria-label={inCart === 1 ? `Ukloni ${product.name} iz korpe` : 'Smanji količinu'}
                >
                  −
                </button>
                <output className="text-sm font-bold tabular-nums" aria-live="polite">
                  {inCart} u korpi
                </output>
                <button
                  type="button"
                  onClick={() => setQuantity(product.sku, inCart + 1)}
                  disabled={inCart >= CART_LIMITS.maxQuantityPerLine}
                  className="grid size-9 place-items-center rounded-full text-lg font-bold hover:bg-white/15 disabled:opacity-40"
                  aria-label="Povećaj količinu"
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden p-2" aria-hidden="true">
      <div className="aspect-square animate-pulse rounded-[1.1rem] bg-crema-100" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-crema-200" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-crema-200" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-crema-200" />
      </div>
    </div>
  );
}
