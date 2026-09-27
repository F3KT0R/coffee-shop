import { DIET_TAGS, INTENSITY_LEVELS, type CatalogMetaResponse, type FacetCount } from '@kafeshop/core';
import { useId, useState } from 'react';
import { toggleListValue, withFilter, type UrlFilterKey } from '../lib/catalogParams';

interface FiltersProps {
  meta: CatalogMetaResponse | undefined;
  search: URLSearchParams;
  onChange: (next: URLSearchParams) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <fieldset className="border-b border-espresso-900/10 py-5 first:pt-0 last:border-0" aria-labelledby={id}>
      <legend id={id} className="mb-3 text-sm font-semibold text-espresso-900">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function RadioList({
  name,
  options,
  value,
  onSelect,
  allLabel,
  limit,
}: {
  name: string;
  options: FacetCount[];
  value: string | null;
  onSelect: (value: string | null) => void;
  allLabel: string;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;
  const visible = limit && !expanded && !query ? filtered.slice(0, limit) : filtered;
  // Keep the selected option visible even when it's beyond the fold.
  const selected = options.find((o) => o.value === value);
  const shown = selected && !visible.includes(selected) ? [selected, ...visible] : visible;

  return (
    <div className="space-y-1">
      {limit && options.length > limit && (
        <input
          type="search"
          className="input mb-2 py-2"
          placeholder="Pronađi…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Pretraži: ${allLabel}`}
        />
      )}
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-crema-100">
        <input
          type="radio"
          name={name}
          checked={!value}
          onChange={() => onSelect(null)}
          className="accent-espresso-900"
        />
        {allLabel}
      </label>
      {shown.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-crema-100"
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onSelect(o.value)}
            className="accent-espresso-900"
          />
          <span className="flex-1">{o.label}</span>
          <span className="text-xs text-espresso-600/70 tabular-nums">{o.count}</span>
        </label>
      ))}
      {limit && !query && filtered.length > limit && (
        <button
          type="button"
          className="px-2 pt-1 text-sm font-semibold text-roast-600 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Prikaži manje' : `Prikaži sve (${filtered.length})`}
        </button>
      )}
    </div>
  );
}

export function Filters({ meta, search, onChange }: FiltersProps) {
  // The sidebar and the mobile dialog both render filters; radio groups must not share a name
  // across them or checking one copy unchecks the other.
  const uid = useId();
  const set = (key: UrlFilterKey, value: string | null) => onChange(withFilter(search, key, value));
  const toggle = (key: UrlFilterKey, value: string) => set(key, toggleListValue(search.get(key), value));
  const category = search.get('kategorija');
  const selectedIntensity = new Set((search.get('jacina') ?? '').split(','));
  const selectedDiet = new Set((search.get('dijeta') ?? '').split(','));

  if (!meta) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-crema-200" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Section title="Kategorija">
        <RadioList
          name={`${uid}-kategorija`}
          allLabel="Sve kategorije"
          options={meta.categories.filter((c) => c.count > 0)}
          value={category}
          onSelect={(v) => set('kategorija', v)}
        />
      </Section>

      {meta.systems.length > 0 && category !== 'caj' && category !== 'sirupi' && (
        <Section title="Aparat">
          <RadioList
            name={`${uid}-sistem`}
            allLabel="Svi aparati"
            options={meta.systems}
            value={search.get('sistem')}
            onSelect={(v) => set('sistem', v)}
            limit={8}
          />
        </Section>
      )}

      {meta.kinds.length > 1 && (
        <Section title="Vrsta napitka">
          <RadioList
            name={`${uid}-vrsta`}
            allLabel="Sve"
            options={meta.kinds}
            value={search.get('vrsta')}
            onSelect={(v) => set('vrsta', v)}
          />
        </Section>
      )}

      <Section title="Brend">
        <RadioList
          name={`${uid}-brend`}
          allLabel="Svi brendovi"
          options={meta.brands}
          value={search.get('brend')}
          onSelect={(v) => set('brend', v)}
          limit={8}
        />
      </Section>

      {category !== 'caj' && category !== 'sirupi' && (
        <Section title="Jačina">
          <div className="flex flex-wrap gap-2">
            {INTENSITY_LEVELS.map((l) => {
              const active = selectedIntensity.has(String(l.level));
              return (
                <button
                  key={l.level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle('jacina', String(l.level))}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                    active
                      ? 'bg-espresso-900 text-crema-100 ring-espresso-900'
                      : 'ring-espresso-900/15 hover:bg-crema-100'
                  }`}
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Ishrana">
        <div className="grid gap-1">
          {(['lactose-free', 'gluten-free', 'sugar-free', 'vegan', 'decaf', 'organic'] as const).map(
            (key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-crema-100"
              >
                <input
                  type="checkbox"
                  checked={selectedDiet.has(key)}
                  onChange={() => toggle('dijeta', key)}
                  className="accent-espresso-900"
                />
                {DIET_TAGS[key].name}
              </label>
            ),
          )}
        </div>
      </Section>
    </div>
  );
}
