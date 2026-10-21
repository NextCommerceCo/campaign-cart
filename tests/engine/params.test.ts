import { describe, expect, it } from 'vitest';
import { nextUrl, parseForcePackages } from '../../src/engine/params';

describe('next page URL', () => {
  const params = { utm_source: 'fb', gclid: 'G1', email: 'jane@x.com', debugger: 'true', reset: '1' };
  const here = new URL('https://shop.test/lp');

  it('carries every kept param to the same site', () => {
    expect(nextUrl('/checkout', here, params)).toBe(
      'https://shop.test/checkout?utm_source=fb&gclid=G1&email=jane%40x.com',
    );
  });

  it('carries only attribution params to another site', () => {
    expect(nextUrl('https://partner.test/checkout', here, params)).toBe(
      'https://partner.test/checkout?utm_source=fb&gclid=G1',
    );
  });
});

describe('forcePackageId', () => {
  it('reads ids with optional quantities', () => {
    expect(parseForcePackages('2')).toEqual([{ packageId: 2, quantity: 1 }]);
    expect(parseForcePackages('2:3,5')).toEqual([
      { packageId: 2, quantity: 3 },
      { packageId: 5, quantity: 1 },
    ]);
    expect(parseForcePackages('abc')).toEqual([]);
  });
});
