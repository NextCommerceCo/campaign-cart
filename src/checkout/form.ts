import type { CheckoutActions } from '../engine/checkout';
import type { Engine } from '../engine/engine';
import { FIELD_ATTRS, LEGACY_FIELDS } from './legacy';
import { showField } from './messages';
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

export function scanFields(form: HTMLFormElement): Fields {
  const fields: Fields = new Map();
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

export function syncFields(fields: Fields, checkout: CheckoutActions, current: Record<string, string>): void {
  for (const [name, el] of fields) {
    if (!valueOf(el) && current[name]) continue;
    checkout.setField(name, valueOf(el));
  }
}

export function bindFields(engine: Engine, checkout: CheckoutActions, fields: Fields): () => void {
  const saved = engine.getState().checkout?.fields ?? {};
  const left = new Set(Object.keys(saved).filter((name) => saved[name]?.trim()));
  for (const [name, el] of fields) {
    el.addEventListener('input', () => {
      left.delete(name);
      checkout.setField(name, valueOf(el));
    });
    el.addEventListener('change', () => {
      left.add(name);
      checkout.setField(name, valueOf(el));
      void checkout.leave(name);
    });
  }

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
