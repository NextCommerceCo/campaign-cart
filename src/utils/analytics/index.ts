/**
 * Next Analytics v2 - Clean, Elevar-inspired analytics system
 * 
 * This is the main entry point for the analytics system.
 * It provides a simple API for tracking events following industry best practices.
 */

import { dataLayer } from './DataLayerManager';
import { GTMAdapter } from './providers/GTMAdapter';
import { FacebookAdapter } from './providers/FacebookAdapter';
import { RudderStackAdapter } from './providers/RudderStackAdapter';
import { NextCampaignAdapter } from './providers/NextCampaignAdapter';
import { CustomAdapter } from './providers/CustomAdapter';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import { ListAttributionTracker } from './tracking/ListAttributionTracker';
import { ViewItemListTracker } from './tracking/ViewItemListTracker';
import { UserDataTracker } from './tracking/UserDataTracker';
import { AutoEventListener } from './tracking/AutoEventListener';
import { PendingEventsHandler } from './tracking/PendingEventsHandler';
import { MetaTagController } from './tracking/MetaTagController';
import { EventValidator } from './validation/EventValidator';
import { EcommerceEvents } from './events/EcommerceEvents';
import { UserEvents } from './events/UserEvents';
import { createLogger } from '@/utils/logger';
import { useConfigStore } from '@/stores/configStore';
import type { DataLayerEvent } from './types';
import type { CartItem, EnrichedCartLine } from '@/types/global';

const logger = createLogger('NextAnalytics');

/** Per-initialization context passed to provider factories. */
interface ProviderContext {
  storeName?: string;
}

/**
 * Builds a provider adapter from its config, or returns `null` when the
 * provider is enabled but its preconditions (e.g. a pixel id) are not met.
 */
type ProviderFactory = (
  config: any,
  ctx: ProviderContext
) => ProviderAdapter | null;

/**
 * Registry of supported analytics providers. To add a provider, add one entry
 * here and create its adapter — `NextAnalytics` itself needs no changes.
 */
const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  nextCampaign: () => new NextCampaignAdapter(),
  gtm: config => new GTMAdapter(config),
  facebook: (config, ctx) =>
    config.settings?.pixelId
      ? new FacebookAdapter({ ...config, storeName: ctx.storeName })
      : null,
  rudderstack: () => new RudderStackAdapter(),
  custom: config =>
    config.settings?.endpoint ? new CustomAdapter(config.settings) : null,
};

export class NextAnalytics {
  private static instance: NextAnalytics;
  private initialized = false;
  private providers: Map<string, ProviderAdapter> = new Map();
  private validator = new EventValidator();
  private metaTagController = MetaTagController.getInstance();
  private listTracker = ListAttributionTracker.getInstance();
  private viewTracker = ViewItemListTracker.getInstance();
  private userTracker = UserDataTracker.getInstance();
  private autoListener = AutoEventListener.getInstance();

  private constructor() {
    // Set up global transform function support
    if (typeof window !== 'undefined') {
      (window as any).NextDataLayerTransformFn = null;
      // Check and set ignore flag on initialization
      this.checkAndSetIgnoreFlag();
    }
  }

  public static getInstance(): NextAnalytics {
    if (!NextAnalytics.instance) {
      NextAnalytics.instance = new NextAnalytics();
    }
    return NextAnalytics.instance;
  }

  /**
   * Check URL for ignore parameter and set session storage flag
   */
  private checkAndSetIgnoreFlag(): void {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const ignoreParam = urlParams.get('ignore');
      
      if (ignoreParam === 'true') {
        // Set session storage flag
        sessionStorage.setItem('analytics_ignore', 'true');
        logger.info('Analytics ignore flag set from URL parameter');
      }
    } catch (error) {
      logger.error('Error checking ignore parameter:', error);
    }
  }

  /**
   * Check if analytics should be ignored
   */
  private shouldIgnoreAnalytics(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      // Check session storage first
      const sessionIgnore = sessionStorage.getItem('analytics_ignore');
      if (sessionIgnore === 'true') {
        return true;
      }

      // Also check current URL in case it was just set
      const urlParams = new URLSearchParams(window.location.search);
      const ignoreParam = urlParams.get('ignore');
      return ignoreParam === 'true';
    } catch (error) {
      logger.error('Error checking ignore status:', error);
      return false;
    }
  }

  /**
   * Check if analytics is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the analytics system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Analytics already initialized');
      return;
    }

    // Check for ignore parameter in URL or session storage
    if (this.shouldIgnoreAnalytics()) {
      logger.info('Analytics ignored due to ignore parameter');
      return;
    }

    try {
      const config = useConfigStore.getState();
      
      // Check if analytics is enabled
      if (!config.analytics?.enabled) {
        logger.info('Analytics disabled in configuration');
        return;
      }

      // Initialize data layer
      dataLayer.initialize();

      // Set debug mode from config
      if (config.analytics.debug) {
        dataLayer.setDebugMode(true);
      }

      // Initialize providers based on configuration FIRST
      await this.initializeProviders(config.analytics, config.storeName);

      // Initialize MetaTagController ALWAYS (works in both auto and manual modes)
      // This allows declarative control via meta tags regardless of mode
      this.metaTagController.initialize();

      // CRITICAL: Fire dl_user_data FIRST, before any other tracking
      // This must happen before any other events
      if (config.analytics.mode === 'auto') {
        // Initialize UserDataTracker first and wait for it to fire
        this.userTracker.initialize();

        // Wait a moment to ensure dl_user_data is processed
        await new Promise(resolve => setTimeout(resolve, 100));

        // Now initialize other trackers (they may fire view/list events)
        // ViewItemListTracker will check metaTagController for overrides
        this.listTracker.initialize();
        this.viewTracker.initialize();
        this.autoListener.initialize();

        logger.info('Auto-tracking initialized (user data fired first, meta tags processed)');
      } else {
        logger.info('Manual mode - meta tags processed, auto-tracking disabled');
      }

      // Process any pending events from previous page AFTER everything is initialized
      // Adding delay to ensure all initial events are processed first
      setTimeout(() => {
        PendingEventsHandler.getInstance().processPendingEvents();
      }, 200);

      this.initialized = true;
      logger.info('NextAnalytics initialized successfully', {
        providers: Array.from(this.providers.keys()),
        mode: config.analytics.mode
      });
    } catch (error) {
      logger.error('Failed to initialize analytics:', error);
      throw error;
    }
  }

  /**
   * Initialize analytics providers from configuration.
   *
   * Iterates the {@link PROVIDER_FACTORIES} registry, instantiating every
   * enabled provider whose preconditions are met and wiring it into the data
   * layer. Each adapter's {@link ProviderAdapter.initialize} hook is awaited so
   * script-loading providers (e.g. NextCampaign) are ready before events flow.
   */
  private async initializeProviders(config: any, storeName?: string): Promise<void> {
    const providerConfigs = config.providers ?? {};
    const ctx: ProviderContext = { storeName };

    for (const [key, factory] of Object.entries(PROVIDER_FACTORIES)) {
      const providerConfig = providerConfigs[key];
      if (!providerConfig?.enabled) continue;

      const adapter = factory(providerConfig, ctx);
      if (!adapter) {
        logger.warn(
          `Provider "${key}" is enabled but its preconditions are not met; skipping`
        );
        continue;
      }

      await adapter.initialize(providerConfig.settings);
      this.providers.set(key, adapter);
      dataLayer.addProvider(adapter);
      logger.info(`${key} adapter initialized`, {
        blockedEvents: providerConfig.blockedEvents ?? []
      });
    }
  }

  /**
   * Track an event
   */
  public track(event: DataLayerEvent): void {
    // Skip tracking if analytics should be ignored
    if (this.shouldIgnoreAnalytics()) {
      logger.debug('Event tracking skipped due to ignore flag:', event.event);
      return;
    }

    if (!this.initialized) {
      logger.warn('Analytics not initialized, queuing event:', event.event);
      // Events will be queued in DataLayerManager
    }

    // Validate event if in debug mode
    if (dataLayer.isDebugMode()) {
      const validation = this.validator.validateEvent(event);
      if (!validation.valid) {
        logger.error('Event validation failed:', validation.errors);
        if (validation.warnings.length > 0) {
          logger.warn('Event validation warnings:', validation.warnings);
        }
      }
    }

    // Push to data layer
    dataLayer.push(event);
  }

  /**
   * Enable/disable debug mode
   */
  public setDebugMode(enabled: boolean): void {
    dataLayer.setDebugMode(enabled);
    logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set transform function for events
   */
  public setTransformFunction(fn: (event: DataLayerEvent) => DataLayerEvent | null): void {
    dataLayer.setTransformFunction(fn);
  }

  /**
   * Handle route changes (for SPAs)
   */
  public invalidateContext(): void {
    dataLayer.invalidateContext();

    // Call Elevar's invalidate context if available
    if (typeof window !== 'undefined' && window.ElevarInvalidateContext) {
      window.ElevarInvalidateContext();
      logger.debug('Called ElevarInvalidateContext');
    }

    // Reset trackers
    this.metaTagController.reset();
    this.viewTracker.reset();
    // Track new user data
    this.track(UserEvents.createUserDataEvent('dl_user_data'));
  }

  /**
   * Get analytics status
   */
  public getStatus(): any {
    return {
      initialized: this.initialized,
      debugMode: dataLayer.isDebugMode(),
      providers: Array.from(this.providers.keys()),
      eventsTracked: dataLayer.getEventCount(),
      ignored: this.shouldIgnoreAnalytics()
    };
  }

  /**
   * Clear the analytics ignore flag from session storage
   */
  public clearIgnoreFlag(): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('analytics_ignore');
        logger.info('Analytics ignore flag cleared');
      } catch (error) {
        logger.error('Error clearing ignore flag:', error);
      }
    }
  }

  /**
   * Convenience methods for common events
   */
  public trackViewItemList(items: (CartItem | EnrichedCartLine | any)[], listId?: string, listName?: string): void {
    this.track(EcommerceEvents.createViewItemListEvent(items, listId, listName));
  }

  public trackViewItem(item: CartItem | EnrichedCartLine | any): void {
    this.track(EcommerceEvents.createViewItemEvent(item));
  }

  public trackAddToCart(item: CartItem | EnrichedCartLine | any, listId?: string, listName?: string): void {
    this.track(EcommerceEvents.createAddToCartEvent(item, listId, listName));
  }

  public trackBeginCheckout(): void {
    this.track(EcommerceEvents.createBeginCheckoutEvent());
  }

  public trackPurchase(orderData: any): void {
    this.track(EcommerceEvents.createPurchaseEvent(orderData));
  }

  public trackSignUp(email?: string): void {
    const userData = email ? { customer_email: email } : undefined;
    this.track(UserEvents.createSignUpEvent('email', userData));
  }

  public trackLogin(email?: string): void {
    const userData = email ? { customer_email: email } : undefined;
    this.track(UserEvents.createLoginEvent('email', userData));
  }
}

// Export singleton instance
export const nextAnalytics = NextAnalytics.getInstance();

// Export types and utilities
export * from './types';
export { EventValidator } from './validation/EventValidator';
export { EcommerceEvents } from './events/EcommerceEvents';
export { UserEvents } from './events/UserEvents';
export { dataLayer } from './DataLayerManager';
export { MetaTagController, metaTagController } from './tracking/MetaTagController';

// Set up global access for debugging
if (typeof window !== 'undefined') {
  (window as any).NextAnalytics = nextAnalytics;
  (window as any).NextDataLayerManager = dataLayer;
  (window as any).NextMetaTagController = MetaTagController.getInstance();

  // Set up route change handling
  (window as any).NextInvalidateContext = () => {
    nextAnalytics.invalidateContext();
  };

  // Set up ignore flag management
  (window as any).NextAnalyticsClearIgnore = () => {
    nextAnalytics.clearIgnoreFlag();
  };
}