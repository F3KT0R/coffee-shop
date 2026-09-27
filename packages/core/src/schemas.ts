import { z } from 'zod';
import { CATEGORIES, DIET_TAGS, DRINK_KINDS, SORT_OPTIONS, type DietTag } from './catalog.js';
import { CART_LIMITS } from './cart.js';
import { ORDER_STATUSES } from './orders.js';

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const kindSlugs = DRINK_KINDS.map((k) => k.slug) as [string, ...string[]];
const sortValues = SORT_OPTIONS.map((s) => s.value) as [string, ...string[]];

/** "a,b,c" query-string lists restricted to known values; blank entries dropped. */
const csv = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .max(300)
    .transform((value) =>
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values)).max(20));

export const productQuerySchema = z.object({
  category: z.enum(categorySlugs).optional(),
  system: z.string().max(40).optional(),
  brand: z.string().max(80).optional(),
  kind: z.enum(kindSlugs).optional(),
  diet: csv(Object.keys(DIET_TAGS) as [DietTag, ...DietTag[]]).optional(),
  intensity: csv(['1', '2', '3', '4', '5']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(sortValues).default('popular'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type ProductQuery = z.output<typeof productQuerySchema>;

export const cartLinesSchema = z
  .array(
    z.object({
      sku: z.string().trim().min(1).max(40),
      quantity: z.number().int().min(1).max(999),
    }),
  )
  .min(1, 'Korpa je prazna.')
  .max(CART_LIMITS.maxLines);

export const cartQuoteSchema = z.object({ items: cartLinesSchema });

/** Serbian phone number, accepted with spaces, dashes, slashes or a +381 prefix. Stored as +381... */
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-/().]/g, ''))
  .transform((value) => (value.startsWith('00381') ? `+${value.slice(2)}` : value))
  .transform((value) => (value.startsWith('0') ? `+381${value.slice(1)}` : value))
  .pipe(z.string().regex(/^\+381\d{8,10}$/, 'Unesite ispravan broj telefona, npr. 064 123 4567.'));

export const customerSchema = z.object({
  fullName: z.string().trim().min(3, 'Unesite ime i prezime.').max(80),
  email: z.string().trim().pipe(z.email('Unesite ispravnu email adresu.').max(120)),
  phone: phoneSchema,
  address: z.string().trim().min(5, 'Unesite ulicu i broj.').max(120),
  city: z.string().trim().min(2, 'Unesite mesto.').max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Poštanski broj ima 5 cifara.'),
  note: z.string().trim().max(500).optional().default(''),
});
export type CustomerInput = z.input<typeof customerSchema>;
export type Customer = z.output<typeof customerSchema>;

export const checkoutSchema = z.object({
  customer: customerSchema,
  items: cartLinesSchema,
  acceptTerms: z.literal(true, 'Potrebno je da prihvatite uslove kupovine.'),
  /** Honeypot: hidden from people, filled in by naive bots. Must stay empty. */
  website: z.string().max(0).optional(),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const loyaltyLookupSchema = z.object({ email: z.string().trim().pipe(z.email().max(120)) });

/** Owner-entered Instagram handle for an order; an empty string clears it. */
export const instagramHandleSchema = z.object({ handle: z.string().trim().max(200) });

export const adminLoginSchema = z.object({ password: z.string().min(1).max(200) });

export const orderStatusUpdateSchema = z.object({
  status: z.enum(
    Object.keys(ORDER_STATUSES) as [keyof typeof ORDER_STATUSES, ...(keyof typeof ORDER_STATUSES)[]],
  ),
  note: z.string().trim().max(500).optional(),
});

export const adminOrdersQuerySchema = z.object({
  status: z.enum(Object.keys(ORDER_STATUSES) as [string, ...string[]]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
