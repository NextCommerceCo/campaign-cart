# PackageSelectorEnhancer — Data Attributes

---

## Container (`data-next-package-selector`)

| Attribute | Value | Description |
|---|---|---|
| `data-next-package-selector` | — | Marks the container. Required. |
| `data-next-selector-id` | `"<id>"` | ID referenced by `AddToCartEnhancer` and upsell containers. Required when paired with a button. |
| `data-next-selection-mode` | `"swap"` / `"select"` | Defaults to `"swap"`. |
| `data-next-packages` | `'[…]'` | JSON array for auto-render mode (see [template.md](template.md)). |
| `data-next-package-template-id` | `"<id>"` | ID of a `<template>` element to use as the card template. |
| `data-next-package-template` | `"<html>"` | Inline card template string. |
| `data-next-include-shipping` | `"true"` | Include shipping cost in price calculation. |
| `data-next-upsell-context` | — | Enables upsell mode: no cart writes, prices use `?upsell=true`. |

---

## Card (`data-next-selector-card`)

| Attribute | Value | Description |
|---|---|---|
| `data-next-selector-card` | — | Marks a card element. |
| `data-next-package-id` | `"<id>"` | Package `ref_id`. Required. |
| `data-next-selected` | `"true"` | Pre-selects this card on init. |
| `data-next-quantity` | `"<n>"` | Initial quantity (default `1`). |
| `data-next-min-quantity` | `"<n>"` | Minimum quantity for inline controls (default `1`). |
| `data-next-max-quantity` | `"<n>"` | Maximum quantity for inline controls (default `999`). |
| `data-next-shipping-id` | `"<id>"` | Shipping method ID to set when this card is selected. |

---

## Inline quantity controls (inside a card)

| Attribute | Description |
|---|---|
| `data-next-quantity-increase` | Increment button |
| `data-next-quantity-decrease` | Decrement button |
| `data-next-quantity-display` | Displays the current quantity |

---

## Price slots (inside a card)

See [prices.md](prices.md) for full price slot reference.

| Attribute | Description |
|---|---|
| `data-next-package-price` | Formatted total price (default) |
| `data-next-package-price="compare"` | Retail / compare-at price |
| `data-next-package-price="savings"` | Savings amount |
| `data-next-package-price="savingsPercentage"` | Savings percentage |
| `data-next-package-price="subtotal"` | Formatted subtotal |
