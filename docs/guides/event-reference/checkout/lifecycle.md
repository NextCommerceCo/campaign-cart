---
title: 'Checkout lifecycle'
group: 'Event Reference/Checkout'
---

# Checkout lifecycle

![Checkout lifecycle: started, filling, submitting, placing, at the gateway and paid, with the events each step sends](checkout-lifecycle.svg)

| State            | Means                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `started`        | The checkout form is bound and the cart has lines, for the first time in this checkout                 |
| `filling`        | The shopper fills in the form, and fixes what a submit pointed out                                     |
| `submitting`     | The SDK checks the form, that the cart has lines, and the card; the cart is frozen and refuses changes |
| `placing`        | The order is being sent; the cart stays frozen                                                         |
| `at the gateway` | The order has a `payment_complete_url`, and the shopper pays there; see the payment lifecycle          |
| `paid`           | The order is paid, and the next page loads it; see the order lifecycle                                 |

| From             | What happens                                                                                                      | To                                 | Events, in order                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| none             | A checkout page binds its form and the cart has lines, or lines arrive later, and this tab has no checkout yet    | `started`                          | `checkout.started`; when lines arrive later, right after that change's `cart.updated`                  |
| `started`        | The shopper fills in the form                                                                                     | `filling`                          | in any order: `user.created`, `user.updated`, `address.entered`, `address.updated`, `payment.selected` |
| none             | A later page of the same checkout: a step, a reload, a return from the gateway                                    | `filling`                          | none                                                                                                   |
| `filling`        | On a step of a multi-step form (`data-next-checkout-step`), a submit passes the step's checks                     | `filling`, on the next step's page | `checkout.continued`; a step that fails its checks shows the errors and sends nothing                  |
| `filling`        | The shopper submits, or uses an express button                                                                    | `submitting`                       | none                                                                                                   |
| `submitting`     | A check fails: a field, an empty cart, or the card                                                                | `filling`                          | `checkout.submitted` (`valid: false`, with the `errors`)                                               |
| `submitting`     | The checks pass and the card is tokenized                                                                         | `placing`                          | `checkout.submitted` (`valid: true`)                                                                   |
| `placing`        | The order is not created: refused, declined, or the request fails                                                 | `filling`                          | `sdk.error` (`order.create`), `checkout.failed` (with `error`)                                         |
| `placing`        | The order is created without a `payment_complete_url`: it is paid, and the shopper is redirected to the next page | `paid`                             | `order.created`, then `order.loaded` and `order.paid` on the next page                                 |
| `placing`        | The order is created with a `payment_complete_url`: the shopper is redirected there to pay                        | `at the gateway`                   | `payment.redirected`                                                                                   |
| `at the gateway` | Paid; the gateway redirects the shopper to the next page, which loads the order                                   | `paid`                             | `order.loaded`, `order.paid`                                                                           |
| `at the gateway` | Not paid; the gateway redirects the shopper back to the checkout                                                  | `filling`                          | `payment.failed`                                                                                       |
| `at the gateway` | The shopper comes back without paying, such as with the browser's Back button                                     | `filling`                          | none                                                                                                   |

`checkout.started` comes once per checkout, and the Checkout's `id` names it: its steps, reloads and
a return from a gateway keep the same checkout. A paid order ends it, and the next checkout gets a
new `id`. The 0.4.x `checkout:started` still comes on each checkout page.

An express button (Apple Pay, Google Pay, PayPal, … in `data-next-express-checkout`) pays with the
wallet's details: the form is not checked, only that the cart has lines, unless the 0.4.x
`nextConfig.paymentConfig.expressCheckout.requireValidation` asks for its fields. PayPal or Klarna
picked as the payment method in the form gets the full checks, like a card.

The next page is `next-success-url`, with the order's `ref_id`. Without it, an order paid at once
goes to the store's order status page, where the SDK does not run, so no `order.loaded` or
`order.paid` is sent, and the checkout page logs an error when its form is bound; after a gateway,
the shopper goes to `/success` on the site. After a failed payment, `param.payment_failed` is
`'true'` on the checkout, for `data-next-show`.

While submitting and placing, the cart is frozen; it unfreezes when a check fails or the order is
not created. A paid order empties the cart without cart events. While the shopper is at a gateway
the cart is kept until the paid order loads, so a shopper whose payment fails comes back to the
same cart. `shipping.selected` is in the cart lifecycle. `user.*` and `payment.selected` can come
before `checkout.started`: `payment.selected` when the form binds, and both while the cart is
still empty; `address.*` only once the checkout is open on the page.

Each event carries its own object: `checkout.*` the Checkout (the Cart as `cart`, the `user`, the
addresses, `billing_same_as_shipping` and `payment_method`, with `valid` and `errors` on
`checkout.submitted` and `error` on `checkout.failed`), `user.*` the User, `address.*` the Address
with its `type`, and `payment.selected` the Payment.

## User

![User lifecycle: no user yet, saving, created or not saved, with user.created and user.updated](user-lifecycle.svg)

`user.created` fires once per tab, kept across pages until an order is paid, when the checkout
saves the shopper as a lead: a first and last name of at least two characters each and a valid
email by default, or what `data-next-lead` asks for (see Lead capture in
[data-next-lead](../../attribute-reference/checkout/data-next-lead.md)), checked each time the shopper leaves a field they
changed, or picks an option. A failed save sends `sdk.error` (`user.save`) and is tried again on
the next field change. `user.updated` fires when the details change and are still valid; an
invalid change sends nothing. The Open Cart keeps the first details; the order takes the latest.
`language`, `ip` and `user_agent` are what the store recorded with the Open Cart.

## Address

![Address lifecycle: incomplete, then entered, with address.entered and address.updated](address-lifecycle.svg)

`address.entered` fires once per `type` per tab, kept across pages until an order is paid, when
that address is valid: every field its country requires passes its check, and so does each
optional field the shopper filled. Addresses are checked once the checkout is open on the page:
the form is bound and the cart has lines. `address.updated` fires when the address changes, the
phone included, and is still valid; an invalid change sends nothing and the last valid address is
kept. A `billing` address is sent only while billing is separate from shipping;
`billing_same_as_shipping` on the Checkout says which.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`             | When                                                              | What the SDK does next                                                    |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `user.save`          | The Open Cart cannot be created                                   | Tries again on the next field change                                      |
| `address.load_rules` | The country list or a country's rules cannot load                 | Falls back to the campaign's countries and simpler checks                 |
| `address.suggest`    | Address suggestions cannot load                                   | Shows no suggestions                                                      |
| `order.create`       | The order is not created: refused, declined, or the request fails | `checkout.failed`; back to filling, and the cart unfreezes                |
| `order.load`         | The next page cannot load the order                               | No `order.loaded` or `order.paid` there; after a gateway the cart is kept |
