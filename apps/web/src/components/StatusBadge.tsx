import { ORDER_STATUSES, type OrderStatus } from '@kafeshop/core';

const STATUS_STYLE: Record<OrderStatus, string> = {
  NEW: 'bg-amber-100 text-amber-900',
  CONFIRMED: 'bg-sky-100 text-sky-900',
  ORDERED: 'bg-indigo-100 text-indigo-900',
  SHIPPED: 'bg-violet-100 text-violet-900',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-stone-200 text-stone-700',
};

export function StatusBadge({ status, className = '' }: { status: OrderStatus; className?: string }) {
  return <span className={`chip ${STATUS_STYLE[status]} ${className}`}>{ORDER_STATUSES[status].name}</span>;
}

/** Status chip used as a filter toggle. */
export function StatusFilterChip({
  status,
  active,
  onClick,
}: {
  status: OrderStatus;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip py-1.5 ${STATUS_STYLE[status]} ${active ? 'ring-2 ring-espresso-900' : ''}`}
    >
      {ORDER_STATUSES[status].name}
    </button>
  );
}
