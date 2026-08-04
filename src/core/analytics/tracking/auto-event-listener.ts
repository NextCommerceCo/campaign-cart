/**
 * AutoEventListener - Listens to EventBus and maps internal events to data layer events
 * Handles cart events, upsell events, and other SDK events
 *
 * Split by layer: this file is the orchestrator (singleton lifecycle, the
 * debounce gate, and the cart-calculation wait); the domain handlers live in
 * sibling `auto-event-*-handlers.ts` files, one per event domain (cart,
 * upsell, checkout, page, exit-intent), each taking this instance as a
 * context object — see `./auto-event-listener.types`.
 */

import { createLogger } from '@/core/logger';
import { EventBus } from '@/core/events';
import { dataLayer } from '../data-layer-manager';
import type {
  AutoEventListenerContext,
  EventDebounceConfig,
} from './auto-event-listener.types';
import { setupCartEventListeners } from './auto-event-cart-handlers';
import { setupUpsellEventListeners } from './auto-event-upsell-handlers';
import { setupCheckoutEventListeners } from './auto-event-checkout-handlers';
import { setupPageEventListeners } from './auto-event-page-handlers';
import { setupExitIntentEventListeners } from './auto-event-exit-intent-handlers';

const logger = createLogger('AutoEventListener');

export class AutoEventListener implements AutoEventListenerContext {
  private static instance: AutoEventListener;
  eventBus = EventBus.getInstance();
  private isInitialized = false;
  eventHandlers: Map<string, Function> = new Map();
  private lastEventTimes: Map<string, number> = new Map();

  // Debounce configuration for different events
  private debounceConfig: EventDebounceConfig = {
    'cart:item-added': 1000,
    'cart:item-removed': 500,
    'cart:quantity-changed': 500,
    'cart:updated': 1000,
    'cart:package-swapped': 100, // Low debounce since it's already atomic
  };

  private constructor() {}

  public static getInstance(): AutoEventListener {
    if (!AutoEventListener.instance) {
      AutoEventListener.instance = new AutoEventListener();
    }
    return AutoEventListener.instance;
  }

  /**
   * Initialize the auto event listener
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    dataLayer.initialize();

    // Set up event listeners
    setupCartEventListeners(this);
    setupUpsellEventListeners(this);
    setupCheckoutEventListeners(this);
    setupPageEventListeners(this);
    setupExitIntentEventListeners(this);

    logger.info('AutoEventListener initialized');
  }

  /**
   * Check if event should be processed based on debounce
   */
  shouldProcessEvent(eventName: string): boolean {
    const now = Date.now();
    const lastTime = this.lastEventTimes.get(eventName) || 0;
    const debounceTime = this.debounceConfig[eventName] || 0;

    if (now - lastTime < debounceTime) {
      logger.debug(`Event ${eventName} debounced`);
      return false;
    }

    this.lastEventTimes.set(eventName, now);
    return true;
  }

  /**
   * Resolve once the cart calculation triggered by a mutation has settled.
   *
   * Cart mutations emit their event (e.g. `cart:item-added`) BEFORE the async,
   * debounced `calculateTotals()` runs, so at emit time the line has only
   * catalog prices and not yet the discounted `unit_price` / `total`. Waiting
   * for the next `cart:updated` (emitted after calculation) lets the analytics
   * event report the final, calculated line price. Falls back after `timeoutMs`
   * so tracking never hangs if no calculation occurs.
   */
  waitForCartCalculation(timeoutMs = 3000): Promise<void> {
    return new Promise<void>(resolve => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.eventBus.off('cart:updated', finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.eventBus.on('cart:updated', finish);
    });
  }

  /**
   * Reset the auto event listener (called by NextAnalytics)
   */
  public reset(): void {
    // Clear debounce timers but keep listeners active
    this.lastEventTimes.clear();
    logger.debug('AutoEventListener reset');
  }

  /**
   * Clean up the auto event listener
   */
  public destroy(): void {
    // Remove all event listeners
    this.eventHandlers.forEach((handler, eventName) => {
      this.eventBus.off(eventName as any, handler);
    });
    this.eventHandlers.clear();
    this.lastEventTimes.clear();

    this.isInitialized = false;
    logger.debug('AutoEventListener destroyed');
  }

  /**
   * Get listener status
   */
  public getStatus(): {
    initialized: boolean;
    listenersCount: number;
    debounceConfig: EventDebounceConfig;
  } {
    return {
      initialized: this.isInitialized,
      listenersCount: this.eventHandlers.size,
      debounceConfig: { ...this.debounceConfig },
    };
  }

  /**
   * Update debounce configuration
   */
  public setDebounceConfig(config: Partial<EventDebounceConfig>): void {
    Object.assign(this.debounceConfig, config);
    logger.debug('Updated debounce config:', this.debounceConfig);
  }
}

