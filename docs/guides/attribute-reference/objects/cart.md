---
title: 'Cart'
group: 'Attribute Reference/Objects'
order: 201
---

# Cart

The cart every page has, with no attribute to put it there. Read it with
[data-next-query](../display/data-next-query.md) (`cart.total`), list its lines with
[data-next-each](../display/data-next-each.md) (`cart.lines`), and change it with
[actions](../actions/data-next-action.md). `next.query('cart')` and every `cart.*` event carry the
same object.

```html
<span data-next-query="cart.total"></span>
<p data-next-show="cart.total_discount > 0">You save <span data-next-query="cart.total_discount"></span></p>

<div data-next-each="cart.lines">
  <template>
    <span data-next-query="product_title"></span> × <span data-next-query="quantity"></span>
    <span data-next-query="total"></span>
    <button data-next-action="removeItem">Remove</button>
  </template>
</div>
```

Totals add up: `total = subtotal − total_discount + shipping_method.price`, and
`total_before_shipping = total − shipping_method.price`. A line's own:
`total = subtotal − total_discount`, with `price` and `original_price` for one package.

## Fields

<!-- fields: Cart -->
