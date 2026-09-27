import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatRsd, instagramDmUrl, type AdminOrderDetail } from '@kafeshop/core';
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../lib/api';
import type { ShippingAddress } from '../lib/shipping';
import { CheckIcon, CopyIcon, InstagramIcon } from './icons';

/** Opens the direct-message thread with the customer on Instagram. */
export function InstagramChatLink({ handle, compact = false }: { handle: string; compact?: boolean }) {
  return (
    <a
      href={instagramDmUrl(handle)}
      target="_blank"
      rel="noreferrer"
      className={
        compact
          ? 'relative z-10 inline-flex items-center gap-1 text-xs font-bold text-roast-600 hover:underline'
          : 'btn-primary'
      }
      title={`Otvori chat sa @${handle}`}
    >
      <InstagramIcon size={compact ? 14 : 18} /> {compact ? `@${handle}` : `Chat sa @${handle}`}
    </a>
  );
}

export function CopyButton({ text, label = 'Kopiraj' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1_600);
        });
      }}
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} {copied ? 'Kopirano' : label}
    </button>
  );
}

/** Owner enters the customer's Instagram username (or pastes their profile link) once, from the chat. */
export function InstagramHandleCard({ order }: { order: AdminOrderDetail }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!order.instagramHandle);
  const [value, setValue] = useState(order.instagramHandle ? `@${order.instagramHandle}` : '');
  const save = useMutation({
    mutationFn: (handle: string) => api.admin.setInstagram(order.number, handle),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'order', order.number], data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
      setEditing(!data.instagramHandle);
      setValue(data.instagramHandle ? `@${data.instagramHandle}` : '');
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(value);
  }

  const error =
    save.error instanceof ApiError
      ? (save.error.fields.handle ?? save.error.message)
      : save.error
        ? 'Greška.'
        : null;

  return (
    <section className="card p-6 text-sm" aria-labelledby="ig-title">
      <h2 id="ig-title" className="mb-3 flex items-center gap-2 text-lg font-bold">
        <InstagramIcon size={20} /> Instagram kupca
      </h2>
      {order.instagramHandle && !editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <InstagramChatLink handle={order.instagramHandle} />
          <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
            Izmeni
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-2">
          <label htmlFor="ig-handle" className="text-espresso-700">
            Nalog sa kog vam je kupac poslao broj porudžbine — korisničko ime ili link ka profilu.
          </label>
          <div className="flex gap-2">
            <input
              id="ig-handle"
              className="input"
              placeholder="@korisnik ili instagram.com/korisnik"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!error}
              maxLength={200}
            />
            <button type="submit" className="btn-primary shrink-0" disabled={save.isPending || !value.trim()}>
              {save.isPending ? 'Čuvam…' : 'Sačuvaj'}
            </button>
          </div>
          {error && <p className="text-red-700">{error}</p>}
          <p className="text-xs text-espresso-600">
            Čuva se i za ostale porudžbine ovog kupca, pa ga unosite samo jednom.
          </p>
        </form>
      )}
    </section>
  );
}

/** A shipping label: shown on screen and printed on its own (see `.print-sheet` in styles.css). */
export function ShippingLabel({ order }: { order: ShippingAddress }) {
  return (
    <div className="shipping-label rounded-2xl border-2 border-dashed border-espresso-900/30 bg-white p-5 text-espresso-950">
      <p className="text-xs font-bold tracking-[0.12em] text-espresso-600 uppercase">Primalac</p>
      <p className="mt-1 text-lg leading-snug font-extrabold">{order.fullName}</p>
      <p className="text-base leading-snug">
        {order.address}
        <br />
        <b>
          {order.postalCode} {order.city}
        </b>
      </p>
      <p className="mt-1 text-base font-bold tabular-nums">{order.phone}</p>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-espresso-900/15 pt-3">
        <p>
          <span className="block text-xs font-bold tracking-[0.12em] text-espresso-600 uppercase">
            Otkupnina
          </span>
          <span className="text-xl font-extrabold tabular-nums">{formatRsd(order.totalRsd)}</span>
        </p>
        <p className="text-right text-xs text-espresso-600">
          Kafe za Vas
          <br />
          <b className="text-sm text-espresso-900 tabular-nums">{order.number}</b>
        </p>
      </div>
    </div>
  );
}
