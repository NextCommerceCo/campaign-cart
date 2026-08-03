---
title: "Features/Display/Quantity Text/Logs"
group: "Features"
category: "Quantity Text"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `quantity-text` can print, under the logger prefix `QuantityTextEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `QuantityTextEnhancer requires data-next-quantity-text attribute` | `quantity-text.enhancer.ts › QuantityTextEnhancer.initialize` | — |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `QuantityTextEnhancer initialized` | `quantity-text.enhancer.ts › QuantityTextEnhancer.initialize` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
