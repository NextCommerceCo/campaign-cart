/**
 * SDK Initializer
 * Handles auto-initialization, configuration loading, and setup
 */

import { createLogger, Logger, LogLevel } from '@/core/logger';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore, cartOperations } from '@/state/cart';
import { useOrderStore } from '@/state/order';
import { useAttributionStore } from '@/state/attribution';
import { AttributeScanner } from './attribute-scanner';
import { NextCommerce } from '@/core/next-commerce';
// Debug overlay imported dynamically when needed
import { EventBus } from '@/core/events';
import { getApiClient } from '@/client';
import { CART_STORAGE_KEY } from '@/core/storage';
import { CountryService, Country, LocationData } from '@/core/country-service';
import * as urlParamMethods from '@/core/sdk-initializer.url-params';
import * as storageResetMethods from '@/core/sdk-initializer.storage-reset';
import * as debugUtilsMethods from '@/core/sdk-initializer.debug-utils';

export class SDKInitializer {
  private static logger = createLogger('SDKInitializer');
  private static initialized = false;
  private static attributeScanner: AttributeScanner | null = null;
  private static retryAttempts = 0;
  private static maxRetries = 3;
  private static initStartTime = 0;
  private static campaignLoadStartTime = 0;
  private static campaignLoadTime = 0;
  private static campaignFromCache = false;
  private static attributionListenersCleanup: (() => void) | null = null;

  public static async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('SDK already initialized');
      return;
    }

    try {
      this.logger.info('Initializing NextCommerce Campaign Cart SDK v2...');
      this.initStartTime = Date.now();

      // Wait for DOM to be ready
      await this.waitForDOM();

      // Signal loading state to the page so developers can show skeleton UIs
      document.body.setAttribute('data-next-sdk-loading', 'true');

      // Load configuration
      await this.loadConfiguration();

      // NEW: Initialize location and currency detection EARLY (before campaign data)
      await this.initializeLocationAndCurrency();

      // Initialize attribution store
      await this.initializeAttribution();

      // Load campaign data (will now use the detected/selected currency)
      await this.loadCampaignData();

      // Initialize analytics after campaign data is loaded
      await this.initializeAnalytics();

      // IMPORTANT: Wait for cart store to fully rehydrate from storage
      // This prevents race conditions where display enhancers initialize with empty cart state
      await this.waitForStoreRehydration();

      // Clear cart if meta[name="next-clear-cart"] content="true"
      if (useConfigStore.getState().clearCartOnInit) {
        cartOperations.clear();
        this.logger.debug('Cart cleared on init (next-clear-cart)');
      }

      // Initialize global error handler
      this.initializeErrorHandler();

      // Check if there's a ref_id parameter and load order if found
      await this.checkAndLoadOrder();

      // Scan DOM for data attributes
      await this.scanAndEnhanceDOM();

      // Set up ready callback system
      this.setupReadyCallbacks();

      // Initialize debug utilities if debug mode is enabled
      await this.initializeDebugMode();

      this.initialized = true;
      const initTime = Date.now() - this.initStartTime;
      this.logger.info('SDK initialization complete ✅');

      this.retryAttempts = 0;

      // Clear global loading state — page skeletons can now hide
      document.body.setAttribute('data-next-sdk-loading', 'false');

      // Emit initialization event
      this.emitInitializedEvent();
    } catch (error) {
      this.logger.error('SDK initialization failed:', error);

      // Leave it "true": nothing after the failed step ran — no DOM scan, no
      // window.next, no next:display-ready — so a page revealing itself on
      // "false" would show raw un-enhanced markup. True through every retry
      // and after the final failure alike (findings #26, #41).

      // Retry logic
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        this.logger.warn(
          `Retrying initialization (attempt ${this.retryAttempts}/${this.maxRetries})...`
        );

        // Wait before retry
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * this.retryAttempts)
        );
        return this.initialize();
      }

      // Step 9's error handler never installs this early in boot, and
      // window.next/nextDebug never get created either — this emit is the
      // only failure signal a page can subscribe to (finding #26).
      const message = error instanceof Error ? error.message : String(error);
      EventBus.getInstance().emit('error:occurred', {
        message,
        code: 'SDK_INIT_FAILED',
        details: { retryAttempts: this.retryAttempts },
      });

      throw error;
    }
  }

  /**
   * Detects the visitor's country and picks the display currency, before
   * campaign prices are fetched so they arrive in the right currency.
   *
   * Left whole here rather than split into a sibling module like
   * `sdk-initializer.url-params.ts`: `src/tests/docs/coreLogs.test.ts`'s
   * "samples healthy boot from messages that exist" check reads
   * `CORE_HEALTHY_BOOT` against a `Map` keyed only by console prefix, not
   * file — so once two files share the `SDKInitializer` prefix, only the
   * *last*-declared file's messages are checked, and several of this
   * method's `info` lines (`Initializing location and currency
   * detection...`, `User location detected:`, `Using detected currency:`)
   * are in `CORE_HEALTHY_BOOT`. Moving them to another file makes that check
   * fail no matter which file is declared last, since the two files'
   * messages can never both be the "last" one. See `docs/code-findings.md`
   * if this needs revisiting.
   */
  private static async initializeLocationAndCurrency(): Promise<void> {
    try {
      const configStore = useConfigStore.getState();

      // Only initialize if currencyBehavior is explicitly set to 'auto'
      if (
        !configStore.currencyBehavior ||
        configStore.currencyBehavior !== 'auto'
      ) {
        this.logger.info(
          'Skipping location/currency detection (currencyBehavior is not set to auto)'
        );
        // Even when auto-detection is disabled, restore a previously chosen
        // currency from session so subsequent page loads (post-checkout,
        // upsells, etc.) keep the same currency the user paid in.
        const urlParams = new URLSearchParams(window.location.search);
        const urlCurrency = urlParams.get('currency');
        const savedCurrency = sessionStorage.getItem('next_selected_currency');
        const restored =
          (urlCurrency && urlCurrency.toUpperCase()) || savedCurrency || '';
        if (restored) {
          if (urlCurrency) {
            sessionStorage.setItem('next_selected_currency', restored);
          }
          configStore.updateConfig({ selectedCurrency: restored });
        }
        return;
      }

      this.logger.info('Initializing location and currency detection...');

      // Initialize country service early
      const countryService = CountryService.getInstance();

      // Check for country override in URL or session
      const urlParams = new URLSearchParams(window.location.search);
      const countryOverride = urlParams.get('country');
      const savedCountry = sessionStorage.getItem('next_selected_country');

      // Priority: URL param > saved preference > auto-detection
      const forcedCountry = countryOverride || savedCountry;

      let locationData: LocationData | null = null;

      if (forcedCountry) {
        // Use forced country instead of detection
        this.logger.info(
          `Using forced country: ${forcedCountry} (source: ${countryOverride ? 'URL' : 'session'})`
        );

        try {
          const response = await fetch(
            `https://cdn-countries.muddy-wind-c7ca.workers.dev/countries/${forcedCountry.toUpperCase()}/states`
          );

          if (response.ok) {
            const data = await response.json();

            // Format response to match location detection structure
            locationData = {
              detectedCountryCode: forcedCountry.toUpperCase(),
              detectedCountryConfig: data.countryConfig || {
                currencyCode: 'USD',
                currencySymbol: '$',
                stateLabel: 'State / Province',
                stateRequired: true,
                postcodeLabel: 'Postcode / ZIP',
                postcodeMinLength: 2,
                postcodeMaxLength: 20,
              },
              detectedStates: data.states || [],
              countries: [] as Country[],
            };

            // Save to session if from URL
            if (countryOverride) {
              sessionStorage.setItem(
                'next_selected_country',
                countryOverride.toUpperCase()
              );
            }

            this.logger.info('Country config loaded:', {
              country: locationData?.detectedCountryCode,
              currency: locationData?.detectedCountryConfig.currencyCode,
            });
          } else {
            this.logger.warn(
              `Failed to fetch country config for ${forcedCountry}, falling back to detection`
            );
          }
        } catch (error) {
          this.logger.error('Error fetching country config:', error);
        }
      }

      // If no forced country or fetch failed, use normal detection
      if (!locationData) {
        // Apply address config if available
        if (configStore.addressConfig) {
          countryService.setConfig(configStore.addressConfig);
        }

        // Fetch location data with timeout to prevent blocking
        const locationDataPromise = countryService.getLocationData();
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error('Location detection timeout')),
            3000
          )
        );

        try {
          locationData = await Promise.race([
            locationDataPromise,
            timeoutPromise,
          ]);
        } catch (error) {
          this.logger.warn(
            'Location detection failed or timed out, using defaults:',
            error
          );
          // Use fallback data
          locationData = {
            detectedCountryCode: 'US',
            detectedCountryConfig: {
              stateLabel: 'State',
              stateRequired: true,
              postcodeLabel: 'ZIP Code',
              postcodeRegex: '^\\d{5}(-\\d{4})?$',
              postcodeMinLength: 5,
              postcodeMaxLength: 10,
              postcodeExample: '12345',
              postcodeFormat: null,
              currencyCode: 'USD',
              currencySymbol: '$',
            },
            detectedStates: [],
            countries: [] as Country[],
          };
        }
      } else if (locationData && !locationData.countries?.length) {
        // If we have forced country data but no countries list, fetch just the countries
        try {
          const countriesData = await countryService.getLocationData();
          locationData.countries = countriesData.countries || [];
        } catch (error) {
          this.logger.warn('Failed to fetch countries list:', error);
        }
      }

      if (locationData) {
        this.logger.info('User location detected:', {
          country: locationData.detectedCountryCode,
          currency: locationData.detectedCountryConfig.currencyCode,
          currencySymbol: locationData.detectedCountryConfig.currencySymbol,
          ip: locationData.detectedIp,
        });

        // Store in config for global access
        configStore.updateConfig({
          detectedCountry: locationData.detectedCountryCode,
          detectedCurrency: locationData.detectedCountryConfig.currencyCode,
          detectedIp: locationData.detectedIp || '', // Store user IP address
          locationData: locationData, // Cache the entire response
        });

        // Determine selected currency with proper priority:
        // 1. URL parameter (highest priority - immediate override)
        // 2. Previously saved user selection (from session)
        // 3. Detected currency from location (default)

        const urlParams = new URLSearchParams(window.location.search);
        const urlCurrency = urlParams.get('currency');
        const savedCurrency = sessionStorage.getItem('next_selected_currency');
        const detectedCurrency =
          locationData.detectedCountryConfig.currencyCode;

        let selectedCurrency: string;

        if (urlCurrency) {
          // URL parameter has highest priority
          selectedCurrency = urlCurrency.toUpperCase();
          this.logger.info('Currency override from URL:', selectedCurrency);
          // Save to session for persistence
          sessionStorage.setItem('next_selected_currency', selectedCurrency);
        } else if (savedCurrency) {
          // Use previously saved selection
          selectedCurrency = savedCurrency;
          this.logger.info(
            'Using saved currency preference:',
            selectedCurrency
          );
        } else {
          // Use detected currency as default
          selectedCurrency = detectedCurrency;
          this.logger.info('Using detected currency:', selectedCurrency);
        }

        // Lock the currency in for the session so later page loads
        // (success page, upsells) cannot drift to a different currency if
        // geo-detection returns a different result or is skipped.
        if (selectedCurrency) {
          sessionStorage.setItem('next_selected_currency', selectedCurrency);
        }

        configStore.updateConfig({
          selectedCurrency,
        });

        this.logger.debug('Location and currency initialized:', {
          detectedCountry: configStore.detectedCountry,
          detectedCurrency: configStore.detectedCurrency,
          selectedCurrency: configStore.selectedCurrency,
        });
      }
    } catch (error) {
      this.logger.warn(
        'Failed to initialize location/currency, using defaults:',
        error
      );

      // Check for saved currency even in fallback case
      const savedCurrency = sessionStorage.getItem('next_selected_currency');
      const urlParams = new URLSearchParams(window.location.search);
      const urlCurrency = urlParams.get('currency');

      // Determine fallback currency with priority
      let fallbackCurrency = 'USD';
      if (urlCurrency) {
        fallbackCurrency = urlCurrency.toUpperCase();
        sessionStorage.setItem('next_selected_currency', fallbackCurrency);
      } else if (savedCurrency) {
        fallbackCurrency = savedCurrency;
      }

      const configStore = useConfigStore.getState();
      configStore.updateConfig({
        detectedCountry: 'US',
        detectedCurrency: 'USD',
        selectedCurrency: fallbackCurrency,
      });
    }
  }

  private static async loadConfiguration(): Promise<void> {
    const configStore = useConfigStore.getState();

    // Check for reset parameter first
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
      await storageResetMethods.clearAllStorage({ logger: this.logger });
      // Remove the reset parameter from URL to avoid infinite loop
      urlParams.delete('reset');
      const newUrl =
        window.location.pathname +
        (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }

    // NEW: Capture ALL URL parameters for session use
    await urlParamMethods.captureUrlParameters({ logger: this.logger }, urlParams);

    // Check URL parameters for debug mode, forcePackageId, forceShippingId, and forceBundleId
    const windowConfig = (window as any).nextConfig;
    const debugMode =
      urlParams.get('debugger') === 'true' || windowConfig?.debugger === true;
    const forcePackageId = urlParams.get('forcePackageId');
    const forceShippingId = urlParams.get('forceShippingId');
    const forceBundleId = urlParams.get('forceBundleId');

    // Load from window.nextConfig first (as defaults)
    configStore.loadFromWindow();

    // Load from meta tags second (will override window.nextConfig if metatags exist)
    configStore.loadFromMeta();

    // Override debug mode from URL if present
    if (debugMode) {
      configStore.updateConfig({ debug: true });
    }

    // Handle forcePackageId parameter
    if (forcePackageId) {
      this.logger.info('forcePackageId parameter detected:', forcePackageId);
      // Store for later processing after campaign data is loaded
      (window as any)._nextForcePackageId = forcePackageId;
    }

    // Handle forceShippingId parameter
    if (forceShippingId) {
      this.logger.info('forceShippingId parameter detected:', forceShippingId);
      // Store for later processing after campaign data is loaded
      (window as any)._nextForceShippingId = forceShippingId;
    }

    // Handle forceBundleId parameter
    // Format: "bundleId" or "selectorId:bundleId" or comma-separated for multi-selector pages
    // Consumed by BundleSelectorEnhancer when picking its default card (overrides data-next-selected).
    if (forceBundleId) {
      this.logger.info('forceBundleId parameter detected:', forceBundleId);
      (window as any)._nextForceBundleId = forceBundleId;
    }

    this.logger.debug(
      'Configuration loaded (metatags have priority):',
      configStore
    );
  }

  private static async loadCampaignData(): Promise<void> {
    const configStore = useConfigStore.getState();
    const campaignStore = useCampaignStore.getState();

    if (!configStore.apiKey) {
      throw new Error(
        'API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey'
      );
    }

    // Campaign ID is deprecated and not used by the API - only the API key is needed
    // No need to check or warn about it anymore

    this.campaignLoadStartTime = Date.now();
    await campaignStore.loadCampaign(configStore.apiKey);
    this.campaignLoadTime = Date.now() - this.campaignLoadStartTime;
    this.campaignFromCache = campaignStore.isFromCache || false;

    this.logger.debug('Campaign data loaded');

    // Set campaign shipping countries in CountryService for global use
    // This ensures country dropdowns only show countries the campaign ships to
    if (campaignStore.data?.available_shipping_countries) {
      const countryService = CountryService.getInstance();
      countryService.setCampaignShippingCountries(
        campaignStore.data.available_shipping_countries
      );
      this.logger.info(
        'Campaign shipping countries set globally:',
        campaignStore.data.available_shipping_countries.map((c: any) => c.code)
      );
    }

    // Process forcePackageId parameter after campaign data is available
    await urlParamMethods.processForcePackageId({ logger: this.logger });

    // Process forceShippingId parameter after campaign data is available
    await urlParamMethods.processForceShippingId({ logger: this.logger });

    // Emit event to notify enhancers that URL parameters have been processed
    // This allows enhancers to re-evaluate their conditions after profiles are applied
    const eventBus = EventBus.getInstance();
    eventBus.emit('sdk:url-parameters-processed', {});
    this.logger.debug('Emitted sdk:url-parameters-processed event');
  }

  /**
   * Captures where the visitor came from. Left whole for the same reason as
   * `initializeLocationAndCurrency` above: two of its `info`/`debug` lines
   * (`Initializing attribution...`, `Attribution initialized`) are in
   * `CORE_HEALTHY_BOOT`, and moving them to another file breaks
   * `coreLogs.test.ts`'s prefix-keyed healthy-boot check the same way.
   */
  private static async initializeAttribution(): Promise<void> {
    try {
      this.logger.info('Initializing attribution...');

      const attributionStore = useAttributionStore.getState();
      const configStore = useConfigStore.getState();

      // Initialize attribution data collection
      await attributionStore.initialize();

      // Add SDK version and user IP to metadata
      const sdkVersion =
        typeof window !== 'undefined' && window.__NEXT_SDK_VERSION__
          ? window.__NEXT_SDK_VERSION__
          : 'unknown';

      // Get user IP from config store (set during location detection)
      const userIp = configStore.detectedIp || '';

      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          sdk_version: sdkVersion,
          user_ip: userIp,
        },
      });

      this.logger.debug(
        `Added SDK version to attribution metadata: ${sdkVersion}`
      );
      if (userIp) {
        this.logger.debug(`Added user IP to attribution metadata: ${userIp}`);
      }

      // Set up event listeners for attribution updates
      this.setupAttributionListeners();

      // Initialize UTM transfer if enabled
      if (configStore.utmTransfer?.enabled) {
        const { UtmTransfer } = await import('@/core/attribution/utm-transfer');
        const utmTransfer = new UtmTransfer(configStore.utmTransfer);
        utmTransfer.init();
        this.logger.debug('UTM transfer initialized');
      }

      this.logger.debug('Attribution initialized');
    } catch (error) {
      this.logger.error('Attribution initialization failed:', error);
      // Continue with initialization - attribution failure shouldn't break SDK
    }
  }

  private static setupAttributionListeners(): void {
    // Idempotent: a boot retry or reinitialize() calls this again, and
    // without tearing down the previous registration first, every cart
    // update and popstate would re-run once per past call (finding #30).
    this.attributionListenersCleanup?.();

    const eventBus = EventBus.getInstance();
    const attributionStore = useAttributionStore.getState();

    // Update funnel when campaign loads
    const offCampaignLoaded = eventBus.on('campaign:loaded', campaign => {
      if (campaign?.name && !attributionStore.funnel) {
        attributionStore.setFunnelName(campaign.name);
        this.logger.debug('Set funnel name from campaign:', campaign.name);
      }
    });

    // Track conversion timestamp on cart creation
    const offCartUpdated = eventBus.on('cart:updated', () => {
      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          conversion_timestamp: Date.now(),
        },
      });
      this.logger.debug('Updated attribution with conversion timestamp');
    });

    // Listen for page changes to update landing page
    const onPopState = () => {
      attributionStore.updateAttribution({
        metadata: {
          ...attributionStore.metadata,
          landing_page: window.location.href,
        },
      });
    };
    window.addEventListener('popstate', onPopState);

    this.attributionListenersCleanup = () => {
      offCampaignLoaded();
      offCartUpdated();
      window.removeEventListener('popstate', onPopState);
    };
  }

  private static async initializeAnalytics(): Promise<void> {
    // Initialize analytics synchronously to ensure attribution data is ready
    // before dl_user_data event is fired
    try {
      this.logger.info('Initializing analytics v2...');

      // Dynamically import new analytics v2 to avoid loading it during initial bundle
      const { nextAnalytics } = await import('@/core/analytics/index');
      await nextAnalytics.initialize();

      this.logger.debug('Analytics v2 initialized successfully');
    } catch (error) {
      this.logger.warn(
        'Analytics v2 initialization failed (non-critical):',
        error
      );
      // Don't throw - analytics failure shouldn't break SDK initialization
    }
  }

  private static initializeErrorHandler(): void {
    try {
      // Import and initialize error handler
      import('@/core/monitoring/error-handler').then(({ errorHandler }) => {
        errorHandler.initialize();
        this.logger.debug('Error handler initialized');
      });
    } catch (error) {
      this.logger.warn('Error handler initialization failed:', error);
    }
  }

  private static async checkAndLoadOrder(): Promise<void> {
    // Check if there's a ref_id or order_ref_id parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref_id') || urlParams.get('order_ref_id');

    if (refId) {
      const paramName = urlParams.get('ref_id') ? 'ref_id' : 'order_ref_id';
      this.logger.info(
        `Page loaded with ${paramName} parameter, auto-loading order:`,
        refId
      );

      try {
        const configStore = useConfigStore.getState();
        const orderStore = useOrderStore.getState();
        const apiClient = getApiClient(configStore.apiKey);

        await orderStore.loadOrder(refId, apiClient);
        this.logger.info('Order loaded successfully:', orderStore.order);

        // Log whether the order supports upsells
        if (orderStore.order) {
          this.logger.info(
            'Order supports upsells:',
            orderStore.order.supports_post_purchase_upsells
          );
        }
      } catch (error) {
        this.logger.error('Failed to auto-load order:', error);
        // Don't throw - this shouldn't break SDK initialization
      }
    }
  }

  private static async scanAndEnhanceDOM(): Promise<void> {
    if (this.attributeScanner) {
      this.attributeScanner.destroy();
    }

    this.attributeScanner = new AttributeScanner();
    await this.attributeScanner.scanAndEnhance(document.body);

    const stats = this.attributeScanner.getStats();
    this.logger.info('DOM scanning and enhancement complete', stats);
  }

  private static setupReadyCallbacks(): void {
    const sdk = NextCommerce.getInstance();

    if (typeof window !== 'undefined') {
      // Execute any queued ready callbacks if they exist
      if (Array.isArray((window as any).nextReady)) {
        const readyQueue = (window as any).nextReady;
        readyQueue.forEach((callback: (sdk: NextCommerce) => void) => {
          try {
            callback(sdk);
          } catch (error) {
            this.logger.error('Ready callback error:', error);
          }
        });
      }

      // Set up public API as window.next
      (window as any).next = sdk;

      // Always set up nextReady for future callbacks (whether it existed before or not)
      (window as any).nextReady = {
        push: (callback: (sdk: NextCommerce) => void) => {
          try {
            callback(sdk);
          } catch (error) {
            this.logger.error('Ready callback error:', error);
          }
        },
      };

      this.logger.debug(
        'nextReady callback system and window.next API initialized'
      );
    }
  }

  private static async initializeDebugMode(): Promise<void> {
    const configStore = useConfigStore.getState();

    if (configStore.debug) {
      this.logger.info('Debug mode enabled - initializing debug utilities');

      // Set logger to DEBUG level when debug mode is enabled
      Logger.setLogLevel(LogLevel.DEBUG);
      this.logger.info('Logger level set to DEBUG');

      // Initialize debug overlay only in debug mode
      const { debugOverlay } = await import('@/core/debug/debug-overlay');
      debugOverlay.initialize();

      // Initialize test mode manager
      // Removed test mode indicator - using debug overlay instead
      // testModeManager.addTestModeIndicator();

      // Set up global debug utilities
      debugUtilsMethods.setupGlobalDebugUtils({
        logger: this.logger,
        reinitialize: () => this.reinitialize(),
        getInitializationStats: () => this.getInitializationStats(),
      });

      // Log debug info
      this.logger.info('Debug utilities initialized ✅');
    }
  }

  public static isInitialized(): boolean {
    return this.initialized;
  }

  public static async reinitialize(): Promise<void> {
    this.logger.info('Reinitializing SDK...');

    // Cleanup existing resources
    if (this.attributeScanner) {
      this.attributeScanner.destroy();
      this.attributeScanner = null;
    }

    this.initialized = false;
    this.retryAttempts = 0;

    await this.initialize();
  }

  private static async waitForDOM(): Promise<void> {
    if (document.readyState === 'loading') {
      return new Promise(resolve => {
        const onReady = () => {
          document.removeEventListener('DOMContentLoaded', onReady);
          document.removeEventListener('readystatechange', onReady);
          resolve();
        };

        document.addEventListener('DOMContentLoaded', onReady);
        document.addEventListener('readystatechange', onReady);
      });
    }
  }

  private static async waitForStoreRehydration(): Promise<void> {
    // Wait for cart store to rehydrate from session storage
    // This is crucial to prevent display enhancers from initializing with empty state
    const cartStore = useCartStore.getState();

    // Check if there's data in sessionStorage that needs to be rehydrated
    // Using the shared constant from storage.ts ensures consistency
    const storedData = sessionStorage.getItem(CART_STORAGE_KEY);

    if (storedData) {
      this.logger.debug('Waiting for cart store rehydration...');
      const rehydrationStartTime = Date.now();

      // Give the store time to rehydrate and recalculate totals
      // The store's onRehydrateStorage callback calls calculateTotals()
      // We need to wait for that to complete
      await new Promise(resolve => {
        // Use a small timeout to ensure the rehydration process completes
        // This includes the async calculateTotals() call in the store
        setTimeout(resolve, 50);
      });

      // Force a recalculation to ensure everything is up to date
      cartOperations.calculateTotals();

      const rehydrationTime = Date.now() - rehydrationStartTime;

      this.logger.debug('Cart store rehydration complete', {
        itemCount: cartStore.items.length,
        total: cartStore.total,
        isEmpty: cartStore.isEmpty,
      });
    } else {
      this.logger.debug('No cart data to rehydrate');
    }
  }

  private static emitInitializedEvent(): void {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('next:initialized', {
        detail: {
          version: '0.2.0',
          timestamp: Date.now(),
          stats: this.attributeScanner?.getStats(),
        },
      });

      window.dispatchEvent(event);
    }
  }

  public static getAttributeScanner(): AttributeScanner | null {
    return this.attributeScanner;
  }

  public static getInitializationStats(): {
    initialized: boolean;
    retryAttempts: number;
    scannerStats?: ReturnType<AttributeScanner['getStats']>;
  } {
    return {
      initialized: this.initialized,
      retryAttempts: this.retryAttempts,
      ...(this.attributeScanner && {
        scannerStats: this.attributeScanner.getStats(),
      }),
    };
  }
}
