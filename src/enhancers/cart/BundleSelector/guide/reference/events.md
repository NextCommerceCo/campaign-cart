# Events

## `bundle:selected`

**When:** A bundle card is clicked by the user. Fires after the selection state is updated but before the cart write completes (in swap mode).

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the bundle selector that fired this event, matching `data-next-selector-id` |
| `items` | `BundleItem[]` | Effective items at the moment of click — reflects any variant overrides already in place |

**Example:**
```json
{
  "selectorId": "upsellBundleMV",
  "items": [
    { "packageId": 101, "quantity": 3 }
  ]
}
```

---

## `bundle:selection-changed`

**When:** The active selection changes. Fires on every selection update, including programmatic changes (e.g., pre-selection on init, cart sync reverting a failed swap). Does not fire on every cart update — only when the selected bundle card actually changes.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the bundle selector whose selection changed |
| `items` | `BundleItem[]` | Effective items for the newly selected bundle — reflects current variant overrides |

**Example:**
```json
{
  "selectorId": "upsellBundleMV",
  "items": [
    { "packageId": 101, "quantity": 3 }
  ]
}
```

---

## `bundle:price-updated`

**When:** A price fetch completes for a bundle card and display elements have been updated. Used internally by `BundleDisplayEnhancer` to refresh `data-next-display="bundle.{selectorId}.*"` elements.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the bundle selector whose price was updated |

**Example:**
```json
{
  "selectorId": "upsellBundleMV"
}
```

---

## `bundle:quantity-changed`

**When:** The visitor changes a bundle's `bundleQuantity` via the inline stepper (`data-next-quantity-increase` / `data-next-quantity-decrease`). Fires after the new value has been committed to the card state but *before* the debounced price refetch starts; in swap mode also fires before the cart write begins. `bundle:selection-changed` is emitted immediately after so downstream listeners (e.g. `AddToCartEnhancer`, `BundleDisplayEnhancer`) pick up the new effective items.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the bundle selector whose quantity changed, matching `data-next-selector-id` |
| `bundleId` | `string` | ID of the bundle card whose quantity changed, matching `data-next-bundle-id` |
| `quantity` | `number` | New `bundleQuantity` on the card |
| `items` | `BundleItem[]` | Effective items after the multiplier — the same shape the cart write / `_getSelectedBundleItems()` will use |

**Example:**
```json
{
  "selectorId": "main",
  "bundleId": "tshirt",
  "quantity": 3,
  "items": [
    { "packageId": 101, "quantity": 3 }
  ]
}
```
