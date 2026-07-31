import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'order-display',
  category: 'display',
  status: 'core',
  summary:
    'Shows values from a completed order — number, totals, customer, shipping — on receipt and upsell pages.',
  activates: '[data-next-display]',
  logPrefix: 'OrderDisplayEnhancer',
  displayNamespace: 'order',

  attributes: [
    {
      name: 'data-next-display',
      type: 'string (order path)',
      required: true,
      description:
        'The order value to show, as `order.{path}`. The order is loaded from the reference in the page URL, so these elements work on any post-purchase page without extra wiring.',
      notes:
        'The order store keeps a completed order for 15 minutes. After that the values are gone and these elements render empty — expected on a page revisited much later, not a bug to chase.',
    },
  ],

  classes: [
    {
      name: 'next-loaded',
      description:
        'On the element once the order has arrived and its value is rendered. Removed while loading or after a failure, so it is the signal that what is on screen is real.',
    },
  ],

  emits: [],

  requires: [
    {
      name: 'orderStore',
      because:
        'it reads the completed order, loaded from the `?ref_id` in the URL. Opened without one there is no order and every binding stays at its placeholder.',
    },
  ],
  pairsWith: [
    {
      feature: 'order-item-list',
      because:
        'the standard receipt: order totals from the display bindings, the purchased lines from the list.',
    },
  ],
  sections: [
    {
      title: 'Loading and error states',
      body: `
The order arrives asynchronously, so the namespace exposes its own status paths.
Use them rather than assuming the values are there on first paint:

\`\`\`html
<div data-next-display="order.isLoading">Loading your order…</div>
<div data-next-display="order.hasError">We could not load your order.</div>
<div data-next-display="order.errorMessage"></div>

<p>Order <span data-next-display="order.number"></span> —
   <span data-next-display="order.total_incl_tax"></span></p>
\`\`\`

For a per-line breakdown of what was bought, use the order item list feature
rather than these single-value bindings. Modifiers are documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).
`,
    },
  ],
});
