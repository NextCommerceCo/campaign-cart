---
title: 'Building Pages/Receipt Page'
group: 'Building Pages'
category: 'Building Pages'
---

# Receipt Page

The receipt shows the order the shopper just paid for, upsells included. It is opened with
`?ref_id=<order>`, by the checkout's `data-next-go` or the last upsell, and the SDK loads the order
from it.

```html
<h1>Thank you, <span data-next-query="order.user.first_name"></span></h1>
<p>Order <span data-next-query="order.number"></span>, sent to <span data-next-query="order.user.email"></span></p>
```

## Order lines

```html
<div data-next-each="order.lines">
  <template>
    <div class="line">
      <img data-next-query="image" alt="" />
      <span data-next-query="product_title"></span>
      <small data-next-show="variant_title" data-next-query="variant_title"></small>
      × <span data-next-query="quantity"></span>
      <span data-next-query="total"></span>
      <em data-next-show="upsell">Added after checkout</em>
    </div>
  </template>
</div>
```

Each line has `product_title`, `variant_title`, `sku`, `image`, `quantity`, `price` and
`original_price` (one unit), `total` (the line) and `upsell`.

## Totals and details

```html
<dl>
  <dt>Shipping</dt>
  <dd data-next-query="order.shipping_method.price"></dd>
  <dt data-next-show="order.total_discount > 0">Discount</dt>
  <dd data-next-show="order.total_discount > 0" data-next-query="order.total_discount"></dd>
  <dt data-next-show="order.tax > 0">Tax</dt>
  <dd data-next-show="order.tax > 0" data-next-query="order.tax"></dd>
  <dt>Total</dt>
  <dd data-next-query="order.total"></dd>
</dl>
<p>Ships to <span data-next-query="order.shipping_address"></span></p>
```

Every field of the order is on [Order and upsell](../attribute-reference/objects/order.md); an
address written whole is one line.

`order.paid` is sent once per order: on the checkout for an order paid at once, else on the first
page that loads it paid after the gateway, so a reload of the receipt never tracks the purchase
twice; see the [Order lifecycle](../event-reference/orders/lifecycle.md).
