---
title: 'Quantity stepper'
group: 'Attribute Reference/Bundles'
order: 304
---

# Quantity stepper

Buttons that change the picked card's quantity, and a place that shows it. They work inside a card,
or anywhere inside an element with `data-next-bundle-qty-for="<selector id>"`.

```html
<div data-next-bundle-qty-for="main">
  <button data-next-quantity-decrease>−</button>
  <span data-next-quantity-display>1</span>
  <button data-next-quantity-increase>+</button>
</div>
```

## Attributes

| Attribute                                  | Means                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `data-next-bundle-qty-for="<selector id>"` | The stepper outside the cards works on this selector's picked card |
| `data-next-quantity-increase`              | Adds one                                                           |
| `data-next-quantity-decrease`              | Takes one away                                                     |
| `data-next-quantity-display`               | Shows the picked card's quantity                                   |

A button inside a card picks that card first, then changes its quantity. The quantity stays between
the card's `data-next-min-quantity` (default `1`) and `data-next-max-quantity` (default `999`). In
`swap` mode the new quantity goes into the cart; the cards are priced again either way.

## Set by the SDK

| On              | Set                                                             |
| --------------- | --------------------------------------------------------------- |
| A button        | `disabled` and `next-disabled` at the card's minimum or maximum |
| The picked card | `data-next-quantity="<quantity>"`                               |

## Events

[selector.updated](/event-reference/selectors/selector.updated) with the new quantity.
