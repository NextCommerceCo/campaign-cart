---
title: "Features/Checkout/Prospect Cart/Logs"
group: "Features"
category: "Prospect Cart"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `prospect-cart` can print, under the logger prefix `ProspectCartEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Failed to create prospect cart even with minimal data:` | `prospect-cart.enhancer.ts:599` | yes |
| `Failed to create prospect cart:` | `prospect-cart.enhancer.ts:626` | yes |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Invalid prospect config JSON:` | `prospect-cart.enhancer.ts:103` | yes |
| `Invalid data-min-phone-digits value, using default:` | `prospect-cart.enhancer.ts:146` | yes |
| `Email field not found for prospect cart` | `prospect-cart.enhancer.ts:171` | — |
| `Phone field not found for prospect cart` | `prospect-cart.enhancer.ts:195` | — |
| `Failed to get E.164 formatted phone from existing instance:` | `prospect-cart.enhancer.ts:226` | yes |
| `Cannot setup email entry trigger - email field not found` | `prospect-cart.enhancer.ts:281` | — |
| `Cannot setup phone entry trigger - phone field not found` | `prospect-cart.enhancer.ts:378` | — |
| `Failed to parse stored prospect cart:` | `prospect-cart.enhancer.ts:435` | yes |
| `No items in cart, skipping prospect cart creation` | `prospect-cart.enhancer.ts:462` | — |
| `Initial prospect cart creation failed, retrying with minimal data:` | `prospect-cart.enhancer.ts:569` | yes |
| `Failed to parse stored UTM data:` | `prospect-cart.enhancer.ts:658` | yes |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Initializing ProspectCartEnhancer` | `prospect-cart.enhancer.ts:54` | yes |
| `Starting prospect cart creation` | `prospect-cart.enhancer.ts:447` | — |
| `Retrying prospect cart creation with minimal data (email only)` | `prospect-cart.enhancer.ts:593` | — |
| `Successfully created prospect cart with minimal data` | `prospect-cart.enhancer.ts:597` | — |
| `Prospect cart created with checkout URL:` | `prospect-cart.enhancer.ts:624` | yes |
| `Prospect cart marked as abandoned` | `prospect-cart.enhancer.ts:801` | — |
| `Prospect cart converted to order` | `prospect-cart.enhancer.ts:813` | — |
| `All required fields valid, creating prospect cart immediately` | `prospect-cart.enhancer.ts:906` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `ProspectCartEnhancer initialized` | `prospect-cart.enhancer.ts:81` | yes |
| `Found email field with selector:` | `prospect-cart.enhancer.ts:165` | yes |
| `Found phone field with selector:` | `prospect-cart.enhancer.ts:189` | yes |
| `Got E.164 formatted phone from existing instance:` | `prospect-cart.enhancer.ts:222` | yes |
| `Using raw phone value (intlTelInput instance not found)` | `prospect-cart.enhancer.ts:231` | — |
| `Setting up email entry trigger on field:` | `prospect-cart.enhancer.ts:285` | yes |
| `Checking if all required fields are valid for cart creation` | `prospect-cart.enhancer.ts:302` | — |
| `Email blur event processed, value:` | `prospect-cart.enhancer.ts:315` | yes |
| `Email appears incomplete, skipping cart creation:` | `prospect-cart.enhancer.ts:321` | yes |
| `Valid email detected on change event:` | `prospect-cart.enhancer.ts:330` | yes |
| `First name blur event, checking cart creation` | `prospect-cart.enhancer.ts:340` | — |
| `Valid first name detected on change event:` | `prospect-cart.enhancer.ts:348` | yes |
| `Last name blur event, checking cart creation` | `prospect-cart.enhancer.ts:359` | — |
| `Valid last name detected on change event:` | `prospect-cart.enhancer.ts:367` | yes |
| `Setting up phone entry trigger on field:` | `prospect-cart.enhancer.ts:382` | yes |
| `Checking if required fields are valid for cart creation (phone trigger)` | `prospect-cart.enhancer.ts:391` | — |
| `Phone blur event processed, value:` | `prospect-cart.enhancer.ts:401` | yes |
| `Phone appears incomplete, skipping cart creation:` | `prospect-cart.enhancer.ts:404` | yes |
| `Valid phone detected on change event:` | `prospect-cart.enhancer.ts:412` | yes |
| `Restored existing prospect cart:` | `prospect-cart.enhancer.ts:429` | yes |
| `Prospect cart already exists` | `prospect-cart.enhancer.ts:443` | — |
| `Cart state:` | `prospect-cart.enhancer.ts:453` | yes |
| `Skipping phone on prospect cart payload — failed validation:` | `prospect-cart.enhancer.ts:531` | yes |
| `Creating prospect cart with data:` | `prospect-cart.enhancer.ts:555` | yes |
| `Prospect cart update skipped - using standard cart API` | `prospect-cart.enhancer.ts:635` | — |
| `intlTelInput isValidNumber threw, falling back:` | `prospect-cart.enhancer.ts:730` | yes |
| `updateEmail called with invalid email:` | `prospect-cart.enhancer.ts:827` | yes |
| `Field validation status for cart creation:` | `prospect-cart.enhancer.ts:863` | yes |
| `Invalid or incomplete email, skipping cart creation:` | `prospect-cart.enhancer.ts:878` | yes |
| `Invalid or incomplete phone, skipping cart creation:` | `prospect-cart.enhancer.ts:880` | yes |
| `Invalid or missing first name, waiting for valid name:` | `prospect-cart.enhancer.ts:882` | yes |
| `Invalid or missing last name, waiting for valid name:` | `prospect-cart.enhancer.ts:884` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
