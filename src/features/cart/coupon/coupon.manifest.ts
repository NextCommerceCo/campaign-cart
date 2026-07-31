import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'coupon',
  category: 'cart',
  status: 'core',
  summary:
    'Lets the visitor enter a discount code, shows the codes already applied, and lets them take one off again.',
  activates: '[data-next-coupon=""]',
  logPrefix: 'CouponEnhancer',

  attributes: [
    {
      name: 'data-next-coupon',
      type: 'string',
      required: true,
      description:
        'Marks the coupon area. The feature activates on the container and finds the input, button, and display area inside it.',
      values: [
        {
          value: '(empty)',
          description:
            'On the container element that wraps the whole coupon area.',
        },
        {
          value: 'input',
          description:
            'On the text input the visitor types the code into. Also activates the feature when used on its own.',
        },
        {
          value: 'apply',
          description:
            'On the apply button. Optional — the first `<button>` in the container is used when this is absent.',
        },
        {
          value: 'display',
          description:
            'On the element that lists applied codes. Searched inside the container, then in its parent, then document-wide.',
        },
        {
          value: 'messages',
          description:
            'On the element that shows success and error text. Searched document-wide.',
        },
      ],
      notes:
        'When the input, button, and display cannot all be found the feature logs `Required coupon elements not found` and does nothing — check that the markup below is present.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-template',
      description:
        'Marks the coupon card that serves as the row template. The feature hides it, clones it once per applied code, and strips this attribute from the clones — so the template itself never shows.',
      notes:
        'Do not set this on a card you want visible; a card carrying it is treated as the hidden template.',
    },
  ],

  classes: [
    {
      name: 'next-disabled',
      description:
        'On the apply button while a code is being validated, so the visitor cannot submit twice.',
    },
    {
      name: 'coupon-message',
      description:
        'On each message element the feature creates. Messages remove themselves after 5 seconds.',
    },
    {
      name: 'coupon-message--success / --error / --info',
      description:
        'Variant class matching the message kind — a code accepted, a code rejected, or a code removed.',
    },
  ],

  emits: ['coupon:applied', 'coupon:removed', 'coupon:validation-failed'],

  requires: [
    {
      name: 'cartStore',
      because:
        'a coupon applies to a cart, so the field reads and writes cart state. With an empty cart the API rejects the code.',
    },
  ],
  pairsWith: [
    {
      feature: 'cart-summary',
      because:
        'the summary is where an applied discount becomes visible — without it the visitor gets no confirmation the code worked.',
    },
  ],
  sections: [
    {
      title: 'Expected markup',
      body: `
The feature locates its parts by looking inside the container, so the structure
matters more than the individual class names:

\`\`\`html
<div data-next-coupon="">
  <input type="text" data-next-coupon="input" placeholder="Discount code">
  <button data-next-coupon="apply">Apply</button>

  <!-- Applied codes are rendered here, one clone of the template per code -->
  <div data-next-coupon="display">
    <div pb-checkout="coupon-card" data-template>
      <span pb-checkout="coupon-title"></span>
      <button pb-checkout="coupon-remove">Remove</button>
    </div>
  </div>
</div>

<!-- Can live anywhere in the page -->
<div data-next-coupon="messages"></div>
\`\`\`

Inside a coupon card the feature fills \`[pb-checkout="coupon-title"]\` with the
code and wires \`[pb-checkout="coupon-remove"]\` to remove it. Pressing Enter in
the input applies the code, the same as clicking the button.
`,
    },
  ],
});
