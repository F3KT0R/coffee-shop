import { describe, expect, it } from 'vitest';
import { checkoutSchema, productQuerySchema } from '../src/schemas.js';
import { htmlToText, normalizeSearch } from '../src/text.js';

const validCheckout = {
  customer: {
    fullName: 'Petar Petrović',
    email: 'petar@example.com',
    phone: '064 123 4567',
    address: 'Bulevar oslobođenja 12',
    city: 'Novi Sad',
    postalCode: '21000',
  },
  items: [{ sku: '100341', quantity: 2 }],
  acceptTerms: true,
};

describe('checkoutSchema', () => {
  it('accepts a valid order and normalises the phone number', () => {
    const parsed = checkoutSchema.parse(validCheckout);
    expect(parsed.customer.phone).toBe('+381641234567');
    expect(parsed.customer.note).toBe('');
  });

  it.each(['+381 64 123 4567', '00381641234567', '021/555-333'])('accepts phone %s', (phone) => {
    expect(
      checkoutSchema.safeParse({ ...validCheckout, customer: { ...validCheckout.customer, phone } }).success,
    ).toBe(true);
  });

  it('rejects a bad postal code with a Serbian message', () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      customer: { ...validCheckout.customer, postalCode: '2100' },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Poštanski broj ima 5 cifara.');
  });

  it('requires accepting the terms', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, acceptTerms: false }).success).toBe(false);
  });

  it('rejects a filled honeypot', () => {
    expect(checkoutSchema.safeParse({ ...validCheckout, website: 'http://spam' }).success).toBe(false);
  });
});

describe('productQuerySchema', () => {
  it('applies defaults and parses list parameters', () => {
    expect(productQuerySchema.parse({ diet: 'vegan,gluten-free', intensity: '4,5' })).toMatchObject({
      sort: 'popular',
      page: 1,
      pageSize: 24,
      diet: ['vegan', 'gluten-free'],
      intensity: ['4', '5'],
    });
  });

  it('coerces paging from query strings and caps the page size', () => {
    expect(productQuerySchema.parse({ page: '3' }).page).toBe(3);
    expect(productQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('normalizeSearch', () => {
  it('drops accents, case and punctuation', () => {
    expect(normalizeSearch('Crème Brûlée')).toBe('creme brulee');
    expect(normalizeSearch("Café René · L'OR")).toBe('cafe rene l or');
    expect(normalizeSearch('Čaj od đumbira')).toBe('caj od dumbira');
  });
});

describe('htmlToText', () => {
  it('turns markup into plain paragraphs and decodes entities', () => {
    expect(
      htmlToText('<p>Caffè &amp; more&#039;s</p><p>• 10 pods<br>Nespresso&reg;</p><script>x()</script>'),
    ).toBe("Caffè & more's\n• 10 pods\nNespresso®");
  });
});
