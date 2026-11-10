import type { Engine } from '../engine/engine';
import type { CheckoutState } from './state/types';
import { toApi } from './form/names';
import { formatAddress, phoneText, REVIEW_LAYOUT } from '../engine/order/address-line';

function address(checkout: CheckoutState, prefix: '' | 'billing_'): string {
  const f = (name: string) => checkout.fields[prefix + name]?.trim() ?? '';
  const country = checkout.countries.find((c) => c.code === f('country'))?.name ?? f('country');
  const fields = { line1: f('line1'), line2: f('line2'), city: f('city'), state: f('state'), postcode: f('postcode') };
  return formatAddress({ ...fields, country }, REVIEW_LAYOUT);
}

function value(engine: Engine, key: string): string {
  const { checkout, cart } = engine.getState();
  if (!checkout) return '';
  if (key === 'address') return address(checkout, '');
  if (key === 'billingAddress') return address(checkout, 'billing_');
  if (key.startsWith('shippingMethod.')) {
    const method = cart.summary?.shipping_method as Record<string, unknown> | undefined;
    return String(method?.[key.slice('shippingMethod.'.length)] ?? '');
  }
  return checkout.fields[toApi(key.replace(/^billingAddress\./, 'billing_'))]?.trim() ?? '';
}

export function bindReview(engine: Engine): () => void {
  const els = [...document.querySelectorAll<HTMLElement>('[data-next-checkout-review]')];
  return () => {
    for (const el of els) {
      const key = el.getAttribute('data-next-checkout-review') ?? '';
      let text = value(engine, key);
      if (text && (el.getAttribute('data-next-format') === 'phone' || key === 'phone')) text = phoneText(text);
      el.classList.toggle('next-review-empty', !text);
      const shown = text || el.getAttribute('data-next-fallback') || '';
      if (el.textContent !== shown) el.textContent = shown;
    }
  };
}
