---
title: "Features/UI/Scroll Hint/Events"
group: "Features"
category: "Scroll Hint"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `scroll-hint:updated`

**When:** A scroll hint recalculated whether it should be visible — on scroll, and when the scrollable content resizes.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `isVisible` | `boolean` | Whether the hint is showing: the target is at the top and can scroll. |
| `scrollTop` | `number` | Current scroll offset of the watched element. |
| `scrollHeight` | `number` | Full scrollable height of the watched element. |
| `clientHeight` | `number` | Visible height of the watched element. |

**Example:**

```json
{
  "isVisible": true,
  "scrollTop": 0,
  "scrollHeight": 1400,
  "clientHeight": 600
}
```
