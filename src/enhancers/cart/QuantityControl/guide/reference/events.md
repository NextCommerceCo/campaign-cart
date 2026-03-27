# Events

## `cart:quantity-changed`

**When:** Fired after a successful `updateQuantity` or `removeItem` call triggered by this enhancer. Not fired if the quantity was already at the requested value (no-op path).

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The package whose quantity changed. |
| `quantity` | `number` | The new quantity. `0` means the item was removed from cart. |
| `oldQuantity` | `number` | The quantity before the change. |

**Example:**
```json
{
  "packageId": 42,
  "quantity": 3,
  "oldQuantity": 2
}
```

---
