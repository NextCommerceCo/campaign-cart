/**
 * Selector-discovery logic for SelectionDisplayEnhancer — figuring out which
 * `data-next-selector-id` this display element is bound to, and reading the
 * currently selected item / package data for it.
 */

import type { Logger } from '@/core/logger';
import type { Package, SelectorItem } from '@/types/global';
import type { LoadPackageDataResult } from './selection-display.types';

export function findSelectorIdFromContext(
  startElement: HTMLElement | null
): string | undefined {
  let current: HTMLElement | null = startElement;

  while (current) {
    const selectorId =
      current.getAttribute('data-next-selector-id') ?? undefined;
    if (selectorId) return selectorId;

    // Check if this is a selector element itself
    if (current.hasAttribute('data-next-cart-selector')) {
      return (
        current.getAttribute('data-next-selector-id') ??
        current.getAttribute('data-next-id') ??
        undefined
      );
    }

    current = current.parentElement;
  }

  return undefined;
}

/**
 * Looks up the currently selected item for `selectorId`.
 *
 * Returns `undefined` when nothing should change (no selector id, selector
 * element not found, or no fallback match) — the caller must only assign
 * `selectedItem` when the result is not `undefined`, since `null` is itself a
 * valid "selector found, nothing selected" result.
 */
export function findAssociatedSelector(
  selectorId: string | undefined,
  logger: Logger
): SelectorItem | null | undefined {
  if (!selectorId) return undefined;

  // Find the selector element
  const selectorElement = document.querySelector(
    `[data-next-selector-id="${selectorId}"]`
  ) as HTMLElement;

  if (selectorElement) {
    // Try to get the selected item from the selector's exposed methods
    const getSelectedItem = (selectorElement as any)._getSelectedItem;
    if (typeof getSelectedItem === 'function') {
      const selectedItem = getSelectedItem();
      logger.debug('Got initial selected item from selector:', selectedItem);
      return selectedItem;
    } else {
      // Fallback: Find the selected card directly if selector hasn't initialized yet
      const selectedCard = selectorElement.querySelector(
        '[data-next-selected="true"]'
      ) as HTMLElement;
      if (selectedCard) {
        const packageId = parseInt(
          selectedCard.getAttribute('data-next-package-id') || '0',
          10
        );
        const quantity = parseInt(
          selectedCard.getAttribute('data-next-quantity') || '1',
          10
        );

        if (packageId > 0) {
          const selectedItem: SelectorItem = {
            packageId,
            quantity,
            element: selectedCard,
            name: undefined,
            price: undefined,
            shippingId:
              selectedCard.getAttribute('data-next-shipping-id') || undefined,
            isPreSelected: true,
          };
          logger.debug('Found selected item from DOM:', selectedItem);
          return selectedItem;
        }
      }
    }
  } else {
    logger.debug(`Selector element not found for ID: ${selectorId}`);
  }

  return undefined;
}

export function needsCartData(property: string | undefined): boolean {
  // Check if the property requires cart data for discount calculations
  const discountProperties = [
    'discountedPrice',
    'finalPrice',
    'discountAmount',
    'appliedDiscountAmount',
    'hasDiscount',
    'appliedDiscounts',
    'discountPercentage',
  ];

  return property ? discountProperties.includes(property) : false;
}

/**
 * (Re)loads package data for the current selection.
 *
 * `changed: false` means the guard failed (no selection or no campaign data
 * yet) and the caller must leave its existing `packageData` untouched rather
 * than reset it — that stale-value-preserving behavior is intentional.
 */
export function loadPackageData(
  selectedItem: SelectorItem | null,
  campaignState: any,
  logger: Logger
): LoadPackageDataResult {
  if (!selectedItem || !campaignState) return { changed: false };

  const packageData = campaignState.packages?.find(
    (pkg: Package) => pkg.ref_id === selectedItem.packageId
  );

  if (!packageData) {
    logger.warn(`Package ${selectedItem.packageId} not found in campaign data`);
  }

  return { changed: true, packageData };
}
