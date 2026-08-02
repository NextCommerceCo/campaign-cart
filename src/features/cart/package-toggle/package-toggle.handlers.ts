import { useCartStore, cartOperations } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import { useOrderStore } from '@/state/order';
import { useConfigStore } from '@/state/config';
import { getApiClient } from '@/client';
import { preserveQueryParams } from '@/core/url-utils';
import type { CartState, EventMap } from '@/types/global';
import type { AddUpsellLine } from '@/types/api';
import type { Logger } from '@/core/logger';
import type { ToggleCard } from './package-toggle.types';
import { mergeWithDefaults, parseExcludeProperty, applyPropertyExclusion } from '@/features/cart/shared/properties';
import { renderTogglePrice } from './package-toggle.renderer';
import { fetchAndUpdateTogglePrice } from './package-toggle.price';

// ─── Global deduplication sets ───────────────────────────────────────────────

/** Prevents two elements from auto-adding the same package on page load. */
export const autoAddedPackages = new Set<number>();

/** Prevents re-entrant handleSyncUpdate calls while an async cart write is in-flight. */
const syncUpdateInProgress = new Set<number>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => autoAddedPackages.clear());
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export interface ToggleHandlerContext {
  logger: Logger;
  emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
  autoAddInProgress: Set<number>;
  isUpsellContext: boolean;
  isProcessingRef: { value: boolean };
  containerElement: HTMLElement;
}

export async function handleCardClick(
  e: Event,
  card: ToggleCard,
  ctx: ToggleHandlerContext,
): Promise<void> {
  e.preventDefault();

  if (ctx.isUpsellContext) {
    await handleUpsellCardClick(card, ctx);
    return;
  }

  const cartState = useCartStore.getState();
  const isInCart = cartState.items.some(i => i.packageId === card.packageId);

  if (card.isSyncMode) updateSyncedQuantity(card, cartState);

  if (card.isSyncMode && !isInCart && card.quantity === 0) {
    ctx.logger.warn('Sync card skipped — no synced packages in cart', card.packageId);
    return;
  }

  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    if (isInCart) {
      await cartOperations.removeItem(card.packageId);
      ctx.emit('toggle:toggled', { packageId: card.packageId, added: false });
    } else {
      await addToCart(card);
      ctx.emit('toggle:toggled', { packageId: card.packageId, added: true });
    }
  } catch (error) {
    ctx.logger.error('handleCardClick failed', error);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}

async function handleUpsellCardClick(
  card: ToggleCard,
  ctx: ToggleHandlerContext,
): Promise<void> {
  if (ctx.isProcessingRef.value) return;

  const orderStore = useOrderStore.getState();
  const nextUrl = resolveNextUrl(card, ctx.containerElement);

  if (!orderStore.canAddUpsells()) {
    ctx.logger.warn('Order does not support upsells at this time');
    if (nextUrl) navigatePreservingParams(nextUrl, ctx.logger);
    return;
  }

  ctx.isProcessingRef.value = true;
  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    const campaign = useCampaignStore.getState().data;
    const currency =
      campaign?.currency ?? useConfigStore.getState().getCurrency();
    const apiClient = getApiClient();

    const properties = applyPropertyExclusion(mergeWithDefaults(card.properties), parseExcludeProperty(card.excludeProperties));
    const upsellData: AddUpsellLine = {
      lines: [{ package_id: card.packageId, quantity: card.quantity || 1, ...(properties !== undefined && { properties }) }],
      currency,
    };
    ctx.logger.info('Adding upsell to order from toggle:', upsellData);
    const updatedOrder = await orderStore.addUpsell(upsellData, apiClient);
    if (!updatedOrder) throw new Error('No updated order returned');

    ctx.emit('upsell:added', { packageId: card.packageId, quantity: card.quantity || 1, order: updatedOrder });
    ctx.emit('toggle:toggled', { packageId: card.packageId, added: true });

    if (nextUrl) {
      setTimeout(() => navigatePreservingParams(nextUrl, ctx.logger), 100);
    }
  } catch (error) {
    ctx.logger.error('handleUpsellCardClick failed:', error);
  } finally {
    ctx.isProcessingRef.value = false;
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}

function resolveNextUrl(card: ToggleCard, containerElement: HTMLElement): string | undefined {
  return (
    card.element.getAttribute('data-next-url') ??
    card.stateContainer.getAttribute('data-next-url') ??
    containerElement.getAttribute('data-next-url') ??
    document.querySelector('meta[name="next-upsell-accept-url"]')?.getAttribute('content') ??
    undefined
  );
}

function navigatePreservingParams(url: string, logger: Logger): void {
  try {
    const target = new URL(url, window.location.origin);
    const orderRefId = useOrderStore.getState().order?.ref_id;
    if (orderRefId && !target.searchParams.has('ref_id')) {
      target.searchParams.append('ref_id', orderRefId);
    }
    window.location.href = preserveQueryParams(target.href);
  } catch {
    logger.error('Invalid navigation URL:', url);
    window.location.href = preserveQueryParams(url);
  }
}

export async function addToCart(card: ToggleCard): Promise<void> {
  const allPackages = useCampaignStore.getState().packages;
  const pkg = allPackages.find(p => p.ref_id === card.packageId);
  const properties = applyPropertyExclusion(mergeWithDefaults(card.properties), parseExcludeProperty(card.excludeProperties));

  await cartOperations.addItem({
    packageId: card.packageId,
    quantity: card.quantity || 1,
    title: pkg?.name ?? `Package ${card.packageId}`,
    price: pkg ? parseFloat(pkg.price) : 0,
    isUpsell: card.isUpsell,
    ...(properties !== undefined && { properties }),
  });
}

export async function updateCartItemProperties(card: ToggleCard): Promise<void> {
  const cartStore = useCartStore.getState();
  const existing = cartStore.items.find(i => i.packageId === card.packageId);
  if (!existing) return;

  const properties = applyPropertyExclusion(mergeWithDefaults(card.properties), parseExcludeProperty(card.excludeProperties));
  const updated = cartStore.items.map(i =>
    i.packageId === card.packageId
      ? { packageId: i.packageId, quantity: i.quantity, isUpsell: i.is_upsell, selectorId: i.selectorId, ...(i.properties !== undefined && { properties: i.properties }), ...(properties !== undefined ? { properties } : {}) }
      : { packageId: i.packageId, quantity: i.quantity, isUpsell: i.is_upsell, selectorId: i.selectorId, ...(i.properties !== undefined && { properties: i.properties }) },
  );
  await cartOperations.swapCart(updated);
}

export function updateSyncedQuantity(card: ToggleCard, cartState: CartState): void {
  if (card.syncPackageIds.length === 0 && card.syncProductIds.length === 0) return;

  let totalQuantity = 0;
  const countedIds = new Set<number>();

  card.syncPackageIds.forEach(syncId => {
    const syncedItem = cartState.items.find(
      item => item.packageId === syncId || item.originalPackageId === syncId
    );
    if (syncedItem) {
      totalQuantity += syncedItem.quantity * (syncedItem.qty ?? 1);
      countedIds.add(syncedItem.id);
    }
  });

  if (card.syncProductIds.length > 0) {
    totalQuantity += cartState.items
      .filter(item =>
        card.syncProductIds.includes(Number(item.productId)) &&
        !countedIds.has(item.id)
      )
      .reduce((sum, item) => sum + item.quantity * (item.qty ?? 1), 0);
  }

  card.quantity = totalQuantity;
}

export async function handleSyncUpdate(
  card: ToggleCard,
  _cartState: CartState,
  _logger: Logger,
): Promise<void> {
  if (!card.isSyncMode || (card.syncPackageIds.length === 0 && card.syncProductIds.length === 0)) return;
  if (syncUpdateInProgress.has(card.packageId)) return;

  // Always read fresh state — the snapshot passed by syncWithCart can be stale
  // when multiple sync cards trigger sequential updates in the same for-loop.
  const freshState = useCartStore.getState();

  let totalSyncQuantity = 0;
  let anySyncedItemExists = false;
  const countedIds = new Set<number>();

  card.syncPackageIds.forEach(syncId => {
    const syncedItem = freshState.items.find(
      item => item.packageId === syncId || item.originalPackageId === syncId
    );
    if (syncedItem) {
      anySyncedItemExists = true;
      totalSyncQuantity += syncedItem.quantity * (syncedItem.qty ?? 1);
      countedIds.add(syncedItem.id);
    }
  });

  if (card.syncProductIds.length > 0) {
    const productItems = freshState.items.filter(
      item =>
        card.syncProductIds.includes(Number(item.productId)) &&
        !countedIds.has(item.id)
    );
    if (productItems.length > 0) {
      anySyncedItemExists = true;
      totalSyncQuantity += productItems.reduce(
        (sum, item) => sum + item.quantity * (item.qty ?? 1),
        0,
      );
    }
  }

  card.quantity = totalSyncQuantity;

  const currentItem = freshState.items.find(item => item.packageId === card.packageId);

  syncUpdateInProgress.add(card.packageId);
  try {
    if (anySyncedItemExists && totalSyncQuantity > 0) {
      if (currentItem && currentItem.quantity !== totalSyncQuantity) {
        await cartOperations.updateQuantity(card.packageId, totalSyncQuantity);
      }
    } else if (currentItem && !freshState.swapInProgress) {
      if (currentItem.is_upsell) {
        setTimeout(async () => {
          const updatedState = useCartStore.getState();
          const stillNoSyncedPackages =
            card.syncPackageIds.every(syncId =>
              !updatedState.items.find(
                item => item.packageId === syncId || item.originalPackageId === syncId
              )
            ) &&
            (card.syncProductIds.length === 0 ||
              !updatedState.items.some(item =>
                card.syncProductIds.includes(Number(item.productId))
              ));
          const itemStillExists = updatedState.items.find(i => i.packageId === card.packageId);
          if (stillNoSyncedPackages && itemStillExists && !updatedState.swapInProgress) {
            await cartOperations.removeItem(card.packageId);
          }
        }, 500);
      } else {
        await cartOperations.removeItem(card.packageId);
      }
    }
  } finally {
    syncUpdateInProgress.delete(card.packageId);
  }
}

// ─── Cart sync ────────────────────────────────────────────────────────────

export interface ToggleSyncContext {
  cards: ToggleCard[];
  autoAddInProgress: Set<number>;
  emit: <K extends keyof EventMap>(event: K, detail: EventMap[K]) => void;
  logger: Logger;
  includeShipping: boolean;
  getPriceSyncDebounce: () => ReturnType<typeof setTimeout> | null;
  setPriceSyncDebounce: (handle: ReturnType<typeof setTimeout> | null) => void;
}

/**
 * Reconciles every toggle card with the current cart state: toggles
 * selected classes/attributes and button text, refreshes price display for
 * in-cart lines, drives sync-mode quantity updates, and auto-adds
 * pre-selected cards that are not in the cart yet. Also (re)starts a
 * debounced price refresh for any card that fell out of the cart.
 */
export function syncWithCart(cartState: CartState, ctx: ToggleSyncContext): void {
  const selectedPackageIds: number[] = [];

  for (const card of ctx.cards) {
    const inCart = cartState.items.some(i => i.packageId === card.packageId);
    card.isSelected = inCart;

    card.element.classList.toggle('next-in-cart', inCart);
    card.element.classList.toggle('next-not-in-cart', !inCart);
    card.element.classList.toggle('next-selected', inCart);
    card.element.setAttribute('data-next-in-cart', String(inCart));

    card.stateContainer.setAttribute('data-in-cart', String(inCart));
    card.stateContainer.setAttribute('data-next-active', String(inCart));
    card.stateContainer.classList.toggle('next-in-cart', inCart);
    card.stateContainer.classList.toggle('next-not-in-cart', !inCart);
    card.stateContainer.classList.toggle('next-active', inCart);
    card.stateContainer.classList.toggle('os--active', inCart);

    if (card.addText && card.removeText) {
      const textSlot = card.element.querySelector<HTMLElement>('[data-next-button-text]');
      if (textSlot) {
        textSlot.textContent = inCart ? card.removeText : card.addText;
      } else if (card.element.childElementCount === 0) {
        card.element.textContent = inCart ? card.removeText : card.addText;
      }
    }

    if (inCart) {
      selectedPackageIds.push(card.packageId);
      if (cartState.summary) {
        const line = cartState.summary.lines.find(l => l.package_id === card.packageId);
        if (line) renderTogglePrice(card, line);
      }
    }

    if (card.isSyncMode) {
      void handleSyncUpdate(card, cartState, ctx.logger);
    }

    if (
      card.isPreSelected &&
      !inCart &&
      !ctx.autoAddInProgress.has(card.packageId) &&
      !autoAddedPackages.has(card.packageId)
    ) {
      if (card.isSyncMode) updateSyncedQuantity(card, cartState);

      if (card.isSyncMode && card.quantity === 0) {
        ctx.logger.debug('Skipping pre-selected sync card — no synced packages in cart', card.packageId);
        continue;
      }

      card.isPreSelected = false;
      autoAddedPackages.add(card.packageId);
      ctx.autoAddInProgress.add(card.packageId);

      void addToCart(card).finally(() => {
        ctx.autoAddInProgress.delete(card.packageId);
      });
    }
  }

  ctx.emit('toggle:selection-changed', { selected: selectedPackageIds });

  const existingDebounce = ctx.getPriceSyncDebounce();
  if (existingDebounce !== null) clearTimeout(existingDebounce);
  ctx.setPriceSyncDebounce(
    setTimeout(() => {
      ctx.setPriceSyncDebounce(null);
      const currentItems = useCartStore.getState().items;
      for (const card of ctx.cards) {
        if (!currentItems.some(i => i.packageId === card.packageId)) {
          void fetchAndUpdateTogglePrice(card, ctx.includeShipping, ctx.logger);
        }
      }
    }, 150),
  );
}
