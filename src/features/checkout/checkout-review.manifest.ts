import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'checkout-review',
  category: 'checkout',
  status: 'optional',
  summary:
    'Plays back what the visitor entered — address, contact, payment method — so they can check it before paying.',
  activates: '[data-next-enhancer]',
  logPrefix: 'CheckoutReviewEnhancer',

  attributes: [
    {
      name: 'data-next-enhancer',
      type: "'checkout-review'",
      required: true,
      description:
        'Turns the element into a review block. This is the generic activation attribute — its value names the enhancer to attach, so it is not specific to review and an unrecognised value attaches nothing.',
      values: [
        {
          value: 'checkout-review',
          description: 'Attaches the review enhancer to this element.',
        },
      ],
      notes:
        'A typo in the value fails silently: the scanner logs `Unknown enhancer type: <value>` and the block stays empty.',
    },
    {
      name: 'data-next-checkout-review',
      type: 'string (field name)',
      required: true,
      description:
        'Marks an element as a review slot and names the checkout field to show in it. The value is read back from the form as the visitor types, so the review stays correct without a page step.',
    },
    {
      name: 'data-next-format',
      type: 'string',
      required: false,
      default: 'text',
      description:
        'How to render the value — for example formatting a phone number or a card expiry rather than echoing the raw input.',
    },
    {
      name: 'data-next-fallback',
      type: 'string',
      required: false,
      default: '(empty)',
      description:
        'What to show while the field is still blank. Without one an unfilled field renders as nothing, which reads as a broken layout rather than an empty value.',
    },
  ],

  emits: [],

  dependsOn: [
    {
      feature: 'checkout-form',
      because:
        'it plays back what the form collected, reading the checkout store the form writes to. On a page with no checkout form there is nothing to show and every slot stays empty.',
    },
  ],
  sections: [
    {
      title: 'Example',
      body: `
The review container is turned on with \`data-next-enhancer="checkout-review"\`;
each slot inside names its field:

\`\`\`html
<div data-next-enhancer="checkout-review">
  <p data-next-checkout-review="email" data-next-fallback="No email yet"></p>
  <p data-next-checkout-review="shipping-address"></p>
  <p data-next-checkout-review="phone" data-next-format="phone"></p>
</div>
\`\`\`

Field names match the \`data-next-checkout-field\` values on the form — see
[checkout-form](../../../../checkout/checkout-form/guide/reference/attributes.md). A name with
no matching field renders the fallback forever, which is the usual reason a review
row stays stuck on its placeholder.
`,
    },
  ],
});
