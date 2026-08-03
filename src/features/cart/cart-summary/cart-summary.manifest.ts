import { defineFeature } from '@/docs/schema/feature-manifest';

/**
 * Inventory only — `cart-summary`'s reference is hand-written. Its page carries a
 * per-line condition grammar with `item.*` and `discount.*` namespaces plus worked
 * examples, which reads far better as prose than as generated rows. This manifest
 * keeps the inventory drift-checked against the source and against that page.
 */
export default defineFeature({
  id: 'cart-summary',
  category: 'cart',
  status: 'core',
  reference: 'hand-written',
  summary:
    'Renders the order summary — line rows, discount rows, and totals — and keeps it in step with the cart.',
  activates: '[data-next-cart-summary]',
  logPrefix: 'CartSummaryEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },
  // `data-next-discounts` containers are rendered by this shared util, not by
  // the feature's own files.
  extraSource: ['src/core/rendering/discount-renderer.ts'],
  // `CartDisplayEnhancer` lives here too and answers the `cart.` namespace, so
  // this feature owns that path inventory.
  displayNamespace: 'cart',
  // `PROPERTY_MAPPINGS.cart` routes these, and `resolveValue` answers none of them.
  // They were published as working paths until finding 127 — ten of the twenty-two
  // rows on this page. Nothing here needs a fallback shape: the resolver is a closed
  // switch over the cart state, with no `getNestedProperty` behind it.
  displayUnanswered: [
    {
      name: 'hasItems',
      instead: 'Use `cart.isEmpty`. The routing table declares the negation and the display resolver never applies it — `data-next-show="cart.hasItems"` does work, because `conditional-display` resolves conditions with its own reader.',
    },
    { name: 'quantity', instead: 'Use `cart.totalQuantity`.' },
    { name: 'discounts', instead: 'Use `cart.totalDiscount`.' },
    {
      name: 'hasCoupons',
      instead: 'No `cart.` path reads vouchers. The `coupon` feature renders the applied codes into its `data-next-coupon="display"` area.',
    },
    {
      name: 'hasCoupon',
      instead: 'Same as `hasCoupons` — use the `coupon` feature\'s display area.',
    },
    {
      name: 'couponCount',
      instead: 'No `cart.` path reads vouchers. Count the rows the `coupon` feature renders.',
    },
    {
      name: 'coupons[0].code',
      instead: 'No `cart.` path reads vouchers. The `coupon` feature lists every applied code.',
    },
    {
      name: 'coupons[1].code',
      instead: 'No `cart.` path reads vouchers. The `coupon` feature lists every applied code.',
    },
    {
      name: 'discountCode',
      instead: 'No `cart.` path reads vouchers — and this one renders an empty string rather than nothing, because its routing entry declares `fallback: \'\'`. Use the `coupon` feature.',
    },
    {
      name: 'discountCodes',
      instead: 'No `cart.` path reads vouchers. The `coupon` feature lists every applied code.',
    },
  ],

  attributes: [
    { name: 'data-next-cart-summary', type: 'boolean (presence)', required: true },
    { name: 'data-summary-lines', type: 'boolean (presence)' },
    { name: 'data-summary-offer-discounts', type: 'boolean (presence)' },
    { name: 'data-summary-voucher-discounts', type: 'boolean (presence)' },
    { name: 'data-line-discounts', type: 'boolean (presence)' },
    { name: 'data-next-discounts', type: "'' | 'offer' | 'voucher'" },
    { name: 'data-next-item-properties', type: 'boolean (presence)' },
    { name: 'data-next-show', type: 'string (condition)' },
    { name: 'data-next-hide', type: 'string (condition)' },
  ],

  classes: [
    { name: 'next-cart-empty', description: 'The cart has no lines.' },
    { name: 'next-cart-has-items', description: 'The cart has at least one line.' },
    { name: 'next-summary-empty', description: 'The summary rendered no rows.' },
    { name: 'next-summary-has-items', description: 'The summary rendered at least one row.' },
    { name: 'next-calculating', description: 'Totals are being recalculated.' },
    { name: 'next-not-calculating', description: 'Totals are settled.' },
    { name: 'next-has-discounts', description: 'At least one discount applies.' },
    { name: 'next-no-discounts', description: 'No discounts apply.' },
    { name: 'next-has-shipping', description: 'A shipping method is selected.' },
    { name: 'next-free-shipping', description: 'Shipping costs nothing.' },
  ],

  emits: [],
});
