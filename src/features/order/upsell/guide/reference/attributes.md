---
title: "Features/Order/Upsell/Attributes"
group: "Features"
category: "Upsell"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Presents a post-purchase offer on the order the visitor already paid for, and adds it without asking for payment again.

Turned on by `[data-next-upsell]` — and equally by `[data-next-upsell-selector]`, `[data-next-upsell-select]`.

## Container — pick one mode

### `data-next-upsell`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

**Direct mode**: the container offers one fixed package. Any value is ignored — only presence counts. Pair it with `data-next-package-id`.

---

### `data-next-upsell-selector`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

**Selector mode**: the visitor chooses between options first. Pair it with `data-next-selector-id` plus either option cards or a dropdown.

## Offer configuration

### `data-next-package-id`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

The package being offered. In direct mode it goes on the container; in selector mode on each option card.

> **Watch out:** Missing or non-numeric in direct mode, initialization fails and the offer never appears.

---

### `data-next-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Names the selector so its quantity and selection can be tracked — and stay in step across duplicate containers, as when the same offer renders for mobile and desktop.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | `1` |

Starting quantity for the offer.

> **Watch out:** Runtime changes are clamped to 1–10 regardless of what the controls request.

## Options (selector mode)

### `data-next-upsell-option`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Marks a selectable option card. Give each one a `data-next-package-id`, and `data-next-selected="true"` on the one that should start chosen.

---

### `data-next-selected`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

Pre-selects this option on load.

---

### `data-next-upsell-select`

| | |
|---|---|
| Type | `string (selector id)` |
| Required | no |
| Default | — |

Marks a `<select>` as the option source for the selector named in its value, for offers with too many choices to show as cards. Each `<option value>` is a package id.

## Action buttons

### `data-next-upsell-action`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

What the button does.

**Valid values:**

- `add` — Add the offer to the order.
- `accept` — Same as `add`.
- `skip` — Decline and move on.
- `decline` — Same as `skip`.

> **Watch out:** An unrecognised value logs a warning and the button does nothing.

---

### `data-next-url`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Where to send the visitor after this button's action — usually the next offer, or the receipt. The order reference is appended and existing query parameters are preserved.

> **Watch out:** Also accepted: `data-next-next-url`, `data-os-next-url`. With none of them, the `next-upsell-accept-url` / `next-upsell-decline-url` meta tags are used. With neither, the funnel stops here.

## Quantity controls

### `data-next-upsell-quantity`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Marks a quantity control inside the offer.

**Valid values:**

- `increase` — Button that adds one.
- `decrease` — Button that subtracts one.
- `display` — Element whose text shows the current quantity.

---

### `data-next-upsell-quantity-toggle`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

A button that jumps straight to a quantity — "Buy 3" beside "Buy 1". The active one gets the `next-selected` class.

---

### `data-next-quantity-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Scopes a quantity control to one selector, for a page with more than one offer.

## Linked external selectors

### `data-next-package-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Read the offer from an external package selector by id, instead of local option cards. The selection is read at click time.

> **Watch out:** Omit it and a matching selector inside the container is detected automatically.

---

### `data-next-bundle-selector-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

The same, for an external bundle selector.

## Line item properties

### `data-next-property`

| | |
|---|---|
| Type | `string (key)` |
| Required | no |
| Default | — |

On an input inside the offer: its value is attached to the added line under this key. Wins over a document-wide default with the same key.

---

### `data-next-default-property`

| | |
|---|---|
| Type | `string (key)` |
| Required | no |
| Default | — |

On an input anywhere in the page: collected for every offer, no container needed.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-next-url` | — | Legacy spelling of `data-next-url` on an action button, still read as a fallback. Prefer `data-next-url` in new markup; `data-os-next-url` is read after this one for older pages. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-selected` | — | On the chosen option card and the active quantity toggle. Style selection from this rather than tracking clicks yourself. |

## Direct vs selector mode

```html
<!-- Direct: one fixed offer -->
<div data-next-upsell data-next-package-id="77" data-next-quantity="1">
  <button data-next-upsell-action="add" data-next-url="/receipt">Yes, add it</button>
  <button data-next-upsell-action="skip" data-next-url="/receipt">No thanks</button>
</div>

<!-- Selector: the visitor chooses first -->
<div data-next-upsell-selector data-next-selector-id="offer-1">
  <div data-next-upsell-option data-next-package-id="77" data-next-selected="true">1 bottle</div>
  <div data-next-upsell-option data-next-package-id="78">3 bottles</div>

  <button data-next-upsell-action="add" data-next-url="/receipt">Add to my order</button>
</div>
```

**The add button emits `upsell:accepted` through the accept-upsell feature, not
this one.** This feature reports selection and quantity; the accept action and its
revenue event belong to
[accept-upsell](../../../../cart/accept-upsell/guide/reference/events.md). Track
post-purchase revenue there.

## Conflicts

- `accept-upsell` — they are two different accept patterns for two different stages — the cart versus a completed order. On the same element both try to own the click.
