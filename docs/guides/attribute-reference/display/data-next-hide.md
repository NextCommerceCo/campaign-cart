---
title: 'data-next-hide'
group: 'Attribute Reference/Display'
order: 303
---

# data-next-hide

Hides the element while the condition holds, the opposite of [data-next-show](data-next-show.md). It
takes the same [conditions](data-next-show.md#conditions).

```html
<p data-next-hide="cart.lines">Your cart is empty</p>
<a data-next-hide="!cart.lines" href="/checkout">Checkout</a>
```

## Set by the SDK

`hidden` while hidden (and `style.display` `none`, with `next-visible` / `next-hidden` for CSS that
selects them).
