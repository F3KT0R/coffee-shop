/**
 * Capsule/pod machine systems. `kaffekLabels` are the exact option labels KaffeK uses in its
 * `capsule_system_compatibility` attribute; a product can list several, comma-separated.
 */
export interface MachineSystem {
  slug: string;
  name: string;
  kaffekLabels: readonly string[];
}

export const SYSTEMS = [
  { slug: 'nespresso', name: 'Nespresso', kaffekLabels: ['Nespresso'] },
  { slug: 'dolce-gusto', name: 'Dolce Gusto', kaffekLabels: ['Dolce Gusto'] },
  { slug: 'tassimo', name: 'Tassimo', kaffekLabels: ['Tassimo'] },
  { slug: 'senseo', name: 'Senseo', kaffekLabels: ['Senseo'] },
  { slug: 'lavazza-a-modo-mio', name: 'Lavazza A Modo Mio', kaffekLabels: ['Lavazza a Modo Mio'] },
  { slug: 'nespresso-vertuo', name: 'Nespresso Vertuo', kaffekLabels: ['Nespresso Vertuo'] },
  { slug: 'nespresso-pro', name: 'Nespresso Pro', kaffekLabels: ['Nespresso Pro'] },
  { slug: 'ese', name: 'E.S.E. pads', kaffekLabels: ['E.S.E.'] },
  { slug: 'caffitaly', name: 'Caffitaly', kaffekLabels: ['Caffitaly'] },
  { slug: 'cremesso', name: 'Cremesso', kaffekLabels: ['Cremesso'] },
  { slug: 'costa-podio', name: 'Costa Podio', kaffekLabels: ['Costa Podio'] },
  { slug: 'illy', name: 'illy Iperespresso', kaffekLabels: ['illy'] },
  { slug: 'lavazza-blue', name: 'Lavazza Blue', kaffekLabels: ['Lavazza Blue'] },
  { slug: 'lor-barista', name: "L'OR Barista", kaffekLabels: ["L'OR BARISTA"] },
  { slug: 'bialetti', name: 'Bialetti', kaffekLabels: ['Bialetti'] },
] as const satisfies readonly MachineSystem[];

export type SystemSlug = (typeof SYSTEMS)[number]['slug'];

const bySlug = new Map<string, MachineSystem>(SYSTEMS.map((s) => [s.slug, s]));
const byLabel = new Map<string, SystemSlug>(
  SYSTEMS.flatMap((s) => s.kaffekLabels.map((label) => [label.toLowerCase(), s.slug] as const)),
);

export function getSystem(slug: string): MachineSystem | undefined {
  return bySlug.get(slug);
}

export function isSystemSlug(value: string): value is SystemSlug {
  return bySlug.has(value);
}

/** Maps KaffeK's (possibly comma-joined) compatibility labels to our system slugs, ignoring unknown ones. */
export function systemSlugsFromLabels(labels: readonly string[]): SystemSlug[] {
  const slugs = new Set<SystemSlug>();
  for (const label of labels) {
    const slug = byLabel.get(label.trim().toLowerCase());
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}
