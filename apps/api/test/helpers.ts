import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { KaffekItem } from '@kafeshop/core';
import { buildApp, type App } from '../src/app.js';
import { createDb, type Db } from '../src/db.js';
import { loadEnv, type Env } from '../src/env.js';
import type { MailMessage, Mailer } from '../src/mail/mailer.js';

const here = dirname(fileURLToPath(import.meta.url));

/** Real KaffeK items captured with the production query (shared with the core tests). */
export const fixtureItems: Record<string, KaffekItem> = JSON.parse(
  readFileSync(resolve(here, '../../../packages/core/test/fixtures/kaffek-items.json'), 'utf8'),
);

export interface TestDb {
  db: Db;
  url: string;
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** In-memory Postgres (PGlite) with the real migrations applied, reachable over the wire protocol. */
export async function startTestDb(): Promise<TestDb> {
  const pg = await PGlite.create();
  const migrationsDir = resolve(here, '../prisma/migrations');
  for (const dir of readdirSync(migrationsDir)
    .filter((d) => /^\d+_/.test(d))
    .sort()) {
    await pg.exec(readFileSync(resolve(migrationsDir, dir, 'migration.sql'), 'utf8'));
  }
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const server = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  const db = createDb(url, 1); // PGlite: one engine, so one connection (see createDb)
  return {
    db,
    url,
    async reset() {
      await db.$executeRawUnsafe(
        'TRUNCATE "OrderEvent", "OrderLine", "Order", "Product", "SyncRun", "ExchangeRate" RESTART IDENTITY CASCADE',
      );
    },
    async stop() {
      await db.$disconnect();
      await server.stop();
      await pg.close();
    },
  };
}

export const TEST_SECRETS = {
  ADMIN_PASSWORD: 'correct-horse-battery',
  SESSION_SECRET: 'x'.repeat(40),
  SYNC_SECRET: 'sync-secret-for-tests',
};

export function testEnv(url: string, overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: url,
    PUBLIC_SITE_URL: 'https://shop.test',
    ADMIN_EMAIL: 'owner@shop.test',
    AUTO_SYNC_HOURS: '0',
    ...TEST_SECRETS,
    ...overrides,
  });
}

export class RecordingMailer implements Mailer {
  readonly enabled = true;
  readonly sent: MailMessage[] = [];
  failNext = false;
  async send(message: MailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SMTP down');
    }
    this.sent.push(message);
  }
}

export interface FakeSource {
  items: KaffekItem[];
  /** What the source claims its catalog size is (defaults to items.length). */
  totalCount?: number;
  otpSellRate?: number | null;
  requests: string[];
}

/** Fake upstream: KaffeK GraphQL (paged) and OTP banka rates, from in-memory data. */
export function fakeFetch(source: FakeSource): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    source.requests.push(url);
    if (url.startsWith('https://kaffek.co.uk/graphql')) {
      const { variables } = JSON.parse(String(init?.body)) as {
        variables: { page: number; pageSize: number };
      };
      const start = (variables.page - 1) * variables.pageSize;
      const totalCount = source.totalCount ?? source.items.length;
      return Response.json({
        data: {
          products: {
            total_count: totalCount,
            page_info: {
              current_page: variables.page,
              total_pages: Math.max(1, Math.ceil(totalCount / variables.pageSize)),
            },
            items: source.items.slice(start, start + variables.pageSize),
          },
        },
      });
    }
    if (url.startsWith('https://www.otpbanka.rs/')) {
      if (!source.otpSellRate) return new Response('down', { status: 503 });
      return Response.json({
        success: true,
        content: {
          rate: `<tr><td>EUR</td><td>1</td><td>116.0</td><td>117.2</td><td>118.4</td><td>1</td></tr>
<tr><td>GBP</td><td><i class="flag gb"></i></td><td>Funta</td><td>132.0</td><td>136.0</td><td>${source.otpSellRate}</td><td>1</td></tr>`,
        },
      });
    }
    if (url.startsWith('https://open.er-api.com/')) return new Response('down', { status: 503 });
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as typeof fetch;
}

export async function createTestApp(
  testDb: TestDb,
  options: { source?: FakeSource; env?: Record<string, string>; mailer?: RecordingMailer } = {},
): Promise<App & { mailer: RecordingMailer; source: FakeSource }> {
  const source = options.source ?? { items: Object.values(fixtureItems), otpSellRate: 140, requests: [] };
  const mailer = options.mailer ?? new RecordingMailer();
  const built = await buildApp({
    env: testEnv(testDb.url, options.env),
    db: testDb.db,
    mailer,
    fetch: fakeFetch(source),
    logger: false,
    syncPageDelayMs: 0,
  });
  return { ...built, mailer, source };
}

/** Runs a sync to completion through the service and returns the recorded run. */
export async function syncNow(app: App) {
  const { run } = await app.sync.start('test');
  if (!run) throw new Error('sync did not start');
  return run;
}

/** Lets fire-and-forget work (order emails) finish. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 150));
