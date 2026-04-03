# Attributes

## Container attributes

### `data-next-package-toggle`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Marks the container element (or the single toggle element in single-element mode). The enhancer activates on this element.

---

### `data-next-packages`

| | |
|---|---|
| Type | `string` (JSON array) |
| Required | no |
| Default | — |

A JSON array of package definition objects used in auto-render mode. Each object must include `packageId` (number). All other keys are available as `{toggle.<key>}` template variables. Set `"selected": true` on an entry to pre-select it on init.

Requires `data-next-toggle-template-id` or `data-next-toggle-template` to also be set.

**Valid values:** Valid JSON array. Invalid JSON is ignored with a warning log.

---

### `data-next-toggle-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

The `id` of a `<template>` element whose `innerHTML` is used as the card template in auto-render mode. Takes precedence over `data-next-toggle-template` if both are set.

---

### `data-next-toggle-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no |
| Default | — |

An inline HTML string used as the card template in auto-render mode. Use `data-next-toggle-template-id` when the template is more than a few elements.

---

### `data-next-include-shipping`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `"false"` |

Set to `"true"` to include shipping costs in the price calculation sent to `calculateBundlePrice`. When false, shipping is excluded from the preview price shown on cards not yet in the cart.

---

### `data-next-upsell-context`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

When present, switches the enhancer to post-purchase upsell mode. Clicks call `orderStore.addUpsell()` instead of `cartStore.addItem()`. The enhancer does not subscribe to `cartStore` in this mode.

---

## Card attributes

### `data-next-toggle-card`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes (on each card) |
| Default | — |

Marks an element as a toggle card within the container. The enhancer registers a click handler and tracks cart state for this element.

---

### `data-next-package-id`

| | |
|---|---|
| Type | `string` (integer) |
| Required | yes (on each card) |
| Default | — |

The `ref_id` of the package this card represents. Must match a package `ref_id` from the campaign store.

---

### `data-next-selected`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Set to `"true"` to auto-add this package to the cart when the enhancer initializes. Ignored if the package is already in the cart. Each package is auto-added at most once per page load.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `string` (integer) |
| Required | no |
| Default | `"1"` |

The quantity to add when this card is toggled in. Ignored when `data-next-package-sync` is set (the quantity is derived from the sync calculation instead).

---

### `data-next-package-sync`

| | |
|---|---|
| Type | `string` (comma-separated integers) |
| Required | no |
| Default | — |

A comma-separated list of `packageId` values to sync this card's quantity against. The card's quantity becomes the sum of all synced packages' quantities in the cart. The card is added when any synced package is in the cart, and removed when all are removed.

**Example:** `"101,102"` — quantity = (qty of 101) + (qty of 102)

---

### `data-next-is-upsell`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `"false"` |

Set to `"true"` to mark this card's package as an upsell/bump item in the cart. Affects how the cart line is classified. Also changes sync-mode removal behavior: sync removal is deferred 500 ms to avoid premature removal during package swaps.

---

### `data-add-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Button label when the package is not in the cart. Requires `data-remove-text` to also be set. The enhancer updates a `[data-next-button-text]` child element, or the element's own `textContent` if it has no child elements.

---

### `data-remove-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Button label when the package is in the cart. Requires `data-add-text` to also be set.

---

## Display system integration

Use `data-next-display="toggle.{packageId}.{property}"` on any element in the document to bind it to a specific toggle card's state. The element does not need to be inside the card or the container.

```html
<!-- These can go anywhere in the document -->
<span data-next-display="toggle.101.isSelected"></span>
<span data-next-display="toggle.101.price"></span>
<span data-next-display="toggle.101.discountAmount" data-hide-if-zero="true"></span>
<span data-next-display="toggle.101.discountPercentage"></span>
```

**Supported properties:**

| Property | Format | Description |
|---|---|---|
| `isSelected` | boolean | `true` when this card's package is currently in the cart |
| `name` | text | Display name from the campaign package |
| `price` | currency | Total price for the card's quantity (unit price × quantity) |
| `unitPrice` | currency | Per-unit price |
| `originalPrice` | currency | Retail / compare-at total price |
| `originalUnitPrice` | currency | Retail / compare-at per-unit price |
| `discountAmount` | currency | Savings amount (compare minus total) |
| `discountPercentage` | percentage | Savings as a percentage of the compare price |
| `hasDiscount` | boolean | `true` when a discount is applied |
| `isRecurring` | boolean | `true` when the package bills on a recurring schedule |
| `recurringPrice` | currency | Recurring charge total (quantity-scaled) |
| `interval` | text | Billing interval: `"day"` or `"month"` |
| `intervalCount` | auto | Number of intervals between billing cycles |
| `frequency` | text | Human-readable billing cadence: `"Per month"`, `"Every 3 months"`, `"One time"` |
| `currency` | text | ISO 4217 currency code |

Supports all standard display modifiers: `data-next-format`, `data-hide-if-zero`, `data-hide-if-false`.

---

## Price slot attributes

### `data-next-toggle-price`

| | |
|---|---|
| Type | `string` (variant) |
| Required | no |
| Default | `""` (total price) |

Marks an element as a price display slot. The enhancer populates it with a formatted price value.

**Valid values:**

| Value | Displays |
|---|---|
| `""` (empty / omitted) or `"price"` | Formatted total price for the card's quantity |
| `"unitPrice"` | Per-unit price |
| `"originalPrice"` | Retail / compare-at total price |
| `"originalUnitPrice"` | Retail / compare-at per-unit price |
| `"hasDiscount"` | `"true"` or `"false"` |
| `"discountAmount"` | Savings amount (compare price minus line price); empty if no discount |
| `"discountPercentage"` | Savings as a percentage (e.g. `"20%"`); empty if no discount |
| `"isRecurring"` | `"true"` or `"false"` |
| `"recurringPrice"` | Recurring charge total (quantity-scaled); empty if not recurring |
| `"interval"` | Billing interval: `"day"` or `"month"`; empty if not recurring |
| `"intervalCount"` | Number of intervals between billing cycles; empty if not recurring |
| `"frequency"` | Human-readable billing cadence: `"Per month"`, `"Every 3 months"`, `"One time"` |
| `"currency"` | ISO 4217 currency code |

Unrecognized values leave the element's content unchanged.

---

## Image slot attribute

### `data-next-toggle-image`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Place on an `<img>` element inside a card. The enhancer sets its `src` to the package image URL from the campaign store, and sets `alt` to the package name if no `alt` is already present.

---

## Upsell navigation attribute

### `data-next-url`

| | |
|---|---|
| Type | `string` (URL) |
| Required | no |
| Default | `meta[name="next-upsell-accept-url"]` content |

In upsell context, the URL to navigate to after a successful upsell add. Checked on the card element, then `stateContainer`, then the enhancer container, then a `<meta name="next-upsell-accept-url">` tag. The `ref_id` of the order is appended as a query parameter if not already present.
