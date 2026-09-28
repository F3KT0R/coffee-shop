import { formatRsd, type ShipmentWeight } from '@kafeshop/core';
import { useId, useState } from 'react';

const kgFormat = new Intl.NumberFormat('sr-Latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbpFormat = new Intl.NumberFormat('sr-Latn', { style: 'currency', currency: 'GBP' });
const percentFormat = new Intl.NumberFormat('sr-Latn', { maximumFractionDigits: 0 });

const kg = (value: number) => `${kgFormat.format(value)} kg`;

/** Accepts "5,4" as well as "5.4"; returns null for anything that isn't a positive number. */
function parseKg(input: string): number | null {
  const value = Number(input.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Summed KaffeK product weights of a shipment. With `compare`, the owner types the weight the
 * courier billed and sees what the outer carton adds, as a share and per box.
 */
export function ShipmentWeightCard({
  weight,
  compare = false,
}: {
  weight: ShipmentWeight;
  compare?: boolean;
}) {
  const inputId = useId();
  const [billed, setBilled] = useState('');
  const { totalKg, boxes, estimatedBoxes, fallbackKg, transportGbpPerKg, gbpRsdRate } = weight;
  const transportGbp = totalKg * transportGbpPerKg;
  const toRsd = (gbp: number) => (gbpRsdRate === null ? null : Math.round(gbp * gbpRsdRate));

  const billedKg = parseKg(billed);
  const extraKg = billedKg === null ? null : billedKg - totalKg;
  const extraRsd = extraKg === null ? null : toRsd(extraKg * transportGbpPerKg);

  return (
    <section className="card mt-6 p-6" aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`} className="text-xl font-bold">
        Težina pošiljke
      </h2>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-espresso-600">Proizvodi po KaffeK-u</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{kg(totalKg)}</dd>
          <dd className="text-xs text-espresso-600">{boxes} kutija, bez spoljne kutije</dd>
        </div>
        <div>
          <dt className="text-sm text-espresso-600">Transport po formuli (kg × £{transportGbpPerKg})</dt>
          <dd className="font-display text-3xl font-bold tabular-nums">{gbpFormat.format(transportGbp)}</dd>
          {toRsd(transportGbp) !== null && (
            <dd className="text-xs text-espresso-600">≈ {formatRsd(toRsd(transportGbp)!)}</dd>
          )}
        </div>
        {compare && (
          <div>
            <dt>
              <label htmlFor={inputId} className="text-sm text-espresso-600">
                Težina sa računa kurira (kg)
              </label>
            </dt>
            <dd>
              <input
                id={inputId}
                className="input mt-1 w-32 tabular-nums"
                inputMode="decimal"
                autoComplete="off"
                placeholder="npr. 5,4"
                value={billed}
                onChange={(e) => setBilled(e.target.value)}
              />
            </dd>
          </div>
        )}
      </dl>

      {estimatedBoxes > 0 && (
        <p className="mt-3 text-xs text-espresso-600">
          Za {estimatedBoxes} kutija KaffeK ne navodi težinu, pa su računate po {kg(fallbackKg)}.
        </p>
      )}

      {compare && extraKg !== null && (
        <p role="status" className="mt-4 rounded-2xl bg-crema-100 p-4 text-sm text-espresso-800">
          {extraKg > 0 ? (
            <>
              Spoljna kutija i punjenje: <b>+{kg(extraKg)}</b> (
              <b>{percentFormat.format((extraKg / totalKg) * 100)}%</b> na težinu proizvoda)
              {extraRsd !== null && boxes > 0 && (
                <>
                  {' '}
                  — oko <b>{formatRsd(extraRsd)}</b> ukupno, odnosno{' '}
                  <b>{formatRsd(Math.round(extraRsd / boxes))}</b> po kutiji
                </>
              )}
              . Zapišite procenat; posle 2–3 pošiljke možemo prosek uračunati u cene.
            </>
          ) : (
            <>
              Račun pokazuje {extraKg === 0 ? 'tačno' : 'manje nego'} koliko proizvodi teže po KaffeK-u —
              proverite unetu težinu.
            </>
          )}
        </p>
      )}
    </section>
  );
}
