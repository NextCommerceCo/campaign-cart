import { defineFeature } from '@/docs/schema/feature-manifest';

const HOST = 'On the list element';
const TEMPLATE = 'Inside the item template';

export default defineFeature({
  id: 'cart-item-list',
  category: 'cart',
  status: 'core',
  summary:
    'Renders one row per cart line from a template you supply, and re-renders whenever the cart changes.',
  activates: '[data-next-cart-items]',
  logPrefix: 'CartItemListEnhancer',
  // Keeps its When / Meaning / Action prose; the drift test checks coverage
  // instead of overwriting. See FeatureManifest.pages.
  pages: { logs: 'hand-written', errors: 'hand-written', relations: 'hand-written', getStarted: 'hand-written' },

  attributes: [
    {
      group: HOST,
      name: 'data-next-cart-items',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks the element as the cart line list. Presence is enough — it takes no value.',
    },
    {
      group: HOST,
      name: 'data-item-template-id',
      type: 'string',
      required: false,
      description:
        "Id of an element whose `innerHTML` is the per-row template. Highest precedence of the four template sources.",
      values: 'an element id present in the document when the feature initializes',
    },
    {
      group: HOST,
      name: 'data-item-template-selector',
      type: 'string',
      required: false,
      description:
        "CSS selector for the element whose `innerHTML` is the per-row template. Used when `data-item-template-id` is absent.",
      values: 'a selector resolving to exactly one element at init time',
    },
    {
      group: HOST,
      name: 'data-item-template',
      type: 'string (HTML)',
      required: false,
      description:
        'The per-row template as an inline HTML string. Used when neither id nor selector is set.',
    },
    {
      group: HOST,
      name: 'data-empty-template',
      type: 'string (HTML)',
      required: false,
      default: '<div class="cart-empty">Your cart is empty</div>',
      description: 'What to render in place of rows when the cart is empty.',
    },
    {
      group: HOST,
      name: 'data-title-map',
      type: 'JSON string',
      required: false,
      description:
        'Overrides the campaign package name per package, for pages that use their own wording. Keys are package ids, values are the titles to show for `{item.name}` and `{item.title}`.\n\n```html\n<div data-next-cart-items data-title-map=\'{"42": "Main Product", "43": "Accessory"}\'>\n```',
      values: 'a JSON object of package id → title',
      notes:
        'Malformed JSON is logged as a warning and ignored, so the list falls back to campaign names rather than failing to render.',
    },
    {
      group: HOST,
      name: 'data-group-items',
      type: 'boolean (presence)',
      required: false,
      description:
        'Collapses cart lines that share a package id into one row with the quantities added together. Display only — the cart itself is untouched.',
    },

    {
      group: TEMPLATE,
      name: 'data-cart-item-id',
      type: 'string',
      required: false,
      description:
        'Identifies a rendered row by cart line id. The feature counts and queries rows through it, so keep it on the row root — usually as `data-cart-item-id="{item.id}"`.',
    },
    {
      group: TEMPLATE,
      name: 'data-package-id',
      type: 'number',
      required: false,
      description:
        'Ties a control inside the row to its package, normally as `data-package-id="{item.packageId}"`. The quantity and remove features inside the row both read it.',
    },
    {
      group: TEMPLATE,
      name: 'data-next-quantity',
      type: "'increase' | 'decrease' | 'set'",
      required: false,
      description:
        "Puts a quantity control in the row. After each re-render the feature re-binds these, so they keep working on freshly rendered rows. Full reference: the quantity-control feature.",
    },
    {
      group: TEMPLATE,
      name: 'data-next-remove-item',
      type: 'boolean (presence)',
      required: false,
      description:
        'Puts a remove button in the row, re-bound after each re-render like the quantity controls. Full reference: the remove-item feature.',
    },
    {
      group: TEMPLATE,
      name: 'data-confirm',
      type: "'true'",
      required: false,
      description:
        'On a remove button inside the row: ask the visitor to confirm before removing. The built-in default template sets this.',
    },
    {
      group: TEMPLATE,
      name: 'data-confirm-message',
      type: 'string',
      required: false,
      default: 'Remove this item from your cart?',
      description: 'The wording of that confirmation, when `data-confirm="true"` is set.',
    },
  ],

  emits: [],

  sections: [
    {
      title: 'Template resolution order',
      body: `
The per-row template is taken from the first of these that is present:

1. \`data-item-template-id\`
2. \`data-item-template-selector\`
3. \`data-item-template\`
4. the list element's own \`innerHTML\`

With none of them, a built-in default row is used — it already includes quantity
controls and a remove button with confirmation.
`,
    },
    {
      title: 'Re-render safety',
      body: `
The list replaces its entire \`innerHTML\` on every cart change. Anything you
attach yourself to a rendered row is destroyed by the next update.

\`\`\`js
// Breaks: the row is replaced on the next cart change
document.querySelector('[data-cart-item-id="1"] .remove-btn')
  .addEventListener('click', handler);

// Works: listen on the list, which survives re-renders
document.querySelector('[data-next-cart-items]')
  .addEventListener('click', (e) => {
    const row = e.target.closest('[data-cart-item-id]');
    if (row) handler(row.dataset.cartItemId);
  });
\`\`\`

The SDK's own controls inside the row — \`data-next-quantity\`,
\`data-next-remove-item\` — are exempt: the feature re-binds them after every
render, so put those in the template rather than wiring them yourself.
`,
    },
  ],
});
