import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'shipping-display',
  category: 'display',
  status: 'core',
  summary:
    "Shows a shipping method's name and cost, including whether it is free.",
  activates: '[data-next-display]',
  logPrefix: 'ShippingDisplayEnhancer',
  displayNamespace: 'shipping',

  attributes: [
    {
      name: 'data-next-shipping-id',
      type: 'number',
      required: true,
      description:
        'Which shipping method to describe. Read from the element itself or the nearest enclosing element that carries it, so a row of shipping options needs it only once per row.',
      notes:
        'Without it in scope the feature has no method to resolve and the element stays empty. This is the usual reason a shipping price renders blank.',
    },
  ],

  emits: [],

  requires: [
    {
      name: 'campaignStore',
      because:
        'shipping names and costs come from the campaign\'s shipping methods.',
    },
  ],
  sections: [
    {
      title: 'Shipping options list',
      body: `
The typical use is a list of choices, each row carrying its own id:

\`\`\`html
<label data-next-shipping-id="1">
  <input type="radio" name="shipping">
  <span data-next-display="shipping.name"></span>
  <span data-next-display="shipping.cost"></span>
</label>

<label data-next-shipping-id="2">
  <input type="radio" name="shipping">
  <span data-next-display="shipping.name"></span>
  <span data-next-display="shipping.isFree">Free</span>
</label>
\`\`\`

These paths describe a **method in the campaign**, not the cart. For what the
visitor is currently being charged for shipping, use \`cart.shipping\` — it
reflects the selected method and any shipping discount. Modifiers are documented
once in [display-core](../../../../display/display-core/guide/reference/attributes.md).
`,
    },
  ],
});
