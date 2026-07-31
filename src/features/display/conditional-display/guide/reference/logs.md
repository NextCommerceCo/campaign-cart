---
title: "Features/Display/Conditional Display/Logs"
group: "Features"
category: "Conditional Display"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `conditional-display` can print, under the logger prefix `ConditionalDisplayEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Error evaluating package condition:` | `conditional-display.enhancer.ts:433` | yes |
| `Error evaluating order condition:` | `conditional-display.enhancer.ts:485` | yes |
| `Error evaluating condition:` | `conditional-display.enhancer.ts:617` | yes |
| `Error evaluating selection condition:` | `conditional-display.enhancer.ts:750` | yes |
| `Error evaluating shipping condition:` | `conditional-display.enhancer.ts:802` | yes |
| `Error evaluating params condition:` | `conditional-display.enhancer.ts:903` | yes |
| `Error getting package property {property}:` | `conditional-display.enhancer.ts:1347` | yes |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Unsupported condition type for package: {type}` | `conditional-display.enhancer.ts:429` | — |
| `Unsupported condition type for order: {type}` | `conditional-display.enhancer.ts:481` | — |
| `Unknown condition type: {type}` | `conditional-display.enhancer.ts:613` | — |
| `Unsupported condition type for selection: {type}` | `conditional-display.enhancer.ts:746` | — |
| `Unsupported condition type for shipping: {type}` | `conditional-display.enhancer.ts:798` | — |
| `Unsupported condition type for params: {type}` | `conditional-display.enhancer.ts:899` | — |
| `Unknown cart method: {method}` | `conditional-display.enhancer.ts:1057` | — |
| `Selection condition used but no selector context found` | `conditional-display.enhancer.ts:1209` | — |
| `Package condition used but no package context found` | `conditional-display.enhancer.ts:1331` | — |
| `Package {packageContext} not found in campaign data` | `conditional-display.enhancer.ts:1340` | — |
| `Shipping condition used but no shipping context found` | `conditional-display.enhancer.ts:1444` | — |
| `Shipping method {shippingId} not found in campaign data` | `conditional-display.enhancer.ts:1461` | — |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `evaluateParamsCondition comparison:` | `conditional-display.enhancer.ts:852` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Condition analysis:` | `conditional-display.enhancer.ts:63` | yes |
| `Checking if condition depends on params:` | `conditional-display.enhancer.ts:285` | yes |
| `Comparison depends on params:` | `conditional-display.enhancer.ts:312` | yes |
| `handleParamsUpdate:` | `conditional-display.enhancer.ts:390` | yes |
| `Found selector ID in property:` | `conditional-display.enhancer.ts:665` | yes |
| `Found selector ID in comparison:` | `conditional-display.enhancer.ts:674` | yes |
| `Selector element not found for ID: {targetSelectorId}` | `conditional-display.enhancer.ts:1219` | — |
| `Could not get package data for selection` | `conditional-display.enhancer.ts:1239` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
