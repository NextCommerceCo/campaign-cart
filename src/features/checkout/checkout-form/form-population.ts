/**
 * Putting stored values back into the boxes, and taking them all out again.
 *
 * A shopper who reloads the checkout, walks back a step, or returns from an express
 * payment must see the details they already typed. The checkout store is what remembers
 * them; this module is what puts them on screen. It is the mirror image of the field
 * routing that filled the store in the first place — so the two must agree about names,
 * and about the province dropdown in particular, which cannot hold a value until its
 * country's options have loaded.
 *
 * The opposite job lives here too: {@link clearAllCheckoutFields} empties every box and
 * resets the store, which is what happens after a shopper is warned that their order
 * already went through.
 *
 * Extracted from `checkout-form.enhancer.ts`. Repopulating needs six things
 * ({@link FormPopulationContext}) and clearing needs five ({@link FormClearingContext}) —
 * they overlap on only three, which is why they take separate contexts rather than one
 * shared shape.
 */

import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

import type { Iti } from 'intl-tel-input';

import {
  updateStateOptions,
  type ShippingStateFieldsContext,
} from './state-fields';

/** How long `intl-tel-input` is given to digest a value written straight into its input. */
const PHONE_REFORMAT_DELAY_MS = 50;

/**
 * What one checkout field is worth in the store: text for most, a boolean for a checkbox
 * or radio (`readFieldValue` converts those), a number for anything numeric a caller
 * writes. `undefined` means the shopper has not given an answer.
 */
type StoredFieldValue = string | number | boolean;

/**
 * Whether a stored value is an answer the shopper gave, and so worth putting back.
 *
 * `false` and `0` are answers — an unticked marketing box is an opt-out that has to
 * survive a reload, and both are kept by the store's `partialize`, so both really do come
 * back from sessionStorage. `''` is not: the store strips empty strings before persisting,
 * so an empty string can only ever be an in-session blank, and writing it back would wipe
 * whatever boot or the page's own markup had just put in the box — the country dropdown
 * being the live example.
 */
function isStoredAnswer(
  value: StoredFieldValue | null | undefined
): value is StoredFieldValue {
  return value !== undefined && value !== null && value !== '';
}

/** What repopulating the form needs from it. */
export interface FormPopulationContext {
  /** Shipping fields by name. */
  fields: Map<string, HTMLElement>;
  /** The country resolved at boot. A stored country equal to it means states are already loaded. */
  detectedCountryCode: string;
  logger: Logger;
  /** Keyed `shipping` / `billing`; used to re-read the phone in international format. */
  phoneInputs: Map<string, Iti>;
  /** Passed through to refill the province dropdown when the stored country differs. */
  shippingStateFields: ShippingStateFieldsContext;
  updateFormData: (data: Record<string, unknown>) => void;
  /** Floats the labels of the boxes that just gained a value. */
  updateLabelsForPopulatedData: () => void;
}

/** What clearing the form needs from it. */
export interface FormClearingContext {
  /** The `<form>`, for finding the billing toggle. */
  form: HTMLFormElement;
  /** Shipping fields by name. */
  fields: Map<string, HTMLElement>;
  /** Billing fields by name, `billing-` prefixed. */
  billingFields: Map<string, HTMLElement>;
  /** The country the dropdown is put back to. */
  detectedCountryCode: string;
  logger: Logger;
  /** Optional: the hosted card fields are only clearable once Spreedly has loaded. */
  clearCardFields?: (() => void) | undefined;
}

/**
 * Writes the stored checkout data back into the form's inputs.
 *
 * Order matters and is the reason this is not one loop. The country goes first, because a
 * province `<select>` can only be given a value once that country's options exist; the
 * generic loop then skips the province for exactly that reason; and the province is set
 * last, after the options have loaded. A phone written straight into the input is national
 * text until `intl-tel-input` reformats it, which is why the store is corrected on a short
 * delay rather than immediately.
 *
 * A checkbox or radio is put back through `checked`, never `value` — the store holds a
 * boolean for it, and writing that into `value` would leave the tick exactly as the markup
 * shipped it. That is what made an unticked marketing box come back ticked. Only a value
 * the shopper never gave is skipped; see {@link isStoredAnswer} for why an empty string
 * counts as "never gave".
 *
 * @example
 * ```ts
 * await populateFormData({
 *   fields, detectedCountryCode, logger, phoneInputs,
 *   shippingStateFields, updateFormData, updateLabelsForPopulatedData,
 * });
 * ```
 */
export async function populateFormData(
  ctx: FormPopulationContext
): Promise<void> {
  const checkoutStore = useCheckoutStore.getState();
  // `formData` is `Record<string, any>` on the store; narrowing it here keeps the reads
  // below typed without changing a single value.
  const formData = checkoutStore.formData as Record<
    string,
    StoredFieldValue | undefined
  >;

  // Check if country is stored and different from current
  const storedCountry = formData.country;
  const countryField = ctx.fields.get('country');

  if (
    typeof storedCountry === 'string' &&
    storedCountry &&
    countryField instanceof HTMLSelectElement
  ) {
    // Set country first
    countryField.value = storedCountry;

    // If country changed, load states for that country
    const currentCountryValue = countryField.value;
    if (
      currentCountryValue &&
      currentCountryValue !== ctx.detectedCountryCode
    ) {
      ctx.logger.info(`Restoring saved country: ${currentCountryValue}`);

      // Load states for the stored country
      const provinceField = ctx.fields.get('province');
      if (provinceField instanceof HTMLSelectElement) {
        await updateStateOptions(
          ctx.shippingStateFields,
          currentCountryValue,
          provinceField
        );
      }
    }
  }

  // Now populate all fields including province
  ctx.fields.forEach((field, name) => {
    const stored = formData[name];
    if (
      !isStoredAnswer(stored) ||
      !(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)
    ) {
      return;
    }

    // Skip province if we just loaded states - it will be set below
    if (name === 'province' && field instanceof HTMLSelectElement) return;

    if (
      field instanceof HTMLInputElement &&
      (field.type === 'checkbox' || field.type === 'radio')
    ) {
      // Mirror of `readFieldValue`, which stores a tick as a boolean.
      field.checked = Boolean(stored);
      return;
    }

    field.value = String(stored);
  });

  // After populating phone field, ensure it's stored in international format
  // This handles the case where phone was persisted in national format before intlTelInput processed it
  const shippingPhoneInstance = ctx.phoneInputs.get('shipping');
  if (shippingPhoneInstance && formData.phone) {
    // Give intlTelInput a moment to process the value we just set
    setTimeout(() => {
      const internationalNumber = shippingPhoneInstance.getNumber();
      if (internationalNumber && internationalNumber !== formData.phone) {
        ctx.logger.debug(
          `Converting phone to international format: ${formData.phone} -> ${internationalNumber}`
        );
        ctx.updateFormData({ phone: internationalNumber });
      }
    }, PHONE_REFORMAT_DELAY_MS);
  }

  // Set province value after states are loaded
  const storedProvince = formData.province;
  const provinceField = ctx.fields.get('province');

  if (
    typeof storedProvince === 'string' &&
    storedProvince &&
    provinceField instanceof HTMLSelectElement
  ) {
    // Check if the option exists
    const optionExists = Array.from(provinceField.options).some(
      opt => opt.value === storedProvince
    );

    if (optionExists) {
      provinceField.value = storedProvince;
      // IMPORTANT: Also update the store since updateStateOptions cleared it
      ctx.updateFormData({ province: storedProvince });
      ctx.logger.debug(`Restored province: ${storedProvince}`);
    } else {
      ctx.logger.warn(
        `Province ${storedProvince} not found in options for country ${storedCountry}`
      );
    }
  }

  // Update floating labels for populated data
  ctx.updateLabelsForPopulatedData();
}

/**
 * Empties every shipping and billing box, wipes the hosted card fields, and resets the
 * checkout store.
 *
 * Used after the duplicate-purchase warning: the shopper stays on the page, so the form
 * has to look like a fresh one rather than one still holding the order that already went
 * through. The country dropdown is put back to the detected country and the billing
 * toggle back to "same as shipping", both by dispatching a real `change` so the rest of
 * the form reacts exactly as it would to a shopper doing it.
 *
 * Never throws: a failure here would leave the shopper stuck behind a modal, so it is
 * logged and swallowed.
 *
 * @example
 * ```ts
 * clearAllCheckoutFields({
 *   form, fields, billingFields, detectedCountryCode, logger,
 *   clearCardFields: () => creditCardService.clearFields(),
 * });
 * ```
 */
export function clearAllCheckoutFields(ctx: FormClearingContext): void {
  try {
    // Clear all shipping fields
    ctx.fields.forEach(field => {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          (field as HTMLInputElement).checked = false;
        } else {
          field.value = '';
        }
      } else if (field instanceof HTMLSelectElement) {
        field.selectedIndex = 0;
      }
    });

    // Clear all billing fields
    ctx.billingFields.forEach(field => {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          (field as HTMLInputElement).checked = false;
        } else {
          field.value = '';
        }
      } else if (field instanceof HTMLSelectElement) {
        field.selectedIndex = 0;
      }
    });

    // Clear credit card fields if credit card service exists
    if (ctx.clearCardFields) {
      ctx.clearCardFields();
    }

    // Reset checkout store
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.reset();

    // Clear any errors
    checkoutStore.clearAllErrors();

    // Re-initialize country dropdowns with detected country
    const countryField = ctx.fields.get('country');
    if (countryField instanceof HTMLSelectElement && ctx.detectedCountryCode) {
      countryField.value = ctx.detectedCountryCode;
      countryField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Reset billing same as shipping checkbox
    const billingToggle = ctx.form.querySelector(
      'input[name="use_shipping_address"]'
    ) as HTMLInputElement;
    if (billingToggle) {
      billingToggle.checked = true;
      billingToggle.dispatchEvent(new Event('change', { bubbles: true }));
    }

    ctx.logger.info('All checkout fields cleared');
  } catch (error) {
    ctx.logger.error('Error clearing checkout fields:', error);
  }
}
