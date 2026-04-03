import { Decimal } from 'decimal.js';
import { useCampaignStore } from '@/stores/campaignStore';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import { TemplateRenderer } from '@/shared/utils/TemplateRenderer';
import type { Logger } from '@/utils/logger';
import type { SummaryLine } from '@/types/api';
import type { PackageDef, ToggleCard, TogglePriceSummary } from './PackageToggleEnhancer.types';

export function renderToggleTemplate(
  template: string,
  def: PackageDef,
  logger: Logger,
): HTMLElement | null {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === def.packageId);

  const toggleData: Record<string, string> = {};
  for (const [key, value] of Object.entries(def)) {
    toggleData[key] = value != null ? String(value) : '';
  }
  if (pkg) {
    toggleData['packageId'] ??= String(pkg.ref_id);
    toggleData['name'] ??= pkg.name ?? '';
    toggleData['image'] ??= pkg.image ?? '';
    toggleData['price'] ??= pkg.price ?? '';
    toggleData['priceRetail'] ??= pkg.price_retail ?? '';
    toggleData['priceRetailTotal'] ??= pkg.price_retail_total ?? '';
  }

  const html = TemplateRenderer.render(template, { data: { toggle: toggleData } });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const firstChild = wrapper.firstElementChild;
  const cardEl =
    wrapper.querySelector<HTMLElement>('[data-next-toggle-card]') ??
    (firstChild instanceof HTMLElement ? firstChild : null);

  if (!cardEl) {
    logger.warn('Toggle template produced no root element for packageId', def.packageId);
    return null;
  }

  cardEl.setAttribute('data-next-toggle-card', '');
  cardEl.setAttribute('data-next-package-id', String(def.packageId));
  if (def.selected) {
    cardEl.setAttribute('data-next-selected', 'true');
  }

  return cardEl;
}

export function renderToggleImage(card: ToggleCard): void {
  const slots = card.element.querySelectorAll<HTMLImageElement>('[data-next-toggle-image]');
  if (slots.length === 0) return;

  const pkg = (useCampaignStore.getState().data?.packages ?? []).find(
    p => p.ref_id === card.packageId,
  );
  if (!pkg?.image) return;

  slots.forEach(el => {
    el.src = pkg.image;
    if (!el.alt) el.alt = pkg.name ?? '';
  });
}

// ─── Card display elements ────────────────────────────────────────────────────

interface ToggleFieldData {
  togglePrice: TogglePriceSummary;
  isSelected: boolean;
  name: string;
}

function applyToggleField(el: HTMLElement, field: string, data: ToggleFieldData): void {
  const { togglePrice: tp, isSelected, name } = data;
  const currency = tp.currency || undefined;
  switch (field) {
    case 'price':
      el.textContent = formatCurrency(tp.price, currency);
      break;
    case 'originalPrice':
      el.textContent = tp.originalPrice != null ? formatCurrency(tp.originalPrice, currency) : '';
      break;
    case 'unitPrice':
      el.textContent = formatCurrency(tp.unitPrice, currency);
      break;
    case 'originalUnitPrice':
      el.textContent = tp.originalUnitPrice != null
        ? formatCurrency(tp.originalUnitPrice, currency)
        : '';
      break;
    case 'discountAmount':
      el.textContent = tp.hasDiscount ? formatCurrency(tp.discountAmount, currency) : '';
      break;
    case 'discountPercentage':
      el.textContent = formatPercentage(tp.discountPercentage);
      break;
    case 'hasDiscount':
      el.style.display = tp.hasDiscount ? '' : 'none';
      break;
    case 'isSelected':
      el.style.display = isSelected ? '' : 'none';
      break;
    case 'isRecurring':
      el.style.display = tp.isRecurring ? '' : 'none';
      break;
    case 'recurringPrice':
      el.textContent = tp.recurringPrice != null ? formatCurrency(tp.recurringPrice, currency) : '';
      break;
    case 'interval':
      el.textContent = tp.interval ?? '';
      break;
    case 'intervalCount':
      el.textContent = tp.intervalCount != null ? String(tp.intervalCount) : '';
      break;
    case 'frequency':
      el.textContent = tp.frequency;
      break;
    case 'name':
      el.textContent = name;
      break;
    case 'currency':
      el.textContent = tp.currency;
      break;
  }
}

/**
 * Updates all display elements inside a toggle card after a price fetch resolves.
 * Handles [data-next-toggle-display] (full field set) and the deprecated
 * [data-next-toggle-price] (legacy, price fields only). Fires toggle:price-updated
 * for PackageToggleDisplayEnhancer.
 */
export function updateCardDisplayElements(card: ToggleCard): void {
  const tp = card.togglePrice;
  if (!tp) return;

  const isSelected = card.element.getAttribute('data-next-selected') === 'true';
  const fieldData: ToggleFieldData = {
    togglePrice: tp,
    isSelected,
    name: card.name,
  };

  card.element.querySelectorAll<HTMLElement>('[data-next-toggle-display]').forEach(el => {
    const field = el.getAttribute('data-next-toggle-display') || 'price';
    applyToggleField(el, field, fieldData);
  });

  // Deprecated: kept for backward compatibility
  card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]').forEach(el => {
    const field = el.getAttribute('data-next-toggle-price') || 'price';
    applyToggleField(el, field, fieldData);
  });

  card.element.dispatchEvent(
    new CustomEvent('toggle:price-updated', {
      bubbles: true,
      detail: { packageId: card.packageId },
    }),
  );
}

/**
 * Updates card.togglePrice from a SummaryLine (API data) then calls
 * updateCardDisplayElements to push the new state to the DOM.
 */
export function renderTogglePrice(card: ToggleCard, line: SummaryLine): void {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === card.packageId);

  const price = new Decimal(line.total);
  const unitPrice = new Decimal(line.package_price);
  const originalPrice = new Decimal(line.subtotal);
  const originalUnitPrice = new Decimal(line.original_package_price);
  const discountAmount = new Decimal(line.total_discount);
  const recurringPrice = line.price_recurring_total != null
    ? new Decimal(line.price_recurring_total)
    : null;

  const hasDiscount = discountAmount.gt(0);
  const discountPercentage = hasDiscount && originalPrice.gt(0)
    ? discountAmount.div(originalPrice).times(100)
    : new Decimal(0);

  const currency = useCampaignStore.getState().currency ?? '';
  const isRecurring = pkg?.is_recurring ?? false;
  const interval = pkg?.interval ?? null;
  const intervalCount = pkg?.interval_count ?? null;
  const frequency = isRecurring
    ? intervalCount != null && intervalCount > 1
      ? `Every ${intervalCount} ${interval}s`
      : `Per ${interval}`
    : 'One time';

  card.togglePrice = {
    price: price.toNumber(),
    unitPrice: unitPrice.toNumber(),
    originalPrice: originalPrice.toNumber(),
    originalUnitPrice: originalUnitPrice.toNumber(),
    discountAmount: hasDiscount ? discountAmount.toNumber() : 0,
    discountPercentage: discountPercentage.toNumber(),
    hasDiscount,
    currency,
    isRecurring,
    recurringPrice: recurringPrice?.toNumber() ?? null,
    interval,
    intervalCount,
    frequency,
  };

  updateCardDisplayElements(card);
}
