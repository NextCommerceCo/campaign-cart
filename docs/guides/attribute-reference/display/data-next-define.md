---
title: 'data-next-define'
group: 'Attribute Reference/Display'
order: 307
---

# data-next-define

Names a [sum](data-next-query.md#sums) as a field, read like the SDK's own by a query, a condition
and a list. It is [`next.define`](../../javascript-api.md) without a script.

```html
<template data-next-define="cart.free_shipping_left = 75 - total_before_shipping"></template>

<p data-next-show="cart.free_shipping_left > 0">
  Spend <b data-next-query="cart.free_shipping_left"></b> more for free shipping
</p>
<p data-next-show="cart.free_shipping_left <= 0">You get free shipping</p>
```

Left of the `=` is the type and the field's name; right of it is the sum. Any element takes the
attribute; an empty `<template>` shows nothing.

| Part               | Means                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| The type           | `Cart`, `CartItem`, `Selector`, `Option`, `Order` or `OrderItem`, in any case: every object of it               |
| The sum            | As in `data-next-query`. A short path (`total`) reads the object itself; `cart.total` reads the cart            |
| `data-next-format` | How the field is written. Without it, as the sum's first path's field is: `75 - total_before_shipping` is money |

```html
<template data-next-define="Option.per_day = total / 30"></template>

<div data-next-selector="main">
  <div data-next-option="three" data-next-items="1x3"><span data-next-query="per_day"></span> a day</div>
</div>
```

The field has no value while a value in its sum is not known yet, such as a cart with no price. It
is never sent with events. A definition that cannot be read logs a warning once
(`cannot read the definition in data-next-define="cart.left = 75 -"`). For more than a sum, such as
an amount that never goes below 0, use `next.define`.
