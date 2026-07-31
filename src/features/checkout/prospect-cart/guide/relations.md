---
title: "Features/Checkout/Prospect Cart/Relations"
group: "Features"
category: "Prospect Cart"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `prospect-cart` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — it is not scanned from the DOM at all — the checkout form constructs it when the form carries `data-auto-create`. Without a `[data-next-checkout]` form it never runs.

## Conflicts

None known. Several instances of this feature can coexist on a page.
