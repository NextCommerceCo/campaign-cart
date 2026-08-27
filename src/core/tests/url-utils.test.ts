import { describe, it, expect, beforeEach } from 'vitest';
import { preserveQueryParams } from '@/core/url-utils';
import { useParameterStore } from '@/state/parameter';

/**
 * What follows a shopper from one page of a funnel to the next.
 *
 * `preserveQueryParams(url)` defaults to `'all'` and every in-site navigation the
 * SDK performs goes through it, so this one function decides the query string of
 * every checkout, upsell and decline URL. The contract it has to hold:
 * **attribution travels, a one-shot signal does not** — `NON_PROPAGATING_PARAMS`
 * in that module carries the reason each name is on the list.
 *
 * The bug that made this file necessary is
 * [#90](https://github.com/NextCommerceCo/campaign-cart/issues/90): a cancelled
 * PayPal attempt leaves `?payment_failed=true` on the checkout page, it was copied
 * onto the success URL of the card order the shopper then paid with, and the
 * landing page read it back as "this is the failure leg" and dropped
 * `dl_purchase`.
 */

function setUrl(url: string): void {
  window.history.replaceState({}, '', url);
}

beforeEach(() => {
  useParameterStore.setState({ params: {} });
  setUrl('/checkout');
});

describe('preserveQueryParams', () => {
  it('carries attribution from the current URL onto the target', () => {
    setUrl('/checkout?utm_source=newsletter&affid=a-42');

    const url = new URL(preserveQueryParams('/upsell'));

    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.get('affid')).toBe('a-42');
  });

  it('carries a parameter captured on an earlier page of the funnel', () => {
    // The store is the reason a `?utm_source=` on the lander still reaches the
    // upsell page, three navigations later.
    useParameterStore.setState({ params: { utm_source: 'newsletter' } });

    const url = new URL(preserveQueryParams('/upsell'));

    expect(url.searchParams.get('utm_source')).toBe('newsletter');
  });

  it('carries ref_id, which the upsell chain has no other source for', () => {
    // accept-upsell.handlers.ts calls preserveQueryParams(acceptUrl) and never
    // appends ref_id itself. Adding ref_id to NON_PROPAGATING_PARAMS would leave
    // the second upsell page with no order to accept onto — this is the test that
    // says so out loud.
    setUrl('/upsell?ref_id=ord_42');

    const url = new URL(preserveQueryParams('/upsell-2'));

    expect(url.searchParams.get('ref_id')).toBe('ord_42');
  });

  it('does not carry payment_failed off the page that owns it', () => {
    // The #90 journey: PayPal cancelled, shopper stays on the checkout page and
    // pays by card, the SDK redirects to the success page.
    setUrl('/checkout?payment_failed=true&payment_method=paypal');

    const url = new URL(preserveQueryParams('/upsell?ref_id=ord_42'));

    expect(url.searchParams.get('payment_failed')).toBeNull();
    expect(url.searchParams.get('payment_method')).toBeNull();
    expect(url.searchParams.get('ref_id')).toBe('ord_42');
  });

  it('does not carry payment_failed out of the parameter store either', () => {
    // Both halves of the merge have to be filtered: the flag is captured at boot,
    // so a page whose own URL is clean can still hold it in sessionStorage from
    // the page before.
    useParameterStore.setState({ params: { payment_failed: 'true' } });

    const url = new URL(preserveQueryParams('/upsell'));

    expect(url.searchParams.get('payment_failed')).toBeNull();
  });

  it('does not carry a force parameter onto the next page', () => {
    // forcePackageId empties the cart before it runs. Following the shopper from
    // a lander to the checkout, it wipes what they put in on the way.
    setUrl(
      '/lander?forcePackageId=123:2&forceShippingId=3&forceBundleId=premium'
    );

    const url = new URL(preserveQueryParams('/checkout'));

    expect(url.searchParams.get('forcePackageId')).toBeNull();
    expect(url.searchParams.get('forceShippingId')).toBeNull();
    expect(url.searchParams.get('forceBundleId')).toBeNull();
  });

  it('does not carry reset, which would clear storage again on arrival', () => {
    useParameterStore.setState({ params: { reset: 'true' } });

    const url = new URL(preserveQueryParams('/checkout'));

    expect(url.searchParams.get('reset')).toBeNull();
  });

  it('leaves a held-back parameter the caller put on the target itself', () => {
    // The list decides what is *copied*, never what a caller deliberately built.
    // getFailureUrl constructs the checkout URL plus the flag; nothing here may
    // take it back off.
    setUrl('/checkout?utm_source=newsletter');

    const url = new URL(preserveQueryParams('/checkout?payment_failed=true'));

    expect(url.searchParams.get('payment_failed')).toBe('true');
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
  });

  it('honours an explicit list without consulting the store', () => {
    // The other branch, used for the success/failure URLs that go inside the
    // order payload. It has always taken only what it was asked for.
    setUrl('/checkout?debugger=true&utm_source=newsletter');
    useParameterStore.setState({ params: { affid: 'a-42' } });

    const url = new URL(preserveQueryParams('/thanks', ['debugger']));

    expect(url.searchParams.get('debugger')).toBe('true');
    expect(url.searchParams.get('utm_source')).toBeNull();
    expect(url.searchParams.get('affid')).toBeNull();
  });

  it('still records a held-back parameter in the store', () => {
    // Deliberate: the failure page's own `data-next-show="param.payment_failed"`
    // block reads it from there. What changed in #90 is propagation, not capture.
    setUrl('/checkout?payment_failed=true');

    preserveQueryParams('/upsell');

    expect(useParameterStore.getState().params['payment_failed']).toBe('true');
  });
});
