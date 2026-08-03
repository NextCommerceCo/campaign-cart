---
title: "Features/Behavior/FOMO Popup/Events"
group: "Features"
category: "FOMO Popup"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `fomo:shown`

**When:** A social-proof notification was shown — "someone in Denver just bought this". Fires once per notification, on a rotation.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `customer` | `string` | The customer line as displayed, already formatted. |
| `product` | `string` | The product name shown in the notification. |
| `image` | `string` | Image shown alongside it. |

**Example:**

```json
{
  "customer": "Sarah from Denver",
  "product": "3-Pack Bundle",
  "image": "https://cdn.example.com/pack3.jpg"
}
```
