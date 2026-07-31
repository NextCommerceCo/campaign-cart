---
title: "Features/Display/Timer/Events"
group: "Features"
category: "Timer"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `timer:expired`

**When:** A countdown timer reached zero.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `persistenceId` | `string` | The timer's persistence id — the key its deadline is stored under, so the countdown survives a reload. Identifies which timer expired. |

**Example:**

```json
{ "persistenceId": "flash-sale" }
```
