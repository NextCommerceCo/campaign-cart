/**
 * Which problem to take the shopper to, and how to get them there.
 *
 * A failed submit usually produces several messages at once. Showing them all is right;
 * jumping to a random one is not — so this picks the field that sits **highest on the
 * page**, which is the one the shopper will read first, then scrolls and focuses it.
 *
 * Card fields are the exception: the number and CVV are rendered inside the payment
 * provider's iframe, so the page cannot focus them. They are handed to Spreedly's own
 * `transferFocus` instead.
 *
 * Extracted verbatim from `CheckoutValidator`. Neither function needs anything from the
 * validator — both reach the DOM through `FieldFinder`.
 */

import { FieldFinder } from '../utils/field-finder-utils';

function findFormField(fieldName: string): HTMLElement | null {
  return FieldFinder.findField(fieldName);
}

/**
 * Picks the error field that appears highest on the page.
 *
 * Fields that are not in the DOM (a card field inside the payment iframe, a field the page
 * does not render) cannot be positioned, so they are skipped. If *none* of the error fields
 * can be found, the first key of the errors object is returned so the caller still has
 * something to point at.
 *
 * @param errors Field name → message, as returned by form or step validation.
 * @returns The field name to focus, or `undefined` when there are no errors.
 *
 * @example
 * ```ts
 * // 'fname' sits above 'email' in the markup, so it wins regardless of key order
 * findFirstErrorFieldInDOM({ email: 'Invalid', fname: 'Required' }); // 'fname'
 * ```
 */
export function findFirstErrorFieldInDOM(
  errors: Record<string, string>
): string | undefined {
  // Get all form fields with errors
  const errorFieldNames = Object.keys(errors);
  if (errorFieldNames.length === 0) return undefined;

  // Find all fields in the DOM
  const fieldsInDOM: {
    name: string;
    element: HTMLElement;
    position: number;
  }[] = [];

  errorFieldNames.forEach(fieldName => {
    const field = findFormField(fieldName);
    if (field) {
      const rect = field.getBoundingClientRect();
      const position = rect.top + window.scrollY; // Get absolute position from top of document
      fieldsInDOM.push({ name: fieldName, element: field, position });
    }
  });

  // Sort by position and return the first one
  if (fieldsInDOM.length > 0) {
    fieldsInDOM.sort((a, b) => a.position - b.position);
    return fieldsInDOM[0].name;
  }

  // Fallback to first error in the errors object
  return errorFieldNames[0];
}

/**
 * Scrolls the named field into view and focuses it once the scroll has settled.
 *
 * The focus is delayed 800 ms on purpose: focusing mid-scroll makes the browser jump, and
 * on mobile it opens the keyboard over the field the shopper is being shown.
 *
 * @param firstErrorField Field name from {@link findFirstErrorFieldInDOM}. Passing
 * `undefined` does nothing, so a valid form needs no guard at the call site.
 *
 * @example
 * ```ts
 * focusFirstErrorField(validation.firstErrorField);
 * ```
 */
export function focusFirstErrorField(firstErrorField?: string): void {
  if (!firstErrorField) return;

  const ccFields = [
    'cc-month',
    'cc-year',
    'number',
    'cvv',
    'exp-month',
    'exp-year',
  ];
  if (ccFields.includes(firstErrorField)) {
    focusCreditCardErrorField(firstErrorField);
    return;
  }

  const field = findFormField(firstErrorField);

  if (field && 'focus' in field) {
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      (field as HTMLInputElement).focus();
    }, 800);
  }
}

/**
 * Focuses a card field, through the payment provider when the field is not ours to focus.
 *
 * @param fieldName One of the card field names. The number and CVV live in the Spreedly
 * iframe; the expiry dropdowns are ordinary elements on the page.
 *
 * @example
 * ```ts
 * focusCreditCardErrorField('cvv'); // Spreedly.transferFocus('cvv')
 * ```
 */
export function focusCreditCardErrorField(fieldName: string): void {
  if (fieldName === 'cc-number' || fieldName === 'number') {
    if (typeof window !== 'undefined' && (window as any).Spreedly) {
      (window as any).Spreedly.transferFocus('number');
    }
  } else if (fieldName === 'cvv') {
    if (typeof window !== 'undefined' && (window as any).Spreedly) {
      (window as any).Spreedly.transferFocus('cvv');
    }
  } else {
    // For month/year fields, focus normally
    const field = findFormField(fieldName);
    if (field && 'focus' in field) {
      (field as HTMLInputElement).focus();
    }
  }
}
