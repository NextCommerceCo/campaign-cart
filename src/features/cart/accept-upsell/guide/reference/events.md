---
title: "Features/Cart/Accept Upsell/Events"
group: "Features"
category: "Accept Upsell"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `upsell:accepted`

**When:** The visitor accepted a post-purchase upsell and it was added to the existing order. This is the event post-purchase revenue tracking should use — the money is additional to the original `order:completed` value.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The upsell package that was added. |
| `quantity` | `number` | How many units were added. |
| `orderId` | `string` | The order the upsell was attached to. |
| `value?` | `number` | Item revenue for the accepted line(s), after discounts (post-discount). |
| `discount?` | `number` | Total discount applied to the accepted line(s) (pre-discount − value). |
| `coupon?` | `string` | Voucher/coupon code applied to the order, when present. |

**Example:**

```json
{
  "packageId": 77,
  "quantity": 1,
  "orderId": "abc123",
  "value": 29.99,
  "discount": 0
}
```
