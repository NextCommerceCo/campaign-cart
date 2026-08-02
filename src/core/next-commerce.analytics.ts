/**
 * `NextCommerce`'s Analytics category — extracted verbatim from
 * `next-commerce.ts`. Every function only reads instance state to log its
 * catch block, so each takes a bare `logger: Logger` rather than a context
 * object.
 */

import type { Logger } from '@/core/logger';

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
