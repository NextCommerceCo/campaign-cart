import { defineFeature } from '@/core/docs/feature-manifest';

export default defineFeature({
  id: 'prospect-cart',
  category: 'checkout',
  status: 'optional',
  summary:
    'Captures an abandoning visitor as a lead the moment they type an email or phone, before they finish paying.',
  // Started by checkout-form on the form element, and configured by attributes on
  // that same form — so the markup that turns it on is the checkout form itself.
  activates: 'form[data-next-checkout]',
  logPrefix: 'ProspectCartEnhancer',

  attributes: [
    {
      name: 'data-auto-create',
      type: "'true' | 'false'",
      required: false,
      default: 'true',
      description:
        'Whether a prospect is created automatically when the trigger fires. Set `false` to keep the feature loaded but create prospects only from your own code.',
      notes: 'Any value other than `"false"` counts as enabled.',
    },
    {
      name: 'data-trigger-on',
      type: 'string',
      required: false,
      default: 'emailEntry',
      description:
        'What counts as enough intent to record a prospect. This is the main trade-off in the feature: earlier triggers catch more leads, later ones record fewer accidental ones.',
      values: [
        { value: 'formStart', description: 'The visitor interacts with the form at all.' },
        { value: 'emailEntry', description: 'A valid email has been entered.' },
        { value: 'phoneEntry', description: 'A phone number long enough to be real has been entered.' },
        { value: 'emailAndPhone', description: 'Both are present — fewest, best-quality leads.' },
        { value: 'manual', description: 'Never automatic; you call it yourself.' },
      ],
      notes: 'An unrecognised value is ignored and the default stands.',
    },
    {
      name: 'data-email-field',
      type: 'string',
      required: false,
      default: 'email',
      description:
        'Which checkout field holds the email, when the form names it something other than `email`.',
    },
    {
      name: 'data-phone-field',
      type: 'string',
      required: false,
      default: 'phone',
      description: 'Which checkout field holds the phone number.',
    },
    {
      name: 'data-min-phone-digits',
      type: 'number',
      required: false,
      default: '7',
      description:
        'How many digits a phone number needs before it counts as entered. Guards against recording a prospect from a half-typed number.',
      notes:
        'A non-numeric or non-positive value logs a warning and the default is used.',
    },
    {
      name: 'data-prospect-config',
      type: 'JSON string',
      required: false,
      description:
        'All of the above at once, as JSON, plus the options that have no attribute of their own: `includeUtmData` (default `true`) and `sessionTimeout` in minutes (default `30`).\n\n```html\ndata-prospect-config=\'{"triggerOn":"emailAndPhone","sessionTimeout":60}\'\n```',
      notes:
        'The individual attributes override matching keys in this JSON. Malformed JSON logs a warning and is ignored entirely — including the parts that were valid.',
    },
  ],

  emits: [],

  dependsOn: [
    {
      feature: 'checkout-form',
      because:
        'it is not scanned from the DOM at all — the checkout form constructs it when the form carries `data-auto-create`. Without a `[data-next-checkout]` form it never runs.',
    },
  ],
  sections: [
    {
      title: 'How it is turned on',
      body: `
There is no attribute of its own: the checkout form starts this feature, and its
options go on the same \`<form>\`.

\`\`\`html
<form data-next-checkout
      data-trigger-on="emailEntry"
      data-min-phone-digits="9">
  <input data-next-checkout-field="email" type="email">
  <input data-next-checkout-field="phone" type="tel">
</form>
\`\`\`

The email and phone inputs are found through their
\`data-next-checkout-field\` names — see
[checkout-form](../../../../checkout/checkout-form/guide/reference/attributes.md). Legacy
\`os-checkout-field\` names and plain \`name="phone"\` / \`type="tel"\` inputs are
accepted as fallbacks, so existing forms usually work unchanged.
`,
    },
    {
      title: 'Cautions',
      body: `
- A prospect is recorded **before the visitor agrees to buy anything**. Whether
  that counts as consent to contact them depends on your jurisdiction and on what
  your form says — check before choosing an early trigger.
- \`formStart\` fires on any interaction, so it records visitors who typed one
  character and left. Prefer \`emailEntry\` unless you have a reason.
`,
    },
  ],
});
