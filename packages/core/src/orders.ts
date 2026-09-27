/**
 * Order lifecycle. There is no online payment: the customer orders, the shop confirms the order (usually
 * after the customer sends the order number in an Instagram message), the goods are bought from the UK,
 * and the customer pays the courier in cash on delivery (goods + postage).
 */

export const ORDER_STATUSES = {
  NEW: {
    name: 'Primljena',
    description: 'Porudžbina je primljena. Pošaljite nam broj porudžbine u Instagram poruci radi potvrde.',
  },
  CONFIRMED: {
    name: 'Potvrđena',
    description: 'Porudžbina je potvrđena i ulazi u narednu nabavku iz Velike Britanije.',
  },
  ORDERED: { name: 'Poručeno', description: 'Proizvodi su poručeni iz Velike Britanije.' },
  SHIPPED: {
    name: 'Poslato',
    description: 'Paket je predat kurirskoj službi. Plaćanje je pouzećem, pri preuzimanju.',
  },
  DELIVERED: { name: 'Preuzeto', description: 'Paket je preuzet i plaćen. Hvala na kupovini!' },
  CANCELLED: { name: 'Otkazano', description: 'Porudžbina je otkazana.' },
} as const;
export type OrderStatus = keyof typeof ORDER_STATUSES;

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['SHIPPED', 'CANCELLED'],
  // A parcel can come back unclaimed -- with cash on delivery that has to be recordable.
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses of orders still being worked on (for the admin dashboard). */
export const OPEN_STATUSES: readonly OrderStatus[] = ['NEW', 'CONFIRMED', 'ORDERED', 'SHIPPED'];

/**
 * Short, human-friendly order number: YYMMDD + 4 random digits, e.g. "260927-4821". Easy to read out or
 * type into an Instagram message. Uniqueness is enforced by the database; the caller retries on collision.
 */
export function generateOrderNumber(now: Date, random: () => number = Math.random): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const suffix = String(Math.floor(random() * 10_000)).padStart(4, '0');
  return `${yy}${mm}${dd}-${suffix}`;
}
