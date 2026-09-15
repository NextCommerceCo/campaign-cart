import { defineFeature } from '@/docs/schema/feature-manifest';

export default defineFeature({
  id: 'address-form',
  category: 'checkout',
  status: 'optional',
  summary:
    'Builds the address fields a country actually collects, in the order that country writes them, so one page works everywhere without a field set per market.',
  activates: '[data-next-address]',
  logPrefix: 'AddressFormEnhancer',

  attributes: [
    {
      name: 'data-next-address',
      type: "'shipping' | 'billing'",
      required: true,
      description:
        'Turns an empty container into an address block and says which address it collects. The fields are built inside it, so whatever the element already held is replaced.',
      values: [
        {
          value: 'shipping',
          description: 'Builds the shipping address fields.',
        },
        {
          value: 'billing',
          description:
            'Builds the billing address fields, named `billing-address1`, `billing-city` and so on.',
        },
      ],
      notes:
        'The element must be empty. Fields already written inside it are replaced on the first render, not merged with.',
    },
    {
      name: 'data-next-address-lang',
      type: 'string (language tag)',
      required: false,
      default: 'en',
      description:
        'Which language the field labels come back in. Accepts `da de en es fi fr it nl no pt sv th`, with or without a region (`th-TH` works).',
      notes:
        'Labels only. It does not translate the rest of the page, and it does not change which fields a country collects.',
    },
    {
      name: 'data-next-address-api',
      type: 'string (URL)',
      required: false,
      description:
        'Where the layouts are fetched from. Set it to point a page at your own deployment; leave it off for the default.',
    },
  ],

  sets: [
    {
      name: 'data-next-address-row',
      description:
        'Goes on each row of the built block, numbered from zero in layout order. Style the rows through it: how many there are and what they hold differs per country, so a stylesheet cannot name them individually.',
      values: 'the row index, `0` upward',
    },
    {
      name: 'data-next-address-field',
      description:
        'Goes on the wrapper around one built field, carrying that field’s checkout-field name. This is how a stylesheet reaches a field that only some countries have.',
      values: 'a checkout field name — `address1`, `city`, `province`, `postal`, …',
      notes:
        'It is on the wrapper, not on the input. The input next to it carries `data-next-checkout-field` with the same value.',
    },
  ],

  emits: ['address:fields-rendered'],

  errors: [
    {
      message: 'Address layout for {countryCode} responded {status} {statusText}',
      kind: 'recoverable',
      cause:
        'The layout service answered with a non-OK status — an unreachable host, a blocked request, or the service briefly unavailable. An unknown country code is not a cause: an uncurated country is answered with a generic layout rather than an error.',
      fix: 'Nothing to change in the markup. The block keeps whatever it had rendered, so a visitor part-way through an address does not lose it, and a page that has not rendered yet stays empty — check the host in `data-next-address-api` if one is set.',
    },
    {
      message: 'Address layout for {countryCode} carried no layout',
      kind: 'recoverable',
      cause:
        'The service answered, but the body had no `spec.layout`. A proxy or a captive portal returning an HTML page in place of the JSON is the realistic cause.',
      fix: 'Open the layout URL directly and confirm it returns JSON with a `spec.layout` array. If `data-next-address-api` points at your own deployment, it is answering the route with something else.',
    },
  ],

  dependsOn: [
    {
      feature: 'checkout-form',
      because:
        'the fields it builds carry `data-next-checkout-field`, and the checkout form is what reads them into the order, fills the country and province dropdowns, and validates them. On a page with no checkout form the fields render and collect nothing.',
    },
  ],

  sections: [
    {
      title: 'Example',
      body: `
Below is an example that puts a country-driven shipping address inside an ordinary
checkout form. The container is empty: everything inside it at runtime was built from
the country's layout.

\`\`\`html
<form data-next-checkout>
  <input data-next-checkout-field="email" type="email" />
  <div data-next-address="shipping"></div>
  <button type="submit">Pay</button>
</form>
\`\`\`

The fields differ per country, and that is the point. Japan leads with the postcode and
puts the prefecture beside it; Germany collects no state at all; the United States puts
city, state and ZIP on one row. A page that hard-codes \`address1 / city / state / zip\`
is wrong in most of the world.

A billing block is \`data-next-address="billing"\`, and its fields are named
\`billing-…\`. Do not leave an \`os-checkout-component="billing-form"\` container on the
same page: that is the checkout form's own clone-from-shipping mount, and with both
present the page gets two sets of \`billing-*\` fields.

## A field the page already collects

A country's layout describes a whole address form, the name and phone included. A page
that collects those in a step of its own keeps them: **a field already carried by a
\`data-next-checkout-field\` elsewhere in the same form is not built again.** Two elements
under one field name would leave the order assembled from whichever the form scanned last,
which is to say from neither reliably.

So a checkout with its own Customer Information step needs no configuration — the block
builds the address and leaves the name and phone where they are, and the row they would
have occupied is dropped rather than left empty.

## What it does not do

It decides **which fields and in what order**, and nothing else. The country list, the
province options, the postcode rules, the validation messages and the order payload all
still come from [checkout-form](../../../checkout-form/guide/overview.md), exactly as they do
for hand-written fields. That is why the two styles can sit on the same site.

A country that collects a third address line has that line left out: the orders API
carries \`address1\` and \`address2\` and has nowhere to put a third.
`,
    },
  ],
});
