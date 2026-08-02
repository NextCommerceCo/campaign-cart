import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  routeBillingField,
  routeBillingFieldValue,
  type BillingFieldRoutingContext,
} from '../billing-field-routing';
import { updateBillingStateOptions } from '../state-fields';
import { formatPostalCodeInPlace } from '../postal-code-format';
import type { StateFieldsContext } from '../state-fields';
import type { PostalCodeFormatContext } from '../postal-code-format';
import { useCheckoutStore } from '@/state/checkout';

vi.mock('../state-fields', () => ({
  updateBillingStateOptions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../postal-code-format', () => ({
  formatPostalCodeInPlace: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createCtx(
  billingFields: Map<string, HTMLElement> = new Map()
): BillingFieldRoutingContext {
  return {
    billingFields,
    postalCodeFormat: {} as PostalCodeFormatContext,
    stateFields: {} as StateFieldsContext,
  };
}

function input(value: string): HTMLInputElement {
  const element = document.createElement('input');
  element.value = value;
  return element;
}

function select(value: string): HTMLSelectElement {
  const element = document.createElement('select');
  const option = document.createElement('option');
  option.value = value;
  element.appendChild(option);
  element.value = value;
  return element;
}

function store() {
  return useCheckoutStore.getState();
}

/**
 * `reset()` shallow-merges `initialState`, which declares no `billingAddress` — so the key
 * survives a reset and has to be cleared by hand here. See the note on the last test in
 * this file.
 */
function resetCheckout(): void {
  useCheckoutStore.getState().reset();
  useCheckoutStore.setState({ billingAddress: undefined });
}

beforeEach(resetCheckout);

afterEach(() => {
  vi.clearAllMocks();
  resetCheckout();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('routeBillingFieldValue', () => {
  it('renames a field to the key the orders API expects', () => {
    routeBillingFieldValue('billing-fname', 'Ada', store());

    expect(useCheckoutStore.getState().billingAddress?.first_name).toBe('Ada');
  });

  it('starts from a blank address when nothing has been entered yet', () => {
    routeBillingFieldValue('billing-city', 'Hanoi', store());

    expect(useCheckoutStore.getState().billingAddress).toEqual({
      first_name: '',
      last_name: '',
      address1: '',
      city: 'Hanoi',
      province: '',
      postal: '',
      country: '',
      phone: '',
    });
  });

  it('merges into an address the shopper has already started', () => {
    routeBillingFieldValue('billing-fname', 'Ada', store());
    routeBillingFieldValue('billing-lname', 'Lovelace', store());

    const address = useCheckoutStore.getState().billingAddress;
    expect(address?.first_name).toBe('Ada');
    expect(address?.last_name).toBe('Lovelace');
  });

  it('writes an unmapped name through unchanged', () => {
    routeBillingFieldValue('billing-company', 'Analytical Engines', store());

    expect(
      (useCheckoutStore.getState().billingAddress as Record<string, unknown>)
        ?.company
    ).toBe('Analytical Engines');
  });
});

describe('routeBillingField', () => {
  it('stores the value for any billing field', async () => {
    await routeBillingField(
      createCtx(),
      'billing-city',
      input('Hanoi'),
      store()
    );

    expect(useCheckoutStore.getState().billingAddress?.city).toBe('Hanoi');
  });

  it('formats the postcode against the billing country', async () => {
    const countryField = select('CA');
    const ctx = createCtx(new Map([['billing-country', countryField]]));
    const postal = input('k1a0b1');

    await routeBillingField(ctx, 'billing-postal', postal, store());

    expect(formatPostalCodeInPlace).toHaveBeenCalledWith(
      ctx.postalCodeFormat,
      postal,
      countryField
    );
  });

  it('does not format the postcode for any other field', async () => {
    await routeBillingField(
      createCtx(),
      'billing-city',
      input('Hanoi'),
      store()
    );

    expect(formatPostalCodeInPlace).not.toHaveBeenCalled();
  });

  it('refills the billing province dropdown when the country changes', async () => {
    const province = select('');
    const ctx = createCtx(new Map([['billing-province', province]]));
    useCheckoutStore.getState().updateFormData({ province: 'ON' });

    await routeBillingField(ctx, 'billing-country', select('CA'), store());

    expect(updateBillingStateOptions).toHaveBeenCalledWith(
      ctx.stateFields,
      'CA',
      province,
      'ON'
    );
  });

  it('does nothing extra when the page has no billing province dropdown', async () => {
    await routeBillingField(
      createCtx(),
      'billing-country',
      select('CA'),
      store()
    );

    expect(updateBillingStateOptions).not.toHaveBeenCalled();
    expect(useCheckoutStore.getState().billingAddress?.country).toBe('CA');
  });

  /**
   * DEFECT (left as found): a billing phone is stored as the national text the shopper
   * typed, never the E.164 number.
   *
   * `phone-input.ts` writes the E.164 number to `billingAddress.phone` on the same `input`
   * event, and its listener is registered first — so this write lands second and wins. The
   * shipping phone is unaffected because its branch asks `intl-tel-input` for the number
   * explicitly. A non-US billing number therefore reaches the order as `07700 900123`.
   */
  it('DEFECT: stores the typed billing phone, overwriting the E.164 number', async () => {
    // What phone-input.ts wrote a moment earlier on this same event.
    useCheckoutStore.getState().setBillingAddress({
      first_name: '',
      last_name: '',
      address1: '',
      city: '',
      province: '',
      postal: '',
      country: '',
      phone: '+447700900123',
    });

    await routeBillingField(
      createCtx(),
      'billing-phone',
      input('07700 900123'),
      store()
    );

    expect(useCheckoutStore.getState().billingAddress?.phone).toBe(
      '07700 900123'
    );
  });

  /**
   * DEFECT (left as found, and outside this folder): `useCheckoutStore.reset()` never
   * clears the billing address.
   *
   * `reset()` calls `set(initialState)`, and Zustand's `set` merges — but `initialState`
   * declares no `billingAddress` key, so there is nothing to overwrite it with. The
   * address is persisted to sessionStorage, so the billing address of a completed order
   * is still in the store on the next one. Fixing it belongs in `src/state/checkout`.
   */
  it('DEFECT: a billing address survives a checkout-store reset', () => {
    routeBillingFieldValue('billing-fname', 'Ada', store());

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().billingAddress?.first_name).toBe('Ada');
  });
});
