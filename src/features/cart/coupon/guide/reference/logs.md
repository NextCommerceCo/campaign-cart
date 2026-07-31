---
title: "Features/Cart/Coupon/Logs"
group: "Features"
category: "Coupon"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `coupon` can print, under the logger prefix `CouponEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Required coupon elements not found` | `coupon.enhancer.ts › CouponEnhancer.initialize` | yes |
| `Coupon application failed:` | `coupon.enhancer.ts › CouponEnhancer.applyCoupon` | yes |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Coupon enhancer initialized successfully` | `coupon.enhancer.ts › CouponEnhancer.initialize` | — |
| `Coupon applied successfully:` | `coupon.enhancer.ts › CouponEnhancer.applyCoupon` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Enhancing coupon element:` | `coupon.enhancer.ts › CouponEnhancer.initialize` | yes |
| `Applying coupon:` | `coupon.enhancer.ts › CouponEnhancer.applyCoupon` | yes |
| `No display area or template found for coupons` | `coupon.enhancer.ts › CouponEnhancer.renderAppliedCoupons` | — |
| `Rendered applied coupons:` | `coupon.enhancer.ts › CouponEnhancer.renderAppliedCoupons` | yes |
| `Removing coupon:` | `coupon.enhancer.ts › CouponEnhancer.removeCoupon` | yes |
| `Showing message [{type}]:` | `coupon.enhancer.ts › CouponEnhancer.showMessage` | yes |
| `Destroying coupon enhancer` | `coupon.enhancer.ts › CouponEnhancer.destroy` | — |
| `Coupon enhancer destroyed` | `coupon.enhancer.ts › CouponEnhancer.destroy` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
