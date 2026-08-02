import { defineFeature } from '@/docs/schema/feature-manifest';

const CONTAINER = 'Container attributes';
const CARD = 'Card attributes';
const SLOTS = 'Display slots (inside a card)';
const UPSELL = 'Upsell navigation';

// Groups for the `toggle.` display paths — a reader looking for a price should not
// have to read past the identity fields to find one.
const IDENTITY = 'Identity';
const PRICE = 'Price';
const SUBSCRIPTION = 'Subscription';

export default defineFeature({
  id: 'package-toggle',
  category: 'cart',
  status: 'core',
  summary:
    'Turns an add-on — a warranty, express shipping, a bonus item — on and off in the cart with one click.',
  activates: '[data-next-package-toggle]',
  logPrefix: 'PackageToggleEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },
  // `data-next-discounts` containers are rendered by this shared util, not by
  // the feature's own files.
  extraSource: ['src/core/rendering/discount-renderer.ts'],

  displayNamespace: 'toggle',
  displayPaths: {
    prefix: 'toggle.{packageId}',
    intro:
      "where `{packageId}` is a card's `data-next-package-id`. The element does not " +
      'have to sit inside the card, or inside the container.',
    example:
      '<span data-next-display="toggle.101.price"></span>\n' +
      '<span data-next-display="toggle.101.discountAmount" data-hide-if-zero="true"></span>',
    paths: [
      {
        group: IDENTITY,
        name: 'packageId',
        description: 'The package `ref_id` the card is bound to.',
      },
      {
        group: IDENTITY,
        name: 'name',
        description: 'Package display name from the campaign.',
      },
      {
        group: IDENTITY,
        name: 'image',
        description:
          'Package image URL. Renders as text — to set an `<img src>`, use the in-card `data-next-toggle-display="image"` form instead ([attributes.md](./attributes.md)).',
      },
      {
        group: IDENTITY,
        name: 'quantity',
        description: 'Units this card adds to the cart.',
      },
      {
        group: IDENTITY,
        name: 'productId',
        description:
          'Product the package belongs to. Empty when the campaign does not carry one.',
      },
      {
        group: IDENTITY,
        name: 'variantId',
        description:
          'Product variant. Empty when the package is not a variant.',
      },
      {
        group: IDENTITY,
        name: 'variantName',
        description: 'Variant display name, e.g. `Large`.',
      },
      {
        group: IDENTITY,
        name: 'productName',
        description: 'Product display name.',
      },
      {
        group: IDENTITY,
        name: 'sku',
        description: 'Product SKU. Empty when the product has none.',
      },
      {
        group: IDENTITY,
        name: 'isSelected',
        description:
          'The package is in the cart right now. Unlike the in-card `data-next-toggle-display="isSelected"`, this tracks live cart state.',
      },
      {
        group: PRICE,
        name: 'price',
        description: "Total for the card's quantity, after discounts.",
      },
      {
        group: PRICE,
        name: 'originalPrice',
        description: 'The same total before discounts.',
      },
      {
        group: PRICE,
        name: 'unitPrice',
        description: 'What one unit costs after discounts.',
      },
      {
        group: PRICE,
        name: 'originalUnitPrice',
        description: 'What one unit costs before discounts.',
      },
      {
        group: PRICE,
        name: 'discountAmount',
        description: 'Total discount on the line. `0` when there is none.',
      },
      {
        group: PRICE,
        name: 'discountPercentage',
        description:
          '`discountAmount ÷ originalPrice × 100`, on a 0–100 scale.',
      },
      {
        group: PRICE,
        name: 'hasDiscount',
        description:
          '`discountAmount > 0`. Pair with `data-hide-if-false` to hide a whole savings block.',
      },
      {
        group: PRICE,
        name: 'currency',
        description: 'ISO 4217 code for the prices above, e.g. `USD`.',
      },
      {
        group: SUBSCRIPTION,
        name: 'isRecurring',
        description: 'The package bills on a schedule rather than once.',
      },
      {
        group: SUBSCRIPTION,
        name: 'interval',
        description:
          'Billing interval: `day` or `month`. Empty on a one-time package.',
      },
      {
        group: SUBSCRIPTION,
        name: 'intervalCount',
        description:
          'Intervals between charges — `3` with `interval: month` is quarterly.',
      },
      {
        group: SUBSCRIPTION,
        name: 'frequency',
        description:
          'The cadence in words: `Per month`, `Every 3 months`, `One time`.',
      },
      {
        group: SUBSCRIPTION,
        name: 'recurringPrice',
        description:
          "What each later charge costs, for the card's quantity.",
      },
      {
        group: SUBSCRIPTION,
        name: 'originalRecurringPrice',
        description: 'The recurring charge before discounts.',
      },
    ],
    cautions: [
      "**A money path renders nothing until the card's price fetch lands.** The card " +
        'dispatches a `toggle:price-updated` DOM event when the numbers arrive — a ' +
        'browser event on the element, not one of the SDK events in ' +
        '[events.md](./events.md) — and the binding fills in then. Before that the ' +
        'element shows its markup fallback.',
      '**A path that names no live card stays silent.** A `{packageId}` no ' +
        '`[data-next-package-id]` card carries leaves the element untouched with no ' +
        'error — check the number against the markup when a binding never fills in.',
      '**An unrecognised property logs and stops.** Anything outside the tables above ' +
        'produces `Unknown toggle display property: "{property}"` at warn level; see ' +
        '[logs.md](./logs.md).',
    ],
  },

  attributes: [
    {
      group: CONTAINER,
      name: 'data-next-package-toggle',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks the container — or, in single-element mode, the one toggle element. The feature activates on this element.',
    },
    {
      group: CONTAINER,
      name: 'data-next-packages',
      type: 'JSON string',
      required: false,
      description:
        'A JSON array of package definitions used to auto-render cards instead of writing each one by hand. Each entry needs `packageId`; any other key is available to the template as `{toggle.<key>}`. Set `"selected": true` to add that package on load, and `"packageSync"` to a package-id list to render the card in sync mode.\n\n```json\n[\n  { "packageId": 101, "name": "Widget" },\n  { "packageId": 200, "name": "Extended Warranty", "packageSync": [101] }\n]\n```',
      values: 'a valid JSON array — invalid JSON is ignored with a warning',
      notes:
        'Auto-render needs a template too: set `data-next-toggle-template-id` or `data-next-toggle-template`, or give the container a `<template>` child.',
    },
    {
      group: CONTAINER,
      name: 'data-next-toggle-template-id',
      type: 'string',
      required: false,
      description:
        'Id of a `<template>` element whose `innerHTML` is the card template. Highest precedence of the three template sources.',
    },
    {
      group: CONTAINER,
      name: 'data-next-toggle-template',
      type: 'string (HTML)',
      required: false,
      description:
        'The card template as an inline HTML string. Reach for `data-next-toggle-template-id` once the template grows past a few elements.',
    },
    {
      group: CONTAINER,
      name: 'data-next-include-shipping',
      type: "'true' | 'false'",
      required: false,
      default: 'false',
      description:
        'When `true`, shipping is included in the price shown on cards that are not yet in the cart, so the preview matches what the cart will say.',
    },
    {
      group: CONTAINER,
      name: 'data-next-upsell-context',
      type: 'boolean (presence)',
      required: false,
      description:
        'Switches to post-purchase upsell mode: a click adds to the existing order rather than the cart, and the feature stops watching the cart store.',
    },

    {
      group: CARD,
      name: 'data-next-toggle-card',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks an element as a toggle card inside the container. Each card gets its own click handler and cart-state tracking.',
    },
    {
      group: CARD,
      name: 'data-next-package-id',
      type: 'number',
      required: true,
      description:
        'The `ref_id` of the package this card toggles. Must match a package in the campaign.',
    },
    {
      group: CARD,
      name: 'data-next-selected',
      type: "'true'",
      required: false,
      description:
        'Adds this package to the cart when the page loads, for an add-on that is opt-out rather than opt-in. Skipped if the package is already in the cart, and applied at most once per page load.',
      notes:
        'On a sync card the auto-add waits until at least one synced package is in the cart, so an add-on cannot appear before the product it belongs to.',
    },
    {
      group: CARD,
      name: 'data-next-quantity',
      type: 'number',
      required: false,
      default: '1',
      description: 'How many units to add when the card is toggled on.',
      notes:
        'Ignored when `data-next-package-sync` or `data-next-product-sync` is set — those derive the quantity instead.',
    },
    {
      group: CARD,
      name: 'data-next-package-sync',
      type: 'string (comma-separated ids)',
      required: false,
      description:
        "Keeps this card's quantity equal to the combined quantity of the listed packages — one warranty per unit sold, without the visitor managing it. When every synced package leaves the cart, this card is removed too.\n\n**Example:** `\"101,102\"` — quantity becomes (qty of 101) + (qty of 102).",
      notes:
        'Clicking a sync card while none of its synced packages are in the cart does nothing. If the synced product has variants the visitor can swap, use `data-next-product-sync` instead — a swap changes the package id but not the product id.',
    },
    {
      group: CARD,
      name: 'data-next-product-sync',
      type: 'string (comma-separated ids)',
      required: false,
      description:
        "Same idea as `data-next-package-sync`, but matched on product id, so every variant of a product counts toward the total. Use it when the visitor can swap variants.\n\n**Example:** `\"55\"` — quantity becomes the total across all cart lines for product 55.",
      notes:
        'Both sync attributes may be set on one card; their totals are added together.',
    },
    {
      group: CARD,
      name: 'data-next-is-upsell',
      type: "'true' | 'false'",
      required: false,
      default: 'false',
      description:
        'Marks the resulting cart line as an upsell or bump item, which changes how it is classified in the cart and in analytics.',
      notes:
        'It also delays sync-driven removal by 500ms, so a variant swap does not briefly drop the add-on and re-add it.',
    },
    {
      group: CARD,
      name: 'data-next-bump',
      type: 'boolean (presence)',
      required: false,
      description:
        'Marks the card as an order bump. Also detected when the card sits inside a `[data-next-bump-section]`, so a whole section can be marked at once.',
    },
    {
      group: CARD,
      name: 'data-next-exclude-property',
      type: 'string',
      required: false,
      description:
        'Custom-property keys this card should not copy onto its cart line, comma separated. Use it when an add-on should not inherit engraving text or a gift message from the main product.',
    },
    {
      group: CARD,
      name: 'data-add-text',
      type: 'string',
      required: false,
      description:
        'Button label while the package is out of the cart. Written into a `[data-next-button-text]` child if there is one, otherwise into the element\'s own text.',
      notes: 'Only applied when `data-remove-text` is set as well.',
    },
    {
      group: CARD,
      name: 'data-remove-text',
      type: 'string',
      required: false,
      description: 'Button label while the package is in the cart.',
      notes: 'Only applied when `data-add-text` is set as well.',
    },
    {
      group: CARD,
      name: 'data-next-toggle-container',
      type: 'boolean (presence)',
      required: false,
      description:
        "Marks a wrapper as this card's state container, so the state attributes and classes below land on the wrapper instead of the clickable element. Use it when the element you want to style is not the one you want clickable.",
    },
    {
      group: CARD,
      name: 'data-next-upsell-item',
      type: 'boolean (presence)',
      required: false,
      description:
        'Alternative marker for the state container, for markup already using upsell-item wrappers.',
    },

    {
      group: SLOTS,
      name: 'data-next-toggle-display',
      type: 'string (field name)',
      required: false,
      default: 'price',
      description:
        "Marks an element inside a card as a display slot. After every price update the named field's value is written into it. See **Display fields** below for the field names.",
      notes:
        "For the boolean fields the element is shown or hidden instead of receiving text. `isSelected` here reflects the `data-next-selected` attribute as of the last price update, not live cart state — for live state use `data-next-display=\"toggle.{packageId}.isSelected\"`.",
    },
    {
      group: SLOTS,
      name: 'data-next-toggle-price',
      type: 'string (field name)',
      required: false,
      default: 'price',
      description:
        'Deprecated spelling of `data-next-toggle-display`, kept working for existing markup. Same field names, same output — prefer `data-next-toggle-display` in anything new.',
    },
    {
      group: SLOTS,
      name: 'data-next-toggle-image',
      type: 'boolean (presence)',
      required: false,
      description:
        "Put on an `<img>` inside a card. Its `src` is set to the package image, and its `alt` to the package name when no `alt` is already there.",
    },
    {
      group: SLOTS,
      name: 'data-next-discounts',
      type: "'' | 'offer' | 'voucher'",
      required: false,
      default: '(empty)',
      description:
        "Lists the discounts applied to this card's package — one row per discount. Leave the value empty for every discount, or narrow it to one kind.",
      values: [
        { value: '(empty)', description: 'Every discount, offer and voucher alike.' },
        { value: 'offer', description: 'Only discounts from an offer.' },
        { value: 'voucher', description: 'Only discounts from a coupon or voucher code.' },
      ],
      notes:
        'The container is re-rendered on every price update, so do not attach listeners to the rows it produces.',
    },

    {
      group: UPSELL,
      name: 'data-next-url',
      type: 'string',
      required: false,
      default: 'the meta[name="next-upsell-accept-url"] content',
      description:
        'In upsell mode, where to send the visitor after the add succeeds. Looked for on the card, then the state container, then the container, then the meta tag. The order id is appended as a query parameter if it is not already there.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-upsell-section',
      description:
        'Read from an enclosing section: marks everything inside it as upsell content, so cards do not each need `data-next-is-upsell`.',
    },
  ],

  sets: [
    {
      name: 'data-next-in-cart',
      description: "On the card: whether this card's package is in the cart.",
      values: '`true` / `false`',
    },
    {
      name: 'data-next-active',
      description:
        'On the state container: the same in-cart state, for styling a wrapper rather than the clickable element.',
      values: '`true` / `false`',
    },
    {
      name: 'data-next-loading',
      description:
        'On the card: `true` while a price fetch or cart write for this card is in flight.',
      values: '`true` / `false`',
    },
  ],

  classes: [
    { name: 'next-toggle-card', description: 'Applied to every registered card.' },
    { name: 'next-in-cart', description: "This card's package is in the cart." },
    { name: 'next-not-in-cart', description: "This card's package is not in the cart." },
    { name: 'next-selected', description: 'The card is in its selected state.' },
    { name: 'next-active', description: 'Applied to the state container while in cart.' },
    { name: 'next-loading', description: 'A price fetch or cart write is in flight.' },
    {
      name: 'os--active',
      description: 'Compatibility class for starter-template styling that predates the namespaced classes.',
    },
  ],

  emits: ['toggle:toggled', 'toggle:selection-changed', 'upsell:added'],

  sections: [
    {
      title: 'Card template resolution order',
      body: `
For auto-render there are three ways to supply the card template, checked in this
order — the first one present wins:

1. \`data-next-toggle-template-id\` — id of a \`<template>\` element anywhere in the page
2. \`data-next-toggle-template\` — an inline HTML string on the container
3. a direct \`<template>\` child of the container

\`\`\`html
<div data-next-package-toggle
     data-next-packages='[{"packageId":200,"name":"Extended Warranty"}]'>
  <template>
    <div data-next-toggle-card data-next-package-id="{package.packageId}">
      {package.name} — <span data-next-toggle-display="price"></span>
    </div>
  </template>
</div>
\`\`\`
`,
    },
    {
      title: 'Display fields',
      body: `
These field names are accepted by \`data-next-toggle-display\` (and its deprecated
twin \`data-next-toggle-price\`) for slots **inside** a card, and by
\`data-next-display="toggle.{packageId}.{field}"\` for elements **anywhere** in the
page. One list serves both — an unrecognised name leaves the element untouched.

Every field, with its default format and what it shows, is listed once in
[display-paths.md](./display-paths.md) — read out of the method that answers the
path, so it cannot drift from what renders. Two of them behave differently in the
in-card form: \`image\` sets \`src\` on an \`<img>\` rather than writing text, and
\`isSelected\` reflects \`data-next-selected\` as of the last price update rather than
live cart state.

The standard display modifiers apply to the \`data-next-display\` form:
\`data-next-format\`, \`data-hide-if-zero\`, \`data-hide-if-false\`.
`,
    },
  ],
});
