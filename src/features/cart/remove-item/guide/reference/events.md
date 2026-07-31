---
title: "Features/Cart/Remove Item/Events"
group: "Features"
category: "Remove Item"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `cart:item-removed`

**When:** A line was removed from the cart — by a remove button, or by a quantity control dropping it to zero.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The package whose line was removed. |

**Example:**

```json
{ "packageId": 42 }
```
