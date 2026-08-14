---
title: "Features/Checkout/Checkout Form/Glossary"
group: "Features"
category: "Checkout Form"
---

# Glossary

Domain terms used across the `checkout-form` guide.

## Billing location group

The country, state, and postcode inputs for the **billing** address. You never
write it: the feature clones the shipping
[location group](#location-group) and stamps the copy
`data-next-component="billing-location"`, so the two can never fall out of step.

---

## Checkout field name

The value of `data-next-checkout-field` — `email`, `fname`, `postal`, and the rest.
It is what maps an input to a place on the order, so the names are a fixed
vocabulary rather than free text. An unrecognised name is not part of the order and
reads as empty however much the visitor typed into it. The full set is in
[reference/attributes.md](./reference/attributes.md).

---

## Express checkout

Buying through a payment provider's own sheet — PayPal, Apple Pay, Google Pay —
instead of filling in the form. It is a **separate order path**: the provider
supplies the contact and address details, so anything the form collected that the
provider does not supply is not on the order. Rendered by
[`express-checkout-container`](../../../checkout/express-checkout-container/guide/overview.md).

---

## Hosted payment fields

The card number and CVV inputs. They are inserted by the SDK and belong to the
payment provider, not to your page, so a raw card number never passes through your
markup, your handlers, or SDK code. This is what keeps a campaign page out of scope
for handling card data. Their readiness is announced by `checkout:spreedly-ready`.

---

## Location group

The country, state, and postcode inputs kept together inside
`data-next-component="location"`. They are revealed as one unit once a country is
known, because the state list and the postcode format both depend on the country.
Splitting them across separate containers breaks that reveal.

---

## Multi-step checkout

A checkout spread over more than one page, each page carrying its own form marked
with `data-next-checkout-step`. On a step form, submitting validates that step and
navigates; the order is created only on the final, unmarked form.

---

## Payment token

The stand-in the payment provider returns for a card. It is what the order is
created with — the card details themselves never reach the order call. Produced by
[tokenization](#tokenization) and announced by `payment:tokenized`.

---

## Redirect method

A way of paying that is approved on the provider's own page rather than on the
checkout — iDEAL, Bancontact, SEPA Direct Debit, TWINT, Swish, Affirm, Link and
Klarna. The form collects the shopper's details and creates the order
as usual, and the API answers with the address to send them to; the order exists
before any money moves. Unlike [express checkout](#express-checkout) there is no
provider sheet and no button — the shopper picks a radio like any other method,
which is why their contact and address details are captured first.

---

## Prospect cart

A record of an abandoning visitor as a lead, created from their email or phone
before any order exists. Started by this form, and configured by attributes on it.
See
[`prospect-cart`](../../../checkout/prospect-cart/guide/overview.md).

---

## `ref_id`

The order's reference from the API. It is what the post-order redirect is built
from, so a success response without one leaves the visitor stranded even though the
order may exist. Treat `Invalid order response: missing ref_id` as "check the API
before telling the visitor it failed" — see
[reference/errors.md](./reference/errors.md).

---

## Spreedly

The payment service that supplies the
[hosted payment fields](#hosted-payment-fields) and performs
[tokenization](#tokenization). It appears in this guide mainly as the name in
`checkout:spreedly-ready`, the event that says the card fields will accept input.

---

## Tokenization

Exchanging the card details the visitor typed into the
[hosted payment fields](#hosted-payment-fields) for a
[payment token](#payment-token). It happens after validation passes and before the
order is created; a card submit that reaches the order call without it fails with
`Payment token is required for credit card payments`.
