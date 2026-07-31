---
title: "Features/UI/Scroll Hint/Relations"
group: "Features"
category: "Scroll Hint"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `scroll-hint` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

`scroll-hint` works on its own — nothing else has to be on the page.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`cart-item-list`](../../../cart/cart-item-list/guide/overview.md) — a long cart is the case where a scrollable list needs telling the visitor there is more below.
  - **Watch out:** The list replaces its `innerHTML` on every cart update. Point the hint at the scroll container rather than at anything the list renders inside it.
