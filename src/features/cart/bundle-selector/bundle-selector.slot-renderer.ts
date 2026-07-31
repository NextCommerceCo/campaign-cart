import { useCampaignStore } from '@/state/campaign';
import { formatCurrency, formatPercentage } from '@/core/currency-formatter';
import type {
  BundleCard,
  BundlePackageState,
  BundleSlot,
  RenderContext,
} from './bundle-selector.types';
import { applySlotConditionals } from './bundle-selector.conditions';
import { renderVariantSelectors } from './bundle-selector.variant-renderer';
import {
  renderDiscountContainers,
  replaceVarsPreservingTemplates,
} from '@/core/rendering/discount-renderer';

// ─── Slot vars builder ────────────────────────────────────────────────────────

/**
 * Builds the template variable map for a single slot.
 * Extracted so callers can compare vars before deciding whether to re-render.
 */
export function buildSlotVars(
  slot: BundleSlot,
  pkgState: BundlePackageState
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
    'item.isRecurring': pkgState.isRecurring ? 'true' : 'false',
    'item.interval': pkgState.interval ?? '',
    'item.intervalCount':
      pkgState.intervalCount != null ? String(pkgState.intervalCount) : '',
    'item.frequency': pkgState.isRecurring
      ? pkgState.intervalCount != null && pkgState.intervalCount > 1
        ? `Every ${pkgState.intervalCount} ${pkgState.interval}s`
        : `Per ${pkgState.interval}`
      : 'One time',
    'item.recurringPrice': formatCurrency(
      pkgState.recurringPrice.toNumber(),
      pkgState.currency
    ),
    'item.originalRecurringPrice': formatCurrency(
      pkgState.originalRecurringPrice.toNumber(),
      pkgState.currency
    ),
    'item.price': formatCurrency(
      pkgState.unitPrice.times(slot.quantity).toNumber(),
      pkgState.currency
    ),
    'item.originalPrice': formatCurrency(
      pkgState.originalUnitPrice.times(slot.quantity).toNumber(),
      pkgState.currency
    ),
    'item.unitPrice': formatCurrency(
      pkgState.unitPrice.toNumber(),
      pkgState.currency
    ),
    'item.originalUnitPrice': formatCurrency(
      pkgState.originalUnitPrice.toNumber(),
      pkgState.currency
    ),
    'item.discountAmount': formatCurrency(
      pkgState.originalUnitPrice
        .minus(pkgState.unitPrice)
        .times(slot.quantity)
        .toNumber(),
      pkgState.currency
    ),
    'item.discountPercentage': formatPercentage(
      pkgState.discountPercentage.toNumber()
    ),
    'item.hasDiscount': pkgState.hasDiscount ? 'show' : 'hide',
    'item.currency': pkgState.currency,
  };
}

function varsEqual(
  a: Record<string, string>,
  b: Record<string, string>
): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k])
  );
}

// ─── Slot property listeners ──────────────────────────────────────────────────

/**
 * Attaches live `input` listeners to all `[data-next-property]` elements
 * inside a slot element. Every keystroke keeps `slot.properties` current so
 * that the next `getEffectiveItems` call — triggered by a variant change or
 * cart write — carries the correct values through.
 */
function attachPropertyListeners(
  slotEl: HTMLElement,
  slot: BundleSlot,
  card: BundleCard,
  onBlur?: (card: BundleCard) => void
): void {
  slotEl
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >('input[data-next-property], textarea[data-next-property], select[data-next-property]')
    .forEach(el => {
      const key = el.getAttribute('data-next-property');
      if (!key) return;
      el.addEventListener('input', () => {
        if (el.value) {
          slot.properties = { ...(slot.properties ?? {}), [key]: el.value };
        } else {
          const { [key]: _removed, ...rest } = slot.properties ?? {};
          slot.properties = Object.keys(rest).length > 0 ? rest : undefined;
        }
      });
      if (onBlur) {
        el.addEventListener('blur', () => onBlur(card));
      }
    });
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
  targetEl?: HTMLElement
): void {
  const placeholder =
    targetEl ??
    card.element.querySelector<HTMLElement>('[data-next-bundle-slots]');
  if (!placeholder) return;

  const activeIndices = new Set<number>();

  for (const slot of card.slots) {
    if (slot.noSlot) continue;

    const pkgState = card.packageStates.get(slot.activePackageId);
    if (!pkgState) continue;

    activeIndices.add(slot.slotIndex);

    const existing = placeholder.querySelector<HTMLElement>(
      `[data-next-slot-index="${slot.slotIndex}"]`
    );
    const newVars = buildSlotVars(slot, pkgState);
    // External renders (targetEl provided) bypass the cache entirely so that a
    // variant change that already updated the cache via the internal render does
    // not cause the external container to be silently skipped.
    const cachedVars = !targetEl
      ? card.slotVarsCache.get(slot.slotIndex)
      : undefined;

    // Skip only when the element already exists in this placeholder AND vars haven't changed.
    if (existing && cachedVars && varsEqual(cachedVars, newVars)) continue;

    const newSlotEl = createSlotElement(card.bundleId, slot, newVars, ctx, {
      offerDiscounts: pkgState.offerDiscounts,
      voucherDiscounts: pkgState.voucherDiscounts,
    });

    const variantPlaceholder = newSlotEl.querySelector<HTMLElement>(
      '[data-next-variant-selectors]'
    );
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
          ctx
        );
      }
    }

    if (existing) {
      // Preserve user-typed property values before the slot element is replaced.
      const savedPropertyValues: Record<string, string> = {};
      existing
        .querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >('input[data-next-property], textarea[data-next-property], select[data-next-property]')
        .forEach(el => {
          const key = el.getAttribute('data-next-property');
          if (key && el.value) savedPropertyValues[key] = el.value;
        });

      // Clean up select handlers attached to the outgoing slot element
      existing.querySelectorAll<HTMLSelectElement>('select').forEach(s => {
        const h = ctx.selectHandlers.get(s);
        if (h) {
          s.removeEventListener('change', h);
          ctx.selectHandlers.delete(s);
        }
      });
      placeholder.replaceChild(newSlotEl, existing);

      // Restore saved values into the new slot element and sync back to slot state.
      if (Object.keys(savedPropertyValues).length > 0) {
        Object.entries(savedPropertyValues).forEach(([key, value]) => {
          const el = newSlotEl.querySelector<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >(`[data-next-property="${key}"]`);
          if (el) el.value = value;
        });
        slot.properties = {
          ...(slot.properties ?? {}),
          ...savedPropertyValues,
        };
      }
    } else {
      placeholder.appendChild(newSlotEl);
    }

    if (slot.excludeProperties !== '*')
      attachPropertyListeners(newSlotEl, slot, card, ctx.onPropertyBlur);
    if (!targetEl) card.slotVarsCache.set(slot.slotIndex, newVars);
  }

  // Remove orphan slots that no longer correspond to an active slot
  placeholder
    .querySelectorAll<HTMLElement>('[data-next-slot-index]')
    .forEach(el => {
      const idx = Number(el.dataset.nextSlotIndex);
      if (!activeIndices.has(idx)) el.remove();
    });
  ctx.logger.debug('Rendered slots for bundle', card.bundleId, {
    activeCount: activeIndices.size,
  });
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
  discounts?: {
    offerDiscounts: import('@/core/rendering/discount-renderer').DiscountItem[];
    voucherDiscounts: import('@/core/rendering/discount-renderer').DiscountItem[];
  }
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = ctx.classNames.bundleSlot;
  wrapper.dataset.nextBundleId = bundleId;
  wrapper.dataset.nextSlotIndex = String(slot.slotIndex);
  wrapper.innerHTML = replaceVarsPreservingTemplates(ctx.slotTemplate, vars);
  applySlotConditionals(wrapper, vars);
  if (discounts) renderDiscountContainers(wrapper, discounts);
  return wrapper;
}

/** Re-renders a card's slots into the external slots container, if configured. */
export function renderExternalSlotsForCard(
  card: BundleCard,
  renderCtx: RenderContext,
  externalSlotsEl: HTMLElement | null,
  slotTemplate: string
): void {
  if (!externalSlotsEl || !slotTemplate) return;
  renderSlotsForCard(card, renderCtx, externalSlotsEl);
}
