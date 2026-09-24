---
title: "Features/Checkout/Address Form/Overview"
group: "Features"
category: "Address Form"
---

# Address Form

> Category: `checkout`
> Last reviewed: 2026-09-24
> Owner: checkout

An address form hard-coded as `address1 / city / state / zip` is correct in the United
States and wrong nearly everywhere else. Germany collects no state. Hong Kong collects no
postcode. Japan writes the largest unit first, so its postcode leads the form. This
feature builds the fields a country actually collects, in the order that country writes
them, from one empty container on the page.

## Concept

The country is the input and the shape of the form is the output.

A layout service answers, per country, which fields are collected and how they are
grouped into rows. This feature asks it for the country the checkout store currently
holds, builds the inputs, and rebuilds them whenever that country changes.

Every input it builds carries `data-next-checkout-field`. That is the whole integration:
`CheckoutFormEnhancer` scans the page for exactly that attribute, so a field built here is
indistinguishable from one a page author typed. Country and province dropdowns are built
**empty** and the checkout form fills them, the same way it fills hand-written ones.

```
checkout store country ──► GET /v1/layout/{country}
                                    │
                                    ▼
                      rows of field names + labels
                                    │
                                    ▼
        <input data-next-checkout-field="postal" autocomplete="shipping postal-code">
                                    │
                                    ▼
                   address:fields-rendered ──► checkout form re-scans
```

## Business logic

- The country comes from the checkout store. Before the form has resolved one, the block
  opens on `US` so the page is never empty while a layout is in flight.
- A field the surrounding form already collects elsewhere is not built again. The page's
  own markup wins, so a checkout that collects the name in its own step keeps it and the
  block builds only what is left.
- The city, state and postcode rows that come after the street address start hidden and
  appear once `address1` has a value (typed, autofilled or restored), the same collapse a
  hand-written form gets from `data-next-component="location"`. A row carrying any other
  field stays visible, and so does a location row written before the street address, as
  Japan's postcode is. Once shown the rows stay shown, including across a country change.
- A country change rebuilds the block. What the shopper typed into text inputs is read
  back and written into the new fields; a `select` is not carried across, because its
  options belonged to the country being left.
- A country with no rules of its own gets a generic layout under its own code, never an
  error. A visitor from an uncurated country still has to be able to check out.
- A failed lookup leaves whatever is on screen alone. Losing a half-typed address to a
  timed-out request is worse than an out-of-date layout. When nothing is on screen yet,
  the block builds a generic English layout instead, because a block with no fields
  leaves the shopper nowhere to type an address.
- `data-next-address="billing"` builds the same layout under `billing-` names. It is the
  alternative to the checkout form's own billing address, which copies the shipping
  fields into a `data-next-component="billing-form"` container. A page uses one or the
  other: with both, it gets two sets of `billing-*` fields.

## Decisions

- We build fields rather than re-order markup the page wrote, because a page cannot write
  markup for a field it does not know a country will ask for.
- We decide the field set and the order only, and leave the country list, the province
  options, the postcode rules and validation to the checkout form, because duplicating
  them would give one page two answers and no way to tell which is right.
- We set `autocomplete` with the `shipping` prefix on every input, because a page carrying
  both addresses otherwise has browsers autofill one form from the other's data.
- We rebuild rather than patch on a country change, because the set of fields differs, not
  just their values, and a patch has to reason about fields that no longer exist.
- We leave the block opt-in and additive, so a page that writes its own address fields
  keeps working unchanged.

## Limitations

- Does not collect a third address line. The orders API carries `address1` and `address2`
  and has nowhere to put a third, so a country that collects one has that field left out.
- Does not translate anything but the field labels, and only when
  `data-next-address-lang`, `window.nextConfig.locale` or the debug locale picker asks
  for it. The visitor's browser language is not followed.
- Does not validate. The checkout form owns which values are accepted.
- Does not fill the country or province dropdowns; it builds them empty.
