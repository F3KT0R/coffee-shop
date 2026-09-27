# Kafe za Vas — v2

Online shop for coffee capsules, tea and syrups, sourced from [kaffek.co.uk](https://kaffek.co.uk) and sold
in Serbia in dinars. Customers pre-order without paying anything upfront, send their order number in an
Instagram message to confirm, and pay the courier in cash on delivery. Returning customers get Kafe klub
discounts.

```
Browser ──► Netlify (apps/web, static React app)
               │  /api/* proxied (same origin: no CORS, first-party admin cookie)
               ▼
            Render (apps/api, Fastify) ──► Neon Postgres (Prisma)
               │
               └─ daily sync ──► kaffek.co.uk GraphQL (catalog) + OTP banka (GBP sell rate)
```

## Repository layout

npm workspaces monorepo:

| Path                | What                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/core`     | Pure domain logic shared by API and web: KaffeK mapping, pricing, cart, order rules, Kafe klub, schemas |
| `apps/api`          | Fastify API, Prisma schema/migrations, catalog sync, order emails, admin                                |
| `apps/web`          | Vite + React 19 storefront and admin (React Router, TanStack Query, Zustand, Tailwind CSS 4)            |
| `archive/v1`        | The previous frontend, kept for reference (not built)                                                   |
| `render.yaml`       | Render blueprint for the API                                                                            |
| `netlify.toml`      | Netlify build, `/api` proxy, security headers                                                           |
| `.github/workflows` | CI (format, lint, typecheck, tests, builds) and a backup daily sync trigger                             |

## How it works

**Catalog.** KaffeK runs Magento, whose public GraphQL API returns the entire UK catalog (~1,150 products)
in about 12 requests. The sync keeps capsules for 15 machine systems, tea and syrups (~850 products) and
skips beans, machines, accessories and bundles. Brand, system, pack size, intensity, dietary tags,
stock and sale prices all come from structured data, not HTML scraping.

The sync is built to fail safe:

- One sync at a time; every run is recorded (`SyncRun`) and visible in the admin.
- Prices use OTP banka's GBP **sell** rate → open.er-api mid-rate + 3% → last stored rate. With no rate
  at all the sync fails and yesterday's prices stay; it never prices from a guess.
- Products are only retired when the source listing was complete, and never more than 25% at once.
- Price = (UK **regular** price + weight × £4 transport) × rate × 1.30, at least landed cost + 100 RSD,
  rounded up to the next 50 RSD (all configurable, see `.env.example`). KaffeK sales are never passed on:
  the shop keeps its normal price and the discount is extra profit. Each product and order line also stores
  its landed cost, so the admin shows the estimated profit per order.

The API runs the sync itself every `AUTO_SYNC_HOURS` (default 24). `POST /api/sync` (with `SYNC_SECRET`)
and the GitHub workflow are backups.

**Orders.** The browser sends only SKUs and quantities; the server prices the cart, rejects changed carts
with the exact reasons, and snapshots every line. Checkout is idempotent (retries can't duplicate orders)
and rate-limited. Each order has a private status link. Emails are sent from the server and every
send/failure is logged on the order; a failed email never fails the order.

Statuses: `Primljena → Potvrđena → Poručeno → Poslato → Preuzeto` (or `Otkazano`, also for an unclaimed
parcel). Invalid jumps are refused. The customer is emailed when the order is confirmed, shipped and
cancelled. The owner is emailed for every new order (`ADMIN_EMAIL`), and the admin shows desktop
notifications and a live count of orders waiting for confirmation.

**Payment.** Cash on delivery only: nothing is paid online. Every order gets a short number
(`260927-4821`) that the customer sends in an Instagram message; the owner then confirms the order in the
admin. The courier collects the goods total (minus any Kafe klub discount) plus postage.

**Kafe klub.** No accounts: customers are recognised by email address (case-insensitive). Picked-up orders
(`Preuzeto`) count; cancelled or unclaimed ones don't. From the 2nd picked-up order 5%, from the 5th 8%,
from the 10th 10% (`packages/core/src/loyalty.ts`). Checkout shows the discount as soon as the email is
entered, and the server applies it when the order is created. Admin → Kupci lists customers and tiers.

**Buying at KaffeK (admin → Nabavka).** Lists everything from confirmed orders that hasn't been ordered yet,
summed per product. KaffeK's login is protected by reCAPTCHA, so the server can't fill the KaffeK basket
itself. Instead the page provides a bookmark ("☕ KaffeK korpa"): drag it to the bookmarks bar, open
kaffek.co.uk while logged in, click it, and all items are added to your KaffeK basket through KaffeK's own
add-to-cart. It reports anything KaffeK refuses (e.g. not enough stock). After ordering, "Označi sve kao
poručeno" moves that batch to _Poručeno_.

**Instagram.** "Otvori Instagram" / "Pošalji na Instagramu" open a DM with the shop (`INSTAGRAM_URL`,
default `https://ig.me/m/kafekapsule`). On an order in the admin, paste the buyer's handle or profile link
once ("Instagram kupca"): it is saved for all of that customer's orders, and every order, customer and
shipment then has a "Chat sa @…" button that opens the conversation directly.

**Shipping (admin → Slanje).** Orders marked _Poručeno_ appear here with the shipping address from the
checkout form, the cash-on-delivery amount (_otkupnina_) and the items: copy the address, print labels
(A4, two per row), download a CSV for the courier's bulk import, and mark each order as sent.

**Emails.** HTML emails in the shop's look (`apps/api/src/orders/emails.ts`): a receipt with the order
number, Instagram button, product photos, totals, Kafe klub progress, address and next steps; a status
email on confirmation, shipping and cancellation; and a new-order email for the owner. Header images live
in `apps/web/public/email/` and are loaded from `PUBLIC_SITE_URL`, so they only show once the site is live.

**Catalog-only mode.** Set `ORDERS_OPEN=false` and the shop becomes a
browsable catalog with a banner; checkout is closed on the server too.

## Local development

Requirements: Node 24 (`.nvmrc`). No Docker needed — the local database is PGlite (real Postgres in WASM).

```bash
npm install
npm run build --workspace @kafeshop/core   # the apps import core's build output

cp apps/api/.env.example apps/api/.env     # fill in ADMIN_PASSWORD etc. as needed

npm run dev:db                              # terminal 1: local Postgres on :5433
npm run db:deploy --workspace @kafeshop/api # apply migrations (once, and after pulling new ones)
npm run sync:now --workspace @kafeshop/api  # load the real catalog (~3 min)
npm run dev:api                             # terminal 2: API on :3001
npm run dev:web                             # terminal 3: shop on http://localhost:5173
```

Admin: http://localhost:5173/admin (password = `ADMIN_PASSWORD`).

Checks (same as CI): `npm run check`, then `npm run build`.

Schema changes: edit `apps/api/prisma/schema.prisma`, then
`npm run db:migration --workspace @kafeshop/api -- <name>` and `npm run db:deploy --workspace @kafeshop/api`.
(`prisma migrate dev` needs a shadow database, which PGlite can't provide.)

## Deployment

1. **Database — Neon** (free): create a project in region _Frankfurt_. Copy both connection strings:
   the **pooled** one (host contains `-pooler`) and the **direct** one.
2. **API — Render**: _New → Blueprint_, pick this repository. Render reads `render.yaml` and asks for the
   secrets: `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL` (direct), `ADMIN_PASSWORD` and optionally SMTP.
   `SESSION_SECRET`/`SYNC_SECRET` are generated. `INSTAGRAM_URL` defaults to the @kafekapsule DM.
   Migrations run on every start. The first catalog sync starts ~20 seconds after the first boot.
3. **Web — Netlify**: connect the repository to the existing `kafeshop` site. `netlify.toml` does the
   rest. If the Render service URL differs from `https://kafeshop-api.onrender.com`, update the `/api/*`
   redirect in `netlify.toml`.
4. **Keep-warm (recommended)**: Render's free plan sleeps after 15 idle minutes (first visitor then waits
   ~50 s; the site shows a friendly retry). Create a free [cron-job.org](https://cron-job.org) job:
   `GET https://kafeshop-api.onrender.com/api/ping` every 10 minutes. `/api/ping` never touches the
   database, so it doesn't consume Neon compute hours. Or use Render's paid plan and skip this.
5. **Email (optional)**: Gmail → enable 2-step verification → create an _app password_ → set
   `SMTP_HOST=smtp.gmail.com`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `ADMIN_EMAIL` on Render.
6. **Backup sync (optional)**: add repository secrets `API_URL` and `SYNC_SECRET` for
   `.github/workflows/catalog-sync.yml`.

Health: `GET /api/health` reports database status, product count and whether the catalog is stale (>48 h).

## Configuration

All API settings are documented in [`apps/api/.env.example`](apps/api/.env.example) and validated at boot
— in production the API refuses to start with missing or invalid settings (for example a missing
admin password).

## Previous version

`archive/v1` holds the old frontend (including the uncommitted work that was in progress). The old
`D:\code\coffee-api` project (Netlify Functions + Firestore) is superseded by `apps/api` and can be retired
once v2 is live. Its product endpoint was returning no products, and its brand data was derived from product
names.
