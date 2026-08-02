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
  // A routed path with no branch is read off runtime data, and which object it lands
  // on depends on the path: `order.total_incl_tax` off the order itself, everything
  // else off the store state that holds it.
  displayFallback: [
    { mappedPrefix: 'order.', shape: 'Order' },
    { shape: 'OrderState' },
  ],
  displayUnanswered: [
    {
      name: 'id',
      instead:
        'Use `order.ref_id` for the reference the API keys on, or `order.number` for the one to show a customer. `Order` declares no `id`.',
    },
    { name: 'total_incl_tax', instead: 'Use `order.total`.' },
    { name: 'order_status_url', instead: 'Use `order.statusUrl`.' },
    { name: 'is_test', instead: 'Use `order.isTest`.' },
    { name: 'supports_upsells', instead: 'Use `order.supportsUpsells`.' },
    { name: 'shipping_method', instead: 'Use `order.shippingMethod`.' },
    {
      name: 'status',
      instead:
        'Nothing — `Order` declares no `status`, and this entry\'s `fallback: \'Completed\'` makes the path render `Completed` whatever the order did. Read the state from the fields that exist, such as `order.isTest`.',
    },
    {
      name: 'total.formatted',
      instead: 'Use `order.total`, which is currency-formatted already.',
    },
    {
      name: 'createdAt.formatted',
      instead: 'Use `order.createdAt`, which is date-formatted already.',
    },
  ],

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
   <span data-next-display="order.total"></span></p>
\`\`\`

For a per-line breakdown of what was bought, use the order item list feature
rather than these single-value bindings. Modifiers are documented once in
[display-core](../../../../display/display-core/guide/reference/attributes.md).
`,
    },
  ],
});
