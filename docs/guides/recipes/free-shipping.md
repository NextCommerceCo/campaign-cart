---
title: 'Recipes/Free shipping bar'
group: 'Recipes'
category: 'Recipes'
order: 7
---

# Free shipping bar

"Spend $26.00 more for free shipping" while the cart is under the threshold, then "You get free
shipping".

```html
<p data-next-show="cart.free_shipping_left > 0">
  Spend <b data-next-query="cart.free_shipping_left"></b> more for free shipping
</p>
<p data-next-hide="cart.free_shipping_left > 0">You get free shipping</p>
```

```js
const left = (cart) => Math.max(0, 75 - (cart.subtotal ?? 0) + (cart.total_discount ?? 0));
next.define('Cart', 'free_shipping_left', left, { format: 'currency' });
```

The SDK has no free-shipping threshold of its own, so the page defines one: `free_shipping_left`
is `75 − (subtotal − total_discount)`, the products after discounts, never below 0. Run the
`next.define` call once `next` is ready, and keep `75` equal to your store's free-shipping offer:
what shipping costs is the server's, read as `cart.shipping_method.price`. The amount updates each
time the cart is priced.

| Style                           | When                                        |
| ------------------------------- | ------------------------------------------- |
| `.next-visible`, `.next-hidden` | the message the condition shows or hides    |
| `html:not([data-next-ready]) b` | the cart is not priced yet: hide the amount |

**Events**: `cart.calculated` each time the totals arrive.

**See also**: [data-next-show](../attribute-reference/display/data-next-show.md) for conditions,
[Cart](../attribute-reference/objects/cart.md) for its fields, the
[JavaScript API](../javascript-api.md) for `next.define`.
