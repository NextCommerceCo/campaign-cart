---
title: "Features/Cart/Package Selector/Events"
group: "Features"
category: "Package Selector"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `selector:item-selected`

**When:** A visitor clicked a card in a selector. Fires after the selection state is updated but before the cart write completes in `swap` mode.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | The selector that fired this, matching its `data-next-selector-id`. |
| `packageId` | `number` | The package on the card the visitor clicked. |
| `previousPackageId` | `number \| undefined` | The previously selected package, or `undefined` if nothing was selected. |
| `mode` | `string` | The selector's mode at click time: `swap` or `select`. |
| `pendingAction` | `boolean \| undefined` | `true` in `select` mode, signalling that an external button still has to perform the cart write. |
| `item?` | `SelectorItem` | The full selected item, when the selector could resolve it. |

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

**When:** The active selection changed. Fires on every selection update — including programmatic ones, such as cart sync auto-selecting an already-in-cart package on load — not only on visitor clicks.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | The selector that fired this. |
| `packageId?` | `number` | The newly selected package. |
| `quantity?` | `number` | The quantity currently set on the selected card. |
| `item?` | `SelectorItem` | The full selected item, when the selector could resolve it. |

**Example:**

```json
{
  "selectorId": "main-selector",
  "packageId": 101,
  "quantity": 1
}
```

---

## `selector:quantity-changed`

**When:** A quantity stepper inside a selector card changed that card's quantity. This is the card's own quantity, not a cart line — in `select` mode nothing has been written to the cart yet.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | The selector that fired this. |
| `packageId` | `number` | The card whose quantity changed. |
| `quantity` | `number` | The new quantity on that card. |

**Example:**

```json
{
  "selectorId": "main-selector",
  "packageId": 101,
  "quantity": 2
}
```
