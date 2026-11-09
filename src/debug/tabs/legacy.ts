/** The attributes v2 name for each earlier attribute, shown beside it in the Elements tab. */
const LEGACY: Record<string, string> = {
  'data-next-display': 'data-next-query',
  'data-next-bundle-display': 'data-next-query',
  'data-next-toggle-display': 'data-next-query',
  'data-next-checkout-review': 'data-next-query="checkout.…"',
  'data-next-toggle-image': '<img data-next-query="lines.0.image">',
  'data-next-fallback': 'data-next-empty',
  'data-next-bundle-selector': 'data-next-selector',
  'data-next-bundle-card': 'data-next-option',
  'data-next-bundle-id': 'data-next-option="<id>"',
  'data-next-bundle-items': 'data-next-items="1x3"',
  'data-next-bundle-vouchers': 'data-next-vouchers',
  'data-next-selection-mode': 'data-next-defer',
  'data-next-upsell-context': 'an option on a ?ref_id page',
  'data-next-upsell': 'an option on a ?ref_id page',
  'data-next-upsell-action': 'data-next-action="acceptUpsell" / "skipUpsell"',
  'data-next-toggle-card': 'data-next-option on its own',
  'data-next-bundle-qty-for': 'data-next-for="selector.<id>"',
  'data-next-quantity-increase': 'data-next-action="setQuantity" data-next-quantity="+1"',
  'data-next-quantity-decrease': 'data-next-action="setQuantity" data-next-quantity="-1"',
  'data-next-quantity-display': 'data-next-query="quantity"',
  'data-next-bundle-slot-template-id': 'data-next-slots + data-next-each="slots"',
  'data-next-bundle-slots-for': 'data-next-each="slots"',
  'data-next-variant-selectors': 'data-next-field="variants.<code>"',
  'data-next-property': 'data-next-field="properties.<name>"',
  'data-next-default-property': 'data-next-field="properties.<name>"',
  'data-next-discounts': 'data-next-each="discounts"',
  'data-next-cart-summary': 'data-next-each="cart.lines"',
  'data-next-order-items': 'data-next-each="order.lines"',
  'data-next-remove-item': 'data-next-action="removeItem"',
  'data-next-clear-cart': 'data-next-replace',
  'data-next-url': 'data-next-go',
  'data-next-coupon': 'form[data-next-action="applyCoupon"]',
  'data-next-checkout-field': 'data-next-field',
  'data-next-checkout-step': 'data-next-step + data-next-go',
  'data-next-payment-method': 'data-next-payment',
  'data-next-express-checkout': 'data-next-express',
  'data-next-component': 'data-next-address / data-next-query="checkout.errors.…"',
  'data-next-required': 'required',
};

/** The v2 replacement for an earlier attribute, or nothing for a current one. */
export function replacementFor(attr: string, value: string): string | undefined {
  if (attr === 'data-next-action') return value === 'add-to-cart' ? 'data-next-action="addItem"' : undefined;
  if (attr === 'data-next-quantity' && (value === 'increase' || value === 'decrease'))
    return `data-next-action="setQuantity" data-next-quantity="${value === 'increase' ? '+1' : '-1'}"`;
  return LEGACY[attr];
}
