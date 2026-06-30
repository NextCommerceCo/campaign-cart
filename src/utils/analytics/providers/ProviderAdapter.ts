import type { AnalyticsProvider, DataLayerEvent } from '../types';
import { createLogger, type Logger } from '@/utils/logger';
import { analyticsDebug, type ProviderDebugInfo } from '../debug/AnalyticsDebugTracker';

/**
 * Construction options shared by every provider adapter.
 */
export interface ProviderAdapterOptions {
  /** Event names that must never reach this provider. */
  blockedEvents?: string[];
}

/**
 * Base class for analytics provider adapters.
 *
 * Adapters translate the SDK's vendor-neutral {@link DataLayerEvent} stream
 * into a single destination (GTM, Facebook, RudderStack, …). The base owns the
 * common contract — enable/disable, `blockedEvents` filtering, async-safe
 * dispatch and logging — so subclasses only implement {@link sendEvent}.
 *
 * @example
 * ```ts
 * class MyAdapter extends ProviderAdapter {
 *   constructor(config?: { blockedEvents?: string[] }) {
 *     super('MyProvider', { blockedEvents: config?.blockedEvents });
 *   }
 *   sendEvent(event: DataLayerEvent): void {
 *     window.myProvider?.track(event.event, event.data);
 *   }
 * }
 * ```
 */
export abstract class ProviderAdapter implements AnalyticsProvider {
  readonly name: string;
  enabled = true;
  protected blockedEvents: string[];
  protected logger: Logger;

  constructor(name: string, options: ProviderAdapterOptions = {}) {
    this.name = name;
    this.blockedEvents = options.blockedEvents ?? [];
    this.logger = createLogger(name);
    analyticsDebug.registerProvider(this);
  }

  /**
   * Enable or disable the adapter. A disabled adapter drops every event.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if the adapter is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Optional async setup hook. Override in adapters that must load an external
   * script or resolve configuration before they can deliver events. The default
   * is a no-op.
   */
  initialize(_config?: unknown): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Whether a given event should reach this provider — enabled and not in
   * {@link blockedEvents}. Override to add provider-specific routing rules.
   */
  protected shouldTrack(event: DataLayerEvent): boolean {
    return this.enabled && !this.blockedEvents.includes(event.event);
  }

  /**
   * Entry point called by the DataLayerManager. Applies the enabled/blocked
   * gate, delegates to {@link sendEvent}, and reports the outcome
   * (`blocked` / `pending` → `sent` / `failed`) to {@link analyticsDebug} so the
   * Provider Delivery panel can show what each provider did. Captures both
   * synchronous throws and rejected promises so one provider can never break
   * the dispatch loop.
   */
  trackEvent(event: DataLayerEvent): void {
    if (!this.enabled) {
      analyticsDebug.record(this.name, event.event, 'blocked', {
        eventId: event.event_id,
        detail: 'provider disabled',
        payload: event,
      });
      return;
    }

    if (this.blockedEvents.includes(event.event)) {
      this.logger.debug(`Event "${event.event}" is blocked for ${this.name}`);
      analyticsDebug.record(this.name, event.event, 'blocked', {
        eventId: event.event_id,
        detail: 'blockedEvents',
        payload: event,
      });
      return;
    }

    const recordId = analyticsDebug.record(this.name, event.event, 'pending', {
      eventId: event.event_id,
      payload: event,
    });

    try {
      const result = this.sendEvent(event);
      if (result instanceof Promise) {
        result
          .then(sent => analyticsDebug.update(recordId, 'sent', { sentPayload: sent }))
          .catch(error => {
            analyticsDebug.update(recordId, 'failed', { error: String(error) });
            this.logger.error(`Failed to send event "${event.event}"`, error);
          });
      } else {
        analyticsDebug.update(recordId, 'sent', { sentPayload: result });
      }
    } catch (error) {
      analyticsDebug.update(recordId, 'failed', { error: String(error) });
      this.logger.error(`Failed to send event "${event.event}"`, error);
    }
  }

  /**
   * Deliver an event to the provider. Implementations may be synchronous or
   * return a promise; {@link trackEvent} handles either.
   *
   * Implementations should **return the transformed payload they dispatched**
   * (the provider-specific shape — fbq parameters, API body, GTM push, …) so the
   * debug overlay can show the exact data each provider sent. Returning nothing
   * is fine; the overlay falls back to the original event payload.
   */
  abstract sendEvent(event: DataLayerEvent): unknown | Promise<unknown>;

  /**
   * Whether the provider can deliver events right now — e.g. its external
   * script has finished loading. Override in adapters that depend on a
   * third-party SDK. Surfaced as `ready` in the Provider Status panel.
   */
  protected isReady(): boolean {
    return true;
  }

  /**
   * Adapter-specific diagnostics surfaced in the Provider Status panel
   * (pixel id, endpoint, queued event count, …). Override to add fields.
   */
  protected getDebugDetails(): Record<string, string | number | boolean> {
    return {};
  }

  /**
   * Snapshot of this provider's configuration and readiness for the debug
   * overlay, combining {@link isReady} and {@link getDebugDetails}.
   */
  getDebugInfo(): ProviderDebugInfo {
    return {
      name: this.name,
      enabled: this.enabled,
      ready: this.isReady(),
      blockedEvents: [...this.blockedEvents],
      details: this.getDebugDetails(),
    };
  }

  /**
   * Transform event data to provider-specific format.
   * Default implementation flattens `data` onto the event; override as needed.
   */
  protected transformEvent(event: DataLayerEvent): any {
    return {
      event: event.event,
      ...event.data,
    };
  }

  /**
   * Log debug information. Routed through the shared logger so output respects
   * the SDK's log levels and is stripped from production builds.
   *
   * @deprecated Prefer `this.logger.debug(...)` directly in new code.
   */
  protected debug(message: string, data?: any): void {
    this.logger.debug(message, data ?? '');
  }

  /**
   * Check if we're in a browser environment.
   */
  protected isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Safe property access helper.
   */
  protected getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format currency values.
   */
  protected formatCurrency(value: number): string {
    return value.toFixed(2);
  }

  /**
   * Extract common ecommerce properties.
   */
  protected extractEcommerceData(event: DataLayerEvent): any {
    // Check if ecommerce data is in the ecommerce property
    const ecommerceData = event.ecommerce || event.data || {};

    return {
      currency: ecommerceData.currency || 'USD',
      value: ecommerceData.value || ecommerceData.total || 0,
      items: ecommerceData.items || ecommerceData.products || [],
      transaction_id: ecommerceData.transaction_id || ecommerceData.order_id,
      coupon: ecommerceData.coupon || ecommerceData.discount_code,
      shipping: ecommerceData.shipping || 0,
      tax: ecommerceData.tax || 0,
    };
  }
}
