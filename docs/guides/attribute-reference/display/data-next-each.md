---
title: 'data-next-each'
group: 'Attribute Reference/Display'
order: 304
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

A row of a list of plain values, such as the codes in `cart.coupons`, reads its item as `value`:

```html
<ul data-next-each="cart.coupons">
  <template>
    <li><span data-next-query="value"></span> <button data-next-action="removeCoupon">Remove</button></li>
  </template>
</ul>
```

## Set by the SDK

`data-next-empty` on the element while the list has no items.
