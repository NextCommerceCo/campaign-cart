import type { CheckoutActions } from '../engine/checkout';
import type { Engine } from '../engine/engine';
import { component, FIELD_ATTRS } from '../compat/checkout';

function renameField(el: Element): void {
  for (const attr of FIELD_ATTRS) {
    const raw = el.getAttribute(attr);
    if (raw && !raw.startsWith('billing')) el.setAttribute(attr, `billing-${raw}`);
  }
  const name = el.getAttribute('name');
  if (name)
    el.setAttribute('name', name.startsWith('shipping_') ? name.replace('shipping_', 'billing_') : `billing_${name}`);
  if (el.id) el.id = `billing_${el.id}`;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = '';
  if (el instanceof HTMLSelectElement) el.selectedIndex = 0;
}

export function cloneBillingRows(form: HTMLFormElement): void {
  const target = form.querySelector(component('billing-form'));
  if (!target || target.children.length) return;
  const source = form.querySelector(component('shipping-form')) ?? form;
  for (const row of source.querySelectorAll(
    '[data-next-component="shipping-field-row"], [data-next-component="location"]',
  )) {
    if (row.parentElement?.closest('[data-next-component="location"]')) continue;
    if (row.querySelector('[data-next-checkout-field="email"]')) continue;
    const copy = row.cloneNode(true) as Element;
    if (copy.getAttribute('data-next-component') === 'location') {
      copy.setAttribute('data-next-component', 'billing-location');
    } else copy.setAttribute('data-next-component', 'billing-field-row');
    copy.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => h.remove());
    copy.querySelectorAll(FIELD_ATTRS.map((a) => `[${a}]`).join(', ')).forEach(renameField);
    copy.querySelectorAll('label[for]').forEach((l) => l.setAttribute('for', `billing_${l.getAttribute('for')}`));
    target.append(copy);
  }
}

export function bindBilling(engine: Engine, checkout: CheckoutActions, form: HTMLFormElement): () => void {
  const toggle = form.querySelector<HTMLInputElement>('input[name="use_shipping_address"]');
  const section = form.querySelector<HTMLElement>(component('different-billing-address'));
  if (!toggle) return () => {};

  if (engine.getState().checkout?.sameAsShipping === false) toggle.checked = false;
  checkout.setSameAsShipping(toggle.checked);
  toggle.addEventListener('change', () => checkout.setSameAsShipping(toggle.checked));

  return () => {
    const same = engine.getState().checkout?.sameAsShipping ?? true;
    toggle.checked = same;
    if (!section) return;
    section.style.display = same ? 'none' : '';
    section.classList.toggle('billing-form-collapsed', same);
    section.classList.toggle('billing-form-expanded', !same);
  };
}
