# Events

## `cart:item-added`

**When:** A package is successfully added to the cart.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The `ref_id` of the package that was added |
| `quantity` | `number` | The quantity that was added |
| `source` | `"selector"` \| `"direct"` | `"selector"` when the package came from a linked `PackageSelectorEnhancer`; `"direct"` when it came from `data-next-package-id` |

**Example:**
```json
{
  "packageId": 42,
  "quantity": 1,
  "source": "selector"
}
```

---

## `action:success`

**When:** The cart write completes without error. Emitted by `BaseActionEnhancer`.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Class name of the enhancer (`"AddToCartEnhancer"`) |
| `data.element` | `HTMLElement` | The button element that triggered the action |

---

## `action:failed`

**When:** The cart write throws an error. Emitted by `BaseActionEnhancer`.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | Class name of the enhancer (`"AddToCartEnhancer"`) |
| `error` | `Error` | The error that was thrown |
