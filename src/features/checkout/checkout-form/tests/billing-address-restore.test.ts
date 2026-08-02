import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CountryService, CountryStatesData } from '@/core/country-service';
import type { Logger } from '@/core/logger';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';

import {
  restoreBillingAddressFields,
  type BillingAddressRestoreContext,
} from '../billing-form-setup';
import { routeBillingFieldValue } from '../billing-field-routing';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';

/**
 * The billing section now opens on the right choice — and, until this file, on the wrong
 * values. Cloning the shipping form clears every input it copies (it has to; the clone
 * otherwise arrives holding the shipping address), and nothing put the stored billing
 * address back. So a returning shopper saw an empty billing form while
 * `checkoutStore.billingAddress` still held their address, and step 3 validates from that
 * store: the form could report itself complete on values nobody could see.
 *
 * These tests assert the invariant that ends that — after boot, what the store holds is
 * what the shopper reads — plus the two states that must *not* be restored: no address at
 * all, and an address left behind by someone else's checkout.
 */

// Kept as a plain object (not typed as `Logger`) so `logger.warn` stays a `Mock` in
// assertions — see the note in `billing-form-setup.test.ts`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const US_STATES = [
  { code: 'CA', name: 'California' },
  { code: 'VA', name: 'Virginia' },
];

function createCountryStates(
  states: { code: string; name: string }[]
): CountryStatesData {
  return {
    countryConfig: {
      stateLabel: 'State',
      stateRequired: true,
      postcodeLabel: 'ZIP Code',
      postcodeRegex: null,
      postcodeMinLength: 5,
      postcodeMaxLength: 5,
      postcodeExample: '90210',
      postcodeFormat: null,
      currencyCode: 'USD',
      currencySymbol: '$',
    },
    states,
  };
}

/** A country service that answers instantly with a fixed state list. */
function createCountryService(
  states: { code: string; name: string }[] = US_STATES
): CountryService {
  return {
    getCountryStates: vi.fn(() => Promise.resolve(createCountryStates(states))),
  } as unknown as CountryService;
}

/**
 * A checkout page with the full shipping address form and the billing container the SDK
 * clones into. `address2` is deliberately absent: it is a key the store can hold and a
 * field plenty of pages never render.
 */
function renderCheckoutPage(): HTMLFormElement {
  document.body.innerHTML = `
    <form os-checkout-component="shipping-form">
      <input type="checkbox" name="use_shipping_address" checked />
      <div data-next-component="shipping-field-row">
        <input data-next-checkout-field="fname" name="shipping_fname" id="shipping_fname" />
        <input data-next-checkout-field="lname" name="shipping_lname" id="shipping_lname" />
      </div>
      <div data-next-component="shipping-field-row">
        <input data-next-checkout-field="address1" name="shipping_address1" id="shipping_address1" />
      </div>
      <div data-next-component="shipping-field-row">
        <select data-next-checkout-field="country" name="shipping_country" id="shipping_country">
          <option value=""></option>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
      </div>
      <div data-next-component="shipping-field-row">
        <input data-next-checkout-field="phone" name="shipping_phone" id="shipping_phone" />
      </div>
      <div data-next-component="location">
        <div data-next-component="shipping-field-row">
          <input data-next-checkout-field="city" name="shipping_city" id="shipping_city" />
          <select data-next-checkout-field="province" name="shipping_province" id="shipping_province"></select>
          <input data-next-checkout-field="postal" name="shipping_postal" id="shipping_postal" />
        </div>
      </div>
    </form>
    <div os-checkout-element="different-billing-address">
      <div os-checkout-component="billing-form"></div>
    </div>
  `;

  return document.querySelector('form') as HTMLFormElement;
}

const STORED_ADDRESS: NonNullable<CheckoutState['billingAddress']> = {
  first_name: 'Grace',
  last_name: 'Hopper',
  address1: '2 Side St',
  city: 'Arlington',
  province: 'VA',
  postal: '22201',
  country: 'US',
  phone: '(202) 555 0143',
};

// ─── The enhancer's boot step ─────────────────────────────────────────────────

/** Every private the boot steps below touch, reachable without a cast at each call. */
interface BootSteps {
  bindFormElement(): void;
  cloneBillingFormFromShipping(): void;
  restoreBillingChoice(): void;
  restoreBillingAddress(): Promise<void>;
  destroy(): void;
  logger: ReturnType<typeof createMockLogger>;
  countryService: CountryService;
  ui: { updateLabelsForPopulatedData: () => void; destroy: () => void };
  billingFields: Map<string, HTMLElement>;
}

const created: BootSteps[] = [];

/**
 * Runs the boot steps that decide what the billing section holds on first paint, in the
 * order `initialize` runs them. `ui` and `countryService` are the two collaborators those
 * steps reach for; everything else runs for real.
 */
async function bootBillingSection(form: HTMLFormElement): Promise<BootSteps> {
  const steps = new CheckoutFormEnhancer(form) as unknown as BootSteps;
  steps.logger = createMockLogger();
  steps.countryService = createCountryService();
  steps.ui = { updateLabelsForPopulatedData: vi.fn(), destroy: vi.fn() };
  created.push(steps);

  steps.bindFormElement();
  steps.cloneBillingFormFromShipping();
  steps.restoreBillingChoice();
  await steps.restoreBillingAddress();
  return steps;
}

function billingValue(name: string): string {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[data-next-checkout-field="${name}"]`
  );
  return field?.value ?? '<no such field>';
}

afterEach(() => {
  created.splice(0).forEach(steps => steps.destroy());
  useCheckoutStore.getState().reset();
  useCheckoutStore.setState({ billingAddress: undefined });
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('the billing address a shopper carries between pages', () => {
  it('fills the reopened billing section with the address the store holds', async () => {
    // Rehydrated from sessionStorage: entered on an earlier step, then reloaded.
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: STORED_ADDRESS,
    });
    const form = renderCheckoutPage();

    await bootBillingSection(form);

    expect(billingValue('billing-fname')).toBe('Grace');
    expect(billingValue('billing-lname')).toBe('Hopper');
    expect(billingValue('billing-address1')).toBe('2 Side St');
    expect(billingValue('billing-city')).toBe('Arlington');
    expect(billingValue('billing-postal')).toBe('22201');
    expect(billingValue('billing-country')).toBe('US');
  });

  it('loads the billing province list for the stored country and selects the stored region', async () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: STORED_ADDRESS,
    });
    const form = renderCheckoutPage();

    await bootBillingSection(form);

    // The cloned `<select>` starts with no options at all, so this value only exists
    // because the step refilled the list from the stored *billing* country first.
    expect(billingValue('billing-province')).toBe('VA');
  });

  it('restores the phone exactly as stored, without normalising it', async () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: STORED_ADDRESS,
    });
    const form = renderCheckoutPage();

    await bootBillingSection(form);

    expect(billingValue('billing-phone')).toBe('(202) 555 0143');
  });

  it('opens the section and leaves it empty when the choice was made but no address entered', async () => {
    // The store drops an all-empty billing address on persist while keeping the choice,
    // so "separate billing, no address" is a state that really reaches a fresh page.
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: undefined,
    });
    const form = renderCheckoutPage();

    const steps = await bootBillingSection(form);

    const section = document.querySelector(
      '[os-checkout-element="different-billing-address"]'
    ) as HTMLElement;
    expect(section.classList.contains('billing-form-expanded')).toBe(true);
    expect(billingValue('billing-fname')).toBe('');
    expect(billingValue('billing-address1')).toBe('');
    expect(steps.logger.error).not.toHaveBeenCalled();
  });

  it('leaves the fields empty when the shopper is billing to the shipping address', async () => {
    // `checkoutStore.reset()` returns `sameAsShipping` to true but leaves `billingAddress`
    // behind (finding 156), so this is what a shared browser holds after someone else's
    // order. It must not reach the DOM.
    useCheckoutStore.setState({
      sameAsShipping: true,
      billingAddress: STORED_ADDRESS,
    });
    const form = renderCheckoutPage();

    await bootBillingSection(form);

    expect(billingValue('billing-fname')).toBe('');
    expect(billingValue('billing-city')).toBe('');
    expect(billingValue('billing-country')).toBe('');
  });
});

// ─── restoreBillingAddressFields, directly ────────────────────────────────────

function createRestoreCtx(
  overrides: Partial<BillingAddressRestoreContext> = {}
): BillingAddressRestoreContext {
  const form = document.createElement('form');
  const billingFields = new Map<string, HTMLElement>();
  const logger = createMockLogger();

  return {
    form,
    billingFields,
    logger: logger as unknown as Logger,
    stateFields: {
      stateLoadingPromises: new Map(),
      countryService: createCountryService(),
      logger: logger as unknown as Logger,
      countryFields: {
        form,
        fields: new Map(),
        billingFields,
        countries: [],
      },
    },
    ...overrides,
  };
}

function addBillingField(
  ctx: BillingAddressRestoreContext,
  name: string,
  element: HTMLElement
): void {
  element.setAttribute('data-next-checkout-field', name);
  ctx.billingFields.set(name, element);
}

/** Every field a full cloned billing form carries, so the map is complete by default. */
function addWholeBillingForm(ctx: BillingAddressRestoreContext): void {
  ['fname', 'lname', 'address1', 'city', 'postal', 'phone'].forEach(suffix => {
    addBillingField(ctx, `billing-${suffix}`, document.createElement('input'));
  });
  const country = document.createElement('select');
  country.innerHTML = '<option value="US">United States</option>';
  addBillingField(ctx, 'billing-country', country);
  addBillingField(ctx, 'billing-province', document.createElement('select'));
}

describe('restoreBillingAddressFields', () => {
  it('does nothing at all when there is no stored address', async () => {
    const ctx = createRestoreCtx();
    const input = document.createElement('input');
    input.value = 'typed by the shopper a moment ago';
    addBillingField(ctx, 'billing-fname', input);

    await restoreBillingAddressFields(ctx, undefined);

    expect(input.value).toBe('typed by the shopper a moment ago');
  });

  it('writes a key the forward map does not know about into its billing- field', async () => {
    const ctx = createRestoreCtx();
    const input = document.createElement('input');
    addBillingField(ctx, 'billing-company', input);

    await restoreBillingAddressFields(ctx, {
      company: 'Univac',
    } as unknown as CheckoutState['billingAddress']);

    expect(input.value).toBe('Univac');
  });

  it('names a stored value the page has no field for instead of dropping it silently', async () => {
    // `address2` is a key the store can hold and this page never rendered.
    const ctx = createRestoreCtx();
    const logger = ctx.logger as unknown as ReturnType<typeof createMockLogger>;
    addWholeBillingForm(ctx);

    await restoreBillingAddressFields(ctx, {
      ...STORED_ADDRESS,
      address2: 'Apt 4',
    });

    expect(logger.warn).toHaveBeenCalledWith(
      '[Billing] Some stored billing values have no field',
      { fields: ['billing-address2'] }
    );
  });

  it('reports a stored province the country no longer offers as unrestored', async () => {
    const ctx = createRestoreCtx();
    const logger = ctx.logger as unknown as ReturnType<typeof createMockLogger>;
    addWholeBillingForm(ctx);

    await restoreBillingAddressFields(ctx, {
      ...STORED_ADDRESS,
      province: 'ZZ',
    });

    // A `<select>` keeps its old value when the option is missing, so the write has to be
    // read back — otherwise this failure is invisible.
    expect(logger.warn).toHaveBeenCalledWith(
      '[Billing] Some stored billing values have no field',
      { fields: ['billing-province'] }
    );
  });
});

// ─── The two maps stay inverses ───────────────────────────────────────────────

describe('the field ↔ stored-key mapping', () => {
  /**
   * `billing-field-routing.ts` renames every field on its way into the store; the restore
   * renames it back. The two maps live in different modules, so this pushes a distinct
   * value through both directions for every field a cloned billing form can carry — a
   * rename on either side that is not mirrored on the other fails here.
   */
  const FIELD_NAMES = [
    'billing-fname',
    'billing-lname',
    'billing-address1',
    'billing-address2',
    'billing-city',
    'billing-postal',
    'billing-country',
    'billing-phone',
    'billing-company',
  ];

  it('round-trips every billing field through the store and back', async () => {
    const ctx = createRestoreCtx();
    const store = {
      billingAddress: undefined as CheckoutState['billingAddress'],
      formData: {} as Record<string, unknown>,
      setBillingAddress: (address: CheckoutState['billingAddress']) => {
        store.billingAddress = address;
      },
    };

    FIELD_NAMES.forEach(name => {
      addBillingField(ctx, name, document.createElement('input'));
      routeBillingFieldValue(name, `value for ${name}`, store);
    });

    // Every field is blanked, exactly as the clone step leaves them.
    ctx.billingFields.forEach(field => {
      (field as HTMLInputElement).value = '';
    });

    await restoreBillingAddressFields(ctx, store.billingAddress);

    FIELD_NAMES.forEach(name => {
      expect(
        (ctx.billingFields.get(name) as HTMLInputElement).value,
        `${name} did not survive the round trip`
      ).toBe(`value for ${name}`);
    });
  });
});
