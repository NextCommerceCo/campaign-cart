# BundleSelectorEnhancer — Variant Options Guide

Variants let a single product exist as multiple packages that differ by attributes
(size, color, material, etc.). The BundleSelector renders per-slot variant selectors
so the user can choose a variant without leaving the bundle page; selecting one
swaps the active package for that slot in the cart automatically.

---

## How variant options work

Every slot in a bundle maps to one product. If that product has packages with
`product_variant_attribute_values` (e.g. `[{code:"size",value:"M"}]`), the renderer
detects all unique attribute codes across those packages and builds a selector per
attribute.

### Selection flow

```
User picks an attribute value
  → handleVariantOptionClick / handleSelectVariantChange
    → applyVariantChange(card, slotIndex, selectedAttrs)
      → find matching package by attribute combination
      → slot.activePackageId = newPackageId
      → re-render slots (image, name, prices update)
      → [swap mode] applyEffectiveChange → cart items swapped in-place
      → fetchAndUpdateBundlePrice (debounced 150 ms)
```

Selecting a variant only replaces the package for **that slot**; other slots in the
same bundle card are untouched.

### Unavailable combinations

Before rendering each option the renderer calls `isVariantValueAvailable()`:
- Checks that at least one package exists with this value **plus** all other currently
  selected attribute values.
- Marks the option unavailable if no such package exists, or if every matching
  package has `product_purchase_availability === 'unavailable'`.

---

## Two-template composable system

There are two template levels, used independently or together:

| Attribute | Level | Renders |
|-----------|-------|---------|
| `data-next-variant-selector-template-id` | Per-attribute | The whole selector control once per attribute (e.g. the dropdown shell) |
| `data-next-variant-option-template-id` | Per-value | One item element per option value (e.g. each menu item or pill) |

**Fallback rules:**

| selector template | option template | Result |
|---|---|---|
| — | — | Default `<select>` per attribute |
| — | provided | Flat button/pill group per attribute |
| provided | — | Custom wrapper, options fall back to `<option>` elements |
| provided | provided | Full custom: wrapper + custom items |

---

## Mode 1 — Default `<select>` (zero configuration)

When neither template is provided the SDK renders a standard `<select>` per
attribute inside each slot's `[data-next-variant-selectors]` container.

```html
<div data-next-bundle-selector data-next-bundle-slot-template-id="slot-tpl">
  ...
</div>
```

Rendered output (inside each slot):

```html
<div data-next-variant-selectors>
  <div class="next-slot-variant-field">
    <label class="next-slot-variant-label">Size:</label>
    <select class="next-slot-variant-select" data-next-variant-code="size">
      <option value="S">S</option>
      <option value="M" selected>M</option>
      <option value="L" disabled>L</option>  <!-- unavailable -->
    </select>
  </div>
</div>
```

---

## Mode 2 — Custom per-option template (buttons, pills, swatches)

Provide only `data-next-variant-option-template-id`. The template renders once per
option value. The SDK groups all options for one attribute into a wrapper
`<div class="next-slot-variant-group">`.

```html
<div
  data-next-bundle-selector
  data-next-bundle-slot-template-id="slot-tpl"
  data-next-variant-option-template-id="variant-opt-tpl"
>
  ...
</div>

<template id="variant-opt-tpl">
  <!-- rendered once per option value -->
  <button class="variant-pill">{option.value}</button>
</template>
```

The SDK stamps these attributes onto each rendered option element automatically
(you do **not** need to write them in the template):

| Attribute | Set to |
|-----------|--------|
| `data-next-variant-option` | attribute code (e.g. `size`) |
| `data-next-variant-value` | option value (e.g. `M`) |
| `data-next-slot-index` | slot index |
| `data-next-bundle-id` | bundle card id |

CSS classes set at runtime:

| Class | Meaning |
|-------|---------|
| `next-variant-selected` | currently selected option |
| `next-variant-unavailable` | unavailable combination |

Runtime attributes set by the SDK:

| Attribute | Meaning |
|-----------|---------|
| `data-selected="true"` | currently selected |
| `data-next-unavailable="true"` | unavailable combination |

**Click handling** uses event delegation — `closest('[data-next-variant-option]')` —
so the template's root element must be the clickable target.

---

## Mode 3 — Custom selector wrapper (dropdown shell)

Provide only `data-next-variant-selector-template-id`. The template renders once
per attribute. Place `[data-next-variant-options]` inside the template where the
SDK should inject option items (falls back to `<option>` elements if no option
template is provided).

```html
<template id="variant-selector-tpl">
  <div class="variant-dropdown">
    <button class="variant-toggle">
      {attr.name}: <span data-next-variant-selected-value>{attr.selectedValue}</span>
    </button>
    <div class="variant-menu">
      <div data-next-variant-options></div>  <!-- options injected here -->
    </div>
  </div>
</template>
```

### Selector template variables

| Variable | Description |
|----------|-------------|
| `{attr.code}` | Attribute code, e.g. `size`, `color` |
| `{attr.name}` | Attribute display name, e.g. `Size`, `Color` |
| `{attr.selectedValue}` | Currently selected raw value |
| `{attr.selectedName}` | Currently selected display name |

The SDK sets `data-next-variant-code`, `data-next-bundle-id`, and
`data-next-slot-index` on the rendered selector root element automatically.

---

## Mode 4 — Full custom: wrapper + items

Provide both templates. The selector template wraps the attribute group; the option
template fills `[data-next-variant-options]` inside it.

```html
<div
  data-next-bundle-selector
  data-next-bundle-slot-template-id="slot-tpl"
  data-next-variant-selector-template-id="variant-selector-tpl"
  data-next-variant-option-template-id="variant-opt-tpl"
>
  ...
</div>

<!-- Per-attribute: renders once for "color", once for "size" -->
<template id="variant-selector-tpl">
  <div class="variant-dropdown">
    <button class="variant-toggle">
      {attr.name}: <span data-next-variant-selected-value>{attr.selectedValue}</span>
    </button>
    <div class="variant-menu">
      <div data-next-variant-options></div>
    </div>
  </div>
</template>

<!-- Per-value: renders once per option -->
<template id="variant-opt-tpl">
  <div class="variant-menu-item">{option.value}</div>
</template>
```

### Example — `os-dropdown` web component

```html
<template id="variant-selector-tpl">
  <os-dropdown class="os-variant-dropdown">
    <button class="os-card__variant-dropdown-toggle">
      <div class="os-card__toggle-option">
        <div class="os-card__variant-toggle-name">{attr.selectedValue}</div>
      </div>
      <div class="os-card__variant-dropdown-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"/>
        </svg>
      </div>
    </button>
    <os-dropdown-menu class="os-card__variant-dropdown-menu-v2">
      <div data-next-variant-options></div>
    </os-dropdown-menu>
  </os-dropdown>
</template>

<template id="variant-opt-tpl">
  <os-dropdown-item class="os-card__variant-dropdown-item">
    <div class="os-card__toggle-option">
      <div class="os-card__variant-toggle-info">
        <div class="os-card__variant-toggle-name">{option.value}</div>
      </div>
    </div>
  </os-dropdown-item>
</template>
```

### Example — color swatch selector

```html
<template id="variant-selector-tpl">
  <div class="swatch-group">
    <div class="swatch-label">{attr.name}: <strong>{attr.selectedValue}</strong></div>
    <div class="swatch-options" data-next-variant-options></div>
  </div>
</template>

<template id="variant-opt-tpl">
  <button class="swatch" title="{option.name}">{option.value}</button>
</template>
```

---

## Option template variables

Available in `data-next-variant-option-template-id`:

| Variable | Description |
|----------|-------------|
| `{attr.code}` | Attribute code, e.g. `size`, `color` |
| `{attr.name}` | Attribute display name, e.g. `Size`, `Color` |
| `{option.value}` | Raw option value, e.g. `M`, `Red` |
| `{option.name}` | Display name for the option value |
| `{option.selected}` | `'true'` or `'false'` — initial selection state |
| `{option.available}` | `'true'` or `'false'` — whether this combo is purchasable |

---

## Slot template

Each slot is rendered from `data-next-bundle-slot-template-id`. Place
`[data-next-variant-selectors]` where you want the variant selectors injected.

```html
<template id="slot-tpl">
  <div class="slot">
    <img src="{item.image}" alt="{item.name}" />
    <span>{item.name}</span>
    <span>{item.price}</span>
    <div data-next-variant-selectors></div>
  </div>
</template>
```

### Slot template variables

#### Position

| Variable | Description |
|----------|-------------|
| `{slot.index}` | 1-based position in the slots array |
| `{slot.unitIndex}` | 0-based unit within this product (configurable qty > 1) |
| `{slot.unitNumber}` | 1-based unit number |

#### Package / product

| Variable | Description |
|----------|-------------|
| `{item.packageId}` | Active package ID |
| `{item.name}` | Package name |
| `{item.image}` | Primary image URL |
| `{item.quantity}` | Quantity in the bundle |
| `{item.variantName}` | Variant label, e.g. `M / Red` |
| `{item.productName}` | Base product name |
| `{item.sku}` | SKU |

#### Prices

| Variable | Description |
|----------|-------------|
| `{item.price}` | Formatted unit sale price |
| `{item.priceRetail}` | Formatted retail/compare price |
| `{item.priceTotal}` | Formatted total for this slot (price × qty) |
| `{item.unitPrice}` | Formatted per-unit price (from preview if available) |
| `{item.packagePrice}` | Formatted package price |
| `{item.subtotal}` | Formatted subtotal from price preview |
| `{item.total}` | Formatted total from price preview |
| `{item.totalDiscount}` | Formatted discount amount from preview |

#### Discount helpers

| Variable | Value | Use |
|----------|-------|-----|
| `{item.hasDiscount}` | `'show'` or `'hide'` | Toggle CSS `display` |
| `{item.hasSavings}` | `'show'` or `'hide'` | Toggle CSS `display` |

---

## Bundle card template

Provide `data-next-bundle-template-id` and `data-next-bundles` (JSON) so the SDK
renders cards from data.

```html
<div
  data-next-bundle-selector
  data-next-bundle-template-id="bundle-card-tpl"
  data-next-bundle-slot-template-id="slot-tpl"
  data-next-variant-selector-template-id="variant-selector-tpl"
  data-next-variant-option-template-id="variant-opt-tpl"
  data-next-bundles='[
    {"id":"starter","items":[{"packageId":10,"quantity":1}]},
    {"id":"pro","items":[{"packageId":11,"quantity":1},{"packageId":12,"quantity":1}]}
  ]'
>
</div>

<template id="bundle-card-tpl">
  <div data-next-bundle-card>
    <h3>{bundle.name}</h3>
    <div data-next-bundle-slots></div>
    <span data-next-bundle-price></span>
    <span data-next-bundle-price="compare"></span>
    <span data-next-bundle-price="savings"></span>
    <span data-next-bundle-price="savingsPercentage"></span>
  </div>
</template>
```

Any field in the `BundleDef` JSON is available as `{bundle.<field>}`.

### `data-next-bundle-price` values

| Value | Shows |
|-------|-------|
| _(absent)_ | Total |
| `subtotal` | Pre-discount subtotal |
| `compare` | Retail / compare-at total |
| `savings` | Absolute savings amount |
| `savingsPercentage` | Percentage saved |

---

## `BundleItem` flags

```ts
interface BundleItem {
  packageId: number;
  quantity: number;
  configurable?: boolean; // expand qty > 1 into separate selectable slots
  noSlot?: boolean;       // add to cart but render no slot UI
}
```

---

## Common mistakes

**Variant selectors not appearing** — the product's packages must have
`product_variant_attribute_values` populated. If none do, no selector renders.

**Wrong package after variant change** — the SDK matches by all attribute values
simultaneously. Every combination you expect must map to exactly one package.

**Custom option not responding to clicks** — the SDK sets `data-next-variant-option`
on the template's root element and uses `closest('[data-next-variant-option]')`
delegation. The root element must be the clickable target; clicking a deeply nested
child will still bubble up and be caught correctly.

**`[data-next-variant-options]` placeholder missing** — when using a selector
template, if the placeholder is absent the SDK has nowhere to inject items and
the selector renders empty.

**Cart not updating on variant change in select mode** — in `select` mode the cart
is not updated until the add-to-cart button is clicked. Use `swap` mode
(`data-next-selection-mode="swap"`) for instant cart sync.
