# Events

## `toggle:toggled`

**When:** A card is clicked and the cart action (add or remove) completes successfully. Also emitted in upsell context after `orderStore.addUpsell()` resolves.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The `ref_id` of the package that was toggled |
| `added` | `boolean` | `true` if the package was added; `false` if it was removed |

**Example:**
```json
{
  "packageId": 101,
  "added": true
}
```

---

## `toggle:selection-changed`

**When:** After every cart store update that the enhancer processes. Emitted even if the set of selected packages did not change.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selected` | `number[]` | Array of `packageId` values for all packages currently in the cart that belong to this enhancer's cards |

**Example:**
```json
{
  "selected": [101, 103]
}
```

---

## `upsell:added`

**When:** A card in upsell context is clicked and `orderStore.addUpsell()` resolves successfully.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | The `ref_id` of the upsell package added |
| `quantity` | `number` | The quantity added |
| `order` | `object` | The updated order object returned by the API |

**Example:**
```json
{
  "packageId": 201,
  "quantity": 1,
  "order": { "ref_id": "ORD-123", "..." }
}
```

---

## `toggle:price-updated`

**When:** A price fetch (or cart-summary read) completes for a toggle card. Fires after `data-toggle-price-*` raw numeric attributes are written to the card element. Used internally by `PackageToggleDisplayEnhancer` to refresh `data-next-display="toggle.{packageId}.*"` elements.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `packageId` | `number` | `ref_id` of the package whose price was updated |

**Example:**
```json
{
  "packageId": 101
}
```
