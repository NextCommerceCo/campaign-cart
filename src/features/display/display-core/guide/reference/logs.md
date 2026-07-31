---
title: "Features/Display/Display Core/Logs"
group: "Features"
category: "Display Core"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `display-core` can print, under the logger prefix `DisplayEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Validator failed for {displayPath}:` | `base-display-enhancer.ts › BaseDisplayEnhancer.getPropertyValueWithValidation` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Found context package ID: {id} from element:` | `package-context-resolver.ts › PackageContextResolver.findPackageId` | yes |
| `No context package ID found in parent elements` | `package-context-resolver.ts › PackageContextResolver.findPackageId` | — |
| `Found direct package ID: {id} from element:` | `package-context-resolver.ts › PackageContextResolver.getPackageId` | yes |
| `{name} initialized with path: {displayPath}` | `base-display-enhancer.ts › BaseDisplayEnhancer.initialize` | — |
| `Currency changed, updating display for {displayPath}` | `base-display-enhancer.ts › BaseDisplayEnhancer.setupCurrencyChangeListener` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
