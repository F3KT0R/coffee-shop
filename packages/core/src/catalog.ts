import type { SystemSlug } from './systems.js';

/** Shop sections. Everything else KaffeK sells (beans, machines, accessories...) is not synced. */
export const CATEGORIES = [
  { slug: 'kapsule', name: 'Kapsule', description: 'Kapsule i jastučići za sve popularne aparate' },
  { slug: 'caj', name: 'Čajevi', description: 'Biljni, crni i začinski čajevi u kesicama i prahu' },
  { slug: 'sirupi', name: 'Sirupi', description: 'Sirupi za kafu -- karamela, vanila, lešnik i drugi' },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

/** What ends up in the cup -- a facet within capsules (a Dolce Gusto shelf holds coffee, tea and cocoa). */
export const DRINK_KINDS = [
  { slug: 'kafa', name: 'Kafa' },
  { slug: 'caj', name: 'Čaj' },
  { slug: 'cokolada', name: 'Čokolada i kakao' },
  { slug: 'ledena-kafa', name: 'Ledena kafa' },
  { slug: 'sirup', name: 'Sirup' },
] as const;
export type DrinkKind = (typeof DRINK_KINDS)[number]['slug'];

/** KaffeK's dietary tags, translated. Keys are stable identifiers stored in the database. */
export const DIET_TAGS = {
  'dairy-free': { kaffek: 'Dairy-free', name: 'Bez mlečnih proizvoda' },
  'lactose-free': { kaffek: 'Lactose-free', name: 'Bez laktoze' },
  'gluten-free': { kaffek: 'Gluten-free', name: 'Bez glutena' },
  'nut-free': { kaffek: 'Nut-free', name: 'Bez orašastih plodova' },
  'soya-free': { kaffek: 'Soya-free', name: 'Bez soje' },
  'egg-free': { kaffek: 'Egg-free', name: 'Bez jaja' },
  'additive-free': { kaffek: 'Additive-free', name: 'Bez aditiva' },
  'sulphite-free': { kaffek: 'Sulphite-free', name: 'Bez sulfita' },
  'sugar-free': { kaffek: 'Sugar-free', name: 'Bez šećera' },
  vegan: { kaffek: 'Vegan', name: 'Veganski' },
  organic: { kaffek: 'Organic', name: 'Organski' },
  decaf: { kaffek: 'Decaffeinated', name: 'Bez kofeina' },
} as const;
export type DietTag = keyof typeof DIET_TAGS;

/** Flavour tags worth showing as tasting notes. Unlisted KaffeK tags (occasions, moods...) are dropped. */
export const FLAVOUR_NOTES: Readonly<Record<string, string>> = {
  Nutty: 'Orašasto',
  Hazelnut: 'Lešnik',
  Sweet: 'Slatko',
  Creamy: 'Kremasto',
  Caramel: 'Karamela',
  Chocolate: 'Čokolada',
  Chocolatey: 'Čokolada',
  Vanilla: 'Vanila',
  Fruity: 'Voćno',
  Floral: 'Cvetno',
  Spicy: 'Začinsko',
  Bitter: 'Gorko',
  Acidic: 'Kiselkasto',
  Roasted: 'Prženo',
  Smoky: 'Dimljeno',
  Honey: 'Med',
  Almond: 'Badem',
  Cinnamon: 'Cimet',
  Coconut: 'Kokos',
  Mint: 'Menta',
  Berries: 'Bobičasto voće',
  Citrus: 'Citrusi',
  Malty: 'Sladno',
  Toffee: 'Tofi',
  Biscuit: 'Keks',
};

/** Normalised strength, derived from KaffeK's intensity label (their numeric scales differ per brand). */
export const INTENSITY_LEVELS = [
  { level: 1, name: 'Vrlo blaga', kaffek: 'Very light' },
  { level: 2, name: 'Blaga', kaffek: 'Light' },
  { level: 3, name: 'Srednja', kaffek: 'Medium' },
  { level: 4, name: 'Jaka', kaffek: 'Strong' },
  { level: 5, name: 'Vrlo jaka', kaffek: 'Very strong' },
] as const;
export type IntensityLevel = (typeof INTENSITY_LEVELS)[number]['level'];

export const COFFEE_STYLES: Readonly<Record<string, string>> = {
  Espresso: 'Espresso',
  Lungo: 'Lungo',
  Ristretto: 'Ristretto',
  Americano: 'Americano',
  'Black coffee': 'Crna kafa',
  Cappuccino: 'Kapućino',
  Latte: 'Late',
  Macchiato: 'Makijato',
  'White coffee': 'Bela kafa',
  'Café au lait': 'Kafa sa mlekom',
  Grande: 'Grande',
  Cortado: 'Kortado',
  'Flat white': 'Flet vajt',
  Mocha: 'Moka',
};

/** Unit of the pack count: 16 *kapsula*, 17 *kesica*, 200 *ml*... */
export type PackUnit = 'kapsula' | 'jastučića' | 'kesica' | 'ml' | 'g' | 'kom';

/** Product as stored and served by the API. Prices are whole RSD. */
export interface Product {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  kind: DrinkKind;
  systems: SystemSlug[];
  packCount: number | null;
  packUnit: PackUnit | null;
  /** Raw intensity on the brand's own scale (see `intensityMax`), e.g. 8 of 13. */
  intensity: number | null;
  intensityMax: number | null;
  intensityLevel: IntensityLevel | null;
  coffeeStyle: string | null;
  dietTags: DietTag[];
  flavourNotes: string[];
  description: string;
  images: string[];
  priceRsd: number;
  inStock: boolean;
  /** 0-5 stars, one decimal. */
  rating: number | null;
  reviewCount: number;
  sourceUrl: string;
}

/** Slim shape for listings. */
export type ProductSummary = Pick<
  Product,
  | 'sku'
  | 'slug'
  | 'name'
  | 'brand'
  | 'category'
  | 'kind'
  | 'systems'
  | 'packCount'
  | 'packUnit'
  | 'intensityLevel'
  | 'priceRsd'
  | 'inStock'
  | 'rating'
  | 'reviewCount'
> & { image: string | null };

export const SORT_OPTIONS = [
  { value: 'popular', name: 'Najpopularnije' },
  { value: 'price-asc', name: 'Cena: od najniže' },
  { value: 'price-desc', name: 'Cena: od najviše' },
  { value: 'rating', name: 'Najbolje ocenjeno' },
  { value: 'name', name: 'Naziv A-Š' },
  { value: 'newest', name: 'Najnovije' },
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function intensityName(level: number | null): string | null {
  return INTENSITY_LEVELS.find((l) => l.level === level)?.name ?? null;
}

/** "16 kapsula", "200 ml" */
export function packLabel(count: number | null, unit: PackUnit | null): string | null {
  if (!count || !unit) return null;
  return `${count} ${unit}`;
}

/** Price per cup/pod/bag, only meaningful for counted units. */
export function pricePerUnit(priceRsd: number, count: number | null, unit: PackUnit | null): number | null {
  if (!count || count <= 0 || unit === 'ml' || unit === 'g' || unit === null) return null;
  return Math.round(priceRsd / count);
}
