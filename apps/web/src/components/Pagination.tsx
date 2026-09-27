import { Link, useSearchParams } from 'react-router';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/** Page links (real URLs, so they work without JS state and can be shared). */
export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const [search] = useSearchParams();
  if (totalPages <= 1) return null;

  const hrefFor = (p: number) => {
    const next = new URLSearchParams(search);
    if (p <= 1) next.delete('strana');
    else next.set('strana', String(p));
    const text = next.toString();
    return text ? `?${text}` : '?';
  };

  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  return (
    <nav aria-label="Stranice" className="mt-10 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link
          to={hrefFor(page - 1)}
          className="grid size-10 place-items-center rounded-full hover:bg-crema-200"
          aria-label="Prethodna strana"
        >
          <ChevronLeftIcon />
        </Link>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center">
          {i > 0 && p - sorted[i - 1]! > 1 && <span className="px-1 text-espresso-600/60">…</span>}
          <Link
            to={hrefFor(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`grid size-10 place-items-center rounded-full text-sm font-semibold tabular-nums ${
              p === page ? 'bg-espresso-900 text-crema-100' : 'hover:bg-crema-200'
            }`}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link
          to={hrefFor(page + 1)}
          className="grid size-10 place-items-center rounded-full hover:bg-crema-200"
          aria-label="Sledeća strana"
        >
          <ChevronRightIcon />
        </Link>
      )}
    </nav>
  );
}
