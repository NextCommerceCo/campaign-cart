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

When `'true'`, shipping cost is included in the price calculation and reflected in `[data-next-bundle-price]` elements.

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

Written by the enhancer whenever the selection changes. Contains the `bundleId` of the currently selected card. Read by external enhancers and CSS attribute selectors.

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

Unique identifier for this bundle card. Used to tag cart items with `bundleId` so the enhancer can strip the right items during a swap. Must be unique across all bundle cards in the same selector.

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

### `data-next-selected`

| | |
|---|---|
| Type | `'true' \| 'false'` |
| Required | no |
| Default | `'false'` |

Pre-marks a card as selected on init. The first card with `data-next-selected="true"` is selected; subsequent ones are ignored. Also written by the enhancer at runtime to reflect the current selection.

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

## Price display attributes

---

### `data-next-bundle-price`

| | |
|---|---|
| Type | `string` (price variant key) |
| Required | no |
| Default | `'total'` when attribute value is absent |

Placed on elements inside a bundle card. The enhancer writes a formatted price string into the element after each price fetch.

**Valid values:**

| Value | Displays |
|-------|----------|
| *(no value / empty)* | Total price for the bundle |
| `subtotal` | Subtotal before shipping and discounts |
| `compare` | Retail / compare-at price (from `price_retail` on campaign packages) |
| `savings` | Discount amount (compare price minus total) |
| `savingsPercentage` | Discount as a percentage of the compare price |

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
