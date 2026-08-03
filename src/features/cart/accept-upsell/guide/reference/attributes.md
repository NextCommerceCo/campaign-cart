---
title: "Features/Cart/Accept Upsell/Attributes"
group: "Features"
category: "Accept Upsell"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Adds a post-purchase upsell to an order the visitor has already paid for, then sends them onward.

Turned on by `[data-next-action="accept-upsell"]`.

## `data-next-action`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Must be `"accept-upsell"`. This is the activation attribute — without it the feature is never instantiated.

**Valid values:**

- `accept-upsell` — Turns this element into an upsell accept button.

---

## `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

The package `ref_id` to add to the order. Use this when the offer is a fixed package with nothing to choose.

> **Watch out:** Set either this or one of the selector attributes below. If a linked selector has a selection, the selector wins.

---

## `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of an upsell selector on the page. The button reads its current selection at click time, so the visitor can pick a size or tier before accepting.

> **Watch out:** The selector must carry `data-next-upsell-context`, or it will write to the cart instead of leaving the choice to this button. A selector in upsell context pre-selects a card while booting, and this button reads that pre-selection when it initialises, so it arms itself without waiting for a click. A selector container that renders more than 100ms after the button is the exception — then the button starts disabled and arms on the first card click.

---

## `data-next-upsell-action-for`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of a bundle selector to read instead, for offers presented as a bundle rather than single packages.

---

## `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

How many units to add. A linked selector's own quantity wins once a selection is made.

**Valid values:** positive integer

---

## `data-next-url`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Where to send the visitor after the upsell is accepted — usually the next offer or the receipt. Query parameters from the current page are preserved.

> **Watch out:** With no value here, the SDK falls back to `<meta name="next-upsell-accept-url">`. With neither, the loading overlay clears and the visitor stays on the page — which reads as a broken funnel, so set one.

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-disabled` | — | The button has nothing to accept yet — a linked selector has no selection. |

## Conflicts

- `package-selector` — a selector without `data-next-upsell-context` writes to the cart on selection, which is wrong after checkout — the order is already paid. Always set the upsell context on selectors feeding this button.
