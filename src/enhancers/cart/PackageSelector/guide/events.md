# PackageSelectorEnhancer — Events

All events are emitted on the `EventBus` and also dispatched as native `CustomEvent`s
on `window` with the prefix `next:`.

---

## Emitted events

| Event | Payload | When |
|---|---|---|
| `selector:item-selected` | `{ selectorId, packageId, previousPackageId, mode }` | Card clicked |
| `selector:selection-changed` | `{ selectorId, packageId, quantity, item }` | Selection updated (after cart sync in swap mode) |
| `selector:quantity-changed` | `{ selectorId, packageId, quantity }` | Inline quantity control changed |

---

## Listening via `window`

```js
window.addEventListener('next:selector:selection-changed', e => {
  console.log('Selected package:', e.detail.packageId);
  console.log('Quantity:', e.detail.quantity);
});

window.addEventListener('next:selector:quantity-changed', e => {
  console.log('Quantity updated:', e.detail.quantity);
});
```

---

## Listening via the SDK EventBus

```js
NextCommerce.getInstance().on('selector:selection-changed', ({ selectorId, packageId }) => {
  if (selectorId === 'main') {
    console.log('Main selector changed to', packageId);
  }
});
```

---

## Event payload reference

### `selector:item-selected`

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | Value of `data-next-selector-id` on the container |
| `packageId` | `number` | `ref_id` of the newly selected package |
| `previousPackageId` | `number \| undefined` | `ref_id` of the previously selected package |
| `mode` | `"swap" \| "select"` | Current selection mode |

### `selector:selection-changed`

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | Value of `data-next-selector-id` on the container |
| `packageId` | `number` | `ref_id` of the selected package |
| `quantity` | `number` | Current quantity for the selected card |
| `item` | `SelectorItem` | Full item object (packageId, quantity, shippingId, …) |

### `selector:quantity-changed`

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | Value of `data-next-selector-id` on the container |
| `packageId` | `number` | `ref_id` of the card whose quantity changed |
| `quantity` | `number` | New quantity value |
