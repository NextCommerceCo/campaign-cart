import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { Package } from '@/types/campaign';
import type { Logger } from '@/utils/logger';
import type { BundleCard, BundleDef, BundleSlot, RenderContext } from './BundleSelectorEnhancer.types';

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

// ─── Slot rendering ───────────────────────────────────────────────────────────

export function renderSlotsForCard(
  card: BundleCard,
  ctx: RenderContext,
  targetEl?: HTMLElement,
): void {
  const placeholder =
    targetEl ?? card.element.querySelector<HTMLElement>('[data-next-bundle-slots]');
  if (!placeholder) return;

  // Clean up any existing select handlers for this card's slots
  placeholder.querySelectorAll<HTMLSelectElement>('select').forEach(s => {
    const h = ctx.selectHandlers.get(s);
    if (h) {
      s.removeEventListener('change', h);
      ctx.selectHandlers.delete(s);
    }
  });

  const allPackages = useCampaignStore.getState().packages ?? [];
  placeholder.innerHTML = '';

  for (const slot of card.slots) {
    if (slot.noSlot) continue;

    const pkg = allPackages.find(p => p.ref_id === slot.activePackageId);
    if (!pkg) continue;

    const slotEl = createSlotElement(card.bundleId, slot, pkg, ctx);

    const variantPlaceholder = slotEl.querySelector<HTMLElement>('[data-next-variant-selectors]');
    if (variantPlaceholder && (pkg.product_variant_attribute_values?.length ?? 0) > 0) {
      renderVariantSelectors(
        variantPlaceholder,
        card.bundleId,
        slot.slotIndex,
        pkg,
        allPackages,
        ctx,
      );
    }

    placeholder.appendChild(slotEl);
  }
}

function createSlotElement(
  bundleId: string,
  slot: BundleSlot,
  pkg: Package,
  ctx: RenderContext,
): HTMLElement {
  const isInCart = (() => {
    const cartState = useCartStore.getState();
    const ci = cartState.items.find(i => i.packageId === slot.activePackageId);
    return ci != null && ci.quantity >= slot.quantity;
  })();

  const summaryLine = isInCart
    ? useCartStore.getState().summary?.lines.find(l => l.package_id === slot.activePackageId)
    : ctx.previewLines.get(bundleId)?.find(l => l.package_id === slot.activePackageId);

  const hasDiscount = summaryLine ? parseFloat(summaryLine.total_discount) > 0 : false;
  const hasSavings = summaryLine?.price_retail_total != null
    ? parseFloat(summaryLine.price_retail_total) > parseFloat(summaryLine.package_price)
    : (pkg.price_retail != null && pkg.price_retail !== pkg.price);

  const vars: Record<string, string> = {
    'slot.index': String(slot.slotIndex + 1),
    'slot.unitIndex': String(slot.unitIndex),
    'slot.unitNumber': String(slot.unitIndex + 1),
    'item.packageId': String(slot.activePackageId),
    'item.name': pkg.name || '',
    'item.image': pkg.image || '',
    'item.quantity': String(slot.quantity),
    'item.variantName': pkg.product_variant_name || '',
    'item.productName': pkg.product_name || '',
    'item.sku': pkg.product_sku || '',
    'item.qty': String(pkg.qty ?? 1),
    'item.price': pkg.price || '',
    'item.priceTotal': pkg.price_total || '',
    'item.priceRetail': pkg.price_retail || '',
    'item.priceRetailTotal': pkg.price_retail_total || '',
    'item.priceRecurring': pkg.price_recurring || '',
    'item.isRecurring': pkg.is_recurring ? 'true' : 'false',
    'item.unitPrice':            summaryLine?.unit_price            ?? pkg.price ?? '',
    'item.originalUnitPrice':    summaryLine?.original_unit_price   ?? pkg.price ?? '',
    'item.packagePrice':         summaryLine?.package_price         ?? pkg.price_total ?? '',
    'item.originalPackagePrice': summaryLine?.original_package_price ?? pkg.price_total ?? '',
    'item.subtotal':             summaryLine?.subtotal              ?? '',
    'item.totalDiscount':        summaryLine?.total_discount        ?? '0',
    'item.total':                summaryLine?.total                 ?? pkg.price_total ?? '',
    'item.hasDiscount': hasDiscount ? 'show' : 'hide',
    'item.hasSavings':  hasSavings  ? 'show' : 'hide',
  };

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

  container.innerHTML = '';

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
        container, bundleId, slotIndex, code, name,
        values, selected[code] ?? '', productPkgs, selected, ctx,
      );
    } else if (ctx.variantOptionTemplate) {
      renderCustomOptions(
        container, bundleId, slotIndex, code, name,
        values, selected[code] ?? '', productPkgs, selected, ctx,
      );
    } else {
      const field = document.createElement('div');
      field.className = 'next-slot-variant-field';

      const label = document.createElement('label');
      label.className = 'next-slot-variant-label';
      label.textContent = `${name}:`;

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

      const handler: EventListener = () =>
        void ctx.onSelectChange(select, bundleId, slotIndex);
      ctx.selectHandlers.set(select, handler);
      select.addEventListener('change', handler);

      field.appendChild(label);
      field.appendChild(select);
      container.appendChild(field);
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

