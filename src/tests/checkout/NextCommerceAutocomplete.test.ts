import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextCommerceAutocomplete } from '@/enhancers/checkout/addressAutocompleteEnhancer/NextCommerceAutocomplete';
import type { AutocompleteContext } from '@/enhancers/checkout/types';
import type { ApiClient } from '@/api/client';
import type { AddressAutocompleteResult } from '@/types/api';

const storeMock = vi.hoisted(() => ({
  updateFormData: vi.fn(),
  setBillingAddress: vi.fn(),
  billingAddress: null as null,
  shippingMethod: null as null,
}));

vi.mock('@/stores/checkoutStore', () => ({
  useCheckoutStore: { getState: () => storeMock },
}));

vi.mock('@/utils/analytics/index', () => ({
  nextAnalytics: { track: vi.fn() },
  EcommerceEvents: { createAddShippingInfoEvent: vi.fn(() => ({})) },
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeInput(value = ''): HTMLInputElement {
  const el = document.createElement('input');
  el.value = value;
  document.body.appendChild(el);
  return el;
}

function makeSelect(value: string): HTMLSelectElement {
  const el = document.createElement('select');
  const opt = document.createElement('option');
  opt.value = value;
  opt.text = value;
  el.appendChild(opt);
  el.value = value;
  return el;
}

function makeCtx(overrides: Partial<AutocompleteContext> = {}): AutocompleteContext {
  return {
    fields: new Map<string, HTMLElement>([
      ['address1', makeInput()],
      ['city', makeInput()],
      ['postal', makeInput()],
      ['country', makeSelect('US')],
      ['province', makeSelect('CA')],
    ]),
    billingFields: new Map<string, HTMLElement>([
      ['billing-address1', makeInput()],
      ['billing-city', makeInput()],
      ['billing-postal', makeInput()],
      ['billing-country', makeSelect('US')],
      ['billing-province', makeSelect('CA')],
    ]),
    getDetectedCountryCode: vi.fn(() => 'US'),
    getHasTrackedShippingInfo: vi.fn(() => false),
    setHasTrackedShippingInfo: vi.fn(),
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    eventBus: { emit: vi.fn(), on: vi.fn() } as any,
    ...overrides,
  };
}

function makeResult(label = '123 Main St, Springfield'): AddressAutocompleteResult {
  return {
    label,
    address: {
      line1: '123 Main St',
      city: 'Springfield',
      state: 'Illinois',
      state_code: 'IL',
      postcode: '62701',
      country: 'United States',
      country_code: 'US',
    },
  };
}

function makeApiClient(results: AddressAutocompleteResult[] = [makeResult()]): Partial<ApiClient> {
  return {
    getAddressesAutocomplete: vi.fn().mockResolvedValue({ results }),
  };
}

function fireInput(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function fireKeydown(input: HTMLInputElement, key: string) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

// Flush pending microtasks (Promise callbacks) — does NOT advance fake timers
const flush = () => Promise.resolve();

beforeEach(() => {
  storeMock.updateFormData.mockClear();
  storeMock.setBillingAddress.mockClear();
});

// ---------------------------------------------------------------------------
// Test setup helper
// ---------------------------------------------------------------------------

function setup(
  apiClient = makeApiClient(),
  ctx = makeCtx()
): { autocomplete: NextCommerceAutocomplete; ctx: AutocompleteContext; addressInput: HTMLInputElement; billingInput: HTMLInputElement } {
  const autocomplete = new NextCommerceAutocomplete(ctx, apiClient as ApiClient);
  autocomplete.setup();
  return {
    autocomplete,
    ctx,
    addressInput: ctx.fields.get('address1') as HTMLInputElement,
    billingInput: ctx.billingFields.get('billing-address1') as HTMLInputElement,
  };
}

// Open suggestion container by typing valid text and advancing debounce timer
async function openSuggestions(input: HTMLInputElement, value = '123 Main St') {
  fireInput(input, value);
  await vi.advanceTimersByTimeAsync(300);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NextCommerceAutocomplete.setup()', () => {
  it('wires up the shipping address input without throwing', () => {
    const ctx = makeCtx();
    expect(() => new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup()).not.toThrow();
  });

  it('skips wiring when address1 field is absent', () => {
    const ctx = makeCtx();
    ctx.fields.delete('address1');
    expect(() => new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup()).not.toThrow();
  });

  it('skips wiring when address1 is not an input element', () => {
    const ctx = makeCtx();
    ctx.fields.set('address1', document.createElement('div'));
    expect(() => new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup()).not.toThrow();
  });
});

describe('input validation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fetches when text has two or more words', async () => {
    const api = makeApiClient();
    const { addressInput } = setup(api);
    await openSuggestions(addressInput, '123 Main');
    expect(api.getAddressesAutocomplete).toHaveBeenCalledWith('123 Main', 'US', undefined, expect.any(AbortSignal));
  });

  it('does not fetch for single-word input', async () => {
    const api = makeApiClient();
    const { addressInput } = setup(api);
    await openSuggestions(addressInput, '123');
    expect(api.getAddressesAutocomplete).not.toHaveBeenCalled();
  });

  it('hides existing container when text becomes invalid', async () => {
    const api = makeApiClient();
    const { addressInput } = setup(api);
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    expect(container.style.display).toBe('block');

    fireInput(addressInput, '123');
    expect(container.style.display).toBe('none');
  });
});

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls API only once after rapid typing', async () => {
    const api = makeApiClient();
    const { addressInput } = setup(api);

    fireInput(addressInput, '12 Ma');
    fireInput(addressInput, '123 Ma');
    fireInput(addressInput, '123 Main');
    await vi.advanceTimersByTimeAsync(300);

    expect(api.getAddressesAutocomplete).toHaveBeenCalledTimes(1);
    expect(api.getAddressesAutocomplete).toHaveBeenCalledWith('123 Main', 'US', undefined, expect.any(AbortSignal));
  });

  it('does not call API before debounce delay', async () => {
    const api = makeApiClient();
    const { addressInput } = setup(api);

    fireInput(addressInput, '123 Main');
    await vi.advanceTimersByTimeAsync(299);

    expect(api.getAddressesAutocomplete).not.toHaveBeenCalled();
  });
});

describe('suggestion container', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows container with suggestion items after fetch', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    expect(document.querySelectorAll('.pac-item-nextcommerce').length).toBe(1);
    expect((document.querySelector('.pac-container-nextcommerce') as HTMLElement).style.display).toBe('block');
  });

  it('hides container when fetch returns no results', async () => {
    const api = makeApiClient([]);
    const { addressInput } = setup(api);
    await openSuggestions(addressInput);

    expect((document.querySelector('.pac-container-nextcommerce') as HTMLElement).style.display).toBe('none');
  });

  it('renders a close button inside the container', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);
    expect(document.querySelector('.pac-close-button')).not.toBeNull();
  });

  it('close button hides the container', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    (document.querySelector('.pac-close-button') as HTMLButtonElement).click();
    expect(container.style.display).toBe('none');
  });

  it('clicking outside the container hides it', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.style.display).toBe('none');
  });

  it('clicking the input itself does not hide the container', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    addressInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.style.display).toBe('block');
  });
});

describe('blur', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tears down the container on blur', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    addressInput.dispatchEvent(new Event('blur'));
    expect(document.querySelector('.pac-container-nextcommerce')).toBeNull();
  });

  it('restores original text on blur (without arrow key navigating)', async () => {
    const { addressInput } = setup();
    addressInput.value = '123 Main';
    await openSuggestions(addressInput, '123 Main');
    // _originalSearchText is now '123 Main'; simulate external value change
    addressInput.value = 'changed externally';

    addressInput.dispatchEvent(new Event('blur'));
    expect(addressInput.value).toBe('123 Main');
  });
});

describe('Escape key', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes the container', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    fireKeydown(addressInput, 'Escape');
    expect(document.querySelector('.pac-container-nextcommerce')).toBeNull();
  });

  it('restores the original search text', async () => {
    const { addressInput } = setup();
    addressInput.value = '123 Main';
    await openSuggestions(addressInput, '123 Main');

    fireKeydown(addressInput, 'ArrowDown');
    fireKeydown(addressInput, 'Escape');
    expect(addressInput.value).toBe('123 Main');
  });
});

describe('arrow key navigation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function openMultiple() {
    const api = makeApiClient([makeResult('First Result'), makeResult('Second Result')]);
    const { addressInput } = setup(api);
    addressInput.value = '123 Main';
    await openSuggestions(addressInput, '123 Main');
    return { addressInput };
  }

  it('ArrowDown highlights first item and updates input value', async () => {
    const { addressInput } = await openMultiple();
    fireKeydown(addressInput, 'ArrowDown');

    expect(addressInput.value).toBe('First Result');
    const items = document.querySelectorAll('.pac-item-nextcommerce');
    expect(items[0].classList.contains('pac-item-nextcommerce--active')).toBe(true);
    expect(items[1].classList.contains('pac-item-nextcommerce--active')).toBe(false);
  });

  it('ArrowDown wraps from last item back to first', async () => {
    const { addressInput } = await openMultiple();
    fireKeydown(addressInput, 'ArrowDown'); // → 0
    fireKeydown(addressInput, 'ArrowDown'); // → 1
    fireKeydown(addressInput, 'ArrowDown'); // → wraps to 0
    expect(addressInput.value).toBe('First Result');
  });

  it('ArrowUp from index -1 jumps to last item', async () => {
    const { addressInput } = await openMultiple();
    fireKeydown(addressInput, 'ArrowUp');
    expect(addressInput.value).toBe('Second Result');
  });

  it('ArrowUp from first item wraps to last item', async () => {
    const { addressInput } = await openMultiple();
    fireKeydown(addressInput, 'ArrowDown'); // → index 0 = First Result
    fireKeydown(addressInput, 'ArrowUp');   // → wraps to index 1 = Second Result
    expect(addressInput.value).toBe('Second Result');
  });

  it('does nothing when the container is closed', async () => {
    const { addressInput } = await openMultiple();
    fireKeydown(addressInput, 'Escape');
    fireKeydown(addressInput, 'ArrowDown');
    expect(addressInput.value).toBe('123 Main');
  });
});

describe('Enter key', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('clicks the active suggestion and hides the container', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    fireKeydown(addressInput, 'ArrowDown');
    fireKeydown(addressInput, 'Enter');
    await flush();

    expect((document.querySelector('.pac-container-nextcommerce') as HTMLElement).style.display).toBe('none');
    // click handler sets label first, then _fillAddress overwrites address1 with line1
    expect(addressInput.value).toBe(makeResult().address.line1);
  });

  it('does nothing when no item is active', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    fireKeydown(addressInput, 'Enter');
    expect(container.style.display).toBe('block');
  });

  it('always prevents default form submission', () => {
    const { addressInput } = setup();
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    addressInput.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('suggestion click — shipping', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fills shipping form fields', async () => {
    const ctx = makeCtx();
    const api = makeApiClient();
    new NextCommerceAutocomplete(ctx, api as ApiClient).setup();
    const addressInput = ctx.fields.get('address1') as HTMLInputElement;
    await openSuggestions(addressInput);

    (document.querySelector('.pac-item-nextcommerce') as HTMLElement).click();
    await flush();

    expect((ctx.fields.get('address1') as HTMLInputElement).value).toBe('123 Main St');
    expect((ctx.fields.get('city') as HTMLInputElement).value).toBe('Springfield');
    expect((ctx.fields.get('postal') as HTMLInputElement).value).toBe('62701');
  });

  it('calls updateFormData on the checkout store', async () => {
    const ctx = makeCtx();
    new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup();
    const addressInput = ctx.fields.get('address1') as HTMLInputElement;
    await openSuggestions(addressInput);

    (document.querySelector('.pac-item-nextcommerce') as HTMLElement).click();
    await flush();

    expect(storeMock.updateFormData).toHaveBeenCalledWith(
      expect.objectContaining({ address1: '123 Main St', city: 'Springfield', postal: '62701' })
    );
  });

  it('emits autocomplete-filled event with type shipping', async () => {
    const ctx = makeCtx();
    new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup();
    const addressInput = ctx.fields.get('address1') as HTMLInputElement;
    await openSuggestions(addressInput);

    (document.querySelector('.pac-item-nextcommerce') as HTMLElement).click();
    await flush();

    expect(ctx.eventBus.emit).toHaveBeenCalledWith(
      'address:autocomplete-filled',
      expect.objectContaining({ type: 'shipping' })
    );
  });
});

describe('suggestion click — billing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fills billing form fields', async () => {
    const ctx = makeCtx();
    new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup();
    const billingInput = ctx.billingFields.get('billing-address1') as HTMLInputElement;
    await openSuggestions(billingInput);

    (document.querySelector('.pac-item-nextcommerce') as HTMLElement).click();
    await flush();

    expect((ctx.billingFields.get('billing-address1') as HTMLInputElement).value).toBe('123 Main St');
    expect((ctx.billingFields.get('billing-city') as HTMLInputElement).value).toBe('Springfield');
  });

  it('calls setBillingAddress on the checkout store', async () => {
    const ctx = makeCtx();
    new NextCommerceAutocomplete(ctx, makeApiClient() as ApiClient).setup();
    const billingInput = ctx.billingFields.get('billing-address1') as HTMLInputElement;
    await openSuggestions(billingInput);

    (document.querySelector('.pac-item-nextcommerce') as HTMLElement).click();
    await flush();

    expect(storeMock.setBillingAddress).toHaveBeenCalledWith(
      expect.objectContaining({ address1: '123 Main St', city: 'Springfield' })
    );
  });
});

describe('document click listener cleanup', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes the document click listener when container is torn down', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    addressInput.dispatchEvent(new Event('blur'));
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));

    removeSpy.mockRestore();
  });

  it('does not throw when outside click fires after teardown', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);
    addressInput.dispatchEvent(new Event('blur'));

    expect(() => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow();
  });
});

describe('focus event', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('re-shows existing container that has cached results', async () => {
    const { addressInput } = setup();
    await openSuggestions(addressInput);

    const container = document.querySelector('.pac-container-nextcommerce') as HTMLElement;
    container.style.display = 'none';

    addressInput.dispatchEvent(new Event('focus'));
    await flush();
    expect(container.style.display).toBe('block');
  });

  it('fetches on focus when input has valid text and no cached data', async () => {
    const api = makeApiClient();
    const ctx = makeCtx();
    new NextCommerceAutocomplete(ctx, api as ApiClient).setup();
    const addressInput = ctx.fields.get('address1') as HTMLInputElement;
    addressInput.value = '123 Main St';

    addressInput.dispatchEvent(new Event('focus'));
    await flush();

    expect(api.getAddressesAutocomplete).toHaveBeenCalledWith('123 Main St', 'US', undefined, expect.any(AbortSignal));
  });
});
