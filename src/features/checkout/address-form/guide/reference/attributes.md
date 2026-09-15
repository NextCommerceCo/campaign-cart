---
title: "Features/Checkout/Address Form/Attributes"
group: "Features"
category: "Address Form"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Builds the address fields a country actually collects, in the order that country writes them, so one page works everywhere without a field set per market.

Turned on by `[data-next-address]`.

## `data-next-address`

| | |
|---|---|
| Type | `'shipping' \| 'billing'` |
| Required | yes |
| Default | — |

Turns an empty container into an address block and says which address it collects. The fields are built inside it, so whatever the element already held is replaced.

**Valid values:**

- `shipping` — Builds the shipping address fields.
- `billing` — Builds the billing address fields, named `billing-address1`, `billing-city` and so on.

> **Watch out:** The element must be empty. Fields already written inside it are replaced on the first render, not merged with.

---

## `data-next-address-lang`

| | |
|---|---|
| Type | `string (language tag)` |
| Required | no |
| Default | `en` |

Which language the field labels come back in. Accepts `da de en es fi fr it nl no pt sv th`, with or without a region (`th-TH` works).

> **Watch out:** Labels only. It does not translate the rest of the page, and it does not change which fields a country collects.

---

## `data-next-address-api`

| | |
|---|---|
| Type | `string (URL)` |
| Required | no |
| Default | — |

Where the layouts are fetched from. Set it to point a page at your own deployment; leave it off for the default.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-next-address-row` | the row index, `0` upward | Goes on each row of the built block, numbered from zero in layout order. Style the rows through it: how many there are and what they hold differs per country, so a stylesheet cannot name them individually. |
| `data-next-address-state` | `loading`, `ready`, `failed` | Goes on the block itself and says where it is. Hold space for the fields while they are on their way by keying off `loading`, and it is released when they arrive or when they are not coming. **Watch out:** Reserving space on `:empty` instead leaves a gap forever on a page whose layout request failed. |
| `data-next-address-field` | a checkout field name — `address1`, `city`, `province`, `postal`, … | Goes on the wrapper around one built field, carrying that field’s checkout-field name. This is how a stylesheet reaches a field that only some countries have. **Watch out:** It is on the wrapper, not on the input. The input next to it carries `data-next-checkout-field` with the same value. |

## Example

Below is an example that puts a country-driven shipping address inside an ordinary
checkout form. The container is empty: everything inside it at runtime was built from
the country's layout.

```html
<form data-next-checkout>
  <input data-next-checkout-field="email" type="email" />
  <div data-next-address="shipping"></div>
  <button type="submit">Pay</button>
</form>
```

The fields differ per country, and that is the point. Japan leads with the postcode and
puts the prefecture beside it; Germany collects no state at all; the United States puts
city, state and ZIP on one row. A page that hard-codes `address1 / city / state / zip`
is wrong in most of the world.

A billing block is `data-next-address="billing"`, and its fields are named
`billing-…`. Do not leave an `os-checkout-component="billing-form"` container on the
same page: that is the checkout form's own clone-from-shipping mount, and with both
present the page gets two sets of `billing-*` fields.

## A field the page already collects

A country's layout describes a whole address form, the name and phone included. A page
that collects those in a step of its own keeps them: **a field already carried by a
`data-next-checkout-field` elsewhere in the same form is not built again.** Two elements
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
carries `address1` and `address2` and has nowhere to put a third.
