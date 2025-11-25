/**
 * MetaTagController - Controls analytics events via HTML meta tags
 *
 * Provides declarative control over analytics events through meta tags,
 * allowing content creators to configure analytics without JavaScript.
 *
 * Supported meta tags:
 * - next-analytics-disable: Block events globally (all providers)
 * - next-analytics-enable-only: Whitelist mode - only fire these events
 * - next-analytics-view-item: Fire dl_view_item for a package (replaces auto-detection)
 * - next-analytics-view-item-list: Fire dl_view_item_list for packages (replaces auto-detection)
 * - next-analytics-list-id: Set page-level list ID for all events
 * - next-analytics-list-name: Set page-level list name for all events
 * - next-analytics-scroll-tracking: Track scroll depth at specified thresholds
 */

import { createLogger } from '@/utils/logger';
import { useCampaignStore } from '@/stores/campaignStore';
import { dataLayer } from '../DataLayerManager';
import { EcommerceEvents } from '../events/EcommerceEvents';
import { EventBuilder } from '../events/EventBuilder';
import { ListAttributionTracker } from './ListAttributionTracker';

const logger = createLogger('MetaTagController');

interface ViewItemConfig {
  packageId: string;
  trigger?: string;
  fromUrl?: boolean;
}

interface MetaTagConfig {
  disabledEvents: string[];
  enabledOnlyEvents: string[];
  listContext: { id?: string; name?: string };
  viewItem?: ViewItemConfig;
  viewItemListPackageIds: string[];
  scrollThresholds: number[];
}

export class MetaTagController {
  private static instance: MetaTagController;
  private config: MetaTagConfig = {
    disabledEvents: [],
    enabledOnlyEvents: [],
    listContext: {},
    viewItemListPackageIds: [],
    scrollThresholds: []
  };
  private initialized = false;
  private viewItemFired = false;
  private viewItemListFired = false;
  private reachedScrollThresholds = new Set<number>();

  private constructor() {}

  public static getInstance(): MetaTagController {
    if (!MetaTagController.instance) {
      MetaTagController.instance = new MetaTagController();
    }
    return MetaTagController.instance;
  }

  /**
   * Initialize the meta tag controller
   * Parses all analytics meta tags and sets up tracking
   */
  public initialize(): void {
    if (this.initialized) {
      logger.debug('MetaTagController already initialized');
      return;
    }

    logger.info('Initializing MetaTagController...');

    // Parse all meta tag configurations
    this.config = {
      disabledEvents: this.parseArray('next-analytics-disable'),
      enabledOnlyEvents: this.parseArray('next-analytics-enable-only'),
      listContext: this.parseListContext(),
      viewItem: this.parseViewItemConfig(),
      viewItemListPackageIds: this.parseViewItemListConfig(),
      scrollThresholds: this.parseScrollThresholds()
    };

    logger.debug('Parsed meta tag config:', this.config);

    // Update list attribution if specified
    if (this.config.listContext.id || this.config.listContext.name) {
      const listTracker = ListAttributionTracker.getInstance();
      listTracker.setListContext(
        this.config.listContext.id,
        this.config.listContext.name
      );
      logger.info('Set list context from meta tags:', this.config.listContext);
    }

    // Auto-fire view_item if specified (REPLACES auto-detection)
    if (this.config.viewItem) {
      this.fireViewItemEvent(this.config.viewItem);
    }

    // Auto-fire view_item_list if specified (REPLACES auto-detection)
    if (this.config.viewItemListPackageIds.length > 0) {
      this.fireViewItemListEvent(this.config.viewItemListPackageIds);
    }

    // Setup scroll tracking if specified
    if (this.config.scrollThresholds.length > 0) {
      this.setupScrollTracking();
    }

    this.initialized = true;
    logger.info('MetaTagController initialized', {
      hasViewItem: !!this.config.viewItem,
      viewItemListCount: this.config.viewItemListPackageIds.length,
      disabledEvents: this.config.disabledEvents,
      enabledOnlyEvents: this.config.enabledOnlyEvents
    });
  }

  /**
   * Check if event should be blocked globally (all providers)
   */
  public shouldBlockEvent(eventName: string): boolean {
    // Whitelist mode - only allow specified events
    if (this.config.enabledOnlyEvents.length > 0) {
      const blocked = !this.config.enabledOnlyEvents.includes(eventName);
      if (blocked) {
        logger.debug(`Event ${eventName} blocked by enable-only whitelist`);
      }
      return blocked;
    }

    // Blacklist mode - block specified events
    const blocked = this.config.disabledEvents.includes(eventName);
    if (blocked) {
      logger.debug(`Event ${eventName} blocked by disable list`);
    }
    return blocked;
  }

  /**
   * Check if meta tag should override auto-detection for this event
   * When true, ViewItemListTracker should skip auto-detection
   */
  public hasMetaTagOverride(eventName: string): boolean {
    if (eventName === 'dl_view_item' && this.config.viewItem) {
      return true;
    }
    if (eventName === 'dl_view_item_list' && this.config.viewItemListPackageIds.length > 0) {
      return true;
    }
    return false;
  }

  /**
   * Check if view_item event was fired from meta tag
   */
  public wasViewItemFired(): boolean {
    return this.viewItemFired;
  }

  /**
   * Check if view_item_list event was fired from meta tag
   */
  public wasViewItemListFired(): boolean {
    return this.viewItemListFired;
  }

  /**
   * Get the list context from meta tags
   */
  public getListContext(): { id?: string; name?: string } {
    return this.config.listContext;
  }

  /**
   * Parse view_item meta tag configuration
   * Supports: content="123" or content="url:param_name" with optional trigger attribute
   */
  private parseViewItemConfig(): ViewItemConfig | undefined {
    const meta = document.querySelector('meta[name="next-analytics-view-item"]') as HTMLMetaElement;
    if (!meta || !meta.content) return undefined;

    const content = meta.content.trim();
    const trigger = meta.getAttribute('trigger') || undefined;

    // Check if reading from URL param
    if (content.startsWith('url:')) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const packageId = urlParams.get(paramName);

      if (!packageId) {
        logger.warn(`URL param "${paramName}" not found for view_item event`);
        return undefined;
      }

      logger.info(`Parsed view_item from URL param: ${paramName}=${packageId}`);
      return { packageId, trigger, fromUrl: true };
    }

    logger.info(`Parsed view_item from meta tag: packageId=${content}, trigger=${trigger || 'immediate'}`);
    return { packageId: content, trigger };
  }

  /**
   * Parse view_item_list meta tag configuration
   * Supports: content="123,456,789" or content="url:param_name"
   */
  private parseViewItemListConfig(): string[] {
    const meta = document.querySelector('meta[name="next-analytics-view-item-list"]') as HTMLMetaElement;
    if (!meta || !meta.content) return [];

    const content = meta.content.trim();

    // Check if reading from URL param
    if (content.startsWith('url:')) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const paramValue = urlParams.get(paramName);

      if (!paramValue) {
        logger.warn(`URL param "${paramName}" not found for view_item_list event`);
        return [];
      }

      const ids = paramValue.split(',').map(s => s.trim()).filter(s => s);
      logger.info(`Parsed view_item_list from URL param: ${paramName}=${ids.join(',')}`);
      return ids;
    }

    const ids = content.split(',').map(s => s.trim()).filter(s => s);
    logger.info(`Parsed view_item_list from meta tag: ${ids.join(',')}`);
    return ids;
  }

  /**
   * Fire view_item event based on meta tag configuration
   */
  private fireViewItemEvent(config: ViewItemConfig): void {
    const campaignStore = useCampaignStore.getState();

    // Check if campaign data is loaded
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger.debug('Campaign data not yet loaded, deferring view_item event');
      // Retry after campaign data loads
      setTimeout(() => {
        if (!this.viewItemFired) {
          this.fireViewItemEvent(config);
        }
      }, 1000);
      return;
    }

    // Find package by ref_id or external_id
    const packageIdNum = parseInt(config.packageId, 10);
    const packageData = campaignStore.packages.find((p: any) =>
      p.ref_id === packageIdNum ||
      String(p.ref_id) === config.packageId ||
      String(p.external_id) === config.packageId
    );

    if (!packageData) {
      logger.warn(`Package ${config.packageId} not found for view_item event`);
      return;
    }

    const fireEvent = () => {
      if (this.viewItemFired) {
        logger.debug('view_item already fired from meta tag, skipping');
        return;
      }

      // Create item object for EcommerceEvents
      const item = {
        packageId: packageData.ref_id,
        package_id: packageData.ref_id,
        id: packageData.ref_id
      };

      const event = EcommerceEvents.createViewItemEvent(item);
      dataLayer.push(event);
      this.viewItemFired = true;

      logger.info('Fired dl_view_item from meta tag:', {
        packageId: config.packageId,
        productName: packageData.product_name || packageData.name,
        trigger: config.trigger || 'immediate'
      });
    };

    // Handle different trigger types
    if (!config.trigger) {
      // Fire immediately
      fireEvent();
      return;
    }

    const [triggerType, triggerValue] = config.trigger.split(':');

    if (triggerType === 'time') {
      // Fire after specified time delay
      const duration = parseInt(triggerValue, 10);
      if (!isNaN(duration) && duration > 0) {
        logger.debug(`Scheduling view_item to fire after ${duration}ms`);
        setTimeout(fireEvent, duration);
      } else {
        logger.warn(`Invalid time trigger value: ${triggerValue}, firing immediately`);
        fireEvent();
      }
    } else if (triggerType === 'view') {
      // Fire when element scrolls into view
      const selector = triggerValue;
      const element = document.querySelector(selector);

      if (element) {
        logger.debug(`Setting up IntersectionObserver for view_item trigger: ${selector}`);
        const observer = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) {
            fireEvent();
            observer.disconnect();
          }
        }, { threshold: 0.5 });
        observer.observe(element);
      } else {
        logger.warn(`Element ${selector} not found for view_item trigger, firing immediately`);
        fireEvent();
      }
    } else {
      logger.warn(`Unknown trigger type: ${triggerType}, firing immediately`);
      fireEvent();
    }
  }

  /**
   * Fire view_item_list event for multiple packages
   */
  private fireViewItemListEvent(packageIds: string[]): void {
    const campaignStore = useCampaignStore.getState();

    // Check if campaign data is loaded
    if (!campaignStore.data || !campaignStore.packages || campaignStore.packages.length === 0) {
      logger.debug('Campaign data not yet loaded, deferring view_item_list event');
      // Retry after campaign data loads
      setTimeout(() => {
        if (!this.viewItemListFired) {
          this.fireViewItemListEvent(packageIds);
        }
      }, 1000);
      return;
    }

    if (this.viewItemListFired) {
      logger.debug('view_item_list already fired from meta tag, skipping');
      return;
    }

    const items: any[] = [];

    packageIds.forEach(packageId => {
      const packageIdNum = parseInt(packageId, 10);
      const packageData = campaignStore.packages.find((p: any) =>
        p.ref_id === packageIdNum ||
        String(p.ref_id) === packageId ||
        String(p.external_id) === packageId
      );

      if (packageData) {
        items.push({
          packageId: packageData.ref_id,
          package_id: packageData.ref_id,
          id: packageData.ref_id
        });
      } else {
        logger.warn(`Package ${packageId} not found for view_item_list event`);
      }
    });

    if (items.length === 0) {
      logger.warn('No valid packages found for view_item_list event');
      return;
    }

    const event = EcommerceEvents.createViewItemListEvent(
      items,
      this.config.listContext.id,
      this.config.listContext.name
    );

    dataLayer.push(event);
    this.viewItemListFired = true;

    logger.info('Fired dl_view_item_list from meta tag:', {
      packageCount: items.length,
      packageIds: items.map(i => i.packageId),
      listId: this.config.listContext.id,
      listName: this.config.listContext.name
    });
  }

  /**
   * Parse list context meta tags
   */
  private parseListContext(): { id?: string; name?: string } {
    const id = this.getMeta('next-analytics-list-id');
    const name = this.getMeta('next-analytics-list-name');
    return {
      id: id || undefined,
      name: name || undefined
    };
  }

  /**
   * Parse comma-separated array from meta tag
   */
  private parseArray(metaName: string): string[] {
    const content = this.getMeta(metaName);
    if (!content) return [];
    return content.split(',').map(s => s.trim()).filter(s => s);
  }

  /**
   * Parse scroll tracking thresholds
   */
  private parseScrollThresholds(): number[] {
    const content = this.getMeta('next-analytics-scroll-tracking');
    if (!content) return [];

    return content
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= 100)
      .sort((a, b) => a - b);
  }

  /**
   * Set up scroll depth tracking
   */
  private setupScrollTracking(): void {
    const thresholds = this.config.scrollThresholds;
    if (thresholds.length === 0) return;

    logger.info('Setting up scroll tracking for thresholds:', thresholds);

    const scrollHandler = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const scrollPercent = (window.scrollY / scrollHeight) * 100;

      thresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !this.reachedScrollThresholds.has(threshold)) {
          this.reachedScrollThresholds.add(threshold);

          const event = EventBuilder.createEvent('dl_scroll_depth', {
            user_properties: EventBuilder.getUserProperties(),
            scroll_depth: Math.round(scrollPercent),
            scroll_threshold: threshold,
            page_height: document.documentElement.scrollHeight,
            viewport_height: window.innerHeight
          });

          dataLayer.push(event);
          logger.debug(`Fired dl_scroll_depth at ${threshold}%`);
        }
      });

      // Remove listener if all thresholds reached
      if (this.reachedScrollThresholds.size === thresholds.length) {
        window.removeEventListener('scroll', scrollHandler);
        logger.debug('All scroll thresholds reached, removing listener');
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    // Check initial scroll position
    scrollHandler();
  }

  /**
   * Get meta tag content by name
   */
  private getMeta(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    return meta?.content?.trim() || null;
  }

  /**
   * Reset the controller (for testing or route changes)
   */
  public reset(): void {
    this.viewItemFired = false;
    this.viewItemListFired = false;
    this.reachedScrollThresholds.clear();
    logger.debug('MetaTagController reset');
  }

  /**
   * Get current status for debugging
   */
  public getStatus(): {
    initialized: boolean;
    config: MetaTagConfig;
    viewItemFired: boolean;
    viewItemListFired: boolean;
    scrollThresholdsReached: number[];
  } {
    return {
      initialized: this.initialized,
      config: { ...this.config },
      viewItemFired: this.viewItemFired,
      viewItemListFired: this.viewItemListFired,
      scrollThresholdsReached: Array.from(this.reachedScrollThresholds)
    };
  }
}

// Export singleton instance
export const metaTagController = MetaTagController.getInstance();
