---
title: "Features/Checkout/Address Form/Relations"
group: "Features"
category: "Address Form"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `address-form` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — the fields it builds carry `data-next-checkout-field`, and the checkout form is what reads them into the order, fills the country and province dropdowns, and validates them. On a page with no checkout form the fields render and collect nothing.

## Conflicts

None known. Several instances of this feature can coexist on a page.
