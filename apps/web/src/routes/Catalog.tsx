import { useQuery } from '@tanstack/react-query';
import {
  CATEGORIES,
  DIET_TAGS,
  DRINK_KINDS,
  SORT_OPTIONS,
  getSystem,
  intensityName,
  type DietTag,
} from '@kafeshop/core';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Filters } from '../components/Filters';
import { CloseIcon, FilterIcon } from '../components/icons';
import { Pagination } from '../components/Pagination';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { EmptyState, ErrorState } from '../components/States';
import { activeFilterCount, paramsFromUrl, withFilter, type UrlFilterKey } from '../lib/catalogParams';
import { metaQuery, productsQuery, shopConfigQuery } from '../lib/queries';

function pageTitle(search: URLSearchParams): string {
  const q = search.get('q');
  if (q) return `Pretraga: „${q}“`;
  const system = search.get('sistem');
  const category = CATEGORIES.find((c) => c.slug === search.get('kategorija'));
  if (system && getSystem(system)) return `Kapsule za ${getSystem(system)!.name}`;
  return category?.name ?? 'Svi proizvodi';
}

/** Removable chips for every active filter. */
function ActiveFilters({
  search,
  onChange,
}: {
  search: URLSearchParams;
  onChange: (next: URLSearchParams) => void;
}) {
  const chips: { key: UrlFilterKey; label: string; value?: string }[] = [];
  const category = search.get('kategorija');
  if (category)
    chips.push({ key: 'kategorija', label: CATEGORIES.find((c) => c.slug === category)?.name ?? category });
  const system = search.get('sistem');
  if (system) chips.push({ key: 'sistem', label: getSystem(system)?.name ?? system });
  const kind = search.get('vrsta');
  if (kind) chips.push({ key: 'vrsta', label: DRINK_KINDS.find((k) => k.slug === kind)?.name ?? kind });
  const brand = search.get('brend');
  if (brand) chips.push({ key: 'brend', label: brand });
  for (const level of (search.get('jacina') ?? '').split(',').filter(Boolean)) {
    chips.push({ key: 'jacina', label: intensityName(Number(level)) ?? level, value: level });
  }
  for (const diet of (search.get('dijeta') ?? '').split(',').filter(Boolean)) {
    chips.push({ key: 'dijeta', label: DIET_TAGS[diet as DietTag]?.name ?? diet, value: diet });
  }
  const q = search.get('q');
  if (q) chips.push({ key: 'q', label: `„${q}“` });
  if (chips.length === 0) return null;

  const removeChip = (chip: (typeof chips)[number]) => {
    if (!chip.value) return onChange(withFilter(search, chip.key, null));
    const rest = (search.get(chip.key) ?? '').split(',').filter((v) => v && v !== chip.value);
    onChange(withFilter(search, chip.key, rest.length ? rest.join(',') : null));
  };

  return (
    <ul className="mb-5 flex flex-wrap gap-2" aria-label="Aktivni filteri">
      {chips.map((chip) => (
        <li key={`${chip.key}-${chip.value ?? ''}`}>
          <button
            type="button"
            className="chip gap-1.5 py-1.5 pr-2 hover:bg-crema-300"
            onClick={() => removeChip(chip)}
          >
            {chip.label}
            <CloseIcon size={14} aria-label="Ukloni" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className="px-2 py-1.5 text-xs font-semibold text-roast-600 hover:underline"
          onClick={() => onChange(new URLSearchParams())}
        >
          Očisti sve
        </button>
      </li>
    </ul>
  );
}

export function Catalog() {
  const [search, setSearch] = useSearchParams();
  const params = paramsFromUrl(search);
  const products = useQuery(productsQuery(params));
  const meta = useQuery(metaQuery({ category: params.category, system: params.system }));
  const { data: config } = useQuery(shopConfigQuery);
  const filtersDialog = useRef<HTMLDialogElement>(null);
  const filterCount = activeFilterCount(search);

  const update = (next: URLSearchParams) => {
    setSearch(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const title = pageTitle(search);

  return (
    <div className="container-page py-8">
      <title>{`${title} | Kafe za Vas`}</title>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-script text-2xl text-roast-500" aria-hidden="true">
            naša ponuda
          </p>
          <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
          <p className="mt-1 text-sm text-espresso-700" aria-live="polite">
            {products.data ? `${products.data.total} proizvoda` : ' '}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost lg:hidden"
            onClick={() => filtersDialog.current?.showModal()}
          >
            <FilterIcon size={18} /> Filteri{filterCount > 0 && ` (${filterCount})`}
          </button>
          <label className="sr-only" htmlFor="sort">
            Sortiraj
          </label>
          <select
            id="sort"
            className="input w-auto rounded-full py-2 pr-9"
            value={search.get('sort') ?? 'popular'}
            onChange={(e) =>
              update(withFilter(search, 'sort', e.target.value === 'popular' ? null : e.target.value))
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block" aria-label="Filteri">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">
            <Filters meta={meta.data} search={search} onChange={update} />
          </div>
        </aside>

        <dialog
          ref={filtersDialog}
          className="mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-3xl bg-crema-50 p-0 text-espresso-900 lg:hidden"
          aria-label="Filteri"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-espresso-900/10 bg-crema-50 p-4">
            <span className="font-display text-lg font-semibold">Filteri</span>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full hover:bg-crema-200"
              onClick={() => filtersDialog.current?.close()}
              aria-label="Zatvori filtere"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="p-4">
            <Filters meta={meta.data} search={search} onChange={setSearch} />
          </div>
          <div className="sticky bottom-0 border-t border-espresso-900/10 bg-crema-50 p-4">
            <button
              type="button"
              className="btn-primary w-full py-3"
              onClick={() => filtersDialog.current?.close()}
            >
              Prikaži {products.data?.total ?? ''} proizvoda
            </button>
          </div>
        </dialog>

        <section aria-label="Proizvodi">
          <ActiveFilters search={search} onChange={update} />
          {products.error ? (
            <ErrorState error={products.error} onRetry={() => void products.refetch()} />
          ) : products.isPending ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }, (_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.data.items.length === 0 ? (
            <EmptyState title="Nema proizvoda za ove filtere">
              <p>Probajte da uklonite neki filter ili promenite pretragu.</p>
            </EmptyState>
          ) : (
            <>
              <div
                className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-5 md:grid-cols-3 xl:grid-cols-4 ${
                  products.isPlaceholderData ? 'opacity-60' : ''
                }`}
              >
                {products.data.items.map((p) => (
                  <ProductCard key={p.sku} product={p} ordersOpen={config?.ordersOpen ?? false} />
                ))}
              </div>
              <Pagination page={products.data.page} totalPages={products.data.totalPages} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
