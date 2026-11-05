---
title: 'data-next-toggle-card'
group: 'Attribute Reference/Cart'
order: 402
---

# data-next-toggle-card

An order bump: a click adds its package to the cart, the next click removes it. Its price is
quoted by the server for the quantity it would add.

```html
<div data-next-toggle-card data-next-package-id="9" data-next-is-upsell="true">
  <img data-next-toggle-image alt="" />
  Add protection for <span data-next-toggle-display="price"></span>
</div>
```

## Attributes

| Attribute                            | Means                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `data-next-package-id`               | The package. Required: a card without it logs a warning                                                                                    |
| `data-next-quantity`                 | How many to add. Default `1`                                                                                                               |
| `data-next-selected="true"`          | In the cart from the start, until the shopper removes it; once removed, it is not added again                                              |
| `data-next-is-upsell="true"`         | Flags the line as an upsell on the order                                                                                                   |
| `data-next-package-sync="<id,…>"`    | The bump's quantity is the quantity of these packages in the cart, and follows it as the cart changes                                      |
| `data-next-product-sync="<id,…>"`    | The same, for every package of these products                                                                                              |
| `data-next-toggle-display="<prop>"`  | Inside the card: one of its values (below)                                                                                                 |
| `img[data-next-toggle-image]`        | Inside the card: gets the package's image, and its name as `alt` when the page set none                                                    |
| `data-next-toggle-container`         | On an ancestor: gets the same state classes as the card                                                                                    |
| `data-next-property` inside the card | A personalisation sent with the line; see [data-next-property](../bundles/data-next-property.md). Changing it updates the line in the cart |

A click on a form control inside the card (an input, a select) does not toggle it.

`data-next-toggle-display` properties: `name`, `image`, `quantity`, `price`, `total`, `unitPrice`,
`originalPrice`, `originalUnitPrice`, `compare`, `discountAmount`, `savings`, `discountPercentage`,
`savingsPercentage`, `savingsOfferPercentage`, `hasDiscount`, `hasSavings`, `isSelected`. The same
values are readable anywhere as `toggle.<package id>.<prop>` with
[data-next-display](../values/data-next-display.md).

## Set by the SDK

| On the card (and `data-next-toggle-container`)                      | Means                       |
| ------------------------------------------------------------------- | --------------------------- |
| `next-selected`, `next-active`, `next-in-cart` / `next-not-in-cart` | In the cart, or not         |
| `data-next-selected`, `data-next-active`, `aria-pressed`            | `true` or `false`, the same |
| `data-next-in-cart` (card only)                                     | `true` or `false`           |

## 0.4.x

| 0.4.x              | Now                                |
| ------------------ | ---------------------------------- |
| `os--active` class | Still set. Use `next-in-cart`      |
| `data-in-cart`     | Still set. Use `data-next-in-cart` |

## Events

[cart.updated](/event-reference/carts/cart.updated), [cart.added](/event-reference/carts/cart.added)
or [cart.removed](/event-reference/carts/cart.removed); see the
[Cart lifecycle](../../event-reference/carts/lifecycle.md).
