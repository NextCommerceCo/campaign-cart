/**
 * SDK Initializer
 * Handles auto-initialization, configuration loading, and setup
 */

import { createLogger, Logger, LogLevel } from '@/core/logger';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore, cartOperations } from '@/state/cart';
import { useOrderStore } from '@/state/order';
import { AttributeScanner } from '../attribute-scanner';
import { NextCommerce } from '@/core/next-commerce';
// Debug overlay imported dynamically when needed
import { EventBus } from '@/core/events';
import { getApiClient } from '@/client';
import { CART_STORAGE_KEY } from '@/core/storage';
import { CountryService } from '@/core/country-service';
import * as urlParamMethods from '@/core/sdk-initializer/sdk-initializer.url-params';
import * as storageResetMethods from '@/core/sdk-initializer/sdk-initializer.storage-reset';
import * as debugUtilsMethods from '@/core/sdk-initializer/sdk-initializer.debug-utils';
import * as locationCurrencyMethods from '@/core/sdk-initializer/sdk-initializer.location-currency';
import * as attributionMethods from '@/core/sdk-initializer/sdk-initializer.attribution';
import type { AttributionCtx } from '@/core/sdk-initializer/sdk-initializer.attribution';

export class SDKInitializer {
  private static logger = createLogger('SDKInitializer');
  private static initialized = false;
  private static attributeScanner: AttributeScanner | null = null;
  private static retryAttempts = 0;
  private static maxRetries = 3;
  // Shared with `sdk-initializer.attribution.ts` — `attributionListenersCleanup`
  // must persist across calls so `setupAttributionListeners` stays idempotent
  // through a boot retry or `reinitialize()` (finding #30).
  private static attributionCtx: AttributionCtx = {
    logger: this.logger,
    attributionListenersCleanup: null,
  };

  public static async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('SDK already initialized');
      return;
    }

    try {
      this.logger.info('Initializing NextCommerce Campaign Cart SDK v2...');

      // Wait for DOM to be ready
      await this.waitForDOM();

      // Signal loading state to the page so developers can show skeleton UIs
      document.body.setAttribute('data-next-sdk-loading', 'true');

      // Load configuration
      await this.loadConfiguration();

      // NEW: Initialize location and currency detection EARLY (before campaign data)
      await locationCurrencyMethods.initializeLocationAndCurrency({
        logger: this.logger,
      });

      // Initialize attribution store
      await attributionMethods.initializeAttribution(this.attributionCtx);

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

    await campaignStore.loadCampaign(configStore.apiKey);

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
