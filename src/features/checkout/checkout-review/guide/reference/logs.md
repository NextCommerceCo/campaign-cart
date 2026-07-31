---
title: "Features/Checkout/Checkout Review/Logs"
group: "Features"
category: "Checkout Review"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `checkout-review` can print, under the logger prefix `CheckoutReviewEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `CheckoutReviewEnhancer initializing` | `checkout-review.enhancer.ts › CheckoutReviewEnhancer.enhance` | yes |
| `Found review elements:` | `checkout-review.enhancer.ts › CheckoutReviewEnhancer.enhance` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Found review elements:` | `checkout-review.enhancer.ts › CheckoutReviewEnhancer.enhance` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
