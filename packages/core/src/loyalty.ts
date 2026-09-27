/**
 * "Kafe klub" -- rewards returning customers without accounts or passwords.
 *
 * A customer is recognised by their email address. Every order that was picked up and paid (DELIVERED)
 * counts; cancelled or unclaimed parcels don't. The tier is applied automatically at checkout as a
 * percentage discount on the goods (never on postage).
 */
export interface LoyaltyTier {
  id: string;
  name: string;
  /** Picked-up orders needed to reach this tier. */
  minOrders: number;
  discountPercent: number;
}

export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { id: 'stalni-gost', name: 'Stalni gost', minOrders: 2, discountPercent: 5 },
  { id: 'ljubitelj-kafe', name: 'Ljubitelj kafe', minOrders: 5, discountPercent: 8 },
  { id: 'kafe-vip', name: 'Kafe VIP', minOrders: 10, discountPercent: 10 },
];

export interface LoyaltyStatus {
  completedOrders: number;
  tier: LoyaltyTier | null;
  next: (LoyaltyTier & { ordersNeeded: number }) | null;
}

export function loyaltyStatus(completedOrders: number): LoyaltyStatus {
  const reached = LOYALTY_TIERS.filter((t) => completedOrders >= t.minOrders);
  const tier = reached.at(-1) ?? null;
  const upcoming = LOYALTY_TIERS.find((t) => completedOrders < t.minOrders);
  return {
    completedOrders,
    tier,
    next: upcoming ? { ...upcoming, ordersNeeded: upcoming.minOrders - completedOrders } : null,
  };
}

/** Discount in RSD, rounded down to 10 dinars so totals stay round. */
export function loyaltyDiscountRsd(subtotalRsd: number, discountPercent: number): number {
  if (discountPercent <= 0 || subtotalRsd <= 0) return 0;
  return Math.floor((subtotalRsd * discountPercent) / 100 / 10) * 10;
}

/** The key customers are recognised by. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
