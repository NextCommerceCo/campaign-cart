import { defineFeature } from '@/docs/schema/feature-manifest';

const CONTAINER = 'Container attributes';
const CARD = 'Card attributes';
const PRICE = 'Price slots (inside a card)';
const QUANTITY = 'Inline quantity controls (inside a card)';

export default defineFeature({
  id: 'package-selector',
  category: 'cart',
  status: 'core',
  summary:
    'Presents a group of packages as cards and tracks which one the visitor picked — optionally writing the choice straight to the cart.',
  activates: '[data-next-package-selector]',
  logPrefix: 'PackageSelectorEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  displayNamespace: 'selector',
  displayPaths: {
    prefix: 'selector.{selectorId}.{packageId}',
    intro:
      "where `{selectorId}` is the container's `data-next-selector-id` and " +
      "`{packageId}` is a card's `data-next-package-id`. The element does not have to " +
      'sit inside the card, or inside the container.',
    example:
      '<span data-next-display="selector.main.101.price"></span>\n' +
      '<span data-next-display="selector.main.101.savings" data-hide-if-zero="true"></span>',
    paths: [
      {
        name: 'isSelected',
        description:
          "The card the visitor has picked. Reads the card's own `data-next-selected`, so it tracks the selection, not the cart.",
      },
      {
        name: 'isInCart',
        description:
          "The card's package is in the cart — including when it got there as a swap of another package.",
      },
      { name: 'price', description: 'Card total at its current quantity.' },
      {
        name: 'compare',
        description:
          'Retail / compare-at total. Empty when the package has no `price_retail`.',
      },
      {
        name: 'savings',
        description: "Compare price minus the card's subtotal.",
      },
      {
        name: 'savingsPercentage',
        description: '`savings ÷ compare × 100`, on a 0–100 scale.',
      },
      {
        name: 'hasSavings',
        description:
          '`savings > 0`. Pair with `data-hide-if-false` to hide a whole savings block.',
      },
    ],
    footer:
      'The four money paths read the raw numbers the selector writes onto the card ' +
      '(`data-package-price-total`, `-compare`, `-savings`, `-savings-pct` — see ' +
      '[attributes.md](./attributes.md)), so they carry the price the API returned, ' +
      'not a re-parse of formatted text.',
    cautions: [
      "**A money path renders nothing until the card's price fetch lands.** The card " +
        'dispatches a `selector:price-updated` DOM event when the numbers arrive — a ' +
        'browser event on the element, not one of the SDK events in ' +
        '[events.md](./events.md) — and the binding fills in then. Before that the ' +
        'element shows its markup fallback, so put the wanted placeholder inside it ' +
        'rather than expecting a `0`.',
      '**Zero reads as "no value".** `price`, `compare` and `savings` resolve through ' +
        '`parseFloat(...) || undefined`, so a genuine `0` is indistinguishable from a ' +
        'missing attribute and the element stays empty. For a free package, show the ' +
        'wording with [conditional display](../../../../display/conditional-display/guide/overview.md) ' +
        'instead of relying on this path to print `0.00`.',
      '**A path that names no live card stays silent.** A `{selectorId}` or ' +
        '`{packageId}` that matches no `[data-next-selector-card]` leaves the element ' +
        'untouched with no error — check both values against the markup when a binding ' +
        'never fills in.',
      '**An unrecognised property logs and stops.** Anything outside the table above ' +
        'produces `Unknown selector display property: "{property}"` at warn level; see ' +
        '[logs.md](./logs.md).',
    ],
  },

  attributes: [
    {
      group: CONTAINER,
      name: 'data-next-package-selector',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks the element as a package selector container and triggers instantiation by `AttributeScanner`. Must be on the outermost container element.',
    },
    {
      group: CONTAINER,
      name: 'data-next-selector-id',
      type: 'string',
      required: true,
      description:
        'Unique identifier for this selector instance. Other features — the add-to-cart button, accept-upsell buttons, display bindings — use this value to find the selector and read the current selection.',
      values: 'any non-empty string, unique on the page',
    },
    {
      group: CONTAINER,
      name: 'data-next-selection-mode',
      type: "'swap' | 'select'",
      required: false,
      default: 'swap',
      description: 'Controls whether clicking a card writes to the cart immediately.',
      values: [
        {
          value: 'swap',
          description:
            'A card click adds or swaps the package in the cart automatically.',
        },
        {
          value: 'select',
          description:
            'A card click only updates visual state. An external add-to-cart button performs the cart write.',
        },
      ],
      notes:
        'Forced to `select` when `data-next-upsell-context` is present. Pairing `swap` mode with an add-to-cart button on the same selector produces two cart writes per click — pick one.',
    },
    {
      group: CONTAINER,
      name: 'data-next-upsell-context',
      type: 'boolean (presence)',
      required: false,
      description:
        'Marks the selector as part of a post-purchase upsell flow. Cart store operations are disabled, the mode is forced to `select`, and prices are fetched with the `upsell=true` flag so the API can apply upsell-specific pricing.',
    },
    {
      group: CONTAINER,
      name: 'data-next-include-shipping',
      type: "'true' | 'false'",
      required: false,
      default: 'false',
      description:
        'When `true`, shipping cost is included in the price calculation sent to the bundle price API, and therefore in what the price slots display.',
    },
    {
      group: CONTAINER,
      name: 'data-next-packages',
      type: 'JSON string',
      required: false,
      description:
        'A JSON array of package definitions used to auto-render the cards, instead of writing each card by hand. Each object needs at least `packageId`; any other key is exposed to the card template as `{package.<key>}`.\n\n```html\ndata-next-packages=\'[{"packageId":101,"selected":true},{"packageId":102}]\'\n```',
      values: 'a valid JSON array — non-array values are ignored with a warning',
    },
    {
      group: CONTAINER,
      name: 'data-next-package-template-id',
      type: 'string',
      required: false,
      description:
        'Id of a `<template>` element whose `innerHTML` is the card template for auto-rendering. Highest precedence of the three template sources.',
    },
    {
      group: CONTAINER,
      name: 'data-next-package-template',
      type: 'string (HTML)',
      required: false,
      description:
        'The card template as an inline HTML string. Used when `data-next-package-template-id` is absent.',
    },

    {
      group: CARD,
      name: 'data-next-selector-card',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks an element as a card inside the container. The selector scans for these on init and on DOM mutations, so cards added later are picked up.',
    },
    {
      group: CARD,
      name: 'data-next-package-id',
      type: 'number',
      required: true,
      description: 'The `ref_id` of the package this card represents.',
      notes:
        'Cards with a missing or non-integer value are skipped with a warning — the card renders but does nothing when clicked.',
    },
    {
      group: CARD,
      name: 'data-next-selected',
      type: "'true' | 'false'",
      required: false,
      default: 'false',
      description:
        'Marks this card as pre-selected on load. Only the first card with `true` wins; later ones are ignored. The selector also writes this attribute at runtime to reflect the current selection.',
    },
    {
      group: CARD,
      name: 'data-next-quantity',
      type: 'number',
      required: false,
      default: '1',
      description:
        "This card's starting quantity. Written back by the selector when inline quantity controls change it.",
    },
    {
      group: CARD,
      name: 'data-next-min-quantity',
      type: 'number',
      required: false,
      default: '1',
      description:
        'Lowest quantity the inline controls allow. The decrease button is disabled at this value.',
    },
    {
      group: CARD,
      name: 'data-next-max-quantity',
      type: 'number',
      required: false,
      default: '999',
      description:
        'Highest quantity the inline controls allow. The increase button is disabled at this value.',
    },
    {
      group: CARD,
      name: 'data-next-shipping-id',
      type: 'number',
      required: false,
      description:
        'Shipping method to apply when this card is selected. Applied in `swap` mode only.',
      notes:
        'A non-integer value is logged as a warning and ignored, so the cart silently keeps the previous shipping method.',
    },

    {
      group: PRICE,
      name: 'data-next-package-price',
      type: 'string (price variant)',
      required: false,
      description:
        "Place on an element inside a card. The selector writes the formatted price into that element after fetching from the bundle price API. With no value, it shows the card's total.",
      values: [
        { value: '(empty)', description: 'Total price for this package at the current quantity.' },
        { value: 'compare', description: 'Retail / compare-at price before discounts.' },
        { value: 'savings', description: 'Discount amount — compare price minus total.' },
        { value: 'savingsPercentage', description: 'Discount as a percentage of the compare price.' },
        { value: 'subtotal', description: 'Subtotal before shipping and discounts.' },
      ],
    },

    {
      group: QUANTITY,
      name: 'data-next-quantity-increase',
      type: 'boolean (presence)',
      required: false,
      description:
        "Button inside a card that adds 1 to that card's quantity. Wired up automatically when present. Disabled — `disabled` attribute plus `next-disabled` class — at `data-next-max-quantity`.",
    },
    {
      group: QUANTITY,
      name: 'data-next-quantity-decrease',
      type: 'boolean (presence)',
      required: false,
      description:
        "Button inside a card that subtracts 1 from that card's quantity. Disabled at `data-next-min-quantity`.",
    },
    {
      group: QUANTITY,
      name: 'data-next-quantity-display',
      type: 'boolean (presence)',
      required: false,
      description:
        "Element inside a card whose text content is kept in sync with that card's current quantity.",
    },
  ],

  sets: [
    {
      name: 'data-selected-package',
      description:
        'On the container: the currently selected package id. This is the DOM fallback other features read when they cannot call the selector directly, so a page can render with a selection already in place.',
      values: 'package id as a string',
    },
    {
      name: 'data-next-loading',
      description:
        'On the container: `true` while price data is being fetched, `false` once it resolves. Drive a skeleton or spinner off this rather than guessing at timing.',
      values: '`true` / `false`',
    },
    {
      name: 'data-next-selected',
      description:
        'On each card: whether it is the current selection. Also accepted as input for the initial state.',
      values: '`true` / `false`',
    },
    {
      name: 'data-next-in-cart',
      description:
        "On each card: whether this card's package is currently in the cart.",
      values: '`true` / `false`',
    },
    {
      name: 'data-package-price-total',
      description:
        'On each card after a price fetch: the raw numeric total. These raw values exist so display bindings and tests can read numbers without parsing formatted currency.',
      values: 'float as a string',
    },
    {
      name: 'data-package-price-compare',
      description:
        'On each card after a price fetch: the raw retail / compare-at price. Empty string when there is no compare price.',
      values: 'float as a string, or empty',
    },
    {
      name: 'data-package-price-savings',
      description:
        'On each card after a price fetch: the raw savings amount. `0` when there are none.',
      values: 'float as a string',
    },
    {
      name: 'data-package-price-savings-pct',
      description:
        'On each card after a price fetch: the raw savings percentage, 0–100. `0` when there are none.',
      values: 'float as a string',
    },
  ],

  emits: [
    'selector:item-selected',
    'selector:selection-changed',
    'selector:quantity-changed',
  ],

  sections: [
    {
      title: 'Card template resolution order',
      body: `
There are three ways to supply the card template for auto-rendering, checked in
this order — the first one present wins:

1. \`data-next-package-template-id\` — id of a \`<template>\` element anywhere in the page
2. \`data-next-package-template\` — an inline HTML string on the container
3. a direct \`<template>\` child of the container

\`\`\`html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-packages='[{"packageId":101},{"packageId":102}]'>
  <template>
    <div data-next-selector-card data-next-package-id="{package.packageId}">
      {package.name} — <span data-next-package-price></span>
    </div>
  </template>
</div>
\`\`\`
`,
    },
    {
      title: 'Display system integration',
      body: `
To show a card's state somewhere else on the page, bind an element with
\`data-next-display="selector.{selectorId}.{packageId}.{property}"\`. The element
does not have to live inside the card, or even inside the container.

Every property the namespace resolves, with its default format and what it shows,
is listed once in [display-paths.md](./display-paths.md) — read out of the method
that answers the path, so it cannot drift from what renders.

The standard display modifiers apply: \`data-next-format\`, \`data-hide-if-zero\`,
\`data-hide-if-false\`.
`,
    },
  ],

  conflicts: [
    {
      feature: 'package-toggle',
      because:
        'the selector enforces one choice at a time while a toggle is independent per card, so a package in both ends up in the cart without the selector knowing. Keep their package sets disjoint.',
    },
    {
      feature: 'add-to-cart',
      mode: 'swap',
      because:
        'in `swap` mode the selector writes to the cart on every card click, so adding a button that also writes doubles the cart write. Use `select` mode when there is a button.',
    },
  ],
});
