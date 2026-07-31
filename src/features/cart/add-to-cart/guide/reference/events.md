---
title: "Features/Cart/Add to Cart/Events"
group: "Features"
category: "Add to Cart"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `cart:item-added`

**When:** A package was successfully added to the cart.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The `ref_id` of the package that was added. |
| `quantity?` | `number` | How many units were added. |
| `source?` | `string` | Where the package came from: `selector` when a linked selector supplied it, `direct` when it came from the button's own `data-next-package-id`. |

**Example:**

```json
{
  "packageId": 42,
  "quantity": 1,
  "source": "selector"
}
```
