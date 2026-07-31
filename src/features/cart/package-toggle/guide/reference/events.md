---
title: "Features/Cart/Package Toggle/Events"
group: "Features"
category: "Package Toggle"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `toggle:toggled`

**When:** A package toggle was switched — an add-on like a warranty or express shipping going into or out of the cart.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The package that was toggled. |
| `added` | `boolean` | `true` when it is now in the cart, `false` when it was removed. |

**Example:**

```json
{ "packageId": 205, "added": true }
```

---

## `toggle:selection-changed`

**When:** The full set of toggled-on packages changed.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selected` | `number[]` | Every package currently toggled on. |

---

## `upsell:added`

**When:** The upsell was added to the order. Fires after the API confirms, and before any redirect to the next offer or the receipt.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The package that was added. |
| `quantity` | `number` | How many units were added. |
| `order` | `any` | The updated order, as returned by the API. |
| `value?` | `number` | Item revenue for the added line, after discounts. |
| `willRedirect?` | `boolean` | Whether the SDK is about to navigate away. When `true`, finish any tracking synchronously — a handler that awaits will not complete. |

**Example:**

```json
{
  "packageId": 77,
  "quantity": 1,
  "value": 29.99,
  "willRedirect": true
}
```
