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
