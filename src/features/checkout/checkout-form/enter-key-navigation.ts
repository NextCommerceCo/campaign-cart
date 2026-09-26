/**
 * Enter in a checkout field moves to the next field; it never submits the form.
 *
 * A browser submits a form when Enter is pressed in one of its text fields, and on a
 * phone the keyboard's Enter key is right under the shopper's thumb. Submitting a
 * checkout from its first field starts express checkout without validation when an
 * express method is selected, moves a multi-step checkout on, or marks every empty field
 * as an error. Only the submit button places the order.
 *
 * The keyboard's Enter key is labelled to match: `enterkeyhint="next"`, and `done` on the
 * last field, set as a field gets focus so it also covers fields built after the scan and
 * rows that are only shown later. A hint the page wrote itself is left alone.
 */

/** Inputs whose Enter is a button press, not the end of typing. */
const BUTTON_TYPES = new Set(['submit', 'button', 'image', 'reset']);

/** The fields Enter moves between, in the order the page lays them out. */
function fieldsIn(form: HTMLFormElement): HTMLElement[] {
  return [
    ...form.querySelectorAll<HTMLElement>(
      'input[data-next-checkout-field], select[data-next-checkout-field], textarea[data-next-checkout-field]'
    ),
  ].filter(
    field =>
      !(field as HTMLInputElement).disabled &&
      !(field as HTMLInputElement).readOnly &&
      (field as HTMLInputElement).type !== 'hidden' &&
      // Not rendered: a hidden row, a collapsed billing section.
      field.getClientRects().length > 0
  );
}

function isTypingField(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && !BUTTON_TYPES.has(target.type);
}

function nextField(
  form: HTMLFormElement,
  from: HTMLElement
): HTMLElement | null {
  const fields = fieldsIn(form);
  const at = fields.indexOf(from);
  return at >= 0 ? (fields[at + 1] ?? null) : null;
}

/**
 * Starts moving focus on Enter within `form`, and returns the function that stops it.
 * Listens on the form rather than on each field, so a field built after this runs is
 * covered without a re-scan.
 */
export function setupEnterKeyNavigation(form: HTMLFormElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  // The fields whose hint this set, so one the page wrote is told apart from it.
  const hinted = new WeakSet<HTMLElement>();

  form.addEventListener(
    'focusin',
    event => {
      const field = event.target;
      if (
        !isTypingField(field) ||
        !field.hasAttribute('data-next-checkout-field')
      ) {
        return;
      }
      if (field.hasAttribute('enterkeyhint') && !hinted.has(field)) return;
      field.setAttribute(
        'enterkeyhint',
        nextField(form, field) ? 'next' : 'done'
      );
      hinted.add(field);
    },
    { signal }
  );

  form.addEventListener(
    'keydown',
    event => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      // Enter that ends an IME composition (Thai, Japanese) picks a word; it is not
      // the end of the field.
      if (event.isComposing) return;
      const field = event.target;
      if (!isTypingField(field)) return;

      event.preventDefault();
      const next = nextField(form, field);
      if (next) next.focus();
      else field.blur();
    },
    { signal }
  );

  return () => controller.abort();
}
