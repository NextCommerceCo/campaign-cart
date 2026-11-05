---
title: 'Remove and quantity controls'
group: 'Attribute Reference/Cart'
order: 405
---

# Remove and quantity controls

Buttons that change a line already in the cart. Each finds its package on the nearest ancestor
(or itself) with `data-next-package-id`.

```html
<div data-next-package-id="42">
  <button data-next-quantity="decrease">−</button>
  <button data-next-quantity="increase" data-max="5">+</button>
  <button data-next-remove-item>Remove</button>
</div>
```

Controls also work inside markup added later, such as a
[cart summary](data-next-cart-summary.md) row with `data-next-package-id="{item.packageId}"`. A control
with no package logs a warning.

## Attributes

| Attribute                       | Means                                                     |
| ------------------------------- | --------------------------------------------------------- |
| `data-next-quantity="increase"` | Adds `data-step` to the line's quantity, up to `data-max` |
| `data-next-quantity="decrease"` | Takes `data-step` off, down to `data-min`                 |
| `data-next-remove-item`         | Removes the line                                          |
| `data-step`                     | How much one click changes. Default `1`                   |
| `data-min`                      | Lowest quantity `decrease` reaches. Default `1`           |
| `data-max`                      | Highest quantity `increase` reaches. Default no limit     |

## 0.4.x

| 0.4.x                             | Now                                    |
| --------------------------------- | -------------------------------------- |
| `data-package-id` on the ancestor | Still read. Use `data-next-package-id` |

## Events

[cart.updated](/event-reference/carts/cart.updated), and
[cart.removed](/event-reference/carts/cart.removed) when a line goes; see the
[Cart lifecycle](../../event-reference/carts/lifecycle.md).
