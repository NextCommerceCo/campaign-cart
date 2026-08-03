import { defineFeature } from '@/docs/schema/feature-manifest';

/**
 * Inventory only — `bundle-selector`'s reference is hand-written. Its 850-line
 * attributes page carries worked examples, a slot grammar, and a variant model
 * that read worse as generated table rows. This manifest keeps the machine-
 * readable side: the activation selector, the full attribute inventory, and the
 * events, all drift-checked against the source and against that page.
 */
export default defineFeature({
  id: 'bundle-selector',
  category: 'cart',
  status: 'core',
  reference: 'hand-written',
  summary:
    'Sells several packages as one unit — a fixed bundle, or slots the visitor fills with their own choices and variants.',
  activates: '[data-next-bundle-selector]',
  logPrefix: 'BundleSelectorEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },
  // `data-next-discounts` containers are rendered by this shared util, not by
  // the feature's own files.
  extraSource: ['src/core/rendering/discount-renderer.ts'],

  displayNamespace: 'bundle',
  displayPaths: {
    prefix: 'bundle.{bundleId}',
    intro:
      "where `{bundleId}` is a card's `data-next-bundle-id`. The element does not " +
      'have to sit inside the card, or inside the selector container.',
    example:
      '<span data-next-display="bundle.starter.price"></span>\n' +
      '<span data-next-display="bundle.starter.discountAmount" data-hide-if-zero="true"></span>',
    paths: [
      {
        name: 'isSelected',
        description: "This card is the selector's current choice.",
      },
      { name: 'name', description: "The card's `data-next-bundle-name`." },
      {
        name: 'price',
        description:
          "Bundle total after every discount, for the card's current quantity multiplier.",
      },
      {
        name: 'originalPrice',
        description: 'Retail / compare-at total, before discounts.',
      },
      {
        name: 'discountAmount',
        description: 'Total discount the pricing API applied to the bundle.',
      },
      {
        name: 'discountPercentage',
        description:
          'The discount as a share of `originalPrice`, on a 0–100 scale.',
      },
      {
        name: 'hasDiscount',
        description:
          '`discountAmount > 0`. Pair with `data-hide-if-false` to hide a whole savings block.',
      },
      {
        name: 'unitPrice',
        description:
          '`price ÷ (visible slot units × bundle quantity)` — the real per-unit price at the card\'s current multiplier.',
      },
      {
        name: 'originalUnitPrice',
        description: 'The same division applied to `originalPrice`.',
      },
      {
        name: 'currency',
        description: 'ISO 4217 code the price fetch returned, e.g. `USD`.',
      },
    ],
    footer:
      'Everything but `isSelected` and `name` comes from the card\'s price summary, ' +
      'which the selector fills in from the pricing API — so these are the same ' +
      'numbers the cart will charge, not a re-parse of formatted text.',
    cautions: [
      '**`compare`, `savings`, `savingsPercentage` and `hasSavings` do not work here.** ' +
        'They are accepted by `data-next-bundle-display` on a slot *inside* a card, ' +
        'which is a different mechanism, and a page that uses them in a `bundle.` path ' +
        'gets an empty element plus `Unknown bundle display property: "{property}"` at ' +
        'warn level. Use `originalPrice`, `discountAmount`, `discountPercentage` and ' +
        '`hasDiscount` in this namespace. See [attributes.md](./attributes.md) for the ' +
        'in-card form.',
      "**A path renders nothing until the card's price fetch lands.** Values arrive " +
        'with the `bundle:price-updated` event ([events.md](./events.md)), so an ' +
        'element bound before that shows its markup fallback.',
      '**`{bundleId}` falls back to the selector id.** If no card carries that ' +
        '`data-next-bundle-id`, the value is taken from the *currently selected* card ' +
        'of a selector whose `data-next-selector-id` matches instead. That is ' +
        'deliberate — it is how a sticky bar shows "whatever is selected" — but it also ' +
        "means a typo'd bundle id can silently show another card's price. Bind to the " +
        'card id when you mean one card.',
      '**An unrecognised property logs and stops** — same warn line as above; see ' +
        '[logs.md](./logs.md).',
    ],
  },

  attributes: [
    // Container
    { group: 'Container', name: 'data-next-bundle-selector', type: 'boolean (presence)', required: true },
    { group: 'Container', name: 'data-next-selector-id', type: 'string', required: true },
    { group: 'Container', name: 'data-next-selection-mode', type: "'swap' | 'select'" },
    { group: 'Container', name: 'data-next-bundles', type: 'JSON string' },
    { group: 'Container', name: 'data-next-bundle-template-id', type: 'string' },
    { group: 'Container', name: 'data-next-bundle-template', type: 'string (HTML)' },
    { group: 'Container', name: 'data-next-bundle-slot-template-id', type: 'string' },
    { group: 'Container', name: 'data-next-bundle-slot-template', type: 'string (HTML)' },
    { group: 'Container', name: 'data-next-include-shipping', type: "'true' | 'false'" },
    { group: 'Container', name: 'data-next-upsell-context', type: 'boolean (presence)' },
    { group: 'Container', name: 'data-next-variant-selector-template-id', type: 'string' },
    { group: 'Container', name: 'data-next-variant-option-template-id', type: 'string' },

    // Card
    { group: 'Card', name: 'data-next-bundle-card', type: 'boolean (presence)', required: true },
    { group: 'Card', name: 'data-next-bundle-id', type: 'string', required: true },
    { group: 'Card', name: 'data-next-bundle-name', type: 'string' },
    { group: 'Card', name: 'data-next-bundle-items', type: 'JSON string' },
    { group: 'Card', name: 'data-next-selected', type: "'true' | 'false'" },
    { group: 'Card', name: 'data-next-quantity', type: 'number' },
    { group: 'Card', name: 'data-next-min-quantity', type: 'number' },
    { group: 'Card', name: 'data-next-max-quantity', type: 'number' },
    { group: 'Card', name: 'data-next-shipping-id', type: 'number' },

    // Slots and variants
    { group: 'Slots and variants', name: 'data-next-bundle-slots', type: 'boolean (presence)' },
    { group: 'Slots and variants', name: 'data-next-slot-index', type: 'number' },
    { group: 'Slots and variants', name: 'data-next-variant-selectors', type: 'boolean (presence)' },
    { group: 'Slots and variants', name: 'data-next-variant-options', type: 'boolean (presence)' },
    { group: 'Slots and variants', name: 'data-next-variant-code', type: 'string (attribute code)' },
    { group: 'Slots and variants', name: 'data-next-variant-option', type: 'boolean (presence)' },

    // Display slots
    { group: 'Display slots', name: 'data-next-bundle-display', type: 'string (field name)' },
    { group: 'Display slots', name: 'data-next-bundle-price', type: 'string (price variant)' },
    { group: 'Display slots', name: 'data-next-bundle-vouchers', type: 'boolean (presence)' },
    { group: 'Display slots', name: 'data-next-discounts', type: "'' | 'offer' | 'voucher'" },

    // Containers that live outside the selector. Both take the selector id as
    // their value rather than sitting inside `[data-next-bundle-selector]`, which
    // is what lets a stepper or a slot list render next to an Add-to-Cart button
    // on a product-detail page.
    {
      group: 'External containers',
      name: 'data-next-bundle-slots-for',
      type: 'string (selector ID)',
    },
    {
      group: 'External containers',
      name: 'data-next-bundle-qty-for',
      type: 'string (selector ID)',
    },

    // Line item properties
    { group: 'Line item properties', name: 'data-next-property', type: 'string (key)' },
    { group: 'Line item properties', name: 'data-next-default-property', type: 'string (key)' },
    // `data-next-show` / `data-next-hide` work inside bundle slots but are
    // implemented by conditional-display, not here — they appear only in this
    // feature's tests, so they belong to that feature's inventory.
  ],

  // Every class this feature toggles can be renamed, for a page whose CSS already
  // owns those names. `data-next-class-selected="is-active"` swaps `next-selected`.
  readsElsewhere: [
    {
      name: 'data-next-class-',
      description:
        'A prefix, not a whole attribute: `data-next-class-<name>` renames one of the classes this feature toggles, so it can drive CSS you already have instead of `next-*`. The `<name>` is the class without its `next-` prefix — `data-next-class-selected`, `data-next-class-in-cart`, `data-next-class-bundle-card`, `data-next-class-variant-selected`, `data-next-class-variant-unavailable`.',
      notes:
        'Renaming a class does not change what the feature does with it, and the default still applies to any class you do not rename.',
    },
  ],

  sets: [
    { name: 'data-selected-bundle', description: 'On the container: the currently selected bundle id.' },
    { name: 'data-selected', description: 'On a card or slot option: whether it is the current selection.' },
    { name: 'data-next-in-cart', description: "On a card: whether the bundle's packages are all in the cart." },
    { name: 'data-next-loading', description: 'On the container: a bundle price fetch is in flight.' },
  ],

  classes: [
    { name: 'next-selected', description: 'The selected bundle card, slot option, or variant option.' },
    { name: 'next-loading', description: 'A bundle price fetch is in flight.' },
  ],

  emits: ['bundle:selected', 'bundle:selection-changed', 'bundle:quantity-changed'],

  conflicts: [
    {
      feature: 'package-selector',
      because:
        'both manage which packages are in the cart, so overlapping packages get added by one and orphaned by the other during a swap. Keep their package sets disjoint.',
    },
    {
      feature: 'package-toggle',
      because:
        'a toggle writes its package to the cart independently. If that package is also inside a bundle, a bundle swap strips it, because the toggle\'s line does not carry the expected bundle tag.',
    },
    {
      feature: 'coupon',
      because:
        'a code that is also listed in `data-next-bundle-vouchers` is applied and removed automatically by the bundle selector, so applying it by hand as well leaves the voucher in an unpredictable state.',
    },
    {
      feature: 'add-to-cart',
      mode: 'swap',
      because:
        'a swap-mode bundle selector writes every bundle line to the cart on selection, so a button that also writes doubles them. Use select mode when there is a button.',
    },
  ],
});
