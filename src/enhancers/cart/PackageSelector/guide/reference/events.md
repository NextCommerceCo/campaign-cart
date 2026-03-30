# Events

## `selector:item-selected`

**When:** A card is clicked by the user. Fires after the selection state is updated but before the cart write completes (in swap mode).

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the selector that fired the event, matching `data-next-selector-id` |
| `packageId` | `number` | Package ID of the card the user clicked |
| `previousPackageId` | `number \| undefined` | Package ID of the previously selected card; undefined if nothing was selected before |
| `mode` | `'swap' \| 'select'` | Operating mode of the selector at the time of the click |
| `pendingAction` | `true \| undefined` | Present and `true` in select mode — signals that an external button must complete the cart write |

**Example:**
```json
{
  "selectorId": "main-selector",
  "packageId": 102,
  "previousPackageId": 101,
  "mode": "select",
  "pendingAction": true
}
```

---

## `selector:selection-changed`

**When:** The active selection changes. This fires on every selection update, including programmatic changes (e.g., cart sync auto-selecting an in-cart package on init), not only on user clicks.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the selector |
| `packageId` | `number` | Package ID of the newly selected card |
| `quantity` | `number` | Current quantity set on the selected card |
| `item` | `SelectorItem` | Full item object for the selected card — see [object-attributes.md](./object-attributes.md) |

**Example:**
```json
{
  "selectorId": "main-selector",
  "packageId": 101,
  "quantity": 1,
  "item": {
    "packageId": 101,
    "quantity": 1,
    "price": 29.99,
    "name": "3-Pack",
    "isPreSelected": true,
    "shippingId": "5"
  }
}
```

---

## `selector:quantity-changed`

**When:** A quantity increase or decrease button inside a card is clicked.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the selector |
| `packageId` | `number` | Package ID of the card whose quantity changed |
| `quantity` | `number` | New quantity after the change |

**Example:**
```json
{
  "selectorId": "main-selector",
  "packageId": 101,
  "quantity": 2
}
```

---

## `selector:price-updated`

**When:** A price fetch completes for a selector card. Fires after `data-package-price-*` raw numeric attributes are written to the card element. Used internally by `PackageSelectorDisplayEnhancer` to refresh `data-next-display="selector.{selectorId}.{packageId}.*"` elements.

**Payload:**

| Field | Type | Description |
|-------|------|-------------|
| `selectorId` | `string` | ID of the selector containing the card |
| `packageId` | `number` | `ref_id` of the package whose price was updated |

**Example:**
```json
{
  "selectorId": "main-selector",
  "packageId": 101
}
```
