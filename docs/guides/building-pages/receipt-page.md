---
title: 'Building Pages/Receipt Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Receipt Page

The receipt shows the order the shopper just paid for, upsells included. It is opened with
`?ref_id=<order>`, by the checkout's `next-success-url` or the last upsell. Any `order.*`
attribute on the page loads the order.

```html
<h1>Thank you, <span data-next-display="order.customer.firstName"></span></h1>
<p>
  Order <span data-next-display="order.number"></span>, sent to <span data-next-display="order.customer.email"></span>
</p>
```

## Order lines

`[data-next-order-items]` draws one copy of its template per line. Its content is the template,
or `data-item-template-id` names a `<template>` elsewhere on the page.

```html
<div data-next-order-items data-item-template-id="order-line"></div>

<template id="order-line">
  <div class="line">
    <img src="{item.image}" alt="" />
    <span>{item.name}</span> <small class="{item.showVariant}">{item.variant}</small>
    × {item.quantity}
    <span>{item.lineTotal}</span>
  </div>
</template>
```

| Token                                                         | Is                                          |
| ------------------------------------------------------------- | ------------------------------------------- |
| `{item.name}`, `{item.sku}`, `{item.description}`             | The product                                 |
| `{item.variant}`, `{item.image}`, `{item.quantity}`           | The line's variant, image and quantity      |
| `{item.price}`, `{item.priceExclTax}`                         | One unit                                    |
| `{item.lineTotal}`, `{item.lineTotalExclTax}`                 | The whole line                              |
| `{item.isUpsell}`, `{item.hasImage}`, `{item.hasVariant}`     | `true` or `false`                           |
| `{item.showUpsell}`, `{item.showImage}`, `{item.showVariant}` | `show` or `hide`, for a class               |
| `{item.upsellBadge}`                                          | `UPSELL` on an upsell line, otherwise empty |

The list gets `order-loading`, `order-has-items`, `order-empty` or `order-error`.
`data-empty-template` replaces the text shown for an order with no lines.

## Totals and details

```html
<dl>
  <dt>Subtotal</dt>
  <dd data-next-display="order.subtotal"></dd>
  <dt>Shipping</dt>
  <dd data-next-display="order.shipping"></dd>
  <dt data-next-show="order.hasDiscounts">Discount</dt>
  <dd data-next-show="order.hasDiscounts" data-next-display="order.discounts"></dd>
  <dt data-next-show="order.hasTax">Tax</dt>
  <dd data-next-show="order.hasTax" data-next-display="order.tax"></dd>
  <dt>Total</dt>
  <dd data-next-display="order.total"></dd>
</dl>
```

| Path                                                                                            | Is                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `order.number`, `order.refId`, `order.currency`                                                 | The order                                                                                                  |
| `order.total`, `order.subtotal`, `order.shipping`, `order.tax`, `order.discounts`               | Money, in the campaign's currency; `totalExclTax`, `shippingExclTax` too                                   |
| `order.hasTax`, `order.hasShipping`, `order.hasDiscounts`, `order.hasUpsells`, `order.hasItems` | For `data-next-show` / `data-next-hide`                                                                    |
| `order.itemCount`                                                                               | Number of lines                                                                                            |
| `order.shippingMethod`, `order.paymentMethod`                                                   | Their names                                                                                                |
| `order.customer.name`, `.firstName`, `.lastName`, `.email`, `.phone`                            | The shopper                                                                                                |
| `order.shippingAddress`, `order.billingAddress`                                                 | The address on one line; `.line1`, `.line2`, `.city`, `.state`, `.postcode`, `.country`, `.name` each part |

`order.paid` is sent once per order, on the first page after the checkout, so the purchase is
tracked even when the shopper reloads the receipt; see the
[Order lifecycle](../event-reference/orders/lifecycle.md).
