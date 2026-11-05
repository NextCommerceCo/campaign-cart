---
title: 'Order lifecycle'
group: 'Event Reference/Orders'
---

# Order lifecycle

Events: `order.*`, with `upsell.accepted` before `order.updated`.

![Order lifecycle: loading, loaded, updated and not loaded, with the events each step sends](order-lifecycle.svg)

| State        | Means                                                           |
| ------------ | --------------------------------------------------------------- |
| `loading`    | A page whose URL has `ref_id` or `order_ref_id` loads the order |
| `loaded`     | The page has the order                                          |
| `updated`    | An upsell was added to the order                                |
| `not loaded` | The order could not load; the page shows no order values        |

| From                | What happens                                                                                        | To           | Events, in order                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| none                | On the checkout, the order is created paid; the shopper is redirected to the next page              | `loading`    | `order.created` (`paid: true`), `order.paid`, on the checkout                       |
| none                | Paid at a gateway; the gateway redirects the shopper to the next page                               | `loading`    | none; `order.created` (`paid: false`) and `payment.redirected` came on the checkout |
| `loading`           | The order arrives: from a copy loaded in this tab in the last 15 minutes at once, else from the API | `loaded`     | `order.loaded`, then `order.paid` the first time this browser has it paid           |
| `loading`           | The order cannot load; the SDK waits 10 seconds at most                                             | `not loaded` | `sdk.error` (`order.load`)                                                          |
| `loaded`            | An upsell is added                                                                                  | `updated`    | `upsell.accepted`, `order.updated`                                                  |
| `loaded`, `updated` | A later page opens the order                                                                        | `loading`    | none                                                                                |

`order.created` comes on the checkout for every order the store creates, with the Order it
returned: `paid: true` when it was paid at once, `paid: false` when the shopper pays at a gateway
next; the gateway order's details come with `order.loaded` once it is paid. See the payment
lifecycle.

`order.paid` comes once per order in this browser: on the checkout, right after `order.created`,
for an order paid at once; after `order.loaded` on the first page that loads it paid, for an order
paid at a gateway. An order still awaiting payment sends `order.loaded` alone. When the order paid
at a gateway loads, the cart kept for it is emptied without cart events, and `checkout.completed`
ends the checkout.

The next page is `next-success-url`. Without it, an order paid at once goes to the store's order
status page, where the SDK does not run, so `order.loaded` does not come; `order.paid` already
came on the checkout.
`order.updated` carries the order with the upsell's lines, marked `upsell: true`, right after
`upsell.accepted`.

## Errors

Each sends `sdk.error` with this `action`. The SDK lifecycle lists every action and `code`.

| `action`     | When                                            | What the SDK does next                                                                                                                               |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order.load` | A page after the checkout cannot load the order | No `order.loaded`, nor `order.paid` after a gateway; the page shows no order values and offers stay hidden; after a gateway payment the cart is kept |
