---
title: 'data-next-action="add-to-cart"'
group: 'Attribute Reference/Cart'
order: 401
---

# data-next-action="add-to-cart"

A button that adds a package, or the card picked in a bundle selector, to the cart on click. With
`data-next-url` it then opens the next page.

```html
<button data-next-action="add-to-cart" data-next-package-id="42" data-next-quantity="2">Add 2</button>

<button data-next-action="add-to-cart" data-next-selector-id="main" data-next-url="checkout.html">Continue</button>
```

## Attributes

| Attribute                     | Means                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-next-action`            | `add-to-cart`. Other values are not read by this button                                                                                                                                                                                |
| `data-next-package-id`        | The package to add                                                                                                                                                                                                                     |
| `data-next-quantity`          | How many of it. Default `1`                                                                                                                                                                                                            |
| `data-next-selector-id`       | In place of a package: put the picked card of that [bundle selector](../bundles/data-next-bundle-selector.md) in the cart, with its vouchers and shipping method. Without a picked card the click does nothing and a warning is logged |
| `data-next-clear-cart="true"` | Empty the cart first                                                                                                                                                                                                                   |
| `data-next-url`               | The page to open next. Same-site links carry the visit's [URL parameters](../setup/url-parameters.md)                                                                                                                                  |

A button with neither `data-next-package-id` nor `data-next-selector-id` logs a warning.

## Set by the SDK

| On the button                      | When                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `aria-busy="true"`, `next-loading` | After a click with `data-next-url`, while the page opens; further clicks do nothing |

## Events

[cart.updated](/event-reference/carts/cart.updated), then [cart.added](/event-reference/carts/cart.added)
and [cart.calculating](/event-reference/carts/cart.calculating); see the
[Cart lifecycle](../../event-reference/carts/lifecycle.md).
