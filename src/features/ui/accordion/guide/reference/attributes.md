---
title: "Features/UI/Accordion/Attributes"
group: "Features"
category: "Accordion"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Collapses a section behind a trigger — an order summary on mobile, an FAQ, a shipping-details panel.

Turned on by `[data-next-accordion]`.

## `data-next-accordion`

| | |
|---|---|
| Type | `string (id)` |
| Required | yes |
| Default | — |

Marks the accordion and names it. The value is an id you choose; the trigger, panel, and text elements below use the same id to opt in, which is how several accordions coexist on one page.

---

## `data-initial-state`

| | |
|---|---|
| Type | `'open' \| 'closed'` |
| Required | no |
| Default | `closed` |

Whether the section starts expanded or collapsed.

**Valid values:**

- `open` — Expanded on load.
- `closed` — Collapsed on load.

---

## `data-toggle-class`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `next-expanded` |

The class added to the accordion while it is open. Change it to match a class your stylesheet already uses instead of writing new CSS.

---

## `data-animation-duration`

| | |
|---|---|
| Type | `number (ms)` |
| Required | no |
| Default | `300` |

How long the expand and collapse animation runs. Set `0` to switch instantly.

---

## `data-open-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Label written into the text element when the section **opens** — so it names the action that is now available, closing it. Default `Hide`.

> **Watch out:** The names read backwards at first: `data-open-text` is the label while open, not the label that invites opening. The defaults are the clue — `Hide` for open, `Show` for closed.

---

## `data-close-text`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Label written into the text element when the section **closes**, e.g. `Show order summary`. Default `Show`. This is what a collapsed accordion displays, including on first load.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-next-accordion-trigger` | — | The clickable element, carrying the same id as the accordion. Required — with none, the accordion logs a warning naming the id it looked for and nothing is clickable. |
| `data-next-accordion-panel` | — | The element that expands and collapses, carrying the same id. Required — with none, the accordion warns and there is nothing to reveal. |
| `data-next-accordion-text` | — | Optional element whose text is swapped between `data-open-text` and `data-close-text`. Without it those labels have nowhere to go. |

## Example

Every part carries the same id — `order-summary` here:

```html
<div data-next-accordion="order-summary"
     data-initial-state="closed"
     data-open-text="Hide order summary"
     data-close-text="Show order summary">

  <div data-next-accordion-trigger="order-summary">
    <span data-next-accordion-text="order-summary">Show order summary</span>
  </div>

  <div data-next-accordion-panel="order-summary">
    <div data-next-cart-summary>…</div>
  </div>
</div>
```

Subscribe to `accordion:toggled` and read `isOpen` rather than listening for
`accordion:opened` and `accordion:closed` separately — one handler covers both
directions.
