/**
 * Which country the checkout starts on, and what happens when something outside the form
 * changes it.
 *
 * A shopper can arrive at a checkout with a country already decided for them in four
 * different ways — they picked one on an earlier step, a link carried `?country=CA`, they
 * chose one earlier in the session, or the SDK guessed from their location. Those four
 * disagree often enough that the order between them is a product decision, not an
 * implementation detail, so it is written out once here rather than being re-derived at
 * each call site.
 *
 * **The order is: stored → URL → session → detected.** The first one that names a country
 * the campaign actually ships to wins; a country that is not shippable is logged and
 * skipped rather than silently accepted, so the shopper never sees a destination the
 * campaign will refuse.
 *
 * Extracted from `checkout-form.enhancer.ts`. Resolving needs three things
 * ({@link CountryResolutionContext}); applying a country to both address forms needs six
 * ({@link CountryApplicationContext}), which is the honest cost of the shipping and
 * billing sections each owning their own dropdown pair.
 */

import type { Country, CountryService } from '@/core/country-service';
import { scopedKey } from '@/core/storage';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import {
  updateBillingStateOptions,
  updateStateOptions,
  type ShippingStateFieldsContext,
  type StateFieldsContext,
} from './state-fields';

/** What resolving the starting country needs from the form. */
export interface CountryResolutionContext {
  /** Countries the campaign can ship to. A candidate absent from this list is rejected. */
  countries: Country[];
  /** Read for one thing: the configured default country, which is reported in the log. */
  countryService: CountryService;
  logger: Logger;
}

/** What applying a country to both address forms needs from it. */
export interface CountryApplicationContext {
  logger: Logger;
  /** Shipping fields by name. */
  fields: Map<string, HTMLElement>;
  /** Billing fields by name, `billing-` prefixed. */
  billingFields: Map<string, HTMLElement>;
  updateFormData: (data: Record<string, unknown>) => void;
  /** Refills the shipping province dropdown. */
  shippingStateFields: ShippingStateFieldsContext;
  /** Refills the billing province dropdown. */
  stateFields: StateFieldsContext;
}

/**
 * Picks the country the shipping form opens on.
 *
 * Only the URL branch writes its answer to session storage — a country that came from the
 * store or from detection is not remembered as an explicit choice.
 *
 * Currency is decided elsewhere and is not affected by any of this, which every log line
 * below repeats because the two were once conflated.
 *
 * @param detectedCountryCode The country the location lookup guessed — the fallback if
 *   nothing more specific applies.
 * @param storedCountry The country already in `formData`, from an earlier checkout step.
 *
 * @example
 * ```ts
 * const code = resolveShippingCountry(
 *   { countries, countryService, logger },
 *   locationData.detectedCountryCode,
 *   checkoutStore.formData.country
 * );
 * ```
 */
export function resolveShippingCountry(
  ctx: CountryResolutionContext,
  detectedCountryCode: string,
  storedCountry: string | undefined
): string {
  // Check for shipping country override from URL or sessionStorage
  // NOTE: This only affects the shipping country dropdown, NOT currency
  let selectedCountryCode = detectedCountryCode;

  const countryConfig = ctx.countryService.getConfig();

  ctx.logger.info(
    'Shipping country selection priority check (does not affect currency):',
    {
      detectedCountry: detectedCountryCode,
      addressConfigDefault: countryConfig?.defaultCountry,
      storedCountry: storedCountry,
      urlParam: new URLSearchParams(window.location.search).get('country'),
      sessionOverride: sessionStorage.getItem(
        scopedKey('next_selected_country')
      ),
    }
  );

  // Priority 1: Stored country from checkoutStore (from previous step)
  if (storedCountry) {
    const countryExists = ctx.countries.some(c => c.code === storedCountry);
    if (countryExists) {
      selectedCountryCode = storedCountry;
      ctx.logger.info(
        `✅ Using stored country from previous step: ${storedCountry}`
      );
    } else {
      ctx.logger.warn(
        `Stored country ${storedCountry} not in available countries`
      );
    }
  }
  // Priority 2: URL parameter (?country=XX for shipping destination)
  else {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCountry = urlParams.get('country');
    if (urlCountry) {
      const countryCode = urlCountry.toUpperCase();
      // Verify the country exists in the available countries
      const countryExists = ctx.countries.some(c => c.code === countryCode);
      if (countryExists) {
        selectedCountryCode = countryCode;
        // Save to sessionStorage for persistence
        sessionStorage.setItem(scopedKey('next_selected_country'), countryCode);
        ctx.logger.info(
          `✅ Using shipping country from URL parameter: ${countryCode} (currency unaffected)`
        );
      } else {
        ctx.logger.warn(
          `Country ${countryCode} from URL not in available countries`
        );
      }
    }
    // Priority 3: sessionStorage override (from previous URL param or user selection)
    else {
      const savedCountryOverride = sessionStorage.getItem(
        scopedKey('next_selected_country')
      );
      if (savedCountryOverride) {
        const countryExists = ctx.countries.some(
          c => c.code === savedCountryOverride
        );
        if (countryExists) {
          selectedCountryCode = savedCountryOverride;
          ctx.logger.info(
            `✅ Using shipping country from session storage: ${savedCountryOverride} (currency unaffected)`
          );
        } else {
          ctx.logger.warn(
            `Saved country ${savedCountryOverride} not in available countries`
          );
        }
      } else {
        ctx.logger.info(
          `✅ Using detected/default shipping country: ${selectedCountryCode} (currency unaffected)`
        );
      }
    }
  }

  return selectedCountryCode;
}

/**
 * Points both address forms at a country that was chosen somewhere other than the form's
 * own dropdown — today, the debug country selector.
 *
 * Each dropdown is set, its province list refilled, and then a bubbling `change` is
 * dispatched so anything else listening to the form reacts as it would to a shopper's own
 * selection. The billing half only runs when the page has a billing country field, and it
 * carries the shipping province across when the shopper asked for one address.
 *
 * @example
 * ```ts
 * await applyCountryToAddressForms(ctx, 'CA');
 * ```
 */
export async function applyCountryToAddressForms(
  ctx: CountryApplicationContext,
  newCountry: string
): Promise<void> {
  ctx.logger.info(`Handling country change to: ${newCountry}`);

  // Update the country dropdown
  const countryField = ctx.fields.get('country');
  if (countryField instanceof HTMLSelectElement) {
    countryField.value = newCountry;

    // Update form data in checkout store
    ctx.updateFormData({ country: newCountry });

    // Update state options for the new country
    const provinceField = ctx.fields.get('province');
    if (provinceField instanceof HTMLSelectElement) {
      await updateStateOptions(
        ctx.shippingStateFields,
        newCountry,
        provinceField
      );
    }

    // Trigger change event to update any dependent fields
    countryField.dispatchEvent(new Event('change', { bubbles: true }));

    ctx.logger.info(`Country field updated to: ${newCountry}`);
  }

  // Also update billing country if billing form is visible
  const billingCountryField = ctx.billingFields.get('billing-country');
  if (billingCountryField instanceof HTMLSelectElement) {
    billingCountryField.value = newCountry;

    // Update billing state options
    const billingProvinceField = ctx.billingFields.get('billing-province');
    if (billingProvinceField instanceof HTMLSelectElement) {
      // Pass the shipping province value if "same as shipping" is checked
      const checkoutStore = useCheckoutStore.getState();
      const shippingProvince = checkoutStore.sameAsShipping
        ? (checkoutStore.formData.province as string | undefined)
        : undefined;
      await updateBillingStateOptions(
        ctx.stateFields,
        newCountry,
        billingProvinceField,
        shippingProvince
      );
    }

    billingCountryField.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
