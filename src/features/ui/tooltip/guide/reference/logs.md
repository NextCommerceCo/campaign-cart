---
title: "Features/UI/Tooltip/Logs"
group: "Features"
category: "Tooltip"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `tooltip` can print, under the logger prefix `TooltipEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Tooltip enhancer initialized` | `tooltip.enhancer.ts:36` | — |
| `Tooltip styles injected into document head` | `tooltip.enhancer.ts:220` | — |
| `Element position` | `tooltip.enhancer.ts:320` | yes |
| `Tooltip shown` | `tooltip.enhancer.ts:345` | — |
| `Tooltip hidden` | `tooltip.enhancer.ts:369` | — |
| `Tooltip positioned` | `tooltip.enhancer.ts:463` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
