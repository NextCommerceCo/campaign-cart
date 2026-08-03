---
title: "Features/Display/Order Display/Relations"
group: "Features"
category: "Order Display"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `order-display` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- `orderStore` — it reads the completed order, loaded from the `?ref_id` in the URL. Opened without one there is no order and every binding stays at its placeholder.

## Conflicts

None known. Several instances of this feature can coexist on a page.

## Common combinations

- [`order-item-list`](../../../order/order-item-list/guide/overview.md) — the standard receipt: order totals from the display bindings, the purchased lines from the list.
