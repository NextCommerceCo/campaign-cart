---
title: "Features/Checkout/Checkout Review/Relations"
group: "Features"
category: "Checkout Review"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `checkout-review` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- [`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — it plays back what the form collected, reading the checkout store the form writes to. On a page with no checkout form there is nothing to show and every slot stays empty.

## Conflicts

None known. Several instances of this feature can coexist on a page.
