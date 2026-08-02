import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCheckoutStore } from '@/state/checkout';

import type { FormValidationContext } from '../../validation/form-validation';
import { validateStep } from '../../validation/step-validation';
import { CheckoutFormEnhancer } from '../checkout-form.enhancer';

/**
 * The billing toggle, the billing section and `checkoutStore.sameAsShipping` are three
 * places holding one fact, and only the store survives a page load. A shopper who ticked
 * "use a different billing address" on step 1 therefore arrived at step 3 with the
 * checkbox back at its markup default, the section collapsed — and a store that still
 * said `sameAsShipping: false`. Step 3 validates from the store, so "next" failed with
 * `billing-*` messages for fields the shopper could not see and could not fill.
 *
 * These tests assert the invariant that ends that: after boot the checkbox, the visible
 * section and the store all say the same thing.
 */

interface BootSteps {
  bindFormElement(): void;
  cloneBillingFormFromShipping(): void;
  restoreBillingChoice(): void;
  destroy(): void;
  logger: { debug: unknown; info: unknown; warn: unknown; error: unknown };
}

const created: BootSteps[] = [];

/**
 * A step-3 page: the shipping form carrying the toggle, and the billing container the
 * SDK clones into. The toggle is rendered **checked**, which is the markup default —
 * nothing in the SDK writes it, so a reloaded page always starts here.
 */
function renderCheckoutPage(
  options: { withToggle?: boolean; toggleChecked?: boolean } = {}
): { form: HTMLFormElement; section: HTMLElement } {
  const { withToggle = true, toggleChecked = true } = options;
  const toggle = withToggle
    ? `<input type="checkbox" name="use_shipping_address"${toggleChecked ? ' checked' : ''} />`
    : '';

  document.body.innerHTML = `
    <form os-checkout-component="shipping-form">
      ${toggle}
      <div data-next-component="shipping-field-row">
        <input data-next-checkout-field="fname" name="shipping_fname" id="shipping_fname" value="Ada" />
      </div>
      <div data-next-component="shipping-field-row">
        <input data-next-checkout-field="address1" name="shipping_address1" id="shipping_address1" value="1 Main St" />
      </div>
    </form>
    <div os-checkout-element="different-billing-address">
      <div os-checkout-component="billing-form"></div>
    </div>
  `;

  return {
    form: document.querySelector('form') as HTMLFormElement,
    section: document.querySelector(
      '[os-checkout-element="different-billing-address"]'
    ) as HTMLElement,
  };
}

function toggleOf(form: HTMLFormElement): HTMLInputElement | null {
  return form.querySelector('input[name="use_shipping_address"]');
}

/** Runs the boot steps that decide what the billing section looks like on first paint. */
function bootBillingSection(form: HTMLFormElement): BootSteps {
  const steps = new CheckoutFormEnhancer(form) as unknown as BootSteps;
  steps.logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  created.push(steps);

  steps.bindFormElement();
  steps.cloneBillingFormFromShipping();
  steps.restoreBillingChoice();
  return steps;
}

/** What step 3 reports, asked exactly the way `handleStepNavigation` asks it. */
async function validateStepThree(): Promise<Record<string, string>> {
  const { billingAddress, sameAsShipping } = useCheckoutStore.getState();
  const ctx = {
    countryService: { validatePostalCode: () => true },
  } as unknown as FormValidationContext;

  const result = await validateStep(
    ctx,
    3,
    {
      fname: 'Ada',
      lname: 'Lovelace',
      email: 'ada@example.com',
      address1: '1 Main St',
      city: 'Springfield',
      postal: '90210',
      country: 'US',
    },
    new Map(),
    undefined,
    billingAddress,
    sameAsShipping
  );

  return result.errors ?? {};
}

afterEach(() => {
  created.splice(0).forEach(steps => steps.destroy());
  useCheckoutStore.getState().reset();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('the billing choice a shopper carries between pages', () => {
  it('restores "separate billing address" onto a page whose markup renders the toggle checked', () => {
    // Rehydrated from sessionStorage: the shopper unticked the toggle on an earlier step.
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: undefined,
    });
    const { form, section } = renderCheckoutPage();

    bootBillingSection(form);

    expect(toggleOf(form)?.checked).toBe(false);
    expect(section.classList.contains('billing-form-expanded')).toBe(true);
    expect(section.style.height).toBe('auto');
    expect(useCheckoutStore.getState().sameAsShipping).toBe(false);
  });

  it('leaves the billing errors answerable: every field step 3 names is inside the visible section', async () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: undefined,
    });
    const { form, section } = renderCheckoutPage();

    bootBillingSection(form);
    const errors = await validateStepThree();

    // Step 3 still fails — the shopper really has not entered a billing address.
    expect(errors['billing-fname']).toBe('Billing first name is required');
    // …but the field that message names is now on screen, so pressing "next" is no
    // longer a dead button.
    expect(section.style.height).toBe('auto');
    const named = section.querySelector(
      '[data-next-checkout-field="billing-fname"]'
    );
    expect(named).not.toBeNull();
  });

  it('leaves a page alone when the markup and the store already agree', () => {
    const { form, section } = renderCheckoutPage();

    bootBillingSection(form);

    expect(toggleOf(form)?.checked).toBe(true);
    expect(section.classList.contains('billing-form-collapsed')).toBe(true);
    expect(section.style.height).toBe('0px');
    expect(useCheckoutStore.getState().sameAsShipping).toBe(true);
  });

  it('adopts a markup default of "separate billing" when the store holds no shopper choice', () => {
    // `true` is also the store's untouched default, so it cannot outrank the markup.
    const { form, section } = renderCheckoutPage({ toggleChecked: false });

    bootBillingSection(form);

    expect(toggleOf(form)?.checked).toBe(false);
    expect(section.classList.contains('billing-form-expanded')).toBe(true);
    expect(useCheckoutStore.getState().sameAsShipping).toBe(false);
  });

  it('keeps the stored choice when the page has no billing toggle at all', () => {
    useCheckoutStore.setState({
      sameAsShipping: false,
      billingAddress: {
        first_name: 'Ada',
        last_name: 'Lovelace',
        address1: '2 Side St',
        city: 'Springfield',
        province: 'CA',
        postal: '90210',
        country: 'US',
        phone: '',
      },
    });
    const { form } = renderCheckoutPage({ withToggle: false });

    expect(() => bootBillingSection(form)).not.toThrow();

    // A payment-only page cannot express the choice; the address entered on the page
    // that could must not be thrown away.
    expect(useCheckoutStore.getState().sameAsShipping).toBe(false);
    expect(useCheckoutStore.getState().billingAddress?.city).toBe(
      'Springfield'
    );
  });

  it('does not mistake the cloned billing form for a second toggle', () => {
    useCheckoutStore.setState({ sameAsShipping: false });
    document.body.innerHTML = `
      <form os-checkout-component="shipping-form">
        <div data-next-component="shipping-field-row">
          <input type="checkbox" name="use_shipping_address" checked />
        </div>
        <div data-next-component="shipping-field-row">
          <input data-next-checkout-field="fname" name="shipping_fname" id="shipping_fname" />
        </div>
      </form>
      <div os-checkout-element="different-billing-address">
        <div os-checkout-component="billing-form"></div>
      </div>
    `;
    const form = document.querySelector('form') as HTMLFormElement;

    bootBillingSection(form);

    // The clone renames every field it copies, so the toggle exists exactly once.
    expect(
      document.querySelectorAll('input[name="use_shipping_address"]')
    ).toHaveLength(1);
    expect(toggleOf(form)?.checked).toBe(false);
  });
});
