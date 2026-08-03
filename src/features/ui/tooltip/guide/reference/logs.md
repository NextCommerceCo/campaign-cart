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
| `Tooltip enhancer initialized` | `tooltip.enhancer.ts › TooltipEnhancer.initialize` | — |
| `Tooltip shown` | `tooltip.enhancer.ts › TooltipEnhancer.show` | — |
| `Tooltip hidden` | `tooltip.enhancer.ts › TooltipEnhancer.hide` | — |
| `Element position` | `tooltip.renderer.ts › mountTooltip` | yes |
| `Tooltip positioned` | `tooltip.renderer.ts › positionTooltip` | yes |
| `Tooltip styles injected into document head` | `tooltip.styles.ts › injectStyles` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
