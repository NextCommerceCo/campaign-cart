/**
 * `SDKInitializer`'s attribution capture — extracted verbatim from
 * `sdk-initializer.ts`. Like `sdk-initializer.location-currency.ts`, this is a
 * boot step in its own right — `initialize()` calls `initializeAttribution`
 * directly, right after location/currency and before campaign data loads —
 * so moving it here does not change the boot sequence `boot-sequence.md`
 * publishes.
 *
 * Two dependencies: `logger`, and `attributionListenersCleanup` — the
 * teardown handle `setupAttributionListeners` needs to stay idempotent across
 * a boot retry or `reinitialize()` (finding #30 in `docs/code-findings.md`).
 * Both live on one `AttributionCtx` object that `SDKInitializer` holds as a
 * single static field and passes by reference to both functions below, so a
 * cleanup registered by one call is visible to the next.
 */

import type { Logger } from '@/core/logger';
import { useAttributionStore } from '@/state/attribution';
import { useConfigStore } from '@/state/config';
import { EventBus } from '@/core/events';

/** Shared, mutable context `initializeAttribution` and `setupAttributionListeners` hold in common. */
export interface AttributionCtx {
  logger: Logger;
  attributionListenersCleanup: (() => void) | null;
}

/**
 * Captures where the visitor came from.
 */
export async function initializeAttribution(
  ctx: AttributionCtx
): Promise<void> {
  try {
    ctx.logger.info('Initializing attribution...');

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

    ctx.logger.debug(
      `Added SDK version to attribution metadata: ${sdkVersion}`
    );
    if (userIp) {
      ctx.logger.debug(`Added user IP to attribution metadata: ${userIp}`);
    }

    // Set up event listeners for attribution updates
    setupAttributionListeners(ctx);

    // Initialize UTM transfer if enabled
    if (configStore.utmTransfer?.enabled) {
      const { UtmTransfer } = await import('@/core/attribution/utm-transfer');
      const utmTransfer = new UtmTransfer(configStore.utmTransfer);
      utmTransfer.init();
      ctx.logger.debug('UTM transfer initialized');
    }

    ctx.logger.debug('Attribution initialized');
  } catch (error) {
    ctx.logger.error('Attribution initialization failed:', error);
    // Continue with initialization - attribution failure shouldn't break SDK
  }
}

export function setupAttributionListeners(ctx: AttributionCtx): void {
  // Idempotent: a boot retry or reinitialize() calls this again, and
  // without tearing down the previous registration first, every cart
  // update and popstate would re-run once per past call (finding #30).
  ctx.attributionListenersCleanup?.();

  const eventBus = EventBus.getInstance();
  const attributionStore = useAttributionStore.getState();

  // Update funnel when campaign loads
  const offCampaignLoaded = eventBus.on('campaign:loaded', campaign => {
    if (campaign?.name && !attributionStore.funnel) {
      attributionStore.setFunnelName(campaign.name);
      ctx.logger.debug('Set funnel name from campaign:', campaign.name);
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
    ctx.logger.debug('Updated attribution with conversion timestamp');
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

  ctx.attributionListenersCleanup = () => {
    offCampaignLoaded();
    offCartUpdated();
    window.removeEventListener('popstate', onPopState);
  };
}
