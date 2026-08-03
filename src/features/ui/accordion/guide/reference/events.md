---
title: "Features/UI/Accordion/Events"
group: "Features"
category: "Accordion"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `accordion:toggled`

**When:** An accordion section was toggled. Fires for both directions — read `isOpen` rather than subscribing to the separate opened/closed events.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | The section's id. |
| `isOpen` | `boolean` | `true` when the section is now open. |
| `element` | `HTMLElement` | The section element. |

---

## `accordion:opened`

**When:** An accordion section opened.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | The section's id. |
| `element` | `HTMLElement` | The section element. |

---

## `accordion:closed`

**When:** An accordion section closed.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | The section's id. |
| `element` | `HTMLElement` | The section element. |
