import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'product-display',
  category: 'display',
  status: 'core',
  summary:
    "Shows a campaign package's own name, price, and savings — before anything is in the cart.",
  activates: '[data-next-display]',
  logPrefix: 'ProductDisplayEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },
  displayNamespace: 'package',

  attributes: [
    {
      name: 'data-next-multiply-quantity',
      type: 'boolean (presence)',
      required: false,
      description:
        "Scales the value by the quantity currently chosen, so a per-unit price reads as the pack total the visitor would actually pay.",
    },
    {
      name: 'data-next-quantity-selector-id',
      type: 'string',
      required: false,
      description:
        'Which selector supplies that quantity, by id. Use it when the price sits outside the selector whose stepper drives it.',
    },
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        'Read from an enclosing selector so a price inside a card follows that card without being configured.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-upsell / data-next-upsell-quantity',
      description:
        'Read from an enclosing upsell offer, so a price shown inside an offer reflects the offer quantity rather than a cart line.',
    },
    {
      name: 'data-container',
      description:
        'Read while walking up the DOM to find the element a price belongs to, for markup that groups a package without using a selector card.',
    },
  ],

  emits: [],

  sections: [
    {
      title: 'Modifiers',
      body: `
Formatting and hiding work the same as for every display namespace —
\`data-next-format\`, \`data-hide-if-zero\`, \`data-hide-if-false\`,
\`data-hide-zero-cents\`, \`data-multiply-by\`, \`data-divide-by\`. They are
documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).

The \`campaign.\` namespace is an alias for \`package.\` and resolves identically.

\`\`\`html
<!-- A package's price, and its per-unit price -->
<span data-next-display="package.101.price"></span>
<span data-next-display="package.101.price" data-divide-by="3"></span>

<!-- Savings, hidden entirely when there are none -->
<span data-next-display="package.101.savingsAmount" data-hide-if-zero="true"></span>
\`\`\`
`,
    },
  ],
});
