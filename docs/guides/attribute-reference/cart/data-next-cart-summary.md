---
title: 'data-next-cart-summary'
group: 'Attribute Reference/Cart'
order: 403
---

# data-next-cart-summary

Draws the cart from a `<template>`: its totals, one row per line, and its discounts. It is drawn
again each time the cart's prices change.

```html
<div data-next-cart-summary>
  <template>
    <div data-summary-lines>
      <template>
        <div class="line">
          <img src="{item.image}" alt="" /> {item.name} × {item.quantity}
          <s data-next-show="item.hasDiscount">{item.originalPrice}</s> {item.price}
        </div>
      </template>
    </div>
    <p>Subtotal {subtotal}</p>
    <p>Shipping {shipping}</p>
    <p>Total {total}</p>
  </template>
</div>
```

The `<template>` must be a direct child; without one a warning is logged and nothing is drawn.
`{name}` tokens are filled in text and in attribute values; an unknown token becomes empty.

## Attributes

| Attribute                                               | Means                                                                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `data-next-cart-summary`                                | The summary; its `<template>` child is the layout                                                          |
| `data-summary-lines`                                    | Inside the layout: one copy of its own `<template>` child per cart line, ordered by package id             |
| `data-next-item-properties`                             | Inside a line: one copy of its `<template>` per personalisation, with `{property.key}`, `{property.value}` |
| `data-next-discounts="offer\|voucher"`                  | Inside the layout: the cart's discounts; see [data-next-discounts](../bundles/data-next-discounts.md)      |
| `data-next-display`, `data-next-show`, `data-next-hide` | Inside a line, they also read the line's own values: `item.price`, `item.hasDiscount`, …                   |

Totals tokens: `{subtotal}`, `{total}`, `{shipping}` (`Free` when nothing is charged),
`{shippingName}`, `{shippingCode}`, `{shippingOriginal}` (only when shipping is discounted),
`{totalDiscount}` (also `{discounts}`), `{totalDiscountPercentage}`, `{currency}`,
`{isCalculating}`, `{isEmpty}`, `{itemCount}`, `{totalQuantity}`, `{isFreeShipping}`,
`{hasShippingDiscount}`, `{hasDiscounts}`.

Line tokens, as `{item.…}` or `{line.…}`: `packageId`, `name`, `image`, `quantity`,
`productName`, `variantName`, `sku`, `price` (the line total), `originalPrice`, `unitPrice`,
`originalUnitPrice`, `discountAmount`, `discountPercentage`, `hasDiscount` (`show` or `hide`),
`currency`, `isRecurring`, `interval`, `intervalCount`, `frequency`, `recurringPrice`,
`originalRecurringPrice`.

## Set by the SDK

Each class on the summary has its opposite, so either can be styled.

| Class                                                      | When                                |
| ---------------------------------------------------------- | ----------------------------------- |
| `next-cart-empty` / `next-cart-has-items`                  | The cart has no lines, or has some  |
| `next-calculating` / `next-not-calculating`                | New prices are on the way           |
| `next-has-discounts` / `next-no-discounts`                 | The cart has a discount             |
| `next-free-shipping` / `next-has-shipping`                 | Shipping costs nothing              |
| `next-has-shipping-discount` / `next-no-shipping-discount` | Shipping is discounted              |
| `next-no-tax`                                              | Always set: the cart carries no tax |

## Events

[cart.calculating](/event-reference/carts/cart.calculating) and
[cart.calculated](/event-reference/carts/cart.calculated); see the
[Cart lifecycle](../../event-reference/carts/lifecycle.md).
