---
title: "Features/Order/Order Item List/Relations"
group: "Features"
category: "Order Item List"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `order-item-list` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- `orderStore` — it renders the lines of a loaded order, which needs the `?ref_id` the order page is opened with.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`order-display`](../../../display/order-display/guide/overview.md) — the standard receipt: order totals from the display bindings, the purchased lines from the list.
