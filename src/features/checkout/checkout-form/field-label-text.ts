/**
 * `data-next-label`: a field the page writes itself takes its label and placeholder from
 * the country's rules, in the page's language, so a page need not be written once per
 * language. Opt-in per field, and only the places a field's name lives are touched:
 *
 * - the control's `placeholder`, unless its `data-next-i18n` translates one;
 * - its `aria-label`, when the page gave it one: the name a screen reader reads, which
 *   has to follow the country as the visible label does;
 * - each `<label>` the browser pairs with it (`control.labels`, by `for`/`id` or by
 *   nesting): the `[data-next-label-text]` inside it when there is one, else the label's
 *   text when the label holds nothing but text. Any other label is left alone, since its
 *   markup (a required marker, an icon) is the page's.
 */

import type { CountryRules } from '@/core/country-service';
import type { Logger } from '@/core/logger';
import { serviceFieldName } from '@/features/checkout/validation/field-messages';
import { translatesAttribute } from '@/utils/i18n-spec';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** The fields asking for it, in one address: `billing-*` for billing, the rest otherwise. */
function controlsIn(root: ParentNode, form: 'shipping' | 'billing'): Control[] {
  return [
    ...root.querySelectorAll<Control>(
      '[data-next-label][data-next-checkout-field]'
    ),
  ].filter(control => {
    const name = control.getAttribute('data-next-checkout-field') ?? '';
    return name.startsWith('billing-') === (form === 'billing');
  });
}

/** Whether the page requires a field the rules leave optional (a phone, say). */
function pageRequires(control: Control): boolean {
  return (
    control.required || control.getAttribute('data-next-required') === 'true'
  );
}

function writeLabel(label: HTMLLabelElement, text: string): boolean {
  const slot = label.querySelector<HTMLElement>('[data-next-label-text]');
  if (slot) {
    slot.textContent = text;
    return true;
  }
  if (label.children.length === 0) {
    label.textContent = text;
    return true;
  }
  return false;
}

/**
 * Writes each opted-in field's text from `rules`, the rules of the address's country.
 * `optional` adds the note to a field neither the rules nor the page require. A field the
 * country does not ask for keeps what the page wrote.
 */
export function writeFieldLabels(
  root: ParentNode,
  rules: CountryRules,
  form: 'shipping' | 'billing',
  optional: (label: string) => string,
  logger: Logger
): void {
  for (const control of controlsIn(root, form)) {
    const name = control.getAttribute('data-next-checkout-field') ?? '';
    const field = rules.fields[serviceFieldName(name)];
    if (!field) continue;

    const text =
      field.required || pageRequires(control)
        ? field.label
        : optional(field.label);
    if (
      !(control instanceof HTMLSelectElement) &&
      !translatesAttribute(control, 'placeholder')
    ) {
      control.placeholder = text;
    }
    if (
      control.hasAttribute('aria-label') &&
      !translatesAttribute(control, 'aria-label')
    ) {
      control.setAttribute('aria-label', text);
    }
    for (const label of control.labels ?? []) {
      if (!writeLabel(label, text)) {
        logger.debug(
          `Left the label of ${name} as written: it holds markup and no [data-next-label-text]`
        );
      }
    }
  }
}
