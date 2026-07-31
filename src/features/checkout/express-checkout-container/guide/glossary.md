---
title: "Features/Checkout/Express Checkout Container/Glossary"
group: "Features"
category: "Express Checkout Container"
---

# Glossary

Domain terms used across the `express-checkout-container` guide.

## Available express payment methods

The wallets the **campaign** allows, delivered with the campaign data as
`available_express_payment_methods`. It is a permission list, not a promise: the
feature still checks each one against the visitor's device before rendering a
button, so a campaign that allows all three can still show none.

---

## Device availability

Whether the visitor's device and browser can actually complete a given wallet
payment. Apple Pay is absent outside Apple browsers, and Google Pay outside
Google's. This is checked per method at render time and is the reason a page cannot
know its own button set in advance.

---

## Express checkout

Buying through a payment provider's own sheet instead of filling in a checkout
form. The provider supplies contact, address, and payment together, so no fields are
needed on the page — and, because the provider decides what it hands back, an
express order carries only what the sheet collected. It is a separate order path
from
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md), not a shortcut
through it.

---

## Express payment method

One wallet: `paypal`, `apple_pay`, or `google_pay`. These are the spellings the
feature uses in `express-checkout:initialized` and on each generated button, so they
are also what you style and branch on.

---

## Method order

The order the buttons appear in. The SDK's payment configuration may set an explicit
order; when it does not, the buttons follow the order the campaign lists its methods
in. Methods the device cannot support are dropped from either order rather than
leaving a gap.
