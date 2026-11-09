import type { CheckoutActions } from '../state/checkout';
import type { Engine } from '../../engine/engine';
import { paymentCode } from '../../engine/payment';
import { FIELDS, rawName } from '../form/fields';

/** The campaign's payment methods and the checkout's pick, for the payment radios and panels. */
export interface PaymentChoice {
  /** Whether the campaign offers the method `value` names; every method when it lists none. */
  offers(value: string): boolean;
  /** Whether `value` names the picked method. */
  picked(value: string): boolean;
}

export function paymentChoice(engine: Engine): PaymentChoice {
  const offered = engine.getState().campaign?.available_payment_methods?.map((m) => paymentCode(m.code)) ?? [];
  return {
    offers: (value) => !offered.length || offered.includes(paymentCode(value)),
    picked: (value) => paymentCode(value) === engine.getState().checkout?.paymentMethod,
  };
}

/** Folds a method's form away while another method is picked. */
export function collapse(el: HTMLElement, open: boolean): void {
  el.style.height = open ? '' : '0px';
  el.style.overflow = open ? '' : 'hidden';
}

const paymentRadios = (form: HTMLFormElement) =>
  [...form.querySelectorAll<HTMLInputElement>(`input[name="payment_method"], ${FIELDS}`)].filter(
    (r) => r.type === 'radio' && (r.name === 'payment_method' || rawName(r) === 'payment-method'),
  );

/** The page's payment radios and `[data-next-payment-method]` panels, minus the panels the campaign does not offer. */
export function bindPayment(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement): () => void {
  const radios = paymentRadios(form);
  const panels = [...form.querySelectorAll<HTMLElement>('[data-next-payment-method]')];
  const choice = paymentChoice(engine);
  const methodOf = (panel: HTMLElement) => panel.getAttribute('data-next-payment-method') ?? '';

  for (const panel of panels) {
    if (paymentCode(methodOf(panel)) === 'card_token' || choice.offers(methodOf(panel))) continue;
    panel.classList.add('next-hidden');
    panel.style.display = 'none';
  }

  const usable = (radio: HTMLInputElement) =>
    !radio.hidden && !radio.closest<HTMLElement>('[data-next-payment-method].next-hidden');
  const initial =
    radios.find((r) => usable(r) && choice.picked(r.value)) ??
    radios.find((r) => usable(r) && r.checked) ??
    radios.find(usable);
  if (initial) checkout.setPaymentMethod(initial.value);
  for (const radio of radios)
    radio.addEventListener('change', () => radio.checked && checkout.setPaymentMethod(radio.value));

  return () => {
    for (const radio of radios) radio.checked = choice.picked(radio.value);
    for (const panel of panels) {
      const on = choice.picked(methodOf(panel));
      panel.classList.toggle('next-selected', on);
      const body = panel.querySelector<HTMLElement>('[data-next-payment-form]');
      if (!body) continue;
      body.setAttribute('data-next-payment-state', on ? 'expanded' : 'collapsed');
      body.classList.toggle('payment-method__form--expanded', on);
      body.classList.toggle('payment-method__form--collapsed', !on);
      collapse(body, on);
    }
  };
}
