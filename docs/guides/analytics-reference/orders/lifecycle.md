---
title: 'Order tracking'
group: 'Analytics Reference/Orders'
---

# Order tracking

Tracking event: `checkout_completed`.

![Order tracking: order.paid sends checkout_completed once per order in this browser, with the lines paid with the order; the order.loaded of a later page sends it when the paying page was left first; a line an upsell adds after payment is not in it and sends upsell_completed](orders-lifecycle.svg)

| Tracking event       | Sent by        | When                                                                             | `dl_*` push   |
| -------------------- | -------------- | -------------------------------------------------------------------------------- | ------------- |
| `checkout_completed` | `order.paid`   | Once per order in this browser: on the checkout, or on the page after a gateway  | `dl_purchase` |
| `checkout_completed` | `order.loaded` | On a later page, when the page that had `order.paid` was left before it was sent | `dl_purchase` |

Its lines are the ones paid with the order, an `is_upsell` line among them. A line an upsell adds
after payment is not in it: that is `upsell_completed`, in [Upsell tracking](../upsells/lifecycle.md).
See [Each event comes once](../how-it-works.md#each-event-comes-once).
