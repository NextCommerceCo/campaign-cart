import type { CheckoutActions } from '../state/checkout';
import type { Engine } from '../../engine/engine';
import type { CheckoutState } from '../state/types';
import { showField } from './errors';
import { fromV2, rulesOf, toApi, toV2 } from './names';
import { fieldText } from './texts';

export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type Fields = Map<string, Control>;

export const option = (text: string, value: string) =>
  Object.assign(document.createElement('option'), { textContent: text, value });

export const FIELD_ATTR = 'data-next-field';
/** The attributes `data-next-address` and 0.4.x pages name a field with. */
export const PAGE_FIELD_ATTRS = ['data-next-checkout-field', 'os-checkout-field'];
export const FIELD_ATTRS = [FIELD_ATTR, ...PAGE_FIELD_ATTRS];
export const FIELDS = FIELD_ATTRS.map((a) => `[${a}]`).join(', ');

const NOT_ADDRESS = [
  'cc-number',
  'cvv',
  'exp-month',
  'exp-year',
  'cc-month',
  'cc-year',
  'cc-expiry',
  'payment-method',
  'use-shipping-address',
];

const inBilling = (el: Element) => el.closest('[data-next-address]')?.getAttribute('data-next-address') === 'billing';

export function rawName(el: Element): string {
  const key = el.getAttribute(FIELD_ATTR);
  if (key) return fromV2(key, inBilling(el));
  return PAGE_FIELD_ATTRS.map((a) => el.getAttribute(a)).find(Boolean) ?? '';
}

/** The first field in `root` whose legacy name is one of `names`. */
export const fieldControl = <T extends Element = HTMLElement>(root: ParentNode, ...names: string[]) =>
  [...root.querySelectorAll<T>(FIELDS)].find((el) => names.includes(rawName(el))) ?? null;

export function fieldName(el: Element): string | undefined {
  const raw = rawName(el);
  return !raw || NOT_ADDRESS.includes(raw) ? undefined : toApi(raw);
}

const isControl = (el: Element): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/** Calls `fn` for each `type` event, in the capture phase, whose target is one of `fields`. */
export function onField(
  form: HTMLFormElement,
  fields: Fields,
  type: string,
  fn: (name: string, el: Control, e: Event) => void,
): void {
  form.addEventListener(
    type,
    (e) => {
      const el = e.target;
      if (!(el instanceof Element) || !isControl(el)) return;
      const name = fieldName(el);
      if (name && fields.get(name) === el) fn(name, el, e);
    },
    true,
  );
}

export function scanFields(form: HTMLFormElement, fields: Fields = new Map()): Fields {
  fields.clear();
  form.querySelectorAll(FIELDS).forEach((el) => {
    const name = fieldName(el);
    if (name && isControl(el) && !fields.has(name)) fields.set(name, el);
  });
  return fields;
}

const isCheckbox = (el: Control): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'checkbox';

export const valueOf = (el: Control) => (isCheckbox(el) ? String(el.checked) : el.value);

export function setValue(el: Control, value: string): void {
  if (isCheckbox(el)) el.checked = value === 'true';
  else if (el.value !== value && document.activeElement !== el) el.value = value;
}

export const phoneRequired = (fields: Fields) => {
  const phone = fields.get('phone_number');
  return !!phone && (phone.required || phone.getAttribute('data-next-required') === 'true');
};

export function syncFields(fields: Fields, checkout: CheckoutActions, state: CheckoutState | undefined): void {
  for (const [name, el] of fields) {
    if (state?.sameAsShipping && name.startsWith('billing_')) continue;
    if (!valueOf(el) && state?.fields[name]) continue;
    checkout.setField(name, valueOf(el));
  }
}

export function bindFields(
  engine: Engine,
  checkout: CheckoutActions,
  form: HTMLFormElement,
  fields: Fields,
): () => void {
  const placed = new Set(
    [...document.querySelectorAll('[data-next-query^="checkout.errors."]')].map((el) =>
      el.getAttribute('data-next-query')!.slice('checkout.errors.'.length),
    ),
  );
  const inline = (name: string) => !placed.has(name) && !placed.has(toV2(name));
  const saved = engine.getState().checkout?.fields ?? {};
  const left = new Set(Object.keys(saved).filter((name) => saved[name]?.trim()));
  onField(form, fields, 'input', (name, el) => {
    left.delete(name);
    checkout.setField(name, valueOf(el));
  });
  onField(form, fields, 'change', (name, el) => {
    left.add(name);
    checkout.setField(name, valueOf(el));
    void checkout.leave(name);
  });
  for (const [name, el] of fields)
    if (isCheckbox(el) && saved[name] === undefined) checkout.setField(name, valueOf(el));

  return () => {
    const { checkout: state } = engine.getState();
    if (!state) return;
    for (const [name, el] of fields) {
      const value = state.fields[name];
      if (value !== undefined && !(el instanceof HTMLSelectElement)) setValue(el, value);
      if (isCheckbox(el)) continue;
      const error = state.errors[name];
      if (error) showField(el, name, 'error', fieldText(name, error, rulesOf(state, name)), inline(name));
      else showField(el, name, left.has(name) && value?.trim() ? 'valid' : 'neutral');
    }
  };
}
