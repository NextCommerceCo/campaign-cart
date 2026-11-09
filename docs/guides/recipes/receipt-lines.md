---
title: 'Recipes/Receipt'
group: 'Recipes'
category: 'Recipes'
order: 10
---

# Receipt

The order number, each line the shopper paid for with upsells marked, the totals, and where the
order ships.

```html
<h1>Order <span data-next-query="order.number"></span></h1>

<div data-next-each="order.lines">
  <template>
    <div class="line">
      <img data-next-query="image" alt="" />
      <span data-next-query="product_title"></span> × <span data-next-query="quantity"></span>
      <span data-next-query="total"></span>
      <em data-next-show="upsell">Added after checkout</em>
    </div>
  </template>
</div>

<dl>
  <dt>Shipping</dt>
  <dd data-next-query="order.shipping_method.price"></dd>
  <dt data-next-show="order.total_discount > 0">Discount</dt>
  <dd data-next-show="order.total_discount > 0" data-next-query="order.total_discount"></dd>
  <dt>Tax</dt>
  <dd data-next-query="order.tax"></dd>
  <dt>Total</dt>
  <dd data-next-query="order.total"></dd>
</dl>

<p>Ships to <span data-next-query="order.shipping_address"></span></p>
```

The page is opened with `?ref_id=<order>`, and the SDK loads the order from it. Every price is
what the shopper paid, tax included: `tax` is the part of `total` that is tax. An address written
whole is one line: street, city, state and postcode, country.

| Style                               | When                           |
| ----------------------------------- | ------------------------------ |
| `html:not([data-next-ready]) dd`    | the order has not loaded yet   |
| `[data-next-each][data-next-empty]` | the order has no lines to show |

**Events**: `order.loaded` on every load, `order.paid` once per order.

**See also**: [Receipt Page](../building-pages/receipt-page.md),
[Order and upsell](../attribute-reference/objects/order.md) for every field,
[data-next-each](../attribute-reference/display/data-next-each.md).
