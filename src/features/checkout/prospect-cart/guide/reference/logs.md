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
| `Failed to create prospect cart even with minimal data:` | `cart-creation.ts › createProspectCart` | yes |
| `Failed to create prospect cart:` | `cart-creation.ts › createProspectCart` | yes |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `No items in cart, skipping prospect cart creation` | `cart-creation.ts › createProspectCart` | — |
| `Initial prospect cart creation failed, retrying with minimal data:` | `cart-creation.ts › createProspectCart` | yes |
| `Failed to parse stored UTM data:` | `cart-creation.ts › collectUtmData` | yes |
| `Invalid prospect config JSON:` | `config.ts › loadConfig` | yes |
| `Invalid data-min-phone-digits value, using default:` | `config.ts › loadConfig` | yes |
| `Email field not found for prospect cart` | `field-discovery.ts › findEmailField` | — |
| `Phone field not found for prospect cart` | `field-discovery.ts › findPhoneField` | — |
| `Failed to get E.164 formatted phone from existing instance:` | `field-discovery.ts › getFormattedPhoneNumber` | yes |
| `Failed to parse stored prospect cart:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkExistingProspectCart` | yes |
| `Cannot setup email entry trigger - email field not found` | `triggers.ts › setupEmailEntryTrigger` | — |
| `Cannot setup phone entry trigger - phone field not found` | `triggers.ts › setupPhoneEntryTrigger` | — |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Starting prospect cart creation` | `cart-creation.ts › createProspectCart` | — |
| `Retrying prospect cart creation with minimal data (email only)` | `cart-creation.ts › createProspectCart` | — |
| `Successfully created prospect cart with minimal data` | `cart-creation.ts › createProspectCart` | — |
| `Prospect cart created with checkout URL:` | `cart-creation.ts › createProspectCart` | yes |
| `Initializing ProspectCartEnhancer` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.initialize` | yes |
| `Prospect cart marked as abandoned` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.abandonCart` | — |
| `Prospect cart converted to order` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.convertCart` | — |
| `All required fields valid, creating prospect cart immediately` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Prospect cart already exists` | `cart-creation.ts › createProspectCart` | — |
| `Cart state:` | `cart-creation.ts › createProspectCart` | yes |
| `Skipping phone on prospect cart payload — failed validation:` | `cart-creation.ts › createProspectCart` | yes |
| `Creating prospect cart with data:` | `cart-creation.ts › createProspectCart` | yes |
| `Prospect cart update skipped - using standard cart API` | `cart-creation.ts › updateProspectCart` | — |
| `Found email field with selector:` | `field-discovery.ts › findEmailField` | yes |
| `Found phone field with selector:` | `field-discovery.ts › findPhoneField` | yes |
| `Got E.164 formatted phone from existing instance:` | `field-discovery.ts › getFormattedPhoneNumber` | yes |
| `Using raw phone value (intlTelInput instance not found)` | `field-discovery.ts › getFormattedPhoneNumber` | — |
| `ProspectCartEnhancer initialized` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.initialize` | yes |
| `Restored existing prospect cart:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkExistingProspectCart` | yes |
| `updateEmail called with invalid email:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.updateEmail` | yes |
| `Field validation status for cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or incomplete email, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or incomplete phone, skipping cart creation:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or missing first name, waiting for valid name:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Invalid or missing last name, waiting for valid name:` | `prospect-cart.enhancer.ts › ProspectCartEnhancer.checkAndCreateCart` | yes |
| `Setting up email entry trigger on field:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `Checking if all required fields are valid for cart creation` | `triggers.ts › checkForCartCreation` | — |
| `Email blur event processed, value:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `Email appears incomplete, skipping cart creation:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `Valid email detected on change event:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `First name blur event, checking cart creation` | `triggers.ts › setupEmailEntryTrigger` | — |
| `Valid first name detected on change event:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `Last name blur event, checking cart creation` | `triggers.ts › setupEmailEntryTrigger` | — |
| `Valid last name detected on change event:` | `triggers.ts › setupEmailEntryTrigger` | yes |
| `Setting up phone entry trigger on field:` | `triggers.ts › setupPhoneEntryTrigger` | yes |
| `Checking if required fields are valid for cart creation (phone trigger)` | `triggers.ts › scheduleCheck` | — |
| `Phone blur event processed, value:` | `triggers.ts › setupPhoneEntryTrigger` | yes |
| `Phone appears incomplete, skipping cart creation:` | `triggers.ts › setupPhoneEntryTrigger` | yes |
| `Valid phone detected on change event:` | `triggers.ts › setupPhoneEntryTrigger` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
