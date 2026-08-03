/**
 * `NextCommerce`'s Metadata and Attribution categories — extracted verbatim
 * from `next-commerce.ts`. Grouped in one module rather than two because
 * every function here reads or writes the same `useAttributionStore`. Every
 * function only reads instance state to log, so each takes a bare
 * `logger: Logger`.
 */

import { useAttributionStore } from '@/state/attribution';
import type { Logger } from '@/core/logger';

/**
 * Adds one key to the attribution metadata sent with the order, merging so
 * the automatically collected fields survive.
 * @category Metadata
 */
export function addMetadata(logger: Logger, key: string, value: any): void {
  try {
    const store = useAttributionStore.getState();
    const currentMetadata = store.metadata || {};

    store.updateAttribution({
      metadata: {
        ...currentMetadata,
        [key]: value,
      },
    });

    logger.debug(`Attribution metadata added: ${key}`, value);
  } catch (error) {
    logger.error('Failed to add attribution metadata:', error);
  }
}

/**
 * Adds several keys to the attribution metadata. Merges rather than
 * replaces, despite the name — a true replace would wipe the automatic
 * fields.
 * @category Metadata
 */
export function setMetadata(
  logger: Logger,
  metadata: Record<string, any>
): void {
  try {
    const store = useAttributionStore.getState();
    const currentMetadata = store.metadata || {};

    // Merge with existing metadata to preserve automatic fields
    store.updateAttribution({
      metadata: {
        ...currentMetadata,
        ...metadata,
      },
    });

    logger.debug('Attribution metadata set:', metadata);
  } catch (error) {
    logger.error('Failed to set attribution metadata:', error);
  }
}

/**
 * Drops caller-supplied metadata while preserving the automatic fields
 * (`landing_page`, `referrer`, `device`, `device_type`, `domain`,
 * `timestamp`).
 * @category Metadata
 */
export function clearMetadata(logger: Logger): void {
  try {
    const store = useAttributionStore.getState();

    store.updateAttribution({
      metadata: {
        // Preserve automatic fields
        landing_page: store.metadata?.landing_page || '',
        referrer: store.metadata?.referrer || '',
        device: store.metadata?.device || '',
        device_type: store.metadata?.device_type || 'desktop',
        domain: store.metadata?.domain || '',
        timestamp: store.metadata?.timestamp || Date.now(),
      },
    });

    logger.debug('Attribution metadata cleared');
  } catch (error) {
    logger.error('Failed to clear attribution metadata:', error);
  }
}

/**
 * The attribution metadata as stored. `undefined` means the read failed; an
 * empty bag is `{}`.
 * @category Metadata
 */
export function getMetadata(logger: Logger): Record<string, any> | undefined {
  try {
    const store = useAttributionStore.getState();
    return store.metadata;
  } catch (error) {
    logger.error('Failed to get attribution metadata:', error);
    return undefined;
  }
}

/**
 * Overwrites the collected attribution — funnel, affiliate, `utm_*`. This
 * decides who is credited for the sale, so it is a reporting change.
 * @category Attribution
 */
export function setAttribution(
  logger: Logger,
  attribution: Record<string, any>
): void {
  try {
    const store = useAttributionStore.getState();
    store.updateAttribution(attribution);

    logger.debug('Attribution set:', attribution);
  } catch (error) {
    logger.error('Failed to set attribution:', error);
  }
}

/**
 * Attribution in the shape sent to the order API, not the raw store — the
 * right thing to log when an order is attributed wrongly.
 * @category Attribution
 */
export function getAttribution(
  logger: Logger
): Record<string, any> | undefined {
  try {
    const store = useAttributionStore.getState();
    return store.getAttributionForApi();
  } catch (error) {
    logger.error('Failed to get attribution:', error);
    return undefined;
  }
}

/**
 * Prints the whole attribution state to the console. Returns nothing; use
 * {@link core/next-commerce!NextCommerce.getAttribution} when you need a value.
 * @category Attribution
 */
export function debugAttribution(logger: Logger): void {
  try {
    const store = useAttributionStore.getState();
    store.debug();
  } catch (error) {
    logger.error('Failed to debug attribution:', error);
  }
}
