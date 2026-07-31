---
title: "Features/Checkout/Checkout Form/Relations"
group: "Features"
category: "Checkout Form"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `checkout-form` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- `cartStore` — the order is built from the cart; submitting with an empty one throws rather than being prevented.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`cart-summary`](../../../cart/cart-summary/guide/overview.md) — showing what is being bought beside the fields is what stops a visitor abandoning to go back and check.
- [`checkout-review`](../../../checkout/checkout-review/guide/overview.md) — plays the entered details back for confirmation without a second page step.
- [`express-checkout-container`](../../../checkout/express-checkout-container/guide/overview.md) — the usual layout offers the wallets above the form as a shortcut past it.
  - **Watch out:** They are two independent order paths. A visitor who starts the form and then uses a wallet button creates the order through the wallet, so anything the form collected and the wallet does not supply is lost.
