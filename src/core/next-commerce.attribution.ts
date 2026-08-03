/**
 * `NextCommerce`'s Metadata and Attribution categories — extracted verbatim
 * from `next-commerce.ts`. Grouped in one module rather than two because
 * every function here reads or writes the same `useAttributionStore`. Every
 * function only reads instance state to log, so each takes a bare
 * `logger: Logger`.
 */

import { useAttributionStore } from '@/state/attribution';
import type { Logger } from '@/core/logger';

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

export function getMetadata(logger: Logger): Record<string, any> | undefined {
  try {
    const store = useAttributionStore.getState();
    return store.metadata;
  } catch (error) {
    logger.error('Failed to get attribution metadata:', error);
    return undefined;
  }
}

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

export function debugAttribution(logger: Logger): void {
  try {
    const store = useAttributionStore.getState();
    store.debug();
  } catch (error) {
    logger.error('Failed to debug attribution:', error);
  }
}
