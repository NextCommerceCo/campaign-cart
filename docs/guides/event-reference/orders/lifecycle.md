---
title: 'Order lifecycle'
group: 'Event Reference/Orders'
---

# Order lifecycle

![Order lifecycle: created, at the gateway, loaded and payment failed, with the events each step sends](order-lifecycle.svg)

| State            | Means                                                          |
| ---------------- | -------------------------------------------------------------- |
| `created`        | The checkout created the order                                 |
| `at the gateway` | The order has a `payment_complete_url`; the shopper pays there |
| `loaded`         | A post-purchase page loaded the order                          |
| `payment failed` | The shopper came back from a gateway that failed               |

| From             | What happens                                             | To               | Events                                                                                                |
| ---------------- | -------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| none             | The checkout creates the order                           | `created`        | `order.created`                                                                                       |
| `created`        | It is paid at once; the next page loads it               | `loaded`         | `order.loaded`, then `order.paid` the first time                                                      |
| `created`        | It must be paid at a payment gateway                     | `at the gateway` | none                                                                                                  |
| `at the gateway` | Paid; the order page loads it                            | `loaded`         | `order.loaded`, then `order.paid` the first time; the cart kept for it is emptied without cart events |
| `at the gateway` | The payment fails; the shopper lands on the failure page | `payment failed` | `order.failed` (`stage: 'payment'`), `order.loaded` without `order.paid`; the cart is kept            |

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                       | What the SDK does next         |
| ------------ | ------------------------------------------ | ------------------------------ |
| `order.load` | A post-purchase page cannot load the order | The page shows no order values |
