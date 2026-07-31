---
title: "Features/Checkout/Checkout Review/Glossary"
group: "Features"
category: "Checkout Review"
---

# Glossary

Domain terms used across the `checkout-review` guide.

## Checkout field name

The name a checkout input is given with `data-next-checkout-field` — `email`,
`fname`, `postal`, and the rest. A review slot names the same value, so there is one
vocabulary for both and a slot can be matched to its input by reading the markup.
The full set lives with the form that owns it:
[checkout-form attributes](../../../checkout/checkout-form/guide/reference/attributes.md).

---

## Review slot

One element inside the review block, marked with `data-next-checkout-review`, whose
text is replaced with the current value of the field it names. A slot is display
only: it never writes back to the form or the order.

---

## Shipping method

The delivery option the visitor chose — its name and price, not an address. It is
not a form field, so a slot reaches it by path: `shippingMethod.name`. The other
two values reachable this way are `billingAddress` (the separate billing address,
when the visitor said theirs differs) and `paymentMethod` (which way they chose to
pay).
