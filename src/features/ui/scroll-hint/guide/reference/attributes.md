---
title: "Features/UI/Scroll Hint/Attributes"
group: "Features"
category: "Scroll Hint"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows a "scroll for more" cue while a scrollable list is at the top and has content below the fold.

Turned on by `[data-next-component="scroll-hint"]`.

## `data-next-component`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Must be `"scroll-hint"`. Marks the element as the cue.

**Valid values:**

- `scroll-hint` — Turns this element into a scroll hint.

---

## `data-next-scroll-target`

| | |
|---|---|
| Type | `string (CSS selector)` |
| Required | no |
| Default | — |

The scrollable container to watch. Without it the feature looks for a nearby cart items list, which covers the common case of a hint sitting under one.

> **Watch out:** If neither the selector nor the fallback matches, there is nothing to watch and the hint never appears. Set this explicitly for any list that is not a cart items list.

---

## `data-next-scroll-threshold`

| | |
|---|---|
| Type | `number (px)` |
| Required | no |
| Default | `5` |

How far the visitor may scroll before the hint is considered dismissed. A few pixels of tolerance stops the hint flickering on trackpad drift.

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `aria-hidden` | `true` / `false` | Kept in step with visibility, so a screen reader does not announce a cue that is not showing. |

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `cart-items__scroll-hint--active` | — | On the hint while it should be visible: the target is at the top and has more content below. Style the hint as hidden by default and reveal it with this class. |

## Example

```html
<div class="cart-items__list">…many rows…</div>

<div data-next-component="scroll-hint"
     data-next-scroll-target=".cart-items__list"
     class="cart-items__scroll-hint">
  Scroll for more
</div>
```

The hint appears only when both things are true: the list is scrolled to the top,
and it actually has content below the fold. A short list therefore never shows a
cue that would be a lie.
