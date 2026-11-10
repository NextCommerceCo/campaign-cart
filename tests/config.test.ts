import { describe, expect, it } from 'vitest';
import { pagePreloads } from '../src/config';

const MAP =
  'legacy:legacy-1.js|attributes:attributes-1.js,variants-1.js,address-1.js|checkout:checkout-1.js,geo-1.js,address-1.js|order:order-1.js,address-1.js|cart-summary:summary-1.js|slots:slots-1.js';

const page = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('pagePreloads', () => {
  it('names the 0.4.x chunk for a page without attributes v2, and attributes with what it imports for one with', () => {
    expect(pagePreloads(MAP, page('<div data-next-display="cart.total"></div>'), '')).toEqual(['legacy-1.js']);
    expect(pagePreloads(MAP, page('<span data-next-query="cart.total"></span>'), '')).toEqual([
      'attributes-1.js',
      'variants-1.js',
      'address-1.js',
    ]);
  });

  it('adds the checkout, cart summary, slots and order chunks the markup and URL call for, each file once', () => {
    const checkout = page(
      '<form data-next-checkout></form><div data-next-cart-summary></div><div data-next-bundle-slot-template="x"></div>',
    );
    expect(pagePreloads(MAP, checkout, '?ref_id=R1')).toEqual([
      'legacy-1.js',
      'checkout-1.js',
      'geo-1.js',
      'address-1.js',
      'order-1.js',
      'summary-1.js',
      'slots-1.js',
    ]);
    expect(pagePreloads(MAP, page(''), '?order_ref_id=R1')).toEqual(['legacy-1.js', 'order-1.js', 'address-1.js']);
  });

  it('names nothing without the build’s list', () => {
    expect(pagePreloads('%PRELOAD%', page('<form data-next-checkout></form>'), '?ref_id=R1')).toEqual([]);
  });
});
