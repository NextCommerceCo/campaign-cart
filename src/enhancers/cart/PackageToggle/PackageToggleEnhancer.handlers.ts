import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { CartState } from '@/types/global';
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
  emit: (event: string, detail: unknown) => void;
  autoAddInProgress: Set<number>;
}

export async function handleCardClick(
  e: Event,
  card: ToggleCard,
  ctx: ToggleHandlerContext,
): Promise<void> {
  e.preventDefault();

  const cartState = useCartStore.getState();
  const isInCart = cartState.items.some(i => i.packageId === card.packageId);

  if (card.isSyncMode) updateSyncedQuantity(card, cartState);

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

export async function addToCart(card: ToggleCard): Promise<void> {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
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
      const itemsPerPackage = (syncedItem as any).qty ?? 1;
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
      const itemsPerPackage = (syncedItem as any).qty ?? 1;
      totalSyncQuantity += syncedItem.quantity * itemsPerPackage;
    }
  });

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
