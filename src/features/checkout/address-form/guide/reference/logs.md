---
title: "Features/Checkout/Address Form/Logs"
group: "Features"
category: "Address Form"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `address-form` can print, under the logger prefix `AddressFormEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Failed to load the address layout for {countryCode}:` | `address-form.enhancer.ts › AddressFormEnhancer.renderCountry` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Rendered {length} address fields for {countryCode}` | `address-form.enhancer.ts › AddressFormEnhancer.renderCountry` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
