---
title: "Features/UI/Scroll Hint/Overview"
group: "Features"
category: "Scroll Hint"
---

# Scroll Hint

> Category: `ui`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows a "scroll for more" cue while a scrollable list is at the top and actually has
content below the fold.

## Concept

A static "scroll for more" label lies twice: it shows on a short list that has
nothing below, and it stays on after the visitor has already scrolled.

This feature makes the cue conditional on both facts. It watches a scrollable
container and reveals the hint only when the container is at the top **and** its
content is taller than its visible area. A three-item cart never shows it; a
twenty-item cart shows it until the visitor scrolls.

The cue is your element, styled by you. The feature only toggles a class and keeps
`aria-hidden` in step, so a screen reader does not announce a cue that is not showing.

## Business logic

- Activates on `data-next-component="scroll-hint"`.
- `data-next-scroll-target` is a CSS selector for the container to watch. Without it,
  the feature looks for a nearby cart items list — the common case.
- If neither the selector nor that fallback matches, there is nothing to watch and the
  hint never appears. Set the selector explicitly for any list that is not a cart
  items list.
- `data-next-scroll-threshold` (default 5px) is how far the visitor may scroll before
  the hint is considered dismissed. The tolerance stops it flickering on trackpad
  drift.
- `cart-items__scroll-hint--active` is toggled on the hint while it should be visible.
  Style the hint as hidden by default and reveal it with this class.
- `scroll-hint:updated` fires on each recalculation with the scroll geometry.

## Decisions

- We require both conditions — at top, and scrollable — because either alone produces a
  cue that is sometimes false.
- We toggle a class rather than setting `display`, so the reveal can be animated and
  the hint's layout stays yours.
- We default the target to a cart items list because that is where this is nearly
  always used, while keeping the selector available for anything else.
- We include a small scroll threshold rather than reacting to any movement, since
  sub-pixel scroll events would otherwise flicker the hint.

## Limitations

- Watches one container per hint.
- Does not react to content changes on its own beyond what scroll and resize events
  report; a list whose height changes without either may need a nudge.
- Does not scroll anything — it is a cue, not a control.
- The default active class is named for the cart items list it was built for, so
  styling it elsewhere means using that class name or overriding it in CSS.

## Reference

- [Attributes](./reference/attributes.md) — target, threshold, the active class
- [Events](./reference/events.md) — `scroll-hint:updated`
