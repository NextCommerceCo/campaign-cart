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

ID of a `<template>` element whose `innerHTML` is used as the card template for auto-rendering. Highest precedence — takes priority over `data-next-bundle-template` and any inline `<template>` child.

---

### `data-next-bundle-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no (auto-render only) |
| Default | — |

Inline HTML string used as the card template for auto-rendering. Used when `data-next-bundle-template-id` is not set.

---

### Inline `<template>` child *(card template)*

As a third option, place a direct `<template>` child inside the bundle selector container. The enhancer reads its `innerHTML` when neither `data-next-bundle-template-id` nor `data-next-bundle-template` is set.

```html
<div data-next-bundle-selector data-next-bundles='[...]'>
  <template>
    <div data-next-bundle-card data-next-bundle-id="{bundle.id}">...</div>
  </template>
</div>
```

Resolution order (highest precedence first): `data-next-bundle-template-id` → `data-next-bundle-template` → direct `<template>` child.

---

### `data-next-bundle-slot-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

ID of a `<template>` element whose `innerHTML` is used to render individual product slots within a bundle card. When set, `[data-next-bundle-slots]` placeholders inside card elements are replaced with rendered slots. Highest precedence — takes priority over `data-next-bundle-slot-template` and any inline `<template>` child of the external slots container.

---

### `data-next-bundle-slot-template`

| | |
|---|---|
| Type | `string` (HTML) |
| Required | no |
| Default | — |

Inline HTML string used as the slot template. Used when `data-next-bundle-slot-template-id` is not set.

---

### Inline `<template>` child *(slot template)*

When an external slots container (`[data-next-bundle-slots-for="{selectorId}"]`) is present, its direct `<template>` child is used as the slot template when neither `data-next-bundle-slot-template-id` nor `data-next-bundle-slot-template` is set.

```html
<div data-next-bundle-slots-for="main">
  <template>
    <div class="slot">
      <img src="{item.image}">
      <span>{item.unitPrice}</span>
      <div data-next-variant-selectors>
        <template><!-- variant-selector template (see below) --></template>
      </div>
    </div>
  </template>
</div>
```

Resolution order (highest precedence first): `data-next-bundle-slot-template-id` → `data-next-bundle-slot-template` → direct `<template>` child of the external slots container.

Nested `<template>` elements inside the slot template are auto-extracted:

- `[data-next-variant-selectors] > template` → populates the variant-selector template when `data-next-variant-selector-template-id` is not set.
- Inside that variant-selector template, `[data-next-variant-options] > template` → populates the variant-option template when `data-next-variant-option-template-id` is not set.

Extracted templates are stripped from the slot HTML so they don't render inline.

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

### `data-next-shipping-id`

| | |
|---|---|
| Type | `string` (shipping method ref_id) |
| Required | no |
| Default | — |

Shipping method to auto-apply when this bundle is selected in swap mode. The value must be a valid `ref_id` from `campaignStore.data.shipping_methods`. When set, selecting this card calls `cartStore.setShippingMethod(id)` after the bundle items are written to the cart.

Not applied in upsell context or select mode — shipping is only set after a successful cart write.

```html
<div data-next-bundle-card
     data-next-bundle-id="premium"
     data-next-bundle-items='[{"packageId":101,"quantity":1}]'
     data-next-shipping-id="5">
</div>
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
| `unitPrice` | currency | Bundle total price divided by total visible slot quantity |
| `originalUnitPrice` | currency | Original (pre-discount) price divided by total visible slot quantity |

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

---

### `data-next-show` / `data-next-hide` *(inside slot templates)*

| | |
|---|---|
| Type | `string` (slot variable key) |
| Required | no |
| Default | — |

Toggles element visibility based on a slot template variable's value.

- `data-next-show`: element is visible when the variable is truthy, hidden when falsy.
- `data-next-hide`: element is hidden when the variable is truthy, visible when falsy.

**Truthy values:** `"show"`, `"true"`, or any non-empty string that is not `"hide"` or `"false"`.
**Falsy values:** `"hide"`, `"false"`, `""` (empty string), or missing key.

Only slot-local variables (`item.*`, `slot.*`) are processed. Store-based conditions (e.g., `cart.hasCoupon`) are left untouched for the global `ConditionalDisplayEnhancer`.

Processed attributes are removed from the element after evaluation to prevent the `ConditionalDisplayEnhancer` from re-processing them.

```html
<template id="slot-tpl">
  <div class="slot-row">
    <span>{item.name} — {item.price}</span>
    <div data-next-show="item.hasDiscount">
      Save {item.discountPercentage}! <del>{item.originalPrice}</del>
    </div>
    <div data-next-hide="item.isRecurring">One-time purchase</div>
    <div data-next-show="item.isRecurring">Billed {item.frequency}</div>
  </div>
</template>
```

---

## Inline bundle-quantity controls

These attributes let the visitor change the **bundle's** quantity at runtime via a stepper, with an automatic price refetch on each change. The new quantity is a multiplier — it applies to every effective item the bundle sends to the cart, without expanding the slot list. A `configurable` item with `quantity: 1` and `bundleQuantity: 5` still renders one slot (one variant pick) and adds five units of the chosen variant to the cart.

Defaults preserve pre-existing behavior: if none of these attributes are set, `bundleQuantity` is `1` and no stepper wiring runs.

### Card-level

---

### `data-next-quantity`

| | |
|---|---|
| Type | `string` (integer ≥ 1) |
| Required | no |
| Default | `'1'` |

Initial bundle quantity. Clamped into `[data-next-min-quantity, data-next-max-quantity]` on init. Written back by the enhancer when the stepper changes the value.

---

### `data-next-min-quantity`

| | |
|---|---|
| Type | `string` (integer ≥ 1) |
| Required | no |
| Default | `'1'` |

Minimum bundle quantity. The decrease button is disabled when the current quantity equals this value. `0` is not allowed — removing the bundle is the job of a separate action.

---

### `data-next-max-quantity`

| | |
|---|---|
| Type | `string` (integer ≥ 1) |
| Required | no |
| Default | `'999'` |

Maximum bundle quantity. The increase button is disabled when the current quantity equals this value.

---

### Stepper elements

The enhancer looks for these three elements inside, in order:

1. The bundle card element (`[data-next-bundle-card]`)
2. The external slots container (`[data-next-bundle-slots-for="{selectorId}"]`)
3. Any element marked `[data-next-bundle-qty-for="{selectorId}"]` — useful when the stepper lives entirely outside the card, e.g. next to an Add-to-Cart button on a product-detail page

All three lookups are combined; displays and buttons can coexist across locations.

---

### `data-next-quantity-increase`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Button that increments the card's `bundleQuantity` by 1. Disabled (via `disabled` attribute and the `next-disabled` class) when quantity equals `data-next-max-quantity`.

---

### `data-next-quantity-decrease`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Button that decrements the card's `bundleQuantity` by 1. Disabled when quantity equals `data-next-min-quantity`.

---

### `data-next-quantity-display`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | no |
| Default | — |

Element whose `textContent` is kept in sync with the current `bundleQuantity`.

---

### `data-next-bundle-qty-for`

| | |
|---|---|
| Type | `string` (selector ID) |
| Required | no |
| Default | — |

Marks an element outside the selector (and outside the external slots container) as a stepper host for this selector. Must match `data-next-selector-id` on the selector container.

```html
<div hidden data-next-selector-id="main" data-next-bundle-selector ...></div>

<div data-next-bundle-qty-for="main">
  <button data-next-quantity-decrease>−</button>
  <span data-next-quantity-display>1</span>
  <button data-next-quantity-increase>+</button>
</div>
```

---

### Auto-render fields (`BundleDef`)

When using `data-next-bundles` (JSON) auto-render, the following optional fields on each bundle object are mirrored onto the rendered card's `data-next-*` attributes:

- `quantity` → `data-next-quantity`
- `minQuantity` → `data-next-min-quantity`
- `maxQuantity` → `data-next-max-quantity`

```html
data-next-bundles='[
  {
    "id":"tshirt",
    "items":[{"packageId":1,"quantity":1,"configurable":true}],
    "quantity":1,
    "minQuantity":1,
    "maxQuantity":10,
    "selected":true
  }
]'
```
