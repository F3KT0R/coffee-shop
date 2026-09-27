import { intensityName } from '@kafeshop/core';

/** Five beans, filled up to the normalised strength level. */
export function IntensityMeter({ level, compact = false }: { level: number | null; compact?: boolean }) {
  const name = intensityName(level);
  if (!level || !name) return null;
  return (
    <span className="inline-flex items-center gap-1.5" title={`Jačina: ${name}`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-2.5 w-1.5 rounded-full ${n <= level ? 'bg-espresso-800' : 'bg-espresso-900/15'}`}
          />
        ))}
      </span>
      <span className={compact ? 'sr-only' : 'text-xs text-espresso-700'}>{name}</span>
    </span>
  );
}
