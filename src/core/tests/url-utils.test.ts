import { describe, it, expect, beforeEach } from 'vitest';
import { preserveQueryParams, NON_PROPAGATING_PARAMS } from '@/core/url-utils';
import { useParameterStore } from '@/state/parameter';
import { URL_PARAMETERS } from '@/docs/content/url-parameters';
import parameterStateManifest from '@/state/parameter/parameter.state-manifest';

/**
 * What follows a shopper from one page of a funnel to the next.
 *
 * `preserveQueryParams(url)` defaults to `'all'` and every in-site navigation the
 * SDK performs goes through it, so this one function decides the query string of
 * every checkout, upsell and decline URL. The contract: **given a target URL, it
 * returns that URL with every parameter this session has seen appended, except the
 * ones that describe a single page load and the ones the target already carries.**
 *
 * The bug that made this file necessary is
 * [#90](https://github.com/NextCommerceCo/campaign-cart/issues/90): a cancelled
 * PayPal attempt leaves `?payment_failed=true` on the checkout page, it was copied
 * onto the success URL of the card order the shopper then paid with, and the
 * landing page read it back as "this is the failure leg" and dropped
 * `dl_purchase`.
 *
 * The first test is the domain sweep. Which parameters travel is not a matter of
 * opinion — `src/docs/content/url-parameters.ts` is the inventory of every one the
 * SDK touches, gated in both directions by `src/tests/docs/coreContracts.test.ts`,
 * so it is the authority to sample from. Running all of them through both sources
 * is what proves the list holds back what it means to and nothing else; the
 * hand-written cases below only cover what a per-parameter sweep cannot see.
 */

function setUrl(url: string): void {
  window.history.replaceState({}, '', url);
}

/** Whether `name` survives a navigation, arriving from the URL and from the store. */
function travels(name: string): { fromUrl: boolean; fromStore: boolean } {
  useParameterStore.setState({ params: {} });
  setUrl(`/checkout?${name}=V`);
  const fromUrl = new URL(preserveQueryParams('/next')).searchParams.has(name);

  useParameterStore.setState({ params: { [name]: 'V' } });
  setUrl('/checkout');
  const fromStore = new URL(preserveQueryParams('/next')).searchParams.has(
    name
  );

  return { fromUrl, fromStore };
}

beforeEach(() => {
  useParameterStore.setState({ params: {} });
  setUrl('/checkout');
});

describe('preserveQueryParams', () => {
  it('holds back every documented parameter that describes one page load, and no other', () => {
    // Frozen from the inventory: everything filed under a group whose parameters
    // act once and are done. Change this list only by changing what the SDK is for
    // — an attribution or order parameter appearing here means a funnel has
    // silently stopped crediting, or an upsell page has stopped finding its order.
    const ONE_SHOT_GROUPS = new Set([
      'Forcing a page into a state',
      'Resetting a session',
      'Written by the SDK',
    ]);

    const wrong = URL_PARAMETERS.flatMap(p => {
      const { fromUrl, fromStore } = travels(p.name);
      const shouldTravel = !ONE_SHOT_GROUPS.has(p.group);
      const rows: string[] = [];
      if (fromUrl !== shouldTravel) {
        rows.push(`${p.name} (${p.group}) from the URL: ${fromUrl}`);
      }
      if (fromStore !== shouldTravel) {
        rows.push(`${p.name} (${p.group}) from the store: ${fromStore}`);
      }
      return rows;
    });

    expect(
      wrong,
      'each row is a documented parameter whose group and behaviour disagree'
    ).toEqual([]);

    // The sweep above is only worth its runtime if both outcomes are in it. Freeze
    // the split so a change that quietly stops holding anything back — or starts
    // holding everything — cannot pass by agreeing with itself.
    const held = URL_PARAMETERS.filter(p => ONE_SHOT_GROUPS.has(p.group)).map(
      p => p.name
    );
    expect(held).toEqual([
      'reset',
      'forcePackageId',
      'forceShippingId',
      'forceBundleId',
      'payment_failed',
    ]);
    expect(URL_PARAMETERS.length - held.length).toBe(35);
  });

  it('holds back payment_method, which the inventory cannot carry', () => {
    // The inventory is generated from `searchParams` access in `src/`, and the SDK
    // reads and writes this one nowhere — so it can be neither documented there nor
    // covered by the sweep, and this is the only thing asserting it.
    expect(travels('payment_method')).toEqual({
      fromUrl: false,
      fromStore: false,
    });
  });

  it('lists the same names the parameter store documents to page authors', () => {
    // The store's caution renders into `state/parameter/guide/`, where a page
    // author reads which keys will not follow their shopper. Two homes for one
    // list, so they are asserted to agree rather than left to drift.
    const caution = parameterStateManifest.cautions?.find(c =>
      c.includes('never copied forward')
    );
    const named = [
      ...(caution ?? '').matchAll(/`([A-Za-z_]+)`(?=[,\s—-]*(?:`|which))/g),
    ]
      .map(m => m[1])
      .filter(n => n !== undefined);
    expect(named).toEqual([...NON_PROPAGATING_PARAMS]);
  });

  it('carries ref_id, which the upsell chain has no other source for', () => {
    // accept-upsell.handlers.ts calls preserveQueryParams(acceptUrl) and never
    // appends ref_id itself. The sweep says this parameter travels; this says who
    // breaks when it stops — the second upsell page, with no order to add onto.
    setUrl('/upsell?ref_id=ord_42');

    const url = new URL(preserveQueryParams('/upsell-2'));

    expect(url.searchParams.get('ref_id')).toBe('ord_42');
  });

  it('does not carry a cancelled attempt onto the order that follows it', () => {
    // Issue #90 end to end: PayPal cancelled, the shopper stays on the checkout
    // page and pays by card, the SDK redirects to the success page.
    setUrl('/checkout?payment_failed=true&payment_method=paypal');

    const url = new URL(preserveQueryParams('/upsell?ref_id=ord_42'));

    expect(url.searchParams.get('payment_failed')).toBeNull();
    expect(url.searchParams.get('payment_method')).toBeNull();
    expect(url.searchParams.get('ref_id')).toBe('ord_42');
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
