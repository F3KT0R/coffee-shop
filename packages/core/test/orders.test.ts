import { describe, expect, it } from 'vitest';
import { loyaltyDiscountRsd, loyaltyStatus, normalizeEmail } from '../src/loyalty.js';
import { instagramDmUrl, normalizeInstagramHandle } from '../src/instagram.js';
import { canTransition, generateOrderNumber } from '../src/orders.js';

describe('order status transitions', () => {
  it('follows the fulfilment path', () => {
    expect(canTransition('NEW', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'ORDERED')).toBe(true);
    expect(canTransition('ORDERED', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('allows recording an unclaimed parcel', () => {
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(true);
  });

  it('rejects skipping steps and leaving final states', () => {
    expect(canTransition('NEW', 'SHIPPED')).toBe(false);
    expect(canTransition('NEW', 'ORDERED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
  });
});

describe('generateOrderNumber', () => {
  it('is the UTC date plus four digits', () => {
    expect(generateOrderNumber(new Date('2026-09-27T10:00:00Z'), () => 0.4821)).toBe('260927-4821');
    expect(generateOrderNumber(new Date('2026-01-05T23:59:00Z'), () => 0)).toBe('260105-0000');
  });
});

describe('Kafe klub', () => {
  it('has no tier before the second picked-up order', () => {
    expect(loyaltyStatus(0)).toMatchObject({ tier: null, next: { id: 'stalni-gost', ordersNeeded: 2 } });
    expect(loyaltyStatus(1).next?.ordersNeeded).toBe(1);
  });

  it('moves up through the tiers', () => {
    expect(loyaltyStatus(2).tier).toMatchObject({ id: 'stalni-gost', discountPercent: 5 });
    expect(loyaltyStatus(7)).toMatchObject({
      tier: { id: 'ljubitelj-kafe', discountPercent: 8 },
      next: { id: 'kafe-vip', ordersNeeded: 3 },
    });
    expect(loyaltyStatus(25)).toMatchObject({ tier: { id: 'kafe-vip' }, next: null });
  });

  it('rounds the discount down to 10 dinars', () => {
    expect(loyaltyDiscountRsd(3_950, 5)).toBe(190); // 197.5
    expect(loyaltyDiscountRsd(3_950, 0)).toBe(0);
  });

  it('recognises an email regardless of case and spaces', () => {
    expect(normalizeEmail('  Petar@Example.COM ')).toBe('petar@example.com');
  });
});

describe('Instagram handles', () => {
  it.each([
    ['@Ana.Kafa', 'ana.kafa'],
    ['ana_kafa', 'ana_kafa'],
    ['https://www.instagram.com/ana.kafa/', 'ana.kafa'],
    ['instagram.com/ana.kafa?igsh=abc123', 'ana.kafa'],
    ['https://ig.me/m/kafekapsule', 'kafekapsule'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeInstagramHandle(input)).toBe(expected);
  });

  it.each(['', '@', 'ana kafa', 'ana..kafa', '.ana', 'x'.repeat(31), 'ana!'])('rejects %j', (input) => {
    expect(normalizeInstagramHandle(input)).toBeNull();
  });

  it('builds a direct-message link', () => {
    expect(instagramDmUrl('kafekapsule')).toBe('https://ig.me/m/kafekapsule');
  });
});
