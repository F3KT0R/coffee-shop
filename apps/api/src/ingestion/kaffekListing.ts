import { systemSlugsFromLabels, type SystemSlug } from '@kafeshop/core';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Price and stock refresh from KaffeK's public category pages, which KaffeK agreed we may read. Used when
 * the GraphQL catalog is unavailable: the pages carry price, stock and compatibility per SKU, but not the
 * attributes the importer needs, so they can update existing products and never add new ones.
 */

export interface ListingOffer {
  sku: string;
  priceGbp: number;
  /** The struck-through price while KaffeK runs a sale. */
  regularPriceGbp: number | null;
  inStock: boolean;
  systems: SystemSlug[];
}

export interface ListingPage {
  offers: ListingOffer[];
  /** Products in the whole category, from the page's schema.org data. */
  totalCount: number | null;
}

export interface ListingFetchOptions {
  fetch?: typeof fetch;
  log: FastifyBaseLogger;
  pageDelayMs?: number;
  timeoutMs?: number;
}

export interface ListingCatalog {
  offers: Map<string, ListingOffer>;
  /** Every page of every category was read. */
  complete: boolean;
}

const USER_AGENT = 'KafeZaVasCatalogSync/2.0 (+https://kafeshop.netlify.app)';
const MAX_PAGES = 50;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TileData {
  sku?: string;
  price?: number;
  in_stock?: boolean;
  compatibility?: string;
}

/** Each product tile calls `productDisplayed(id, position, '<JS-escaped JSON>')` for analytics. */
const TILE = /productDisplayed\(\s*(\d+)\s*,\s*\d+\s*,\s*'((?:[^'\\]|\\.)*)'/g;
const LD_JSON = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

export function parseListingPage(html: string): ListingPage {
  const offers: ListingOffer[] = [];
  for (const [, productId, escaped] of html.matchAll(TILE)) {
    let data: TileData;
    try {
      // The argument is a JS string literal holding JSON; its escapes (\uXXXX) are valid JSON escapes too.
      data = JSON.parse(JSON.parse(`"${escaped}"`) as string) as TileData;
    } catch {
      continue;
    }
    if (!data.sku || typeof data.price !== 'number' || !(data.price > 0)) continue;
    offers.push({
      sku: data.sku,
      priceGbp: data.price,
      regularPriceGbp: oldPrice(html, productId!),
      inStock: data.in_stock === true,
      systems: systemSlugsFromLabels((data.compatibility ?? '').split(',')),
    });
  }
  return { offers, totalCount: collectionSize(html) };
}

/** Magento renders a sale's original price as `data-price-type="oldPrice"` inside the product's price box. */
function oldPrice(html: string, productId: string): number | null {
  const start = html.indexOf(`data-price-box="product-id-${productId}"`);
  if (start < 0) return null;
  const end = html.indexOf('data-price-box=', start + 1);
  const box = html.slice(start, end < 0 ? undefined : end);
  const match = /data-price-amount="([\d.]+)"\s+data-price-type="oldPrice"/.exec(box);
  return match ? Number(match[1]) : null;
}

function collectionSize(html: string): number | null {
  for (const [, json] of html.matchAll(LD_JSON)) {
    try {
      const data = JSON.parse(json!) as { '@type'?: string; mainEntity?: { numberOfItems?: number } };
      if (data['@type'] === 'CollectionPage' && typeof data.mainEntity?.numberOfItems === 'number')
        return data.mainEntity.numberOfItems;
    } catch {
      // not ours to fix; the tiles are what matters
    }
  }
  return null;
}

/** Reads every page (`?p=N`) of each category URL. A failed category marks the result incomplete. */
export async function fetchListingCatalog(
  urls: readonly string[],
  options: ListingFetchOptions,
): Promise<ListingCatalog> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const offers = new Map<string, ListingOffer>();
  let complete = true;
  let first = true;

  for (const url of urls) {
    let seen = 0;
    let totalCount: number | null = null;
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (!first) await sleep(options.pageDelayMs ?? 750);
        first = false;
        const pageUrl = page === 1 ? url : `${url}${url.includes('?') ? '&' : '?'}p=${page}`;
        const response = await doFetch(pageUrl, {
          headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} on ${pageUrl}`);
        const parsed = parseListingPage(await response.text());
        totalCount ??= parsed.totalCount;
        for (const offer of parsed.offers) offers.set(offer.sku, offer);
        seen += parsed.offers.length;
        if (parsed.offers.length === 0 || totalCount === null || seen >= totalCount) break;
      }
      if (totalCount === null || seen < totalCount) {
        complete = false;
        options.log.warn({ url, seen, totalCount }, 'KaffeK listing read incompletely');
      }
    } catch (error) {
      complete = false;
      options.log.warn({ url, err: error }, 'KaffeK listing failed');
    }
  }
  return { offers, complete };
}
