import { describe, it, expect, vi } from 'vitest';
import {
  populateCountryDropdown,
  populateBillingCountryDropdown,
  updateFormLabels,
  updateBillingFormLabels,
  type CountryFieldsContext,
} from '../country-fields';
import type { Country, CountryConfig } from '@/core/country-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createCountry(overrides: Partial<Country> = {}): Country {
  return {
    code: 'CA',
    name: 'Canada',
    phonecode: '1',
    currencyCode: 'CAD',
    currencySymbol: '$',
    ...overrides,
  };
}

function createCountryConfig(
  overrides: Partial<CountryConfig> = {}
): CountryConfig {
  return {
    stateLabel: 'Province',
    stateRequired: true,
    postcodeLabel: 'Postal Code',
    postcodeRegex: null,
    postcodeMinLength: 6,
    postcodeMaxLength: 7,
    postcodeExample: 'A1A 1A1',
    postcodeFormat: null,
    currencyCode: 'CAD',
    currencySymbol: '$',
    ...overrides,
  };
}

function createCtx(
  overrides: Partial<CountryFieldsContext> = {}
): CountryFieldsContext {
  return {
    form: document.createElement('form'),
    fields: new Map<string, HTMLElement>(),
    billingFields: new Map<string, HTMLElement>(),
    countries: [],
    ...overrides,
  };
}

// ─── populateCountryDropdown ────────────────────────────────────────────────

describe('populateCountryDropdown', () => {
  it("keeps the author's own empty-value placeholder, disabling and hiding it", () => {
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = ''; // explicit empty value — an option's `.value`
    // falls back to its text content when no value attribute is set at all,
    // so this has to be set explicitly for the "no value" guard to see it.
    placeholder.textContent = 'Select a country…';
    select.appendChild(placeholder);

    populateCountryDropdown(select, [createCountry()]);

    // Same object, not a lookalike re-created from scratch — the author's
    // wording/translation must survive verbatim.
    expect(select.options[0]).toBe(placeholder);
    expect(select.options[0]?.textContent).toBe('Select a country…');
    expect(select.options[0]?.disabled).toBe(true);
    expect(select.options[0]?.hidden).toBe(true);
  });

  it("drops the author's placeholder entirely when it carries a value", () => {
    // Surprising: `if (firstOption && !firstOption.value)` only re-appends an
    // empty-value placeholder. A placeholder the author gave a value (e.g. a
    // pre-selected default) is cleared by `innerHTML = ''` and never restored.
    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = 'US';
    placeholder.textContent = 'United States';
    select.appendChild(placeholder);

    populateCountryDropdown(select, [createCountry({ code: 'CA' })]);

    expect(Array.from(select.options).some(o => o.value === 'US')).toBe(false);
    expect(select.options.length).toBe(1);
  });

  it('selects the matching country and dispatches a bubbling change event once the option is already selected', () => {
    const select = document.createElement('select');
    document.body.appendChild(select); // so bubbling has somewhere to go
    let seenValueAtDispatch: string | null = null;
    const handler = vi.fn((e: Event) => {
      seenValueAtDispatch = (e.target as HTMLSelectElement).value;
    });
    select.addEventListener('change', handler);

    populateCountryDropdown(
      select,
      [
        createCountry({ code: 'CA' }),
        createCountry({ code: 'US', name: 'United States' }),
      ],
      'US'
    );

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0];
    expect(event.bubbles).toBe(true);
    // The option was marked selected before the event fired, not after.
    expect(seenValueAtDispatch).toBe('US');
    const usOption = Array.from(select.options).find(o => o.value === 'US');
    expect(usOption?.selected).toBe(true);
  });

  it('does not dispatch a change event when no defaultCountry is given', () => {
    const select = document.createElement('select');
    const handler = vi.fn();
    select.addEventListener('change', handler);

    populateCountryDropdown(select, [createCountry()]);

    expect(handler).not.toHaveBeenCalled();
  });
});

// ─── populateBillingCountryDropdown ─────────────────────────────────────────

describe('populateBillingCountryDropdown', () => {
  it('fires no change event, unlike the shipping dropdown', () => {
    const billingCountry = document.createElement('select');
    const handler = vi.fn();
    billingCountry.addEventListener('change', handler);
    const ctx = createCtx({
      billingFields: new Map([['billing-country', billingCountry]]),
      countries: [createCountry({ code: 'CA' }), createCountry({ code: 'US' })],
    });

    populateBillingCountryDropdown(ctx);

    expect(handler).not.toHaveBeenCalled();
    expect(billingCountry.options.length).toBe(2);
    // No option carries the `selected` attribute — there is no detected
    // default to apply. (A plain `<select>` reports its first option as
    // `.selected` by DOM default even with none set, so the attribute is
    // the thing that actually reflects what the source code did.)
    expect(
      Array.from(billingCountry.options).some(o => o.hasAttribute('selected'))
    ).toBe(false);
  });

  it('does nothing and does not throw when the page has no billing-country field', () => {
    const ctx = createCtx({ countries: [createCountry()] }); // empty billingFields

    expect(() => populateBillingCountryDropdown(ctx)).not.toThrow();
  });
});

// ─── updateFormLabels ────────────────────────────────────────────────────────

describe('updateFormLabels', () => {
  it('writes the country\'s state label, appending " *" only when the country requires it', () => {
    const form = document.createElement('form');
    form.innerHTML =
      '<label for="shipping_province">State</label><label for="shipping_postal_code">Zip</label>';
    const ctx = createCtx({ form });

    updateFormLabels(
      ctx,
      createCountryConfig({ stateLabel: 'Province', stateRequired: true })
    );
    expect(
      form.querySelector('label[for="shipping_province"]')?.textContent
    ).toBe('Province *');

    updateFormLabels(
      ctx,
      createCountryConfig({ stateLabel: 'County', stateRequired: false })
    );
    expect(
      form.querySelector('label[for="shipping_province"]')?.textContent
    ).toBe('County');
  });

  it('always marks the postcode label required and mirrors the label into the postal input placeholder', () => {
    const form = document.createElement('form');
    form.innerHTML = '<label for="shipping_postal_code">Zip</label>';
    const postalField = document.createElement('input');
    const ctx = createCtx({
      form,
      fields: new Map([['postal', postalField]]),
    });

    updateFormLabels(
      ctx,
      createCountryConfig({
        stateRequired: false,
        postcodeLabel: 'Postcode',
      })
    );

    expect(
      form.querySelector('label[for="shipping_postal_code"]')?.textContent
    ).toBe('Postcode *');
    expect(postalField.placeholder).toBe('Postcode');
  });

  it("replaces the label's full content, destroying any child markup the author put inside it", () => {
    // Surprising: `textContent = ...` wipes out a nested <abbr>/<span> rather
    // than updating just the label's text.
    const form = document.createElement('form');
    form.innerHTML =
      '<label for="shipping_state">State <abbr title="required">*</abbr></label>';
    const ctx = createCtx({ form });

    updateFormLabels(ctx, createCountryConfig({ stateRequired: true }));

    const label = form.querySelector('label[for="shipping_state"]');
    expect(label?.querySelector('abbr')).toBeNull();
    expect(label?.textContent).toBe('Province *');
  });
});

// ─── updateBillingFormLabels ─────────────────────────────────────────────────

describe('updateBillingFormLabels', () => {
  it('prefixes labels with "Billing" and only rewrites labels inside the billing container', () => {
    document.body.innerHTML = `
      <form>
        <label for="billing_state" id="rogue">State</label>
      </form>
      <div os-checkout-element="different-billing-address">
        <label for="billing_province" id="real-state">State</label>
        <label for="billing_postal_code" id="real-postal">Zip</label>
      </div>
    `;
    const billingPostal = document.createElement('input');
    const ctx = createCtx({
      billingFields: new Map([['billing-postal', billingPostal]]),
    });

    updateBillingFormLabels(
      ctx,
      createCountryConfig({ stateLabel: 'Province', stateRequired: true })
    );

    expect(document.getElementById('real-state')?.textContent).toBe(
      'Billing Province *'
    );
    expect(document.getElementById('real-postal')?.textContent).toBe(
      'Billing Postal Code *'
    );
    expect(billingPostal.placeholder).toBe('Billing Postal Code');
    // Same `for*="billing"` substring, but outside the container — must stay
    // untouched, proving the container scope (not just the selector) matters.
    expect(document.getElementById('rogue')?.textContent).toBe('State');
  });

  it('returns early and does not throw when there is no billing container on the page', () => {
    document.body.innerHTML = '<form></form>';
    const ctx = createCtx();

    expect(() =>
      updateBillingFormLabels(ctx, createCountryConfig())
    ).not.toThrow();
  });
});
