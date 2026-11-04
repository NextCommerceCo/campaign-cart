---
title: 'Checkout lifecycle'
group: 'Event Reference/Checkout'
---

# Checkout lifecycle

![Checkout lifecycle: open, filling, submitting, placing, awaiting payment and paid, with the events each step sends](checkout-lifecycle.svg)

| State              | Means                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `open`             | The checkout form is bound with a cart                                                                       |
| `filling`          | The shopper fills in the form, and fixes what a submit pointed out                                           |
| `submitting`       | The SDK checks the form, that the cart has lines, and the card; the cart is frozen and ignores changes       |
| `placing`          | The order is being sent; the cart stays frozen                                                               |
| `awaiting payment` | The order exists but is not paid yet; the shopper pays at its `payment_complete_url` (PayPal, 3-D Secure, …) |
| `paid`             | The order is paid; the cart is emptied                                                                       |

| From               | What happens                                                                                                                             | To                       | Events, in order                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------ |
| none               | A checkout page loads and the cart has lines: each step, a reload, a return from the gateway                                             | `open`                   | `checkout.started`, once a page; none if the cart is empty when the form binds                         |
| `open`             | The shopper fills in the form                                                                                                            | `filling`                | in any order: `user.created`, `user.updated`, `address.entered`, `address.updated`, `payment.selected` |
| `filling`          | On a step of a multi-step form (`data-next-checkout-step`), a submit checks the contact and shipping fields and opens the next step page | `open`, on that page     | none                                                                                                   |
| `filling`          | The shopper submits, or uses an express button                                                                                           | `submitting`             | none                                                                                                   |
| `submitting`       | A check fails: a field, an empty cart, or the card                                                                                       | `filling`                | `checkout.submitted` (`valid: false`, with the `errors`)                                               |
| `submitting`       | The checks pass and the card is tokenized; an express button skips the form checks                                                       | `placing`                | `checkout.submitted` (`valid: true`)                                                                   |
| `placing`          | The order is not created: refused, declined, or the request fails                                                                        | `filling`                | `sdk.error` (`order.create`), `order.failed` (`stage: 'order'`)                                        |
| `placing`          | The order is created without a `payment_complete_url`: it is paid, and the shopper is redirected to the next page                        | `paid`                   | `order.created`, then `order.loaded` and `order.paid` on the next page                                 |
| `placing`          | The order is created with a `payment_complete_url`: the shopper is redirected there to pay                                               | `awaiting payment`       | `order.created`                                                                                        |
| `awaiting payment` | The payment is completed; the gateway redirects the shopper to the next page, which loads the order                                      | `paid`                   | `order.loaded`, `order.paid`                                                                           |
| `awaiting payment` | The payment fails; the gateway redirects the shopper back to the checkout, or to `next-failure-url`, cart kept                           | `open` (on the checkout) | `order.failed` (`stage: 'payment'`), and `checkout.started` on the checkout, in either order           |
| `awaiting payment` | The shopper comes back without paying, such as with the browser's Back button                                                            | `open`                   | `checkout.started` only                                                                                |

After a failed payment, `param.payment_failed` is `'true'` on that page, for `data-next-show`. The
next page is `next-success-url`, with the order's `ref_id` (`order_ref_id` after a gateway).
Without it, an order paid at once goes to the store's order status page, where the SDK does not run,
so no `order.loaded` or `order.paid` is sent; after a gateway, the shopper goes to `/success` on the
site. `shipping.selected` comes from a bundle card's shipping
method or `next.actions.setShipping`, and like `payment.selected` it can come before
`checkout.started`.

A paid order empties the cart without cart events. While payment is awaited the cart is kept
until the paid order loads, so a shopper whose payment fails comes back to the same cart. See the order
lifecycle.

Each event carries its own object: `checkout.started` and `checkout.submitted` the Checkout (the
Cart as `cart`, the `user`, the addresses, `billing_same_as_shipping` and `payment_method`, with
`valid` and `errors` on `checkout.submitted`), `user.*` the User, `address.*` the Address with its
`type`, `shipping.selected` the ShippingMethod and `payment.selected` the Payment.

## User

![User lifecycle: no user yet, saving, created or not saved, with user.created and user.updated](user-lifecycle.svg)

`user.created` fires once per tab, kept across pages until an order is paid, when the checkout
saves the shopper as a lead: a first and last name of at least two characters each and a valid
email by default, or what `data-next-lead` asks for (see Lead capture in
[Attributes](../../attributes.md#lead-capture)), checked each time the shopper leaves a field they
changed, or picks an option. A failed save
sends `sdk.error` (`user.save`) and is tried again on the next field change. `user.updated` fires
when the details change and are still valid; an invalid change sends nothing. The Open Cart keeps
the first details; the order takes the latest. `language`, `ip` and `user_agent` are what the store
recorded with the Open Cart.

## Address

![Address lifecycle: incomplete, then entered, with address.entered and address.updated](address-lifecycle.svg)

`address.entered` fires once per `type` per tab, kept across pages until an order is paid, when
that address is valid: every field its country requires passes its check, and so does each
optional field the shopper filled. Addresses are checked once `checkout.started` has fired.
`address.updated` fires when the address changes, the phone included, and is still valid; an
invalid change sends nothing and the last valid address is kept. A `billing` address is sent only
while billing is separate from shipping; `billing_same_as_shipping` on the Checkout says which.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`               | When                                                              | What the SDK does next                                                            |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `user.save`            | The Open Cart cannot be created                                   | Tries again on the next field change                                              |
| `address.rules`        | The country list or a country's rules cannot load                 | Falls back to the campaign's countries and simpler checks                         |
| `address.autocomplete` | Address suggestions cannot load                                   | Shows no suggestions                                                              |
| `order.create`         | The order is not created: refused, declined, or the request fails | Back to filling with `order.failed`; the cart unfreezes                           |
| `order.load`           | The next page cannot load the order                               | No `order.loaded` or `order.paid` there; after a gateway payment the cart is kept |
