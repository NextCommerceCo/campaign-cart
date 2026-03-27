# Object Attributes

## `CartItem`

The cart item object the enhancer reads to determine current quantity and in-cart state.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `number` | no | Unique cart line ID assigned by the API. |
| `packageId` | `number` | no | The campaign package `ref_id`. Matched against `data-package-id` to find the relevant item. |
| `quantity` | `number` | no | Number of this package in the cart. The enhancer reads this on every cart update to render button state and input values. |
| `price` | `number` | no | Total package price as a raw number. Not used by this enhancer directly. |
| `title` | `string` | no | Package display name. Not used by this enhancer directly. |
| `image` | `string` | yes | Product image URL. `null` when no image is configured. |
| `sku` | `string` | yes | Product SKU. `null` when not set. |
| `is_upsell` | `boolean` | yes | `true` when added via post-purchase upsell. The enhancer does not treat upsell items differently — quantity updates follow the same path. |

---

## `QuantityConstraints`

The constraints object used internally and exposed via `getConstraints()`.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `min` | `number` | no | Minimum allowed quantity. Defaults to `0`. |
| `max` | `number` | no | Maximum allowed quantity. Defaults to `99`. |
| `step` | `number` | no | Amount added or subtracted per click. Defaults to `1`. |

---
