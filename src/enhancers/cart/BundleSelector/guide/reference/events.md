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

**When:** A price fetch completes for a bundle card. Fires after `data-bundle-price-*` raw numeric attributes are written to the card element. Used internally by `BundleDisplayEnhancer` to refresh `data-next-display="bundle.{selectorId}.*"` elements.

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
