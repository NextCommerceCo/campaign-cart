---
title: 'Checkout lifecycle'
group: 'Event Reference/Checkout'
---

# Checkout lifecycle

![Checkout lifecycle: open, filling, stopped, placing and placed, with the events each step sends](checkout-lifecycle.svg)

| State     | Means                                                                 |
| --------- | --------------------------------------------------------------------- |
| `open`    | The checkout form is bound with a cart                                |
| `filling` | The shopper fills in the form                                         |
| `stopped` | A submit failed its checks                                            |
| `placing` | The order is being sent; the cart is frozen and ignores changes       |
| `placed`  | The order was created; the shopper goes to the next page or a gateway |

| From      | What happens                                                   | To        | Events                                                                                                                            |
| --------- | -------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| none      | The form is bound and the cart has lines                       | `open`    | `checkout.started`, once                                                                                                          |
| `open`    | The shopper fills in the form                                  | `filling` | in any order: `contact.entered`, `contact.updated`, `address.entered`, `address.updated`, `shipping.selected`, `payment.selected` |
| `filling` | A submit fails its checks: a field, an empty cart, or the card | `stopped` | `checkout.submitted` (`valid: false`, with the `errors`)                                                                          |
| `stopped` | The shopper fixes it and submits again                         | `filling` | none                                                                                                                              |
| `filling` | A submit passes its checks, and the card is tokenized          | `placing` | `checkout.submitted` (`valid: true`)                                                                                              |
| `placing` | The server creates the order                                   | `placed`  | `order.created`                                                                                                                   |
| `placing` | The server refuses the order                                   | `filling` | `sdk.error` (`order.create`), `order.failed` (`stage: 'order'`)                                                                   |

A created order empties the cart without cart events, unless the shopper pays at a payment
gateway; then the cart is kept until the paid order is loaded. See the order lifecycle.

Every checkout event carries the Checkout: the Cart, with `contact` from `contact.entered` on,
each address from its `address.entered` on (`billing_address` only while billing is separate), and
the chosen `payment_method`. `address.*` add `address_type`, and `checkout.submitted` adds `valid`
and `errors`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`               | When                                              | What the SDK does next                                  |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `contact.save`         | The Open Cart cannot be created                   | Tries again when the shopper leaves a field             |
| `address.rules`        | The country list or a country's rules cannot load | Uses the campaign's countries and simpler checks        |
| `address.autocomplete` | Address suggestions cannot load                   | Shows no suggestions                                    |
| `order.create`         | The server refuses the order                      | Back to filling with `order.failed`; the cart unfreezes |
