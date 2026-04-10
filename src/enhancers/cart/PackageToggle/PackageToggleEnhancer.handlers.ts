import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';
import { ApiClient } from '@/api/client';
import { preserveQueryParams } from '@/utils/url-utils';
import type { CartState, EventMap } from '@/types/global';
import type { AddUpsellLine } from '@/types/api';
import type { Logger } from '@/utils/logger';
import type { ToggleCard } from './PackageToggleEnhancer.types';

// ─── Global auto-add deduplication ───────────────────────────────────────────

/** Prevents two elements from auto-adding the same package on page load. */
export const autoAddedPackages = new Set<number>();
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
      await useCartStore.getState().removeItem(card.packageId);
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
    const currency = campaign?.currency ?? useConfigStore.getState().selectedCurrency ?? 'USD';
    const apiClient = new ApiClient(useConfigStore.getState().apiKey);

    const upsellData: AddUpsellLine = {
      lines: [{ package_id: card.packageId, quantity: card.quantity || 1 }],
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

  await useCartStore.getState().addItem({
    packageId: card.packageId,
    quantity: card.quantity || 1,
    title: pkg?.name ?? `Package ${card.packageId}`,
    price: pkg ? parseFloat(pkg.price) : 0,
    isUpsell: card.isUpsell,
  });
}

export function updateSyncedQuantity(card: ToggleCard, cartState: CartState): void {
  if (card.syncPackageIds.length === 0) return;

  let totalQuantity = 0;
  card.syncPackageIds.forEach(syncId => {
    const syncedItem = cartState.items.find(
      item => item.packageId === syncId || item.originalPackageId === syncId
    );
    if (syncedItem) {
      const itemsPerPackage = syncedItem.qty ?? 1;
      totalQuantity += syncedItem.quantity * itemsPerPackage;
    }
  });

  card.quantity = totalQuantity;
}

export async function handleSyncUpdate(
  card: ToggleCard,
  cartState: CartState,
  logger: Logger,
): Promise<void> {
  if (!card.isSyncMode || card.syncPackageIds.length === 0) return;

  let totalSyncQuantity = 0;
  let anySyncedItemExists = false;

  card.syncPackageIds.forEach(syncId => {
    const syncedItem = cartState.items.find(
      item => item.packageId === syncId || item.originalPackageId === syncId
    );
    if (syncedItem) {
      anySyncedItemExists = true;
      const itemsPerPackage = syncedItem.qty ?? 1;
      totalSyncQuantity += syncedItem.quantity * itemsPerPackage;
    }
  });

  card.quantity = totalSyncQuantity;

  const currentItem = cartState.items.find(item => item.packageId === card.packageId);

  if (anySyncedItemExists && totalSyncQuantity > 0) {
    if (currentItem && currentItem.quantity !== totalSyncQuantity) {
      await useCartStore.getState().updateQuantity(card.packageId, totalSyncQuantity);
    }
  } else if (currentItem && !cartState.swapInProgress) {
    if (currentItem.is_upsell) {
      setTimeout(async () => {
        const updatedState = useCartStore.getState();
        const stillNoSyncedPackages = card.syncPackageIds.every(syncId =>
          !updatedState.items.find(
            item => item.packageId === syncId || item.originalPackageId === syncId
          )
        );
        const itemStillExists = updatedState.items.find(i => i.packageId === card.packageId);
        if (stillNoSyncedPackages && itemStillExists && !updatedState.swapInProgress) {
          await useCartStore.getState().removeItem(card.packageId);
        }
      }, 500);
    } else {
      await useCartStore.getState().removeItem(card.packageId);
    }
  }
}
