import { Decimal } from 'decimal.js';
import { useCampaignStore } from '@/stores/campaignStore';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import { TemplateRenderer } from '@/shared/utils/TemplateRenderer';
import type { Logger } from '@/utils/logger';
import type { SummaryLine } from '@/types/api';
import type { PackageDef, ToggleCard } from './PackageToggleEnhancer.types';
import { makeProvisionalPrices } from './PackageToggleEnhancer.state';
import { renderFlatDiscountContainers } from '@/shared/utils/discountRenderer';
import { applySlotConditionals, isTruthyVar } from '@/shared/utils/slotConditionals';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Fields that toggle element visibility rather than setting text content. */
const VISIBILITY_FIELDS = new Set(['hasDiscount', 'isSelected', 'isRecurring']);

// ─── Template vars builder ────────────────────────────────────────────────────

/**
 * Single source of truth for all toggle card template variables.
 *
 * Used by both renderToggleTemplate (initial render) and updateCardDisplayElements
 * (live DOM updates). def fields take priority — callers can override any
 * pkg-derived value by including it in the PackageDef JSON.
 */
export function buildToggleVars(
  def: PackageDef,
  card: Omit<ToggleCard, 'element' | 'isPreSelected' | 'isSyncMode' | 'syncPackageIds' | 'isUpsell' | 'stateContainer' | 'addText' | 'removeText' | 'discounts'>,
): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(def)) {
    vars[key] = value != null ? String(value) : '';
  }

  const currency = card.currency || undefined;

  // Card fields
  vars['packageId'] ??= String(card.packageId);
  vars['name'] ??= card.name;
  vars['image'] ??= card.image;
  vars['quantity'] ??= String(card.quantity);
  vars['productId'] ??= card.productId != null ? String(card.productId) : '';
  vars['variantId'] ??= card.variantId != null ? String(card.variantId) : '';
  vars['variantName'] ??= card.variantName;
  vars['productName'] ??= card.productName;
  vars['sku'] ??= card.sku ?? '';

  // Price + recurring fields
  vars['isRecurring'] ??= String(card.isRecurring);
  vars['interval'] ??= card.interval ?? '';
  vars['intervalCount'] ??= card.intervalCount != null
    ? String(card.intervalCount) : '';
  vars['frequency'] ??= card.frequency;
  vars['price'] ??= formatCurrency(card.price, currency);
  vars['originalPrice'] ??= card.originalPrice != null
    ? formatCurrency(card.originalPrice, currency) : '';
  vars['unitPrice'] ??= formatCurrency(card.unitPrice, currency);
  vars['originalUnitPrice'] ??= card.originalUnitPrice != null
    ? formatCurrency(card.originalUnitPrice, currency) : '';
  vars['discountAmount'] ??= card.hasDiscount
    ? formatCurrency(card.discountAmount, currency) : '';
  vars['discountPercentage'] ??= formatPercentage(card.discountPercentage);
  vars['hasDiscount'] ??= String(card.hasDiscount);
  vars['recurringPrice'] ??= card.recurringPrice != null
    ? formatCurrency(card.recurringPrice, currency) : '';
  vars['originalRecurringPrice'] ??= card.originalRecurringPrice != null
    ? formatCurrency(card.originalRecurringPrice, currency) : '';
  vars['currency'] ??= card.currency;

  // Selection state
  vars['isSelected'] ??= String(card.isSelected);

  return vars;
}

// ─── Card template ────────────────────────────────────────────────────────────

export function renderToggleTemplate(
  template: string,
  def: PackageDef,
  logger: Logger,
): HTMLElement | null {
  const allPackages = useCampaignStore.getState().data?.packages ?? [];
  const pkg = allPackages.find(p => p.ref_id === def.packageId);
  if (!pkg) {
    logger.warn('No campaign package found for packageId', def.packageId);
    return null;
  }
  const toggleData = buildToggleVars(def, {
    packageId: pkg.ref_id,
    name: pkg.name || '',
    image: pkg.image || '',
    quantity: pkg.qty,
    productId: pkg.product_id ?? null,
    variantId: pkg.product_variant_id ?? null,
    variantName: pkg.product_variant_name || '',
    productName: pkg.product_name || '',
    sku: pkg.product_sku ?? null,
    isSelected: def.selected ?? false,
    ...makeProvisionalPrices(pkg),
  });

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

  applySlotConditionals(cardEl, toggleData);

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

/** Apply a single var to a DOM element — visibility toggle or text/image. */
function applyDisplayVar(
  el: HTMLElement,
  field: string,
  vars: Record<string, string>,
): void {
  const value = vars[field];
  if (value === undefined) return;

  if (VISIBILITY_FIELDS.has(field)) {
    el.style.display = isTruthyVar(value) ? '' : 'none';
    return;
  }

  if (field === 'image' && el instanceof HTMLImageElement) {
    el.src = value;
    if (!el.alt) el.alt = vars['name'] ?? '';
    return;
  }

  el.textContent = value;
}

/**
 * Updates all display elements inside a toggle card.
 * Handles [data-next-toggle-display] (full field set) and the deprecated
 * [data-next-toggle-price] (legacy, price fields only). Fires toggle:price-updated
 * for PackageToggleDisplayEnhancer.
 */
export function updateCardDisplayElements(card: ToggleCard): void {
  const vars = buildToggleVars({ packageId: card.packageId }, card);

  card.element.querySelectorAll<HTMLElement>('[data-next-toggle-display]').forEach(el => {
    const field = el.getAttribute('data-next-toggle-display') || 'price';
    applyDisplayVar(el, field, vars);
  });

  // Deprecated: kept for backward compatibility
  card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]').forEach(el => {
    const field = el.getAttribute('data-next-toggle-price') || 'price';
    applyDisplayVar(el, field, vars);
  });

  renderFlatDiscountContainers(card.element, card.discounts);

  card.element.dispatchEvent(
    new CustomEvent('toggle:price-updated', {
      bubbles: true,
      detail: { packageId: card.packageId },
    }),
  );
}

/**
 * Updates card price fields from a SummaryLine (API data) then calls
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
  const originalRecurringPrice = line.original_recurring_price != null
    ? new Decimal(line.original_recurring_price)
    : null;

  const hasDiscount = discountAmount.gt(0);
  const discountPercentage = hasDiscount && originalPrice.gt(0)
    ? discountAmount.div(originalPrice).times(100)
    : new Decimal(0);

  card.price = price.toNumber();
  card.unitPrice = unitPrice.toNumber();
  card.originalPrice = originalPrice.toNumber();
  card.originalUnitPrice = originalUnitPrice.toNumber();
  card.discountAmount = hasDiscount ? discountAmount.toNumber() : 0;
  card.discountPercentage = discountPercentage.toNumber();
  card.hasDiscount = hasDiscount;
  card.currency = useCampaignStore.getState().currency ?? '';
  card.isRecurring = pkg?.is_recurring ?? false;
  card.recurringPrice = recurringPrice?.toNumber() ?? null;
  card.originalRecurringPrice = originalRecurringPrice?.toNumber() ?? null;
  card.interval = pkg?.interval ?? null;
  card.intervalCount = pkg?.interval_count ?? null;
  card.frequency = card.isRecurring
    ? card.intervalCount != null && card.intervalCount > 1
      ? `Every ${card.intervalCount} ${card.interval}s`
      : `Per ${card.interval}`
    : 'One time';
  card.discounts = line.discounts ?? [];

  updateCardDisplayElements(card);
}
