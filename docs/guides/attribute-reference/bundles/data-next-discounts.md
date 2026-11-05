---
title: 'data-next-discounts'
group: 'Attribute Reference/Bundles'
order: 308
---

# data-next-discounts

Lists the discounts on a card or a slot, one copy of its `<template>` per discount.

```html
<div data-next-bundle-card data-next-bundle-id="three" …>
  <ul data-next-discounts="offer">
    <template>
      <li>{discount.name}: −{discount.amount}</li>
    </template>
  </ul>
</div>
```

## Attributes

| Attribute                                  | Means                                             |
| ------------------------------------------ | ------------------------------------------------- |
| `data-next-discounts="offer"`              | Offer discounts (the campaign's own)              |
| `data-next-discounts="voucher"`            | Discounts from vouchers and coupons               |
| `data-next-discounts` with any other value | In a card: both kinds. In a slot: offer discounts |

In a card, the discounts come from the card's server price, so every card lists its own, picked or
not. In a [slot template](data-next-bundle-slot-template-id.md), they are that slot's package's
discounts in the cart.

## Template tokens

| Token                    | Is                                          |
| ------------------------ | ------------------------------------------- |
| `{discount.name}`        | The discount's name                         |
| `{discount.amount}`      | What it takes off, in the campaign currency |
| `{discount.percentage}`  | Its percentage, such as `10%`               |
| `{discount.description}` | Its description (cards only)                |

## Set by the SDK

In a card: `next-discounts-has-items` or `next-discounts-empty`, with `next-summary-has-items` /
`next-summary-empty`.
