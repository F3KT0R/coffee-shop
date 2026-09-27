import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../db.js';

/** Plausibility window for RSD per GBP. A value outside it is treated as a parsing/source error. */
const MIN_RATE = 80;
const MAX_RATE = 250;
/** Mid-market rates are converted to an approximate bank sell rate. */
const MID_TO_SELL_SPREAD = 1.03;
/** How old a stored rate may be when every live source is down. */
const MAX_STORED_AGE_DAYS = 14;

export interface ResolvedRate {
  rate: number;
  source: string;
}

const plausible = (rate: number) => Number.isFinite(rate) && rate >= MIN_RATE && rate <= MAX_RATE;

/**
 * Extracts the GBP *sell* rate from OTP banka's rate table HTML. Each currency row holds buy, middle and
 * sell rate followed by the unit ("<td>GBP</td> ... <td>132.3869</td><td>136.4813</td><td>140.5757</td><td>1</td>").
 */
export function parseOtpGbpSellRate(html: string): number | null {
  for (const row of html.split(/<tr[^>]*>/i)) {
    if (!/<td>\s*GBP\s*<\/td>/i.test(row)) continue;
    const numbers = [...row.matchAll(/<td[^>]*>\s*([\d]+(?:\.\d+)?)\s*<\/td>/gi)].map((m) => Number(m[1]));
    if (numbers.length < 4) return null;
    const [, , sell, unit] = numbers.slice(-4) as [number, number, number, number];
    return unit > 0 ? sell / unit : null;
  }
  return null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fromOtp(fetchImpl: typeof fetch, date: Date): Promise<number | null> {
  const response = await fetchImpl(
    `https://www.otpbanka.rs/wp-json/api/v1/exchanges/?date=${isoDate(date)}`,
    {
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return null;
  const json = (await response.json()) as { success?: boolean; content?: { rate?: string } };
  return json.success && json.content?.rate ? parseOtpGbpSellRate(json.content.rate) : null;
}

async function fromOpenErApi(fetchImpl: typeof fetch): Promise<number | null> {
  const response = await fetchImpl('https://open.er-api.com/v6/latest/GBP', {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { result?: string; rates?: { RSD?: number } };
  return json.result === 'success' && json.rates?.RSD ? json.rates.RSD * MID_TO_SELL_SPREAD : null;
}

/**
 * Today's GBP->RSD rate for pricing, from the most authoritative source available:
 * stored today -> OTP banka sell rate (today, then up to 4 days back for weekends/holidays) ->
 * open.er-api mid rate + spread -> the last stored rate (max 14 days old). Throws if none is usable,
 * which fails the sync and keeps yesterday's prices -- never prices from a made-up rate.
 */
export async function resolveGbpRate(deps: {
  db: Db;
  log: FastifyBaseLogger;
  fetch?: typeof fetch;
  now?: Date;
}): Promise<ResolvedRate> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? new Date();
  const today = new Date(`${isoDate(now)}T00:00:00Z`);

  const storedToday = await deps.db.exchangeRate.findFirst({
    where: { date: today },
    orderBy: { fetchedAt: 'desc' },
  });
  if (storedToday && plausible(storedToday.gbpSell))
    return { rate: storedToday.gbpSell, source: storedToday.source };

  const save = async (rate: number, source: string): Promise<ResolvedRate> => {
    await deps.db.exchangeRate.upsert({
      where: { date_source: { date: today, source } },
      create: { date: today, source, gbpSell: rate },
      update: { gbpSell: rate, fetchedAt: new Date() },
    });
    return { rate, source };
  };

  for (let daysBack = 0; daysBack <= 4; daysBack++) {
    const day = new Date(today.getTime() - daysBack * 86_400_000);
    try {
      const rate = await fromOtp(fetchImpl, day);
      if (rate !== null && plausible(rate)) return await save(rate, 'otpbanka');
    } catch (error) {
      deps.log.warn({ err: error, day: isoDate(day) }, 'OTP banka rate lookup failed');
    }
  }

  try {
    const rate = await fromOpenErApi(fetchImpl);
    if (rate !== null && plausible(rate)) return await save(rate, 'open-er-api');
  } catch (error) {
    deps.log.warn({ err: error }, 'open.er-api rate lookup failed');
  }

  const stored = await deps.db.exchangeRate.findFirst({
    where: { date: { gte: new Date(today.getTime() - MAX_STORED_AGE_DAYS * 86_400_000) } },
    orderBy: { date: 'desc' },
  });
  if (stored && plausible(stored.gbpSell)) {
    deps.log.warn({ date: isoDate(stored.date) }, 'Using last stored GBP rate; all live sources failed');
    return { rate: stored.gbpSell, source: `stored:${isoDate(stored.date)}` };
  }
  throw new Error('No usable GBP->RSD exchange rate from any source');
}
