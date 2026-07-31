---
title: "Features/Checkout/Checkout Form/Logs"
group: "Features"
category: "Checkout Form"
---

# Logs

<!-- Generated from the logger calls in this feature's source. Do not edit by
     hand: change the log line in the code, then run `npm run docs:reference`. -->

Every message `checkout-form` can print, under the logger prefix `CheckoutFormEnhancer`. Search a console line here to find what produced it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text either side of it.

## Error

Something did not work. Each of these means a visitor saw the wrong thing, or nothing at all.

| Message | Source | Extra context |
|---|---|---|
| `Failed to re-initialize credit card service:` | `checkout-form.enhancer.ts:306` | yes |
| `Failed to load country data:` | `checkout-form.enhancer.ts:1023` | yes |
| `Failed to load states:` | `checkout-form.enhancer.ts:1227` | yes |
| `Failed to initialize {type} phone field:` | `checkout-form.enhancer.ts:1577` | yes |
| `Failed to initialize credit card service:` | `checkout-form.enhancer.ts:1646` | yes |
| `Error clearing checkout fields:` | `checkout-form.enhancer.ts:1712` | yes |
| `Failed to parse order data from sessionStorage:` | `checkout-form.enhancer.ts:1798` | yes |
| `Failed to create order:` | `checkout-form.enhancer.ts:1911` | yes |
| `Failed to create test order:` | `checkout-form.enhancer.ts:2056` | yes |
| `Error preserving query params:` | `checkout-form.enhancer.ts:2180` | yes |
| `Step navigation error:` | `checkout-form.enhancer.ts:2368` | yes |
| `Failed to process tokenized payment:` | `checkout-form.enhancer.ts:2650` | yes |
| `Failed to load billing states:` | `checkout-form.enhancer.ts:3019` | yes |
| `[Billing] CRITICAL: Billing section not found!` | `checkout-form.enhancer.ts:3159` | — |
| `Error filling test data for Konami order:` | `checkout-form.enhancer.ts:3554` | yes |
| `Error handling config update:` | `checkout-form.enhancer.ts:3605` | yes |
| `[Payment Error] Could not find error container element` | `checkout-form.enhancer.ts:3742` | — |
| `Error populating expiration fields:` | `field-manager.ts:172` | yes |
| `Failed to create express order:` | `order-manager.ts:211` | yes |
| `Cannot redirect: order missing ref_id` | `order-manager.ts:267` | — |
| `Error handling order redirect:` | `order-manager.ts:276` | yes |
| `Failed to get order status:` | `order-manager.ts:340` | yes |
| `Express checkout failed:` | `express-checkout-processor.ts:87` | yes |
| `No Spreedly environment key provided` | `credit-card-service.ts:76` | — |
| `Failed to initialize CreditCardService:` | `credit-card-service.ts:108` | yes |
| `Failed to load Spreedly script` | `credit-card-service.ts:475` | — |
| `Error setting up Spreedly:` | `credit-card-service.ts:537` | yes |
| `[Spreedly Event: errors] Tokenization failed:` | `credit-card-service.ts:610` | yes |
| `[Spreedly] No onTokenCallback registered!` | `credit-card-service.ts:651` | — |
| `[Spreedly Event: consoleError] Error from iFrame:` | `credit-card-service.ts:706` | yes |
| `Error applying Spreedly configuration:` | `credit-card-service.ts:800` | yes |
| `[Spreedly] Could not find error container to display errors` | `credit-card-service.ts:1061` | — |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Submit button not found in checkout form` | `checkout-form.enhancer.ts:377` | — |
| `[Billing] Could not set initial state - missing elements` | `checkout-form.enhancer.ts:710` | — |
| `[Billing] Expand fallback triggered - forcing completion` | `checkout-form.enhancer.ts:777` | — |
| `[Billing] Collapse fallback triggered - forcing completion` | `checkout-form.enhancer.ts:857` | — |
| `Stored country {storedCountry} not in available countries` | `checkout-form.enhancer.ts:938` | — |
| `Country {countryCode} from URL not in available countries` | `checkout-form.enhancer.ts:955` | — |
| `Saved country {savedCountryOverride} not in available countries` | `checkout-form.enhancer.ts:967` | — |
| `Failed to initialize ProspectCartEnhancer:` | `checkout-form.enhancer.ts:1454` | yes |
| `[Spreedly] Credit card validation errors:` | `checkout-form.enhancer.ts:1606` | yes |
| `API 400 error response:` | `checkout-form.enhancer.ts:1918` | yes |
| `Payment error detected:` | `checkout-form.enhancer.ts:1942` | yes |
| `Step {currentStep} validation failed` | `checkout-form.enhancer.ts:2324` | yes |
| `Validation failed` | `checkout-form.enhancer.ts:2495` | yes |
| `Invalid {fieldName} detected on blur:` | `checkout-form.enhancer.ts:2756` | yes |
| `Failed to track add_shipping_info event:` | `checkout-form.enhancer.ts:2792` | yes |
| `[Billing] Click blocked - animation in progress` | `checkout-form.enhancer.ts:3144` | — |
| `Failed to track add_shipping_info event after browser autofill:` | `checkout-form.enhancer.ts:3308` | yes |
| `Province {storedProvince} not found in options for country {storedCountry}` | `checkout-form.enhancer.ts:3457` | — |
| `Cart is empty` | `checkout-form.enhancer.ts:3595` | — |
| `Failed to track begin_checkout event:` | `checkout-form.enhancer.ts:3784` | yes |
| `Cannot checkout with empty cart` | `express-checkout-processor.ts:33` | — |
| `Failed to track add_payment_info event:` | `express-checkout-processor.ts:59` | yes |
| `Failed to reload Spreedly fields:` | `credit-card-service.ts:324` | yes |
| `[Spreedly] No selector found for field type: {fieldType}` | `credit-card-service.ts:1113` | — |
| `Field element not found for error: {fieldName}` | `ui-service.ts:163` | — |
| `Field '{fieldName}' not found for scrolling` | `ui-service.ts:186` | — |
| `Field '{fieldName}' not found for state update` | `ui-service.ts:243` | — |
| `Cart is empty, redirecting to cart page` | `ui-service.ts:301` | — |
| `Spreedly field not found: {fieldName}` | `ui-service.ts:641` | — |
| `No label found for floating label setup` | `ui-service.ts:747` | — |
| `Field not found for error display: {fieldName}` | `checkout-validator.ts:703` | — |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Page restored from bfcache, resetting express checkout state` | `checkout-form.enhancer.ts:279` | — |
| `Resetting processing state after bfcache restore` | `checkout-form.enhancer.ts:288` | — |
| `Resetting payment method from` | `checkout-form.enhancer.ts:297` | yes |
| `Re-initializing credit card service after bfcache restore` | `checkout-form.enhancer.ts:304` | — |
| `Window focused with processing=true, resetting express checkout state` | `checkout-form.enhancer.ts:322` | — |
| `[Billing] Setting initial state` | `checkout-form.enhancer.ts:679` | yes |
| `[Billing] Initial state: COLLAPSED (checkbox checked)` | `checkout-form.enhancer.ts:700` | — |
| `[Billing] Initial state: EXPANDED (checkbox unchecked)` | `checkout-form.enhancer.ts:707` | — |
| `[Billing] Expand complete` | `checkout-form.enhancer.ts:765` | yes |
| `[Billing] Collapse complete` | `checkout-form.enhancer.ts:845` | yes |
| `Setting campaign shipping countries:` | `checkout-form.enhancer.ts:891` | yes |
| `Shipping country selection priority check (does not affect currency):` | `checkout-form.enhancer.ts:923` | yes |
| `✅ Using stored country from previous step: {storedCountry}` | `checkout-form.enhancer.ts:936` | — |
| `✅ Using shipping country from URL parameter: {countryCode} (currency unaffected)` | `checkout-form.enhancer.ts:953` | — |
| `✅ Using shipping country from session storage: {savedCountryOverride} (currency unaffected)` | `checkout-form.enhancer.ts:965` | — |
| `✅ Using detected/default shipping country: {selectedCountryCode} (currency unaffected)` | `checkout-form.enhancer.ts:970` | — |
| `Handling country change to: {newCountry}` | `checkout-form.enhancer.ts:1074` | — |
| `Country field updated to: {newCountry}` | `checkout-form.enhancer.ts:1093` | — |
| `Prospect cart created` | `checkout-form.enhancer.ts:1444` | yes |
| `Prospect cart abandoned` | `checkout-form.enhancer.ts:1449` | yes |
| `[Spreedly] Payment token received:` | `checkout-form.enhancer.ts:1617` | yes |
| `All checkout fields cleared` | `checkout-form.enhancer.ts:1710` | — |
| `Fresh purchase detected, showing attention modal` | `checkout-form.enhancer.ts:1741` | yes |
| `Order created successfully` | `checkout-form.enhancer.ts:1901` | yes |
| `Multi-step checkout detected` | `checkout-form.enhancer.ts:2291` | yes |
| `Validating step {currentStep} before navigation` | `checkout-form.enhancer.ts:2313` | — |
| `Step {currentStep} validated successfully, navigating to: {nextStepUrl}` | `checkout-form.enhancer.ts:2349` | — |
| `Processing express checkout for {paymentMethod} (skipping validation)` | `checkout-form.enhancer.ts:2447` | — |
| `Express payment {paymentMethod} requires validation (requireValidation: true)` | `checkout-form.enhancer.ts:2466` | — |
| `Processing express checkout for {paymentMethod} (after validation)` | `checkout-form.enhancer.ts:2567` | — |
| `Tracked add_shipping_info event (address complete)` | `checkout-form.enhancer.ts:2790` | yes |
| `Tracked add_shipping_info event` | `checkout-form.enhancer.ts:3123` | yes |
| `[Billing] Toggle clicked` | `checkout-form.enhancer.ts:3134` | yes |
| `[Billing] Processing toggle` | `checkout-form.enhancer.ts:3163` | yes |
| `[Billing] Collapsing form...` | `checkout-form.enhancer.ts:3175` | — |
| `[Billing] Expanding form...` | `checkout-form.enhancer.ts:3178` | — |
| `Browser autofill detected for fields:` | `checkout-form.enhancer.ts:3295` | yes |
| `Tracked add_shipping_info event (browser autofill)` | `checkout-form.enhancer.ts:3306` | yes |
| `Restoring saved country: {currentCountryValue}` | `checkout-form.enhancer.ts:3404` | — |
| `[Payment Error] Displaying error:` | `checkout-form.enhancer.ts:3708` | yes |
| `[Payment Error] Error container shown with message:` | `checkout-form.enhancer.ts:3734` | yes |
| `Tracked begin_checkout event on checkout form initialization` | `checkout-form.enhancer.ts:3781` | — |
| `createExpressOrder called with:` | `order-manager.ts:170` | yes |
| `Express order data built` | `order-manager.ts:188` | — |
| `Express order created:` | `order-manager.ts:193` | yes |
| `handleOrderRedirect called with order:` | `order-manager.ts:258` | yes |
| `Tracked add_payment_info event for express checkout` | `express-checkout-processor.ts:57` | yes |
| `Express checkout initiated with {method}` | `express-checkout-processor.ts:68` | — |
| `PayPal error displayed:` | `express-checkout-processor.ts:127` | yes |
| `[Spreedly Event: ready] iFrame initialized and ready for configuration` | `credit-card-service.ts:600` | — |
| `[Spreedly Event: paymentMethod] Successfully tokenized!` | `credit-card-service.ts:637` | yes |
| `[Spreedly Event: validation] Validation requested:` | `credit-card-service.ts:658` | yes |
| `[Spreedly] Card number validation changed: {wasValid} -> {validNumber}` | `credit-card-service.ts:896` | — |
| `[Spreedly] CVV validation changed: {wasValid} -> {validCvv}` | `credit-card-service.ts:947` | — |
| `Tracked add_payment_info event - credit card fields complete` | `credit-card-service.ts:981` | — |
| `[Spreedly] Showing errors:` | `credit-card-service.ts:1037` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `CheckoutFormEnhancer initialized` | `checkout-form.enhancer.ts:350` | — |
| `Found submit button:` | `checkout-form.enhancer.ts:375` | yes |
| `[Billing] Starting expand animation` | `checkout-form.enhancer.ts:722` | yes |
| `[Billing] Measured full height:` | `checkout-form.enhancer.ts:735` | yes |
| `[Billing] Expand animation started` | `checkout-form.enhancer.ts:751` | yes |
| `[Billing] Starting collapse animation` | `checkout-form.enhancer.ts:803` | yes |
| `[Billing] Collapse animation started` | `checkout-form.enhancer.ts:831` | yes |
| `No campaign shipping countries available, using config` | `checkout-form.enhancer.ts:894` | — |
| `Reusing existing state loading promise for {country}` | `checkout-form.enhancer.ts:1140` | — |
| `Kept autofilled state: {currentProvinceValue}` | `checkout-form.enhancer.ts:1209` | — |
| `No valid state found, showing placeholder: Select {stateLabel}` | `checkout-form.enhancer.ts:1223` | — |
| `No shipping location elements found` | `checkout-form.enhancer.ts:1286` | — |
| `No billing location elements found` | `checkout-form.enhancer.ts:1290` | — |
| `Location field visibility initialized` | `checkout-form.enhancer.ts:1343` | yes |
| `Location fields hidden` | `checkout-form.enhancer.ts:1374` | — |
| `Location fields shown` | `checkout-form.enhancer.ts:1393` | — |
| `Billing location fields hidden` | `checkout-form.enhancer.ts:1407` | — |
| `Billing location fields shown` | `checkout-form.enhancer.ts:1426` | — |
| `ProspectCartEnhancer initialized` | `checkout-form.enhancer.ts:1452` | — |
| `[Spreedly] Credit card service ready` | `checkout-form.enhancer.ts:1600` | — |
| `[Spreedly] Connected floating label callbacks` | `checkout-form.enhancer.ts:1637` | — |
| `Already shown warning for order` | `checkout-form.enhancer.ts:1737` | yes |
| `Preserved parameters from store:` | `checkout-form.enhancer.ts:2166` | yes |
| `Preserving all session parameters in next step URL` | `checkout-form.enhancer.ts:2356` | — |
| `Express payment config:` | `checkout-form.enhancer.ts:2437` | yes |
| `Saved user's country selection to session: {value}` | `checkout-form.enhancer.ts:2771` | — |
| `Updated user data storage:` | `checkout-form.enhancer.ts:2817` | yes |
| `Reusing existing state loading promise for {country} (billing)` | `checkout-form.enhancer.ts:2982` | — |
| `[Billing] Set country to:` | `checkout-form.enhancer.ts:3190` | yes |
| `Stopped autofill detection after 30 seconds` | `checkout-form.enhancer.ts:3317` | — |
| `Converting phone to international format: {phone} -> {internationalNumber}` | `checkout-form.enhancer.ts:3432` | — |
| `Restored province: {storedProvince}` | `checkout-form.enhancer.ts:3455` | — |
| `begin_checkout already tracked, skipping duplicate` | `checkout-form.enhancer.ts:3757` | — |
| `Found checkout field: {fieldName}` | `field-manager.ts:25` | yes |
| `Found exp-month field` | `field-manager.ts:39` | yes |
| `Found cc-month field without checkout attribute` | `field-manager.ts:42` | yes |
| `Found exp-year field` | `field-manager.ts:52` | yes |
| `Found cc-year field without checkout attribute` | `field-manager.ts:55` | yes |
| `Found {key} field by pattern: id="{id}", name="{name}"` | `field-manager.ts:71` | yes |
| `Found payment button: {paymentMethod}` | `field-manager.ts:86` | yes |
| `Found billing field: {fieldName}` | `field-manager.ts:99` | yes |
| `Month options populated (01-12)` | `field-manager.ts:131` | — |
| `Year options populated ({currentYear}-{currentYear + 19})` | `field-manager.ts:148` | — |
| `Populating expiration date fields` | `field-manager.ts:153` | — |
| `Expiration date fields populated` | `field-manager.ts:166` | yes |
| `Could not map field: id="{id}", name="{name}", attributes:` | `field-manager.ts:264` | yes |
| `createOrder called with:` | `order-manager.ts:32` | yes |
| `Creating order with data:` | `order-manager.ts:67` | yes |
| `Order data built successfully` | `order-manager.ts:76` | — |
| `Payment method:` | `order-manager.ts:77` | yes |
| `Has payment token:` | `order-manager.ts:78` | yes |
| `Calling API to create order...` | `order-manager.ts:81` | — |
| `Order created successfully by API:` | `order-manager.ts:84` | yes |
| `Payment error detected:` | `order-manager.ts:124` | yes |
| `Creating express order with minimal data:` | `order-manager.ts:187` | yes |
| `createTestOrder called with:` | `order-manager.ts:220` | yes |
| `Creating test order with data:` | `order-manager.ts:231` | yes |
| `Test order data built` | `order-manager.ts:232` | — |
| `Test order created:` | `order-manager.ts:237` | yes |
| `handleTokenizedPayment called with token:` | `order-manager.ts:286` | yes |
| `Handling tokenized payment` | `order-manager.ts:295` | yes |
| `Calling createOrderCallback...` | `order-manager.ts:300` | — |
| `Order created via callback:` | `order-manager.ts:305` | yes |
| `Emitting order:completed event` | `order-manager.ts:311` | — |
| `Handling order redirect...` | `order-manager.ts:315` | — |
| `Getting order status for:` | `order-manager.ts:331` | yes |
| `Order status retrieved:` | `order-manager.ts:333` | yes |
| `CreditCardService created with config:` | `credit-card-service.ts:80` | yes |
| `CreditCardService already initialized, skipping` | `credit-card-service.ts:90` | — |
| `Credit card fields not found, skipping Spreedly initialization` | `credit-card-service.ts:98` | — |
| `CreditCardService initialized successfully` | `credit-card-service.ts:106` | — |
| `Tokenizing credit card` | `credit-card-service.ts:126` | — |
| `Spreedly fields reloaded` | `credit-card-service.ts:322` | — |
| `Focusing {field} field` | `credit-card-service.ts:394` | — |
| `Credit card fields found:` | `credit-card-service.ts:450` | yes |
| `Spreedly already loaded` | `credit-card-service.ts:460` | — |
| `Loading Spreedly script...` | `credit-card-service.ts:464` | — |
| `Spreedly script loaded` | `credit-card-service.ts:471` | — |
| `Spreedly setup complete` | `credit-card-service.ts:535` | — |
| `Transferring focus to credit card number field` | `credit-card-service.ts:559` | — |
| `Transferring focus to CVV field` | `credit-card-service.ts:583` | — |
| `[Spreedly] Invoking token callback` | `credit-card-service.ts:648` | — |
| `Spreedly configuration applied:` | `credit-card-service.ts:787` | yes |
| `Cleared placeholder for {name} field (label floating up)` | `credit-card-service.ts:815` | — |
| `Restored placeholder for {name} field (label floating down)` | `credit-card-service.ts:835` | — |
| `Field focused: {fieldName}` | `credit-card-service.ts:1008` | — |
| `Field blurred: {fieldName}` | `credit-card-service.ts:1032` | — |
| `[Spreedly] Error displayed with message:` | `credit-card-service.ts:1049` | yes |
| `[Spreedly] Error auto-hidden after 10 seconds` | `credit-card-service.ts:1056` | — |
| `[Spreedly] Setting error for field: {fieldType} - {message}` | `credit-card-service.ts:1098` | — |
| `[Spreedly] Added error label: {message}` | `credit-card-service.ts:1143` | — |
| `[Spreedly] Clearing error for field: {fieldType}` | `credit-card-service.ts:1156` | — |
| `[Spreedly] Removing error label: {textContent}` | `credit-card-service.ts:1190` | — |
| `CreditCardService destroyed` | `credit-card-service.ts:1217` | — |
| `UIService initialized` | `ui-service.ts:59` | — |
| `Showing loading state for section: {section}` | `ui-service.ts:81` | — |
| `Hiding loading state for section: {section}` | `ui-service.ts:103` | — |
| `Updated progress to step: {step}` | `ui-service.ts:120` | — |
| `Could not focus field after scroll:` | `ui-service.ts:224` | yes |
| `Scrolled to field: {fieldName}` | `ui-service.ts:229` | — |
| `Updated field {fieldName} state to: {state}` | `ui-service.ts:263` | — |
| `Initializing payment forms` | `ui-service.ts:314` | — |
| `Payment method from store:` | `ui-service.ts:320` | yes |
| `Expanded payment method: {methodType} (store: {storePaymentMethod})` | `ui-service.ts:364` | — |
| `Collapsed payment method: {methodType}` | `ui-service.ts:377` | — |
| `Updating payment form visibility for method:` | `ui-service.ts:387` | yes |
| `Payment method {value}: {isSelected ? 'selected' : 'not selected'}` | `ui-service.ts:404` | — |
| `Expanded payment form` | `ui-service.ts:484` | — |
| `Collapsed payment form` | `ui-service.ts:528` | — |
| `Cleared payment form errors` | `ui-service.ts:554` | — |
| `Initializing floating labels` | `ui-service.ts:565` | — |
| `Initialized {size} floating labels` | `ui-service.ts:583` | — |
| `Set up Spreedly floating label for credit card number` | `ui-service.ts:608` | — |
| `Set up Spreedly floating label for CVV` | `ui-service.ts:627` | — |
| `Spreedly field focused: {fieldName}` | `ui-service.ts:654` | — |
| `Spreedly field blurred: {fieldName}, hasValue: {hasValue}` | `ui-service.ts:689` | — |
| `Spreedly field input: {fieldName}, hasValue: {hasValue}` | `ui-service.ts:727` | — |
| `Set up floating label for field:` | `ui-service.ts:770` | yes |
| `Added has-value class for field ({reason}):` | `ui-service.ts:933` | yes |
| `Removed has-value class for field:` | `ui-service.ts:957` | yes |
| `Updated all floating labels for populated data` | `ui-service.ts:991` | — |
| `Handled responsive UI adjustments for {isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}` | `ui-service.ts:1021` | — |
| `Enhanced accessibility features` | `ui-service.ts:1055` | — |
| `UIService destroyed` | `ui-service.ts:1079` | — |
| `Showing error for field {fieldName}:` | `checkout-validator.ts:707` | yes |
| `CheckoutValidator destroyed` | `checkout-validator.ts:776` | — |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
