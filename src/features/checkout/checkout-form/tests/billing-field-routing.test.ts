import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import intlTelInput from 'intl-tel-input';
import type { Iti } from 'intl-tel-input';
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

/**
 * The billing phone's E.164 number comes from the live `intl-tel-input` instance on the
 * field, which the library hands back through `getInstance`. Mocked here so a test can say
 * "the library is on the page and knows this number" (an instance) or "it is not"
 * (`null`) without standing up the real widget.
 */
vi.mock('intl-tel-input', () => ({
  default: { getInstance: vi.fn(() => null) },
}));

const getInstance = vi.mocked(intlTelInput.getInstance);

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

/** The number `intl-tel-input` would assemble from what the shopper typed. */
function phoneInstance(number: string | null): Iti {
  return { getNumber: vi.fn(() => number) } as unknown as Iti;
}

function resetCheckout(): void {
  useCheckoutStore.getState().reset();
}

beforeEach(() => {
  resetCheckout();
  getInstance.mockReturnValue(null);
});

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
   * The billing phone is the one billing field whose stored value is not what the shopper
   * typed: the orders API needs E.164, so a UK number has to reach the order as
   * `+447700900123` rather than `07700 900123`, or AVS and any SMS to it fail.
   */
  it('stores the E.164 number for the billing phone, not the typed text', async () => {
    const target = input('07700 900123');
    getInstance.mockReturnValue(phoneInstance('+447700900123'));

    await routeBillingField(createCtx(), 'billing-phone', target, store());

    expect(useCheckoutStore.getState().billingAddress?.phone).toBe(
      '+447700900123'
    );
  });

  /**
   * A form without `intl-tel-input` is supported, and the shopper's number is still worth
   * more on the order than nothing at all.
   */
  it('stores the typed billing phone when intl-tel-input is not on the page', async () => {
    getInstance.mockReturnValue(null);

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

  /** `getNumber()` returns null for a number the library cannot parse. Same reasoning. */
  it('stores the typed billing phone when the number cannot be parsed', async () => {
    getInstance.mockReturnValue(phoneInstance(null));

    await routeBillingField(createCtx(), 'billing-phone', input('123'), store());

    expect(useCheckoutStore.getState().billingAddress?.phone).toBe('123');
  });

  it('does not ask intl-tel-input about any other billing field', async () => {
    await routeBillingField(
      createCtx(),
      'billing-city',
      input('Hanoi'),
      store()
    );

    expect(getInstance).not.toHaveBeenCalled();
  });

  /** Regression coverage for code-findings.md #156 — see `src/state/checkout`. */
  it('clears the billing address on a checkout-store reset', () => {
    routeBillingFieldValue('billing-fname', 'Ada', store());

    useCheckoutStore.getState().reset();

    expect(useCheckoutStore.getState().billingAddress).toBeUndefined();
  });
});
