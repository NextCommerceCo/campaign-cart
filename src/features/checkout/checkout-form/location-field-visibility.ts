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

/** The four things the form drives this module through. */
export interface LocationFieldVisibility {
  /** Finds the rows, hides them, then reveals either set that already has an address. */
  initialize(): void;
  /**
   * Runs the same scan again for rows and address inputs that arrived after boot. A set
   * already revealed stays revealed, new rows included.
   */
  refresh(): void;
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
  const boundInputs = new WeakSet<HTMLInputElement>();

  /** Applies the current latch to every row, including rows found since the last scan. */
  function applyVisibility(
    elements: NodeListOf<Element> | null,
    shown: boolean
  ): void {
    elements?.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = shown ? 'flex' : 'none';
        el.classList.toggle('next-location-hidden', !shown);
      }
    });
  }

  function showLocationFields(): void {
    if (locationFieldsShown || !locationElements) return;

    locationFieldsShown = true;
    applyVisibility(locationElements, true);

    // Emit event for other components
    ctx.eventBus.emit('checkout:location-fields-shown', {});
    ctx.form.dispatchEvent(new CustomEvent('checkout:location-fields-shown'));

    ctx.logger.debug('Location fields shown');
  }

  function showBillingLocationFields(): void {
    if (billingLocationFieldsShown || !billingLocationElements) return;

    billingLocationFieldsShown = true;
    applyVisibility(billingLocationElements, true);

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

  function hasValue(field: HTMLElement | undefined): boolean {
    return (
      field instanceof HTMLInputElement &&
      Boolean(field.value) &&
      field.value.trim().length > 0
    );
  }

  /** A `data-next-address` rebuild replaces the input, so the new one needs binding too. */
  function bindAddressInput(
    field: HTMLElement | undefined,
    handler: (event: Event) => void
  ): void {
    if (!(field instanceof HTMLInputElement) || boundInputs.has(field)) return;
    boundInputs.add(field);
    ctx.listen(field, 'input', handler);
    ctx.listen(field, 'change', handler);
    ctx.listen(field, 'blur', handler);
  }

  function scan(): void {
    locationElements = ctx.form.querySelectorAll(
      '[data-next-component="location"], [data-next-component-location="location"]'
    );
    billingLocationElements = ctx.form.querySelectorAll(
      '[data-next-component="billing-location"]'
    );

    applyVisibility(locationElements, locationFieldsShown);
    applyVisibility(billingLocationElements, billingLocationFieldsShown);

    const addressField = ctx.fields.get('address1');
    const billingAddressField = ctx.billingFields?.get('billing-address1');
    bindAddressInput(addressField, handleAddressInput);
    bindAddressInput(billingAddressField, handleBillingAddressInput);

    const formData = useCheckoutStore.getState().formData as Record<
      string,
      string | undefined
    >;
    if (hasValue(addressField) || formData.address1?.trim()) {
      showLocationFields();
    }
    if (hasValue(billingAddressField) || formData['billing-address1']?.trim()) {
      showBillingLocationFields();
    }
  }

  function initialize(): void {
    scan();

    if (locationElements?.length === 0) {
      ctx.logger.debug('No shipping location elements found');
    }
    if (billingLocationElements?.length === 0) {
      ctx.logger.debug('No billing location elements found');
    }

    ctx.logger.debug('Location field visibility initialized', {
      shippingLocationElementsCount: locationElements?.length || 0,
      billingLocationElementsCount: billingLocationElements?.length || 0,
    });
  }

  return {
    initialize,
    refresh: scan,
    showLocationFields,
    showBillingLocationFields,
  };
}
