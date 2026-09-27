import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { CoffeeIcon } from './icons';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Nešto nije u redu. Osvežite stranicu ili pokušajte kasnije.';
  return (
    <div role="alert" className="card mx-auto my-10 max-w-md p-8 text-center">
      <CoffeeIcon size={36} className="mx-auto text-roast-500" />
      <p className="mt-3 font-display text-xl">Ups, zastoj u aparatu</p>
      <p className="mt-2 text-sm text-espresso-700">{message}</p>
      {onRetry && (
        <button type="button" className="btn-primary mt-5" onClick={onRetry}>
          Pokušaj ponovo
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto my-12 max-w-md text-center">
      <CoffeeIcon size={40} className="mx-auto text-espresso-900/25" />
      <p className="mt-3 font-display text-xl">{title}</p>
      {children && <div className="mt-2 text-sm text-espresso-700">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Učitavanje…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-espresso-700" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-espresso-900/20 border-t-roast-500" />
      {label}
    </div>
  );
}
