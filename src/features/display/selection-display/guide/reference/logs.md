---
title: "Features/Display/Selection Display/Logs"
group: "Features"
category: "Selection Display"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `selection-display` can print, under the logger prefix `SelectionDisplayEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `No selector ID found for SelectionDisplayEnhancer` | `selection-display.enhancer.ts › SelectionDisplayEnhancer.parseDisplayAttributes` | — |
| `Package {packageId} not found in campaign data` | `selection-display.handlers.ts › loadPackageData` | — |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `SelectionDisplayEnhancer initialized:` | `selection-display.enhancer.ts › SelectionDisplayEnhancer.initialize` | yes |
| `Extracted selector ID from display path:` | `selection-display.enhancer.ts › SelectionDisplayEnhancer.parseDisplayAttributes` | yes |
| `Selection changed:` | `selection-display.enhancer.ts › SelectionDisplayEnhancer.handleSelectionChange` | yes |
| `Got initial selected item from selector:` | `selection-display.handlers.ts › findAssociatedSelector` | yes |
| `Found selected item from DOM:` | `selection-display.handlers.ts › findAssociatedSelector` | yes |
| `Selector element not found for ID: {selectorId}` | `selection-display.handlers.ts › findAssociatedSelector` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
