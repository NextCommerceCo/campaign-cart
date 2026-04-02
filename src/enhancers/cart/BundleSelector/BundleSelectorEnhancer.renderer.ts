import { useCampaignStore } from '@/stores/campaignStore';
import type { Package } from '@/types/campaign';
import type { Logger } from '@/utils/logger';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import type {
  BundleCard,
  BundleDef,
  BundlePackageState,
  BundlePriceSummary,
  BundleSlot,
  RenderContext,
} from './BundleSelectorEnhancer.types';

// ─── Slot vars builder ────────────────────────────────────────────────────────

/**
 * Builds the template variable map for a single slot.
 * Extracted so callers can compare vars before deciding whether to re-render.
 */
export function buildSlotVars(
  slot: BundleSlot,
  pkgState: BundlePackageState,
): Record<string, string> {
  return {
    'slot.index': String(slot.slotIndex + 1),
    'slot.unitIndex': String(slot.unitIndex),
    'slot.unitNumber': String(slot.unitIndex + 1),
    'item.packageId': String(slot.activePackageId),
    'item.name': pkgState.name,
    'item.image': pkgState.image,
    'item.quantity': String(slot.quantity),
    'item.variantName': pkgState.variantName,
    'item.productName': pkgState.productName,
    'item.sku': pkgState.sku ?? '',
    'item.qty': String(pkgState.qty),
    'item.isRecurring': pkgState.isRecurring ? 'true' : 'false',
    'item.price': pkgState.unitPrice,
    'item.priceTotal': pkgState.packagePrice,
    'item.unitPrice': pkgState.unitPrice,
    'item.originalUnitPrice': pkgState.originalUnitPrice,
    'item.packagePrice': pkgState.packagePrice,
    'item.originalPackagePrice': pkgState.originalPackagePrice,
    'item.totalDiscount': pkgState.totalDiscount,
    'item.subtotal': pkgState.subtotal,
    'item.total': pkgState.total,
    'item.hasDiscount': pkgState.hasDiscount ? 'show' : 'hide',
    'item.hasSavings': pkgState.hasSavings ? 'show' : 'hide',
  };
}

function varsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
}

// ─── Bundle card template ─────────────────────────────────────────────────────

export function renderBundleTemplate(
  template: string,
  bundle: BundleDef,
  logger: Logger,
): HTMLElement | null {
  const visibleItems = bundle.items.filter(item => !item.noSlot);
  const itemCount = visibleItems.length;
  const totalQuantity = visibleItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

  const vars: Record<string, string> = {
    'bundle.itemCount': String(itemCount),
    'bundle.totalQuantity': String(totalQuantity),
  };
  for (const [key, value] of Object.entries(bundle)) {
    if (key !== 'items' && key !== 'selected') {
      vars[`bundle.${key}`] = value != null ? String(value) : '';
    }
  }

  const html = template.replace(/\{([^}]+)\}/g, (_, k: string) => vars[k] ?? '');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();

  const firstChild = wrapper.firstElementChild;
  const cardEl =
    wrapper.querySelector<HTMLElement>('[data-next-bundle-card]') ??
    (firstChild instanceof HTMLElement ? firstChild : null);

  if (!cardEl) {
    logger.warn('Bundle template produced no root element for bundle', bundle.id);
    return null;
  }

  cardEl.setAttribute('data-next-bundle-card', '');
  cardEl.setAttribute('data-next-bundle-id', bundle.id);
  cardEl.setAttribute('data-next-bundle-items', JSON.stringify(bundle.items));
  if (bundle.selected) {
    cardEl.setAttribute('data-next-selected', 'true');
  }
  if (bundle.vouchers?.length) {
    cardEl.setAttribute('data-next-bundle-vouchers', JSON.stringify(bundle.vouchers));
  }

  return cardEl;
}

// ─── Card display elements ────────────────────────────────────────────────────

interface BundleFieldData {
  bundlePrice: BundlePriceSummary;
  isSelected: boolean;
  name: string;
  unitPrice: number;
  originalUnitPrice: number;
}

function applyBundleField(el: HTMLElement, field: string, data: BundleFieldData): void {
  const { bundlePrice, isSelected, name, unitPrice, originalUnitPrice } = data;
  switch (field) {
    case 'price':
    case 'total':
      el.textContent = formatCurrency(bundlePrice.total);
      break;
    case 'compare':
    case 'originalPrice':
      el.textContent = formatCurrency(bundlePrice.subtotal);
      break;
    case 'savings':
    case 'discountAmount':
      el.textContent = formatCurrency(bundlePrice.totalDiscount);
      break;
    case 'unitPrice':
      el.textContent = formatCurrency(unitPrice);
      break;
    case 'originalUnitPrice':
      el.textContent = formatCurrency(originalUnitPrice);
      break;
    case 'savingsPercentage':
    case 'discountPercentage':
      el.textContent = formatPercentage(bundlePrice.totalDiscountPercentage);
      break;
    case 'isSelected':
      el.style.display = isSelected ? '' : 'none';
      break;
    case 'hasDiscount':
    case 'hasSavings':
      el.style.display = bundlePrice.totalDiscount > 0 ? '' : 'none';
      break;
    case 'name':
      el.textContent = name;
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
  bundlePrice: BundlePriceSummary,
): void {
  const isSelected = card.element.getAttribute('data-next-selected') === 'true';
  const totalQuantity = card.slots
    .filter(s => !s.noSlot)
    .reduce((sum, s) => sum + s.quantity, 0);
  const unitPrice =
    totalQuantity > 0 ? bundlePrice.total / totalQuantity : bundlePrice.total;
  const originalUnitPrice =
    totalQuantity > 0 ? bundlePrice.subtotal / totalQuantity : bundlePrice.subtotal;

  const fieldData: BundleFieldData = {
    bundlePrice,
    isSelected,
    name: card.name,
    unitPrice,
    originalUnitPrice,
  };

  card.element.querySelectorAll<HTMLElement>('[data-next-bundle-display]').forEach(el => {
    const field = el.getAttribute('data-next-bundle-display') ?? 'price';
    applyBundleField(el, field, fieldData);
  });

  // Deprecated: kept for backward compatibility
  card.element.querySelectorAll<HTMLElement>('[data-next-bundle-price]').forEach(el => {
    const field = el.getAttribute('data-next-bundle-price') ?? 'total';
    applyBundleField(el, field, fieldData);
  });

  card.element.dispatchEvent(
    new CustomEvent('bundle:price-updated', {
      bubbles: true,
      detail: { bundleId: card.element.getAttribute('data-next-bundle-id') ?? '' },
    }),
  );
}

// ─── Slot rendering ───────────────────────────────────────────────────────────

/**
 * Renders slots for a bundle card using surgical per-slot patching.
 *
 * On first render every slot is created and appended. On subsequent calls only
 * slots whose template vars have changed are replaced — unchanged slots stay
 * untouched in the DOM. Orphan slot elements (e.g. after a variant change that
 * reduces the slot count) are removed.
 *
 * Reads exclusively from card.packageStates — no direct campaign store access
 * for slot display data. Campaign store is only consulted for variant selector
 * option lists (to enumerate all available variant values for a product).
 */
export function renderSlotsForCard(
  card: BundleCard,
  ctx: RenderContext,
  targetEl?: HTMLElement,
): void {
  const placeholder =
    targetEl ?? card.element.querySelector<HTMLElement>('[data-next-bundle-slots]');
  if (!placeholder) return;

  const activeIndices = new Set<number>();

  for (const slot of card.slots) {
    if (slot.noSlot) continue;

    const pkgState = card.packageStates.get(slot.activePackageId);
    if (!pkgState) continue;

    activeIndices.add(slot.slotIndex);

    const existing = placeholder.querySelector<HTMLElement>(
      `[data-next-slot-index="${slot.slotIndex}"]`,
    );
    const newVars = buildSlotVars(slot, pkgState);
    // External renders (targetEl provided) bypass the cache entirely so that a
    // variant change that already updated the cache via the internal render does
    // not cause the external container to be silently skipped.
    const cachedVars = !targetEl ? card.slotVarsCache.get(slot.slotIndex) : undefined;

    // Skip only when the element already exists in this placeholder AND vars haven't changed.
    if (existing && cachedVars && varsEqual(cachedVars, newVars)) continue;

    const newSlotEl = createSlotElement(card.bundleId, slot, newVars, ctx);

    const variantPlaceholder =
      newSlotEl.querySelector<HTMLElement>('[data-next-variant-selectors]');
    if (variantPlaceholder) {
      const allPackages = useCampaignStore.getState().packages ?? [];
      const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
      if (pkg && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
        renderVariantSelectors(
          variantPlaceholder,
          card.bundleId,
          slot.slotIndex,
          pkg,
          allPackages,
          ctx,
        );
      }
    }

    if (existing) {
      // Clean up select handlers attached to the outgoing slot element
      existing.querySelectorAll<HTMLSelectElement>('select').forEach(s => {
        const h = ctx.selectHandlers.get(s);
        if (h) {
          s.removeEventListener('change', h);
          ctx.selectHandlers.delete(s);
        }
      });
      placeholder.replaceChild(newSlotEl, existing);
    } else {
      placeholder.appendChild(newSlotEl);
    }

    if (!targetEl) card.slotVarsCache.set(slot.slotIndex, newVars);
  }

  // Remove orphan slots that no longer correspond to an active slot
  placeholder.querySelectorAll<HTMLElement>('[data-next-slot-index]').forEach(el => {
    const idx = Number(el.dataset.nextSlotIndex);
    if (!activeIndices.has(idx)) el.remove();
  });
  ctx.logger.debug('Rendered slots for bundle', card.bundleId, { activeCount: activeIndices.size });
}

/**
 * Creates a slot DOM element from pre-built template vars (see buildSlotVars).
 * All price and display variables come from vars — either campaign package
 * baseline prices (before fetch) or bundle-computed prices (after fetch).
 * There is no distinction between "in cart" and "preview" here; cart state
 * drives CSS classes on the card element, not per-slot prices.
 */
function createSlotElement(
  bundleId: string,
  slot: BundleSlot,
  vars: Record<string, string>,
  ctx: RenderContext,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = ctx.classNames.bundleSlot;
  wrapper.dataset.nextBundleId = bundleId;
  wrapper.dataset.nextSlotIndex = String(slot.slotIndex);
  wrapper.innerHTML = ctx.slotTemplate.replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? '');
  return wrapper;
}

// ─── Variant selectors ────────────────────────────────────────────────────────

export function renderVariantSelectors(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  currentPkg: Package,
  allPackages: Package[],
  ctx: RenderContext,
): void {
  const productId = currentPkg.product_id;
  if (!productId) return;

  const productPkgs = allPackages.filter(p => p.product_id === productId);
  const currentAttrs = currentPkg.product_variant_attribute_values || [];
  if (currentAttrs.length === 0) return;

  const attrDefs = new Map<string, string>();
  for (const pkg of productPkgs) {
    for (const attr of pkg.product_variant_attribute_values || []) {
      if (!attrDefs.has(attr.code)) attrDefs.set(attr.code, attr.name);
    }
  }

  const selected: Record<string, string> = {};
  for (const attr of currentAttrs) selected[attr.code] = attr.value;

  const outerSwap = container.getAttribute('next-render-swap') === 'outerHTML';
  const noLabel = container.hasAttribute('next-render-no-label');
  const target = outerSwap ? document.createElement('div') : container;
  if (!outerSwap) container.innerHTML = '';

  for (const [code, name] of attrDefs) {
    const values = [
      ...new Set(
        productPkgs.flatMap(p =>
          (p.product_variant_attribute_values || [])
            .filter(a => a.code === code)
            .map(a => a.value)
        )
      ),
    ];

    if (ctx.variantSelectorTemplate) {
      renderSelectorTemplate(
        target, bundleId, slotIndex, code, name,
        values, selected[code] ?? '', productPkgs, selected, ctx,
      );
    } else if (ctx.variantOptionTemplate) {
      renderCustomOptions(
        target, bundleId, slotIndex, code, name,
        values, selected[code] ?? '', productPkgs, selected, ctx,
      );
    } else {
      const field = document.createElement('div');
      field.className = 'next-slot-variant-field';
      field.dataset.nextVariantCode = code;
      field.dataset.nextVariantName = name;
      field.dataset.nextBundleId = bundleId;
      field.dataset.nextSlotIndex = String(slotIndex);

      const label = document.createElement('label');
      label.className = 'next-slot-variant-label';
      label.textContent = `Select ${name}:`;

      const select = document.createElement('select');
      select.className = 'next-slot-variant-select';
      select.dataset.nextVariantCode = code;

      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (value === selected[code]) option.selected = true;
        if (!isVariantValueAvailable(value, code, productPkgs, selected)) {
          option.disabled = true;
        }
        select.appendChild(option);
      }

      const handler: EventListener = () => {
        void ctx.onSelectChange(select, bundleId, slotIndex);
      };
      ctx.selectHandlers.set(select, handler);
      select.addEventListener('change', handler);

      if (!noLabel) field.appendChild(label);
      field.appendChild(select);
      target.appendChild(field);
    }
  }

  if (outerSwap) {
    const parent = container.parentElement;
    if (parent) {
      while (target.firstChild) {
        parent.insertBefore(target.firstChild, container);
      }
      parent.removeChild(container);
    }
  }
}

function renderOptionItems(
  target: HTMLElement,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext,
): void {
  for (const value of values) {
    const isSelected = value === selectedValue;
    const isAvailable = isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs);
    const vars: Record<string, string> = {
      'attr.code': code,
      'attr.name': name,
      'option.value': value,
      'option.selected': String(isSelected),
      'option.available': String(isAvailable),
    };
    const html = ctx.variantOptionTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? '');
    const temp = document.createElement('div');
    temp.innerHTML = html.trim();
    const first = temp.firstElementChild;
    const el = first instanceof HTMLElement ? first : null;
    if (!el) continue;

    el.dataset.nextVariantOption = code;
    el.dataset.nextVariantValue = value;
    if (isSelected) {
      el.setAttribute('data-selected', 'true');
      el.classList.add(ctx.classNames.variantSelected);
    }
    if (!isAvailable) {
      el.dataset.nextUnavailable = 'true';
      el.classList.add(ctx.classNames.variantUnavailable);
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) {
        el.disabled = true;
      } else {
        el.setAttribute('aria-disabled', 'true');
      }
    }

    target.appendChild(el);
  }
}

function renderCustomOptions(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext,
): void {
  const group = document.createElement('div');
  group.className = ctx.classNames.slotVariantGroup;
  group.dataset.nextVariantCode = code;
  group.dataset.nextVariantName = name;
  group.dataset.nextBundleId = bundleId;
  group.dataset.nextSlotIndex = String(slotIndex);

  renderOptionItems(group, code, name, values, selectedValue, productPkgs, allSelectedAttrs, ctx);

  container.appendChild(group);
}

function renderSelectorTemplate(
  container: HTMLElement,
  bundleId: string,
  slotIndex: number,
  code: string,
  name: string,
  values: string[],
  selectedValue: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
  ctx: RenderContext,
): void {
  const vars: Record<string, string> = {
    'attr.code': code,
    'attr.name': name,
    'attr.selectedValue': selectedValue,
  };
  const html = ctx.variantSelectorTemplate.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? '');
  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  const root = temp.firstElementChild;
  const el = root instanceof HTMLElement ? root : null;
  if (!el) {
    ctx.logger.warn('Variant selector template produced no root element for attribute', code);
    return;
  }

  el.dataset.nextVariantCode = code;
  el.dataset.nextBundleId = bundleId;
  el.dataset.nextSlotIndex = String(slotIndex);

  const optionsPlaceholder = el.querySelector<HTMLElement>('[data-next-variant-options]');
  if (optionsPlaceholder) {
    if (ctx.variantOptionTemplate) {
      renderOptionItems(
        optionsPlaceholder, code, name, values, selectedValue,
        productPkgs, allSelectedAttrs, ctx,
      );
    } else {
      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (value === selectedValue) option.selected = true;
        if (!isVariantValueAvailable(value, code, productPkgs, allSelectedAttrs)) {
          option.disabled = true;
        }
        optionsPlaceholder.appendChild(option);
      }
      const selectEl =
        optionsPlaceholder instanceof HTMLSelectElement
          ? optionsPlaceholder
          : el.querySelector<HTMLSelectElement>('select');
      if (selectEl) {
        selectEl.dataset.nextVariantCode = code;
        const handler: EventListener = () =>
          void ctx.onSelectChange(selectEl, bundleId, slotIndex);
        ctx.selectHandlers.set(selectEl, handler);
        selectEl.addEventListener('change', handler);
      }
    }
  }

  container.appendChild(el);
}

export function isVariantValueAvailable(
  value: string,
  code: string,
  productPkgs: Package[],
  allSelectedAttrs: Record<string, string>,
): boolean {
  return productPkgs.some(pkg => {
    if (pkg.product_purchase_availability === 'unavailable') return false;
    const attrs = pkg.product_variant_attribute_values || [];
    if (!attrs.some(a => a.code === code && a.value === value)) return false;
    return Object.entries(allSelectedAttrs)
      .filter(([c]) => c !== code)
      .every(([c, v]) => attrs.some(a => a.code === c && a.value === v));
  });
}
