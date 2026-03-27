import { useCartStore } from '@/stores/cartStore';
import type { SelectorItem } from '@/types/global';
import type { SelectorHandlerContext } from './PackageSelectorEnhancer.types';

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

export function setupQuantityControls(
  item: SelectorItem,
  ctx: SelectorHandlerContext,
  quantityHandlers: Map<HTMLElement, (e: Event) => void>,
): void {
  const el = item.element;
  const increaseBtn = el.querySelector<HTMLElement>('[data-next-quantity-increase]');
  const decreaseBtn = el.querySelector<HTMLElement>('[data-next-quantity-decrease]');
  const displayEl = el.querySelector<HTMLElement>('[data-next-quantity-display]');

  if (!increaseBtn && !decreaseBtn) return;

  const min = parseInt(el.getAttribute('data-next-min-quantity') ?? '1', 10);
  const max = parseInt(el.getAttribute('data-next-max-quantity') ?? '999', 10);

  const updateDisplay = () => {
    if (displayEl) displayEl.textContent = String(item.quantity);
    el.setAttribute('data-next-quantity', String(item.quantity));
    if (decreaseBtn) {
      const atMin = item.quantity <= min;
      decreaseBtn.toggleAttribute('disabled', atMin);
      decreaseBtn.classList.toggle('next-disabled', atMin);
    }
    if (increaseBtn) {
      const atMax = item.quantity >= max;
      increaseBtn.toggleAttribute('disabled', atMax);
      increaseBtn.classList.toggle('next-disabled', atMax);
    }
  };

  if (increaseBtn) {
    const h = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.quantity < max) {
        item.quantity++;
        updateDisplay();
        void handleQuantityChange(item, ctx);
      }
    };
    quantityHandlers.set(increaseBtn, h);
    increaseBtn.addEventListener('click', h);
  }

  if (decreaseBtn) {
    const h = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      if (item.quantity > min) {
        item.quantity--;
        updateDisplay();
        void handleQuantityChange(item, ctx);
      }
    };
    quantityHandlers.set(decreaseBtn, h);
    decreaseBtn.addEventListener('click', h);
  }

  updateDisplay();
}
