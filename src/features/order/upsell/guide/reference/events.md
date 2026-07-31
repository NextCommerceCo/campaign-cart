---
title: "Features/Order/Upsell/Events"
group: "Features"
category: "Upsell"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `upsell:initialized`

**When:** A post-purchase upsell offer was wired up and is on screen.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `packageId` | `number` | The package being offered. |
| `element` | `HTMLElement` | The offer's container element. |

---

## `upsell:option-selected`

**When:** An option was chosen inside an upsell offer — a variant or a tier.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | The upsell selector that fired this. |
| `packageId` | `number` | The package behind the chosen option. |

---

## `upsell:quantity-changed`

**When:** The quantity on an upsell offer changed before the visitor accepted it.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId?` | `string \| undefined` | The upsell selector, when the change came from one. |
| `quantity` | `number` | The new quantity. |
| `packageId?` | `number \| undefined` | The package whose quantity changed, when it is known. |

---

## `upsell-selector:item-selected`

**When:** A card in an upsell offer's built-in selector was chosen.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `selectorId` | `string` | The upsell selector that fired this. |
| `packageId` | `number` | The package on the chosen card. |
