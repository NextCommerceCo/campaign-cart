/**
 * Which elements on the page become order data.
 *
 * A checkout form is plain HTML until this runs. Every input the shopper will fill is
 * found here, once, by the attribute the page author wrote on it — and from that moment
 * the rest of the form only ever talks to the **map**, never to the DOM. A field this
 * scan misses is a field that is never read, never validated and never submitted, however
 * visible it is on screen; that is the whole reason the scan is one place rather than a
 * `querySelector` in each handler.
 *
 * Two spellings are accepted for the same thing — `data-next-checkout-field` (current)
 * and `os-checkout-field` (legacy) — because live pages use both.
 *
 * Extracted from `checkout-form.enhancer.ts`. The scan needs four things
 * ({@link FieldScanContext}); the two lookups next to it need one and two, which is why
 * they take their own smaller contexts rather than the scan's.
 */

import type { Logger } from '@/core/logger';

import {
  scanExpirationFields,
  type ExpirationFieldsContext,
} from './expiration-fields';

/**
 * The two attributes a checkout input can be marked with, current spelling first.
 *
 * Both are scanned, so an element carrying both is stored once under each attribute's
 * value — normally the same name, and the later pass wins if they disagree.
 */
const FIELD_SELECTORS = [
  '[data-next-checkout-field]',
  '[os-checkout-field]',
] as const;

/**
 * A control the form can hold shut while an order is being placed.
 *
 * Both members have a `disabled` the browser itself honours — a disabled one cannot be
 * clicked, cannot be reached by keyboard, and cannot submit the form. That is the whole
 * requirement: the form's job during a submit is to make a second click impossible, not to
 * make one look impossible.
 */
export type SubmitControl = HTMLButtonElement | HTMLInputElement;

/** Where the submit control is looked for, in the order the first match wins. */
const SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  '[data-next-checkout-submit]',
  '[os-checkout-submit]',
] as const;

/**
 * The `<input>` types that submit a form, plus `button` — the three a page author writes
 * when they use an `<input>` as the pay control. A `text` or `checkbox` input carrying the
 * submit attribute is markup gone wrong, not a submit control.
 */
const SUBMIT_INPUT_TYPES = new Set(['submit', 'image', 'button']);

/**
 * The first element matching any submit selector that the form can actually disable.
 *
 * Each selector is exhausted before the next is tried, so a page whose
 * `data-next-checkout-submit` sits on an `<a>` still gets its `os-checkout-submit`
 * `<button>` found — the old `??` chain stopped at the first *match*, usable or not.
 */
function findSubmitControl(form: HTMLFormElement): SubmitControl | undefined {
  for (const selector of SUBMIT_SELECTORS) {
    for (const candidate of Array.from(form.querySelectorAll(selector))) {
      if (candidate instanceof HTMLButtonElement) return candidate;
      if (
        candidate instanceof HTMLInputElement &&
        SUBMIT_INPUT_TYPES.has(candidate.type)
      ) {
        return candidate;
      }
    }
  }
  return undefined;
}

/** What the scan needs from the checkout form. */
export interface FieldScanContext {
  /** The `<form>`. Checkout fields are only looked for inside it. */
  form: HTMLFormElement;
  /** Filled by the scan: field name → element. Existing entries are overwritten, not cleared. */
  fields: Map<string, HTMLElement>;
  /** Filled by the scan: payment method name → element. Searched across the whole document. */
  paymentButtons: Map<string, HTMLElement>;
  logger: Logger;
  /** Passed through so the card expiry dropdowns are found in the same pass. */
  expirationFields: ExpirationFieldsContext;
}

/** What {@link getFieldByName} needs: the two maps a field could be in. */
export interface FieldLookupContext {
  fields: Map<string, HTMLElement>;
  billingFields: Map<string, HTMLElement>;
}

/**
 * Finds every checkout field, payment button and expiry dropdown, and returns the submit
 * button if the form has one.
 *
 * The submit button is **returned rather than stored** because the caller keeps whatever
 * it already had when nothing is found — a re-scan of a form whose markup changed must not
 * blank a button that is still there.
 *
 * Recognized in order: `button[type="submit"]`, `input[type="submit"]`,
 * `[data-next-checkout-submit]`, `[os-checkout-submit]` — and from each of those, the
 * first `<button>` or submit-ish `<input>` ({@link SubmitControl}).
 *
 * An `<a>`, a `<div>` or a `<span>` carrying the attribute is still **rejected**, and the
 * warning below is what reports it. Those elements have no `disabled` the browser honours,
 * so accepting one would mean reporting a button held shut while the shopper could go on
 * clicking it — a silent failure in place of a loud one. Give the pay control a `<button>`
 * or an `<input type="submit">`.
 *
 * @example
 * ```ts
 * const submitButton = scanAllFields({
 *   form, fields, paymentButtons, logger, expirationFields: { fields },
 * });
 * // fields.get('email') → <input data-next-checkout-field="email">
 * ```
 */
export function scanAllFields(
  ctx: FieldScanContext
): SubmitControl | undefined {
  let submitButtonFound: SubmitControl | undefined;

  // Scan checkout fields
  FIELD_SELECTORS.forEach(selector => {
    ctx.form.querySelectorAll(selector).forEach(element => {
      const fieldName = element.getAttribute(
        selector.includes('data-next')
          ? 'data-next-checkout-field'
          : 'os-checkout-field'
      );
      if (fieldName && element instanceof HTMLElement) {
        ctx.fields.set(fieldName, element);
      }
    });
  });

  // Find submit button
  const submitButton = findSubmitControl(ctx.form);
  if (submitButton) {
    submitButtonFound = submitButton;
    ctx.logger.debug('Found submit button:', submitButton);
  } else {
    ctx.logger.warn('Submit button not found in checkout form');
  }

  // Scan payment buttons
  const paymentSelectors = [
    '[data-next-checkout-payment]',
    '[os-checkout-payment]',
  ];
  paymentSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      const paymentMethod = element.getAttribute(
        selector.includes('data-next')
          ? 'data-next-checkout-payment'
          : 'os-checkout-payment'
      );
      if (paymentMethod && element instanceof HTMLElement) {
        ctx.paymentButtons.set(paymentMethod, element);
      }
    });
  });

  // Scan for expiration fields and add them if not found
  scanExpirationFields(ctx.expirationFields);

  return submitButtonFound;
}

/**
 * The checkout name of the element a shopper just interacted with.
 *
 * Falls back to the element's `name` attribute when neither checkout attribute is present,
 * so a plain `<input name="postal">` inside an enhanced form still routes. Returns `null`
 * when there is no name at all, which is the signal to ignore the interaction entirely.
 *
 * @example
 * ```ts
 * getFieldNameFromElement(input); // <input os-checkout-field="fname"> → 'fname'
 * ```
 */
export function getFieldNameFromElement(element: HTMLElement): string | null {
  // `||`, not `??`: an element carrying `data-next-checkout-field=""` must fall through to
  // the legacy attribute rather than resolve to an empty name.
  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
  const checkoutFieldName =
    element.getAttribute('data-next-checkout-field') ||
    element.getAttribute('os-checkout-field');
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  if (checkoutFieldName) return checkoutFieldName;

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement
  ) {
    if (element.name) return element.name;
  }

  return null;
}

/**
 * The element behind a field name, shipping first and billing second.
 *
 * The two maps cannot collide in practice because every billing key carries the
 * `billing-` prefix the clone step gave it.
 *
 * @example
 * ```ts
 * getFieldByName({ fields, billingFields }, 'billing-postal');
 * ```
 */
export function getFieldByName(
  ctx: FieldLookupContext,
  fieldName: string
): HTMLElement | null {
  // Check shipping fields first
  const shippingField = ctx.fields.get(fieldName);
  if (shippingField) return shippingField;

  // Check billing fields
  const billingField = ctx.billingFields.get(fieldName);
  if (billingField) return billingField;

  return null;
}
