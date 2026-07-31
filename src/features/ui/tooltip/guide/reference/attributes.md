---
title: "Features/UI/Tooltip/Attributes"
group: "Features"
category: "Tooltip"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows a small explanation on hover or focus — what a fee covers, what a guarantee includes.

Turned on by `[data-next-tooltip]`.

## `data-next-tooltip`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

The text to show. Marks the element as having a tooltip and supplies its content in one attribute.

---

## `data-next-tooltip-placement`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `top` |

Which side of the element the tooltip prefers. It flips automatically when there is not enough room on that side, so this is a preference rather than a guarantee.

**Valid values:** `top`, `bottom`, `left`, `right`, and their `-start` / `-end` variants

---

## `data-next-tooltip-offset`

| | |
|---|---|
| Type | `number (px)` |
| Required | no |
| Default | `8` |

Gap between the element and the tooltip.

---

## `data-next-tooltip-delay`

| | |
|---|---|
| Type | `number (ms)` |
| Required | no |
| Default | `500` |

How long the pointer must rest before the tooltip appears. The delay is what stops tooltips flickering as the pointer crosses a row of them.

---

## `data-next-tooltip-max-width`

| | |
|---|---|
| Type | `string (CSS length)` |
| Required | no |
| Default | `200px` |

Width at which the text wraps. Accepts any CSS length, so `30ch` or `50%` work as well as pixels.

---

## `data-next-tooltip-class`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Extra class names put on the tooltip, for a variant that differs from the default styling.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-placement` | `top`, `bottom`, `left`, `right`, with `-start` / `-end` variants | On the tooltip element: the side it actually rendered on after any flip. The built-in arrow styling keys off this, and so can yours. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-tooltip--visible` | — | On the tooltip while it is shown. Animate from this rather than from the element being inserted. |

## Example

```html
<span data-next-tooltip="Charged once, not per shipment."
      data-next-tooltip-placement="right"
      data-next-tooltip-max-width="28ch">
  What is this fee?
</span>
```

The tooltip is appended to the page rather than nested inside the element, so a
parent with `overflow: hidden` cannot clip it. Style it with
`.next-tooltip`, or pass your own class through
`data-next-tooltip-class`.
