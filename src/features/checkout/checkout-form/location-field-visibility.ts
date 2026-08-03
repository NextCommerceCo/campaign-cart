/**
 * The city / state / postcode rows that stay hidden until there is a street address.
 *
 * Long checkout forms convert worse than short ones, so a page can mark those rows
 * `data-next-component="location"` and they start collapsed. The moment the shopper has
 * typed — or autofilled, or autocompleted — a street address, they appear. Shipping and
 * billing each have their own set and their own "already shown" latch, because revealing
 * one must not reveal the other.
 *
 * **One-way only.** Nothing ever hides these rows again once shown; clearing the address
 * leaves them on screen. That is deliberate — a row vanishing under a shopper mid-form is
 * worse than an empty one.
 *
 * Extracted from `checkout-form.enhancer.ts`. The module owns the four pieces of state
 * this job needs (the two element lists and the two latches) rather than borrowing them,
 * so what it needs from the form is the six things in {@link LocationFieldsContext}.
 *
 * One wire deliberately stayed behind: the `address:autocomplete-filled` subscription
 * lives with the form's other event-bus wiring, and calls back in through
 * {@link LocationFieldVisibility.showLocationFields}. Keeping it there is what lets the
 * teardown test prove the subscription dies with the form.
 */

import type { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

/** What this module needs from the checkout form. */
export interface LocationFieldsContext {
  /** The `<form>`. Both element sets are looked for inside it, and it carries the DOM events. */
  form: HTMLFormElement;
  /** Shipping fields by name — read for `address1`. */
  fields: Map<string, HTMLElement>;
  /** Billing fields by name — read for `billing-address1`. */
  billingFields: Map<string, HTMLElement>;
  logger: Logger;
  /** Used directly, matching the original: these two events carry no enhancer metadata. */
  eventBus: EventBus;
  /** The form's lifetime-bound `addEventListener`, so the address listeners die with it. */
  listen: (
    target: Document | Window | HTMLElement,
    type: string,
    handler: (event: Event) => void
  ) => void;
}

/** The three things the form drives this module through. */
export interface LocationFieldVisibility {
  /** Finds the rows, hides them, then reveals either set that already has an address. */
  initialize(): void;
  /** Reveals the shipping rows. Does nothing after the first call. */
  showLocationFields(): void;
  /** Reveals the billing rows. Does nothing after the first call. */
  showBillingLocationFields(): void;
}

/**
 * Builds the controller the checkout form drives.
 *
 * Nothing happens until {@link LocationFieldVisibility.initialize} is called, and it must
 * run **after** the stored form data has been put back into the inputs — it decides
 * whether to reveal each set by reading the address input's current value, so a value
 * written later would sit behind an already-answered check and the rows would stay
 * hidden.
 *
 * @example
 * ```ts
 * const locationFields = createLocationFieldVisibility({
 *   form, fields, billingFields, logger, eventBus,
 *   listen: (t, type, h) => this.listen(t, type, h),
 * });
 * locationFields.initialize();
 * locationFields.showLocationFields(); // an address arrived from somewhere else
 * ```
 */
export function createLocationFieldVisibility(
  ctx: LocationFieldsContext
): LocationFieldVisibility {
  let locationElements: NodeListOf<Element> | null = null;
  let billingLocationElements: NodeListOf<Element> | null = null;
  let locationFieldsShown = false;
  let billingLocationFieldsShown = false;

  function hideLocationFields(): void {
    if (!locationElements) return;

    locationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
        el.classList.add('next-location-hidden');
      }
    });

    locationFieldsShown = false;
    ctx.logger.debug('Location fields hidden');
  }

  function showLocationFields(): void {
    if (locationFieldsShown || !locationElements) return;

    locationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'flex';
        el.classList.remove('next-location-hidden');
      }
    });

    locationFieldsShown = true;

    // Emit event for other components
    ctx.eventBus.emit('checkout:location-fields-shown', {});
    ctx.form.dispatchEvent(new CustomEvent('checkout:location-fields-shown'));

    ctx.logger.debug('Location fields shown');
  }

  function hideBillingLocationFields(): void {
    if (!billingLocationElements) return;

    billingLocationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
        el.classList.add('next-location-hidden');
      }
    });

    billingLocationFieldsShown = false;
    ctx.logger.debug('Billing location fields hidden');
  }

  function showBillingLocationFields(): void {
    if (billingLocationFieldsShown || !billingLocationElements) return;

    billingLocationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'flex';
        el.classList.remove('next-location-hidden');
      }
    });

    billingLocationFieldsShown = true;

    // Emit event for other components
    ctx.eventBus.emit('checkout:billing-location-fields-shown', {});
    ctx.form.dispatchEvent(
      new CustomEvent('checkout:billing-location-fields-shown')
    );

    ctx.logger.debug('Billing location fields shown');
  }

  function handleAddressInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.value && field.value.trim().length > 0) {
      showLocationFields();
    }
  }

  function handleBillingAddressInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.value && field.value.trim().length > 0) {
      showBillingLocationFields();
    }
  }

  function initialize(): void {
    // Find all location elements - check both possible attributes
    locationElements = ctx.form.querySelectorAll(
      '[data-next-component="location"], [data-next-component-location="location"]'
    );

    // Also find billing location elements
    billingLocationElements = ctx.form.querySelectorAll(
      '[data-next-component="billing-location"]'
    );

    if (!locationElements || locationElements.length === 0) {
      ctx.logger.debug('No shipping location elements found');
    }

    if (!billingLocationElements || billingLocationElements.length === 0) {
      ctx.logger.debug('No billing location elements found');
    }

    // Hide location fields initially
    hideLocationFields();
    hideBillingLocationFields();

    // Set up address field listeners for shipping
    const addressField = ctx.fields.get('address1');
    if (addressField instanceof HTMLInputElement) {
      // Listen for changes on address1 field
      ctx.listen(addressField, 'input', handleAddressInput);
      ctx.listen(addressField, 'change', handleAddressInput);
      ctx.listen(addressField, 'blur', handleAddressInput);

      // Check initial state
      if (addressField.value && addressField.value.trim().length > 0) {
        showLocationFields();
      }
    }

    // Set up address field listeners for billing
    const billingAddressField = ctx.billingFields?.get('billing-address1');
    if (billingAddressField instanceof HTMLInputElement) {
      // Listen for changes on billing address1 field
      ctx.listen(billingAddressField, 'input', handleBillingAddressInput);
      ctx.listen(billingAddressField, 'change', handleBillingAddressInput);
      ctx.listen(billingAddressField, 'blur', handleBillingAddressInput);

      // Check initial state
      if (
        billingAddressField.value &&
        billingAddressField.value.trim().length > 0
      ) {
        showBillingLocationFields();
      }
    }

    // Listen for address field changes via store updates
    const formData = useCheckoutStore.getState().formData as Record<
      string,
      string | undefined
    >;
    if (formData.address1 && formData.address1.trim().length > 0) {
      showLocationFields();
    }
    if (
      formData['billing-address1'] &&
      formData['billing-address1'].trim().length > 0
    ) {
      showBillingLocationFields();
    }

    ctx.logger.debug('Location field visibility initialized', {
      shippingLocationElementsCount: locationElements?.length || 0,
      billingLocationElementsCount: billingLocationElements?.length || 0,
    });
  }

  return { initialize, showLocationFields, showBillingLocationFields };
}
