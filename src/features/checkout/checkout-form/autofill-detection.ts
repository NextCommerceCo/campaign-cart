/**
 * Notices when the **browser** fills the checkout form, which fires no events the SDK can
 * listen for.
 *
 * A shopper using Chrome's saved-address autofill never types, never focuses a field, and
 * triggers no `input` or `change` — so without this the store would still hold empty
 * values while the form visibly shows a full address, and the order would submit blank.
 * There is no autofill event in any browser, so the only way to detect it is to **poll**:
 * compare each field's value against its last known one every 500 ms and treat a change
 * that happened while the field was *not* focused as autofill.
 *
 * Extracted from `checkout-form.enhancer.ts`. It needs four things
 * ({@link AutofillDetectionContext}) and calls none of the enhancer's methods.
 *
 * **Polling stops after 30 seconds** — autofill happens on arrival or not at all, and a
 * timer running for the life of the page would cost more than it catches.
 */

import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import type { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

/** How often to compare field values. */
const CHECK_INTERVAL_MS = 500;
/** 60 × 500 ms = 30 seconds of watching, then the interval stops. */
const MAX_CHECKS = 60;
/** How long to ignore field changes after Google Places fills the address. */
const AUTOCOMPLETE_PAUSE_MS = 2000;
/** Let the store settle before reading it to decide on the analytics event. */
const STORE_SETTLE_MS = 100;

/** Fields whose value changing must not be treated as autofill. */
const ADDRESS_FIELDS = new Set(['address1', 'address']);
/** Fields whose `change` event has side effects too big to fire from a poll. */
const SIDE_EFFECT_FIELDS = new Set(['country', 'billing-country']);

/** What this module needs from the checkout form. */
export interface AutofillDetectionContext {
  /** Listened to for `address:autocomplete-filled`, which pauses detection. */
  eventBus: EventBus;
  /** The fields to watch. Read live, so fields added after setup are picked up. */
  fields: Map<string, HTMLElement>;
  /**
   * Whether `add_shipping_info` has already been sent. A ref because the enhancer sets it
   * from other paths too — a copied boolean would let the event fire twice.
   */
  hasTrackedShippingInfo: { value: boolean };
  logger: Logger;
}

/** The field types whose `.value` is worth comparing. */
type ValueField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isValueField(element: HTMLElement): element is ValueField {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

/**
 * First value that is neither `null` nor empty.
 *
 * Spelled out rather than chaining `||`, and deliberately not `??`: `getAttribute` returns
 * `''` for a present-but-empty attribute, so an element carrying
 * `data-next-checkout-field=""` has to fall through to the next candidate. `??` only falls
 * through on `null` and would settle on the empty string.
 */
function firstNonEmpty(...values: Array<string | null>): string {
  return values.find(value => value !== null && value !== '') ?? '';
}

/** The name the SDK knows a field by, under either attribute or falling back to `name`. */
function fieldNameOf(field: ValueField): string {
  return firstNonEmpty(
    field.getAttribute('data-next-checkout-field'),
    field.getAttribute('os-checkout-field'),
    field.name
  );
}

/** Snapshots every watchable field's current value. */
function snapshot(
  fields: Map<string, HTMLElement>,
  into: Map<HTMLElement, string>
): void {
  [...fields.values()].forEach(field => {
    if (isValueField(field)) into.set(field, field.value);
  });
}

/**
 * Starts watching for browser autofill.
 *
 * @returns A teardown function. Call it on `destroy()`; it stops the poll **and**
 *   unsubscribes from the event bus.
 *
 *   Both halves matter. It used to return just the interval handle, so the caller could
 *   only `clearInterval` — the `address:autocomplete-filled` subscription was never
 *   removed, and `EventBus` is a singleton. A second `setupAutofillDetection` on the same
 *   page therefore left the first one's handler attached: it would still fire on the next
 *   autocomplete, schedule its own resume timer, and re-snapshot a `fieldValues` map that
 *   no longer matched any live field. (Before that it was stashed on the enhancer via
 *   `(this as any).autofillInterval`, which type-checked at neither the set nor the clear.)
 */
export function setupAutofillDetection(
  ctx: AutofillDetectionContext
): () => void {
  const fieldValues = new Map<HTMLElement, string>();

  // Google Places fills fields programmatically, which looks exactly like autofill from
  // here. Without this pause, its writes would each be reported as autofill and would
  // re-dispatch `change` on fields it is still in the middle of populating.
  let isAutofillDetectionPaused = false;
  const onAutocompleteFilled = (): void => {
    isAutofillDetectionPaused = true;
    setTimeout(() => {
      isAutofillDetectionPaused = false;
      // Re-baseline, or everything Places just wrote counts as autofill on resume.
      snapshot(ctx.fields, fieldValues);
    }, AUTOCOMPLETE_PAUSE_MS);
  };
  ctx.eventBus.on('address:autocomplete-filled', onAutocompleteFilled);

  snapshot(ctx.fields, fieldValues);

  let checkCount = 0;
  const checkInterval = setInterval(() => {
    checkCount++;

    if (isAutofillDetectionPaused) return;

    let hasAutofill = false;
    const autofilledFields: string[] = [];

    [...ctx.fields.values()].forEach(field => {
      if (!isValueField(field)) return;

      const oldValue = fieldValues.get(field) ?? '';
      const newValue = field.value;
      const fieldName = fieldNameOf(field);

      // The address line is Google Places' territory; track its value so it is not
      // reported later, but never act on it here.
      if (ADDRESS_FIELDS.has(fieldName)) {
        fieldValues.set(field, newValue);
        return;
      }

      // Changed, non-empty, and not the field the shopper is typing in → autofill.
      const looksAutofilled =
        newValue !== oldValue &&
        newValue !== '' &&
        document.activeElement !== field;
      if (!looksAutofilled) return;

      hasAutofill = true;
      fieldValues.set(field, newValue);
      if (fieldName) autofilledFields.push(fieldName);

      // Country is skipped on purpose: its `change` loads a state list and rebuilds the
      // province field, which would discard the province autofill has just written.
      // `state-fields.ts` keeps a valid autofilled province when the country does change.
      if (!SIDE_EFFECT_FIELDS.has(fieldName)) {
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    if (hasAutofill && autofilledFields.length > 0) {
      ctx.logger.info(
        'Browser autofill detected for fields:',
        autofilledFields
      );

      // The `change` events above update the store asynchronously, so the city and
      // province needed below are not there yet on this tick.
      setTimeout(() => {
        const checkoutStore = useCheckoutStore.getState();
        if (
          !ctx.hasTrackedShippingInfo.value &&
          checkoutStore.formData.city &&
          checkoutStore.formData.province
        ) {
          try {
            const shippingMethod = checkoutStore.shippingMethod;
            const shippingTier = shippingMethod
              ? shippingMethod.name
              : 'Standard';
            nextAnalytics.track(
              EcommerceEvents.createAddShippingInfoEvent(shippingTier)
            );
            ctx.hasTrackedShippingInfo.value = true;
            ctx.logger.info(
              'Tracked add_shipping_info event (browser autofill)',
              { shippingTier }
            );
          } catch (error) {
            ctx.logger.warn(
              'Failed to track add_shipping_info event after browser autofill:',
              error
            );
          }
        }
      }, STORE_SETTLE_MS);
    }

    if (checkCount >= MAX_CHECKS) {
      clearInterval(checkInterval);
      ctx.logger.debug('Stopped autofill detection after 30 seconds');
    }
  }, CHECK_INTERVAL_MS);

  return () => {
    clearInterval(checkInterval);
    ctx.eventBus.off('address:autocomplete-filled', onAutocompleteFilled);
  };
}
