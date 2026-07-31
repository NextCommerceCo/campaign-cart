/**
 * Card discovery and registration for PackageToggleEnhancer — scanning the
 * container for `[data-next-toggle-card]` elements (or the single-element
 * toggle mode), resolving each card's state container and packageId, and
 * wiring up its click handler and property listeners.
 */

import { useCampaignStore } from '@/state/campaign';
import type { Logger } from '@/core/logger';
import type { ToggleCard } from './package-toggle.types';
import type { ToggleHandlerContext } from './package-toggle.handlers';
import {
  handleCardClick,
  updateCartItemProperties,
} from './package-toggle.handlers';
import { makeProvisionalPrices } from './package-toggle.state';
import { updateCardDisplayElements } from './package-toggle.renderer';
import { attachPropertyListeners } from '@/features/cart/shared/properties';

export interface CardRegistrationContext {
  cards: ToggleCard[];
  clickHandlers: Map<HTMLElement, (e: Event) => void>;
  logger: Logger;
  makeHandlerContext: () => ToggleHandlerContext;
}

/**
 * Scans `containerElement` for `[data-next-toggle-card]` descendants and
 * registers each one not already tracked in `ctx.cards`. Falls back to
 * single-element toggle mode — registering the container itself — when it
 * carries `data-next-package-toggle` plus a package id but no child cards
 * were found.
 */
export function scanCards(
  containerElement: HTMLElement,
  ctx: CardRegistrationContext
): void {
  containerElement
    .querySelectorAll<HTMLElement>('[data-next-toggle-card]')
    .forEach(el => {
      if (!ctx.cards.find(c => c.element === el)) registerCard(el, ctx);
    });

  if (
    containerElement.hasAttribute('data-next-package-toggle') &&
    ctx.cards.length === 0 &&
    (containerElement.hasAttribute('data-next-package-id') ||
      containerElement.hasAttribute('data-package-id'))
  ) {
    registerCard(containerElement, ctx);
  }
}

export function registerCard(
  el: HTMLElement,
  ctx: CardRegistrationContext
): void {
  const stateContainer = findStateContainer(el);

  const packageIdAttr = el.getAttribute('data-next-package-id');
  let packageId: number;

  if (packageIdAttr) {
    const parsed = parseInt(packageIdAttr, 10);
    if (isNaN(parsed)) {
      ctx.logger.warn(
        'Invalid data-next-package-id on toggle card',
        packageIdAttr
      );
      return;
    }
    packageId = parsed;
  } else {
    const resolved = resolvePackageId(el, stateContainer);
    if (resolved === null) {
      ctx.logger.warn('Toggle card is missing data-next-package-id', el);
      return;
    }
    packageId = resolved;
  }

  const isPreSelected =
    el.getAttribute('data-next-selected') === 'true' ||
    stateContainer.getAttribute('data-next-selected') === 'true';

  const packageSyncAttr =
    el.getAttribute('data-next-package-sync') ??
    stateContainer.getAttribute('data-next-package-sync');

  const productSyncAttr =
    el.getAttribute('data-next-product-sync') ??
    stateContainer.getAttribute('data-next-product-sync');

  let isSyncMode = false;
  let syncPackageIds: number[] = [];
  let syncProductIds: number[] = [];
  let quantity = 1;

  if (packageSyncAttr) {
    syncPackageIds = packageSyncAttr
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));
    if (syncPackageIds.length > 0) {
      isSyncMode = true;
      quantity = 0;
    }
  }

  if (productSyncAttr) {
    syncProductIds = productSyncAttr
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));
    if (syncProductIds.length > 0) {
      isSyncMode = true;
      quantity = 0;
    }
  }

  if (!isSyncMode) {
    const qtyAttr =
      el.getAttribute('data-next-quantity') ??
      el.getAttribute('data-quantity') ??
      stateContainer.getAttribute('data-next-quantity');
    quantity = qtyAttr ? parseInt(qtyAttr, 10) : 1;
  }

  const isUpsell =
    el.getAttribute('data-next-is-upsell') === 'true' ||
    stateContainer.hasAttribute('data-next-upsell') ||
    stateContainer.hasAttribute('data-next-bump') ||
    el.closest('[data-next-upsell-section]') !== null ||
    el.closest('[data-next-bump-section]') !== null;

  const excludeProperties =
    el.getAttribute('data-next-exclude-property') ??
    stateContainer.getAttribute('data-next-exclude-property') ??
    undefined;

  const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
    p => p.ref_id === packageId
  );

  const card: ToggleCard = {
    element: el,
    packageId,
    name: pkg?.name ?? '',
    image: pkg?.image ?? '',
    productId: pkg?.product_id ?? null,
    variantId: pkg?.product_variant_id ?? null,
    variantName: pkg?.product_variant_name ?? '',
    productName: pkg?.product_name ?? '',
    sku: pkg?.product_sku ?? null,
    isPreSelected,
    isSelected: false,
    quantity,
    isSyncMode,
    syncPackageIds,
    syncProductIds,
    isUpsell,
    stateContainer,
    addText: el.getAttribute('data-add-text'),
    removeText: el.getAttribute('data-remove-text'),
    ...makeProvisionalPrices(pkg),
    discounts: [],
    properties: undefined,
    excludeProperties,
  };

  ctx.cards.push(card);
  el.classList.add('next-toggle-card');
  updateCardDisplayElements(card);

  const handlerCtx = ctx.makeHandlerContext();
  const handler = (e: Event) => void handleCardClick(e, card, handlerCtx);
  ctx.clickHandlers.set(el, handler);
  el.addEventListener('click', handler);

  if (excludeProperties !== '*') {
    card.properties = {};
    attachPropertyListeners(
      el,
      card.properties,
      () => void updateCartItemProperties(card)
    );
  }

  ctx.logger.debug(`Registered toggle card for packageId ${packageId}`, {
    isSyncMode,
    syncPackageIds,
    syncProductIds,
    isUpsell,
    quantity,
  });
}

/**
 * Walks up from `el` looking for the element that should carry the card's
 * state attributes/classes — the nearest explicit container marker, or the
 * nearest ancestor (including `el`) carrying the package id. Falls back to
 * `el` itself when neither is found.
 */
export function findStateContainer(el: HTMLElement): HTMLElement {
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    if (
      current.hasAttribute('data-next-toggle-container') ||
      current.hasAttribute('data-next-bump') ||
      current.hasAttribute('data-next-upsell-item') ||
      current.classList.contains('upsell') ||
      current.classList.contains('bump')
    ) {
      return current;
    }
    if (
      current.hasAttribute('data-next-package-id') ||
      current.hasAttribute('data-package-id')
    ) {
      return current;
    }
    current = current.parentElement;
  }

  return el;
}

export function resolvePackageId(
  el: HTMLElement,
  stateContainer: HTMLElement
): number | null {
  const fromEl =
    el.getAttribute('data-next-package-id') ??
    el.getAttribute('data-package-id');
  if (fromEl) {
    const id = parseInt(fromEl, 10);
    return isNaN(id) ? null : id;
  }
  if (stateContainer !== el) {
    const fromContainer =
      stateContainer.getAttribute('data-next-package-id') ??
      stateContainer.getAttribute('data-package-id');
    if (fromContainer) {
      const id = parseInt(fromContainer, 10);
      return isNaN(id) ? null : id;
    }
  }
  return null;
}
