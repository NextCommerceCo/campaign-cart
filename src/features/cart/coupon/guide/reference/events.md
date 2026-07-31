---
title: "Features/Cart/Coupon/Events"
group: "Features"
category: "Coupon"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `coupon:applied`

**When:** A discount code was accepted and applied to the cart. The payload carries the full coupon when the SDK has it, and only the code when it does not.

**Example:**

```json
{ "code": "SAVE10" }
```

---

## `coupon:removed`

**When:** A previously applied discount code was taken off the cart.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `code` | `string` | The code that was removed. |

---

## `coupon:validation-failed`

**When:** A discount code was rejected — unknown, expired, or not valid for this cart.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `code` | `string` | The code the visitor entered. |
| `message` | `string` | The reason, already worded for display to the visitor. |

**Example:**

```json
{
  "code": "SAVE10",
  "message": "This code has expired."
}
```
