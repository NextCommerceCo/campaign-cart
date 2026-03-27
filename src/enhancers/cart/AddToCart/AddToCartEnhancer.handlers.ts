import { useCartStore } from '@/stores/cartStore';
import { preserveQueryParams } from '@/utils/url-utils';
import type { SelectorItem } from '@/types/global';
import type { AddToCartHandlerContext, SelectorEvent } from './AddToCartEnhancer.types';

export function handleSelectorChange(
  event: SelectorEvent,
  findSelectorElement: () => HTMLElement | null,
  getSelectedItemFromElement: (el: HTMLElement) => SelectorItem | null,
  ctx: AddToCartHandlerContext,
): void {
  if (event.selectorId !== ctx.selectorId) return;

  const el = findSelectorElement();
  if (el) {
    ctx.selectedItemRef.value = getSelectedItemFromElement(el);
  } else if (event.item) {
    ctx.selectedItemRef.value = event.item;
  } else if (event.packageId !== undefined) {
    ctx.selectedItemRef.value = {
      packageId: event.packageId,
      quantity: event.quantity ?? 1,
      element: null as unknown as HTMLElement,
      price: undefined,
      name: undefined,
      isPreSelected: false,
      shippingId: undefined,
    };
  } else {
    ctx.selectedItemRef.value = null;
  }

  ctx.updateButtonState();
}

export async function addToCart(
  packageId: number,
  quantity: number,
  ctx: AddToCartHandlerContext,
): Promise<void> {
  const cartStore = useCartStore.getState();

  if (ctx.clearCart) {
    ctx.logger.debug('Clearing cart before adding item');
    await cartStore.clear();
  }

  await cartStore.addItem({ packageId, quantity, isUpsell: undefined });

  ctx.emit('cart:item-added', {
    packageId,
    quantity,
    source: ctx.selectorId ? 'selector' : 'direct',
  });

  if (ctx.redirectUrl) {
    const finalUrl = preserveQueryParams(ctx.redirectUrl);
    ctx.logger.debug('Redirecting to:', finalUrl);
    window.location.href = finalUrl;
  }
}
