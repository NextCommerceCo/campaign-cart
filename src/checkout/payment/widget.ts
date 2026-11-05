import type { Engine } from '../../engine/engine';
import { paymentCode } from '../state/order-body';
import { FIELD_ATTR, FIELDS, rawName } from '../form/fields';
import { EXPRESS_BUTTONS } from './logos';

const methodCode = (code: string) => (code === 'bankcard' ? 'card_token' : paymentCode(code));

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, key?: string) => {
  const el = Object.assign(document.createElement(tag), { className });
  if (key) el.setAttribute(FIELD_ATTR, key);
  return el;
};

function cardFields(): HTMLElement {
  const expiry = Object.assign(element('input', 'next-payment-field', 'card.expiry'), {
    type: 'text',
    inputMode: 'numeric',
    autocomplete: 'cc-exp',
    placeholder: 'MM / YY',
    maxLength: 9,
    required: true,
  });
  const fields = element('div', 'next-payment-fields');
  fields.append(
    element('div', 'next-payment-field', 'card.number'),
    element('div', 'next-payment-field', 'card.cvv'),
    expiry,
  );
  return fields;
}

function method(code: string, text: string): HTMLElement {
  const el = element('div', 'next-payment-method');
  el.setAttribute('data-next-value', code);
  const radio = Object.assign(element('input', 'next-payment-radio', 'payment_method'), {
    type: 'radio',
    name: 'payment_method',
    value: code,
  });
  const label = element('label', 'next-payment-option');
  label.append(radio, Object.assign(element('span', 'next-payment-label'), { textContent: text }));
  if (code === 'paypal')
    label.append(Object.assign(element('span', 'next-payment-logo'), { innerHTML: EXPRESS_BUTTONS.paypal!.svg }));
  el.append(label);
  if (code === 'card_token') el.append(cardFields());
  return el;
}

const radiosIn = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLInputElement>(FIELDS)].filter(
    (r) => r.type === 'radio' && rawName(r) === 'payment-method',
  );

const labelOf = (radio: HTMLInputElement) =>
  radio.closest('label') ?? (radio.id ? document.querySelector<HTMLLabelElement>(`label[for="${radio.id}"]`) : null);

/**
 * `[data-next-payment]`: left empty, one radio per method the campaign offers, with the card fields under the card;
 * holding `[data-next-field]`, the page's own radios, minus those the campaign does not offer.
 */
export function bindPaymentWidget(engine: Engine, form: HTMLFormElement): () => void {
  const widgets = [...form.querySelectorAll<HTMLElement>('[data-next-payment]')];
  if (!widgets.length) return () => {};
  const methods = engine.getState().campaign?.available_payment_methods ?? [];
  const offered = methods.map((m) => methodCode(m.code));
  for (const widget of widgets) {
    if (!widget.querySelector(`[${FIELD_ATTR}]`)) {
      widget.replaceChildren(...methods.map((m) => method(methodCode(m.code), m.label || m.code)));
      continue;
    }
    if (!offered.length) continue;
    for (const radio of radiosIn(widget)) {
      if (offered.includes(methodCode(radio.value))) continue;
      radio.hidden = true;
      const label = labelOf(radio);
      if (label) label.hidden = true;
    }
  }

  return () => {
    const picked = engine.getState().checkout?.paymentMethod;
    for (const widget of widgets) {
      for (const el of widget.querySelectorAll<HTMLElement>('[data-next-value]'))
        el.toggleAttribute('data-next-selected', methodCode(el.getAttribute('data-next-value') ?? '') === picked);
      for (const radio of radiosIn(widget))
        labelOf(radio)?.toggleAttribute('data-next-selected', methodCode(radio.value) === picked);
      for (const fields of widget.querySelectorAll<HTMLElement>('.next-payment-fields')) {
        const on = picked === 'card_token';
        fields.style.height = on ? '' : '0px';
        fields.style.overflow = on ? '' : 'hidden';
      }
    }
  };
}
