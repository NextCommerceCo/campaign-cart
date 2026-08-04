/**
 * `NextCommerce`'s Analytics category — extracted verbatim from
 * `next-commerce.ts`. Every function only reads instance state to log its
 * catch block, so each takes a bare `logger: Logger` rather than a context
 * object.
 */

import type { Logger } from '@/core/logger';

/**
 * Reports a list of packages as viewed — a product grid or recommendation
 * rail. `_listId` is accepted and ignored; the list name is the third
 * argument.
 * @category Analytics
 */
export async function trackViewItemList(
  logger: Logger,
  packageIds: (string | number)[],
  _listId?: string,
  listName?: string
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.trackViewItemList(packageIds, listName);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports one package as viewed. Warns and sends nothing when the package is
 * not in the loaded campaign, so an early call is silently dropped.
 * @category Analytics
 */
export async function trackViewItem(
  logger: Logger,
  packageId: string | number
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      const { useCampaignStore } = await import('@/state/campaign');

      // Convert to number and validate package exists
      const packageIdNum =
        typeof packageId === 'string' ? parseInt(packageId, 10) : packageId;
      const campaignStore = useCampaignStore.getState();
      const packageData = campaignStore.getPackage(packageIdNum);

      if (!packageData) {
        logger.warn('Package not found in store:', packageIdNum);
        return;
      }

      // Create a minimal item object for tracking (matches auto-tracking format)
      const item = {
        packageId: packageIdNum,
        package_id: packageIdNum,
        id: packageIdNum,
      };
      nextAnalytics.trackViewItem(item);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports an add-to-cart that happened outside the SDK's own cart calls.
 * Pairing it with {@link core/next-commerce!NextCommerce.addItem} reports the add twice.
 * @category Analytics
 */
export async function trackAddToCart(
  logger: Logger,
  packageId: string | number,
  quantity?: number
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      // Create a minimal item object for tracking
      const item = {
        id: String(packageId),
        packageId: packageId,
        quantity: quantity || 1,
      };
      nextAnalytics.trackAddToCart(item);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports a removal that happened outside the SDK's own cart calls. Pairing
 * it with {@link core/next-commerce!NextCommerce.removeItem} reports the removal twice.
 * @category Analytics
 */
export async function trackRemoveFromCart(
  logger: Logger,
  packageId: string | number,
  quantity?: number
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics, EcommerceEvents } = await import(
        '@/core/analytics/index'
      );
      nextAnalytics.track(
        EcommerceEvents.createRemoveFromCartEvent({
          packageId,
          quantity: quantity || 1,
        })
      );
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports checkout starting, from the current cart. The built-in checkout
 * form already fires this — call it only for a hand-built flow.
 * @category Analytics
 */
export async function trackBeginCheckout(logger: Logger): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.trackBeginCheckout();
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports a completed order from an order payload. The receipt page already
 * fires this; a second call doubles reported revenue.
 * @category Analytics
 */
export async function trackPurchase(
  logger: Logger,
  orderData: any
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.trackPurchase(orderData);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Sends an event of the caller's own naming. Nothing validates the name or
 * the payload, so a typo becomes a new event name.
 * @category Analytics
 */
export async function trackCustomEvent(
  logger: Logger,
  eventName: string,
  data?: Record<string, any>
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.track({ event: eventName, ...data });
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports a newsletter or account sign-up. The address goes into the event
 * payload as `customer_email` in the clear — nothing hashes it — so it reaches
 * every configured provider and the browser data layer as plain text.
 * @category Analytics
 */
export async function trackSignUp(
  logger: Logger,
  email: string
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.trackSignUp(email);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Reports a returning visitor signing in. Carries the address in the clear,
 * exactly as {@link core/next-commerce!NextCommerce.trackSignUp} does.
 * @category Analytics
 */
export async function trackLogin(logger: Logger, email: string): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.trackLogin(email);
    } catch (error) {
      logger.debug('Analytics tracking failed (non-critical):', error);
    }
  });
}

/**
 * Turns verbose analytics logging on or off at runtime. Unrelated to the
 * debug overlay, which is `?debugger=true` or `window.nextConfig.debugger`.
 * @category Analytics
 */
export async function setDebugMode(
  logger: Logger,
  enabled: boolean
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.setDebugMode(enabled);
    } catch (error) {
      logger.debug('Analytics debug mode failed (non-critical):', error);
    }
  });
}

/**
 * Discards the cached page context so the next event is built from the
 * current route. Needed in a single-page app, where no page load resets it.
 * @category Analytics
 */
export async function invalidateAnalyticsContext(
  logger: Logger
): Promise<void> {
  queueMicrotask(async () => {
    try {
      const { nextAnalytics } = await import('@/core/analytics/index');
      nextAnalytics.invalidateContext();
    } catch (error) {
      logger.debug(
        'Analytics context invalidation failed (non-critical):',
        error
      );
    }
  });
}
