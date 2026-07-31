/**
 * State → DOM for UpsellEnhancer: whether the offer is shown at all, and how it
 * reacts to the order store (processing, error).
 */

import { useOrderStore } from '@/state/order';
import type { Logger } from '@/core/logger';
import {
  renderProcessingState,
  showUpsellOffer,
  hideUpsellOffer,
  renderError,
} from './upsell.renderer';

/**
 * Shows the offer while the order can still take upsells, hides it otherwise
 * (order already closed, or an upsell is mid-flight).
 */
export function updateUpsellDisplay(element: HTMLElement): void {
  if (useOrderStore.getState().canAddUpsells()) {
    showUpsellOffer(element);
  } else {
    hideUpsellOffer(element);
  }
}

/**
 * Reflects an order-store change on the offer: availability, the processing
 * lock on the action buttons, and the error state when one is present.
 *
 * `actionButtons` is read from the enhancer at call time, so buttons found by a
 * later re-scan are included.
 */
export function handleOrderUpdate(
  orderState: { isProcessingUpsell: boolean; upsellError?: string | null },
  element: HTMLElement,
  actionButtons: HTMLElement[],
  logger: Logger
): void {
  updateUpsellDisplay(element);
  renderProcessingState(element, actionButtons, orderState.isProcessingUpsell);
  if (orderState.upsellError) {
    renderError(element, orderState.upsellError, logger);
  }
}
