# Attributes

## Container attributes

---

### `data-next-bundle-selector`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Marks the element as a bundle selector container and triggers enhancer instantiation by `AttributeScanner`. Must be on the outermost container element.

---

### `data-next-selection-mode`

| | |
|---|---|
| Type | `'swap' \| 'select'` |
| Required | no |
| Default | `'swap'` |

Controls whether clicking a card immediately writes to the cart.

- `swap`: card click atomically replaces the previous bundle's cart items with the new bundle's items.
- `select`: card click only updates visual state. An external action (e.g., `AddToCartEnhancer`) performs the cart write.

---

### `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Unique identifier for this selector instance. Used by external enhancers (e.g., `AddToCartEnhancer`) to look up this selector and read the current selection via `data-selected-bundle`.

---

### `data-next-include-shipping`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `'false'` |

When `'true'`, shipping cost is included in the price calculation and reflected in `[data-next-bundle-display]` elements.

---

### `data-next-bundles`

| | |
|---|---|
| Type | `JSON string` (array of bundle definition objects) |
| Required | no (auto-render only) |
| Default | — |

JSON array of bundle definitions used to auto-render cards. Each object must contain at least `"id"` and `"items"`. Additional keys are available as `{bundle.key}` in the card template. Requires `data-next-bundle-template-id` or `data-next-bundle-template` to be set.

```html
data-next-bundles='[
  {"id":"starter","title":"Starter","items":[{"packageId":101,"quantity":1}]},
  {"id":"value","title":"Value Pack","items":[{"packageId":101,"quantity":3}]}
]'
```

**Valid values:** A valid JSON array. Non-array values and invalid JSON are ignored with a warning.

---

### `data-next-bundle-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no (auto-render only) |
| Default | — |

ID of a `<template>` element whose `innerHTML` is used as the card template for auto-rendering. Takes precedence over `data-next-bundle-template` if both are present.

---

### `data-next-bundle-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no (auto-render only) |
| Default | — |

Inline HTML string used as the card template for auto-rendering. Used when `data-next-bundle-template-id` is not set.

---

### `data-next-bundle-slot-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

ID of a `<template>` element whose `innerHTML` is used to render individual product slots within a bundle card. When set, `[data-next-bundle-slots]` placeholders inside card elements are replaced with rendered slots. Takes precedence over `data-next-bundle-slot-template`.

---

### `data-next-bundle-slot-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no |
| Default | — |

Inline HTML string used as the slot template. Used when `data-next-bundle-slot-template-id` is not set.

---

### `data-next-variant-option-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

ID of a `<template>` element used to render individual variant option elements (e.g., color swatches, size buttons). When set, the default `<select>` dropdown is replaced with custom option elements rendered from this template.

Template variables: `{attr.code}`, `{attr.name}`, `{option.value}`, `{option.selected}`, `{option.available}`.

---

### `data-next-variant-selector-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

ID of a `<template>` element used to render the outer wrapper for a single variant attribute (e.g., a labeled group). When set alongside `data-next-variant-option-template-id`, the wrapper is rendered first and option elements are injected into `[data-next-variant-options]` inside it.

Template variables: `{attr.code}`, `{attr.name}`, `{attr.selectedValue}`.

---

### `data-next-class-*` *(CSS class overrides)*

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | see below |

Overrides the default CSS class names used by the enhancer. Available overrides:

| Attribute | Default class |
|---|---|
| `data-next-class-bundle-card` | `next-bundle-card` |
| `data-next-class-selected` | `next-selected` |
| `data-next-class-in-cart` | `next-in-cart` |
| `data-next-class-variant-selected` | `next-variant-selected` |
| `data-next-class-variant-unavailable` | `next-variant-unavailable` |
| `data-next-class-bundle-slot` | `next-bundle-slot` |
| `data-next-class-slot-variant-group` | `next-slot-variant-group` |

---

### `data-selected-bundle` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (bundle ID) |
| Set by | enhancer |
| Default | — |

Written by the enhancer whenever the selection changes. Contains the `bundleId` of the currently selected card (from `data-next-bundle-id`). Read by external enhancers and CSS attribute selectors.

---

## Bundle card attributes

---

### `data-next-bundle-card`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes (per card) |
| Default | — |

Marks an element as a bundle card within the selector. The enhancer scans for this attribute on init and on DOM mutations.

---

### `data-next-bundle-id`

| | |
|---|---|
| Type | `string` |
| Required | yes (per card) |
| Default | — |

Unique identifier for this bundle card. Used internally for variant group lookups. Must be unique across all bundle cards in the same selector. Cart items are tagged with the selector's `data-next-selector-id` (not this value) — see `data-next-selector-id`.

---

### `data-next-bundle-items`

| | |
|---|---|
| Type | `JSON string` (array of `BundleItem` objects) |
| Required | yes (per card) |
| Default | — |

Defines the packages and quantities that make up this bundle.

```html
data-next-bundle-items='[
  {"packageId":101,"quantity":1},
  {"packageId":205,"quantity":1,"noSlot":true}
]'
```

See [object-attributes.md](./object-attributes.md) for the full `BundleItem` shape.

---

### `data-next-bundle-vouchers`

| | |
|---|---|
| Type | `JSON array string` or comma-separated string |
| Required | no |
| Default | — |

Voucher/coupon codes to apply automatically when this bundle is selected and remove when it is deselected.

```html
data-next-bundle-vouchers='["SAVE10","FREESHIP"]'
<!-- or -->
data-next-bundle-vouchers="SAVE10,FREESHIP"
```

---

### `data-next-bundle-name`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Human-readable display name for the bundle. When set, it is exposed as the `name` property in `data-next-display="bundle.{selectorId}.name"` elements anywhere in the document.

```html
<div data-next-bundle-card data-next-bundle-id="value" data-next-bundle-name="Value Pack" ...>
```

---

### `data-next-selected`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `'false'` |

Pre-marks a card as selected on init. Only the **first** card with `data-next-selected="true"` is selected — subsequent ones are ignored. If no card has this attribute, the enhancer auto-selects the first registered card and logs a warning. Also written by the enhancer at runtime to reflect the current selection.

---

### `data-next-in-cart` *(set by enhancer)*

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Set by | enhancer |
| Default | — |

Set to `'true'` when all of the bundle's effective items are present in the cart at or above their required quantities. Use in CSS to show an "in cart" indicator.

---

### `data-next-loading` *(set by enhancer)*

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Set by | enhancer |
| Default | — |

Set to `'true'` on a bundle card while its price is being fetched. Use in CSS to show a loading indicator.

---

### `data-next-bundle-slots`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Placeholder element inside a bundle card where slot rows are injected. Required when `data-next-bundle-slot-template-id` is configured. Its `innerHTML` is replaced on every cart update.

---

### `data-bundle-price-total` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (float) |
| Set by | enhancer (after price fetch) |
| Default | — |

Raw numeric total price written to the card element after each price fetch. Read by `BundleDisplayEnhancer` to populate `data-next-display="bundle.{selectorId}.price"` elements.

---

### `data-bundle-price-compare` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (float) |
| Set by | enhancer (after price fetch) |
| Default | — |

Raw numeric retail / compare-at price. Empty string when no compare price is available.

---

### `data-bundle-price-savings` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (float) |
| Set by | enhancer (after price fetch) |
| Default | — |

Raw numeric savings amount (compare minus total). `0` when there are no savings.

---

### `data-bundle-price-savings-pct` *(set by enhancer)*

| | |
|---|---|
| Type | `string` (float) |
| Set by | enhancer (after price fetch) |
| Default | — |

Raw numeric savings percentage (0–100). `0` when there are no savings.

---

## External slots container

---

### `data-next-bundle-slots-for`

| | |
|---|---|
| Type | `string` (selector ID) |
| Required | no |
| Default | — |

Marks an element outside the selector container as a target for slot rendering. The value must match `data-next-selector-id` on the container. When set, slots for the currently selected bundle are rendered here instead of (or in addition to) the inline `[data-next-bundle-slots]` placeholder.

---

## Display system integration

Use `data-next-display="bundle.{selectorId}.{property}"` on any element in the document to bind it to a bundle selector's current state. The value of `{selectorId}` must match `data-next-selector-id` on the selector container. The element does not need to be inside the selector container.

```html
<span data-next-display="bundle.upsellBundleMV.price"></span>
<span data-next-display="bundle.upsellBundleMV.isSelected"></span>
<span data-next-display="bundle.upsellBundleMV.savings" data-hide-if-zero="true"></span>
```

**Supported properties:**

| Property | Format | Description |
|---|---|---|
| `isSelected` | boolean | `true` when this bundle card is the currently selected card |
| `name` | text | Value of `data-next-bundle-name` on the card element |
| `price` | currency | Total price for the bundle after all discounts |
| `originalPrice` | currency | Retail / compare-at price (subtotal before discount) |
| `discountAmount` | currency | Total discount applied to the bundle |
| `discountPercentage` | percentage | Discount as a percentage of the original price |
| `hasDiscount` | boolean | `true` when a discount is applied to the bundle |
| `unitPrice` | currency | *(coming soon — not yet implemented)* |
| `originalUnitPrice` | currency | *(coming soon — not yet implemented)* |

**Deprecated properties** (still supported for backwards compatibility):

| Property | Use instead |
|---|---|
| `compare` | `originalPrice` |
| `savings` | `discountAmount` |
| `savingsPercentage` | `discountPercentage` |
| `hasSavings` | `hasDiscount` |

Supports all standard display modifiers: `data-next-format`, `data-hide-if-zero`, `data-hide-if-false`.

---

## Display attributes

---

### `data-next-bundle-display`

| | |
|---|---|
| Type | `string` (field name) |
| Required | no |
| Default | `'price'` when attribute value is absent |

Placed on elements inside a bundle card. The enhancer writes the formatted field value into the element after each price fetch.

**Supported fields:**

| Field | Format | Description |
|-------|--------|-------------|
| `price` | currency | Total price after all discounts |
| `total` | currency | Alias for `price` |
| `originalPrice` | currency | Retail / compare-at price before discount |
| `compare` | currency | Alias for `originalPrice` |
| `discountAmount` | currency | Total discount applied to the bundle |
| `savings` | currency | Alias for `discountAmount` |
| `unitPrice` | currency | Total price divided by total visible quantity |
| `originalUnitPrice` | currency | Original price divided by total visible quantity |
| `discountPercentage` | percentage | Discount as a percentage of the original price |
| `savingsPercentage` | percentage | Alias for `discountPercentage` |
| `hasDiscount` | boolean | Element is shown when a discount is applied; hidden otherwise |
| `hasSavings` | boolean | Alias for `hasDiscount` |
| `isSelected` | boolean | Element is shown when this bundle card is selected; hidden otherwise |
| `name` | text | Value of `data-next-bundle-name` on the card element |

---

### `data-next-bundle-price` *(deprecated)*

| | |
|---|---|
| Type | `string` (price variant key) |
| Required | no |
| Default | `'total'` when attribute value is absent |

Deprecated. Use `data-next-bundle-display` instead. Still supported for backward compatibility.

| Value | Use instead |
|-------|-------------|
| *(no value / empty)* | `data-next-bundle-display="price"` |
| `total` | `data-next-bundle-display="price"` |
| `compare` | `data-next-bundle-display="originalPrice"` |
| `savings` | `data-next-bundle-display="discountAmount"` |
| `savingsPercentage` | `data-next-bundle-display="discountPercentage"` |

---

## Slot template placeholders

The following attributes are used inside slot templates or rendered by the enhancer into slot elements.

---

### `data-next-variant-selectors`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Placeholder inside a slot template element where variant attribute controls are injected (select dropdowns or custom option elements). If the slot's package has no variant attributes, this placeholder is left empty.

---

### `data-next-variant-option`

| | |
|---|---|
| Type | `string` (attribute code) |
| Set by | enhancer (on custom option elements) |
| Default | — |

Set on custom variant option elements rendered from `data-next-variant-option-template-id`. Value is the attribute code (e.g., `color`). Used by the delegated click handler to identify which attribute the option controls.

---

### `data-next-variant-value`

| | |
|---|---|
| Type | `string` |
| Set by | enhancer (on custom option elements) |
| Default | — |

Set on custom variant option elements. Value is the attribute value this option represents (e.g., `red`).
