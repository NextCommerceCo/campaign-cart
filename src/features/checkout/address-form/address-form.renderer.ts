/**
 * A country's address layout, as the inputs a checkout form already knows how to read.
 *
 * Everything rendered here carries `data-next-checkout-field`, which is the only contract
 * that matters: `CheckoutFormEnhancer` scans for exactly that attribute, so a field this
 * module writes is indistinguishable from one a page author typed. Country and province
 * dropdowns are rendered **empty** on purpose — the form fills them from `CountryService`,
 * the same way it fills hand-written ones.
 */

import type { AddressFieldSpec, AddressSpec } from './address-form.api';

/**
 * next-address's field names, as the names this SDK's checkout fields answer to.
 *
 * `line3` maps to nothing: the orders API carries `address1` and `address2` and has no
 * third line, so a country that collects one (Thailand's sub-district, for instance) has
 * that field left out rather than folded into another one. Folding it would put two
 * different things in one column and no reader could tell them apart afterwards.
 */
const SDK_FIELD_NAMES: Record<string, string | null> = {
  country: 'country',
  first_name: 'fname',
  last_name: 'lname',
  line1: 'address1',
  line2: 'address2',
  line3: null,
  city: 'city',
  state: 'province',
  postcode: 'postal',
  phone_number: 'phone',
};

/** What the rendered block needs to know about the form it is part of. */
export interface AddressRenderContext {
  /** `shipping` or `billing`; decides the field-name prefix and the autofill section. */
  form: 'shipping' | 'billing';
  /** Values to put back into the boxes, keyed by this SDK's field names. */
  values?: Record<string, string>;
}

/** The SDK's name for a field, or `null` when this SDK does not collect it. */
export function sdkFieldName(
  name: string,
  form: 'shipping' | 'billing'
): string | null {
  const base = SDK_FIELD_NAMES[name];
  if (!base) return null;
  return form === 'billing' ? `billing-${base}` : base;
}

function labelFor(field: AddressFieldSpec, id: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.htmlFor = id;
  label.className = 'next-address-label';
  label.textContent = field.label;
  return label;
}

function controlFor(
  field: AddressFieldSpec,
  checkoutField: string,
  form: 'shipping' | 'billing',
  id: string
): HTMLInputElement | HTMLSelectElement {
  const control =
    field.control === 'select'
      ? document.createElement('select')
      : document.createElement('input');

  control.id = id;
  control.name = checkoutField;
  control.className = 'next-address-control';
  control.setAttribute('data-next-checkout-field', checkoutField);

  // `shipping`/`billing` is the prefix the HTML spec defines for a page carrying both
  // addresses; without it a browser autofills one form from the other's data.
  control.setAttribute('autocomplete', `${form} ${field.autocomplete}`);

  if (field.required) control.required = true;

  if (control instanceof HTMLInputElement) {
    control.type = field.control === 'tel' ? 'tel' : 'text';
    if (field.placeholder) control.placeholder = field.placeholder;
    if (field.maxLength) control.maxLength = field.maxLength;
    if (field.inputMode) control.inputMode = field.inputMode;
    if (field.autoCapitalize) control.autocapitalize = field.autoCapitalize;
  }

  return control;
}

/**
 * Builds the block for one country and replaces whatever `container` held.
 *
 * Replacing rather than patching is what makes a country change simple to reason about:
 * the shopper's values are read out first and written back after, so the only thing that
 * survives a re-render is what they typed. Nothing here holds a listener, so nothing is
 * orphaned by the replacement — the checkout form binds its own, on the form element.
 *
 * Returns the checkout-field names it rendered, in layout order, which is what the caller
 * reports so the form knows to look again.
 *
 * @example
 * ```ts
 * renderAddressSpec(container, jpSpec, { form: 'shipping' });
 * // → ['country', 'postal', 'province', 'city', 'address1']
 * ```
 */
export function renderAddressSpec(
  container: HTMLElement,
  spec: AddressSpec,
  ctx: AddressRenderContext
): string[] {
  const rendered: string[] = [];
  const fragment = document.createDocumentFragment();

  spec.layout.forEach((row, rowIndex) => {
    const cells = row
      .map(name => ({ name, field: spec.fields[name] }))
      .filter(
        (entry): entry is { name: string; field: AddressFieldSpec } =>
          Boolean(entry.field) && sdkFieldName(entry.name, ctx.form) !== null
      );

    if (cells.length === 0) return;

    const rowElement = document.createElement('div');
    rowElement.className = 'next-address-row';
    rowElement.setAttribute('data-next-address-row', String(rowIndex));

    cells.forEach(({ name, field }) => {
      const checkoutField = sdkFieldName(name, ctx.form) as string;
      const id = `next-${ctx.form}-${checkoutField}`;

      const cell = document.createElement('div');
      cell.className = 'next-address-field';
      cell.setAttribute('data-next-address-field', checkoutField);
      if (field.span) cell.style.flexGrow = String(field.span);

      const control = controlFor(field, checkoutField, ctx.form, id);
      const value = ctx.values?.[checkoutField];
      if (value && control instanceof HTMLInputElement) control.value = value;

      cell.append(labelFor(field, id), control);

      if (field.hint) {
        const hint = document.createElement('span');
        hint.className = 'next-address-hint';
        hint.textContent = field.hint;
        cell.append(hint);
      }

      rowElement.append(cell);
      rendered.push(checkoutField);
    });

    fragment.append(rowElement);
  });

  container.replaceChildren(fragment);
  return rendered;
}

/**
 * What the shopper has typed into the block, keyed by checkout-field name.
 *
 * Read before a re-render so a country change does not empty the form under someone who
 * has already filled it in. A `select` is deliberately not read: its options belong to
 * the country being left, so carrying the value across would put a province from the old
 * country into the new country's list.
 */
export function readRenderedValues(container: HTMLElement): Record<string, string> {
  const values: Record<string, string> = {};
  container
    .querySelectorAll<HTMLInputElement>('input[data-next-checkout-field]')
    .forEach(input => {
      if (input.value) values[input.name] = input.value;
    });
  return values;
}
