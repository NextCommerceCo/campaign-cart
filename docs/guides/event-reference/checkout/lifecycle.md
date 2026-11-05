---
title: 'Checkout lifecycle'
group: 'Event Reference/Checkout'
---

# Checkout lifecycle

Events: `checkout.*`, `user.*`, `address.*` and `payment.selected`, with the order's
`order.created` and `order.paid` and the gateway's `payment.redirected` and `payment.failed`.

![Checkout lifecycle: waiting, filling, submitting, placing, at the gateway and paid, with the events each step sends](checkout-lifecycle.svg)

| State            | Means                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `waiting`        | A checkout page has bound its form, and waits until the cart has lines                                 |
| `filling`        | The shopper fills in the form, and fixes what a submit pointed out                                     |
| `submitting`     | The SDK checks the form, that the cart has lines, and the card; the cart is frozen and refuses changes |
| `placing`        | The order is being sent; the cart stays frozen                                                         |
| `at the gateway` | The order has a `payment_complete_url`, and the shopper pays there; see the payment lifecycle          |
| `paid`           | The order is paid; the checkout has ended                                                              |

| From             | What happens                                                                                                      | To                                 | Events, in order                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| none             | A checkout page binds its form                                                                                    | `waiting`                          | none                                                                                                                                                  |
| `waiting`        | The cart has lines, at once or when the first lines arrive                                                        | `filling`                          | `checkout.started`, once per checkout: a step, a reload or a return from the gateway sends nothing; when lines arrive, after that change's own events |
| `filling`        | The shopper fills in the form                                                                                     | `filling`                          | in any order: `user.created`, `user.updated`, `address.autofilled`, `address.entered`, `address.updated`, `payment.selected`                          |
| `filling`        | On a step of a multi-step form (`data-next-checkout-step`), a submit passes the step's checks                     | `filling`, on the next step's page | `checkout.continued`                                                                                                                                  |
| `filling`        | A step's submit does not pass its checks                                                                          | `filling`                          | `checkout.invalid` (with the `errors`)                                                                                                                |
| `filling`        | The shopper submits, or uses an express button                                                                    | `submitting`                       | none                                                                                                                                                  |
| `submitting`     | A check fails: a field, an empty cart, or the card                                                                | `filling`                          | `checkout.invalid` (with the `errors`)                                                                                                                |
| `submitting`     | The checks pass and the card is tokenized                                                                         | `placing`                          | `checkout.submitted`                                                                                                                                  |
| `placing`        | The order is not created: refused, or the request fails                                                           | `filling`                          | `sdk.error` (`order.create`), `checkout.failed` (with `error`)                                                                                        |
| `placing`        | The card is declined                                                                                              | `filling`                          | `payment.failed` (`code: 'declined'`)                                                                                                                 |
| `placing`        | The order is created without a `payment_complete_url`: it is paid, and the shopper is redirected to the next page | `paid`                             | `order.created` (`paid: true`), `order.paid`, `checkout.completed`                                                                                    |
| `placing`        | The order is created with a `payment_complete_url`: the shopper is redirected there to pay                        | `at the gateway`                   | `order.created` (`paid: false`), `payment.redirected`                                                                                                 |
| `at the gateway` | Paid; the gateway redirects the shopper to the next page, which loads the order                                   | `paid`                             | `order.loaded`, `order.paid`, `checkout.completed`                                                                                                    |
| `at the gateway` | Not paid; the gateway redirects the shopper back to the checkout                                                  | `filling`                          | `payment.failed`                                                                                                                                      |
| `at the gateway` | The shopper comes back without paying, such as with the browser's Back button                                     | `filling`                          | none                                                                                                                                                  |

`checkout.started` comes once per checkout, and the Checkout's `id` names it: its steps, reloads and
a return from a gateway keep the same checkout. A paid order ends it, and the next checkout gets a
new `id`. The 0.4.x `checkout:started` still comes on each checkout page.

An express button (Apple Pay, Google Pay, PayPal, … in `data-next-express-checkout`) pays with the
wallet's details: the form is not checked, only that the cart has lines, unless the 0.4.x
`nextConfig.paymentConfig.expressCheckout.requireValidation` asks for its fields. PayPal or Klarna
picked as the payment method in the form gets the full checks, like a card.

The next page is `next-success-url`, with the order's `ref_id`. Without it, an order paid at once
goes to the store's order status page, where the SDK does not run, so no `order.loaded` is sent
there, and the checkout page logs an error when its form is bound; after a gateway,
the shopper goes to `/success` on the site. After a failed payment, `param.payment_failed` is
`'true'` on the checkout, for `data-next-show`.

While submitting and placing, the cart is frozen; it unfreezes when a check fails or the order is
not created. A paid order empties the cart without cart events; `checkout.completed` ends the
checkout. While the shopper is at a gateway the cart is kept until the paid order loads, so a
shopper whose payment fails comes back to the same cart. `shipping.selected` is in the cart
lifecycle. Every form event comes after `checkout.started`: details entered while the page is
waiting are checked once the checkout starts. The method the form starts with is the Checkout's
`payment_method`; `payment.selected` comes only when the shopper changes it.

Each event carries its own object: `checkout.*` the Checkout (the Cart as `cart`, the `user`, the
addresses, `billing_same_as_shipping` and `payment_method`, with `errors` on `checkout.invalid`,
`error` on `checkout.failed` and the order's `ref_id` on `checkout.completed`), `user.*` the User,
`address.*` the Address with its `type` (`address.autofilled` only the fields it filled), and
`payment.selected` the Payment.

## User

![User lifecycle: no user yet, saving, created or not saved, with user.created and user.updated](user-lifecycle.svg)

`user.created` fires once per checkout, after `checkout.started`, when the checkout saves the
shopper as a lead: a first and last name of at least two characters each and a valid
email by default, or what `data-next-lead` asks for (see Lead capture in
[data-next-lead](../../attribute-reference/checkout/data-next-lead.md)), checked each time the shopper leaves a field they
changed, or picks an option. A failed save sends `sdk.error` (`user.save`) and is tried again on
the next field change. `user.updated` fires when the details change and are still valid; an
invalid change sends nothing. The Open Cart keeps the first details; the order takes the latest.
`language`, `ip` and `user_agent` are what the store recorded with the Open Cart.

## Address

![Address lifecycle: loading rules, incomplete, suggesting and entered, with address.autofilled, address.entered and address.updated](address-lifecycle.svg)

When the form is bound the country list loads, then the rules of the country it picks: the
field's value, `?country`, the shopper's location, else the US. A country change loads its rules
again. Typing at least two words in line 1 shows suggestions after a moment; picking one fills
line 1, the city, the postcode, the country and the state, and sends `address.autofilled` with the
fields it filled.

`address.entered` fires once per `type` per checkout, when that address is valid: every field its country requires passes its check, and so does each
optional field the shopper filled. Addresses are checked once the checkout is open on the page:
the form is bound and the cart has lines. `address.updated` fires when the address changes, the
phone included, and is still valid; an invalid change sends nothing and the last valid address is
kept. A `billing` address is sent only while billing is separate from shipping;
`billing_same_as_shipping` on the Checkout says which.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                                    | What the SDK does next                                                      |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `user.save`          | The Open Cart cannot be created                         | Tries again on the next field change                                        |
| `address.load_rules` | The country list or a country's rules cannot load       | Falls back to the campaign's countries and simpler checks                   |
| `address.suggest`    | Address suggestions cannot load                         | Shows no suggestions                                                        |
| `order.create`       | The order is not created: refused, or the request fails | `checkout.failed`; back to filling, and the cart unfreezes                  |
| `order.load`         | The next page cannot load the order                     | No `order.loaded` there, nor `order.paid` after a gateway; the cart is kept |
