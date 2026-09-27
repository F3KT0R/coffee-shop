import { CART_LIMITS } from '@kafeshop/core';

export function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
}) {
  const max = CART_LIMITS.maxQuantityPerLine;
  return (
    <div
      className="inline-flex items-center rounded-full ring-1 ring-espresso-900/15"
      role="group"
      aria-label={label}
    >
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-lg hover:bg-crema-200 disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Smanji količinu"
      >
        −
      </button>
      <output className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full text-lg hover:bg-crema-200 disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Povećaj količinu"
      >
        +
      </button>
    </div>
  );
}
