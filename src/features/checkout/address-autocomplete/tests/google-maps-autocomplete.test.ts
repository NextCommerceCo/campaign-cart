import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GoogleMapsAutocomplete } from '../google-maps-autocomplete';
import type { AutocompleteContext } from '../../checkout.types';
import type { Logger } from '@/core/logger';
import { EventBus } from '@/core/events';
import { useConfigStore } from '@/state/config';

/**
 * Teardown proof for the four listeners this provider puts on the checkout form's own
 * markup: `focus` and `keydown` on the address input, and `change` on each country
 * `<select>` (finding 169 in `docs/code-findings.md`).
 *
 * The `keydown` one is the visible symptom — it calls `preventDefault()` unconditionally,
 * so a destroyed provider went on swallowing the Enter key in the address field, which is
 * how a shopper submits the form. The `change` pair was inert after `destroy()` only
 * because it reads the instance map `destroy()` clears; they still stayed attached, so a
 * second lazy load stacked another set.
 */

/** The slice of the Maps SDK this module actually calls. */
function stubGoogleMaps(): {
  setComponentRestrictions: ReturnType<typeof vi.fn>;
} {
  const setComponentRestrictions = vi.fn();
  (window as unknown as { google: unknown }).google = {
    maps: {
      places: {
        Autocomplete: class {
          setComponentRestrictions = setComponentRestrictions;
          addListener = vi.fn();
          getPlace = vi.fn(() => ({}));
        },
      },
    },
  };
  return { setComponentRestrictions };
}

function makeCtx(): {
  ctx: AutocompleteContext;
  address: HTMLInputElement;
  country: HTMLSelectElement;
} {
  const address = document.createElement('input');
  const country = document.createElement('select');
  country.innerHTML =
    '<option value="US">US</option><option value="CA">CA</option>';
  document.body.append(address, country);

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  return {
    address,
    country,
    ctx: {
      fields: new Map<string, HTMLElement>([
        ['address1', address],
        ['country', country],
      ]),
      billingFields: new Map<string, HTMLElement>(),
      getDetectedCountryCode: () => 'US',
      getHasTrackedShippingInfo: () => true,
      setHasTrackedShippingInfo: vi.fn(),
      logger,
      eventBus: EventBus.getInstance(),
    },
  };
}

describe('GoogleMapsAutocomplete teardown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useConfigStore.setState({
      googleMapsConfig: { apiKey: 'test-key', enableAutocomplete: true },
    });
    stubGoogleMaps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete (window as unknown as { google?: unknown }).google;
  });

  it('stops swallowing the Enter key once destroyed', async () => {
    const { ctx, address } = makeCtx();
    const autocomplete = new GoogleMapsAutocomplete(ctx);
    await autocomplete.setup();

    const live = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    });
    address.dispatchEvent(live);
    expect(live.defaultPrevented).toBe(true);

    autocomplete.destroy();

    const afterDestroy = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
    });
    address.dispatchEvent(afterDestroy);

    expect(afterDestroy.defaultPrevented).toBe(false);
  });

  it('stops decorating the suggestion dropdown on focus once destroyed', async () => {
    vi.useFakeTimers();
    try {
      const { ctx, address } = makeCtx();
      const autocomplete = new GoogleMapsAutocomplete(ctx);
      const setupDone = autocomplete.setup();
      await vi.runAllTimersAsync();
      await setupDone;

      const pac = document.createElement('div');
      pac.className = 'pac-container';
      document.body.appendChild(pac);

      address.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(200);
      expect(pac.hasAttribute('data-close-added')).toBe(true);

      autocomplete.destroy();
      const second = document.createElement('div');
      second.className = 'pac-container';
      document.body.appendChild(second);

      address.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(200);

      expect(second.hasAttribute('data-close-added')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops re-restricting the country once destroyed', async () => {
    const { setComponentRestrictions } = stubGoogleMaps();
    const { ctx, country } = makeCtx();
    const autocomplete = new GoogleMapsAutocomplete(ctx);
    await autocomplete.setup();

    country.value = 'CA';
    country.dispatchEvent(new Event('change'));
    expect(setComponentRestrictions).toHaveBeenCalledWith({ country: 'CA' });

    autocomplete.destroy();
    setComponentRestrictions.mockClear();
    country.value = 'US';
    country.dispatchEvent(new Event('change'));

    expect(setComponentRestrictions).not.toHaveBeenCalled();
  });
});
