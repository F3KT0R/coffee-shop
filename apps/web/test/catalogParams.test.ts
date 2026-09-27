import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, paramsFromUrl, toggleListValue, withFilter } from '../src/lib/catalogParams';

describe('catalog URL parameters', () => {
  it('maps Serbian URL keys to API parameters', () => {
    const params = paramsFromUrl(
      new URLSearchParams('kategorija=kapsule&sistem=nespresso&jacina=4,5&strana=3&q=lungo'),
    );
    expect(params).toEqual({
      category: 'kapsule',
      system: 'nespresso',
      intensity: '4,5',
      q: 'lungo',
      page: 3,
      pageSize: PAGE_SIZE,
    });
  });

  it('ignores invalid page numbers', () => {
    expect(paramsFromUrl(new URLSearchParams('strana=abc')).page).toBeUndefined();
  });

  it('resets paging on any filter change and dependent filters on a category change', () => {
    const next = withFilter(
      new URLSearchParams('kategorija=kapsule&sistem=nespresso&brend=Lavazza&strana=4'),
      'kategorija',
      'caj',
    );
    expect(next.toString()).toBe('kategorija=caj');
  });

  it('toggles values in comma lists', () => {
    expect(toggleListValue(null, 'vegan')).toBe('vegan');
    expect(toggleListValue('vegan,decaf', 'vegan')).toBe('decaf');
    expect(toggleListValue('vegan', 'vegan')).toBeNull();
  });
});
