import { useCampaignStore } from '@/state/campaign';
import { setupQuantityControls } from '@/features/cart/shared/quantity-controls';
import type {
  BundleCard,
  BundleItem,
  BundlePackageState,
  BundleSlot,
  CardRegistrationContext,
} from './bundle-selector.types';
import { renderSlotsForCard } from './bundle-selector.renderer';
import {
  handleCardClick,
  applyBundleQuantityChange,
} from './bundle-selector.handlers';
import { parseVouchers, makePackageState } from './bundle-selector.state';

/**
 * Discovers `[data-next-bundle-card]` elements under `container` that aren't
 * already registered and registers each one.
 */
export function scanCards(
  container: HTMLElement,
  cards: BundleCard[],
  ctx: CardRegistrationContext
): void {
  container
    .querySelectorAll<HTMLElement>('[data-next-bundle-card]')
    .forEach(el => {
      if (!cards.find(c => c.element === el)) registerCard(el, cards, ctx);
    });
}

/**
 * Parses a bundle card element's attributes into a `BundleCard`, pushes it
 * onto `cards`, and wires its click handler and inline quantity stepper.
 * Bails out (leaving `cards` unchanged) when required attributes are
 * missing or malformed.
 */
export function registerCard(
  el: HTMLElement,
  cards: BundleCard[],
  ctx: CardRegistrationContext
): void {
  const bundleId = el.getAttribute('data-next-bundle-id');
  if (!bundleId) {
    ctx.logger.warn('Bundle card is missing data-next-bundle-id', el);
    return;
  }

  const itemsAttr = el.getAttribute('data-next-bundle-items');
  if (!itemsAttr) {
    ctx.logger.warn(
      `Bundle card "${bundleId}" is missing data-next-bundle-items`,
      el
    );
    return;
  }

  let items: BundleItem[];
  try {
    items = JSON.parse(itemsAttr);
  } catch {
    ctx.logger.warn(
      `Invalid JSON in data-next-bundle-items for bundle "${bundleId}"`,
      el
    );
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    ctx.logger.warn(`Bundle "${bundleId}" has no items`, el);
    return;
  }

  const name = el.getAttribute('data-next-bundle-name') ?? '';
  const isPreSelected = el.getAttribute('data-next-selected') === 'true';
  const vouchers = parseVouchers(
    el.getAttribute('data-next-bundle-vouchers'),
    ctx.logger
  );
  const shippingId = el.getAttribute('data-next-shipping-id') ?? undefined;

  // Bundle-level quantity. Defaults preserve today's behavior when the
  // new attrs are absent: multiplier = 1, stepper stays disabled because
  // no stepper controls exist in the DOM.
  const parsePositiveInt = (attr: string | null, fallback: number): number => {
    const n = attr != null ? parseInt(attr, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const minQuantity = parsePositiveInt(
    el.getAttribute('data-next-min-quantity'),
    1
  );
  const maxQuantity = parsePositiveInt(
    el.getAttribute('data-next-max-quantity'),
    999
  );
  const initialQty = parsePositiveInt(el.getAttribute('data-next-quantity'), 1);
  const bundleQuantity = Math.min(
    Math.max(initialQty, minQuantity),
    maxQuantity
  );

  const slots: BundleSlot[] = [];
  let slotIdx = 0;
  for (const item of items) {
    if (item.configurable && item.quantity > 1) {
      for (let u = 0; u < item.quantity; u++) {
        slots.push({
          slotIndex: slotIdx++,
          unitIndex: u,
          originalPackageId: item.packageId,
          activePackageId: item.packageId,
          quantity: 1,
          noSlot: item.noSlot,
          excludeProperties: item.excludeProperties,
          configurable: true,
          variantSelected: false,
        });
      }
    } else {
      slots.push({
        slotIndex: slotIdx++,
        unitIndex: 0,
        originalPackageId: item.packageId,
        activePackageId: item.packageId,
        quantity: item.quantity,
        noSlot: item.noSlot,
        excludeProperties: item.excludeProperties,
        configurable: !!item.configurable,
        variantSelected: false,
      });
    }
  }

  // Populate bundle-owned package states from campaign packages (provisional baseline)
  const allPackages = useCampaignStore.getState().packages ?? [];
  const packageStates = new Map<number, BundlePackageState>();
  for (const slot of slots) {
    if (!packageStates.has(slot.activePackageId)) {
      const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
      if (pkg) packageStates.set(slot.activePackageId, makePackageState(pkg));
    }
  }

  // A configurable slot whose initial package already has specific variant
  // attribute values is already a concrete selection — mark it as selected so
  // _getSelectedBundleItems() doesn't block submission before the user
  // interacts with any dropdown.
  for (const slot of slots) {
    if (slot.configurable && !slot.variantSelected) {
      const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
      if ((pkg?.product_variant_attribute_values?.length ?? 0) > 0) {
        slot.variantSelected = true;
      }
    }
  }

  const card: BundleCard = {
    element: el,
    bundleId,
    name,
    items,
    slots,
    isPreSelected,
    vouchers,
    shippingId,
    packageStates,
    bundlePrice: null,
    slotVarsCache: new Map(),
    offerDiscounts: [],
    voucherDiscounts: [],
    bundleQuantity,
    minQuantity,
    maxQuantity,
    qtyDebounceTimeout: null,
  };
  cards.push(card);
  el.classList.add(ctx.classNames.bundleCard);

  if (ctx.slotTemplate) {
    renderSlotsForCard(card, ctx.makeRenderContext());
  }

  const handler = (e: Event) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'select, [data-next-variant-option], [data-next-quantity-increase], [data-next-quantity-decrease], [data-next-quantity-display]'
      )
    ) {
      return;
    }
    const handlerCtx = ctx.makeHandlerContext();
    void handleCardClick(e, card, handlerCtx.getSelectedCard(), handlerCtx);
  };
  ctx.clickHandlers.set(el, handler);
  el.addEventListener('click', handler);

  // Wire inline bundle-quantity controls. Host lookup covers three locations:
  // the card element itself, the external slots container (for pages that
  // render slots outside the selector), and any element marked
  // `[data-next-bundle-qty-for="{selectorId}"]` (for steppers sitting
  // entirely outside both — e.g. a product-detail page where the selector
  // is hidden and the stepper lives next to an Add-to-Cart button).
  const hostEls: HTMLElement[] = [el];
  if (ctx.externalSlotsEl) hostEls.push(ctx.externalSlotsEl);
  if (ctx.selectorId) {
    document
      .querySelectorAll<HTMLElement>(
        `[data-next-bundle-qty-for="${ctx.selectorId}"]`
      )
      .forEach(host => {
        if (!hostEls.includes(host)) hostEls.push(host);
      });
  }
  const refresh = setupQuantityControls({
    hostEls,
    getQty: () => card.bundleQuantity,
    setQty: n => {
      card.bundleQuantity = n;
    },
    min: minQuantity,
    max: maxQuantity,
    onChange: () => {
      void applyBundleQuantityChange(card, ctx.makeHandlerContext());
    },
    handlers: ctx.quantityHandlers,
  });
  ctx.quantityRefreshers.set(el, refresh);

  ctx.logger.debug(`Registered bundle card "${bundleId}"`, {
    itemCount: items.length,
  });
}
