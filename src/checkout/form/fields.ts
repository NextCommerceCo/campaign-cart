import type { CheckoutActions } from '../state/checkout';
import type { Engine } from '../../engine/engine';
import type { CheckoutState } from '../../engine/types';
import { FIELD_ATTRS, LEGACY_FIELDS } from '../../compat/checkout';
import { showField } from './errors';
import { fieldText } from './texts';

export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type Fields = Map<string, Control>;

const NOT_ADDRESS = ['cc-number', 'cvv', 'exp-month', 'exp-year', 'cc-month', 'cc-year', 'payment-method'];

export const rawName = (el: Element) => FIELD_ATTRS.map((a) => el.getAttribute(a)).find(Boolean) ?? '';

export function fieldName(el: Element): string | undefined {
  const raw = rawName(el);
  if (!raw || NOT_ADDRESS.includes(raw)) return undefined;
  const base = raw.replace(/^billing[-_]/, '');
  const name = LEGACY_FIELDS[base] ?? base;
  return base === raw ? name : `billing_${name}`;
}

const isControl = (el: Element): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

export function scanFields(form: HTMLFormElement, fields: Fields = new Map()): Fields {
  fields.clear();
  form.querySelectorAll(FIELD_ATTRS.map((a) => `[${a}]`).join(', ')).forEach((el) => {
    const name = fieldName(el);
    if (name && isControl(el) && !fields.has(name)) fields.set(name, el);
  });
  return fields;
}

export const valueOf = (el: Control) =>
  el instanceof HTMLInputElement && el.type === 'checkbox' ? String(el.checked) : el.value;

export function setValue(el: Control, value: string): void {
  if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = value === 'true';
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
  const saved = engine.getState().checkout?.fields ?? {};
  const left = new Set(Object.keys(saved).filter((name) => saved[name]?.trim()));
  const listen = (type: string, fn: (name: string, el: Control) => void) =>
    form.addEventListener(
      type,
      (e) => {
        const el = e.target;
        if (!(el instanceof Element) || !isControl(el)) return;
        const name = fieldName(el);
        if (name && fields.get(name) === el) fn(name, el);
      },
      true,
    );
  listen('input', (name, el) => {
    left.delete(name);
    checkout.setField(name, valueOf(el));
  });
  listen('change', (name, el) => {
    left.add(name);
    checkout.setField(name, valueOf(el));
    void checkout.leave(name);
  });

  return () => {
    const { checkout: state } = engine.getState();
    if (!state) return;
    for (const [name, el] of fields) {
      const value = state.fields[name];
      if (value !== undefined && !(el instanceof HTMLSelectElement)) setValue(el, value);
      if (el instanceof HTMLInputElement && el.type === 'checkbox') continue;
      const error = state.errors[name];
      const rules =
        state.rules[(name.startsWith('billing_') ? state.fields.billing_country : state.fields.country) ?? ''];
      if (error) showField(el, name, 'error', fieldText(name, error, rules));
      else showField(el, name, left.has(name) && value?.trim() ? 'valid' : 'neutral');
    }
  };
}
