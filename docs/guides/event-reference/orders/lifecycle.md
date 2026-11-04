---
title: 'Order lifecycle'
group: 'Event Reference/Orders'
---

# Order lifecycle

![Order lifecycle: created, awaiting payment, paid and payment failed, with the events each step sends](order-lifecycle.svg)

| State              | Means                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| `created`          | The checkout created the order                                                |
| `awaiting payment` | The order has a `payment_complete_url`; the shopper pays at the gateway       |
| `paid`             | The order is paid, and a page after the checkout loaded it                    |
| `payment failed`   | The gateway payment failed; the shopper is back on the checkout with the cart |

| From               | What happens                                                                      | To                 | Events, in order                                                                                   |
| ------------------ | --------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| none               | The checkout creates the order                                                    | `created`          | `order.created`                                                                                    |
| none               | The server refuses the order                                                      | none               | `sdk.error` (`order.create`), `order.failed` (`stage: 'order'`)                                    |
| `created`          | It is paid at once; the shopper is redirected to the next page                    | `paid`             | `order.loaded`, then `order.paid` the first time                                                   |
| `created`          | It has a `payment_complete_url`; the shopper is redirected to the gateway         | `awaiting payment` | none                                                                                               |
| `awaiting payment` | Paid; the gateway redirects to the next page, and the cart kept for it is emptied | `paid`             | `order.loaded`, then `order.paid` the first time; no cart events                                   |
| `awaiting payment` | The payment fails; the gateway redirects back to the checkout                     | `payment failed`   | `order.failed` (`stage: 'payment'`), from the order this tab sent to the gateway; the cart is kept |
| `paid`             | Each later page that opens the order                                              | `paid`             | `order.loaded`                                                                                     |

For a gateway payment, `order.created` carries only `ref_id` and `payment_complete_url`: the store
has the order's details once it is paid. A page loads the order when it has `ref_id` or
`order_ref_id` in its URL, or order markup; `order.paid` comes once per order in this browser.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                            | What the SDK does next                             |
| ------------ | ----------------------------------------------- | -------------------------------------------------- |
| `order.load` | A page after the checkout cannot load the order | The page shows no order values; offers stay hidden |
