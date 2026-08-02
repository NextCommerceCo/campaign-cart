import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'selection-display',
  category: 'display',
  status: 'core',
  summary:
    "Shows what a selector currently has selected — its name, price, and savings — before it reaches the cart.",
  activates: '[data-next-display]',
  logPrefix: 'SelectionDisplayEnhancer',
  displayNamespace: 'selection',
  // An unmatched path falls through to the selected package, so a `Package` field
  // still resolves. None of the four below is one.
  displayFallback: [{ shape: 'Package' }],
  displayUnanswered: [
    {
      name: 'monthlyPrice',
      instead:
        'Nothing computes it. Divide an answered path with the expression form: `data-next-display="selection.{selectorId}.total/12"`.',
    },
    {
      name: 'yearlyPrice',
      instead:
        'Nothing computes it. Multiply an answered path: `data-next-display="selection.{selectorId}.total*12"`.',
    },
    {
      name: 'pricePerDay',
      instead:
        'Nothing computes it. Divide an answered path by the number of days: `data-next-display="selection.{selectorId}.total/30"`.',
    },
    {
      name: 'savingsPerUnit',
      instead:
        'Use `selection.savingsAmount` for the whole selection, or divide it by `selection.totalUnits` with the expression form.',
    },
  ],

  attributes: [
    {
      name: 'data-next-selector-id',
      type: 'string',
      required: false,
      description:
        "Which selector's selection to show. Without it the feature walks up the DOM for the nearest enclosing selector, so an element inside a selector needs no configuration.",
      notes: '`data-selector-id` is accepted as an alias.',
    },
    {
      name: 'data-next-id',
      type: 'string',
      required: false,
      description:
        'Fallback identifier read from an enclosing cart selector that has no `data-next-selector-id`.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-cart-selector',
      description:
        'Marks the enclosing element as the cart selector to resolve against while walking up the DOM.',
    },
    {
      name: 'data-next-package-id',
      description:
        "Read from the selected card to work out which package's values to show.",
    },
    {
      name: 'data-next-selected',
      description:
        'Read from cards to find which one is currently selected when no selection event has fired yet — for example on a page that renders pre-selected.',
    },
    {
      name: 'data-next-quantity',
      description: "Read from the selected card, so the price reflects that card's quantity.",
    },
    {
      name: 'data-next-shipping-id',
      description: 'Read from the selected card when the selection carries a shipping method.',
    },
  ],

  emits: [],

  dependsOn: [
    {
      feature: 'package-selector',
      because:
        'it shows whatever the named selector currently has selected, so a `selection.*` binding resolves to nothing without one on the page.',
    },
  ],
  sections: [
    {
      title: 'Selection vs package vs cart',
      body: `
Three namespaces answer three different questions. Picking the wrong one is the
usual cause of a value that never updates:

| Use | When you want |
|---|---|
| \`selection.*\` | What the visitor has **picked but not yet added** — a live preview beside the selector |
| \`package.*\` | A **fixed** package's own values, regardless of any selection |
| \`cart.*\` | What is **actually in the cart** |

\`\`\`html
<div data-next-package-selector data-next-selector-id="main">
  <!-- inside: the selector is inferred -->
  <p>You picked <span data-next-display="selection.name"></span>
     for <span data-next-display="selection.total"></span></p>
</div>

<!-- outside: name the selector -->
<span data-next-display="selection.total" data-next-selector-id="main"></span>
\`\`\`

Modifiers (\`data-next-format\`, \`data-hide-if-zero\`, …) are documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).
`,
    },
  ],
});
