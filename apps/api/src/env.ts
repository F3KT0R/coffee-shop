import { z } from 'zod';
import { DEFAULT_PRICING, type PricingRules } from '@kafeshop/core';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

/** Empty strings in .env files mean "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Connection pool size. Must be 1 for the local PGlite database (npm run dev:db). */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),

  /** Public web origin, used for links in emails. */
  PUBLIC_SITE_URL: z.url().default('http://localhost:5173'),

  ADMIN_PASSWORD: optional(z.string().min(12, 'ADMIN_PASSWORD must be at least 12 characters')),
  SESSION_SECRET: optional(z.string().min(32, 'SESSION_SECRET must be at least 32 characters')),
  SYNC_SECRET: optional(z.string().min(16, 'SYNC_SECRET must be at least 16 characters')),

  /** Hours between automatic catalog syncs run by the API process itself. 0 disables the scheduler. */
  AUTO_SYNC_HOURS: z.coerce.number().min(0).max(168).default(24),
  /** Pricing: price = (UK price + kg × TRANSPORT_GBP_PER_KG) × rate × (1 + margin), at least cost + MIN_PROFIT_RSD. */
  PRICE_MARGIN_PERCENT: z.coerce.number().min(0).max(500).default(DEFAULT_PRICING.marginPercent),
  TRANSPORT_GBP_PER_KG: z.coerce.number().min(0).max(100).default(DEFAULT_PRICING.transportGbpPerKg),
  MIN_PROFIT_RSD: z.coerce.number().int().min(0).max(10_000).default(DEFAULT_PRICING.minProfitRsd),
  FALLBACK_WEIGHT_KG: z.coerce.number().min(0).max(20).default(DEFAULT_PRICING.fallbackWeightKg),

  ORDERS_OPEN: bool.default(true),
  ORDERS_CLOSED_MESSAGE: z
    .string()
    .default(
      'Poručivanje je trenutno pauzirano. Katalog možete razgledati, a porudžbine uskoro ponovo primamo.',
    ),
  DELIVERY_ESTIMATE: z.string().default('5–6 nedelja'),
  POSTAGE_NOTE: z.string().default('Poštarinu (oko 500–750 RSD) plaćate kuriru pri preuzimanju paketa.'),

  /** Instagram profile or DM link where customers send their order number (shown on the order page). */
  INSTAGRAM_URL: z.url().default('https://ig.me/m/kafekapsule'),

  /**
   * Gmail relay: a Google Apps Script web app (apps/api/mail-relay/Code.gs) that sends from the owner's
   * Gmail over HTTPS. Preferred on Render's free plan, which blocks outbound SMTP ports.
   */
  MAIL_RELAY_URL: optional(z.url()),
  MAIL_RELAY_SECRET: optional(z.string().min(24, 'use at least 24 random characters')),
  /** Sender name shown to customers (the address is the Gmail account that runs the relay). */
  MAIL_FROM_NAME: z.string().default('Kafe za Vas'),

  /** Plain SMTP (e.g. smtp.gmail.com with an app password) -- only usable on a paid Render instance. */
  SMTP_HOST: optional(z.string()),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: optional(z.string()),
  SMTP_PASS: optional(z.string()),
  MAIL_FROM: optional(z.string()),
  /** Receives new-order notifications. */
  ADMIN_EMAIL: optional(z.email()),
});

export type Env = z.output<typeof envSchema>;

/** Settings the shop cannot take orders without, in production. */
const REQUIRED_IN_PRODUCTION = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'SYNC_SECRET'] as const;

export class EnvError extends Error {
  override name = 'EnvError';
}

/** Validates the environment once at boot and fails fast with every problem listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new EnvError(`Invalid environment configuration:\n${problems}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => env[key] === undefined);
    if (missing.length > 0) throw new EnvError(`Missing required production settings: ${missing.join(', ')}`);
  }
  return env;
}

export function mailRelayConfigured(env: Env): boolean {
  return !!(env.MAIL_RELAY_URL && env.MAIL_RELAY_SECRET);
}

export function mailConfigured(env: Env): boolean {
  return mailRelayConfigured(env) || !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM);
}

/** Pricing rules from the environment; the exchange rate is added per sync. */
export function pricingSettings(env: Env): Omit<PricingRules, 'gbpToRsdRate'> {
  return {
    marginPercent: env.PRICE_MARGIN_PERCENT,
    transportGbpPerKg: env.TRANSPORT_GBP_PER_KG,
    minProfitRsd: env.MIN_PROFIT_RSD,
    fallbackWeightKg: env.FALLBACK_WEIGHT_KG,
  };
}
