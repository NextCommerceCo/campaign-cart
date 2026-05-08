import { useCartStore } from '@/stores/cartStore';
import type { SelectorItem } from '@/types/global';
import type { SelectorHandlerContext } from './PackageSelectorEnhancer.types';
import { setupQuantityControls as setupSharedQuantityControls } from '@/enhancers/cart/shared/quantityControls';

export function selectItem(item: SelectorItem, ctx: SelectorHandlerContext): void {
  for (const i of ctx.items) {
    i.element.classList.remove('next-selected');
    i.element.setAttribute('data-next-selected', 'false');
  }
  item.element.classList.add('next-selected');
  item.element.setAttribute('data-next-selected', 'true');
  ctx.selectedItemRef.value = item;
  ctx.element.setAttribute('data-selected-package', String(item.packageId));

  ctx.emit('selector:selection-changed', {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    quantity: item.quantity,
    item,
  });
}

export async function handleCardClick(
  e: Event,
  item: SelectorItem,
  ctx: SelectorHandlerContext,
): Promise<void> {
  e.preventDefault();
  if (ctx.selectedItemRef.value === item) return;

  const previous = ctx.selectedItemRef.value;
  selectItem(item, ctx);

  ctx.emit('selector:item-selected', {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    previousPackageId: previous?.packageId,
    mode: ctx.mode,
    pendingAction: ctx.mode === 'select' ? true : undefined,
  });

  if (ctx.mode === 'swap') {
    await updateCart(previous, item, ctx.items);
    if (item.shippingId) await setShippingMethod(item.shippingId, ctx);
  }
}

export async function updateCart(
  previous: SelectorItem | null,
  selected: SelectorItem,
  items: SelectorItem[],
): Promise<void> {
  const cartStore = useCartStore.getState();

  const existingCartItem = cartStore.items.find(ci =>
    items.some(
      si => ci.packageId === si.packageId || ci.originalPackageId === si.packageId
    )
  );

  if (existingCartItem) {
    if (existingCartItem.packageId !== selected.packageId) {
      await cartStore.swapPackage(existingCartItem.packageId, {
        packageId: selected.packageId,
        quantity: selected.quantity,
        isUpsell: false,
      });
    }
  } else if (!cartStore.hasItem(selected.packageId)) {
    await cartStore.addItem({
      packageId: selected.packageId,
      quantity: selected.quantity,
      isUpsell: false,
    });
  }
}

export async function setShippingMethod(
  shippingId: string,
  ctx: Pick<SelectorHandlerContext, 'logger'>,
): Promise<void> {
  const id = parseInt(shippingId, 10);
  if (isNaN(id)) {
    ctx.logger.warn('Invalid shipping ID:', shippingId);
    return;
  }
  await useCartStore.getState().setShippingMethod(id);
}

export async function handleQuantityChange(
  item: SelectorItem,
  ctx: SelectorHandlerContext,
): Promise<void> {
  ctx.emit('selector:quantity-changed', {
    selectorId: ctx.selectorId,
    packageId: item.packageId,
    quantity: item.quantity,
  });

  if (ctx.selectedItemRef.value === item && ctx.mode === 'swap') {
    const cartStore = useCartStore.getState();
    if (cartStore.hasItem(item.packageId)) {
      await cartStore.updateQuantity(item.packageId, item.quantity);
    } else {
      await cartStore.addItem({
        packageId: item.packageId,
        quantity: item.quantity,
        isUpsell: false,
      });
    }
  }
}

/**
 * Wire inline per-card quantity controls onto a SelectorItem.
 * Thin wrapper around the shared stepper util; attribute naming
 * (`data-next-quantity-increase` / `-decrease` / `-display`,
 * `data-next-min-quantity` / `-max-quantity`) stays identical to the
 * pre-refactor behavior.
 */
export function setupQuantityControls(
  item: SelectorItem,
  ctx: SelectorHandlerContext,
  quantityHandlers: Map<HTMLElement, (e: Event) => void>,
): void {
  const el = item.element;
  const min = parseInt(el.getAttribute('data-next-min-quantity') ?? '1', 10);
  const max = parseInt(el.getAttribute('data-next-max-quantity') ?? '999', 10);

  setupSharedQuantityControls({
    hostEls: [el],
    getQty: () => item.quantity,
    setQty: n => {
      item.quantity = n;
    },
    min,
    max,
    onChange: () => {
      void handleQuantityChange(item, ctx);
    },
    handlers: quantityHandlers,
  });
}
