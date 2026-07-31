import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'order-item-list',
  category: 'order',
  status: 'core',
  summary:
    'Renders one row per line of a completed order, from a template you supply — the receipt equivalent of the cart item list.',
  activates: '[data-next-order-items]',
  logPrefix: 'OrderItemListEnhancer',

  attributes: [
    {
      name: 'data-next-order-items',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks the element as the order line list. The order is loaded from the reference in the page URL, so a receipt page needs no further wiring.',
    },
    {
      name: 'data-item-template-id',
      type: 'string',
      required: false,
      description:
        "Id of an element whose `innerHTML` is the per-row template. Highest precedence of the four template sources.",
    },
    {
      name: 'data-item-template-selector',
      type: 'string (CSS selector)',
      required: false,
      description:
        'Selector for the element whose `innerHTML` is the per-row template. Used when `data-item-template-id` is absent.',
    },
    {
      name: 'data-item-template',
      type: 'string (HTML)',
      required: false,
      description:
        'The per-row template as an inline HTML string. Used when neither id nor selector is set.',
    },
    {
      name: 'data-empty-template',
      type: 'string (HTML)',
      required: false,
      description:
        'What to render when the order has no lines — which in practice means the order failed to load rather than a genuinely empty purchase.',
    },
  ],

  classes: [
    {
      name: 'order-loading',
      description:
        'The order is still being fetched. Show a skeleton from this rather than assuming rows exist on first paint.',
    },
    {
      name: 'order-has-items',
      description: 'The order loaded and has at least one line.',
    },
    { name: 'order-empty', description: 'The order loaded with no lines.' },
    {
      name: 'order-error',
      description:
        'The order could not be loaded. Pair it with a message, or the visitor sees an empty receipt with no explanation.',
    },
  ],

  emits: [],

  requires: [
    {
      name: 'orderStore',
      because:
        'it renders the lines of a loaded order, which needs the `?ref_id` the order page is opened with.',
    },
  ],
  sections: [
    {
      title: 'Example',
      body: `
\`\`\`html
<div data-next-order-items data-item-template-id="order-row"></div>

<template id="order-row">
  <div class="order-row">
    <span>{item.name}</span>
    <span>{item.quantity}</span>
    <span>{item.price}</span>
  </div>
</template>
\`\`\`

Row tokens come from the order line rather than a cart line, so a cart template is
not interchangeable with this one — the shapes differ. Look the fields up under
[order display paths](../../../../display/order-display/guide/reference/display-paths.md).

Like the cart item list, this replaces its \`innerHTML\` when the order arrives, so
do not attach listeners to a rendered row — bind on the container instead.
`,
    },
  ],
});
