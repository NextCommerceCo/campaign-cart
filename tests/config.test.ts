import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pagePreloads, visitorCurrency } from '../src/config';

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

describe('visitorCurrency', () => {
  const answering = (answer: () => Promise<Response>) => {
    const fetch = vi.fn(answer);
    return { win: { fetch, sessionStorage } as unknown as Window, fetch };
  };

  beforeEach(() => sessionStorage.clear());

  it('asks i18n-rules for the visitor’s currency once per tab', async () => {
    const { win, fetch } = answering(async () => new Response(JSON.stringify({ currency: 'CAD' })));
    expect(await visitorCurrency(win)).toBe('CAD');
    expect(await visitorCurrency(win)).toBe('CAD');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://i18n-rules.nextcommerce.com/v1/geo', expect.anything());
  });

  it('keeps the tab’s first answer, one without a currency or one that failed included', async () => {
    const none = answering(async () => new Response(JSON.stringify({ currency: null })));
    expect([await visitorCurrency(none.win), await visitorCurrency(none.win)]).toEqual([undefined, undefined]);
    expect(none.fetch).toHaveBeenCalledTimes(1);
    sessionStorage.clear();
    const down = answering(async () => new Response(null, { status: 503 }));
    expect([await visitorCurrency(down.win), await visitorCurrency(down.win)]).toEqual([undefined, undefined]);
    expect(down.fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up when the answer takes longer than the timeout', async () => {
    const fetch = vi.fn(
      (_: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const win = { fetch, sessionStorage } as unknown as Window;
    expect([await visitorCurrency(win, 10), await visitorCurrency(win, 10)]).toEqual([undefined, undefined]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
