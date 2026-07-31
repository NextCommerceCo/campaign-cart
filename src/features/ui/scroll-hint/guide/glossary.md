---
title: "Features/UI/Scroll Hint/Glossary"
group: "Features"
category: "Scroll Hint"
---

# Glossary

Terms used across this feature's guide.

## Active class

`cart-items__scroll-hint--active`, added to the hint while it should be visible
and removed otherwise. The name comes from the cart items list this was built for,
but the class is the same on every hint, including one watching an order list — so
styling a hint elsewhere means using that class name. The feature never sets
`display` itself, which is what lets the reveal be animated.

---

## Scroll target

The scrolling container a hint watches, named by `data-next-scroll-target` as a
CSS selector. One hint watches one target. Without the attribute the feature
searches for a likely list nearby (a cart items list, an order items list, or an
element classed `scrollable-content`) and gives up if it finds none.

---

## Scroll threshold

How far down the target the visitor may be and still count as "at the top", set by
`data-next-scroll-threshold` in pixels and defaulting to 5. The tolerance exists
because a trackpad reports fractional scroll positions: without it the cue would
flicker off and on as the list drifts a pixel.
