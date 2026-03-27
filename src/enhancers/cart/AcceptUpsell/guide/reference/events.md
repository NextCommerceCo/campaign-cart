# Events

## `upsell:accepted`

**When:** The upsell API call succeeds and the order is updated.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The package that was added to the order |
| `quantity` | `number` | Number of units added |
| `orderId` | `string \| null` | The `ref_id` of the order that was updated |
| `value` | `number` | Price of the added upsell line, inclusive of tax. `0` if the response did not include a matching upsell line. |

**Example:**
```json
{
  "packageId": 42,
  "quantity": 1,
  "orderId": "ORD-1234",
  "value": 29.00
}
```

---

## `action:success`

**When:** Any action on a `BaseActionEnhancer` completes without throwing. Emitted by the base class after `acceptUpsell()` resolves.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Class name of the enhancer (`AcceptUpsellEnhancer`) |
| `data.element` | `HTMLElement` | The button element the enhancer is bound to |

---

## `action:failed`

**When:** `acceptUpsell()` throws. Emitted by the base class.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Class name of the enhancer (`AcceptUpsellEnhancer`) |
| `error` | `Error` | The error that was thrown |
