/**
 * Checkout Form Enhancer - Consolidated but complete functionality using CheckoutValidator
 */

import { BaseEnhancer } from '@/core/base/base-enhancer';
import { useCheckoutStore, type CheckoutState } from '@/state/checkout';
import { useCartStore } from '@/state/cart';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { getApiClient } from '@/client';
import type { IApiClient } from '@/api/client.types';
import { CountryService, type Country, type CountryConfig } from '@/core/country-service';
import { preserveQueryParams } from '@/core/url-utils';
import type { CartState } from '@/types/global';
import { CreditCardService, type CreditCardData } from '../services/credit-card-service';
import { CheckoutValidator } from '../validation/checkout-validator';
import { UIService } from '../services/ui-service';
import { useAttributionStore } from '@/state/attribution';
import { useParameterStore } from '@/state/parameter';
import { AddressAutocompleteEnhancer } from '../address-autocomplete/address-autocomplete.enhancer';
import { ProspectCartEnhancer } from '../prospect-cart/prospect-cart.enhancer';
import { LoadingOverlay } from '@/core/ui/loading-overlay';
import { ExpressCheckoutProcessor } from '../processors/express-checkout-processor';
import { OrderManager } from '../managers/order-manager';
import { OrderBuilder } from '../builders/order-builder';
import { nextAnalytics, EcommerceEvents } from '@/core/analytics/index';
import {
  injectIntlTelInputStyles,
  initializePhoneInputs,
  type PhoneInputContext,
} from './phone-input';
import type { BillingAnimationContext } from './billing-animation';
import {
  reconcileBillingToggle,
  restoreBillingAddressFields,
  scanBillingFields,
  setupBillingForm,
  type BillingAddressRestoreContext,
  type BillingFormSetupContext,
} from './billing-form-setup';
import {
  populateExpirationFields,
  type ExpirationFieldsContext,
} from './expiration-fields';
import {
  populateBillingCountryDropdown,
  populateCountryDropdown,
  type CountryFieldsContext,
} from './country-fields';
import {
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
import {
  formatPostalCodeInPlace,
  type PostalCodeFormatContext,
} from './postal-code-format';
import {
  routeBillingField,
  type BillingFieldRoutingContext,
} from './billing-field-routing';
import { readFieldValue } from './field-value';
import {
  persistContactField,
  type ContactPersistenceContext,
} from './contact-persistence';
import {
  getFieldByName,
  getFieldNameFromElement,
  scanAllFields,
  type FieldLookupContext,
  type FieldScanContext,
} from './field-scanning';
import {
  clearAllCheckoutFields,
  populateFormData,
  type FormClearingContext,
  type FormPopulationContext,
} from './form-population';
import {
  createLocationFieldVisibility,
  type LocationFieldVisibility,
  type LocationFieldsContext,
} from './location-field-visibility';
import {
  applyCountryToAddressForms,
  resolveShippingCountry,
  type CountryApplicationContext,
  type CountryResolutionContext,
} from './country-selection';
import {
  detectMultiStepCheckout,
  handleStepNavigation,
  type MultiStepDetectionContext,
  type StepNavigationContext,
} from './multi-step-navigation';
import {
  handlePurchaseEvent,
  type DuplicatePurchaseWarningContext,
} from './duplicate-purchase-warning';
import {
  handleBillingAddressToggle,
  type BillingToggleContext,
} from './billing-toggle';
import {
  handlePaymentMethodChange,
  handleShippingMethodChange,
  type PaymentMethodContext,
  type ShippingMethodContext,
} from './method-selection';
import {
  handleKonamiActivation,
  handleTestDataFilled,
  type KonamiTestOrderContext,
  type TestDataFillContext,
} from './test-order';
import { applyFailureUrlMetaTags, applySuccessUrlMetaTags } from './meta-tags';
import 'intl-tel-input/build/css/intlTelInput.css';

// Consolidated constants
const SHIPPING_FORM_SELECTOR = '[os-checkout-component="shipping-form"], [data-next-component="shipping-form"]';
const BILLING_FORM_CONTAINER_SELECTOR = '[os-checkout-component="billing-form"], [data-next-component="billing-form"]';

/**
 * The one builder that assembles the `CreateOrder` payload. Stateless — it reads
 * the cart, checkout, campaign and attribution stores on each call — so the same
 * instance serves every submit. Express checkout reaches it through
 * `OrderManager`; this is the normal-submit door to the same code.
 */
const orderBuilder = new OrderBuilder();

/** The config-store snapshot the boot steps read (API key, Spreedly key, debug flag). */
type CheckoutFormConfig = ReturnType<typeof useConfigStore.getState>;

/** The checkout-store snapshot the field-routing steps read and write through. */
type CheckoutStoreSnapshot = ReturnType<typeof useCheckoutStore.getState>;

export class CheckoutFormEnhancer extends BaseEnhancer {
  private form!: HTMLFormElement;
  private apiClient!: IApiClient;
  private countryService!: CountryService;
  private creditCardService?: CreditCardService;
  private validator!: CheckoutValidator;
  private stateLoadingPromises: Map<string, Promise<any>> = new Map();
  private ui!: UIService;
  private prospectCartEnhancer?: ProspectCartEnhancer;
  private loadingOverlay: LoadingOverlay;
  private expressProcessor?: ExpressCheckoutProcessor;
  private orderManager?: OrderManager;
  /** True only while {@link displayPaymentError} is emitting — see {@link listenForPaymentErrors}. */
  private announcingPaymentError = false;

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

  /**
   * The city/state/postcode rows that stay collapsed until an address exists — see
   * `location-field-visibility.ts`, which owns their state.
   *
   * Undefined until {@link initializeLocationFieldVisibility} runs, which is late in the
   * boot sequence. Every call site therefore uses `?.`: a store update arriving before
   * that step must do nothing, exactly as it did when this was a method guarding on a
   * null element list.
   */
  private locationFields?: LocationFieldVisibility;

  // Event handlers
  private submitHandler?: (event: Event) => void;
  private changeHandler?: (event: Event) => void;
  private paymentMethodChangeHandler?: (event: Event) => void;
  private shippingMethodChangeHandler?: (event: Event) => void;
  private billingAddressToggleHandler?: (event: Event) => void;
  private boundHandleTestDataFilled?: EventListener;
  private boundHandleKonamiActivation?: EventListener;
  /**
   * Aborts every listener registered through {@link listen}. `cleanupEventListeners()`
   * aborts it, so base `destroy()` drops them all in one call. Same pattern as
   * `expiration-fields.ts` and `billing-animation.ts`.
   */
  private domListenerAbort = new AbortController();

  // Animation state management
  /**
   * Shared with `billing-animation.ts` as a ref, not a boolean: both that module and
   * { handleBillingAddressToggle} read and write it, and a copied primitive would
   * give each side its own flag.
   */
  private billingAnimationInProgress = { value: false };
  /**
   * The billing toggle's pending debounce timer, as a ref for the same reason as
   * {@link billingAnimationInProgress}: `billing-toggle.ts` sets and clears it while
   * {@link destroy} has to be able to clear it too.
   */
  private billingAnimationDebounceTimer: { value?: NodeJS.Timeout } = {};
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
  /**
   * Handle for the `begin_checkout` delay, so a form destroyed inside that window
   * does not still report the event — see {@link scheduleBeginCheckoutTracking}.
   */
  private beginCheckoutTimer?: ReturnType<typeof setTimeout>;

  // Multi-step checkout support
  private isMultiStep = false;
  private currentStep = 1;
  private nextStepUrl?: string;

  /**
   * Boot sequence for the checkout form, in the order the steps run.
   *
   * Each line below is one step; the order is the contract. A step that runs
   * before another needs what that earlier step produced — the validator needs
   * the phone inputs, the UI service needs the scanned fields, the store
   * subscriptions need the handlers they fire into.
   */
  public async initialize(): Promise<void> {
    this.bindFormElement();

    // Injects the CSS variables intl-tel-input needs for its flag/globe images.
    injectIntlTelInputStyles();

    this.detectMultiStepCheckout();
    this.loadingOverlay = new LoadingOverlay();

    // NOTE: Currency is initialized separately based on:
    // 1. URL parameter (?currency=XXX) - highest priority
    // 2. Session storage (previous selection) - medium priority
    // 3. Detected location - lowest priority
    // Currency does NOT change when shipping/billing country changes
    const config = useConfigStore.getState();

    this.initializeApiDependencies(config);
    await this.refreshAttribution();
    this.initializeOrderProcessors();

    // intl-tel-input is now bundled with the SDK - always available
    this.isIntlTelInputAvailable = true;

    this.initializeValidator();
    this.scanAllFields();
    this.cloneBillingFormFromShipping();
    this.restoreBillingChoice();
    this.initializeUIService();

    if (config.spreedlyEnvironmentKey) {
      await this.initializeCreditCard(config.spreedlyEnvironmentKey, config.debug);
    }

    await this.initializeAddressManagement(config);
    this.initializePhoneInputs();
    this.setupPhoneValidation();

    populateExpirationFields(this.expirationFieldsContext());

    this.setupEventHandlers();
    this.subscribeToStores();
    this.setupDebugEventListeners();

    await this.populateFormData();
    await this.restoreBillingAddress();
    this.initializeLocationFieldVisibility();
    await this.initializeProspectCart();

    this.listenForPaymentErrors();
    this.listenForDebugCountryChanges();
    this.setupBfcacheRestoreHandler();
    this.setupWindowFocusHandler();

    // Check for fresh purchase on initial load
    this.handlePurchaseEvent();

    this.scheduleBeginCheckoutTracking();

    this.logger.debug('CheckoutFormEnhancer initialized');
    this.emit('checkout:form-initialized', { form: this.form });
  }

  // ============================================================================
  // BOOT SEQUENCE STEPS — listed in the order `initialize` runs them
  // ============================================================================

  private bindFormElement(): void {
    this.validateElement();

    if (!(this.element instanceof HTMLFormElement)) {
      throw new Error('CheckoutFormEnhancer must be applied to a form element');
    }

    this.form = this.element;
    this.form.noValidate = true;
  }

  private initializeApiDependencies(config: CheckoutFormConfig): void {
    this.apiClient = getApiClient(config.apiKey);
    this.countryService = CountryService.getInstance();
  }

  /** Re-initializes attribution so the order carries this page's data, not the previous page's. */
  private async refreshAttribution(): Promise<void> {
    const attributionStore = useAttributionStore.getState();
    await attributionStore.initialize();
  }

  private initializeOrderProcessors(): void {
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
  }

  private initializeValidator(): void {
    this.validator = new CheckoutValidator(
      this.logger,
      this.countryService,
      undefined // PhoneInputManager will be handled by us
    );
  }

  private cloneBillingFormFromShipping(): void {
    const billingFormCloned = setupBillingForm(this.billingFormSetupContext());
    if (billingFormCloned) {
      scanBillingFields(this.billingFormSetupContext()); // Re-scan after cloning
    }
  }

  /**
   * Makes the billing checkbox, the billing section and `checkoutStore.sameAsShipping`
   * agree before the shopper sees the page.
   *
   * Runs after the clone step so the section it opens has fields in it, and before the
   * change handler is attached, so the checkbox is corrected by assignment rather than by
   * a synthetic click that would animate it. `reconcileBillingToggle` decides which side
   * wins — see its doc comment; a page with no toggle keeps whatever the store holds.
   */
  private restoreBillingChoice(): void {
    const checkoutStore = useCheckoutStore.getState();
    const stored = checkoutStore.sameAsShipping;
    const onPage = reconcileBillingToggle(
      this.billingFormSetupContext(),
      stored
    );

    if (onPage !== stored) {
      checkoutStore.setSameAsShipping(onPage);
      this.logger.info('[Billing] Adopted the markup choice into the store', {
        sameAsShipping: onPage,
      });
    }
  }

  private initializeUIService(): void {
    this.ui = new UIService(
      this.form,
      this.fields,
      this.logger,
      this.billingFields
    );
    this.ui.initialize();

    // Initialize payment forms to sync with DOM state
    this.ui.initializePaymentForms();
  }

  /** Runs after {@link initializePhoneInputs} so the validator can ask a live intl-tel-input instance. */
  private setupPhoneValidation(): void {
    this.validator.setPhoneValidator((phoneNumber: string, type: 'shipping' | 'billing' = 'shipping') => {
      const instance = this.phoneInputs.get(type);
      if (instance) {
        return instance.isValidNumber();
      }

      // Fallback to basic validation if instance not found
      return /^[\d\s\-\+\(\)]+$/.test(phoneNumber);
    });
  }

  private subscribeToStores(): void {
    this.subscribe(useCheckoutStore, this.handleCheckoutUpdate.bind(this));
    this.subscribe(useCartStore, this.handleCartUpdate.bind(this));
    this.subscribe(useConfigStore, this.handleConfigUpdate.bind(this));
  }

  private setupDebugEventListeners(): void {
    this.boundHandleTestDataFilled = this.handleTestDataFilled.bind(this);
    this.boundHandleKonamiActivation = this.handleKonamiActivation.bind(this);
    document.addEventListener('checkout:test-data-filled', this.boundHandleTestDataFilled as EventListener);
    document.addEventListener('next:test-mode-activated', this.boundHandleKonamiActivation as EventListener);
  }

  /**
   * Payment errors raised by other components (express checkout, Spreedly) surface in
   * this form.
   *
   * Registered through `this.on`, not `this.eventBus.on`: the bus is a page-lifetime
   * singleton, so a handler it does not record an unsubscribe for keeps firing on a
   * destroyed enhancer.
   *
   * {@link displayPaymentError} emits `payment:error` itself, so its own echo comes
   * straight back here and would re-enter the display forever. `announcingPaymentError`
   * is set only for the duration of that synchronous emit, which is what tells the echo
   * apart from an error raised elsewhere.
   */
  private listenForPaymentErrors(): void {
    this.on('payment:error', event => {
      if (this.announcingPaymentError) return;
      if (event.message) {
        this.displayPaymentError(event.message);
      }
    });
  }

  /** The debug country selector changes the country outside the form's own dropdown. */
  private listenForDebugCountryChanges(): void {
    this.listen(document, 'next:country-changed', async (e) => {
      const customEvent = e as CustomEvent;
      const { to: newCountry } = customEvent.detail;
      if (newCountry) {
        await this.handleCountryChange(newCountry);
      }
    });
  }

  /**
   * Restores a sane state when the browser serves this page back from bfcache.
   *
   * Reads the config store live rather than closing over a boot-time snapshot:
   * `spreedlyEnvironmentKey` can arrive *after* boot, in which case
   * {@link handleConfigUpdate} creates the credit-card service and a captured snapshot
   * would still say the key is missing — so the restore would skip re-initializing the
   * hosted fields it just checked for.
   */
  private setupBfcacheRestoreHandler(): void {
    this.listen<PageTransitionEvent>(window, 'pageshow', (event) => {
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
        if (this.creditCardService && useConfigStore.getState().spreedlyEnvironmentKey) {
          this.logger.info('Re-initializing credit card service after bfcache restore');
          this.creditCardService.initialize().catch(error => {
            this.logger.error('Failed to re-initialize credit card service:', error);
          });
        }

        // Check for fresh purchase event
        this.handlePurchaseEvent();
      }
    });
  }

  /**
   * Catches the user cancelling PayPal/Apple Pay/Google Pay, which returns focus
   * to the page without triggering `pageshow`.
   */
  private setupWindowFocusHandler(): void {
    this.listen(window, 'focus', () => {
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
  }

  /**
   * `begin_checkout` fires from here and nowhere else. The delay lets the
   * analytics providers finish registering first.
   *
   * The handle is kept so `destroy()` can cancel it — a form torn down inside those
   * 500 ms must not report a checkout the shopper never reached.
   */
  private scheduleBeginCheckoutTracking(): void {
    this.beginCheckoutTimer = setTimeout(() => {
      this.trackBeginCheckout();
    }, 500);
  }

  // ============================================================================
  // FIELD SCANNING AND MANAGEMENT
  // ============================================================================

  /** The five things `field-scanning.ts` needs from this form. */
  private fieldScanContext(): FieldScanContext {
    return {
      form: this.form,
      fields: this.fields,
      paymentButtons: this.paymentButtons,
      logger: this.logger,
      expirationFields: this.expirationFieldsContext(),
    };
  }

  /** The two maps a field name could resolve in. */
  private fieldLookupContext(): FieldLookupContext {
    return { fields: this.fields, billingFields: this.billingFields };
  }

  private scanAllFields(): void {
    const submitButton = scanAllFields(this.fieldScanContext());
    if (submitButton) {
      this.submitButton = submitButton;
    }
  }

  // ============================================================================
  // ADDRESS AND COUNTRY MANAGEMENT
  // ============================================================================

  /**
   * Gets the address half of the form working: which countries can be shipped to, which
   * one this shopper starts on, what its provinces are, and address autocomplete.
   *
   * Written as an ordered list of named steps rather than lifted into a module — it needs
   * ten of this class's fields, so a context object for it would have been the enhancer
   * again. The one genuinely self-contained decision inside it, *which* country to open
   * on, did come out: [`country-selection.ts`](./country-selection.ts).
   *
   * The whole sequence is wrapped so a country service that cannot answer leaves a usable
   * form rather than a half-initialized one, and so the loading class always comes off.
   */
  private async initializeAddressManagement(config: any): Promise<void> {
    try {
      this.addClass('next-loading-countries');

      this.configureCountryService(config);

      // Built before the country list is fetched, but initialized after — it holds the
      // field maps by reference, so only its `initialize` call depends on the timing.
      const autocompleteOptions = this.createAddressAutocomplete(config);

      const locationData = await this.countryService.getLocationData();
      this.countries = locationData.countries;

      const checkoutStore = useCheckoutStore.getState();
      const storedCountry = checkoutStore.formData.country;
      // IMPORTANT: Save stored province before loading states (updateStateOptions clears it)
      const storedProvince = checkoutStore.formData.province;

      const selectedCountryCode = resolveShippingCountry(
        this.countryResolutionContext(),
        locationData.detectedCountryCode,
        storedCountry
      );
      this.detectedCountryCode = selectedCountryCode;

      this.applySelectedCountry(selectedCountryCode, locationData.countries);
      await this.loadProvincesForSelectedCountry(
        selectedCountryCode,
        storedCountry,
        storedProvince
      );

      if (this.billingFields.size > 0) {
        populateBillingCountryDropdown(this.countryFieldsContext());
      }

      // Initialize address autocomplete
      await this.autocompleteEnhancer!.initialize(autocompleteOptions);

    } catch (error) {
      this.logger.error('Failed to load country data:', error);
    } finally {
      this.removeClass('next-loading-countries');
    }
  }

  /**
   * Tells the country service which countries this campaign ships to.
   *
   * The campaign API wins over `addressConfig.showCountries`: a merchant who cannot ship
   * somewhere must not be able to re-offer it from page config.
   */
  private configureCountryService(config: any): void {
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
  }

  /**
   * Constructs the address-suggestion enhancer and returns which providers it may use.
   *
   * Google Maps is on unless the page turns it off and a key exists; the NextCommerce
   * lookup is off unless the page turns it on. The flags are returned rather than stored
   * because the enhancer is only *initialized* later, once the country list has arrived.
   */
  private createAddressAutocomplete(config: any): {
    enableGoogleMaps: boolean;
    enableNextCommerce: boolean;
  } {
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

    return { enableGoogleMaps, enableNextCommerce };
  }

  /**
   * Fills the shipping country dropdown and selects the resolved country.
   *
   * Selecting it dispatches a bubbling `change` — but this runs before
   * {@link setupEventHandlers}, so nothing is listening yet, which is why the store write
   * and the error clear below are done here by hand rather than left to the change handler.
   */
  private applySelectedCountry(
    selectedCountryCode: string,
    countries: Country[]
  ): void {
    const countryField = this.fields.get('country');
    if (countryField instanceof HTMLSelectElement) {
      populateCountryDropdown(countryField, countries, selectedCountryCode);

      if (selectedCountryCode) {
        this.updateFormData({ country: selectedCountryCode });
        this.clearError('country');
      }
    }
  }

  /**
   * Refills the province dropdown for the resolved country and puts a stored province
   * back into it.
   *
   * `updateStateOptions` clears the stored province as a side effect of rebuilding the
   * list, which is why the caller reads it *before* calling here. It is only restored when
   * the stored country is the one that won — a province from a different country is not a
   * valid choice in this list.
   */
  private async loadProvincesForSelectedCountry(
    selectedCountryCode: string,
    storedCountry: string | undefined,
    storedProvince: string | undefined
  ): Promise<void> {
    // NOTE: We don't need to fetch config here because updateStateOptions()
    // will fetch the correct country config and update form labels
    // This ensures postcode label/regex/validation always matches the selected country
    if (!selectedCountryCode) return;

    const provinceField = this.fields.get('province');
    if (provinceField instanceof HTMLSelectElement) {
      // updateStateOptions fetches the correct country config and updates form labels
      await updateStateOptions(this.shippingStateFieldsContext(), selectedCountryCode, provinceField);
      // this.currentCountryConfig.value is already set by updateStateOptions

      // Restore stored province after states are loaded (if country matches)
      if (storedProvince && storedCountry === selectedCountryCode) {
        const optionExists = Array.from(provinceField.options).some(opt => opt.value === storedProvince);
        if (optionExists) {
          provinceField.value = storedProvince;
          this.updateFormData({ province: storedProvince });
        }
      }
    }

    // updateFormLabels is already called by updateStateOptions
    // No need to call it again here
  }

  /** The three things `country-selection.ts` needs to resolve the starting country. */
  private countryResolutionContext(): CountryResolutionContext {
    return {
      countries: this.countries,
      countryService: this.countryService,
      logger: this.logger,
    };
  }

  /** The six things `country-selection.ts` needs to apply a country to both forms. */
  private countryApplicationContext(): CountryApplicationContext {
    return {
      logger: this.logger,
      fields: this.fields,
      billingFields: this.billingFields,
      updateFormData: data => this.updateFormData(data),
      shippingStateFields: this.shippingStateFieldsContext(),
      stateFields: this.stateFieldsContext(),
    };
  }

  private async handleCountryChange(newCountry: string): Promise<void> {
    await applyCountryToAddressForms(
      this.countryApplicationContext(),
      newCountry
    );
  }

  // ============================================================================
  // LOCATION FIELD VISIBILITY MANAGEMENT
  // ============================================================================

  /** The six things `location-field-visibility.ts` needs from this form. */
  private locationFieldsContext(): LocationFieldsContext {
    return {
      form: this.form,
      fields: this.fields,
      billingFields: this.billingFields,
      logger: this.logger,
      eventBus: this.eventBus,
      listen: (target, type, handler) => this.listen(target, type, handler),
    };
  }

  /**
   * Reveals the collapsed address rows once there is an address, and keeps doing so as
   * one arrives from typing, autofill or autocomplete.
   *
   * Runs after {@link populateFormData} and {@link restoreBillingAddress} on purpose: it
   * decides whether each set is already worth showing by reading the address input's
   * current value.
   */
  private initializeLocationFieldVisibility(): void {
    this.locationFields = createLocationFieldVisibility(
      this.locationFieldsContext()
    );
    this.locationFields.initialize();

    // Listen for autocomplete fill events. `this.on` records the unsubscribe that
    // `destroy()` runs; `this.eventBus.on` would outlive the form.
    this.on('address:autocomplete-filled', (event: any) => {
      if (event.type === 'shipping') {
        this.showLocationFields();
      } else if (event.type === 'billing') {
        this.showBillingLocationFields();
      }
    });
  }

  private showLocationFields(): void {
    this.locationFields?.showLocationFields();
  }

  private showBillingLocationFields(): void {
    this.locationFields?.showBillingLocationFields();
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
      this.listen(this.form, 'next:prospect-cart-created', (event: Event) => {
        const customEvent = event as CustomEvent;
        this.logger.info('Prospect cart created', customEvent.detail);
      });

      this.listen(this.form, 'next:prospect-cart-abandoned', (event: Event) => {
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

  /**
   * The same three plus the state-field context, for the one billing-setup step that has
   * to refill the province dropdown before it can write a province into it.
   */
  private billingAddressRestoreContext(): BillingAddressRestoreContext {
    return {
      ...this.billingFormSetupContext(),
      stateFields: this.stateFieldsContext(),
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

        // Display credit card validation errors. Every message the card fields
        // reported is joined into the one string the visitor reads, and
        // `displayPaymentError` is what puts that string on the bus as
        // `payment:error` — so this path emits once, not twice.
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

  /** The five things `form-population.ts` needs to empty this form. */
  private formClearingContext(): FormClearingContext {
    return {
      form: this.form,
      fields: this.fields,
      billingFields: this.billingFields,
      detectedCountryCode: this.detectedCountryCode,
      logger: this.logger,
      clearCardFields:
        this.creditCardService &&
        typeof this.creditCardService.clearFields === 'function'
          ? () => this.creditCardService?.clearFields()
          : undefined,
    };
  }

  private clearAllCheckoutFields(): void {
    clearAllCheckoutFields(this.formClearingContext());
  }

  // ============================================================================
  // PURCHASE EVENT HANDLING
  // ============================================================================

  /** The four things `duplicate-purchase-warning.ts` needs from this form. */
  private duplicatePurchaseWarningContext(): DuplicatePurchaseWarningContext {
    return {
      logger: this.logger,
      ui: this.ui,
      populateFormData: () => {
        void this.populateFormData();
      },
      clearAllCheckoutFields: () => this.clearAllCheckoutFields(),
    };
  }

  private async handlePurchaseEvent(): Promise<void> {
    await handlePurchaseEvent(this.duplicatePurchaseWarningContext());
  }

  // ============================================================================
  // ORDER MANAGEMENT
  // ============================================================================

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

      const orderData = orderBuilder.buildOrder(
        checkoutStore.formData,
        cartStore.items,
        checkoutStore.paymentMethod,
        checkoutStore.paymentToken,
        checkoutStore.billingAddress,
        checkoutStore.sameAsShipping,
        undefined, // no explicit choice here — the builder resolves it from the stores
        checkoutStore.vouchers
      );
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

      const testOrderData = orderBuilder.buildTestOrder(
        cartStore.items,
        vouchers
      );

      const order = await this.apiClient.createOrder(testOrderData);
      // cartStore.reset();

      return order;

    } catch (error) {
      this.logger.error('Failed to create test order:', error);
      throw error;
    }
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

  // ============================================================================
  // MULTI-STEP CHECKOUT SUPPORT
  // ============================================================================

  /** The three things `multi-step-navigation.ts` needs to recognise a step. */
  private multiStepDetectionContext(): MultiStepDetectionContext {
    return {
      form: this.form,
      logger: this.logger,
      setStep: step => useCheckoutStore.getState().setStep(step),
    };
  }

  /**
   * Detect if this is a multi-step checkout by checking for step attributes
   *
   * A single-page checkout gets `null` back and keeps the defaults these three fields
   * were declared with — the same no-op the original's `if (stepAttr)` produced.
   */
  private detectMultiStepCheckout(): void {
    const state = detectMultiStepCheckout(this.multiStepDetectionContext());
    if (!state) return;

    this.isMultiStep = state.isMultiStep;
    this.currentStep = state.currentStep;
    this.nextStepUrl = state.nextStepUrl;
  }

  /**
   * The billing pair every validation path must be given: the separate billing address the
   * shopper entered, and whether they asked for one at all.
   *
   * The checkout store is the single source for both — `handleFormSubmit` reads the same
   * two fields for its `validateForm` call, and `createOrder` hands the same two to
   * `OrderBuilder`, which decides from them whether the order carries a `billing_address`
   * block. Two answers to "is billing the
   * same as shipping?" on one page is how a form passes validation and then builds an order
   * that contradicts it.
   */
  private getBillingValidationInput(): {
    billingAddress: CheckoutState['billingAddress'];
    sameAsShipping: boolean;
  } {
    const { billingAddress, sameAsShipping } = useCheckoutStore.getState();
    return { billingAddress, sameAsShipping };
  }

  /**
   * The eight things `multi-step-navigation.ts` needs to move to the next step.
   *
   * Built fresh per call: `currentStep` and `nextStepUrl` are read at submit time, and a
   * context captured at boot would still hold the values detection wrote.
   */
  private stepNavigationContext(): StepNavigationContext {
    return {
      currentStep: this.currentStep,
      nextStepUrl: this.nextStepUrl,
      validator: this.validator,
      countryConfigs: this.countryConfigs,
      currentCountryConfig: this.currentCountryConfig,
      loadingOverlay: this.loadingOverlay,
      getBillingValidationInput: () => this.getBillingValidationInput(),
      logger: this.logger,
    };
  }

  /**
   * Handle step navigation for multi-step checkout
   *
   * `cartStore` is passed by {@link handleFormSubmit} and has never been read — a step
   * navigation creates no order. It is kept on the signature rather than dropped so the
   * submit path stays untouched by this move.
   */
  private async handleStepNavigation(checkoutStore: any, cartStore: any): Promise<void> {
    void cartStore;
    await handleStepNavigation(this.stepNavigationContext(), checkoutStore);
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

  /**
   * Routes one field interaction — a `blur`, an `input` or a `change` on any checkout
   * field.
   *
   * Two independent jobs, in order. **Routing** branches on the field's *name*: billing
   * names land in `billingAddress` under their API spellings, everything else in
   * `formData`, and a handful of names carry side effects (refilling the province
   * dropdown, revealing the address rows, remembering the shopper's contact details).
   * **Display** branches on the *event type* and lives in
   * [`field-validation-display.ts`](./field-validation-display.ts) — it runs for both
   * branches, which is why it sits outside them.
   */
  private async handleFieldChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const fieldName = this.getFieldNameFromElement(target);

    if (!fieldName) return;

    const checkoutStore = useCheckoutStore.getState();

    if (fieldName.startsWith('billing-')) {
      await routeBillingField(
        this.billingFieldRoutingContext(),
        fieldName,
        target,
        checkoutStore
      );
    } else {
      await this.routeShippingField(fieldName, target, event, checkoutStore);
    }

    updateFieldValidationDisplay(
      this.fieldValidationContext(),
      event.type,
      fieldName,
      target.value
    );
  }

  // ============================================================================
  // FIELD VALUE ROUTING — the steps `handleFieldChange` runs, in order
  // ============================================================================

  /** The two things `postal-code-format.ts` needs from this form. */
  private postalCodeFormatContext(): PostalCodeFormatContext {
    return {
      countryService: this.countryService,
      countryConfigs: this.countryConfigs,
    };
  }

  /** The three things `contact-persistence.ts` needs from this form. */
  private contactPersistenceContext(): ContactPersistenceContext {
    return {
      prospectCartEnhancer: this.prospectCartEnhancer,
      phoneInputs: this.phoneInputs,
      logger: this.logger,
    };
  }

  /** The three things `billing-field-routing.ts` needs from this form. */
  private billingFieldRoutingContext(): BillingFieldRoutingContext {
    return {
      billingFields: this.billingFields,
      postalCodeFormat: this.postalCodeFormatContext(),
      stateFields: this.stateFieldsContext(),
    };
  }

  /**
   * Every other field: format its postcode, write its value into `formData`, then run
   * whatever that particular name triggers.
   */
  private async routeShippingField(
    fieldName: string,
    target: HTMLInputElement | HTMLSelectElement,
    event: Event,
    checkoutStore: CheckoutStoreSnapshot
  ): Promise<void> {
    if (fieldName === 'postal' && target instanceof HTMLInputElement) {
      formatPostalCodeInPlace(
        this.postalCodeFormatContext(),
        target,
        this.fields.get('country')
      );
    }

    this.updateFormData({
      [fieldName]: readFieldValue(fieldName, target, this.phoneInputs),
    });
    checkoutStore.clearError(fieldName);

    this.validateContactFieldOnCommit(fieldName, target, event.type);

    if (fieldName === 'country') {
      await this.applyCountrySelection(target);
    }

    if (fieldName === 'address1') {
      this.revealAddressRows(target, checkoutStore);
    }

    // Only update prospect cart and storage on blur/change events, not on every input
    if (event.type === 'blur' || event.type === 'change') {
      persistContactField(
        this.contactPersistenceContext(),
        fieldName,
        target.value
      );
    }
  }

  /**
   * Validates the four fields whose format is worth judging the moment the shopper is
   * done with them — an unusable email or a name of punctuation is better caught here than
   * at the payment gateway.
   */
  private validateContactFieldOnCommit(
    fieldName: string,
    target: HTMLInputElement | HTMLSelectElement,
    eventType: string
  ): void {
    // Validate fields on blur - simplified without redundant fallback messages
    const fieldsToValidate = ['email', 'city', 'fname', 'lname'];

    if (fieldsToValidate.includes(fieldName) && (eventType === 'blur' || eventType === 'change')) {
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
  }

  /**
   * A new shipping country: rebuild the province dropdown for it and remember the choice
   * for the shopper's next page.
   */
  private async applyCountrySelection(
    target: HTMLInputElement | HTMLSelectElement
  ): Promise<void> {
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

  /**
   * Reveals the city / province / postcode rows once a street address exists, since forms
   * that start collapsed hide them until there is something to put in them.
   */
  private revealAddressRows(
    target: HTMLInputElement | HTMLSelectElement,
    checkoutStore: CheckoutStoreSnapshot
  ): void {
    // Show location fields when address1 is populated
    if (!(target.value && target.value.trim().length > 0)) return;

    this.showLocationFields();
    this.trackAddShippingInfoOnAddress(checkoutStore);
  }

  /**
   * Fires `add_shipping_info` the first time a whole address is on the form.
   *
   * Kept here rather than shared with the copy in `autofill-detection.ts`: the two log
   * different reasons (`address complete` vs `browser autofill`), and folding them into one
   * templated message would take both lines out of the published log reference.
   */
  private trackAddShippingInfoOnAddress(
    checkoutStore: CheckoutStoreSnapshot
  ): void {
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


  private getFieldNameFromElement(element: HTMLElement): string | null {
    return getFieldNameFromElement(element);
  }

  private getFieldByName(fieldName: string): HTMLElement | null {
    return getFieldByName(this.fieldLookupContext(), fieldName);
  }

  /** The one thing `method-selection.ts` needs to switch payment method. */
  private paymentMethodContext(): PaymentMethodContext {
    return { ui: this.ui };
  }

  private handlePaymentMethodChange(event: Event): void {
    handlePaymentMethodChange(this.paymentMethodContext(), event);
  }

  // Methods moved to CheckoutUIHelpers class - expandPaymentForm and collapsePaymentForm

  /** The two things `method-selection.ts` needs to switch shipping method. */
  private shippingMethodContext(): ShippingMethodContext {
    return {
      hasTrackedShippingInfo: this.hasTrackedShippingInfo,
      logger: this.logger,
    };
  }

  private handleShippingMethodChange(event: Event): void {
    handleShippingMethodChange(this.shippingMethodContext(), event);
  }

  /** The five things `billing-toggle.ts` needs from this form. */
  private billingToggleContext(): BillingToggleContext {
    return {
      animationInProgress: this.billingAnimationInProgress,
      debounceTimer: this.billingAnimationDebounceTimer,
      animation: this.billingAnimationContext(),
      billingFields: this.billingFields,
      logger: this.logger,
    };
  }

  private handleBillingAddressToggle(event: Event): void {
    handleBillingAddressToggle(this.billingToggleContext(), event);
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

  /** The seven things `form-population.ts` needs to refill this form. */
  private formPopulationContext(): FormPopulationContext {
    return {
      fields: this.fields,
      detectedCountryCode: this.detectedCountryCode,
      logger: this.logger,
      phoneInputs: this.phoneInputs,
      shippingStateFields: this.shippingStateFieldsContext(),
      updateFormData: data => this.updateFormData(data),
      updateLabelsForPopulatedData: () => this.ui.updateLabelsForPopulatedData(),
    };
  }

  private async populateFormData(): Promise<void> {
    await populateFormData(this.formPopulationContext());
  }

  /**
   * The billing half of {@link populateFormData}: puts the stored billing address back
   * into the cloned billing fields.
   *
   * Runs immediately after that step, and **before**
   * {@link initializeLocationFieldVisibility} — that step decides whether the billing
   * city/state/postcode rows are on screen by reading `billing-address1`, so a value
   * written after it would sit behind an empty check and stay hidden.
   *
   * Restores only when the store says the shopper chose a *separate* billing address.
   * `checkoutStore.reset()` returns `sameAsShipping` to `true` but leaves `billingAddress`
   * behind (finding 156), so a page booted after a completed order can still hold the
   * previous shopper's address. Gating on the choice keeps that out of the DOM instead of
   * writing it into collapsed inputs that a later untick would put on screen.
   */
  private async restoreBillingAddress(): Promise<void> {
    const { sameAsShipping, billingAddress } = useCheckoutStore.getState();
    if (sameAsShipping || !billingAddress) return;

    await restoreBillingAddressFields(
      this.billingAddressRestoreContext(),
      billingAddress
    );

    this.ui.updateLabelsForPopulatedData();
  }

  /** The three things `test-order.ts` needs to refill the form from the debug panel. */
  private testDataFillContext(): TestDataFillContext {
    return {
      fields: this.fields,
      ui: this.ui,
      populateFormData: () => {
        void this.populateFormData();
      },
    };
  }

  private handleTestDataFilled(_event: Event): void {
    handleTestDataFilled(this.testDataFillContext());
  }

  /** The six things `test-order.ts` needs to place a Konami test order. */
  private konamiTestOrderContext(): KonamiTestOrderContext {
    return {
      validator: this.validator,
      logger: this.logger,
      populateFormData: () => {
        void this.populateFormData();
      },
      createTestOrder: () => this.createTestOrder(),
      emit: (event, order) => this.emit(event, order),
      handleOrderRedirect: order => this.handleOrderRedirect(order),
    };
  }

  private async handleKonamiActivation(event: Event): Promise<void> {
    await handleKonamiActivation(this.konamiTestOrderContext(), event);
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
    applySuccessUrlMetaTags(url);
  }

  public setFailureUrl(url: string): void {
    applyFailureUrlMetaTags(url);
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

  /**
   * `addEventListener` bound to this form's lifetime.
   *
   * Use it for every `document`, `window` or element listener whose handler is an
   * inline arrow or a fresh `.bind(this)` — `removeEventListener` needs the exact
   * reference back, which neither of those can give, so the listener would otherwise
   * be unremovable. {@link cleanupEventListeners} aborts the signal and they all go.
   */
  private listen<E extends Event>(
    target: Document | Window | HTMLElement,
    type: string,
    handler: (event: E) => void
  ): void {
    target.addEventListener(type, handler as EventListener, {
      signal: this.domListenerAbort.signal,
    });
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

    // Everything registered with an inline arrow or a fresh `.bind(this)`: the
    // `next:country-changed`, `pageshow` and `focus` handlers, the address-field
    // listeners, and the prospect-cart ones on the form.
    this.domListenerAbort.abort();
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

    // Also emit an event for other components to handle. The flag marks this as
    // our own echo, so `listenForPaymentErrors` does not display it a second time.
    this.announcingPaymentError = true;
    try {
      this.emit('payment:error', { message });
    } finally {
      this.announcingPaymentError = false;
    }
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
    if (this.billingAnimationDebounceTimer.value) {
      clearTimeout(this.billingAnimationDebounceTimer.value);
    }

    // Clear all animation timeouts
    this.billingAnimationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.billingAnimationTimeouts.clear();
    this.billingListenerAbort.value?.abort();
    this.billingListenerAbort.value = null;

    // A form torn down inside the 500 ms analytics delay must not still report.
    if (this.beginCheckoutTimer) {
      clearTimeout(this.beginCheckoutTimer);
      this.beginCheckoutTimer = undefined;
    }

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

    // Stops the 500 ms autofill poll and every floating-label listener.
    this.ui?.destroy();

    super.destroy();

    // After `super.destroy()`, never before: it runs `cleanupEventListeners()`, which
    // removes the change/blur/input handlers by iterating these very maps. Clearing
    // them first left every checkout field holding all three listeners.
    this.fields.clear();
    this.billingFields.clear();
    this.paymentButtons.clear();
  }
}