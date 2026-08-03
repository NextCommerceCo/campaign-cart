import {
  ProviderAdapter,
  notSupported,
  asSkipResult,
  DispatchError,
  type SkipResult,
} from './provider-adapter';
import { DataLayerEvent } from '../types';
import { createLogger } from '@/core/logger';
import { buildContextProps, getPageMetadata } from './rudderstack-context';
import { buildEventProperties } from './rudderstack-properties';

const logger = createLogger('RudderStack');

declare global {
  interface Window {
    rudderanalytics: {
      track: (event: string, properties?: any, options?: any) => void;
      page: (
        category?: string,
        name?: string,
        properties?: any,
        options?: any
      ) => void;
      identify: (userId: string, traits?: any, options?: any) => void;
      reset: () => void;
      ready: (callback: () => void) => void;
    };
  }
}

/**
 * A built-but-not-yet-dispatched RudderStack call: `descriptor` is the shape
 * shown in the debug overlay, `dispatch()` performs the actual SDK call(s).
 */
interface RudderPlan {
  descriptor: unknown;
  dispatch: () => void;
}

/**
 * RudderStack Analytics adapter
 * Maps SDK events to RudderStack events matching the old integration format
 *
 * Split across three files by layer: this one is the dispatch orchestrator
 * (readiness, the built/dispatch plan, event-name mapping); the campaign/page
 * context resolvers live in `./rudderstack-context`; the per-event-type
 * property builders live in `./rudderstack-properties`.
 */
export class RudderStackAdapter extends ProviderAdapter {
  private pageViewSent = false;
  private loadWarned = false;

  constructor(config?: { blockedEvents?: string[] }) {
    super('RudderStack', { blockedEvents: config?.blockedEvents });
  }

  /** Warn once, with the fix, when the RudderStack SDK never loads. */
  private warnScriptMissing(): void {
    if (this.loadWarned) return;
    this.loadWarned = true;
    this.logger.warn(
      'rudderanalytics not found — add the RudderStack JavaScript SDK snippet ' +
        'to the page so events can be delivered. See ' +
        'https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/'
    );
  }

  /**
   * Check if RudderStack is loaded
   */
  private isRudderStackLoaded(): boolean {
    return (
      this.isBrowser() &&
      typeof window.rudderanalytics === 'object' &&
      typeof window.rudderanalytics.track === 'function'
    );
  }

  protected override isReady(): boolean {
    return this.isRudderStackLoaded();
  }

  protected override getDebugDetails(): Record<
    string,
    string | number | boolean
  > {
    return {
      scriptLoaded: this.isRudderStackLoaded(),
      pageViewSent: this.pageViewSent,
    };
  }

  /**
   * Send event to RudderStack.
   *
   * Returns the transformed payload actually dispatched (the RudderStack call +
   * its arguments) so the debug overlay can show exactly what this provider
   * sent. When RudderStack has not loaded yet, the returned promise resolves to
   * that payload once the send completes (or rejects on load timeout).
   */
  sendEvent(event: DataLayerEvent): unknown | Promise<unknown> {
    if (!this.enabled) {
      this.debug('RudderStack adapter disabled');
      return undefined;
    }

    // Log all events being sent to RudderStack
    logger.info(`Processing event "${event.event}"`, {
      eventName: event.event,
      eventData: event,
    });

    // Build the payload up front — independent of whether the SDK has loaded —
    // so the debug overlay can show what we'd send even if the send fails.
    const plan = this.buildPlan(event);
    const skip = asSkipResult(plan);
    if (skip) return skip;
    const ready = plan as RudderPlan;

    // If RudderStack is not loaded yet, wait for it before dispatching. On
    // timeout, surface the prepared descriptor so it's still inspectable.
    if (!this.isRudderStackLoaded()) {
      return this.waitForRudderStack()
        .then(() => {
          ready.dispatch();
          return ready.descriptor;
        })
        .catch(() => {
          this.warnScriptMissing();
          throw new DispatchError('RudderStack load timeout', ready.descriptor);
        });
    }

    ready.dispatch();
    return ready.descriptor;
  }

  /**
   * Wait for RudderStack to be loaded
   */
  private async waitForRudderStack(timeout: number = 5000): Promise<void> {
    const start = Date.now();

    return new Promise((resolve, reject) => {
      // Check if ready callback is available
      if (window.rudderanalytics?.ready) {
        window.rudderanalytics.ready(() => resolve());

        // Still set a timeout in case ready never fires
        setTimeout(() => {
          if (this.isRudderStackLoaded()) {
            resolve();
          } else {
            reject(new Error('RudderStack ready timeout'));
          }
        }, timeout);
      } else {
        // Fallback to polling
        const checkInterval = setInterval(() => {
          if (this.isRudderStackLoaded()) {
            clearInterval(checkInterval);
            resolve();
          } else if (Date.now() - start > timeout) {
            clearInterval(checkInterval);
            reject(new Error('RudderStack load timeout'));
          }
        }, 100);
      }
    });
  }

  /**
   * Build the RudderStack call(s) for an event WITHOUT dispatching: returns a
   * {@link RudderPlan} pairing the overlay descriptor with a `dispatch()` that
   * performs the actual `window.rudderanalytics.*` calls, or a
   * {@link notSupported} skip result when nothing would be sent. Splitting build
   * from dispatch lets the overlay show the payload even when the send fails.
   */
  private buildPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    switch (event.event) {
      case 'dl_page_view':
      case 'page_view':
        return this.buildPageViewPlan(event);

      case 'dl_user_data':
      case 'user_data':
        return this.buildUserDataPlan(event);

      default: {
        const rudderEventName = this.mapEventName(event.event);
        if (!rudderEventName)
          return notSupported('no RudderStack mapping for this event');
        const properties = buildEventProperties(event, rudderEventName);
        return {
          descriptor: { method: 'track', event: rudderEventName, properties },
          dispatch: () => {
            window.rudderanalytics.track(rudderEventName, properties);
            this.debug(
              `Event sent to RudderStack: ${rudderEventName}`,
              properties
            );
          },
        };
      }
    }
  }

  /** Build the `page()` + custom `track()` plan for a page-view event. */
  private buildPageViewPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    if (this.pageViewSent) {
      return notSupported('duplicate page view');
    }

    // The page-view event carries its data on `event.page`
    // ({ title, url, path, referrer }) — see AutoEventListener. `event.data`
    // is only present for legacy/manual pushes, so fall back to it.
    const page = (event as any).page || event.data || {};
    // page_type / page_name are NOT on the event — resolve them from the config
    // store (pageType) and the document title, never a hard-coded 'unknown'.
    const { pageType, pageName } = getPageMetadata();

    const properties = {
      path: page.path || window.location.pathname,
      url: page.url || page.page_location || window.location.href,
      title: page.title || document.title,
      referrer: page.referrer || document.referrer,
      ...buildContextProps(event),
    };

    const pageTypeCapitalized =
      pageType.charAt(0).toUpperCase() + pageType.slice(1);
    const eventName = `${pageTypeCapitalized} Page View`;
    const customProperties = { page_name: pageName, ...properties };

    return {
      descriptor: {
        calls: [
          { method: 'page', category: pageType, name: pageName, properties },
          { method: 'track', event: eventName, properties: customProperties },
        ],
      },
      dispatch: () => {
        window.rudderanalytics.page(pageType, pageName, properties);
        window.rudderanalytics.track(eventName, customProperties);
        this.pageViewSent = true;
        this.debug('Page View tracked', { pageType, pageName, eventName });
      },
    };
  }

  /** Build the `identify()` plan for a user-data event. */
  private buildUserDataPlan(event: DataLayerEvent): RudderPlan | SkipResult {
    const userData = event.user_properties || event.data || {};

    if (!(userData.customer_email || userData.email || userData.user_id)) {
      // Supported event, but no email/user_id to identify — nothing to send.
      return notSupported('no identifiable user (guest)');
    }

    const userId =
      userData.user_id || userData.customer_email || userData.email;

    const traits = {
      email: userData.customer_email || userData.email,
      firstName:
        userData.customer_first_name ||
        userData.firstName ||
        userData.first_name,
      lastName:
        userData.customer_last_name || userData.lastName || userData.last_name,
      phone: userData.customer_phone || userData.phone,
      city: userData.customer_city || userData.city,
      state: userData.customer_state || userData.state,
      country: userData.customer_country || userData.country,
      postalCode:
        userData.customer_zip || userData.postalCode || userData.postal_code,
      acceptsMarketing:
        userData.customer_accepts_marketing ||
        userData.acceptsMarketing ||
        userData.accepts_marketing,
    };

    // Remove undefined values
    Object.keys(traits).forEach(
      key =>
        traits[key as keyof typeof traits] === undefined &&
        delete traits[key as keyof typeof traits]
    );

    return {
      descriptor: { method: 'identify', userId, traits },
      dispatch: () => {
        window.rudderanalytics.identify(userId, traits);
        this.debug('User Identified', { userId, traits });
      },
    };
  }

  /**
   * Map data layer event names to RudderStack event names
   */
  private mapEventName(eventName: string): string | null {
    // Names follow the RudderStack Ecommerce Events Spec:
    // https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/
    const eventMapping: Record<string, string> = {
      // Ecommerce events
      dl_view_item: 'Product Viewed',
      dl_select_item: 'Product Clicked',
      dl_view_item_list: 'Product List Viewed',
      dl_add_to_cart: 'Product Added',
      dl_remove_from_cart: 'Product Removed',
      dl_view_cart: 'Cart Viewed',
      dl_cart_updated: 'Cart Viewed',
      dl_begin_checkout: 'Checkout Started',
      // Spec has no "shipping info" event; shipping selection is a checkout
      // step. Payment uses the spec's exact "Payment Info Entered" name.
      dl_add_shipping_info: 'Checkout Step Completed',
      dl_add_payment_info: 'Payment Info Entered',
      dl_purchase: 'Order Completed',
      // Accepted upsell is a separate post-purchase transaction (its own
      // transaction_id, `<order>-US<n>`) → a second Order Completed.
      dl_upsell_purchase: 'Order Completed',

      // Standard names
      view_item: 'Product Viewed',
      select_item: 'Product Clicked',
      view_item_list: 'Product List Viewed',
      add_to_cart: 'Product Added',
      remove_from_cart: 'Product Removed',
      view_cart: 'Cart Viewed',
      begin_checkout: 'Checkout Started',
      add_shipping_info: 'Checkout Step Completed',
      add_payment_info: 'Payment Info Entered',
      purchase: 'Order Completed',

      // Upsell offer events (custom — not part of the spec)
      dl_viewed_upsell: 'Upsell Viewed',
      dl_skipped_upsell: 'Upsell Skipped',

      // User events
      dl_sign_up: 'Signed Up',
      dl_login: 'Logged In',
      sign_up: 'Signed Up',
      login: 'Logged In',
    };

    return eventMapping[eventName] || null;
  }
}
