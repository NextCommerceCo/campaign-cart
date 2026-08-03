---
title: "Features/Cart/Quantity Control/Events"
group: "Features"
category: "Quantity Control"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `cart:quantity-changed`

**When:** A cart line's quantity changed. Fired after the write succeeds, so the cart store already reflects the new value. Not fired when the requested quantity equals the current one.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The package whose quantity changed. |
| `quantity` | `number` | The new quantity. `0` means the line was removed from the cart. |
| `oldQuantity` | `number` | The quantity before the change. |

**Example:**

```json
{
  "packageId": 42,
  "quantity": 3,
  "oldQuantity": 2
}
```
