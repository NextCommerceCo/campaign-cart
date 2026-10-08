/**
 * The state / province dropdown, refilled whenever the country changes.
 *
 * Countries do not agree on whether a sub-national region exists, what it is called, or
 * whether it is required — so the field is rebuilt per country from what the country
 * service returns, and **hidden entirely** for countries that have neither states nor a
 * requirement. That hiding is the behaviour most worth knowing about: the field a page
 * author wrote is not always on screen.
 *
 * Extracted from `checkout-form.enhancer.ts` as the sixth cut. It is the **most coupled**
 * of the extractions so far and the honest reason is that filling this field is not a
 * self-contained job: it writes form data, clears a validation error, caches the country
 * config, and relabels neighbouring fields. Shipping needs eight things
 * ({@link ShippingStateFieldsContext}); billing needs five ({@link StateFieldsContext}),
 * which is why the context is split rather than one shape with fields billing would have to
 * supply and never use.
 */

import type {
  CountryConfig,
  I18nRules,
  CountryStatesData,
} from '@/core/i18n-rules';
import type { Logger } from '@/core/logger';

import {
  updateBillingFormLabels,
  updateFormLabels,
  type CountryFieldsContext,
} from './country-fields';

/** Containers a province field might sit in, for hiding the whole row rather than the input. */
const FIELD_CONTAINERS = '.frm-flds, .form-group, .form-field, .field-group';

/**
 * What to hide when a country has no province: the row it sits in, or the field alone
 * when that row holds other fields too. A select placed straight in the `<form>` has the
 * form as its parent, and hiding that hid the whole checkout.
 */
function provinceRowOf(provinceField: HTMLElement): HTMLElement {
  const row = (provinceField.closest(FIELD_CONTAINERS) ??
    provinceField.parentElement) as HTMLElement | null;
  const alone =
    row !== null &&
    row.querySelectorAll('[data-next-checkout-field]').length === 1;
  return alone ? row : provinceField;
}

/**
 * The country each province field was last asked to show. Countries answer in any order,
 * and a slow one used to land last: Canadian provinces under a dropdown reading United
 * States, a stale province stored with them.
 */
const requestedCountry = new WeakMap<HTMLSelectElement, string>();

function isLatestRequest(field: HTMLSelectElement, country: string): boolean {
  return requestedCountry.get(field) === country;
}

/** Milliseconds an in-flight request stays cached after settling. */
const PROMISE_CLEANUP_MS = 100;

/** What both the shipping and billing paths need. */
export interface StateFieldsContext {
  /**
   * In-flight `getCountryStates` calls, keyed by country.
   *
   * Shared by both paths on purpose: changing the shipping country to Canada and then the
   * billing country to Canada must not fetch twice. Entries are dropped shortly after
   * settling so a later change refetches rather than serving a stale list forever.
   */
  stateLoadingPromises: Map<string, Promise<CountryStatesData>>;
  i18nRules: I18nRules;
  logger: Logger;
  /** Passed through to the label helpers, which relabel the neighbouring fields. */
  countryFields: CountryFieldsContext;
  /**
   * Per-country config cache, written as each country resolves on either path. The
   * postcode check reads it and passes a country it has no config for, so a billing
   * country missing from it is a postcode nobody checks.
   */
  countryConfigs: Map<string, CountryConfig>;
}

/** What the billing path additionally needs. */
export interface BillingStateFieldsContext extends StateFieldsContext {
  /**
   * Writes the province the billing field now shows into the stored billing address,
   * which is what validation reads and the order is built from.
   */
  setBillingProvince: (province: string) => void;
}

/** What the shipping path additionally needs. */
export interface ShippingStateFieldsContext extends StateFieldsContext {
  /**
   * The config for the country now selected. A ref because the enhancer reads it
   * elsewhere — a copied value would leave the two disagreeing about which country the
   * form is currently showing.
   */
  currentCountryConfig: { value: CountryConfig | undefined };
  updateFormData: (data: Record<string, unknown>) => void;
  clearError: (field: string) => void;
}

/** Shown while the request is in flight, and while no country is chosen. */
function setPlaceholderOnly(field: HTMLSelectElement, text: string): void {
  field.innerHTML = `<option value="">${text}</option>`;
  field.disabled = true;
}

/**
 * Fetches a country's states, reusing an identical request already in flight.
 *
 * @param onReuse Called instead of starting a request when one is already pending. The
 *   caller logs from there rather than this helper doing it, because the shipping and
 *   billing messages differ and each has to stay a **literal** at its own `logger.debug`
 *   call — a templated message is invisible to the log-reference generator, so the line
 *   would vanish from `reference/logs.md`.
 */
function loadCountryStates(
  ctx: StateFieldsContext,
  country: string,
  onReuse: () => void
): Promise<CountryStatesData> {
  const pending = ctx.stateLoadingPromises.get(country);
  if (pending) {
    onReuse();
    return pending;
  }

  const request = ctx.i18nRules.getCountryStates(country);
  ctx.stateLoadingPromises.set(country, request);

  // Cache housekeeping, deliberately **not** `.finally()`. `request.finally(fn)` returns a
  // *derived* promise that rejects whenever `request` does — a different promise from the
  // one the caller awaits and catches, with no handler of its own. A single failing states
  // fetch therefore raised a genuine unhandled rejection, which crashes a process
  // configured to treat those as fatal, entirely outside this function's own error
  // handling. Two handlers instead of `finally` means the derived promise always settles.
  const scheduleCleanup = (): void => {
    setTimeout(
      () => ctx.stateLoadingPromises.delete(country),
      PROMISE_CLEANUP_MS
    );
  };
  void request.then(data => {
    ctx.countryConfigs.set(country, data.countryConfig);
    scheduleCleanup();
  }, scheduleCleanup);

  return request;
}

/**
 * A country's config, from the cache or fetched into it, with no field to refill.
 *
 * The state loaders only run when the page has a province `<select>`, and a country with
 * no states (a `data-next-address` block for GB) renders none — so validation calls this
 * for every address country before checking a postcode against it.
 *
 * @returns `undefined` when the request fails; the postcode check then passes the value
 *   rather than blocking the order on a network error.
 */
export async function loadCountryConfig(
  ctx: StateFieldsContext,
  country: string
): Promise<CountryConfig | undefined> {
  const cached = ctx.countryConfigs.get(country);
  if (cached) return cached;

  try {
    const countryData = await loadCountryStates(ctx, country, () => {
      ctx.logger.debug(
        `Reusing existing state loading promise for ${country} (config)`
      );
    });
    return countryData.countryConfig;
  } catch (error) {
    ctx.logger.warn('Failed to load country config:', error);
    return undefined;
  }
}

/** Fills a province field with a country's states behind a non-selectable prompt. */
function renderStates(
  field: HTMLSelectElement,
  countryData: CountryStatesData
): void {
  field.innerHTML = '';

  // `hidden` as well as `disabled`: the prompt names the region type ("Select Province"),
  // so it must show while nothing is chosen but not be offered in the open list.
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = `Select ${countryData.countryConfig.stateLabel}`;
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  placeholderOption.hidden = true;
  field.appendChild(placeholderOption);

  countryData.states.forEach(state => {
    const option = document.createElement('option');
    option.value = state.code;
    option.textContent = state.name;
    field.appendChild(option);
  });

  if (countryData.countryConfig.stateRequired) {
    field.setAttribute('required', 'required');
  } else {
    field.removeAttribute('required');
  }
}

/**
 * Rebuilds the shipping province field for a country.
 *
 * Three outcomes, and the middle one is easy to miss:
 *
 * 1. **No country yet** — the field says "Select Country First" and stays disabled.
 * 2. **Country has no states and does not require one** — the field's whole container is
 *    **hidden**, the requirement is dropped, and any province already in the form data is
 *    cleared. A page author who cannot find their province field on a UK order is seeing
 *    this, not a bug.
 * 3. **Otherwise** — the states are listed behind a "Select {stateLabel}" prompt.
 *
 * A value already in the field (browser autofill, or a returning shopper) is **kept only
 * if it is a valid state of the new country**; otherwise it is cleared rather than left
 * pointing at a region that country does not have.
 *
 * On failure the field's previous markup is restored, so a network error leaves the form
 * usable rather than stuck on "Loading...".
 */
export async function updateStateOptions(
  ctx: ShippingStateFieldsContext,
  country: string,
  provinceField: HTMLSelectElement
): Promise<void> {
  requestedCountry.set(provinceField, country);
  if (!country || country.trim() === '') {
    setPlaceholderOnly(provinceField, 'Select Country First');
    return;
  }

  provinceField.disabled = true;
  const originalHTML = provinceField.innerHTML;
  // Captured here, beside the markup, because the very next line destroys it: replacing
  // the options with "Loading..." leaves `.value` empty. This is what the shopper (or
  // browser autofill) had chosen, and the only chance to read it.
  const previousProvince = provinceField.value;
  provinceField.innerHTML = '<option value="">Loading...</option>';

  try {
    const countryData = await loadCountryStates(ctx, country, () => {
      ctx.logger.debug(`Reusing existing state loading promise for ${country}`);
    });
    if (!isLatestRequest(provinceField, country)) return;

    ctx.currentCountryConfig.value = countryData.countryConfig;

    updateFormLabels(ctx.countryFields, countryData.countryConfig);

    const hasStates = countryData.states && countryData.states.length > 0;
    const stateRequired = countryData.countryConfig.stateRequired;

    const provinceContainer = provinceRowOf(provinceField);

    if (!stateRequired && !hasStates) {
      if (provinceContainer) {
        (provinceContainer as HTMLElement).style.display = 'none';
      }
      provinceField.removeAttribute('required');
      ctx.updateFormData({ province: '' });
      ctx.clearError('province');
      return;
    }

    if (provinceContainer) {
      (provinceContainer as HTMLElement).style.display = '';
    }

    renderStates(provinceField, countryData);

    // `previousProvince`, captured at the top of the function — **not**
    // `provinceField.value`, which is what this used to read.
    //
    // That made the whole "keep a valid autofilled province" branch below unreachable,
    // including its `Kept autofilled state:` log, which could never print: by this point
    // the field has been overwritten twice (once with "Loading...", once by
    // `renderStates`), so the read always saw an empty string. The defect predates the
    // extraction — the original had the same ordering — and was found by the unit tests
    // written for this module afterwards.
    const currentProvinceValue = previousProvince;

    ctx.updateFormData({ province: '' });
    ctx.clearError('province');

    let validStateFound = false;
    if (currentProvinceValue) {
      const isValidState = countryData.states.some(
        state => state.code === currentProvinceValue
      );
      if (isValidState) {
        provinceField.value = currentProvinceValue;
        ctx.updateFormData({ province: currentProvinceValue });
        validStateFound = true;
        ctx.logger.debug(`Kept autofilled state: ${currentProvinceValue}`);
      } else {
        provinceField.value = '';
      }
    } else {
      provinceField.value = '';
    }

    // Nothing is auto-selected — the prompt stays chosen so the shopper makes the choice.
    if (!validStateFound) {
      provinceField.value = '';
      ctx.logger.debug(
        `No valid state found, showing placeholder: Select ${countryData.countryConfig.stateLabel}`
      );
    }
  } catch (error) {
    if (!isLatestRequest(provinceField, country)) return;
    ctx.logger.error('Failed to load states:', error);
    provinceField.innerHTML = originalHTML;
  } finally {
    if (isLatestRequest(provinceField, country)) provinceField.disabled = false;
  }
}

/**
 * The billing equivalent.
 *
 * Simpler than the shipping path in two ways that are deliberate, not oversights: it does
 * **not** hide the container for state-less countries, and it does **not** touch form data
 * or validation errors.
 *
 * Whatever the field ends up showing is written to the stored billing address, an empty
 * prompt included. Nothing else writes it when the list is rebuilt, so a new country used
 * to keep the old country's province (`GB` with state `CA`), and a pre-selected province
 * showed on screen while submit reported it missing.
 *
 * @param province Pre-selected when the new list has it: the shipping province, for the
 *   common case where the two differ only in street, or the stored one on restore.
 */
export async function updateBillingStateOptions(
  ctx: BillingStateFieldsContext,
  country: string,
  billingProvinceField: HTMLSelectElement,
  province?: string
): Promise<void> {
  requestedCountry.set(billingProvinceField, country);
  if (!country || country.trim() === '') {
    setPlaceholderOnly(billingProvinceField, 'Select Country First');
    ctx.setBillingProvince('');
    return;
  }

  billingProvinceField.disabled = true;
  const originalHTML = billingProvinceField.innerHTML;
  billingProvinceField.innerHTML = '<option value="">Loading...</option>';

  try {
    const countryData = await loadCountryStates(ctx, country, () => {
      ctx.logger.debug(
        `Reusing existing state loading promise for ${country} (billing)`
      );
    });
    if (!isLatestRequest(billingProvinceField, country)) return;

    updateBillingFormLabels(ctx.countryFields, countryData.countryConfig);
    renderStates(billingProvinceField, countryData);

    if (province) {
      billingProvinceField.value = province;
    }
    ctx.setBillingProvince(billingProvinceField.value);
  } catch (error) {
    if (!isLatestRequest(billingProvinceField, country)) return;
    ctx.logger.error('Failed to load billing states:', error);
    billingProvinceField.innerHTML = originalHTML;
  } finally {
    if (isLatestRequest(billingProvinceField, country)) {
      billingProvinceField.disabled = false;
    }
  }
}
