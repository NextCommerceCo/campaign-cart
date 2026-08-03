import type { Logger } from '@/core/logger';
import { formatCurrency, formatPercentage } from '@/core/currency-formatter';
import type {
  BundleCard,
  BundleDef,
  BundlePriceSummary,
  RenderContext,
} from './bundle-selector.types';
import {
  renderDiscountContainers,
  replaceVarsPreservingTemplates,
} from '@/core/rendering/discount-renderer';
import { renderSlotsForCard } from './bundle-selector.slot-renderer';

// Re-exported for callers/tests that import these from this module's original
// location — the implementations now live alongside the rest of slot and
// variant rendering (avoids a renderer.ts <-> slot-renderer.ts import cycle,
// since buildSlotVars is only ever consumed from within renderSlotsForCard).
export { buildSlotVars } from './bundle-selector.slot-renderer';
export { isVariantValueAvailable } from './bundle-selector.variant-renderer';

// ─── Bundle card template ─────────────────────────────────────────────────────

export function renderBundleTemplate(
  template: string,
  bundle: BundleDef,
  logger: Logger
): HTMLElement | null {
  const visibleItems = bundle.items.filter(item => !item.noSlot);
  const itemCount = visibleItems.length;
  const totalQuantity = visibleItems.reduce(
    (sum, item) => sum + (item.quantity ?? 1),
    0
  );

  const vars: Record<string, string> = {
    'bundle.itemCount': String(itemCount),
    'bundle.totalQuantity': String(totalQuantity),
  };
  for (const [key, value] of Object.entries(bundle)) {
    if (key !== 'items' && key !== 'selected') {
      vars[`bundle.${key}`] = value != null ? String(value) : '';
    }
  }

  const html = replaceVarsPreservingTemplates(template, vars);
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const firstChild = wrapper.firstElementChild;
  const cardEl =
    wrapper.querySelector<HTMLElement>('[data-next-bundle-card]') ??
    (firstChild instanceof HTMLElement ? firstChild : null);

  if (!cardEl) {
    logger.warn(
      'Bundle template produced no root element for bundle',
      bundle.id
    );
    return null;
  }

  cardEl.setAttribute('data-next-bundle-card', '');
  cardEl.setAttribute('data-next-bundle-id', bundle.id);
  cardEl.setAttribute('data-next-bundle-items', JSON.stringify(bundle.items));
  if (bundle.selected) {
    cardEl.setAttribute('data-next-selected', 'true');
  }
  if (bundle.vouchers?.length) {
    cardEl.setAttribute(
      'data-next-bundle-vouchers',
      JSON.stringify(bundle.vouchers)
    );
  }
  if (bundle.shippingId) {
    cardEl.setAttribute('data-next-shipping-id', bundle.shippingId);
  }
  // Mirror bundle-level quantity fields onto the card element so the
  // enhancer picks them up on registerCard. Absent fields keep today's
  // defaults (bundleQuantity=1, min=1, max=999).
  if (bundle.quantity != null) {
    cardEl.setAttribute('data-next-quantity', String(bundle.quantity));
  }
  if (bundle.minQuantity != null) {
    cardEl.setAttribute('data-next-min-quantity', String(bundle.minQuantity));
  }
  if (bundle.maxQuantity != null) {
    cardEl.setAttribute('data-next-max-quantity', String(bundle.maxQuantity));
  }

  return cardEl;
}

// ─── Card display elements ────────────────────────────────────────────────────

interface BundleFieldData {
  bundlePrice: BundlePriceSummary;
  isSelected: boolean;
  name: string;
}

function applyBundleField(
  el: HTMLElement,
  field: string,
  data: BundleFieldData
): void {
  const { bundlePrice, isSelected, name } = data;
  const currency = bundlePrice.currency || undefined;
  switch (field) {
    case 'price':
    case 'total':
      el.textContent = formatCurrency(bundlePrice.price.toNumber(), currency);
      break;
    case 'compare':
    case 'originalPrice':
      el.textContent = formatCurrency(
        bundlePrice.originalPrice.toNumber(),
        currency
      );
      break;
    case 'savings':
    case 'discountAmount':
      el.textContent = formatCurrency(
        bundlePrice.discountAmount.toNumber(),
        currency
      );
      break;
    case 'unitPrice':
      el.textContent = formatCurrency(
        bundlePrice.unitPrice.toNumber(),
        currency
      );
      break;
    case 'originalUnitPrice':
      el.textContent = formatCurrency(
        bundlePrice.originalUnitPrice.toNumber(),
        currency
      );
      break;
    case 'savingsPercentage':
    case 'discountPercentage':
      el.textContent = formatPercentage(
        bundlePrice.discountPercentage.toNumber()
      );
      break;
    case 'isSelected':
      el.style.display = isSelected ? '' : 'none';
      break;
    case 'hasDiscount':
    case 'hasSavings':
      el.style.display = bundlePrice.hasDiscount ? '' : 'none';
      break;
    case 'name':
      el.textContent = name;
      break;
    case 'currency':
      el.textContent = bundlePrice.currency;
      break;
  }
}

/**
 * Updates all display elements inside a bundle card after a price fetch resolves.
 * Handles [data-next-bundle-display] (full field set) and the deprecated
 * [data-next-bundle-price] (legacy, price fields only). Fires bundle:price-updated
 * for BundleDisplayEnhancer.
 */
export function updateCardDisplayElements(
  card: BundleCard,
  bundlePrice: BundlePriceSummary
): void {
  const isSelected = card.element.getAttribute('data-next-selected') === 'true';
  const fieldData: BundleFieldData = {
    bundlePrice,
    isSelected,
    name: card.name,
  };

  card.element
    .querySelectorAll<HTMLElement>('[data-next-bundle-display]')
    .forEach(el => {
      const field = el.getAttribute('data-next-bundle-display') ?? 'price';
      applyBundleField(el, field, fieldData);
    });

  // Deprecated: kept for backward compatibility
  card.element
    .querySelectorAll<HTMLElement>('[data-next-bundle-price]')
    .forEach(el => {
      const field = el.getAttribute('data-next-bundle-price') ?? 'total';
      applyBundleField(el, field, fieldData);
    });

  renderDiscountContainers(card.element, {
    offerDiscounts: card.offerDiscounts,
    voucherDiscounts: card.voucherDiscounts,
  });

  card.element.dispatchEvent(
    new CustomEvent('bundle:price-updated', {
      bubbles: true,
      detail: {
        selectorId: card.element.getAttribute('data-next-bundle-id') ?? '',
      },
    })
  );
}

// ─── Auto-render from JSON ──────────────────────────────────────────────────────

/**
 * Auto-renders bundle card elements from the `data-next-bundles` JSON
 * attribute into `element`, replacing its current contents.
 */
export function autoRenderBundleCards(
  element: HTMLElement,
  bundlesAttr: string,
  template: string,
  logger: Logger
): void {
  try {
    const parsed: unknown = JSON.parse(bundlesAttr);
    if (!Array.isArray(parsed)) {
      logger.warn(
        'data-next-bundles must be a JSON array, ignoring auto-render'
      );
    } else {
      element.innerHTML = '';
      for (const def of parsed as BundleDef[]) {
        const el = renderBundleTemplate(template, def, logger);
        if (el) element.appendChild(el);
      }
    }
  } catch {
    logger.warn(
      'Invalid JSON in data-next-bundles, ignoring auto-render',
      bundlesAttr
    );
  }
}

// ─── Price-driven DOM updates ───────────────────────────────────────────────────

/**
 * Updates all DOM that depends on calculated prices: slot `{item.xxx}`
 * variables, `[data-next-bundle-display]` elements, and the
 * `bundle:price-updated` event consumed by BundleDisplayEnhancer.
 */
export function relenderVariables(
  card: BundleCard,
  slotTemplate: string,
  renderCtx: RenderContext,
  externalSlotsEl: HTMLElement | null,
  selectedCard: BundleCard | null,
  selectorId: string | null
): void {
  if (slotTemplate) {
    renderSlotsForCard(card, renderCtx);
    if (externalSlotsEl && card === selectedCard) {
      renderSlotsForCard(card, renderCtx, externalSlotsEl);
    }
  }
  if (card.bundlePrice) {
    updateCardDisplayElements(card, card.bundlePrice);
    // When a selectorId is set, BundleDisplayEnhancer may use
    // "bundle.{selectorId}.property" — fire an additional event so those
    // displays update when the selected card's price resolves.
    if (selectorId && card === selectedCard) {
      document.dispatchEvent(
        new CustomEvent('bundle:price-updated', {
          detail: { selectorId },
        })
      );
    }
  }
}
