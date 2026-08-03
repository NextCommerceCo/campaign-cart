---
title: "Features/Order/Order Item List/Logs"
group: "Features"
category: "Order Item List"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `order-item-list` can print, under the logger prefix `OrderItemListEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Failed to auto-load order:` | `order-item-list.enhancer.ts › OrderItemListEnhancer.checkAndLoadOrderFromUrl` | yes |
| `Error rendering order item:` | `order-item-list.enhancer.ts › OrderItemListEnhancer.renderOrderItem` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `OrderItemListEnhancer initialized` | `order-item-list.enhancer.ts › OrderItemListEnhancer.initialize` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
