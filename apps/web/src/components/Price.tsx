import { formatRsd } from '@kafeshop/core';

export function Price({ priceRsd, size = 'md' }: { priceRsd: number; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`${size === 'lg' ? 'text-3xl' : 'text-base'} font-extrabold text-espresso-900 tabular-nums`}
    >
      {formatRsd(priceRsd)}
    </span>
  );
}
