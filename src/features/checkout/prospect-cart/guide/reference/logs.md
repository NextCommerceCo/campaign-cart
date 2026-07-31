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
| `Failed to create prospect cart even with minimal data:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Failed to create prospect cart:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Invalid prospect config JSON:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.loadConfig` | yes |
| `Invalid data-min-phone-digits value, using default:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.loadConfig` | yes |
| `Email field not found for prospect cart` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.findEmailField` | — |
| `Phone field not found for prospect cart` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.findPhoneField` | — |
| `Failed to get E.164 formatted phone from existing instance:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.getFormattedPhoneNumber` | yes |
| `Cannot setup email entry trigger - email field not found` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | — |
| `Cannot setup phone entry trigger - phone field not found` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupPhoneEntryTrigger` | — |
| `Failed to parse stored prospect cart:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkExistingProspectCart` | yes |
| `No items in cart, skipping prospect cart creation` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | — |
| `Initial prospect cart creation failed, retrying with minimal data:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Failed to parse stored UTM data:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.collectUtmData` | yes |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Initializing ProspectCartEnhancer` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.initialize` | yes |
| `Starting prospect cart creation` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | — |
| `Retrying prospect cart creation with minimal data (email only)` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | — |
| `Successfully created prospect cart with minimal data` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | — |
| `Prospect cart created with checkout URL:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Prospect cart marked as abandoned` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.abandonCart` | — |
| `Prospect cart converted to order` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.convertCart` | — |
| `All required fields valid, creating prospect cart immediately` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `ProspectCartEnhancer initialized` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.initialize` | yes |
| `Found email field with selector:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.findEmailField` | yes |
| `Found phone field with selector:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.findPhoneField` | yes |
| `Got E.164 formatted phone from existing instance:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.getFormattedPhoneNumber` | yes |
| `Using raw phone value (intlTelInput instance not found)` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.getFormattedPhoneNumber` | — |
| `Setting up email entry trigger on field:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `Checking if all required fields are valid for cart creation` | `prospect-cart.enhancer.ts › checkForCartCreation` | — |
| `Email blur event processed, value:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `Email appears incomplete, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `Valid email detected on change event:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `First name blur event, checking cart creation` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | — |
| `Valid first name detected on change event:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `Last name blur event, checking cart creation` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | — |
| `Valid last name detected on change event:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupEmailEntryTrigger` | yes |
| `Setting up phone entry trigger on field:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupPhoneEntryTrigger` | yes |
| `Checking if required fields are valid for cart creation (phone trigger)` | `prospect-cart.enhancer.ts › scheduleCheck` | — |
| `Phone blur event processed, value:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupPhoneEntryTrigger` | yes |
| `Phone appears incomplete, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupPhoneEntryTrigger` | yes |
| `Valid phone detected on change event:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.setupPhoneEntryTrigger` | yes |
| `Restored existing prospect cart:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkExistingProspectCart` | yes |
| `Prospect cart already exists` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | — |
| `Cart state:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Skipping phone on prospect cart payload — failed validation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Creating prospect cart with data:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.createProspectCart` | yes |
| `Prospect cart update skipped - using standard cart API` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.updateProspectCart` | — |
| `intlTelInput isValidNumber threw, falling back:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.isValidPhone` | yes |
| `updateEmail called with invalid email:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.updateEmail` | yes |
| `Field validation status for cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or incomplete email, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or incomplete phone, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or missing first name, waiting for valid name:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or missing last name, waiting for valid name:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
