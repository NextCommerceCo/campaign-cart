import { defineFeature } from '@/docs/schema/feature-manifest';

const FORM = 'On the form element';
const FIELDS = 'Fields';
const PAYMENT = 'Payment';
const STRUCTURE = 'Structural components';

export default defineFeature({
  id: 'checkout-form',
  category: 'checkout',
  status: 'core',
  summary:
    'Turns a plain HTML form into a working checkout: validates it, tokenizes the card, creates the order, and sends the visitor onward.',
  activates: 'form[data-next-checkout]',
  logPrefix: 'CheckoutFormEnhancer',
  // The form delegates to the shared checkout helpers; its attribute contract and its
  // errors are spread across them rather than living in one file — `ui-service` reads
  // `data-next-payment-method`, `order-manager` and `credit-card-service` throw four of
  // the documented errors.
  //
  // `src/`-relative because these are *shared* with the other checkout features and so
  // stay at the category level, one folder up. They were bare names (`'services'`) while
  // this manifest sat beside them at `features/checkout/`; once the manifest moved into
  // its own feature folder those resolved to `checkout-form/services`, which does not
  // exist, and the attribute and error checks silently lost sight of the code.
  extraSource: [
    'src/features/checkout/services',
    'src/features/checkout/managers',
    'src/features/checkout/processors',
    'src/features/checkout/validation',
  ],

  attributes: [
    {
      group: FORM,
      name: 'data-next-checkout',
      type: 'boolean (presence)',
      required: true,
      description:
        'Marks the `<form>` as the checkout. Must be on a real `<form>` element — the feature is registered against `form[data-next-checkout]`, so a `<div>` carrying it is never activated.',
    },
    {
      group: FORM,
      name: 'data-next-checkout-step',
      type: 'string (URL)',
      required: false,
      description:
        'Makes this form one step of a multi-step checkout: validation and submission apply to this step rather than the whole order, and **the value is the URL to navigate to** once the step validates.',
      notes:
        'It is a URL, not a step name. `data-next-checkout-step="shipping"` sends the visitor to `/shipping` relative to the current page — usually a 404 — rather than to the next step. Use the real path, e.g. `/checkout/payment`.',
    },
    {
      group: FORM,
      name: 'data-next-step-number',
      type: 'number',
      required: false,
      default: '1',
      description:
        'Which step this form is, when `data-next-checkout-step` is set. The number decides what pressing "next" checks: step 1 the contact details and the shipping address, step 2 that same address again in case it was cleared behind them, step 3 everything — the full form check, the card fields, and the separate billing address when the visitor asked for one. Any other number checks nothing.',
      notes:
        'On step 3, choosing "use a different billing address" and leaving it blank fails validation with `Billing first name is required` and one message per missing billing field. It used to be skipped on this path, and the order reached the gateway to be declined by Address Verification instead. Keep the billing reveal container on the step-3 page, or those messages have nowhere to render.',
    },

    {
      group: FIELDS,
      name: 'data-next-checkout-field',
      type: 'string (field name)',
      required: true,
      description:
        'Marks an input as a checkout field and names it. The name is what maps the input to the order — see **Field names** below for the set.',
      notes:
        'The legacy `os-checkout-field` attribute is still read, so existing forms keep working. Use `data-next-checkout-field` in new markup.',
    },
    {
      group: FIELDS,
      name: 'data-next-required',
      type: "'true'",
      required: false,
      description:
        'Forces validation on a field that is optional by default. Phone is the usual case: mark it required when your fulfilment needs it.',
    },
    {
      group: FIELDS,
      name: 'data-next-checkout-submit',
      type: 'boolean (presence)',
      required: false,
      description:
        'Marks the submit control. Without it the form falls back to its own submit event, so a `<button type="submit">` still works.',
    },

    {
      group: PAYMENT,
      name: 'data-next-checkout-payment',
      type: 'string (method)',
      required: false,
      description:
        'Marks a payment method choice — a radio or a button — and names the method it selects.',
      values: [
        { value: 'credit', description: 'Card, entered in the hosted card fields.' },
        { value: 'paypal', description: 'PayPal.' },
        { value: 'apple-pay', description: 'Apple Pay.' },
        { value: 'google-pay', description: 'Google Pay.' },
        { value: 'klarna', description: 'Klarna.' },
      ],
      notes:
        'These are the markup spellings; the API names differ (`credit` becomes `card_token`). Use the values above in HTML and let the SDK translate.',
    },

    {
      group: STRUCTURE,
      name: 'data-next-component',
      type: 'string',
      required: false,
      description:
        'Names a structural part of the form so the feature can show, hide, clone, or write into it. These are containers, not inputs.',
      values: [
        { value: 'shipping-form', description: 'Wrapper for the shipping address fields.' },
        { value: 'billing-form', description: 'Wrapper for the billing address fields.' },
        {
          value: 'different-billing-address',
          description: 'The container revealed when the visitor says billing differs from shipping.',
        },
        {
          value: 'location',
          description:
            'The country/state/postcode group. Revealed together once a country is known, and cloned to build the billing equivalent.',
        },
        { value: 'billing-location', description: 'Set by the feature on the cloned billing location group.' },
        { value: 'shipping-field-row', description: 'One row of shipping fields, for row-level show and hide.' },
        { value: 'credit-error', description: 'Container for card errors.' },
        { value: 'credit-error-text', description: 'Element the card error message is written into.' },
        { value: 'paypal-error', description: 'Container for PayPal errors.' },
      ],
    },
    {
      group: STRUCTURE,
      name: 'data-next-component-location',
      type: 'string',
      required: false,
      description:
        'Alternative marker for the location group, accepted alongside `data-next-component="location"`.',
    },
  ],

  readsElsewhere: [
    {
      name: 'data-next-payment-method',
      description:
        'Wraps one payment choice inside the form, and names the method it offers. The feature looks for a radio input and a `[data-next-payment-form]` **inside** this wrapper, so a payment form that is not nested in one is never revealed or collapsed.',
      values: '`credit` / `paypal` / `apple-pay` / `google-pay` / `klarna`',
      notes:
        'These markup spellings differ from the names the store and the API use (`credit` maps to `credit-card` and `card_token`). Use the values above in HTML and let the SDK translate.',
    },
    {
      name: 'data-next-payment-form',
      description:
        "Marks the fields belonging to a payment method, inside that method's container. The form is revealed when the method is chosen and collapsed when another is — so card fields are not in the tab order while PayPal is selected.",
    },
  ],

  sets: [
    {
      name: 'data-next-payment-state',
      description:
        'On a payment form: whether it is currently shown. Animate the reveal from this rather than from the element appearing.',
      values: '`expanded` / `collapsed`',
    },
  ],

  classes: [
    {
      name: 'next-error',
      description:
        "On a field's error message element when validation fails, alongside `next-error-field` on the input itself.",
    },
    {
      name: 'next-error-field',
      description: 'On an input that failed validation.',
    },
  ],

  emits: [
    'checkout:form-initialized',
    'checkout:spreedly-ready',
    'checkout:location-fields-shown',
    'checkout:billing-location-fields-shown',
    'checkout:started',
    'payment:tokenized',
    'payment:error',
    'order:completed',
    'order:redirect-missing',
  ],

  errors: [
    {
      message: 'CheckoutFormEnhancer must be applied to a form element',
      kind: 'fatal',
      cause:
        '`data-next-checkout` is on something other than a `<form>` — usually a `<div>` wrapping one.',
      fix:
        'Move the attribute onto the `<form>` itself. The enhancer submits the form and reads its fields, neither of which works from a wrapper.\n\n' +
        '```html\n' +
        '<!-- wrong -->\n' +
        '<div data-next-checkout><form>…</form></div>\n\n' +
        '<!-- right -->\n' +
        '<form data-next-checkout>…</form>\n' +
        '```',
    },
    {
      message: 'Missing required customer information',
      kind: 'recoverable',
      cause:
        'Submit was reached with email, first name, or last name still empty.',
      fix:
        'Normally validation stops the submit before this, so seeing it means a field is not wired: check each of `data-next-checkout-field="email"`, `"fname"`, and `"lname"` exists and is spelled exactly that way. A misspelled field name reads as empty no matter what the visitor typed.',
    },
    {
      message: 'Cannot create order with empty cart',
      kind: 'recoverable',
      cause: 'Submit was reached with nothing in the cart.',
      fix:
        'Guard the submit button on cart contents — `data-next-show="cart.hasItems"` — so the visitor cannot reach a checkout with nothing to buy. This also fires if the cart was cleared in another tab, since the cart is per-session.',
    },
    {
      message: 'Payment token is required for credit card payments',
      kind: 'recoverable',
      cause:
        'The payment method is a card, but tokenisation has not produced a token yet.',
      fix:
        'Wait for `payment:tokenized` before allowing submit. Submitting while the card fields are still being tokenised reaches this — most often on a fast double-click of the pay button.',
    },
    {
      message: 'Payment token is required',
      kind: 'recoverable',
      cause:
        'The same condition on the express-checkout path, where the wallet did not return a token.',
      fix:
        'Check the express payment method completed rather than being dismissed. A visitor closing the Apple Pay or Google Pay sheet cancels tokenisation, and the click should be treated as abandoned rather than retried.',
    },
    {
      message: 'Cannot create express order with empty cart',
      kind: 'recoverable',
      cause: 'An express-checkout button was used with nothing in the cart.',
      fix:
        'Hide the express buttons until the cart has items. They sit outside the form, so form validation does not cover them.',
    },
    {
      message: 'Credit card service is not ready',
      kind: 'recoverable',
      cause:
        'Card tokenisation was asked for before the payment iframe finished loading.',
      fix:
        'Wait for `checkout:spreedly-ready` before enabling the pay button. On a slow connection the form is interactive well before the payment fields are.',
    },
    {
      message:
        'Credit card payment system is not ready. Please refresh the page and try again.',
      kind: 'recoverable',
      cause:
        'The same condition at submit time, phrased for the visitor rather than the console.',
      fix:
        'This message is shown in the UI, so treat it as visitor-facing: if it appears often, the payment iframe is loading too slowly and the pay button is being enabled too early.',
    },
    {
      message: 'Credit card data is incomplete',
      kind: 'recoverable',
      cause: 'Tokenisation was attempted with a card field still blank.',
      fix:
        'The payment iframe owns those fields, so this is the visitor missing one — surface it next to the card inputs rather than as a general error.',
    },
    {
      message: 'Invalid order response: missing ref_id',
      kind: 'fatal',
      cause:
        'The order API returned success but no `ref_id`, so there is nothing to redirect to.',
      fix:
        'The order may well have been created — check the API before telling the visitor it failed, or they may be charged for an order the page abandoned. If it reproduces, it is a backend contract problem, not a markup one.',
    },
    {
      message: 'Too many requests. Please wait a moment and try again.',
      kind: 'recoverable',
      cause: 'The order API replied 429.',
      fix:
        'Wait and retry. Repeated bursts usually mean the pay button is not disabled while a submit is in flight, letting one visitor send several orders.',
      fromApi: true,
    },
    {
      message: 'Authentication error. Please refresh the page and try again.',
      kind: 'recoverable',
      cause: 'The order API replied 401 or 403 — the session is no longer valid.',
      fix:
        'A refresh gets a new session. Seen early in a checkout, check the API key in `<meta name="next-api-key">` is the live one for this campaign.',
      fromApi: true,
    },
    {
      message: 'Invalid order data. Please check your information and try again.',
      kind: 'recoverable',
      cause: 'The order API rejected the payload — a 422.',
      fix:
        'Read the response body: it names the field. Recurring cases are usually a country/state pair the campaign does not ship to, or a phone number that is not in E.164 form.',
      fromApi: true,
    },
    {
      message: 'Server error. Please try again in a few moments.',
      kind: 'recoverable',
      cause: 'The order API replied 5xx.',
      fix:
        'Retry. As with a missing `ref_id`, confirm the order was not created before letting the visitor submit again.',
      fromApi: true,
    },
  ],

  requires: [
    {
      name: 'cartStore',
      because:
        'the order is built from the cart; submitting with an empty one throws rather than being prevented.',
    },
  ],
  pairsWith: [
    {
      feature: 'cart-summary',
      because:
        'showing what is being bought beside the fields is what stops a visitor abandoning to go back and check.',
    },
    {
      feature: 'checkout-review',
      because:
        'plays the entered details back for confirmation without a second page step.',
    },
  ],
  sections: [
    {
      title: 'Field names',
      body: `
The value of \`data-next-checkout-field\` is what maps an input to the order, so
these names are fixed rather than free text:

| Name | Holds |
|---|---|
| \`email\` | Contact email |
| \`fname\` | First name |
| \`lname\` | Last name |
| \`phone\` | Phone number |
| \`address1\` | Street address |
| \`address2\` | Apartment, suite, unit |
| \`city\` | City |
| \`province\` | State, province, or region |
| \`postal\` | Postcode or ZIP |
| \`country\` | Country |
| \`payment-method\` | The chosen payment method |
| \`exp-month\` / \`cc-month\` | Card expiry month |
| \`exp-year\` / \`cc-year\` | Card expiry year |

Billing equivalents use the same names inside the billing container; the feature
maps them to the order's billing address itself.

The card number and CVV are **not** in this list. They live in hosted payment
fields that the SDK inserts, so no card number ever passes through your markup or
SDK code — only the token from \`payment:tokenized\` does.

\`\`\`html
<form data-next-checkout>
  <input data-next-checkout-field="email" type="email">
  <input data-next-checkout-field="fname">
  <input data-next-checkout-field="lname">
  <input data-next-checkout-field="phone" type="tel" data-next-required="true">

  <div data-next-component="shipping-form">
    <input data-next-checkout-field="address1">
    <div data-next-component="location">
      <select data-next-checkout-field="country"></select>
      <select data-next-checkout-field="province"></select>
      <input data-next-checkout-field="postal">
    </div>
  </div>

  <label><input type="radio" data-next-checkout-payment="credit"> Card</label>
  <label><input type="radio" data-next-checkout-payment="paypal"> PayPal</label>

  <button data-next-checkout-submit>Complete order</button>
</form>
\`\`\`
`,
    },
    {
      title: 'What fires when',
      body: `
The order of events is the fastest way to see where a checkout stopped:

1. \`checkout:form-initialized\` — fields, validation, and payment are wired up
2. \`checkout:spreedly-ready\` — the hosted card fields will accept input
3. \`checkout:location-fields-shown\` — the country group was revealed (also a DOM \`CustomEvent\`)
4. \`checkout:started\` — the visitor submitted; **the order does not exist yet**
5. \`payment:tokenized\` — the card became a token
6. \`order:completed\` — the order exists. This is where purchase tracking belongs
7. \`order:redirect-missing\` — the order succeeded but carried no redirect URL, so
   the visitor is stranded on the checkout page unless you handle it

\`payment:error\` can fire instead of 5 or 6, for card-field problems and for a
declined order alike.

**Do not track purchases on \`checkout:started\`** — it fires before the payment
call, so failed attempts would count as revenue.
`,
    },
    {
      title: 'Cautions',
      body: `
- **Must be a \`<form>\`.** The activating selector is \`form[data-next-checkout]\`;
  a \`<div>\` with the attribute is silently never enhanced.
- **The location group is revealed as a unit.** Country, province, and postcode
  live inside \`data-next-component="location"\` and appear together once a country
  is known. Splitting them across containers breaks that reveal.
- **The billing location group is cloned from the shipping one** and stamped
  \`data-next-component="billing-location"\`. Do not hand-write a billing location
  group as well, or there will be two.
- **Legacy \`os-checkout-*\` attributes still work** and are read as fallbacks. They
  are not deprecated in code, but prefer \`data-next-*\` so one form does not mix
  both conventions.
`,
    },
  ],
});
