import {
  COFFEE_STYLES,
  DIET_TAGS,
  FLAVOUR_NOTES,
  INTENSITY_LEVELS,
  type CategorySlug,
  type DietTag,
  type DrinkKind,
  type IntensityLevel,
  type PackUnit,
  type Product,
} from '../catalog.js';
import { systemSlugsFromLabels, type SystemSlug } from '../systems.js';
import { htmlToText } from '../text.js';
import { KAFFEK_BASE_URL } from './query.js';
import type { KaffekAttribute, KaffekItem } from './types.js';

/** A source product in shop terms, still priced in GBP. `priceProduct` turns it into RSD. */
export type MappedProduct = Omit<Product, 'priceRsd'> & {
  /** What the source charges right now (the sale price while a sale runs). */
  priceGbp: number;
  /** Pre-discount UK price while the source runs a sale, else null. */
  regularPriceGbp: number | null;
  /** Units sold recently at the source -- drives the "popular" sort. */
  popularity: number;
  stockQuantity: number | null;
  /** Shipping weight in kg, if the source has one. */
  weightKg: number | null;
  /** KaffeK's internal product id (for adding to the KaffeK basket), decoded from `uid`. */
  kaffekId: number | null;
};

// Global in both Node (16+) and browsers; declared here because core is built without DOM types.
declare function atob(data: string): string;

/** Magento product uids are base64 of the numeric entity id ("NDQwMA==" -> 4400). */
export function decodeKaffekId(uid: string | null | undefined): number | null {
  if (!uid) return null;
  try {
    const id = Number(atob(uid));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export type SkipReason =
  | 'not-simple-product'
  | 'unsupported-group'
  | 'missing-attributes'
  | 'missing-identity'
  | 'no-price'
  | 'wrong-currency'
  | 'no-image';

export type MapResult = { ok: true; product: MappedProduct } | { ok: false; sku: string; reason: SkipReason };

/** Attribute values keyed by code; option attributes become label lists with Magento's " " blanks removed. */
function readAttributes(items: readonly KaffekAttribute[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const attribute of items) {
    const values =
      'selected_options' in attribute
        ? (attribute.selected_options ?? []).map((o) => o.label)
        : [attribute.value ?? ''];
    map.set(
      attribute.code,
      values.map((v) => v.trim()).filter((v) => v !== ''),
    );
  }
  return map;
}

function toInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Math.round(Number.parseFloat(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function classify(
  group: string,
  systems: SystemSlug[],
  unit: string,
  text: string,
): { category: CategorySlug; kind: DrinkKind } | null {
  if (systems.length > 0) {
    switch (group) {
      case 'Pods and capsules':
        return { category: 'kapsule', kind: 'kafa' };
      case 'Tea':
        return { category: 'kapsule', kind: 'caj' };
      case 'Cocoa':
      case 'Chocolate':
        return { category: 'kapsule', kind: 'cokolada' };
      case 'Iced coffee':
        return { category: 'kapsule', kind: 'ledena-kafa' };
      default:
        return null;
    }
  }
  if (group === 'Coffee Beans') return { category: 'zrno', kind: 'kafa' };
  if (group === 'Tea' || group === 'Instant Tea') return { category: 'caj', kind: 'caj' };
  if (group === 'Other' && unit === 'ml' && /syrup/i.test(text)) return { category: 'sirupi', kind: 'sirup' };
  return null;
}

function packUnit(measurement: string, systems: SystemSlug[]): PackUnit | null {
  switch (measurement) {
    case 'Capsules':
      return 'kapsula';
    case 'Pods':
      // KaffeK calls soft Senseo/E.S.E. pads "Pods"; Dolce Gusto-style hard pods are "Capsules".
      return systems.some((s) => s === 'senseo' || s === 'ese') ? 'jastučića' : 'kapsula';
    case 'bags':
      return 'kesica';
    case 'ml':
      return 'ml';
    case 'g.':
      return 'g';
    case 'pcs.':
      return 'kom';
    default:
      return null;
  }
}

const dietByLabel = new Map<string, DietTag>(
  Object.entries(DIET_TAGS).map(([key, tag]) => [tag.kaffek.toLowerCase(), key as DietTag]),
);
const intensityByLabel = new Map<string, IntensityLevel>(
  INTENSITY_LEVELS.map((l) => [l.kaffek.toLowerCase(), l.level]),
);

/** Maps one KaffeK item to a shop product, or explains why it is not sold here. Pure and deterministic. */
export function mapKaffekItem(item: KaffekItem): MapResult {
  const sku = item.sku;
  const skip = (reason: SkipReason): MapResult => ({ ok: false, sku, reason });

  // Bundles are multi-product packs with their own pricing rules -- not sold here.
  if (item.__typename !== 'SimpleProduct') return skip('not-simple-product');
  if (!item.custom_attributesV2) return skip('missing-attributes');

  const attrs = readAttributes(item.custom_attributesV2.items);
  const first = (code: string) => attrs.get(code)?.[0];
  const all = (code: string) => attrs.get(code) ?? [];

  const systems = systemSlugsFromLabels(all('capsule_system_compatibility').flatMap((l) => l.split(',')));
  const measurement = first('measurement_unit') ?? '';
  const classification = classify(
    first('product_group') ?? '',
    systems,
    measurement,
    `${item.name ?? ''} ${first('one_liner') ?? ''}`,
  );
  if (!classification) return skip('unsupported-group');

  const name = (first('short_name') ?? item.name ?? '').trim();
  if (!sku || !item.url_key || !name) return skip('missing-identity');

  const prices = item.price_range?.minimum_price;
  const final = prices?.final_price;
  if (!prices || !final?.value || final.value <= 0) return skip('no-price');
  if (final.currency !== 'GBP') return skip('wrong-currency');
  const regular = prices.regular_price.value;

  const images = (item.media_gallery ?? [])
    .filter(
      (m): m is { url: string; position: number | null; disabled: boolean | null } => !!m.url && !m.disabled,
    )
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((m) => m.url);
  if (images.length === 0) return skip('no-image');

  const tags = all('tags');
  const dietTags = new Set<DietTag>();
  for (const tag of tags) {
    const diet = dietByLabel.get(tag.toLowerCase());
    if (diet) dietTags.add(diet);
    if (/^decaf/i.test(tag)) dietTags.add('decaf');
  }
  const flavourNotes = [...new Set(tags.map((t) => FLAVOUR_NOTES[t]).filter((n): n is string => !!n))];

  const intensityLevel = intensityByLabel.get((first('intensity_label') ?? '').toLowerCase()) ?? null;
  const style = first('coffee_style');
  const reviewCount = item.review_count ?? 0;
  const ratingPercent = item.rating_summary ?? 0;

  return {
    ok: true,
    product: {
      sku,
      slug: item.url_key,
      name,
      brand: first('brand_name') ?? '',
      category: classification.category,
      kind: classification.kind,
      systems,
      packCount: toInt(first('number_of_units')) ?? toInt(first('cups')),
      packUnit: packUnit(measurement, systems),
      intensity: toInt(first('coffee_intensity')),
      intensityMax: toInt(first('max_coffee_intensity')),
      intensityLevel,
      coffeeStyle: style ? (COFFEE_STYLES[style] ?? null) : null,
      dietTags: [...dietTags].sort(),
      flavourNotes,
      description: htmlToText(item.short_description?.html),
      images,
      priceGbp: final.value,
      regularPriceGbp: regular && regular > final.value + 0.005 ? regular : null,
      weightKg: item.weight && item.weight > 0 ? item.weight : null,
      kaffekId: decodeKaffekId(item.uid),
      inStock: item.stock_status === 'IN_STOCK' && first('is_disabled_for_sale') !== '1',
      stockQuantity: item.quantity ?? null,
      rating: reviewCount > 0 && ratingPercent > 0 ? Math.round(ratingPercent / 2) / 10 : null,
      reviewCount,
      popularity: toInt(first('recently_bought')) ?? 0,
      sourceUrl: `${KAFFEK_BASE_URL}/${item.url_key}.html`,
    },
  };
}
