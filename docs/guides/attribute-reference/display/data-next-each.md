---
title: 'data-next-each'
group: 'Attribute Reference/Display'
order: 303
---

# data-next-each

One copy of the element's first `<template>` per item of a list. Each copy reads its item with
short paths, and actions inside it act on that item.

```html
<div data-next-each="cart.lines">
  <template>
    <div class="line">
      <img data-next-query="image" alt="" />
      <span data-next-query="product_title"></span>
      <button data-next-action="setQuantity" data-next-quantity="-1">−</button>
      <span data-next-query="quantity"></span>
      <button data-next-action="setQuantity" data-next-quantity="+1">+</button>
      <span data-next-query="total"></span>
      <button data-next-action="removeItem">Remove</button>
    </div>
  </template>
</div>
<p data-next-hide="cart.lines">Your cart is empty</p>
```

Any list of the model works: `cart.lines`, `cart.coupons`, `cart.discounts`, `order.lines`, an
option's `lines`, `discounts` or `slots`, a variant's values (`variants.color`).

## Set by the SDK

`data-next-empty` on the element while the list has no items.
