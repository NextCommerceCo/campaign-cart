---
title: "Features/Behavior/Simple Exit Intent/Events"
group: "Features"
category: "Simple Exit Intent"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `exit-intent:shown`

**When:** The exit-intent popup was shown — the visitor's pointer left the viewport.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `imageUrl?` | `string` | Image the popup was rendered with, when it is image-based. |
| `template?` | `string` | Template the popup was rendered from, when it is template-based. |

---

## `exit-intent:clicked`

**When:** The visitor clicked the exit-intent popup's content, rather than dismissing it.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `imageUrl?` | `string` | Image the popup was rendered with. |
| `template?` | `string` | Template the popup was rendered from. |

---

## `exit-intent:dismissed`

**When:** The popup was dismissed — via the close button, the overlay, or the Escape key. Fires alongside `exit-intent:closed`.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `imageUrl?` | `string` | Image the popup was rendered with. |
| `template?` | `string` | Template the popup was rendered from. |

---

## `exit-intent:closed`

**When:** The popup was removed from the page, whatever the reason.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `imageUrl?` | `string` | Image the popup was rendered with. |
| `template?` | `string` | Template the popup was rendered from. |

---

## `exit-intent:action`

**When:** The visitor took the popup's offer — usually accepting a discount code.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `action` | `string` | Which action was taken. |
| `couponCode?` | `string` | The code the popup applied, when the action carries one. |

**Example:**

```json
{
  "action": "accept",
  "couponCode": "STAY10"
}
```
