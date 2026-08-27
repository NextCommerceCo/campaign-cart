import { describe, it, expect, beforeEach } from 'vitest';
import { preserveQueryParams, NON_PROPAGATING_PARAMS } from '@/core/url-utils';
import { useParameterStore } from '@/state/parameter';
import { URL_PARAMETERS } from '@/docs/content/url-parameters';
import parameterStateManifest from '@/state/parameter/parameter.state-manifest';

/**
 * `preserveQueryParams(url)` defaults to `'all'` and every in-site navigation the
 * SDK performs goes through it, so this one function decides the query string of
 * every checkout, upsell and decline URL. Issue #90 was a `payment_failed` from a
 * cancelled PayPal attempt riding it onto the success page of the card order that
 * followed, where it read as "this is the failure leg" and dropped `dl_purchase`.
 *
 * The first test sweeps `src/docs/content/url-parameters.ts` — the inventory of
 * every parameter the SDK touches, gated both ways by
 * `src/tests/docs/coreContracts.test.ts`. The cases after it cover only what a
 * per-parameter sweep cannot see.
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

    // Freeze the split: a sweep with one outcome in it agrees with itself.
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
    // The inventory is generated from `searchParams` access, which this parameter
    // has none of, so the sweep cannot reach it.
    expect(travels('payment_method')).toEqual({
      fromUrl: false,
      fromStore: false,
    });
  });

  it('lists the same names the parameter store documents to page authors', () => {
    // The caution renders into `state/parameter/guide/`: second home, same list.
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
    // accept-upsell.handlers.ts never appends it; it breaks when this stops.
    setUrl('/upsell?ref_id=ord_42');

    const url = new URL(preserveQueryParams('/upsell-2'));

    expect(url.searchParams.get('ref_id')).toBe('ord_42');
  });

  it('does not carry a cancelled attempt onto the order that follows it', () => {
    setUrl('/checkout?payment_failed=true&payment_method=paypal');

    const url = new URL(preserveQueryParams('/upsell?ref_id=ord_42'));

    expect(url.searchParams.get('payment_failed')).toBeNull();
    expect(url.searchParams.get('payment_method')).toBeNull();
    expect(url.searchParams.get('ref_id')).toBe('ord_42');
  });

  it('leaves a held-back parameter the caller put on the target itself', () => {
    // getFailureUrl builds this URL on purpose; the filter is on the copy only.
    setUrl('/checkout?utm_source=newsletter');

    const url = new URL(preserveQueryParams('/checkout?payment_failed=true'));

    expect(url.searchParams.get('payment_failed')).toBe('true');
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
  });

  it('honours an explicit list without consulting the store', () => {
    setUrl('/checkout?debugger=true&utm_source=newsletter');
    useParameterStore.setState({ params: { affid: 'a-42' } });

    const url = new URL(preserveQueryParams('/thanks', ['debugger']));

    expect(url.searchParams.get('debugger')).toBe('true');
    expect(url.searchParams.get('utm_source')).toBeNull();
    expect(url.searchParams.get('affid')).toBeNull();
  });

  it('still records a held-back parameter in the store', () => {
    // `data-next-show="param.payment_failed"` on the failure page reads it here.
    setUrl('/checkout?payment_failed=true');

    preserveQueryParams('/upsell');

    expect(useParameterStore.getState().params['payment_failed']).toBe('true');
  });
});
