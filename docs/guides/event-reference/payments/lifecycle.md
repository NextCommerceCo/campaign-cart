---
title: 'Payment lifecycle'
group: 'Event Reference/Payments'
---

# Payment lifecycle

Events: `payment.redirected` and `payment.failed`, with the order's `order.created`, `order.loaded`
and `order.paid` and the checkout's `checkout.completed`.

![Payment lifecycle: at the gateway, then paid or not paid, with the events each step sends](payment-lifecycle.svg)

A payment that leaves the page: PayPal, Klarna, a wallet, 3-D Secure, or any order the store
creates with a `payment_complete_url`, and every payment that is not taken: a card declined on the
checkout, or a declined upsell. A card paid at once goes straight to `paid` on the checkout; see the
checkout lifecycle. `payment.selected`, the method picked in the form, is a checkout event.

| State            | Means                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `at the gateway` | The order exists unpaid; the shopper pays at its `payment_complete_url`                           |
| `paid`           | The gateway took the payment; the next page loads the order                                       |
| `not paid`       | The payment was not taken; the shopper is on the checkout, or the upsell page, with the same cart |

| From             | What happens                                                                           | To                         | Events, in order                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| none             | On the checkout, the order is created with a `payment_complete_url`                    | `at the gateway`           | `order.created` (`paid: false`), `payment.redirected` (`method`, `ref_id`, `url`), then the shopper is redirected to `url`            |
| none             | On the checkout, the card is declined                                                  | `not paid`                 | `payment.failed` (`method`, `error` with `code: 'declined'` and `decline_code`)                                                       |
| none             | On an upsell page, the offer's payment is declined                                     | `not paid`                 | `payment.failed` (`method`, `ref_id`, `error` with `code: 'declined'`); see the upsell lifecycle                                      |
| `at the gateway` | Paid; the gateway redirects the shopper to the next page, which loads the order        | `paid`                     | `order.loaded`, then `order.paid` and `checkout.completed` the first time; the cart kept for the order is emptied without cart events |
| `at the gateway` | Not paid; the gateway redirects the shopper back with `payment_failed=true` in the URL | `not paid`                 | `payment.failed` (`method`, `ref_id`, `error` with `code: 'payment_failed'`), once per order                                          |
| `at the gateway` | The shopper comes back without paying, such as with the browser's Back button          | none, back on the checkout | none                                                                                                                                  |
| `not paid`       | The shopper submits again                                                              | none, back on the checkout | a new order, from `submitting` in the checkout lifecycle                                                                              |

`order.created` for a gateway payment carries what the store returned when it created the order;
`order.loaded` carries its details once it is paid. The next page is `next-success-url`, else
`/success` on the site, with the order's `order_ref_id`; see the order lifecycle.

`payment.failed` comes on the page the gateway sends the shopper back to, when its URL has
`payment_failed=true` and no `ref_id`: the checkout itself, or the `next-failure-url` page; the
store adds `payment_failed=true` and `payment_method` to either. The order is not loaded, since
the store has nothing to load until it is paid. `method` is the URL's `payment_method`, else the
express button's method, else the method picked in the form. The shopper is back in the same checkout with the same cart, so
`checkout.started` does not come again, and `param.payment_failed` is `'true'` for
`data-next-show`.

## Errors

A payment that is not taken is not an SDK failure: `payment.failed` comes without `sdk.error`. The SDK lifecycle lists every action and `code`.

| `action` | When | What the SDK does next |
| -------- | ---- | ---------------------- |
