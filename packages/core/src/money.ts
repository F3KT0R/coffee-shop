/**
 * Pricing for the Serbian storefront. All customer-facing amounts are whole dinars.
 *
 *   landed cost = (UK price + weight × transport £/kg) × GBP→RSD sell rate
 *   shop price  = landed cost + max(margin %, minimum profit), rounded up to the next 50 RSD
 *
 * The transport term is the owner's own formula for shipping UK → Serbia (kg × 4 × rate).
 */
export interface PricingRules {
  /** RSD per 1 GBP -- the bank's *sell* rate, since that is what buying pounds actually costs. */
  gbpToRsdRate: number;
  /** Profit on top of the landed cost, in percent. */
  marginPercent: number;
  /** Transport from the UK to Serbia, in GBP per kg of shipping weight. */
  transportGbpPerKg: number;
  /** Profit floor per pack, so cheap items are still worth handling. */
  minProfitRsd: number;
  /** Used when the source has no weight for a product. */
  fallbackWeightKg: number;
}

export const DEFAULT_PRICING: Omit<PricingRules, 'gbpToRsdRate'> = {
  marginPercent: 30,
  transportGbpPerKg: 4,
  minProfitRsd: 100,
  fallbackWeightKg: 0.3,
};

/**
 * Rounds *up* to the next 50 or 100 dinars, the price points customers expect in Serbia
 * (620 -> 650, 670 -> 700, 700 -> 700). Rounding up means the rounding never eats into the margin.
 */
export function roundToSerbianPrice(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  // Trim float noise (1050.0000000001) but otherwise round up from the exact amount.
  return Math.ceil(Math.round(amount * 100) / 100 / 50) * 50;
}

function assertRate(rules: PricingRules): void {
  if (!(rules.gbpToRsdRate > 0)) throw new RangeError(`Invalid GBP->RSD rate: ${rules.gbpToRsdRate}`);
}

/** What one pack costs the shop, delivered to Serbia, in RSD (unrounded to 1 dinar). */
export function landedCostRsd(gbp: number, weightKg: number | null, rules: PricingRules): number {
  assertRate(rules);
  if (!Number.isFinite(gbp) || gbp <= 0) return 0;
  const kg = weightKg && weightKg > 0 ? weightKg : rules.fallbackWeightKg;
  return Math.round((gbp + kg * rules.transportGbpPerKg) * rules.gbpToRsdRate);
}

/** The shop's selling price for a pack whose UK list price is `gbp`. */
export function shopPriceRsd(gbp: number, weightKg: number | null, rules: PricingRules): number {
  const cost = landedCostRsd(gbp, weightKg, rules);
  if (cost === 0) return 0;
  const withMargin = cost * (1 + rules.marginPercent / 100);
  return roundToSerbianPrice(Math.max(withMargin, cost + rules.minProfitRsd));
}

const rsdFormatter = new Intl.NumberFormat('sr-Latn-RS', { maximumFractionDigits: 0 });

/** "1.250 RSD" -- Serbian thousands separator, no decimals. */
export function formatRsd(amount: number): string {
  return `${rsdFormatter.format(Math.round(amount))} RSD`;
}
