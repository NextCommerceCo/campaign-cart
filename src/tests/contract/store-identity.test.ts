import { describe, it, expect, vi } from 'vitest';

/**
 * The scoped `persist` names are captured when the store modules are created, and
 * static imports are hoisted above everything in the test body — so the API key the
 * scope is derived from has to be on the page before those imports run. `vi.hoisted`
 * is the only hook that gets there first.
 *
 * Without it the stores load on a page with no `next-api-key`, resolve to the empty
 * scope, and the assertions below would be checking the *fallback* key shape while
 * reading as though they checked the real one.
 */
vi.hoisted(() => {
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'next-api-key');
  meta.setAttribute('content', 'pk_store_identity_contract');
  document.head.appendChild(meta);
});

import { useAttributionStore } from '@/state/attribution';
import { useCheckoutStore } from '@/state/checkout';
import { useConfigStore, configStore } from '@/state/config';
import { useOrderStore } from '@/state/order';
import { useParameterStore } from '@/state/parameter';

import { useAttributionStore as attributionDirect } from '@/state/attribution/attribution.state';
import { useCheckoutStore as checkoutDirect } from '@/state/checkout/checkout.state';
import { useConfigStore as configDirect } from '@/state/config/config.state';
import { useOrderStore as orderDirect } from '@/state/order/order.state';
import { useParameterStore as parameterDirect } from '@/state/parameter/parameter.state';

/**
 * Store-identity + persistence contract for `state/`.
 *
 * Every store lives in `state/<domain>/`, reachable either through the folder's
 * barrel or by importing the `.state.ts` file inside it. Two things can break
 * silently when those files move, and neither shows up in `type-check`:
 *
 * 1. **Two instances.** If a barrel ever re-declares a store instead of
 *    re-exporting it — or a second copy of the module is reachable by another
 *    path — callers split across two Zustand stores. Writes on one are invisible
 *    to the other: every unit test still passes, and the live page splits its
 *    cart or checkout state in half.
 * 2. **A changed `persist` key.** The key names a live entry in a visitor's
 *    sessionStorage. Rename one and every session in flight loses its cart,
 *    checkout form, or order.
 *
 * (This test was written for the `state/<domain>.state.ts` → `state/<domain>/`
 * move and asserted the old-path shims resolved to the same instance. The shims
 * are gone; it now guards barrel-vs-direct, which is the same failure mode.)
 */

const stores = [
  {
    id: 'attribution',
    viaBarrel: useAttributionStore,
    direct: attributionDirect,
  },
  { id: 'checkout', viaBarrel: useCheckoutStore, direct: checkoutDirect },
  { id: 'config', viaBarrel: useConfigStore, direct: configDirect },
  { id: 'order', viaBarrel: useOrderStore, direct: orderDirect },
  { id: 'parameter', viaBarrel: useParameterStore, direct: parameterDirect },
] as const;

/** The persist key each store must keep. `config` has no persistence at all. */
const PERSIST_KEYS: Record<string, string | null> = {
  attribution: 'next-attribution',
  checkout: 'next-checkout-store',
  config: null,
  order: 'next-order',
  parameter: 'next-url-params',
};

/**
 * Stores whose key carries a `__{scope}` suffix so two campaigns sharing one origin
 * cannot read each other's copy. Membership is the contract in both directions: a
 * store that leaves this set stops being isolated, and one that joins it breaks what
 * the key exists for. `attribution` and `parameter` are origin-wide on purpose —
 * scoping attribution would drop the affiliate credit for a shopper who landed on
 * one funnel and bought on another, which is the case it is there to cover.
 *
 * The suffix is present only because the `vi.hoisted` block above put a
 * `next-api-key` on the page first. A page with no readable key writes the **bare**
 * name instead — the pre-scoping behaviour, and deliberately not what this asserts.
 */
const FUNNEL_SCOPED = new Set(['checkout', 'order']);

describe('state — store identity', () => {
  it.each(stores)(
    '$id resolves to one instance through the barrel and the state file',
    ({ viaBarrel, direct }) => {
      expect(viaBarrel).toBe(direct);
    }
  );

  it('config exports the same instance under both of its names', () => {
    expect(useConfigStore).toBe(configStore);
  });
});

describe('state — persist keys are unchanged', () => {
  it.each(stores)('$id keeps its sessionStorage key', ({ id, viaBarrel }) => {
    const persist = (
      viaBarrel as unknown as {
        persist?: { getOptions: () => { name?: string } };
      }
    ).persist;
    const expected = PERSIST_KEYS[id];

    if (expected === null) {
      expect(persist, `${id} must not gain persistence`).toBeUndefined();
      return;
    }

    const name = persist?.getOptions().name;

    if (FUNNEL_SCOPED.has(id)) {
      expect(name, `${id} must stay funnel-scoped`).toMatch(
        new RegExp(`^${expected}__[a-z0-9-]+$`)
      );
      return;
    }

    expect(name).toBe(expected);
  });
});
