---
title: "Features/Display/Conditional Display/Relations"
group: "Features"
category: "Conditional Display"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `conditional-display` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- [`display-core`](../../../display/display-core/guide/overview.md) — conditions are written over the same namespaces as `data-next-display`, so what you can show is what you can test.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`cart-summary`](../../../cart/cart-summary/guide/overview.md) — showing a free-shipping or minimum-spend message beside the totals is the common case.
  - **Watch out:** Inside a summary or bundle row template the row renderer evaluates the condition per row instead, against that row's data — this feature is not instantiated there, so the paths available are different.
- [`timer`](../../../display/timer/guide/overview.md) — a countdown usually needs the offer it gates to disappear with it, which is a condition rather than a timer concern.
