# Object Attributes

## `BundleItem`

One product entry in a bundle definition. Declares which package to add to the cart and how many.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `packageId` | `number` | no | The `ref_id` of the campaign package to add |
| `quantity` | `number` | no | Number of units of this package in the bundle |
| `configurable` | `boolean` | yes | When `true` and `quantity > 1`, expands into individual slots so the visitor can pick a different variant per unit. Absent or `false` means all units share the same variant |
| `noSlot` | `boolean` | yes | When `true`, the item is added to the cart silently with no slot row rendered. Used for free gifts or hidden add-ons |

---

## `BundleDef`

The shape of each object in the `data-next-bundles` JSON array. Used for auto-rendering bundle cards from a template.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string` | no | Unique identifier for the bundle. Becomes `data-next-bundle-id` on the rendered card |
| `items` | `BundleItem[]` | no | The packages and quantities that make up this bundle |
| `vouchers` | `string[]` | yes | Coupon codes to apply when this bundle is selected. Omit if no vouchers |
| `[key]` | `unknown` | yes | Any additional fields are available as `{bundle.key}` template variables in the card template |

---

## `BundleSlot`

The internal representation of a single renderable unit within a bundle card. Created by the enhancer from `BundleItem` entries. Not declared in HTML — managed by the enhancer.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `slotIndex` | `number` | no | Zero-based index of this slot across all slots in the bundle. Used in `data-next-slot-index` on the rendered slot element |
| `unitIndex` | `number` | no | Zero-based position of this unit within the expanded item. Always `0` for non-configurable items |
| `originalPackageId` | `number` | no | Package ID from the bundle definition. Does not change when the visitor selects a variant |
| `activePackageId` | `number` | no | Package ID currently active for this slot. Matches `originalPackageId` until the visitor selects a different variant |
| `quantity` | `number` | no | Cart quantity for this slot. Always `1` for configurable items (expanded per unit); equals `BundleItem.quantity` for non-configurable items |
| `noSlot` | `boolean` | yes | When `true`, this slot is skipped during rendering. Mirrors the `noSlot` flag from the source `BundleItem` |

---

## Slot template variables

Variables available in `{curly.brace}` syntax inside the slot template (`data-next-bundle-slot-template-id`).

| Variable | Type | Description |
|----------|------|-------------|
| `slot.index` | `string` | 1-based slot index (`slotIndex + 1`). Use for display labels like "Item 1", "Item 2" |
| `slot.unitIndex` | `string` | 0-based unit index within an expanded configurable item |
| `slot.unitNumber` | `string` | 1-based unit index (`unitIndex + 1`). Use for display labels |
| `item.packageId` | `string` | Active package ID for this slot |
| `item.name` | `string` | Package name |
| `item.image` | `string` | Package image URL |
| `item.quantity` | `string` | Cart quantity for this slot |
| `item.variantName` | `string` | Product variant display name (e.g., "Red / L") |
| `item.productName` | `string` | Base product name |
| `item.sku` | `string` | Product SKU |
| `item.qty` | `string` | Per-unit item quantity from the campaign package |
| `item.price` | `string` | Unit price (formatted) |
| `item.priceTotal` | `string` | Total price for all units of this package in the bundle (formatted) |
| `item.priceRetail` | `string` | Retail / compare-at unit price (formatted) |
| `item.priceRetailTotal` | `string` | Retail total for all units (formatted) |
| `item.priceRecurring` | `string` | Recurring price (formatted), if applicable |
| `item.isRecurring` | `string` | `'true'` if the package has a recurring price, `'false'` otherwise |
| `item.unitPrice` | `string` | Preview/cart unit price for this slot (formatted). Falls back to `item.price` if no preview |
| `item.originalUnitPrice` | `string` | Unit price before any discount (formatted) |
| `item.packagePrice` | `string` | Package-level price for this slot from the preview (formatted) |
| `item.originalPackagePrice` | `string` | Package price before discount (formatted) |
| `item.subtotal` | `string` | Subtotal for this line from the preview |
| `item.totalDiscount` | `string` | Total discount amount for this line (formatted) |
| `item.total` | `string` | Final line total after discount (formatted) |
| `item.hasDiscount` | `'show' \| 'hide'` | `'show'` if a discount applies to this line; use with CSS `display` |
| `item.hasSavings` | `'show' \| 'hide'` | `'show'` if the retail price exceeds the current price; use with CSS `display` |

---

## Variant option template variables

Variables available inside the variant option template (`data-next-variant-option-template-id`).

| Variable | Type | Description |
|----------|------|-------------|
| `attr.code` | `string` | Attribute code (e.g., `color`, `size`) |
| `attr.name` | `string` | Human-readable attribute label (e.g., `Color`, `Size`) |
| `option.value` | `string` | The option's value (e.g., `red`, `L`) |
| `option.selected` | `string` | `'true'` if this option matches the slot's current active package |
| `option.available` | `string` | `'true'` if this option can be selected given other currently selected attributes |

---

## Variant selector template variables

Variables available inside the variant selector wrapper template (`data-next-variant-selector-template-id`).

| Variable | Type | Description |
|----------|------|-------------|
| `attr.code` | `string` | Attribute code for this selector group |
| `attr.name` | `string` | Human-readable attribute label |
| `attr.selectedValue` | `string` | Currently selected value for this attribute in the slot |

---

## Bundle card template variables

Variables available inside the bundle card template (`data-next-bundle-template-id`). All top-level keys from the `BundleDef` object (except `items`) are available as `{bundle.key}`.

| Variable | Type | Description |
|----------|------|-------------|
| `bundle.id` | `string` | Bundle ID |
| `bundle.{key}` | `string` | Any additional field declared in the bundle definition object |
