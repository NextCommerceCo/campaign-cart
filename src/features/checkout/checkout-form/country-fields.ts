/**
 * Country dropdowns, and the field labels that follow from the chosen country.
 *
 * "State" is not called "state" everywhere — it is a province in Canada, a county in the
 * UK, a prefecture in Japan — and it is not always required. Same for the postcode. So the
 * labels are rewritten from the selected country's config rather than hardcoded in the
 * page, which is why an author writes one address form and it reads correctly wherever the
 * shopper is.
 *
 * Extracted from `checkout-form.enhancer.ts` as the fifth cut out of that file. Grouped by
 * country rather than by "dropdowns" and "labels" separately, because a country change
 * drives both and splitting them would put two halves of one reaction in two files.
 *
 * Choosing *which* states to offer is a separate job — it needs the country service and an
 * in-flight request map — and stays in the enhancer for now.
 */

import type { Country, CountryConfig } from '@/core/country-service';

import { BILLING_CONTAINER_SELECTOR as BILLING_CONTAINER } from '../constants/selectors';

/**
 * What this module needs from the checkout form.
 *
 * No `logger` — none of these functions log, and the originals did not either.
 */
export interface CountryFieldsContext {
  /** The `<form>`, for finding the shipping labels within it. */
  form: HTMLElement;
  /** Shipping fields by name. */
  fields: Map<string, HTMLElement>;
  /** Billing fields by name, `billing-` prefixed. */
  billingFields: Map<string, HTMLElement>;
  /** Countries the campaign can ship to, already filtered by the API. */
  countries: Country[];
}

/**
 * Refills a country `<select>`, preserving the author's own placeholder option.
 *
 * The first option is kept and re-appended when it has no value, because that is the
 * page's own "Select a country" prompt and replacing it with a generated one would lose
 * the author's wording and translation. It is marked `disabled` **and** `hidden` so it
 * cannot be re-chosen once a real country is selected.
 *
 * @param defaultCountry Selected if present in the list. Setting it also **dispatches a
 *   bubbling `change` event**, because the rest of the checkout reacts to country changes
 *   through that event — assigning `selected` alone would leave state and labels showing
 *   the wrong country.
 */
export function populateCountryDropdown(
  countrySelect: HTMLSelectElement,
  countries: Country[],
  defaultCountry?: string
): void {
  const firstOption = countrySelect.options[0];
  countrySelect.innerHTML = '';
  if (firstOption && !firstOption.value) {
    firstOption.disabled = true;
    firstOption.hidden = true;
    countrySelect.appendChild(firstOption);
  }

  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    if (country.code === defaultCountry) {
      option.selected = true;
    }
    countrySelect.appendChild(option);
  });

  if (defaultCountry) {
    countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Fills the billing country dropdown from the same country list.
 *
 * Unlike the shipping one this selects nothing and fires no `change`: the billing address
 * has no detected default to apply, and dispatching would trigger a state lookup for a
 * country the shopper has not chosen.
 *
 * Does nothing when the page has no billing country field, which is the normal case on a
 * page that offers no separate billing address.
 */
export function populateBillingCountryDropdown(
  ctx: CountryFieldsContext
): void {
  const billingCountryField = ctx.billingFields.get('billing-country');
  if (!(billingCountryField instanceof HTMLSelectElement)) return;

  const firstOption = billingCountryField.options[0];
  billingCountryField.innerHTML = '';
  if (firstOption && !firstOption.value) {
    firstOption.disabled = true;
    firstOption.hidden = true;
    billingCountryField.appendChild(firstOption);
  }

  ctx.countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    billingCountryField.appendChild(option);
  });
}

/**
 * Rewrites the shipping state and postcode labels for the selected country.
 *
 * Labels are matched by a **substring** of their `for` attribute (`province`/`state`,
 * `postal`/`zip`) rather than an exact id, so pages that name their inputs differently
 * still get relabelled. The postcode label always carries ` *` because a postcode is
 * required everywhere the SDK sells; the state label only does when the country's config
 * says so.
 */
export function updateFormLabels(
  ctx: CountryFieldsContext,
  countryConfig: CountryConfig
): void {
  const stateLabel = ctx.form.querySelector(
    'label[for*="province"], label[for*="state"]'
  );
  if (stateLabel) {
    const isRequired = countryConfig.stateRequired ? ' *' : '';
    stateLabel.textContent = countryConfig.stateLabel + isRequired;
  }

  const postalLabel = ctx.form.querySelector(
    'label[for*="postal"], label[for*="zip"]'
  );
  if (postalLabel) {
    postalLabel.textContent = countryConfig.postcodeLabel + ' *';
  }

  const postalField = ctx.fields.get('postal');
  if (postalField instanceof HTMLInputElement) {
    postalField.placeholder = countryConfig.postcodeLabel;
  }
}

/**
 * The billing equivalent, prefixed with "Billing" so the two sections stay tellable apart.
 *
 * Scoped to the billing container rather than the form, and its selectors require
 * `for*="billing"` as well — without both, the shipping labels would match first and be
 * overwritten with billing wording.
 */
export function updateBillingFormLabels(
  ctx: CountryFieldsContext,
  countryConfig: CountryConfig
): void {
  const billingContainer = document.querySelector(BILLING_CONTAINER);
  if (!billingContainer) return;

  const billingStateLabel = billingContainer.querySelector(
    'label[for*="billing"][for*="province"], label[for*="billing"][for*="state"]'
  );
  if (billingStateLabel) {
    const isRequired = countryConfig.stateRequired ? ' *' : '';
    billingStateLabel.textContent = `Billing ${countryConfig.stateLabel}${isRequired}`;
  }

  const billingPostalLabel = billingContainer.querySelector(
    'label[for*="billing"][for*="postal"], label[for*="billing"][for*="zip"]'
  );
  if (billingPostalLabel) {
    billingPostalLabel.textContent = `Billing ${countryConfig.postcodeLabel} *`;
  }

  const billingPostalField = ctx.billingFields.get('billing-postal');
  if (billingPostalField instanceof HTMLInputElement) {
    billingPostalField.placeholder = `Billing ${countryConfig.postcodeLabel}`;
  }
}
