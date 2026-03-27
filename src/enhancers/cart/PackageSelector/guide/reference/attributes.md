# Attributes

## Container attributes

---

### `data-next-package-selector`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Marks the element as a package selector container and triggers enhancer instantiation by `AttributeScanner`. Must be on the outermost container element.

---

### `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Unique identifier for this selector instance. Other enhancers (`AddToCartEnhancer`, `AcceptUpsellEnhancer`, display enhancers) use this value to look up the selector and read the current selection.

**Valid values:** Any non-empty string. Must be unique on the page if multiple selectors are present.

---

### `data-next-selection-mode`

| | |
|---|---|
| Type | `'swap' \| 'select'` |
| Required | no |
| Default | `'swap'` |

Controls whether clicking a card immediately writes to the cart.

- `swap`: card click adds or swaps the package in the cart automatically.
- `select`: card click only updates visual state. An external `AddToCartEnhancer` button performs the cart write.

Forced to `'select'` when `data-next-upsell-context` is present.

---

### `data-next-upsell-context`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | absent |

Marks the selector as part of a post-purchase upsell flow. Disables all cart store operations. Forces `data-next-selection-mode` to `'select'`. Prices are fetched with the `upsell=true` flag so the API can apply upsell-specific pricing.

---

### `data-next-include-shipping`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `'false'` |

When `'true'`, shipping cost is included in the price calculation sent to the bundle price API and reflected in the `[data-next-package-price]` slots.

---

### `data-next-packages`

| | |
|---|---|
| Type | `JSON string` (array of package definition objects) |
| Required | no (auto-render only) |
| Default | — |

JSON array of package definition objects used to auto-render cards. Each object must contain at least `"packageId"`. Additional keys are exposed as `{package.key}` template variables.

```html
data-next-packages='[{"packageId":101,"selected":true},{"packageId":102},{"packageId":103}]'
```

**Valid values:** A valid JSON array. Non-array values are ignored with a warning.

---

### `data-next-package-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no (auto-render only) |
| Default | — |

ID of a `<template>` element whose `innerHTML` is used as the card template for auto-rendering. Takes precedence over `data-next-package-template` if both are present.

---

### `data-next-package-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no (auto-render only) |
| Default | — |

Inline HTML string used as the card template for auto-rendering. Used when `data-next-package-template-id` is not set.

---

### `data-selected-package` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (package ID) |
| Set by | enhancer |
| Default | — |

Written by the enhancer whenever the selection changes. Contains the `packageId` of the currently selected card as a string. Read by `AddToCartEnhancer` and display enhancers as a fallback when `_getSelectedItem()` is unavailable.

---

### `data-next-loading` *(set by enhancer)*

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Set by | enhancer |
| Default | — |

Set to `'true'` on the container while price data is being fetched, and `'false'` when the fetch completes. Use this attribute in CSS to show a loading indicator.

---

## Card attributes

---

### `data-next-selector-card`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes (per card) |
| Default | — |

Marks an element as a card within the selector container. The enhancer scans for this attribute on init and on DOM mutations.

---

### `data-next-package-id`

| | |
|---|---|
| Type | `string` (integer) |
| Required | yes (per card) |
| Default | — |

The `ref_id` of the package this card represents. Must be a valid integer. Cards with a missing or non-integer value are skipped with a warning.

---

### `data-next-selected`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `'false'` |

Marks a card as the pre-selected option on init. Only the first card with `data-next-selected="true"` is used; subsequent ones are ignored. Also written by the enhancer at runtime to reflect the current selection.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `string` (integer) |
| Required | no |
| Default | `'1'` |

Initial quantity for this card. Also written back by the enhancer when inline quantity controls change the value.

---

### `data-next-min-quantity`

| | |
|---|---|
| Type | `string` (integer) |
| Required | no |
| Default | `'1'` |

Minimum quantity the user can set via inline quantity controls. The decrease button is disabled when the current quantity equals this value.

---

### `data-next-max-quantity`

| | |
|---|---|
| Type | `string` (integer) |
| Required | no |
| Default | `'999'` |

Maximum quantity the user can set via inline quantity controls. The increase button is disabled when the current quantity equals this value.

---

### `data-next-shipping-id`

| | |
|---|---|
| Type | `string` (integer) |
| Required | no |
| Default | — |

Shipping method ID to apply when this card is selected. Parsed as an integer and passed to `cartStore.setShippingMethod()`. Only applied in swap mode. Invalid (non-integer) values are logged as a warning and ignored.

---

### `data-next-in-cart` *(set by enhancer)*

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Set by | enhancer |
| Default | — |

Written by the enhancer to reflect whether this card's package is currently in the cart. Use in CSS to show an "in cart" indicator.

---

## Price slot attributes

The following attributes are placed on elements inside a card. The enhancer writes formatted prices into these elements after fetching from the bundle price API.

---

### `data-next-package-price`

| | |
|---|---|
| Type | `string` (price variant key) |
| Required | no |
| Default | total price when attribute value is absent |

**Valid values:**

| Value | Displays |
|-------|----------|
| *(no value / empty)* | Total price for this package at the current quantity |
| `compare` | Retail / compare-at price before discounts |
| `savings` | Discount amount (compare price minus total price) |
| `savingsPercentage` | Discount as a percentage of the compare price |
| `subtotal` | Subtotal before shipping and discounts |

---

## Inline quantity control attributes

Optional within a card. The enhancer wires up these elements automatically if present.

---

### `data-next-quantity-increase`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Button that increments the card's quantity by 1. Disabled (via `disabled` attribute and `next-disabled` class) when quantity equals `data-next-max-quantity`.

---

### `data-next-quantity-decrease`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Button that decrements the card's quantity by 1. Disabled when quantity equals `data-next-min-quantity`.

---

### `data-next-quantity-display`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Element whose text content is updated to reflect the current quantity value.
