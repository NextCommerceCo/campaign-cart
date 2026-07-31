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
 * ({@link ShippingStateFieldsContext}); billing needs four ({@link StateFieldsContext}),
 * which is why the context is split rather than one shape with fields billing would have to
 * supply and never use.
 */

import type {
  CountryConfig,
  CountryService,
  CountryStatesData,
} from '@/core/country-service';
import type { Logger } from '@/core/logger';

import {
  updateBillingFormLabels,
  updateFormLabels,
  type CountryFieldsContext,
} from './country-fields';

/** Containers a province field might sit in, for hiding the whole row rather than the input. */
const FIELD_CONTAINERS = '.frm-flds, .form-group, .form-field, .field-group';

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
  countryService: CountryService;
  logger: Logger;
  /** Passed through to the label helpers, which relabel the neighbouring fields. */
  countryFields: CountryFieldsContext;
}

/** What the shipping path additionally needs. */
export interface ShippingStateFieldsContext extends StateFieldsContext {
  /** Per-country config cache, written as each country resolves. */
  countryConfigs: Map<string, CountryConfig>;
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

  const request = ctx.countryService.getCountryStates(country);
  ctx.stateLoadingPromises.set(country, request);
  // `void`: this is cache housekeeping, not part of the caller's result. The caller awaits
  // `request` itself, so a rejection is handled there — attaching `.catch` here as well
  // would swallow nothing but would imply this branch owns the error.
  void request.finally(() => {
    setTimeout(
      () => ctx.stateLoadingPromises.delete(country),
      PROMISE_CLEANUP_MS
    );
  });
  return request;
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
  if (!country || country.trim() === '') {
    setPlaceholderOnly(provinceField, 'Select Country First');
    return;
  }

  provinceField.disabled = true;
  const originalHTML = provinceField.innerHTML;
  provinceField.innerHTML = '<option value="">Loading...</option>';

  try {
    const countryData = await loadCountryStates(ctx, country, () => {
      ctx.logger.debug(`Reusing existing state loading promise for ${country}`);
    });

    ctx.countryConfigs.set(country, countryData.countryConfig);
    ctx.currentCountryConfig.value = countryData.countryConfig;

    updateFormLabels(ctx.countryFields, countryData.countryConfig);

    const hasStates = countryData.states && countryData.states.length > 0;
    const stateRequired = countryData.countryConfig.stateRequired;

    const provinceContainer =
      provinceField.closest(FIELD_CONTAINERS) ?? provinceField.parentElement;

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

    // Read before clearing: this may be an autofilled value worth keeping.
    const currentProvinceValue = provinceField.value;

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
    ctx.logger.error('Failed to load states:', error);
    provinceField.innerHTML = originalHTML;
  } finally {
    provinceField.disabled = false;
  }
}

/**
 * The billing equivalent.
 *
 * Simpler than the shipping path in two ways that are deliberate, not oversights: it does
 * **not** hide the container for state-less countries, and it does **not** touch form data
 * or validation errors — billing province is read off the field at submit time rather than
 * mirrored into the store as it changes.
 *
 * @param shippingProvince Pre-selects the same region as the shipping address, for the
 *   common case where the two differ only in street.
 */
export async function updateBillingStateOptions(
  ctx: StateFieldsContext,
  country: string,
  billingProvinceField: HTMLSelectElement,
  shippingProvince?: string
): Promise<void> {
  if (!country || country.trim() === '') {
    setPlaceholderOnly(billingProvinceField, 'Select Country First');
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

    updateBillingFormLabels(ctx.countryFields, countryData.countryConfig);
    renderStates(billingProvinceField, countryData);

    if (shippingProvince) {
      billingProvinceField.value = shippingProvince;
    }
  } catch (error) {
    ctx.logger.error('Failed to load billing states:', error);
    billingProvinceField.innerHTML = originalHTML;
  } finally {
    billingProvinceField.disabled = false;
  }
}
