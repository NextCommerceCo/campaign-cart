import { describe, it, expect } from 'vitest';

import { useAttributionStore } from '@/state/attribution';
import { useCheckoutStore } from '@/state/checkout';
import { useConfigStore, configStore } from '@/state/config';
import { useOrderStore } from '@/state/order';
import { useParameterStore } from '@/state/parameter';

import { useAttributionStore as attributionViaShim } from '@/state/attribution.state';
import { useCheckoutStore as checkoutViaShim } from '@/state/checkout.state';
import { useConfigStore as configViaShim } from '@/state/config.state';
import { useOrderStore as orderViaShim } from '@/state/order.state';
import { useParameterStore as parameterViaShim } from '@/state/parameter.state';

/**
 * Store-identity + persistence contract for the `state/` folder move.
 *
 * Each store moved from `state/<domain>.state.ts` into `state/<domain>/`, with a
 * one-line shim left at the old path. Two things can break silently on a move
 * like that, and neither shows up in `type-check`:
 *
 * 1. **Two instances.** If the shim re-declared the store instead of re-exporting
 *    the folder's barrel, callers on the old path and callers on the new path
 *    would each get their own Zustand store. Writes on one would be invisible to
 *    the other — every unit test still passes, and the live page splits its cart
 *    or checkout state in half.
 * 2. **A changed `persist` key.** The key names a live entry in a visitor's
 *    sessionStorage. Rename one and every session in flight loses its cart,
 *    checkout form, or order.
 */

const stores = [
  {
    id: 'attribution',
    viaFolder: useAttributionStore,
    viaShim: attributionViaShim,
  },
  { id: 'checkout', viaFolder: useCheckoutStore, viaShim: checkoutViaShim },
  { id: 'config', viaFolder: useConfigStore, viaShim: configViaShim },
  { id: 'order', viaFolder: useOrderStore, viaShim: orderViaShim },
  { id: 'parameter', viaFolder: useParameterStore, viaShim: parameterViaShim },
] as const;

/** The persist key each store must keep. `config` has no persistence at all. */
const PERSIST_KEYS: Record<string, string | null> = {
  attribution: 'next-attribution',
  checkout: 'next-checkout-store',
  config: null,
  order: 'next-order',
  parameter: 'next-url-params',
};

describe('state folder move — store identity', () => {
  it.each(stores)(
    '$id resolves to one instance through the folder barrel and the old-path shim',
    ({ viaFolder, viaShim }) => {
      expect(viaFolder).toBe(viaShim);
    }
  );

  it('config exports the same instance under both of its names', () => {
    expect(useConfigStore).toBe(configStore);
  });
});

describe('state folder move — persist keys are unchanged', () => {
  it.each(stores)('$id keeps its sessionStorage key', ({ id, viaFolder }) => {
    const persist = (
      viaFolder as unknown as {
        persist?: { getOptions: () => { name?: string } };
      }
    ).persist;
    const expected = PERSIST_KEYS[id];

    if (expected === null) {
      expect(persist, `${id} must not gain persistence`).toBeUndefined();
      return;
    }

    expect(persist?.getOptions().name).toBe(expected);
  });
});
