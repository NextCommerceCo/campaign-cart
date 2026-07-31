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
| `Required coupon elements not found` | `coupon.enhancer.ts:48` | yes |
| `Coupon application failed:` | `coupon.enhancer.ts:134` | yes |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Coupon enhancer initialized successfully` | `coupon.enhancer.ts:69` | — |
| `Coupon applied successfully:` | `coupon.enhancer.ts:128` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Enhancing coupon element:` | `coupon.enhancer.ts:22` | yes |
| `Applying coupon:` | `coupon.enhancer.ts:118` | yes |
| `No display area or template found for coupons` | `coupon.enhancer.ts:149` | — |
| `Rendered applied coupons:` | `coupon.enhancer.ts:188` | yes |
| `Removing coupon:` | `coupon.enhancer.ts:192` | yes |
| `Showing message [{type}]:` | `coupon.enhancer.ts:206` | yes |
| `Destroying coupon enhancer` | `coupon.enhancer.ts:243` | — |
| `Coupon enhancer destroyed` | `coupon.enhancer.ts:260` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
