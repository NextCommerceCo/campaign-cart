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
| `[Billing] CRITICAL: Billing section not found!` | `billing-toggle.ts › handleBillingAddressToggle` | — |
| `Failed to re-initialize credit card service:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupBfcacheRestoreHandler` | yes |
| `Failed to load country data:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeAddressManagement` | yes |
| `Failed to initialize credit card service:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeCreditCard` | yes |
| `Failed to create order:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.createOrder` | yes |
| `Failed to create test order:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.createTestOrder` | yes |
| `Failed to process tokenized payment:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleTokenizedPayment` | yes |
| `Failed to parse order data from sessionStorage:` | `duplicate-purchase-warning.ts › handlePurchaseEvent` | yes |
| `Error clearing checkout fields:` | `form-population.ts › clearAllCheckoutFields` | yes |
| `Step navigation error:` | `multi-step-navigation.ts › handleStepNavigation` | yes |
| `[Payment Error] Could not find error container element` | `payment-error-display.ts › displayPaymentError` | — |
| `Failed to initialize {type} phone field:` | `phone-input.ts › initializePhoneInput` | yes |
| `Failed to load states:` | `state-fields.ts › updateStateOptions` | yes |
| `Failed to load billing states:` | `state-fields.ts › updateBillingStateOptions` | yes |
| `Error handling config update:` | `store-subscriptions.ts › handleConfigUpdate` | yes |
| `Error filling test data for Konami order:` | `test-order.ts › handleKonamiActivation` | yes |
| `Failed to create express order:` | `order-manager.ts › OrderManager.createExpressOrder` | yes |
| `Cannot redirect: order missing ref_id` | `order-manager.ts › OrderManager.handleOrderRedirect` | — |
| `Error handling order redirect:` | `order-manager.ts › OrderManager.handleOrderRedirect` | yes |
| `Failed to get order status:` | `order-manager.ts › OrderManager.getOrderStatus` | yes |
| `Express checkout failed:` | `express-checkout-processor.ts › ExpressCheckoutProcessor.handleExpressCheckout` | yes |
| `No Spreedly environment key provided` | `credit-card-service.ts › CreditCardService.constructor` | — |
| `Failed to initialize CreditCardService:` | `credit-card-service.ts › CreditCardService.initialize` | yes |
| `Failed to load Spreedly script` | `credit-card-service.ts › CreditCardService.loadSpreedlyScript` | — |
| `Error setting up Spreedly:` | `credit-card-service.ts › CreditCardService.setupSpreedly` | yes |
| `[Spreedly Event: errors] Tokenization failed:` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | yes |
| `[Spreedly] No onTokenCallback registered!` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | — |
| `[Spreedly Event: consoleError] Error from iFrame:` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | yes |
| `Error applying Spreedly configuration:` | `credit-card-service.ts › CreditCardService.applySpreedlyConfig` | yes |
| `[Spreedly] Could not find error container to display errors` | `credit-card-service.ts › CreditCardService.showSpreedlyErrors` | — |

## Warn

The feature carried on, but something in the markup or the data was not what it expected — usually a misspelled attribute or an id that matches nothing. Worth fixing even when the page looks fine.

| Message | Source | Extra context |
|---|---|---|
| `Failed to track add_shipping_info event after browser autofill:` | `autofill-detection.ts › setupAutofillDetection` | yes |
| `[Billing] Expand fallback triggered - forcing completion` | `billing-animation.ts › expandBillingForm` | — |
| `[Billing] Collapse fallback triggered - forcing completion` | `billing-animation.ts › collapseBillingForm` | — |
| `[Billing] Could not set initial state - missing elements` | `billing-form-setup.ts › setInitialBillingFormState` | — |
| `[Billing] Some stored billing values have no field` | `billing-form-setup.ts › restoreBillingAddressFields` | yes |
| `[Billing] Click blocked - animation in progress` | `billing-toggle.ts › handleBillingAddressToggle` | — |
| `[Spreedly] Credit card validation errors:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeCreditCard` | yes |
| `API 400 error response:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.createOrder` | yes |
| `Payment error detected:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.createOrder` | yes |
| `Validation failed` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleFormSubmit` | yes |
| `Invalid {fieldName} detected on blur:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.validateContactFieldOnCommit` | yes |
| `Failed to track add_shipping_info event:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.trackAddShippingInfoOnAddress` | yes |
| `Failed to track begin_checkout event:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.trackBeginCheckout` | yes |
| `Stored country {storedCountry} not in available countries` | `country-selection.ts › resolveShippingCountry` | — |
| `Country {countryCode} from URL not in available countries` | `country-selection.ts › resolveShippingCountry` | — |
| `Saved country {savedCountryOverride} not in available countries` | `country-selection.ts › resolveShippingCountry` | — |
| `Submit button not found in checkout form` | `field-scanning.ts › scanAllFields` | — |
| `Province {storedProvince} not found in options for country {storedCountry}` | `form-population.ts › populateFormData` | — |
| `Payment method "{value}" is not one the SDK knows — sending it to the API as it stands` | `method-selection.ts › handlePaymentMethodChange` | — |
| `Shipping method {methodId} is not one this campaign offers` | `method-selection.ts › handleShippingMethodChange` | yes |
| `Step number "{rawStep}" is not a whole number above zero, treating this form as step 1` | `multi-step-navigation.ts › readStepNumber` | — |
| `Step {currentStep} has no rules of its own, validating it as the address step` | `multi-step-navigation.ts › handleStepNavigation` | — |
| `Step {currentStep} validation failed` | `multi-step-navigation.ts › handleStepNavigation` | yes |
| `Failed to initialize ProspectCartEnhancer:` | `prospect-cart-lifecycle.ts › initializeProspectCart` | yes |
| `Cart is empty` | `store-subscriptions.ts › handleCartUpdate` | — |
| `Cannot checkout with empty cart` | `express-checkout-processor.ts › ExpressCheckoutProcessor.handleExpressCheckout` | — |
| `Failed to track add_payment_info event:` | `express-checkout-processor.ts › ExpressCheckoutProcessor.handleExpressCheckout` | yes |
| `Failed to reload Spreedly fields:` | `credit-card-service.ts › CreditCardService.clearFields` | yes |
| `[Spreedly] No selector found for field type: {fieldType}` | `credit-card-service.ts › CreditCardService.setCreditCardFieldError` | — |
| `Field element not found for error: {fieldName}` | `field-error-display.ts › displayErrors` | — |
| `Field '{fieldName}' not found for scrolling` | `field-error-display.ts › focusFirstError` | — |
| `Field '{fieldName}' not found for state update` | `field-error-display.ts › updateFieldState` | — |
| `Spreedly field not found: {fieldName}` | `floating-labels.ts › handleSpreedlyFieldFocus` | — |
| `No label found for floating label setup` | `floating-labels.ts › setupFloatingLabel` | — |
| `Cart is empty, redirecting to cart page` | `ui-service.ts › UIService.handleCartUpdate` | — |
| `Field not found for error display: {fieldName}` | `error-display.ts › showError` | — |

## Info

Normal progress, useful for confirming the feature ran at all.

| Message | Source | Extra context |
|---|---|---|
| `Browser autofill detected for fields:` | `autofill-detection.ts › setupAutofillDetection` | yes |
| `Tracked add_shipping_info event (browser autofill)` | `autofill-detection.ts › setupAutofillDetection` | yes |
| `[Billing] Expand complete` | `billing-animation.ts › expandBillingForm` | yes |
| `[Billing] Collapse complete` | `billing-animation.ts › collapseBillingForm` | yes |
| `[Billing] Setting initial state` | `billing-form-setup.ts › setInitialBillingFormState` | yes |
| `[Billing] Initial state: COLLAPSED (checkbox checked)` | `billing-form-setup.ts › setInitialBillingFormState` | — |
| `[Billing] Initial state: EXPANDED (checkbox unchecked)` | `billing-form-setup.ts › setInitialBillingFormState` | — |
| `[Billing] Restored the stored choice: separate billing` | `billing-form-setup.ts › reconcileBillingToggle` | — |
| `[Billing] Restored the stored billing address` | `billing-form-setup.ts › restoreBillingAddressFields` | yes |
| `[Billing] Toggle clicked` | `billing-toggle.ts › handleBillingAddressToggle` | yes |
| `[Billing] Processing toggle` | `billing-toggle.ts › handleBillingAddressToggle` | yes |
| `[Billing] Collapsing form...` | `billing-toggle.ts › handleBillingAddressToggle` | — |
| `[Billing] Expanding form...` | `billing-toggle.ts › handleBillingAddressToggle` | — |
| `[Billing] Adopted the markup choice into the store` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.restoreBillingChoice` | yes |
| `Page restored from bfcache, resetting express checkout state` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupBfcacheRestoreHandler` | — |
| `Resetting processing state after bfcache restore` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupBfcacheRestoreHandler` | — |
| `Resetting payment method from` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupBfcacheRestoreHandler` | yes |
| `Re-initializing credit card service after bfcache restore` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupBfcacheRestoreHandler` | — |
| `Window focused with processing=true, resetting express checkout state` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.setupWindowFocusHandler` | — |
| `Setting campaign shipping countries:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.configureCountryService` | yes |
| `[Spreedly] Payment token received:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeCreditCard` | yes |
| `Order created successfully` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.createOrder` | yes |
| `Processing express checkout for {paymentMethod} (skipping validation)` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleFormSubmit` | — |
| `Express payment {paymentMethod} requires validation (requireValidation: true)` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleFormSubmit` | — |
| `Processing express checkout for {paymentMethod} (after validation)` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleFormSubmit` | — |
| `Tracked add_shipping_info event (address complete)` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.trackAddShippingInfoOnAddress` | yes |
| `Tracked begin_checkout event on checkout form initialization` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.trackBeginCheckout` | — |
| `Shipping country selection priority check (does not affect currency):` | `country-selection.ts › resolveShippingCountry` | yes |
| `✅ Using stored country from previous step: {storedCountry}` | `country-selection.ts › resolveShippingCountry` | — |
| `✅ Using shipping country from URL parameter: {countryCode} (currency unaffected)` | `country-selection.ts › resolveShippingCountry` | — |
| `✅ Using shipping country from session storage: {savedCountryOverride} (currency unaffected)` | `country-selection.ts › resolveShippingCountry` | — |
| `✅ Using detected/default shipping country: {selectedCountryCode} (currency unaffected)` | `country-selection.ts › resolveShippingCountry` | — |
| `Handling country change to: {newCountry}` | `country-selection.ts › applyCountryToAddressForms` | — |
| `Country field updated to: {newCountry}` | `country-selection.ts › applyCountryToAddressForms` | — |
| `Fresh purchase detected, showing attention modal` | `duplicate-purchase-warning.ts › handlePurchaseEvent` | yes |
| `Restoring saved country: {currentCountryValue}` | `form-population.ts › populateFormData` | — |
| `All checkout fields cleared` | `form-population.ts › clearAllCheckoutFields` | — |
| `Tracked add_shipping_info event` | `method-selection.ts › handleShippingMethodChange` | yes |
| `Multi-step checkout detected` | `multi-step-navigation.ts › detectMultiStepCheckout` | yes |
| `Validating step {currentStep} before navigation` | `multi-step-navigation.ts › handleStepNavigation` | — |
| `Step {currentStep} validated successfully, navigating to: {nextStepUrl}` | `multi-step-navigation.ts › handleStepNavigation` | — |
| `[Payment Error] Displaying error:` | `payment-error-display.ts › displayPaymentError` | yes |
| `[Payment Error] Error container shown with message:` | `payment-error-display.ts › displayPaymentError` | yes |
| `Prospect cart created` | `prospect-cart-lifecycle.ts › initializeProspectCart` | yes |
| `Prospect cart abandoned` | `prospect-cart-lifecycle.ts › initializeProspectCart` | yes |
| `createExpressOrder called with:` | `order-manager.ts › OrderManager.createExpressOrder` | yes |
| `Express order data built` | `order-manager.ts › OrderManager.createExpressOrder` | — |
| `Express order created:` | `order-manager.ts › OrderManager.createExpressOrder` | yes |
| `handleOrderRedirect called with order:` | `order-manager.ts › OrderManager.handleOrderRedirect` | yes |
| `Tracked add_payment_info event for express checkout` | `express-checkout-processor.ts › ExpressCheckoutProcessor.handleExpressCheckout` | yes |
| `Express checkout initiated with {method}` | `express-checkout-processor.ts › ExpressCheckoutProcessor.handleExpressCheckout` | — |
| `PayPal error displayed:` | `express-checkout-processor.ts › ExpressCheckoutProcessor.displayPayPalError` | yes |
| `[Spreedly Event: ready] iFrame initialized and ready for configuration` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | — |
| `[Spreedly Event: paymentMethod] Successfully tokenized!` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | yes |
| `[Spreedly Event: validation] Validation requested:` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | yes |
| `[Spreedly] Card number validation changed: {wasValid} -> {validNumber}` | `credit-card-service.ts › CreditCardService.handleSpreedlyFieldEvent` | — |
| `[Spreedly] CVV validation changed: {wasValid} -> {validCvv}` | `credit-card-service.ts › CreditCardService.handleSpreedlyFieldEvent` | — |
| `Tracked add_payment_info event - credit card fields complete` | `credit-card-service.ts › CreditCardService.checkAndTrackPaymentInfo` | — |
| `[Spreedly] Showing errors:` | `credit-card-service.ts › CreditCardService.showSpreedlyErrors` | yes |

## Debug

Only shown with debug mode on (`?debug=true`). Expected in bulk — this is the play-by-play, not a list of problems.

| Message | Source | Extra context |
|---|---|---|
| `Stopped autofill detection after 30 seconds` | `autofill-detection.ts › setupAutofillDetection` | — |
| `[Billing] Starting expand animation` | `billing-animation.ts › expandBillingForm` | yes |
| `[Billing] Measured full height:` | `billing-animation.ts › expandBillingForm` | yes |
| `[Billing] Expand animation started` | `billing-animation.ts › expandBillingForm` | yes |
| `[Billing] Starting collapse animation` | `billing-animation.ts › collapseBillingForm` | yes |
| `[Billing] Collapse animation started` | `billing-animation.ts › collapseBillingForm` | yes |
| `[Billing] No toggle on this page - keeping the stored choice` | `billing-form-setup.ts › reconcileBillingToggle` | — |
| `[Billing] Set country to:` | `billing-toggle.ts › handleBillingAddressToggle` | yes |
| `CheckoutFormEnhancer initialized` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initialize` | — |
| `No campaign shipping countries available, using config` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.configureCountryService` | — |
| `[Spreedly] Credit card service ready` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeCreditCard` | — |
| `[Spreedly] Connected floating label callbacks` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.initializeCreditCard` | — |
| `Express payment config:` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.handleFormSubmit` | yes |
| `Saved user's country selection to session: {value}` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.applyCountrySelection` | — |
| `begin_checkout already tracked, skipping duplicate` | `checkout-form.enhancer.ts › CheckoutFormEnhancer.trackBeginCheckout` | — |
| `Updated user data storage:` | `contact-persistence.ts › persistContactField` | yes |
| `Already shown warning for order` | `duplicate-purchase-warning.ts › handlePurchaseEvent` | yes |
| `Found submit button:` | `field-scanning.ts › scanAllFields` | yes |
| `Converting phone to international format: {phone} -> {internationalNumber}` | `form-population.ts › populateFormData` | — |
| `Restored province: {storedProvince}` | `form-population.ts › populateFormData` | — |
| `Location fields hidden` | `location-field-visibility.ts › hideLocationFields` | — |
| `Location fields shown` | `location-field-visibility.ts › showLocationFields` | — |
| `Billing location fields hidden` | `location-field-visibility.ts › hideBillingLocationFields` | — |
| `Billing location fields shown` | `location-field-visibility.ts › showBillingLocationFields` | — |
| `No shipping location elements found` | `location-field-visibility.ts › initialize` | — |
| `No billing location elements found` | `location-field-visibility.ts › initialize` | — |
| `Location field visibility initialized` | `location-field-visibility.ts › initialize` | yes |
| `Preserving all session parameters in next step URL` | `multi-step-navigation.ts › handleStepNavigation` | — |
| `ProspectCartEnhancer initialized` | `prospect-cart-lifecycle.ts › initializeProspectCart` | — |
| `Reusing existing state loading promise for {country}` | `state-fields.ts › updateStateOptions` | — |
| `Kept autofilled state: {currentProvinceValue}` | `state-fields.ts › updateStateOptions` | — |
| `No valid state found, showing placeholder: Select {stateLabel}` | `state-fields.ts › updateStateOptions` | — |
| `Reusing existing state loading promise for {country} (billing)` | `state-fields.ts › updateBillingStateOptions` | — |
| `createOrder called with:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Creating order with data:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Order data built successfully` | `order-manager.ts › OrderManager.createOrder` | — |
| `Payment method:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Has payment token:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Calling API to create order...` | `order-manager.ts › OrderManager.createOrder` | — |
| `Order created successfully by API:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Payment error detected:` | `order-manager.ts › OrderManager.createOrder` | yes |
| `Creating express order with minimal data:` | `order-manager.ts › OrderManager.createExpressOrder` | yes |
| `createTestOrder called with:` | `order-manager.ts › OrderManager.createTestOrder` | yes |
| `Creating test order with data:` | `order-manager.ts › OrderManager.createTestOrder` | yes |
| `Test order data built` | `order-manager.ts › OrderManager.createTestOrder` | — |
| `Test order created:` | `order-manager.ts › OrderManager.createTestOrder` | yes |
| `handleTokenizedPayment called with token:` | `order-manager.ts › OrderManager.handleTokenizedPayment` | yes |
| `Handling tokenized payment` | `order-manager.ts › OrderManager.handleTokenizedPayment` | yes |
| `Calling createOrderCallback...` | `order-manager.ts › OrderManager.handleTokenizedPayment` | — |
| `Order created via callback:` | `order-manager.ts › OrderManager.handleTokenizedPayment` | yes |
| `Handling order redirect...` | `order-manager.ts › OrderManager.handleTokenizedPayment` | — |
| `Getting order status for:` | `order-manager.ts › OrderManager.getOrderStatus` | yes |
| `Order status retrieved:` | `order-manager.ts › OrderManager.getOrderStatus` | yes |
| `CreditCardService created with config:` | `credit-card-service.ts › CreditCardService.constructor` | yes |
| `CreditCardService already initialized, skipping` | `credit-card-service.ts › CreditCardService.initialize` | — |
| `Credit card fields not found, skipping Spreedly initialization` | `credit-card-service.ts › CreditCardService.initialize` | — |
| `CreditCardService initialized successfully` | `credit-card-service.ts › CreditCardService.initialize` | — |
| `Tokenizing credit card` | `credit-card-service.ts › CreditCardService.tokenizeCard` | — |
| `Spreedly fields reloaded` | `credit-card-service.ts › CreditCardService.clearFields` | — |
| `Focusing {field} field` | `credit-card-service.ts › CreditCardService.focusField` | — |
| `Credit card fields found:` | `credit-card-service.ts › CreditCardService.findCreditCardFields` | yes |
| `Spreedly already loaded` | `credit-card-service.ts › CreditCardService.loadSpreedlyScript` | — |
| `Loading Spreedly script...` | `credit-card-service.ts › CreditCardService.loadSpreedlyScript` | — |
| `Spreedly script loaded` | `credit-card-service.ts › CreditCardService.loadSpreedlyScript` | — |
| `Spreedly setup complete` | `credit-card-service.ts › CreditCardService.setupSpreedly` | — |
| `Transferring focus to credit card number field` | `credit-card-service.ts › CreditCardService.setupFieldClickHandlers` | — |
| `Transferring focus to CVV field` | `credit-card-service.ts › CreditCardService.setupFieldClickHandlers` | — |
| `[Spreedly] Invoking token callback` | `credit-card-service.ts › CreditCardService.setupSpreedlyEventListeners` | — |
| `Spreedly configuration applied:` | `credit-card-service.ts › CreditCardService.applySpreedlyConfig` | yes |
| `Cleared placeholder for {name} field (label floating up)` | `credit-card-service.ts › CreditCardService.handleSpreedlyFieldEvent` | — |
| `Restored placeholder for {name} field (label floating down)` | `credit-card-service.ts › CreditCardService.handleSpreedlyFieldEvent` | — |
| `Field focused: {fieldName}` | `credit-card-service.ts › CreditCardService.handleFieldFocus` | — |
| `Field blurred: {fieldName}` | `credit-card-service.ts › CreditCardService.handleFieldBlur` | — |
| `[Spreedly] Error displayed with message:` | `credit-card-service.ts › CreditCardService.showSpreedlyErrors` | yes |
| `[Spreedly] Error auto-hidden after 10 seconds` | `credit-card-service.ts › CreditCardService.showSpreedlyErrors` | — |
| `[Spreedly] Setting error for field: {fieldType} - {message}` | `credit-card-service.ts › CreditCardService.setCreditCardFieldError` | — |
| `[Spreedly] Added error label: {message}` | `credit-card-service.ts › CreditCardService.setCreditCardFieldError` | — |
| `[Spreedly] Clearing error for field: {fieldType}` | `credit-card-service.ts › CreditCardService.clearCreditCardFieldError` | — |
| `[Spreedly] Removing error label: {textContent}` | `credit-card-service.ts › CreditCardService.clearCreditCardFieldError` | — |
| `CreditCardService destroyed` | `credit-card-service.ts › CreditCardService.destroy` | — |
| `Could not focus field after scroll:` | `field-error-display.ts › focusFirstError` | yes |
| `Scrolled to field: {fieldName}` | `field-error-display.ts › focusFirstError` | — |
| `Updated field {fieldName} state to: {state}` | `field-error-display.ts › updateFieldState` | — |
| `Enhanced accessibility features` | `field-error-display.ts › enhanceAccessibility` | — |
| `Initializing floating labels` | `floating-labels.ts › initializeFloatingLabels` | — |
| `Initialized {size} floating labels` | `floating-labels.ts › initializeFloatingLabels` | — |
| `Set up Spreedly floating label for credit card number` | `floating-labels.ts › setupSpreedlyFloatingLabels` | — |
| `Set up Spreedly floating label for CVV` | `floating-labels.ts › setupSpreedlyFloatingLabels` | — |
| `Spreedly field focused: {fieldName}` | `floating-labels.ts › handleSpreedlyFieldFocus` | — |
| `Spreedly field blurred: {fieldName}, hasValue: {hasValue}` | `floating-labels.ts › handleSpreedlyFieldBlur` | — |
| `Spreedly field input: {fieldName}, hasValue: {hasValue}` | `floating-labels.ts › handleSpreedlyFieldInput` | — |
| `Set up floating label for field:` | `floating-labels.ts › setupFloatingLabel` | yes |
| `Added has-value class for field ({reason}):` | `floating-labels.ts › floatLabelUp` | yes |
| `Removed has-value class for field:` | `floating-labels.ts › floatLabelDown` | yes |
| `Updated all floating labels for populated data` | `floating-labels.ts › updateLabelsForPopulatedData` | — |
| `Handled responsive UI adjustments for {isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'}` | `floating-labels.ts › handleResponsiveUI` | — |
| `Showing loading state for section: {section}` | `loading-state.ts › showLoading` | — |
| `Hiding loading state for section: {section}` | `loading-state.ts › hideLoading` | — |
| `Updated progress to step: {step}` | `loading-state.ts › updateProgress` | — |
| `Initializing payment forms` | `payment-form-display.ts › initializePaymentForms` | — |
| `Payment method from store:` | `payment-form-display.ts › initializePaymentForms` | yes |
| `Expanded payment method: {methodType} (store: {storePaymentMethod})` | `payment-form-display.ts › initializePaymentForms` | — |
| `Collapsed payment method: {methodType}` | `payment-form-display.ts › initializePaymentForms` | — |
| `Updating payment form visibility for method:` | `payment-form-display.ts › updatePaymentFormVisibility` | yes |
| `Payment method {value}: {isSelected ? 'selected' : 'not selected'}` | `payment-form-display.ts › updatePaymentFormVisibility` | — |
| `Expanded payment form` | `payment-form-display.ts › expandPaymentForm` | — |
| `Collapsed payment form` | `payment-form-display.ts › collapsePaymentForm` | — |
| `Cleared payment form errors` | `payment-form-display.ts › clearPaymentFormErrors` | — |
| `UIService initialized` | `ui-service.ts › UIService.initialize` | — |
| `UIService destroyed` | `ui-service.ts › UIService.destroy` | — |
| `CheckoutValidator destroyed` | `checkout-validator.ts › CheckoutValidator.destroy` | — |
| `Showing error for field {fieldName}:` | `error-display.ts › showError` | yes |

The **Extra context** column says whether the call passes a second argument — an object or an error logged alongside the message. Expand that entry in the console to see it; the message alone will not tell you which element or package was involved.
