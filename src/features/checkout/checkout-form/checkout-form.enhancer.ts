/**
 * Checkout Form Enhancer - Consolidated but complete functionality using CheckoutValidator
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';
import { useCartStore, cartOperations } from '@/state/cart';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { ApiClient } from '@/api/client';
import { CountryService, type Country, type CountryConfig } from '@/core/country-service';
import { preserveQueryParams } from '@/core/url-utils';
import type { CartState } from '@/types/global';
import { CreditCardService, type CreditCardData } from '../services/credit-card-service';
import { CheckoutValidator } from '../validation/checkout-validator';
import { UIService } from '../services/ui-service';
import { useAttributionStore } from '@/state/attribution';
import { useParameterStore } from '@/state/parameter';
import type { CreateOrder, Address, Payment, Attribution, PaymentMethod } from '@/types/api';
import { AddressAutocompleteEnhancer } from '../address-autocomplete/address-autocomplete.enhancer';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
import { GeneralModal } from '@/core/ui/general-modal';
import { LoadingOverlay } from '@/core/ui/loading-overlay';
import { ExpressCheckoutProcessor } from '../processors/express-checkout-processor';
import { OrderManager } from '../managers/order-manager';
import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import { userDataStorage } from '@/core/analytics/userDataStorage';
import {
  injectIntlTelInputStyles,
  initializePhoneInputs,
  type PhoneInputContext,
} from './phone-input';
import {
  collapseBillingForm,
  expandBillingForm,
  type BillingAnimationContext,
} from './billing-animation';
import {
  scanBillingFields,
  setupBillingForm,
  type BillingFormSetupContext,
} from './billing-form-setup';
import {
  populateExpirationFields,
  scanExpirationFields,
  type ExpirationFieldsContext,
} from './expiration-fields';
import {
  populateBillingCountryDropdown,
  populateCountryDropdown,
  updateBillingFormLabels,
  updateFormLabels,
  type CountryFieldsContext,
} from './country-fields';
import {
  updateBillingStateOptions,
  updateStateOptions,
  type ShippingStateFieldsContext,
  type StateFieldsContext,
} from './state-fields';
import {
  setupAutofillDetection,
  type AutofillDetectionContext,
} from './autofill-detection';
import {
  updateFieldValidationDisplay,
  type FieldValidationContext,
} from './field-validation-display';
import 'intl-tel-input/build/css/intlTelInput.css';

// Consolidated constants
const FIELD_SELECTORS = ['[data-next-checkout-field]', '[os-checkout-field]'] as const;
const BILLING_CONTAINER_SELECTOR = '[os-checkout-element="different-billing-address"], [data-next-component="different-billing-address"]';
const SHIPPING_FORM_SELECTOR = '[os-checkout-component="shipping-form"], [data-next-component="shipping-form"]';
const BILLING_FORM_CONTAINER_SELECTOR = '[os-checkout-component="billing-form"], [data-next-component="billing-form"]';

const PAYMENT_METHOD_MAP: Record<string, 'card_token' | 'paypal' | 'apple_pay' | 'google_pay' | 'klarna' | 'credit-card'> = {
  'credit': 'credit-card',
  'paypal': 'paypal',
  'apple-pay': 'apple_pay',
  'google-pay': 'google_pay',
  'klarna': 'klarna'
};

const API_PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  'credit-card': 'card_token',
  'card_token': 'card_token',
  'paypal': 'paypal',
  'apple_pay': 'apple_pay',
  'google_pay': 'google_pay',
  'klarna': 'klarna'
};


const BILLING_ADDRESS_FIELD_MAP: Record<string, string> = {
  'fname': 'first_name',
  'lname': 'last_name',
  'address1': 'address1',
  'address2': 'address2',
  'city': 'city',
  'province': 'province',
  'postal': 'postal',
  'country': 'country',
  'phone': 'phone'
};

export class CheckoutFormEnhancer extends BaseEnhancer {
  private form!: HTMLFormElement;
  private apiClient!: ApiClient;
  private countryService!: CountryService;
  private creditCardService?: CreditCardService;
  private validator!: CheckoutValidator;
  private stateLoadingPromises: Map<string, Promise<any>> = new Map();
  private ui!: UIService;
  private prospectCartEnhancer?: ProspectCartEnhancer;
  private loadingOverlay: LoadingOverlay;
  private expressProcessor?: ExpressCheckoutProcessor;
  private orderManager?: OrderManager;

  constructor(element: HTMLElement) {
    super(element);
    this.loadingOverlay = new LoadingOverlay();
  }

  // Field collections
  private fields: Map<string, HTMLElement> = new Map();
  private billingFields: Map<string, HTMLElement> = new Map();
  private paymentButtons: Map<string, HTMLElement> = new Map();
  private submitButton?: HTMLButtonElement;

  // Country/State management
  private countries: Country[] = [];
  private countryConfigs: Map<string, CountryConfig> = new Map();
  /** Ref, shared with `state-fields.ts` — see its context docs. */
  private currentCountryConfig: { value: CountryConfig | undefined } = {
    value: undefined,
  };
  private detectedCountryCode: string = 'US';
  private autocompleteEnhancer?: AddressAutocompleteEnhancer;

  // Phone input management
  private phoneInputs: Map<string, any> = new Map();
  private isIntlTelInputAvailable = false;

  // Location field visibility management
  private locationElements: NodeListOf<Element> | null = null;
  private billingLocationElements: NodeListOf<Element> | null = null;
  private locationFieldsShown: boolean = false;
  private billingLocationFieldsShown: boolean = false;

  // Event handlers
  private submitHandler?: (event: Event) => void;
  private changeHandler?: (event: Event) => void;
  private paymentMethodChangeHandler?: (event: Event) => void;
  private shippingMethodChangeHandler?: (event: Event) => void;
  private billingAddressToggleHandler?: (event: Event) => void;
  private boundHandleTestDataFilled?: EventListener;
  private boundHandleKonamiActivation?: EventListener;

  // Animation state management
  /**
   * Shared with `billing-animation.ts` as a ref, not a boolean: both that module and
   * { handleBillingAddressToggle} read and write it, and a copied primitive would
   * give each side its own flag.
   */
  private billingAnimationInProgress = { value: false };
  private billingAnimationDebounceTimer?: NodeJS.Timeout;
  private billingAnimationTimeouts: Set<NodeJS.Timeout> = new Set();
  /**
   * Aborts the in-flight billing `transitionend` listener. Held here, alongside the
   * timers above, so `destroy()` can drop it — see `billing-animation.ts`.
   */
  private billingListenerAbort: { value: AbortController | null } = {
    value: null,
  };

  // Track if analytics events have been fired
  /** Ref, shared with `autofill-detection.ts` so the event cannot fire twice. */
  private hasTrackedShippingInfo = { value: false };
  /**
   * Stops autofill detection: clears its poll **and** unsubscribes it from the event bus.
   * Was an untyped `(this as any)` stash holding only the interval.
   */
  private stopAutofillDetection?: () => void;
  private hasTrackedBeginCheckout = false;

  // Multi-step checkout support
  private isMultiStep = false;
  private currentStep = 1;
  private nextStepUrl?: string;

  public async initialize(): Promise<void> {
    this.validateElement();

    if (!(this.element instanceof HTMLFormElement)) {
      throw new Error('CheckoutFormEnhancer must be applied to a form element');
    }

    this.form = this.element;
    this.form.noValidate = true;

    // Inject intl-tel-input CSS variables for flag/globe images
    injectIntlTelInputStyles();

    // Check if this is a multi-step checkout
    this.detectMultiStepCheckout();

    // Initialize loading overlay
    this.loadingOverlay = new LoadingOverlay();

    // NOTE: Currency is initialized separately based on:
    // 1. URL parameter (?currency=XXX) - highest priority
    // 2. Session storage (previous selection) - medium priority  
    // 3. Detected location - lowest priority
    // Currency does NOT change when shipping/billing country changes

    // Initialize core dependencies
    const config = useConfigStore.getState();
    this.apiClient = new ApiClient(config.apiKey);
    this.countryService = CountryService.getInstance();

    // Re-initialize attribution to ensure we have current page data
    const attributionStore = useAttributionStore.getState();
    await attributionStore.initialize();

    // Initialize OrderManager and ExpressCheckoutProcessor
    this.orderManager = new OrderManager(
      this.apiClient,
      this.logger,
      (event: string, data: any) => this.emit(event as any, data)
    );

    this.expressProcessor = new ExpressCheckoutProcessor(
      this.logger,
      () => this.loadingOverlay.show(),
      (immediate?: boolean) => this.loadingOverlay.hide(immediate),
      (event: string, data: any) => this.emit(event as any, data),
      this.orderManager
    );

    // intl-tel-input is now bundled with the SDK - always available
    this.isIntlTelInputAvailable = true;

    // Initialize validator
    this.validator = new CheckoutValidator(
      this.logger,
      this.countryService,
      undefined // PhoneInputManager will be handled by us
    );

    // Scan for all fields and buttons
    this.scanAllFields();

    // Setup billing form (clone from shipping if needed)
    const billingFormCloned = setupBillingForm(this.billingFormSetupContext());
    if (billingFormCloned) {
      scanBillingFields(this.billingFormSetupContext()); // Re-scan after cloning
    }

    // Initialize UI service
    this.ui = new UIService(
      this.form,
      this.fields,
      this.logger,
      this.billingFields
    );
    this.ui.initialize();

    // Initialize payment forms to sync with DOM state
    this.ui.initializePaymentForms();

    // Initialize credit card service
    if (config.spreedlyEnvironmentKey) {
      await this.initializeCreditCard(config.spreedlyEnvironmentKey, config.debug);
    }

    // Initialize address/country functionality
    await this.initializeAddressManagement(config);

    // Initialize phone inputs
    this.initializePhoneInputs();

    // Set up phone validation callback for validator after phone inputs are initialized
    this.validator.setPhoneValidator((phoneNumber: string, type: 'shipping' | 'billing' = 'shipping') => {
      const instance = this.phoneInputs.get(type);
      if (instance) {
        return instance.isValidNumber();
      }

      // Fallback to basic validation if instance not found
      return /^[\d\s\-\+\(\)]+$/.test(phoneNumber);
    });

    // Populate expiration fields
    populateExpirationFields(this.expirationFieldsContext());

    // Setup event handlers
    this.setupEventHandlers();

    // Subscribe to store changes
    this.subscribe(useCheckoutStore, this.handleCheckoutUpdate.bind(this));
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.subscribe(useConfigStore, this.handleConfigUpdate.bind(this));

    // Setup debug event listeners
    this.boundHandleTestDataFilled = this.handleTestDataFilled.bind(this);
    this.boundHandleKonamiActivation = this.handleKonamiActivation.bind(this);
    document.addEventListener('checkout:test-data-filled', this.boundHandleTestDataFilled as EventListener);
    document.addEventListener('next:test-mode-activated', this.boundHandleKonamiActivation as EventListener);

    // Initialize form with existing data
    await this.populateFormData();

    // Initialize location field visibility
    this.initializeLocationFieldVisibility();

    // Initialize ProspectCartEnhancer
    await this.initializeProspectCart();

    // Listen for payment errors from other components
    this.eventBus.on('payment:error', (event: any) => {
      if (event.message) {
        this.displayPaymentError(event.message);
      }
    });

    // Listen for country changes from debug selector
    document.addEventListener('next:country-changed', async (e) => {
      const customEvent = e as CustomEvent;
      const { to: newCountry } = customEvent.detail;
      if (newCountry) {
        await this.handleCountryChange(newCountry);
      }
    });

    // Handle page restoration from bfcache (back/forward navigation)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted ||
        (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'back_forward') {
        // Page was restored from bfcache
        this.logger.info('Page restored from bfcache, resetting express checkout state');

        // Hide loading overlay immediately when coming back
        this.loadingOverlay.hide(true);

        const checkoutStore = useCheckoutStore.getState();

        // Reset processing state if needed
        if (checkoutStore.isProcessing) {
          this.logger.info('Resetting processing state after bfcache restore');
          checkoutStore.setProcessing(false);
        }

        // Always reset express payment methods when returning from bfcache
        // This handles cases where user pressed back from Apple Pay/Google Pay/PayPal
        if (checkoutStore.paymentMethod === 'apple_pay' ||
          checkoutStore.paymentMethod === 'google_pay' ||
          checkoutStore.paymentMethod === 'paypal') {
          this.logger.info('Resetting payment method from', checkoutStore.paymentMethod, 'to credit-card after bfcache restore');
          checkoutStore.setPaymentMethod('credit-card');
          checkoutStore.setPaymentToken(''); // Clear any stale payment token
        }

        // Re-initialize credit card service if needed
        if (this.creditCardService && config.spreedlyEnvironmentKey) {
          this.logger.info('Re-initializing credit card service after bfcache restore');
          this.creditCardService.initialize().catch(error => {
            this.logger.error('Failed to re-initialize credit card service:', error);
          });
        }

        // Check for fresh purchase event
        this.handlePurchaseEvent();
      }
    });

    // Handle window focus to reset express checkout state when user returns
    // This catches cases where the user cancels PayPal/etc without triggering pageshow
    window.addEventListener('focus', () => {
      const checkoutStore = useCheckoutStore.getState();

      // Only reset if we're in processing state (likely from express checkout)
      if (checkoutStore.isProcessing) {
        this.logger.info('Window focused with processing=true, resetting express checkout state');

        // Hide loading overlay
        this.loadingOverlay.hide(true);

        // Reset processing state
        checkoutStore.setProcessing(false);

        // Reset payment method back to credit-card if it's an express method
        if (checkoutStore.paymentMethod === 'apple_pay' ||
          checkoutStore.paymentMethod === 'google_pay' ||
          checkoutStore.paymentMethod === 'paypal') {
          this.logger.info('Resetting payment method from', checkoutStore.paymentMethod, 'to credit-card');
          checkoutStore.setPaymentMethod('credit-card');
          checkoutStore.setPaymentToken('');
        }
      }
    });

    // Check for fresh purchase on initial load
    this.handlePurchaseEvent();

    // Track begin_checkout event - only from here, nowhere else
    // Small delay to ensure analytics providers are ready
    setTimeout(() => {
      this.trackBeginCheckout();
    }, 500);

    this.logger.debug('CheckoutFormEnhancer initialized');
    this.emit('checkout:form-initialized', { form: this.form });
  }

  // ============================================================================
  // FIELD SCANNING AND MANAGEMENT
  // ============================================================================

  private scanAllFields(): void {
    // Scan checkout fields
    FIELD_SELECTORS.forEach(selector => {
      this.form.querySelectorAll(selector).forEach(element => {
        const fieldName = element.getAttribute(selector.includes('data-next') ? 'data-next-checkout-field' : 'os-checkout-field');
        if (fieldName && element instanceof HTMLElement) {
          this.fields.set(fieldName, element);
        }
      });
    });

    // Find submit button
    const submitButton = this.form.querySelector('button[type="submit"]') ||
      this.form.querySelector('[data-next-checkout-submit]') ||
      this.form.querySelector('[os-checkout-submit]');
    if (submitButton instanceof HTMLButtonElement) {
      this.submitButton = submitButton;
      this.logger.debug('Found submit button:', submitButton);
    } else {
      this.logger.warn('Submit button not found in checkout form');
    }

    // Scan payment buttons
    const paymentSelectors = [
      '[data-next-checkout-payment]',
      '[os-checkout-payment]'
    ];
    paymentSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        const paymentMethod = element.getAttribute(selector.includes('data-next') ? 'data-next-checkout-payment' : 'os-checkout-payment');
        if (paymentMethod && element instanceof HTMLElement) {
          this.paymentButtons.set(paymentMethod, element);
        }
      });
    });

    // Scan for expiration fields and add them if not found
    scanExpirationFields(this.expirationFieldsContext());
  }



  // ============================================================================
  // BILLING FORM MANAGEMENT
  // ============================================================================




  // ============================================================================
  // ADDRESS AND COUNTRY MANAGEMENT
  // ============================================================================

  private async initializeAddressManagement(config: any): Promise<void> {
    try {
      this.addClass('next-loading-countries');

      if (config.addressConfig) {
        this.countryService.setConfig(config.addressConfig);
      }

      // IMPORTANT: Set campaign shipping countries from campaign API
      // This takes priority over showCountries in addressConfig
      const campaignState = useCampaignStore.getState();
      if (campaignState.data?.available_shipping_countries) {
        this.logger.info('Setting campaign shipping countries:', campaignState.data.available_shipping_countries);
        this.countryService.setCampaignShippingCountries(campaignState.data.available_shipping_countries);
      } else {
        this.logger.debug('No campaign shipping countries available, using config');
      }

      // Check if autocomplete should be enabled
      const googleMapsConfig = config.googleMapsConfig || {};
      const enableGoogleMaps = googleMapsConfig.enableAutocomplete !== false && !!googleMapsConfig.apiKey;
      const enableNextCommerce = config.addressConfig?.enableAutocomplete === true && !!config.apiKey;

      this.autocompleteEnhancer = new AddressAutocompleteEnhancer({
        fields: this.fields,
        billingFields: this.billingFields,
        apiClient: this.apiClient,
        getDetectedCountryCode: () => this.detectedCountryCode,
        getHasTrackedShippingInfo: () => this.hasTrackedShippingInfo.value,
        setHasTrackedShippingInfo: (value) => { this.hasTrackedShippingInfo.value = value; },
      });


      const locationData = await this.countryService.getLocationData();
      this.countries = locationData.countries;

      // Check for shipping country override from URL or sessionStorage
      // NOTE: This only affects the shipping country dropdown, NOT currency
      let selectedCountryCode = locationData.detectedCountryCode;

      const countryConfig = this.countryService.getConfig();
      const checkoutStore = useCheckoutStore.getState();
      const storedCountry = checkoutStore.formData.country;

      this.logger.info('Shipping country selection priority check (does not affect currency):', {
        detectedCountry: locationData.detectedCountryCode,
        addressConfigDefault: countryConfig?.defaultCountry,
        storedCountry: storedCountry,
        urlParam: new URLSearchParams(window.location.search).get('country'),
        sessionOverride: sessionStorage.getItem('next_selected_country')
      });

      // Priority 1: Stored country from checkoutStore (from previous step)
      if (storedCountry) {
        const countryExists = this.countries.some(c => c.code === storedCountry);
        if (countryExists) {
          selectedCountryCode = storedCountry;
          this.logger.info(`✅ Using stored country from previous step: ${storedCountry}`);
        } else {
          this.logger.warn(`Stored country ${storedCountry} not in available countries`);
        }
      }
      // Priority 2: URL parameter (?country=XX for shipping destination)
      else {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCountry = urlParams.get('country');
        if (urlCountry) {
          const countryCode = urlCountry.toUpperCase();
          // Verify the country exists in the available countries
          const countryExists = this.countries.some(c => c.code === countryCode);
          if (countryExists) {
            selectedCountryCode = countryCode;
            // Save to sessionStorage for persistence
            sessionStorage.setItem('next_selected_country', countryCode);
            this.logger.info(`✅ Using shipping country from URL parameter: ${countryCode} (currency unaffected)`);
          } else {
            this.logger.warn(`Country ${countryCode} from URL not in available countries`);
          }
        }
        // Priority 3: sessionStorage override (from previous URL param or user selection)
        else {
          const savedCountryOverride = sessionStorage.getItem('next_selected_country');
          if (savedCountryOverride) {
            const countryExists = this.countries.some(c => c.code === savedCountryOverride);
            if (countryExists) {
              selectedCountryCode = savedCountryOverride;
              this.logger.info(`✅ Using shipping country from session storage: ${savedCountryOverride} (currency unaffected)`);
            } else {
              this.logger.warn(`Saved country ${savedCountryOverride} not in available countries`);
            }
          } else {
            this.logger.info(`✅ Using detected/default shipping country: ${selectedCountryCode} (currency unaffected)`);
          }
        }
      }

      this.detectedCountryCode = selectedCountryCode;

      const countryField = this.fields.get('country');
      if (countryField instanceof HTMLSelectElement) {
        populateCountryDropdown(countryField, locationData.countries, selectedCountryCode);

        if (selectedCountryCode) {
          this.updateFormData({ country: selectedCountryCode });
          this.clearError('country');
        }
      }

      // NOTE: We don't need to fetch config here because updateStateOptions()
      // will fetch the correct country config (line 1336) and update form labels (line 1340)
      // This ensures postcode label/regex/validation always matches the selected country

      // IMPORTANT: Save stored province before loading states (updateStateOptions clears it)
      const storedProvince = checkoutStore.formData.province;

      if (selectedCountryCode) {
        const provinceField = this.fields.get('province');
        if (provinceField instanceof HTMLSelectElement) {
          // updateStateOptions fetches the correct country config and updates form labels
          await updateStateOptions(this.shippingStateFieldsContext(), selectedCountryCode, provinceField);
          // this.currentCountryConfig.value is already set by updateStateOptions (line 1337)

          // Restore stored province after states are loaded (if country matches)
          if (storedProvince && storedCountry === selectedCountryCode) {
            const optionExists = Array.from(provinceField.options).some(opt => opt.value === storedProvince);
            if (optionExists) {
              provinceField.value = storedProvince;
              this.updateFormData({ province: storedProvince });
            }
          }
        }

        // updateFormLabels is already called by updateStateOptions (line 1340)
        // No need to call it again here
      }

      if (this.billingFields.size > 0) {
        populateBillingCountryDropdown(this.countryFieldsContext());
      }

      // Initialize address autocomplete
      await this.autocompleteEnhancer!.initialize({ enableGoogleMaps, enableNextCommerce });

    } catch (error) {
      this.logger.error('Failed to load country data:', error);
    } finally {
      this.removeClass('next-loading-countries');
    }
  }


  private async handleCountryChange(newCountry: string): Promise<void> {
    this.logger.info(`Handling country change to: ${newCountry}`);

    // Update the country dropdown
    const countryField = this.fields.get('country');
    if (countryField instanceof HTMLSelectElement) {
      countryField.value = newCountry;

      // Update form data in checkout store
      this.updateFormData({ country: newCountry });

      // Update state options for the new country
      const provinceField = this.fields.get('province');
      if (provinceField instanceof HTMLSelectElement) {
        await updateStateOptions(this.shippingStateFieldsContext(), newCountry, provinceField);
      }

      // Trigger change event to update any dependent fields
      countryField.dispatchEvent(new Event('change', { bubbles: true }));

      this.logger.info(`Country field updated to: ${newCountry}`);
    }

    // Also update billing country if billing form is visible
    const billingCountryField = this.billingFields.get('billing-country');
    if (billingCountryField instanceof HTMLSelectElement) {
      billingCountryField.value = newCountry;

      // Update billing state options
      const billingProvinceField = this.billingFields.get('billing-province');
      if (billingProvinceField instanceof HTMLSelectElement) {
        // Pass the shipping province value if "same as shipping" is checked
        const checkoutStore = useCheckoutStore.getState();
        const shippingProvince = checkoutStore.sameAsShipping ? checkoutStore.formData.province : undefined;
        await updateBillingStateOptions(this.stateFieldsContext(), newCountry, billingProvinceField, shippingProvince);
      }

      billingCountryField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }



  // ============================================================================
  // LOCATION FIELD VISIBILITY MANAGEMENT
  // ============================================================================

  private initializeLocationFieldVisibility(): void {
    // Find all location elements - check both possible attributes
    this.locationElements = this.form.querySelectorAll('[data-next-component="location"], [data-next-component-location="location"]');

    // Also find billing location elements
    this.billingLocationElements = this.form.querySelectorAll('[data-next-component="billing-location"]');

    if (!this.locationElements || this.locationElements.length === 0) {
      this.logger.debug('No shipping location elements found');
    }

    if (!this.billingLocationElements || this.billingLocationElements.length === 0) {
      this.logger.debug('No billing location elements found');
    }

    // Hide location fields initially
    this.hideLocationFields();
    this.hideBillingLocationFields();

    // Set up address field listeners for shipping
    const addressField = this.fields.get('address1');
    if (addressField instanceof HTMLInputElement) {
      // Listen for changes on address1 field
      addressField.addEventListener('input', this.handleAddressInput.bind(this));
      addressField.addEventListener('change', this.handleAddressInput.bind(this));
      addressField.addEventListener('blur', this.handleAddressInput.bind(this));

      // Check initial state
      if (addressField.value && addressField.value.trim().length > 0) {
        this.showLocationFields();
      }
    }

    // Set up address field listeners for billing
    const billingAddressField = this.billingFields?.get('billing-address1');
    if (billingAddressField instanceof HTMLInputElement) {
      // Listen for changes on billing address1 field
      billingAddressField.addEventListener('input', this.handleBillingAddressInput.bind(this));
      billingAddressField.addEventListener('change', this.handleBillingAddressInput.bind(this));
      billingAddressField.addEventListener('blur', this.handleBillingAddressInput.bind(this));

      // Check initial state
      if (billingAddressField.value && billingAddressField.value.trim().length > 0) {
        this.showBillingLocationFields();
      }
    }

    // Listen for autocomplete fill events
    this.eventBus.on('address:autocomplete-filled', (event: any) => {
      if (event.type === 'shipping') {
        this.showLocationFields();
      } else if (event.type === 'billing') {
        this.showBillingLocationFields();
      }
    });

    // Listen for address field changes via store updates
    const checkoutStore = useCheckoutStore.getState();
    if (checkoutStore.formData.address1 && checkoutStore.formData.address1.trim().length > 0) {
      this.showLocationFields();
    }
    if (checkoutStore.formData['billing-address1'] && checkoutStore.formData['billing-address1'].trim().length > 0) {
      this.showBillingLocationFields();
    }

    this.logger.debug('Location field visibility initialized', {
      shippingLocationElementsCount: this.locationElements?.length || 0,
      billingLocationElementsCount: this.billingLocationElements?.length || 0
    });
  }

  private handleAddressInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.value && field.value.trim().length > 0) {
      this.showLocationFields();
    }
  }

  private handleBillingAddressInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    if (field.value && field.value.trim().length > 0) {
      this.showBillingLocationFields();
    }
  }

  private hideLocationFields(): void {
    if (!this.locationElements) return;

    this.locationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
        el.classList.add('next-location-hidden');
      }
    });

    this.locationFieldsShown = false;
    this.logger.debug('Location fields hidden');
  }

  private showLocationFields(): void {
    if (this.locationFieldsShown || !this.locationElements) return;

    this.locationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'flex';
        el.classList.remove('next-location-hidden');
      }
    });

    this.locationFieldsShown = true;

    // Emit event for other components
    this.eventBus.emit('checkout:location-fields-shown', {});
    this.form.dispatchEvent(new CustomEvent('checkout:location-fields-shown'));

    this.logger.debug('Location fields shown');
  }

  private hideBillingLocationFields(): void {
    if (!this.billingLocationElements) return;

    this.billingLocationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
        el.classList.add('next-location-hidden');
      }
    });

    this.billingLocationFieldsShown = false;
    this.logger.debug('Billing location fields hidden');
  }

  private showBillingLocationFields(): void {
    if (this.billingLocationFieldsShown || !this.billingLocationElements) return;

    this.billingLocationElements.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'flex';
        el.classList.remove('next-location-hidden');
      }
    });

    this.billingLocationFieldsShown = true;

    // Emit event for other components
    this.eventBus.emit('checkout:billing-location-fields-shown', {});
    this.form.dispatchEvent(new CustomEvent('checkout:billing-location-fields-shown'));

    this.logger.debug('Billing location fields shown');
  }

  // ============================================================================
  // PROSPECT CART MANAGEMENT
  // ============================================================================

  private async initializeProspectCart(): Promise<void> {
    try {
      // Initialize ProspectCartEnhancer with email entry trigger
      this.prospectCartEnhancer = new ProspectCartEnhancer(this.form);

      // Configure it to trigger on email entry
      await this.prospectCartEnhancer.initialize();

      // Listen for prospect cart events
      this.form.addEventListener('next:prospect-cart-created', (event: Event) => {
        const customEvent = event as CustomEvent;
        this.logger.info('Prospect cart created', customEvent.detail);
      });

      this.form.addEventListener('next:prospect-cart-abandoned', (event: Event) => {
        const customEvent = event as CustomEvent;
        this.logger.info('Prospect cart abandoned', customEvent.detail);
      });

      this.logger.debug('ProspectCartEnhancer initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize ProspectCartEnhancer:', error);
      // Don't throw - prospect cart is not critical for checkout
    }
  }

  // ============================================================================
  // PHONE INPUT MANAGEMENT
  // ============================================================================


  /** The two things `field-validation-display.ts` needs from this form. */
  private fieldValidationContext(): FieldValidationContext {
    return {
      validator: this.validator,
      getFieldByName: name => this.getFieldByName(name),
    };
  }

  /** The four things `autofill-detection.ts` needs from this form. */
  private autofillDetectionContext(): AutofillDetectionContext {
    return {
      eventBus: this.eventBus,
      fields: this.fields,
      hasTrackedShippingInfo: this.hasTrackedShippingInfo,
      logger: this.logger,
    };
  }

  /** What both state-field paths need. Shipping needs more — see below. */
  private stateFieldsContext(): StateFieldsContext {
    return {
      stateLoadingPromises: this.stateLoadingPromises,
      countryService: this.countryService,
      logger: this.logger,
      countryFields: this.countryFieldsContext(),
    };
  }

  /**
   * The shipping path additionally writes form data, clears the province error, and
   * caches the resolved country config — eight things, the largest context in this
   * folder. That size is the honest measure of how entangled filling this one field is.
   */
  private shippingStateFieldsContext(): ShippingStateFieldsContext {
    return {
      ...this.stateFieldsContext(),
      countryConfigs: this.countryConfigs,
      currentCountryConfig: this.currentCountryConfig,
      updateFormData: data => this.updateFormData(data),
      clearError: field => this.clearError(field),
    };
  }

  /** The four things `country-fields.ts` needs from this form. */
  private countryFieldsContext(): CountryFieldsContext {
    return {
      form: this.form,
      fields: this.fields,
      billingFields: this.billingFields,
      countries: this.countries,
    };
  }

  /** The one thing `expiration-fields.ts` needs from this form. */
  private expirationFieldsContext(): ExpirationFieldsContext {
    return { fields: this.fields };
  }

  /** The three things `billing-form-setup.ts` needs from this form. */
  private billingFormSetupContext(): BillingFormSetupContext {
    return {
      form: this.form,
      billingFields: this.billingFields,
      logger: this.logger,
    };
  }

  /** The three things `billing-animation.ts` needs from this form. */
  private billingAnimationContext(): BillingAnimationContext {
    return {
      inProgress: this.billingAnimationInProgress,
      timeouts: this.billingAnimationTimeouts,
      listenerAbort: this.billingListenerAbort,
      logger: this.logger,
    };
  }

  /**
   * The seven things `phone-input.ts` needs from this form.
   *
   * Built fresh per call rather than cached: `fields` and `billingFields` are repopulated
   * as the form scans the DOM, and `detectedCountryCode` changes once location resolves,
   * so a context captured at construction would be stale by the time billing is revealed.
   */
  private phoneInputContext(): PhoneInputContext {
    return {
      isIntlTelInputAvailable: this.isIntlTelInputAvailable,
      fields: this.fields,
      billingFields: this.billingFields,
      phoneInputs: this.phoneInputs,
      detectedCountryCode: this.detectedCountryCode,
      updateFormData: data => this.updateFormData(data),
      logger: this.logger,
    };
  }

  private initializePhoneInputs(): void {
    initializePhoneInputs(this.phoneInputContext());
  }


  // ============================================================================
  // CREDIT CARD MANAGEMENT
  // ============================================================================

  private async initializeCreditCard(environmentKey: string, _debug: boolean): Promise<void> {
    try {
      this.addClass('next-loading-spreedly');

      // Get card input configuration from config store
      // Supports both new cardInputConfig and legacy spreedly naming
      const config = useConfigStore.getState();
      const cardInputConfig = config.paymentConfig?.cardInputConfig || config.paymentConfig?.spreedly;

      this.creditCardService = new CreditCardService(environmentKey, cardInputConfig);


      this.creditCardService.setOnReady(() => {
        this.removeClass('next-loading-spreedly');
        this.emit('checkout:spreedly-ready', {});
        this.logger.debug('[Spreedly] Credit card service ready');

        // Spreedly is now ready and will handle error clearing via field events
      });

      this.creditCardService.setOnError((errors) => {
        this.logger.warn('[Spreedly] Credit card validation errors:', errors);
        this.emit('payment:error', { errors });

        // Display credit card validation errors
        if (errors && errors.length > 0) {
          const errorMessage = errors.map((err: any) => err.message || err).join('. ');
          this.displayPaymentError(errorMessage);
        }
      });

      this.creditCardService.setOnToken((token, pmData) => {
        this.logger.info('[Spreedly] Payment token received:', { token, pmData });
        this.handleTokenizedPayment(token, pmData);
      });

      // Set up floating label callbacks for Spreedly fields
      if (this.ui) {
        this.creditCardService.setFloatingLabelCallbacks(
          // Focus callback
          (fieldName: 'number' | 'cvv') => {
            this.ui.handleSpreedlyFieldFocus(fieldName);
          },
          // Blur callback
          (fieldName: 'number' | 'cvv', hasValue: boolean) => {
            this.ui.handleSpreedlyFieldBlur(fieldName, hasValue);
          },
          // Input callback
          (fieldName: 'number' | 'cvv', hasValue: boolean) => {
            this.ui.handleSpreedlyFieldInput(fieldName, hasValue);
          }
        );
        this.logger.debug('[Spreedly] Connected floating label callbacks');
      }

      await this.creditCardService.initialize();

      // Connect credit card service to validator
      this.validator.setCreditCardService(this.creditCardService);

    } catch (error) {
      this.logger.error('Failed to initialize credit card service:', error);
      this.removeClass('next-loading-spreedly');
      throw error;
    }
  }

  // ============================================================================
  // FORM CLEARING
  // ============================================================================

  private clearAllCheckoutFields(): void {
    try {
      // Clear all shipping fields
      this.fields.forEach((field) => {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            (field as HTMLInputElement).checked = false;
          } else {
            field.value = '';
          }
        } else if (field instanceof HTMLSelectElement) {
          field.selectedIndex = 0;
        }
      });

      // Clear all billing fields
      this.billingFields.forEach((field) => {
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            (field as HTMLInputElement).checked = false;
          } else {
            field.value = '';
          }
        } else if (field instanceof HTMLSelectElement) {
          field.selectedIndex = 0;
        }
      });

      // Clear credit card fields if credit card service exists
      if (this.creditCardService && typeof this.creditCardService.clearFields === 'function') {
        this.creditCardService.clearFields();
      }

      // Reset checkout store
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.reset();

      // Clear any errors
      checkoutStore.clearAllErrors();

      // Re-initialize country dropdowns with detected country
      const countryField = this.fields.get('country');
      if (countryField instanceof HTMLSelectElement && this.detectedCountryCode) {
        countryField.value = this.detectedCountryCode;
        countryField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Reset billing same as shipping checkbox
      const billingToggle = this.form.querySelector('input[name="use_shipping_address"]') as HTMLInputElement;
      if (billingToggle) {
        billingToggle.checked = true;
        billingToggle.dispatchEvent(new Event('change', { bubbles: true }));
      }

      this.logger.info('All checkout fields cleared');
    } catch (error) {
      this.logger.error('Error clearing checkout fields:', error);
    }
  }

  // ============================================================================
  // PURCHASE EVENT HANDLING
  // ============================================================================

  private async handlePurchaseEvent(): Promise<void> {
    // Check for existing order in sessionStorage
    const orderDataStr = sessionStorage.getItem('next-order');
    if (!orderDataStr) return;

    try {
      const orderData = JSON.parse(orderDataStr);
      const order = orderData?.state?.order;

      // Check if we have a valid order
      if (!order?.ref_id || !order?.number) return;

      // Check if we've already shown the modal for this order
      const shownOrdersStr = sessionStorage.getItem('next-shown-order-warnings');
      const shownOrders = shownOrdersStr ? JSON.parse(shownOrdersStr) : [];

      if (shownOrders.includes(order.ref_id)) {
        this.logger.debug('Already shown warning for order', order.ref_id);
        return;
      }

      this.logger.info('Fresh purchase detected, showing attention modal', {
        orderNumber: order.number,
        refId: order.ref_id
      });

      // Track modal shown time for duration calculation
      const modalShownTime = Date.now();

      // Ensure checkout is not in processing state before showing modal
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setProcessing(false);

      const action = await GeneralModal.show({
        title: 'Attention',
        content: 'Your initial order has been successfully processed. Please check your email for the order confirmation. Entering your payment details again will result in a secondary purchase.',
        buttons: [
          { text: 'Close', action: 'cancel' },
          { text: 'Back', action: 'confirm' }
        ],
        className: 'purchase-warning-modal'
      });

      // Mark this order as shown
      shownOrders.push(order.ref_id);
      sessionStorage.setItem('next-shown-order-warnings', JSON.stringify(shownOrders));

      // Track the duplicate order prevention event with user action
      const timeOnModal = Date.now() - modalShownTime;


      if (action === 'confirm') {
        // Handle back button - navigate to the success URL
        const successUrl = this.getSuccessUrl();
        if (successUrl) {
          // Add ref_id to the URL if not already present
          const url = new URL(successUrl, window.location.origin);
          if (!url.searchParams.has('ref_id') && order.ref_id) {
            url.searchParams.set('ref_id', order.ref_id);
          }
          // Preserve all current session parameters
          const finalUrl = preserveQueryParams(url.href);
          window.location.href = finalUrl;
        }
      } else {
        // User clicked 'Close' - ensure form is properly initialized
        // Re-populate form data if it exists in the store
        this.populateFormData();

        // Ensure UI is in correct state
        if (this.ui) {
          this.ui.hideLoading('checkout');
        }

        // Clear all form fields and reset checkout state
        this.clearAllCheckoutFields();
      }
    } catch (error) {
      this.logger.error('Failed to parse order data from sessionStorage:', error);
      // Ensure we're not stuck in processing state
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setProcessing(false);
    }
  }

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

  private buildOrderData(checkoutStore: any, cartStore: any): CreateOrder {
    const shippingAddress: Address = {
      first_name: checkoutStore.formData.fname || '',
      last_name: checkoutStore.formData.lname || '',
      line1: checkoutStore.formData.address1 || '',
      line2: checkoutStore.formData.address2,
      line4: checkoutStore.formData.city || '',
      state: checkoutStore.formData.province,
      postcode: checkoutStore.formData.postal,
      country: checkoutStore.formData.country || '',
      phone_number: checkoutStore.formData.phone
    };

    let billingAddressData: Address | undefined;
    if (!checkoutStore.sameAsShipping && checkoutStore.billingAddress) {
      billingAddressData = {
        first_name: checkoutStore.billingAddress.first_name || '',
        last_name: checkoutStore.billingAddress.last_name || '',
        line1: checkoutStore.billingAddress.address1 || '',
        line4: checkoutStore.billingAddress.city || '',
        country: checkoutStore.billingAddress.country || '',
        ...(checkoutStore.billingAddress.address2 && { line2: checkoutStore.billingAddress.address2 }),
        ...(checkoutStore.billingAddress.province && { state: checkoutStore.billingAddress.province }),
        ...(checkoutStore.billingAddress.postal && { postcode: checkoutStore.billingAddress.postal }),
        ...(checkoutStore.billingAddress.phone && { phone_number: checkoutStore.billingAddress.phone })
      };
    }

    const payment: Payment = {
      payment_method: API_PAYMENT_METHOD_MAP[checkoutStore.paymentMethod] || 'card_token',
      ...(checkoutStore.paymentToken && { card_token: checkoutStore.paymentToken })
    };

    const attributionStore = useAttributionStore.getState();
    const attribution = attributionStore.getAttributionForApi();

    const vouchers = useCheckoutStore.getState().vouchers;

    return {
      lines: cartStore.items.map((item: any) => ({
        package_id: item.packageId,
        quantity: item.quantity,
        is_upsell: item.is_upsell || false,
        ...(item.properties !== undefined && { properties: item.properties }),
      })),
      shipping_address: shippingAddress,
      ...(billingAddressData && { billing_address: billingAddressData }),
      billing_same_as_shipping_address: checkoutStore.sameAsShipping,
      shipping_method: checkoutStore.shippingMethod?.id || cartStore.shippingMethod?.id || 1,
      payment_detail: payment,
      user: {
        email: checkoutStore.formData.email,
        first_name: checkoutStore.formData.fname || '',
        last_name: checkoutStore.formData.lname || '',
        language: 'en',
        phone_number: checkoutStore.formData.phone,
        accepts_marketing: checkoutStore.formData.accepts_marketing ?? true
      },
      vouchers: vouchers,
      attribution: attribution,
      currency: this.getCurrency(),
      success_url: this.getSuccessUrl(),
      payment_failed_url: this.getFailureUrl()
    };
  }

  private async createOrder(): Promise<any> {
    const checkoutStore = useCheckoutStore.getState();
    const cartStore = useCartStore.getState();

    try {
      if (!checkoutStore.formData.email || !checkoutStore.formData.fname || !checkoutStore.formData.lname) {
        throw new Error('Missing required customer information');
      }

      if (cartStore.items.length === 0) {
        throw new Error('Cannot create order with empty cart');
      }

      if ((checkoutStore.paymentMethod === 'credit-card' || checkoutStore.paymentMethod === 'card_token') && !checkoutStore.paymentToken) {
        throw new Error('Payment token is required for credit card payments');
      }

      const orderData = this.buildOrderData(checkoutStore, cartStore);
      const order = await this.apiClient.createOrder(orderData);

      if (!order.ref_id) {
        throw new Error('Invalid order response: missing ref_id');
      }

      // cartStore.reset();

      this.logger.info('Order created successfully', {
        ref_id: order.ref_id,
        number: order.number,
        total: order.total_incl_tax,
        payment_method: checkoutStore.paymentMethod
      });

      return order;

    } catch (error: any) {
      this.logger.error('Failed to create order:', error);

      // Check for API errors in the response
      if (error.status === 400 && error.responseData) {
        const responseData = error.responseData;

        // Log the full error response for debugging
        this.logger.warn('API 400 error response:', responseData);

        // Check for message array (common API error format)
        if (responseData.message && Array.isArray(responseData.message)) {
          // Extract the actual message from each array item
          const errorMessages = responseData.message.map((msg: any) => {
            if (typeof msg === 'object' && msg !== null) {
              // If it's an object, try to extract a message property or stringify it
              return msg.message || JSON.stringify(msg);
            }
            return String(msg);
          }).join('. ');
          this.displayPaymentError(errorMessages);
          throw new Error(errorMessages);
        }

        // Check for single message string
        if (responseData.message && typeof responseData.message === 'string') {
          this.displayPaymentError(responseData.message);
          throw new Error(responseData.message);
        }

        // Check for payment-specific errors
        if (responseData.payment_details || responseData.payment_response_code) {
          this.logger.warn('Payment error detected:', {
            payment_details: responseData.payment_details,
            payment_response_code: responseData.payment_response_code
          });

          // Tracking removed - implement custom analytics in the future if needed

          // Display payment error in the UI
          this.displayPaymentError(responseData.payment_details || 'Payment failed. Please check your payment information.');

          // Create a user-friendly error message
          let errorMessage = 'Payment failed: ';
          if (responseData.payment_details) {
            errorMessage += responseData.payment_details;
          } else {
            errorMessage += 'Please check your payment information and try again.';
          }

          throw new Error(errorMessage);
        }

        // Check for validation errors
        if (responseData.errors) {
          const errorMessages = Object.entries(responseData.errors)
            .map(([, messages]) => {
              if (Array.isArray(messages)) {
                return messages.join('. ');
              }
              return messages;
            })
            .join('. ');

          // Tracking removed - NextAnalytics handles this automatically if needed

          this.displayPaymentError(errorMessages);
          throw new Error(errorMessages);
        }
      }

      // Enhance error message for better user experience
      if (error instanceof Error) {
        if (error.message.includes('Rate limited')) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        } else if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Authentication error. Please refresh the page and try again.');
        } else if (error.message.includes('400')) {
          throw new Error('Invalid order data. Please check your information and try again.');
        } else if (error.message.includes('500')) {
          throw new Error('Server error. Please try again in a few moments.');
        }
      }

      throw error;
    }
  }

  private async createTestOrder(): Promise<any> {
    const cartStore = useCartStore.getState();

    try {
      const vouchers = useCheckoutStore.getState().vouchers;

      const testOrderData = {
        lines: cartStore.items.length > 0
          ? cartStore.items.map((item: any) => ({
            package_id: item.packageId,
            quantity: item.quantity,
            is_upsell: item.is_upsell || false,
            ...(item.properties !== undefined && { properties: item.properties }),
          }))
          : [{ package_id: 1, quantity: 1, is_upsell: false }],

        shipping_address: {
          first_name: 'Test',
          last_name: 'Order',
          line1: 'Test Address 123',
          line2: '',
          line4: 'Tempe',
          state: 'AZ',
          postcode: '85281',
          country: 'US',
          phone_number: '+14807581224'
        },

        billing_same_as_shipping_address: true,
        shipping_method: cartStore.shippingMethod?.id || 1,

        payment_detail: {
          payment_method: 'card_token' as PaymentMethod,
          card_token: 'test_card'
        },

        user: {
          email: 'test@test.com',
          first_name: 'Test',
          last_name: 'Order',
          language: 'en',
          phone_number: '+14807581224',
          accepts_marketing: true
        },

        vouchers: vouchers,
        attribution: this.getTestAttribution(),
        currency: this.getCurrency(),
        success_url: this.getSuccessUrl(),
        payment_failed_url: this.getFailureUrl()
      };

      const order = await this.apiClient.createOrder(testOrderData);
      // cartStore.reset();

      return order;

    } catch (error) {
      this.logger.error('Failed to create test order:', error);
      throw error;
    }
  }

  private getTestAttribution(): Attribution {
    const attributionStore = useAttributionStore.getState();
    const baseAttribution = attributionStore.getAttributionForApi();

    return {
      ...baseAttribution,
      utm_source: 'konami_code',
      utm_medium: 'test',
      utm_campaign: 'debug_test_order',
      utm_content: 'test_mode',
      metadata: {
        ...baseAttribution.metadata,
        test_order: true,
        test_timestamp: Date.now()
      }
    };
  }

  private handleOrderRedirect(order: any): void {
    // Tracking removed - implement custom analytics in the future if needed

    let redirectUrl: string | undefined;

    if (order.payment_complete_url) {
      redirectUrl = order.payment_complete_url;
    } else {
      const nextPageUrl = this.getNextPageUrlFromMeta(order.ref_id);
      if (nextPageUrl) {
        redirectUrl = nextPageUrl;
      } else if (order.order_status_url) {
        redirectUrl = order.order_status_url;
      } else {
        redirectUrl = `${window.location.origin}/checkout/confirmation/?ref_id=${order.ref_id || ''}`;
      }
    }

    if (redirectUrl) {
      const finalUrl = preserveQueryParams(redirectUrl);
      // Clear cart items, vouchers, and checkout form state before navigating
      // away from the checkout. Zustand's persist middleware writes to
      // sessionStorage synchronously so the next page loads with a fresh cart.
      useCartStore.getState().reset();
      useCheckoutStore.getState().reset();
      // Keep the loading state active during redirect
      // The browser will handle clearing it when the page unloads
      window.location.href = finalUrl;
    } else {
      // Only clear loading state if redirect fails
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setProcessing(false);
      this.emit('order:redirect-missing', { order });
    }
  }

  private getNextPageUrlFromMeta(refId?: string): string | null {
    const metaTag = document.querySelector('meta[name="next-success-url"]') as HTMLMetaElement ||
      document.querySelector('meta[name="next-next-url"]') as HTMLMetaElement ||
      document.querySelector('meta[name="os-next-page"]') as HTMLMetaElement;

    if (!metaTag?.content) return null;

    const nextPagePath = metaTag.content;
    const redirectUrl = nextPagePath.startsWith('http') ?
      new URL(nextPagePath) :
      new URL(nextPagePath, window.location.origin);

    if (refId) {
      redirectUrl.searchParams.append('ref_id', refId);
    }

    // Preserve all current session parameters (currency, country, utm params, etc.)
    return preserveQueryParams(redirectUrl.href);
  }

  private getCurrency(): string {
    return (
      useCampaignStore.getState()?.currency ??
      useConfigStore.getState().getCurrency()
    );
  }

  private getSuccessUrl(): string {
    const metaTag = document.querySelector('meta[name="next-success-url"]') as HTMLMetaElement ||
      document.querySelector('meta[name="next-next-url"]') as HTMLMetaElement ||
      document.querySelector('meta[name="os-next-page"]') as HTMLMetaElement;

    if (metaTag?.content) {
      // Convert to absolute URL if it's a relative path
      if (metaTag.content.startsWith('/')) {
        return window.location.origin + metaTag.content;
      }
      // Return as-is if it's already an absolute URL
      return metaTag.content;
    }

    return window.location.origin + '/success';
  }

  private async validateExpressCheckoutFields(formData: any, requiredFields: string[]): Promise<any> {
    const errors: Record<string, string> = {};
    let firstErrorField: string | null = null;

    // Validate only the specified required fields
    for (const field of requiredFields) {
      const value = formData[field];

      if (!value || (typeof value === 'string' && !value.trim())) {
        const fieldNameMap: Record<string, string> = {
          'email': 'Email',
          'fname': 'First Name',
          'lname': 'Last Name',
          'phone': 'Phone',
          'address1': 'Address',
          'city': 'City',
          'province': 'State/Province',
          'postal': 'ZIP/Postal Code',
          'country': 'Country'
        };

        const fieldLabel = fieldNameMap[field] || field;
        errors[field] = `${fieldLabel} is required`;

        if (!firstErrorField) {
          firstErrorField = field;
        }
      }

      // Special validation for email using the validator
      if (field === 'email' && value) {
        if (!this.validator.isValidEmail(value)) {
          errors[field] = 'Please enter a valid email address';
          if (!firstErrorField) {
            firstErrorField = field;
          }
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      firstErrorField
    };
  }

  private getFailureUrl(): string {
    const metaTag = document.querySelector('meta[name="next-failure-url"]') as HTMLMetaElement ||
      document.querySelector('meta[name="os-failure-url"]') as HTMLMetaElement;

    if (metaTag?.content) {
      // Convert to absolute URL if it's a relative path
      if (metaTag.content.startsWith('/')) {
        return window.location.origin + metaTag.content;
      }
      // Return as-is if it's already an absolute URL
      return metaTag.content;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('payment_failed', 'true');
    return currentUrl.href;
  }

  // ============================================================================
  // MULTI-STEP CHECKOUT SUPPORT
  // ============================================================================

  /**
   * Detect if this is a multi-step checkout by checking for step attributes
   */
  private detectMultiStepCheckout(): void {
    // Check for data-next-checkout-step attribute on form
    const stepAttr = this.form.getAttribute('data-next-checkout-step') ||
      this.form.getAttribute('os-checkout-step');

    if (stepAttr) {
      this.isMultiStep = true;
      this.currentStep = parseInt(this.form.getAttribute('data-next-step-number') || '1', 10);
      this.nextStepUrl = stepAttr;

      this.logger.info('Multi-step checkout detected', {
        currentStep: this.currentStep,
        nextStepUrl: this.nextStepUrl
      });

      // Update store step
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setStep(this.currentStep);
    }
  }

  /**
   * Handle step navigation for multi-step checkout
   */
  private async handleStepNavigation(checkoutStore: any, cartStore: any): Promise<void> {
    try {
      checkoutStore.clearAllErrors();
      checkoutStore.setProcessing(true);

      // Show loading overlay
      this.loadingOverlay.show();

      this.logger.info(`Validating step ${this.currentStep} before navigation`);

      // Validate only current step fields
      const validation = await this.validator.validateStep(
        this.currentStep,
        checkoutStore.formData,
        this.countryConfigs,
        this.currentCountryConfig.value
      );

      if (!validation.isValid) {
        this.logger.warn(`Step ${this.currentStep} validation failed`, validation.errors);

        // Display errors
        if (validation.errors) {
          Object.entries(validation.errors).forEach(([field, error]) => {
            checkoutStore.setError(field, error as string);
            this.validator.showError(field, error as string);
          });
        }

        // Focus first error field
        if (validation.firstErrorField) {
          setTimeout(() => {
            this.validator.focusFirstErrorField(validation.firstErrorField);
          }, 100);
        }

        // Clear processing state and hide overlay on validation error
        checkoutStore.setProcessing(false);
        this.loadingOverlay.hide(true);
        return;
      }

      // Validation passed - data is already saved in checkoutStore via field change handlers
      // Navigate to next step
      this.logger.info(`Step ${this.currentStep} validated successfully, navigating to: ${this.nextStepUrl}`);

      // Update step in store before navigation
      checkoutStore.setStep(this.currentStep + 1);

      // Build next URL with all session parameters preserved (currency, country, utm params, etc.)
      const nextUrl = preserveQueryParams(this.nextStepUrl!);
      this.logger.debug('Preserving all session parameters in next step URL');

      // Add a small delay to show the loading spinner before navigation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear processing state before navigation to prevent it persisting to next page
      checkoutStore.setProcessing(false);

      // Navigate to next page (loading overlay will be cleared by page navigation)
      window.location.href = nextUrl;

    } catch (error) {
      this.logger.error('Step navigation error:', error);
      checkoutStore.setError('general', 'Failed to proceed to next step. Please try again.');
      checkoutStore.setProcessing(false);
      this.loadingOverlay.hide(true);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  private async handleFormSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const checkoutStore = useCheckoutStore.getState();
    const cartStore = useCartStore.getState();

    // Handle multi-step navigation
    if (this.isMultiStep && this.nextStepUrl) {
      return this.handleStepNavigation(checkoutStore, cartStore);
    }

    try {
      checkoutStore.clearAllErrors();
      checkoutStore.setProcessing(true);

      // Show loading overlay
      this.loadingOverlay.show();

      // Validate phone numbers using intl-tel-input if available
      if (this.isIntlTelInputAvailable) {
        // Validate shipping phone
        const shippingPhoneInstance = this.phoneInputs.get('shipping');
        if (shippingPhoneInstance) {
          const isValidShipping = shippingPhoneInstance.isValidNumber();
          if (!isValidShipping && checkoutStore.formData.phone) {
            checkoutStore.setError('phone', 'Please enter a valid phone number');
          } else if (isValidShipping) {
            // Update with formatted number
            const formattedNumber = shippingPhoneInstance.getNumber();
            if (formattedNumber) {
              checkoutStore.updateFormData({ phone: formattedNumber });
            }
          }
        }

        // Validate billing phone if different from shipping
        if (!checkoutStore.sameAsShipping && checkoutStore.billingAddress) {
          const billingPhoneInstance = this.phoneInputs.get('billing');
          if (billingPhoneInstance) {
            const isValidBilling = billingPhoneInstance.isValidNumber();
            if (!isValidBilling && checkoutStore.billingAddress.phone) {
              checkoutStore.setError('billing-phone', 'Please enter a valid phone number');
            }
          }
        }
      }

      // Check if this is an express payment method
      const expressPaymentMethods = ['paypal', 'apple_pay', 'google_pay'];
      const isExpressPayment = expressPaymentMethods.includes(checkoutStore.paymentMethod);

      // Tracking removed - implement custom analytics in the future if needed

      // Check if validation is required for express payments
      const config = useConfigStore.getState();
      const requireExpressValidation = config.paymentConfig?.expressCheckout?.requireValidation;

      // Debug logging
      this.logger.debug('Express payment config:', {
        isExpressPayment,
        paymentMethod: checkoutStore.paymentMethod,
        requireExpressValidation,
        hasExpressProcessor: !!this.expressProcessor,
        fullConfig: config.paymentConfig?.expressCheckout
      });

      // If it's an express payment method and validation is NOT required, use ExpressCheckoutProcessor
      if (isExpressPayment && this.expressProcessor && !requireExpressValidation) {
        this.logger.info(`Processing express checkout for ${checkoutStore.paymentMethod} (skipping validation)`);

        // Hide loading overlay first since ExpressCheckoutProcessor will show its own
        this.loadingOverlay.hide(true);

        // Use ExpressCheckoutProcessor which handles everything including order creation
        await this.expressProcessor.handleExpressCheckout(
          checkoutStore.paymentMethod,
          cartStore.items,
          cartStore.isEmpty,
          () => cartStore.reset()
        );

        // ExpressCheckoutProcessor handles all success/error cases and redirects
        return;
      }

      // Log if express payment requires validation
      if (isExpressPayment && requireExpressValidation) {
        this.logger.info(`Express payment ${checkoutStore.paymentMethod} requires validation (requireValidation: true)`);
      }

      // For regular credit card payments OR express payments with validation required
      const includePayment = checkoutStore.paymentMethod === 'credit-card' ||
        checkoutStore.paymentMethod === 'card_token' ||
        (isExpressPayment && requireExpressValidation);

      let validation;

      // If express payment with custom required fields, validate only those fields
      if (isExpressPayment && requireExpressValidation && config.paymentConfig?.expressCheckout?.requiredFields) {
        const requiredFields = config.paymentConfig.expressCheckout.requiredFields;
        validation = await this.validateExpressCheckoutFields(checkoutStore.formData, requiredFields);
      } else {
        // Otherwise use full validation
        validation = await this.validator.validateForm(
          checkoutStore.formData,
          this.countryConfigs,
          this.currentCountryConfig.value,
          includePayment,
          checkoutStore.billingAddress,
          checkoutStore.sameAsShipping
        );
      }

      if (!validation.isValid) {

        // Log validation errors for debugging
        this.logger.warn('Validation failed', {
          paymentMethod: checkoutStore.paymentMethod,
          isExpressPayment,
          requireExpressValidation,
          errors: validation.errors,
          firstErrorField: validation.firstErrorField
        });

        if (validation.errors) {
          Object.entries(validation.errors).forEach(([field, error]) => {
            checkoutStore.setError(field, error as string);
            // Also show error in UI
            this.validator.showError(field, error as string);
          });
        }

        // For express payments with validation, show a detailed error message
        if (isExpressPayment && requireExpressValidation) {
          const errorFields = Object.keys(validation.errors || {});
          // const errorCount = errorFields.length;

          // Create a human-readable list of field names
          const fieldNameMap: Record<string, string> = {
            'email': 'Email',
            'fname': 'First Name',
            'lname': 'Last Name',
            'phone': 'Phone',
            'address1': 'Address',
            'city': 'City',
            'province': 'State/Province',
            'postal': 'ZIP/Postal Code',
            'country': 'Country',
            'cc-month': 'Expiration Month',
            'cc-year': 'Expiration Year',
            'exp-month': 'Expiration Month',
            'exp-year': 'Expiration Year',
            'billing-fname': 'Billing First Name',
            'billing-lname': 'Billing Last Name',
            'billing-address1': 'Billing Address',
            'billing-city': 'Billing City',
            'billing-province': 'Billing State/Province',
            'billing-postal': 'Billing ZIP/Postal Code',
            'billing-country': 'Billing Country'
          };

          const requiredFields = errorFields.map(field => fieldNameMap[field] || field).join(', ');
          const generalMessage = `Please fill in the following required fields: ${requiredFields}`;
          checkoutStore.setError('general', generalMessage);

          // Also show payment error to make it more visible
          this.displayPaymentError(generalMessage);
        }

        if (validation.firstErrorField) {
          // Add a small delay to ensure errors are rendered before scrolling
          setTimeout(() => {
            this.validator.focusFirstErrorField(validation.firstErrorField);
          }, 100);
        }

        // Clear processing state when validation fails
        checkoutStore.setProcessing(false);
        this.loadingOverlay.hide(true); // Hide immediately on validation error
        return;
      }

      // span?.setAttribute('validation.passed', true);

      // Tracking removed - implement custom analytics in the future if needed

      // For express payment methods (PayPal, Apple Pay, Google Pay), always use ExpressCheckoutProcessor
      if (isExpressPayment && this.expressProcessor) {
        this.logger.info(`Processing express checkout for ${checkoutStore.paymentMethod} (after validation)`);

        // Hide loading overlay first since ExpressCheckoutProcessor will show its own
        this.loadingOverlay.hide(true);

        // Use ExpressCheckoutProcessor which handles everything including order creation
        await this.expressProcessor.handleExpressCheckout(
          checkoutStore.paymentMethod,
          cartStore.items,
          cartStore.isEmpty,
          () => cartStore.reset()
        );

        // ExpressCheckoutProcessor handles all success/error cases and redirects
        return;
      }

      // Only credit card payments go through the regular flow
      if (checkoutStore.paymentMethod === 'credit-card' || checkoutStore.paymentMethod === 'card_token') {
        // span?.setAttribute('payment.type', 'credit_card');

        if (this.creditCardService?.ready) {
          const cardData: CreditCardData = {
            full_name: `${checkoutStore.formData.fname || ''} ${checkoutStore.formData.lname || ''}`.trim(),
            month: checkoutStore.formData['cc-month'] || checkoutStore.formData['exp-month'] || '',
            year: checkoutStore.formData['cc-year'] || checkoutStore.formData['exp-year'] || ''
          };
          await this.creditCardService.tokenizeCard(cardData);
          // span?.setAttribute('payment.tokenization_started', true);
          return;
        } else {
          throw new Error('Credit card payment system is not ready. Please refresh the page and try again.');
        }
      }

      // This should not be reached for express payments
      // span?.setAttribute('payment.type', checkoutStore.paymentMethod || 'unknown');
      await this.processOrder();

    } catch (error) {
      // span?.setAttribute('error', true);
      // span?.setAttribute('error.type', (error as Error).name);
      // span?.setAttribute('error.message', (error as Error).message);

      this.handleError(error, 'handleFormSubmit');
      checkoutStore.setError('general', 'Failed to process order. Please try again.');
      // Only set processing to false on error
      checkoutStore.setProcessing(false);
      this.loadingOverlay.hide(true); // Hide immediately on error
    }
  }

  private async processOrder(): Promise<void> {
    try {
      const order = await this.createOrder();

      // Mark prospect cart as converted if it exists
      if (this.prospectCartEnhancer) {
        await this.prospectCartEnhancer.convertCart();
      }

      this.emit('order:completed', order);
      this.handleOrderRedirect(order);
      // Note: LoadingOverlay will hide after 3 seconds on success
    } catch (error) {
      // Make sure to clear processing state on error
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setProcessing(false);
      this.loadingOverlay.hide(true); // Hide immediately on error
      throw error;
    }
  }

  private async handleTokenizedPayment(token: string, pmData: any): Promise<void> {
    try {
      const checkoutStore = useCheckoutStore.getState();
      checkoutStore.setPaymentToken(token);

      this.emit('payment:tokenized', { token, pmData, paymentMethod: checkoutStore.paymentMethod });

      await this.processOrder();

    } catch (error: any) {
      this.logger.error('Failed to process tokenized payment:', error);
      const checkoutStore = useCheckoutStore.getState();

      // Check if error has payment details
      if (error.message && error.message.includes('Payment failed:')) {
        // The error message already contains payment details from createOrder
        checkoutStore.setError('general', error.message);
      } else {
        checkoutStore.setError('general', 'Payment processing failed. Please try again.');
      }

      checkoutStore.setProcessing(false);
      this.loadingOverlay.hide(true); // Hide immediately on error
    }
  }

  private async handleFieldChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const fieldName = this.getFieldNameFromElement(target);

    if (!fieldName) return;

    const checkoutStore = useCheckoutStore.getState();

    if (fieldName.startsWith('billing-')) {
      // Handle billing postal code formatting
      if (fieldName === 'billing-postal' && target instanceof HTMLInputElement) {
        const billingCountryField = this.billingFields.get('billing-country');
        const countryCode = billingCountryField instanceof HTMLSelectElement ? billingCountryField.value : '';

        if (countryCode) {
          const countryConfig = this.countryConfigs.get(countryCode);
          if (countryConfig) {
            const formatted = this.countryService.formatPostalCode(target.value, countryConfig);
            if (formatted !== target.value) {
              const cursorPos = target.selectionStart || 0;
              const lengthDiff = formatted.length - target.value.length;
              target.value = formatted;
              // Restore cursor position after formatting
              target.setSelectionRange(cursorPos + lengthDiff, cursorPos + lengthDiff);
            }
          }
        }
      }

      // Billing fields are always strings (no checkboxes in billing)
      this.handleBillingFieldChange(fieldName, target.value, checkoutStore);

      if (fieldName === 'billing-country') {
        const billingProvinceField = this.billingFields.get('billing-province');
        if (billingProvinceField instanceof HTMLSelectElement) {
          await updateBillingStateOptions(this.stateFieldsContext(), target.value, billingProvinceField, checkoutStore.formData.province);
        }
        // Currency is location-based only, not affected by billing or shipping country
      }
    } else {
      // Handle shipping postal code formatting
      if (fieldName === 'postal' && target instanceof HTMLInputElement) {
        const countryField = this.fields.get('country');
        const countryCode = countryField instanceof HTMLSelectElement ? countryField.value : '';

        if (countryCode) {
          const countryConfig = this.countryConfigs.get(countryCode);
          if (countryConfig) {
            const formatted = this.countryService.formatPostalCode(target.value, countryConfig);
            if (formatted !== target.value) {
              const cursorPos = target.selectionStart || 0;
              const lengthDiff = formatted.length - target.value.length;
              target.value = formatted;
              // Restore cursor position after formatting
              target.setSelectionRange(cursorPos + lengthDiff, cursorPos + lengthDiff);
            }
          }
        }
      }

      // Get the correct value based on input type
      // For phone fields, use intlTelInput's international format if available
      let fieldValue: any;
      if (fieldName === 'phone' || fieldName === 'billing-phone') {
        const phoneType = fieldName === 'phone' ? 'shipping' : 'billing';
        const phoneInstance = this.phoneInputs.get(phoneType);
        if (phoneInstance) {
          // Use intlTelInput's getNumber() for international format
          fieldValue = phoneInstance.getNumber() || target.value;
        } else {
          fieldValue = target.value;
        }
      } else if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
        fieldValue = target.checked;
      } else {
        fieldValue = target.value;
      }

      this.updateFormData({ [fieldName]: fieldValue });
      checkoutStore.clearError(fieldName);

      // Validate fields on blur - simplified without redundant fallback messages
      const fieldsToValidate = ['email', 'city', 'fname', 'lname'];

      if (fieldsToValidate.includes(fieldName) && (event.type === 'blur' || event.type === 'change')) {
        const fieldValue = target.value.trim();
        if (fieldValue) {
          const validationResult = this.validator.validateField(fieldName, fieldValue);
          if (!validationResult.isValid && validationResult.message) {
            this.validator.setError(fieldName, validationResult.message);
            this.logger.warn(`Invalid ${fieldName} detected on blur:`, fieldValue);
          } else if (validationResult.isValid) {
            this.validator.clearError(fieldName);
          }
        }
      }

      if (fieldName === 'country') {
        const provinceField = this.fields.get('province');
        if (provinceField instanceof HTMLSelectElement) {
          await updateStateOptions(this.shippingStateFieldsContext(), target.value, provinceField);
        }

        // Save the user's country selection to sessionStorage
        sessionStorage.setItem('next_selected_country', target.value);
        this.logger.debug(`Saved user's country selection to session: ${target.value}`);

        // Currency is now based on user's location, not shipping country
        // Currency can only be changed via URL parameter or manual selection
      }

      // Show location fields when address1 is populated
      if (fieldName === 'address1' && target.value && target.value.trim().length > 0) {
        this.showLocationFields();

        // Track add_shipping_info when user has entered a shipping address
        // Check if we have enough address info to consider it "entered"
        if (!this.hasTrackedShippingInfo.value && checkoutStore.formData.city && checkoutStore.formData.province) {
          try {
            // Get current shipping method if selected
            const shippingMethod = checkoutStore.shippingMethod;
            const shippingTier = shippingMethod ? shippingMethod.name : 'Standard';
            nextAnalytics.track(EcommerceEvents.createAddShippingInfoEvent(shippingTier));
            this.hasTrackedShippingInfo.value = true;
            this.logger.info('Tracked add_shipping_info event (address complete)', { shippingTier });
          } catch (error) {
            this.logger.warn('Failed to track add_shipping_info event:', error);
          }
        }
      }

      // Only update prospect cart and storage on blur/change events, not on every input
      if (event.type === 'blur' || event.type === 'change') {
        // Update ProspectCartEnhancer when email changes
        if (fieldName === 'email' && this.prospectCartEnhancer) {
          this.prospectCartEnhancer.updateEmail(target.value);
        }

        // Save user data to cookies for persistence
        if (fieldName === 'email' || fieldName === 'fname' || fieldName === 'lname' || fieldName === 'phone') {
          const updates: any = {};
          if (fieldName === 'email') updates.email = target.value;
          if (fieldName === 'fname') updates.firstName = target.value;
          if (fieldName === 'lname') updates.lastName = target.value;
          if (fieldName === 'phone') {
            // Use international format for phone if intlTelInput is available
            const phoneInstance = this.phoneInputs.get('shipping');
            updates.phone = phoneInstance ? (phoneInstance.getNumber() || target.value) : target.value;
          }

          userDataStorage.updateUserData(updates);
          this.logger.debug('Updated user data storage:', fieldName, updates[fieldName === 'fname' ? 'firstName' : fieldName === 'lname' ? 'lastName' : fieldName]);
        }

        // Check if we have enough data to create prospect cart
        if (this.prospectCartEnhancer && ['email', 'fname', 'lname'].includes(fieldName)) {
          this.prospectCartEnhancer.checkAndCreateCart();
        }
      }
    }

    updateFieldValidationDisplay(
      this.fieldValidationContext(),
      event.type,
      fieldName,
      target.value
    );
  }


  private getFieldNameFromElement(element: HTMLElement): string | null {
    const checkoutFieldName = element.getAttribute('data-next-checkout-field') ||
      element.getAttribute('os-checkout-field');

    if (checkoutFieldName) return checkoutFieldName;

    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      if (element.name) return element.name;
    }

    return null;
  }

  private getFieldByName(fieldName: string): HTMLElement | null {
    // Check shipping fields first
    const shippingField = this.fields.get(fieldName);
    if (shippingField) return shippingField;

    // Check billing fields
    const billingField = this.billingFields.get(fieldName);
    if (billingField) return billingField;

    return null;
  }

  private handleBillingFieldChange(fieldName: string, value: string, checkoutStore: any): void {
    const billingFieldName = fieldName.replace('billing-', '');
    const currentBillingData = checkoutStore.billingAddress || {
      first_name: '', last_name: '', address1: '', city: '', province: '', postal: '', country: '', phone: ''
    };

    const mappedFieldName = BILLING_ADDRESS_FIELD_MAP[billingFieldName] || billingFieldName;

    checkoutStore.setBillingAddress({
      ...currentBillingData,
      [mappedFieldName]: value
    } as CheckoutState['billingAddress']);
  }

  private handlePaymentMethodChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const checkoutStore = useCheckoutStore.getState();

    const mappedMethod = PAYMENT_METHOD_MAP[target.value] || 'credit-card';
    checkoutStore.setPaymentMethod(mappedMethod as any);

    // Hide any payment-specific errors when switching methods
    const paypalError = document.querySelector('[data-next-component="paypal-error"]');
    if (paypalError instanceof HTMLElement) {
      paypalError.style.display = 'none';
    }

    const creditError = document.querySelector('[data-next-component="credit-error"]');
    if (creditError instanceof HTMLElement) {
      creditError.style.display = 'none';
    }

    this.ui.updatePaymentFormVisibility(target.value);

    // Note: For credit card payments, add_payment_info is tracked when card fields are complete (via CreditCardService)
    // For express payments (PayPal, Apple Pay, Google Pay), it's tracked when the button is clicked (via ExpressCheckoutProcessor)
  }

  // Methods moved to CheckoutUIHelpers class - expandPaymentForm and collapsePaymentForm

  private handleShippingMethodChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const checkoutStore = useCheckoutStore.getState();

    const shippingMethods = [
      { id: 1, name: 'Standard Shipping', price: 0, code: 'standard' },
      { id: 2, name: 'Subscription Shipping', price: 5, code: 'subscription' },
      { id: 3, name: 'Expedited: Standard Overnight', price: 28, code: 'overnight' }
    ];

    const parsedValue = parseInt(target.value);
    if (isNaN(parsedValue)) return;

    const selectedMethod = shippingMethods.find(m => m.id === parsedValue);
    if (selectedMethod) {
      checkoutStore.setShippingMethod(selectedMethod);

      void cartOperations.setShippingMethod(selectedMethod.id);

      // Track add_shipping_info event when shipping method is selected
      if (!this.hasTrackedShippingInfo.value) {
        try {
          // Map shipping codes to tier names for GA4
          const shippingTierMap: Record<string, string> = {
            'standard': 'Standard',
            'subscription': 'Subscription',
            'overnight': 'Express'
          };

          const shippingTier = shippingTierMap[selectedMethod.code] || selectedMethod.name;
          nextAnalytics.track(EcommerceEvents.createAddShippingInfoEvent(shippingTier));
          this.hasTrackedShippingInfo.value = true;
          this.logger.info('Tracked add_shipping_info event', { shippingTier });
        } catch (error) {
          this.logger.warn('Failed to track add_shipping_info event:', error);
        }
      }
    }
  }

  private handleBillingAddressToggle(event: Event): void {
    const target = event.target as HTMLInputElement;

    this.logger.info('[Billing] Toggle clicked', {
      checked: target.checked,
      animationInProgress: this.billingAnimationInProgress.value
    });

    // Prevent rapid clicks during animation
    if (this.billingAnimationInProgress.value) {
      event.preventDefault();
      // Revert checkbox state
      target.checked = !target.checked;
      this.logger.warn('[Billing] Click blocked - animation in progress');
      return;
    }

    // Clear any existing debounce timer
    if (this.billingAnimationDebounceTimer) {
      clearTimeout(this.billingAnimationDebounceTimer);
    }

    // Reduced debounce to 10ms (just enough to prevent double-clicks)
    this.billingAnimationDebounceTimer = setTimeout(() => {
      const checkoutStore = useCheckoutStore.getState();
      const billingSection = document.querySelector(BILLING_CONTAINER_SELECTOR);

      if (!billingSection || !(billingSection instanceof HTMLElement)) {
        this.logger.error('[Billing] CRITICAL: Billing section not found!');
        return;
      }

      this.logger.info('[Billing] Processing toggle', {
        targetChecked: target.checked,
        currentHeight: billingSection.style.height,
        currentOverflow: billingSection.style.overflow,
        currentTransition: billingSection.style.transition,
        classes: billingSection.className
      });

      // Update store state
      checkoutStore.setSameAsShipping(target.checked);

      if (target.checked) {
        this.logger.info('[Billing] Collapsing form...');
        collapseBillingForm(this.billingAnimationContext(), billingSection);
      } else {
        this.logger.info('[Billing] Expanding form...');
        expandBillingForm(this.billingAnimationContext(), billingSection);

        // Populate billing fields after expansion
        setTimeout(() => {
          // Only set the country and trigger state loading
          const shippingCountry = checkoutStore.formData.country;
          const billingCountryField = this.billingFields.get('billing-country');

          if (shippingCountry && billingCountryField instanceof HTMLSelectElement) {
            billingCountryField.value = shippingCountry;
            billingCountryField.dispatchEvent(new Event('change', { bubbles: true }));
            this.logger.debug('[Billing] Set country to:', shippingCountry);
          }

          // Clear the billing address in the store (except country)
          checkoutStore.setBillingAddress({
            first_name: '',
            last_name: '',
            address1: '',
            address2: '',
            city: '',
            province: '',
            postal: '',
            country: shippingCountry || '',
            phone: ''
          });
        }, 50);
      }
    }, 10); // Reduced debounce delay from 50ms to 10ms
  }

  /**
   * Set up detection for browser autofill
   */

  private setupEventHandlers(): void {
    this.submitHandler = this.handleFormSubmit.bind(this);
    this.form.addEventListener('submit', this.submitHandler);

    this.changeHandler = this.handleFieldChange.bind(this);
    [...this.fields.values(), ...this.billingFields.values()].forEach(field => {
      if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        field.addEventListener('change', this.changeHandler!);
        field.addEventListener('blur', this.changeHandler!);

        // Add input event listener for better autofill detection
        field.addEventListener('input', this.changeHandler!);
      }
    });

    // Set up Chrome autofill detection
    this.stopAutofillDetection = setupAutofillDetection(
      this.autofillDetectionContext()
    );

    this.paymentMethodChangeHandler = this.handlePaymentMethodChange.bind(this);
    const paymentRadios = this.form.querySelectorAll([
      '[data-next-checkout-field="payment-method"]',
      '[os-checkout-field="payment-method"]',
      'input[name="payment_method"]'
    ].join(', '));
    paymentRadios.forEach(radio => {
      radio.addEventListener('change', this.paymentMethodChangeHandler!);
    });

    this.shippingMethodChangeHandler = this.handleShippingMethodChange.bind(this);
    const shippingRadios = this.form.querySelectorAll('input[name="shipping_method"]');
    shippingRadios.forEach(radio => {
      radio.addEventListener('change', this.shippingMethodChangeHandler!);
    });

    this.billingAddressToggleHandler = this.handleBillingAddressToggle.bind(this);
    const billingToggle = this.form.querySelector('input[name="use_shipping_address"]');
    if (billingToggle) {
      billingToggle.addEventListener('change', this.billingAddressToggleHandler);
    }

    // Note: Credit card error clearing is handled by CreditCardService via Spreedly events
  }

  // ============================================================================
  // CURRENCY MANAGEMENT
  // ============================================================================

  // Currency handling has been moved to initialization only
  // Currency is now based on user's detected location and URL parameters
  // Shipping country changes no longer affect currency

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private updateFormData(data: Record<string, any>): void {
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.updateFormData(data);
  }

  private clearError(field: string): void {
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.clearError(field);
  }

  private async populateFormData(): Promise<void> {
    const checkoutStore = useCheckoutStore.getState();

    // Check if country is stored and different from current
    const storedCountry = checkoutStore.formData.country;
    const countryField = this.fields.get('country');

    if (storedCountry && countryField instanceof HTMLSelectElement) {
      // Set country first
      countryField.value = storedCountry;

      // If country changed, load states for that country
      const currentCountryValue = countryField.value;
      if (currentCountryValue && currentCountryValue !== this.detectedCountryCode) {
        this.logger.info(`Restoring saved country: ${currentCountryValue}`);

        // Load states for the stored country
        const provinceField = this.fields.get('province');
        if (provinceField instanceof HTMLSelectElement) {
          await updateStateOptions(this.shippingStateFieldsContext(), currentCountryValue, provinceField);
        }
      }
    }

    // Now populate all fields including province
    this.fields.forEach((field, name) => {
      if (checkoutStore.formData[name] && (field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
        // Skip province if we just loaded states - it will be set below
        if (name !== 'province' || !(field instanceof HTMLSelectElement)) {
          field.value = checkoutStore.formData[name];
        }
      }
    });

    // After populating phone field, ensure it's stored in international format
    // This handles the case where phone was persisted in national format before intlTelInput processed it
    const shippingPhoneInstance = this.phoneInputs.get('shipping');
    if (shippingPhoneInstance && checkoutStore.formData.phone) {
      // Give intlTelInput a moment to process the value we just set
      setTimeout(() => {
        const internationalNumber = shippingPhoneInstance.getNumber();
        if (internationalNumber && internationalNumber !== checkoutStore.formData.phone) {
          this.logger.debug(`Converting phone to international format: ${checkoutStore.formData.phone} -> ${internationalNumber}`);
          this.updateFormData({ phone: internationalNumber });
        }
      }, 50);
    }

    // Set province value after states are loaded
    const storedProvince = checkoutStore.formData.province;
    const provinceField = this.fields.get('province');

    if (storedProvince && provinceField instanceof HTMLSelectElement) {
      const availableOptions = Array.from(provinceField.options).map(opt => ({
        value: opt.value,
        text: opt.text
      }));

      // Check if the option exists
      const optionExists = Array.from(provinceField.options).some(opt => opt.value === storedProvince);

      if (optionExists) {
        provinceField.value = storedProvince;
        // IMPORTANT: Also update the store since updateStateOptions cleared it
        this.updateFormData({ province: storedProvince });
        this.logger.debug(`Restored province: ${storedProvince}`);
      } else {
        this.logger.warn(`Province ${storedProvince} not found in options for country ${storedCountry}`);
      }
    }

    // Update floating labels for populated data
    this.ui.updateLabelsForPopulatedData();
  }

  private handleTestDataFilled(_event: Event): void {
    setTimeout(() => {
      this.populateFormData();

      this.fields.forEach((field) => {
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      // Update UI for test data
      this.ui.updateLabelsForPopulatedData();
    }, 150);
  }

  private async handleKonamiActivation(event: Event): Promise<void> {
    const checkoutStore = useCheckoutStore.getState();
    // const cartStore = useCartStore.getState();

    const customEvent = event as CustomEvent;
    const activationMethod = customEvent.detail?.method;

    if (activationMethod === 'konami') {
      try {
        const testFormData = {
          email: 'test@test.com',
          fname: 'Test',
          lname: 'Order',
          phone: '+14807581224',
          address1: 'Test Address 123',
          address2: '',
          city: 'Tempe',
          province: 'AZ',
          postal: '85281',
          country: 'US',
          accepts_marketing: true
        };

        checkoutStore.clearAllErrors();
        this.validator.clearAllErrors();
        checkoutStore.updateFormData(testFormData);
        checkoutStore.setPaymentMethod('credit-card');
        checkoutStore.setPaymentToken('test_card');
        checkoutStore.setSameAsShipping(true);
        // Use existing shipping method from cart if available
        const cartStore = useCartStore.getState();
        const cartShipping = cartStore.shippingMethod;
        const existingShipping = cartShipping
          ? { id: cartShipping.id, name: cartShipping.name, price: cartShipping.price.toNumber(), code: cartShipping.code }
          : checkoutStore.shippingMethod;
        if (existingShipping) {
          checkoutStore.setShippingMethod(existingShipping);
        } else {
          // Fallback to first available from campaign
          const campaignStore = useCampaignStore.getState();
          if (campaignStore.data?.shipping_methods && campaignStore.data.shipping_methods.length > 0) {
            const firstMethod = campaignStore.data.shipping_methods[0];
            if (firstMethod) {
              checkoutStore.setShippingMethod({
                id: firstMethod.ref_id,
                name: firstMethod.code,
                price: parseFloat(firstMethod.price || '0'),
                code: firstMethod.code
              });
            }
          } else {
            // Last resort fallback
            checkoutStore.setShippingMethod({
              id: 1,
              name: 'Standard Shipping',
              price: 0,
              code: 'standard'
            });
          }
        }

        this.populateFormData();

        setTimeout(async () => {
          try {
            const order = await this.createTestOrder();
            this.emit('order:completed', order);
            this.handleOrderRedirect(order);
          } catch (error) {
            this.logger.error('Failed to create test order:', error);
          }
        }, 1000);

      } catch (error) {
        this.logger.error('Error filling test data for Konami order:', error);
      }
    }
  }

  private handleCheckoutUpdate(state: any): void {
    // Handle errors - let the validator handle the display
    if (state.errors && Object.keys(state.errors).length > 0) {
      // The validator will handle error display through its ErrorDisplayManager
      // We just need to make sure the validator knows about the errors
      Object.entries(state.errors).forEach(([fieldName, message]) => {
        this.validator.setError(fieldName, message as string);
      });
    }
    // Note: We do NOT call clearAllErrors when state has no errors
    // because that would mark all fields as valid prematurely.
    // Errors should only be cleared field-by-field as they're fixed.

    // Check if address1 was updated and show location fields if needed
    if (state.formData?.address1 && state.formData.address1.trim().length > 0) {
      this.showLocationFields();
    }

    // Handle processing state
    if (state.isProcessing) {
      // Disable submit button when processing
      if (this.submitButton) {
        this.submitButton.disabled = true;
        this.submitButton.setAttribute('aria-busy', 'true');
      }
    } else {
      // Enable submit button when not processing
      if (this.submitButton) {
        this.submitButton.disabled = false;
        this.submitButton.setAttribute('aria-busy', 'false');
      }
    }
  }

  private handleCartUpdate(cartState: CartState): void {
    if (cartState.isEmpty) {
      this.logger.warn('Cart is empty');
    }
  }

  private async handleConfigUpdate(configState: any): Promise<void> {
    try {
      if (configState.spreedlyEnvironmentKey && !this.creditCardService) {
        await this.initializeCreditCard(configState.spreedlyEnvironmentKey, configState.debug || false);
      }
    } catch (error) {
      this.logger.error('Error handling config update:', error);
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  public setSuccessUrl(url: string): void {
    this.setOrCreateMetaTag('next-success-url', url);
    this.setOrCreateMetaTag('next-next-url', url);
    this.setOrCreateMetaTag('os-next-page', url);
  }

  public setFailureUrl(url: string): void {
    this.setOrCreateMetaTag('next-failure-url', url);
    this.setOrCreateMetaTag('os-failure-url', url);
  }

  private setOrCreateMetaTag(name: string, content: string): void {
    let metaTag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;

    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = name;
      document.head.appendChild(metaTag);
    }

    metaTag.content = content;
  }

  public validateField(fieldName: string, value: any): { isValid: boolean; errorMessage?: string } {
    const result = this.validator.validateField(fieldName, value);
    return {
      isValid: result.isValid,
      ...(result.message && { errorMessage: result.message })
    };
  }

  public clearAllValidationErrors(): void {
    const checkoutStore = useCheckoutStore.getState();
    checkoutStore.clearAllErrors();
    this.validator.clearAllErrors();
  }

  public update(): void {
    this.scanAllFields();
    this.initializePhoneInputs();
  }

  protected override cleanupEventListeners(): void {
    if (this.submitHandler) {
      this.form.removeEventListener('submit', this.submitHandler);
    }

    if (this.changeHandler) {
      [...this.fields.values(), ...this.billingFields.values()].forEach(field => {
        field.removeEventListener('change', this.changeHandler!);
        field.removeEventListener('blur', this.changeHandler!);
        field.removeEventListener('input', this.changeHandler!);
      });
    }

    // Stops the poll and unsubscribes from the event bus.
    if (this.stopAutofillDetection) {
      this.stopAutofillDetection();
    }

    if (this.paymentMethodChangeHandler) {
      const paymentRadios = this.form.querySelectorAll([
        '[data-next-checkout-field="payment-method"]',
        '[os-checkout-field="payment-method"]',
        'input[name="payment_method"]'
      ].join(', '));
      paymentRadios.forEach(radio => {
        radio.removeEventListener('change', this.paymentMethodChangeHandler!);
      });
    }

    if (this.shippingMethodChangeHandler) {
      const shippingRadios = this.form.querySelectorAll('input[name="shipping_method"]');
      shippingRadios.forEach(radio => {
        radio.removeEventListener('change', this.shippingMethodChangeHandler!);
      });
    }

    if (this.billingAddressToggleHandler) {
      const billingToggle = this.form.querySelector('input[name="use_shipping_address"]');
      if (billingToggle) {
        billingToggle.removeEventListener('change', this.billingAddressToggleHandler!);
      }
    }

    if (this.boundHandleTestDataFilled) {
      document.removeEventListener('checkout:test-data-filled', this.boundHandleTestDataFilled);
    }

    if (this.boundHandleKonamiActivation) {
      document.removeEventListener('next:test-mode-activated', this.boundHandleKonamiActivation);
    }
  }

  private displayPaymentError(message: string): void {
    this.logger.info('[Payment Error] Displaying error:', message);

    // Use a slight delay to ensure DOM is ready
    setTimeout(() => {
      // Find the credit error container
      const errorContainer = document.querySelector('[data-next-component="credit-error"]');
      if (errorContainer instanceof HTMLElement) {
        // Find the message element
        const messageElement = errorContainer.querySelector('[data-next-component="credit-error-text"]');
        if (messageElement) {
          messageElement.textContent = message;
        }

        // Force show the error container
        errorContainer.style.display = 'flex';
        errorContainer.style.visibility = 'visible';
        errorContainer.style.opacity = '1';
        errorContainer.classList.add('visible');
        errorContainer.classList.remove('hidden');

        // Remove any inline styles that might be hiding it
        if (errorContainer.style.display === 'none') {
          errorContainer.style.removeProperty('display');
          errorContainer.style.display = 'flex';
        }

        this.logger.info('[Payment Error] Error container shown with message:', message);

        // Auto-hide after 10 seconds
        setTimeout(() => {
          errorContainer.style.display = 'none';
          errorContainer.classList.remove('visible');
        }, 10000);
      } else {
        this.logger.error('[Payment Error] Could not find error container element');
      }
    }, 100); // Small delay to ensure DOM is ready

    // Also emit an event for other components to handle
    this.emit('payment:error', { errors: [message] });
  }

  /**
   * Track begin_checkout event when checkout form initializes
   * This should be the ONLY place where begin_checkout is fired
   */
  private trackBeginCheckout(): void {
    // Prevent duplicate tracking
    if (this.hasTrackedBeginCheckout) {
      this.logger.debug('begin_checkout already tracked, skipping duplicate');
      return;
    }

    try {
      const cartStore = useCartStore.getState();
      const checkoutStore = useCheckoutStore.getState();

      // Only track if cart has items
      if (!cartStore.isEmpty && cartStore.items.length > 0) {
        this.hasTrackedBeginCheckout = true;

        // Track through analytics (this handles GTM, Facebook, etc.)
        nextAnalytics.track(EcommerceEvents.createBeginCheckoutEvent());

        // Only emit internal event for UI components that need to know checkout started
        // NOT for analytics tracking - that's already handled above
        this.emit('checkout:started', {
          formData: checkoutStore.formData,
          paymentMethod: checkoutStore.paymentMethod,
          isProcessing: checkoutStore.isProcessing,
          step: checkoutStore.step
        });

        this.logger.info('Tracked begin_checkout event on checkout form initialization');
      }
    } catch (error) {
      this.logger.warn('Failed to track begin_checkout event:', error);
    }
  }

  public override destroy(): void {
    // Clear any pending animation timers
    if (this.billingAnimationDebounceTimer) {
      clearTimeout(this.billingAnimationDebounceTimer);
    }

    // Clear all animation timeouts
    this.billingAnimationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.billingAnimationTimeouts.clear();
    this.billingListenerAbort.value?.abort();
    this.billingListenerAbort.value = null;

    if (this.validator) {
      this.validator.destroy();
    }

    if (this.creditCardService) {
      this.creditCardService.destroy();
    }

    if (this.prospectCartEnhancer) {
      this.prospectCartEnhancer.destroy();
    }

    this.phoneInputs.forEach((instance) => {
      try {
        instance.destroy();
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.phoneInputs.clear();

    this.autocompleteEnhancer?.destroy();

    this.fields.clear();
    this.billingFields.clear();
    this.paymentButtons.clear();

    super.destroy();
  }
}