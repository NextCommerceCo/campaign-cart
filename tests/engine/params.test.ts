import { describe, expect, it } from 'vitest';
import { nextUrl } from '../../src/engine/params';

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
