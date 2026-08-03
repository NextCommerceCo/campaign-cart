---
title: "Features/Cart/Coupon/Relations"
group: "Features"
category: "Coupon"
---

# Relations

<!-- Generated from the feature manifests. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

What `coupon` needs on the page, what it is normally used with, and what breaks it.

## Dependencies

- `cartStore` — a coupon applies to a cart, so the field reads and writes cart state. With an empty cart the API rejects the code.

## Conflicts

Do not use these together on the same element or for the same package.

- [`bundle-selector`](../../../cart/bundle-selector/guide/overview.md) — a code that is also listed in `data-next-bundle-vouchers` is applied and removed automatically by the bundle selector, so applying it by hand as well leaves the voucher in an unpredictable state.

## Common combinations

- [`cart-summary`](../../../cart/cart-summary/guide/overview.md) — the summary is where an applied discount becomes visible — without it the visitor gets no confirmation the code worked.
