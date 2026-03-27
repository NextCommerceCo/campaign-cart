# Events

## `cart:item-removed`

**When:** Fires after `cartStore.removeItem()` resolves successfully and the item has been removed from cart state.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The campaign package `ref_id` that was removed from the cart |

**Example:**
```json
{
  "packageId": 42
}
```
