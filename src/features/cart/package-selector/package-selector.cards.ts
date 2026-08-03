import { useCartStore } from '@/state/cart';
import { useCampaignStore } from '@/state/campaign';
import type { SelectorItem } from '@/types/global';
import type { SelectorHandlerContext } from './package-selector.types';
import {
  handleCardClick,
  selectItem,
  updateCart,
  setupQuantityControls,
} from './package-selector.handlers';
import { syncWithCart } from './package-selector.display';

type HandlerMap = Map<HTMLElement, (e: Event) => void>;

// ─── Card discovery & registration ─────────────────────────────────────────

export function scanCards(
  ctx: SelectorHandlerContext,
  clickHandlers: HandlerMap,
  quantityHandlers: HandlerMap
): void {
  ctx.element
    .querySelectorAll<HTMLElement>('[data-next-selector-card]')
    .forEach(el => {
      if (!ctx.items.find(i => i.element === el))
        registerCard(el, ctx, clickHandlers, quantityHandlers);
    });
}

export function registerCard(
  el: HTMLElement,
  ctx: SelectorHandlerContext,
  clickHandlers: HandlerMap,
  quantityHandlers: HandlerMap
): void {
  const packageIdAttr = el.getAttribute('data-next-package-id');
  if (!packageIdAttr) {
    ctx.logger.warn('Selector card is missing data-next-package-id', el);
    return;
  }
  const packageId = parseInt(packageIdAttr, 10);
  if (isNaN(packageId)) {
    ctx.logger.warn(
      'Invalid data-next-package-id on selector card',
      packageIdAttr
    );
    return;
  }

  const existing = ctx.items.find(i => i.element === el);
  if (existing) {
    existing.packageId = packageId;
    existing.quantity = parseInt(
      el.getAttribute('data-next-quantity') ?? '1',
      10
    );
    existing.shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;
    updateItemPackageData(existing);
    return;
  }

  const quantity = parseInt(el.getAttribute('data-next-quantity') ?? '1', 10);
  const isPreSelected = el.getAttribute('data-next-selected') === 'true';
  const shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;

  const pkg = useCampaignStore.getState().getPackage(packageId);
  const item: SelectorItem = {
    element: el,
    packageId,
    quantity,
    price: pkg?.price ? parseFloat(pkg.price) : undefined,
    name: pkg?.name ?? `Package ${packageId}`,
    isPreSelected,
    shippingId,
  };

  ctx.items.push(item);
  el.classList.add('next-selector-card');

  const handler = (e: Event) => void handleCardClick(e, item, ctx);
  clickHandlers.set(el, handler);
  el.addEventListener('click', handler);

  setupQuantityControls(item, ctx, quantityHandlers);

  ctx.logger.debug(`Registered selector card for package ${packageId}`);
}

export function updateItemPackageData(item: SelectorItem): void {
  const pkg = useCampaignStore.getState().getPackage(item.packageId);
  if (pkg) {
    item.price = pkg.price ? parseFloat(pkg.price) : item.price;
    item.name = pkg.name ?? item.name;
  }
}

// ─── Mutation-driven updates ────────────────────────────────────────────────

export function handlePackageIdChange(
  el: HTMLElement,
  ctx: SelectorHandlerContext,
  clickHandlers: HandlerMap,
  quantityHandlers: HandlerMap
): void {
  const item = ctx.items.find(i => i.element === el);
  if (!item) {
    registerCard(el, ctx, clickHandlers, quantityHandlers);
    return;
  }
  const newIdAttr = el.getAttribute('data-next-package-id');
  if (!newIdAttr) return;
  const newId = parseInt(newIdAttr, 10);
  const oldId = item.packageId;
  if (newId === oldId) return;

  item.packageId = newId;
  item.quantity = parseInt(el.getAttribute('data-next-quantity') ?? '1', 10);
  item.shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;
  updateItemPackageData(item);

  if (ctx.selectedItemRef.value === item && ctx.mode === 'swap') {
    void updateCart({ ...item, packageId: oldId }, item, ctx.items);
  }

  syncWithCart(useCartStore.getState(), ctx);
}

export function handleCardRemoval(
  el: HTMLElement,
  ctx: SelectorHandlerContext,
  clickHandlers: HandlerMap,
  quantityHandlers: HandlerMap
): void {
  const toRemove: HTMLElement[] = [];
  if (el.hasAttribute('data-next-selector-card')) toRemove.push(el);
  el.querySelectorAll<HTMLElement>('[data-next-selector-card]').forEach(c =>
    toRemove.push(c)
  );

  for (const cardEl of toRemove) {
    const idx = ctx.items.findIndex(i => i.element === cardEl);
    if (idx === -1) continue;
    const removed = ctx.items[idx];

    const ch = clickHandlers.get(cardEl);
    if (ch) {
      cardEl.removeEventListener('click', ch);
      clickHandlers.delete(cardEl);
    }

    for (const btn of [
      cardEl.querySelector<HTMLElement>('[data-next-quantity-increase]'),
      cardEl.querySelector<HTMLElement>('[data-next-quantity-decrease]'),
    ]) {
      if (!btn) continue;
      const h = quantityHandlers.get(btn);
      if (h) {
        btn.removeEventListener('click', h);
        quantityHandlers.delete(btn);
      }
    }

    ctx.items.splice(idx, 1);

    if (ctx.selectedItemRef.value === removed) {
      ctx.selectedItemRef.value = null;
      ctx.element.removeAttribute('data-selected-package');
    }
  }
}

// ─── Upsell context: pre-select default item without touching cart ────────

export function initializeSelection(ctx: SelectorHandlerContext): void {
  if (ctx.selectedItemRef.value) return;
  const preSelected = ctx.items.find(i => i.isPreSelected) ?? ctx.items[0];
  if (preSelected) selectItem(preSelected, ctx);
}
