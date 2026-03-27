# Events

## `bundle:selected`

**When:** A bundle card is clicked by the user. Fires after the selection state is updated but before the cart write completes (in swap mode).

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `bundleId` | `string` | ID of the bundle card the user clicked, matching `data-next-bundle-id` |
| `items` | `BundleItem[]` | Effective items at the moment of click — reflects any variant overrides already in place |

**Example:**
```json
{
  "bundleId": "value",
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
| `bundleId` | `string` | ID of the newly selected bundle card |
| `items` | `BundleItem[]` | Effective items for the newly selected bundle — reflects current variant overrides |

**Example:**
```json
{
  "bundleId": "value",
  "items": [
    { "packageId": 101, "quantity": 3 }
  ]
}
```
