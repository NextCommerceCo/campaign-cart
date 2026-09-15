import type { AddressFieldSpec, AddressSpec } from './address-form.api';

/** `line3` is null: the orders API carries address1 and address2 and has no third. */
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

export interface AddressRenderContext {
  form: 'shipping' | 'billing';
  /** Keyed by this SDK's field names. */
  values?: Record<string, string>;
}

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
  // Without the shipping/billing prefix a browser fills one address from the other's data.
  control.setAttribute('autocomplete', `${form} ${field.autocomplete}`);

  if (field.required) control.required = true;

  if (control instanceof HTMLInputElement) {
    control.type = field.control === 'tel' ? 'tel' : 'text';
    // Always set, falling back to the label: it is what makes `:placeholder-shown` usable
    // for a scriptless floating label, and an empty box has to say what it wants — a
    // floating label is hidden until there is a value, so a blank placeholder leaves
    // nothing on screen at all.
    control.placeholder = field.placeholder || field.label;
    if (field.maxLength) control.maxLength = field.maxLength;
    if (field.inputMode) control.inputMode = field.inputMode;
    if (field.autoCapitalize) control.autocapitalize = field.autoCapitalize;
  }

  return control;
}

/** Returns the checkout-field names it rendered, in layout order. */
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
      // `form-group` is not decoration: the SDK's error labels, its validation wrapper
      // lookup, its floating labels and the hiding of a province field for a country with
      // no states all query for it.
      cell.className = 'form-group next-address-field';
      cell.setAttribute('data-next-address-field', checkoutField);
      if (field.span) cell.style.flexGrow = String(field.span);

      const control = controlFor(field, checkoutField, ctx.form, id);
      const value = ctx.values?.[checkoutField];
      if (value && control instanceof HTMLInputElement) control.value = value;

      // Control first, label second: a floating label is positioned over the control by
      // CSS, and `control + label` is the only way to reach it from the control's state.
      // `for`/`id` carries the pairing, so the reading order is unaffected.
      cell.append(control, labelFor(field, id));

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
 * A `select` is skipped: its options belong to the country being left, so carrying the
 * value across would put a province into a list that does not contain it.
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
