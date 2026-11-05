---
title: 'order.* values'
group: 'Attribute Reference/Orders'
order: 702
---

# order.\* values

The order placed at checkout, for [data-next-display](../values/data-next-display.md) and
[data-next-show / data-next-hide](../values/data-next-show.md) on upsell and receipt pages. Any
`order.*` attribute on a page loads the order: from `?ref_id=` (or `order_ref_id`), or the order
already loaded earlier in this tab.

```html
<h1>Thank you, <span data-next-display="order.customer.firstName"></span></h1>
<p>Order <span data-next-display="order.number"></span></p>
<p data-next-show="order.hasDiscounts">You saved <span data-next-display="order.discounts"></span></p>
<p>Total <span data-next-display="order.total"></span></p>
```

## Paths

| Path                                                                 | Is                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `order.number`                                                       | The order number                                                                  |
| `order.refId` (`ref_id`)                                             | The order's reference                                                             |
| `order.currency`                                                     | The order's currency code                                                         |
| `order.total`                                                        | Total, with tax                                                                   |
| `order.totalExclTax` (`total_excl_tax`)                              | Total without tax                                                                 |
| `order.subtotal`                                                     | The lines without tax                                                             |
| `order.shipping`, `order.shippingExclTax`                            | Shipping, with and without tax                                                    |
| `order.tax`                                                          | Tax                                                                               |
| `order.discounts`                                                    | Discounts                                                                         |
| `order.itemCount`                                                    | Number of lines                                                                   |
| `order.shippingMethod`                                               | The shipping method's name                                                        |
| `order.paymentMethod`                                                | The payment method's name                                                         |
| `order.customer.name`, `.firstName`, `.lastName`, `.email`, `.phone` | The shopper (`order.user.*` reads the same)                                       |
| `order.shippingAddress`, `order.billingAddress`                      | The address on one line                                                           |
| `order.shippingAddress.<part>`, `order.billingAddress.<part>`        | `name`, `line1`, `line2`, `city`, `state`, `postcode` (`zip`), `country`, `phone` |
| `order.hasItems`, `order.isEmpty`                                    | Yes/no: the order has lines, or none                                              |
| `order.hasTax`, `order.hasShipping`, `order.hasDiscounts`            | Yes/no: the amount is above 0                                                     |
| `order.hasUpsells`                                                   | Yes/no: an upsell was added                                                       |
| `order.supportsUpsells`                                              | Yes/no: the order can take a post-purchase offer                                  |

Money is formatted in the campaign currency. Until the order is loaded, text and money paths are
empty and yes/no paths read as no.

The order's lines are drawn by [data-next-order-items](data-next-order-items.md).

## Events

[order.loaded](/event-reference/orders/order.loaded), [order.paid](/event-reference/orders/order.paid)
once per order, and [order.updated](/event-reference/orders/order.updated) after an upsell; see the
[Order lifecycle](../../event-reference/orders/lifecycle.md).
