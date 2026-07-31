import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'express-checkout-container',
  category: 'checkout',
  status: 'optional',
  summary:
    'Renders the express payment buttons — PayPal, Apple Pay, Google Pay — for whichever of them the campaign and device support.',
  activates: '[data-next-express-checkout="container"]',
  logPrefix: 'ExpressCheckoutContainerEnhancer',

  attributes: [
    {
      name: 'data-next-express-checkout',
      type: 'string',
      required: true,
      description:
        'Marks the container and, on a child, the element buttons are injected into. You supply the container; the SDK supplies the buttons, because which ones are available depends on the campaign and on the visitor\'s device.',
      values: [
        { value: 'container', description: 'The outer element the feature activates on.' },
        { value: 'buttons', description: 'The child element buttons are rendered into.' },
      ],
      notes:
        'With no `"buttons"` child the feature logs `No buttons container found with data-next-express-checkout="buttons"` and renders nothing — the usual reason an express section stays empty.',
    },
  ],

  sets: [
    {
      name: 'data-next-express-checkout',
      description:
        'On each generated button: which method it is (`paypal`, `apple_pay`, `google_pay`). Style individual methods from this.',
      values: '`paypal`, `apple_pay`, `google_pay`',
    },
    {
      name: 'data-action',
      description: 'Set to `submit` on each generated button.',
      values: '`submit`',
    },
  ],

  emits: ['express-checkout:initialized'],

  errors: [
    {
      message:
        'ExpressCheckoutContainerEnhancer can only be used on container elements',
      kind: 'fatal',
      cause:
        '`data-next-express-checkout` is set to something other than `"container"` on the element that should hold the wallet buttons.',
      fix:
        'The container takes `data-next-express-checkout="container"`; the individual buttons take a method name. Nesting is required — the container will not render buttons that are not inside it:\n\n' +
        '```html\n' +
        '<div data-next-express-checkout="container">\n' +
        '  <div data-next-express-checkout="buttons"></div>\n' +
        '</div>\n' +
        '```',
    },
  ],

  requires: [
    {
      name: 'cartStore',
      because:
        'the wallet buttons create an order from the current cart, so an empty cart makes them fail rather than being hidden.',
    },
  ],
  pairsWith: [
    {
      feature: 'checkout-form',
      because:
        'the usual layout offers the wallets above the form as a shortcut past it.',
      caution:
        'They are two independent order paths. A visitor who starts the form and then uses a wallet button creates the order through the wallet, so anything the form collected and the wallet does not supply is lost.',
    },
  ],
  sections: [
    {
      title: 'Example',
      body: `
\`\`\`html
<div data-next-express-checkout="container">
  <p>Express checkout</p>
  <div data-next-express-checkout="buttons"></div>
</div>
\`\`\`

\`express-checkout:initialized\` fires **once per available method**, so a page
offering all three sees it three times. Use it to reveal the section only when at
least one button actually rendered — Apple Pay is absent on non-Apple devices, and
an empty "Express checkout" heading looks broken.

Completion and failure do **not** have express-specific events in this build:
listen for \`order:completed\` and \`payment:error\`, which cover express and
standard checkout alike. The \`express-checkout:completed\` / \`:failed\` names
exist on \`EventMap\` but are never emitted — they are marked deprecated there.
`,
    },
  ],
});
