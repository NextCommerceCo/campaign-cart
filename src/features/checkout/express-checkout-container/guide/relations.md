---
title: "Features/Checkout/Express Checkout Container/Relations"
group: "Features"
category: "Express Checkout Container"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `express-checkout-container` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- `cartStore` — the wallet buttons create an order from the current cart, so an empty cart makes them fail rather than being hidden.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — the usual layout offers the wallets above the form as a shortcut past it.
  - **Watch out:** They are two independent order paths. A visitor who starts the form and then uses a wallet button creates the order through the wallet, so anything the form collected and the wallet does not supply is lost.
