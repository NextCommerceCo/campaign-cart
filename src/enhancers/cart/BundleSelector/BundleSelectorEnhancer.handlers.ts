import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { BundleCard, HandlerContext } from './BundleSelectorEnhancer.types';

// ─── Card click / bundle selection ───────────────────────────────────────────

export async function handleCardClick(
  e: Event,
  card: BundleCard,
  previousCard: BundleCard | null,
  ctx: HandlerContext,
): Promise<void> {
  e.preventDefault();
  if (previousCard === card) return;

  ctx.selectCard(card);
  ctx.emit('bundle:selected', { bundleId: card.bundleId, items: ctx.getEffectiveItems(card) });

  if (card.vouchers.length || previousCard?.vouchers.length) {
    await applyVoucherSwap(previousCard, card);
  }
  if (ctx.mode === 'swap') {
    await applyBundle(previousCard, card, ctx);
  }
}

// ─── Cart write ───────────────────────────────────────────────────────────────

/**
 * Apply a bundle to the cart.
 * - Swapping from a previous bundle: strips previous bundle's packages and
 *   replaces them with the new bundle, leaving unrelated items untouched.
 * - First selection (no previous): replaces the entire cart with the bundle's items.
 */
export async function applyBundle(
  previous: BundleCard | null,
  selected: BundleCard,
  ctx: HandlerContext,
): Promise<void> {
  if (ctx.isApplyingRef.value) return;
  ctx.isApplyingRef.value = true;
  const cartStore = useCartStore.getState();
  const newItems = ctx.getEffectiveItems(selected).map(i => ({
    ...i,
    bundleId: selected.bundleId,
  }));
  try {
    if (previous) {
      const retained = cartStore.items
        .filter(ci => ci.bundleId !== previous.bundleId)
        .map(ci => ({
          packageId: ci.packageId,
          quantity: ci.quantity,
          isUpsell: ci.is_upsell,
          bundleId: ci.bundleId,
        }));
      await cartStore.swapCart([...retained, ...newItems]);
    } else {
      await cartStore.swapCart(newItems);
    }
    ctx.logger.debug(`Applied bundle "${selected.bundleId}"`, newItems);
  } catch (error) {
    // Revert visual selection so UI stays consistent with cart state
    if (previous) {
      ctx.selectCard(previous);
    } else {
      selected.element.classList.remove(ctx.classNames.selected);
      selected.element.setAttribute('data-next-selected', 'false');
    }
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error('Error in applyBundle:', msg);
  } finally {
    ctx.isApplyingRef.value = false;
  }
}

/**
 * Swaps effective items in the cart when the user changes a variant on the
 * currently selected bundle.
 */
export async function applyEffectiveChange(
  card: BundleCard,
  ctx: HandlerContext,
): Promise<void> {
  if (ctx.isApplyingRef.value) return;
  ctx.isApplyingRef.value = true;
  try {
    const cartStore = useCartStore.getState();
    const retained = cartStore.items
      .filter(ci => ci.bundleId !== card.bundleId)
      .map(ci => ({
        packageId: ci.packageId,
        quantity: ci.quantity,
        isUpsell: ci.is_upsell,
        bundleId: ci.bundleId,
      }));
    const newItems = ctx.getEffectiveItems(card).map(i => ({
      ...i,
      bundleId: card.bundleId,
    }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Variant change synced for bundle "${card.bundleId}"`, newItems);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error('Error in applyEffectiveChange:', msg);
  } finally {
    ctx.isApplyingRef.value = false;
  }
}

// ─── Voucher swap ─────────────────────────────────────────────────────────────

export async function applyVoucherSwap(
  previous: BundleCard | null,
  next: BundleCard,
): Promise<void> {
  const checkoutStore = useCheckoutStore.getState();
  const toRemove = previous?.vouchers ?? [];
  const toApply = next.vouchers;
  for (const code of toRemove) {
    if (!toApply.includes(code)) checkoutStore.removeVoucher(code);
  }
  for (const code of toApply) {
    const current = useCheckoutStore.getState().vouchers;
    if (!current.includes(code)) checkoutStore.addVoucher(code);
  }
  useCartStore.getState().calculateTotals();
}

// ─── Variant change handlers ──────────────────────────────────────────────────

export async function applyVariantChange(
  card: BundleCard,
  slotIndex: number,
  selectedAttrs: Record<string, string>,
  ctx: HandlerContext,
): Promise<void> {
  if (ctx.isApplyingRef.value) return;

  const slot = card.slots[slotIndex];
  if (!slot) return;

  const allPackages = useCampaignStore.getState().packages ?? [];
  const currentPkg = allPackages.find(p => p.ref_id === slot.activePackageId);
  if (!currentPkg?.product_id) return;

  const productPkgs = allPackages.filter(p => p.product_id === currentPkg.product_id);

  const matched = productPkgs.find(pkg => {
    const attrs = pkg.product_variant_attribute_values || [];
    return Object.entries(selectedAttrs).every(([c, v]) =>
      attrs.some(a => a.code === c && a.value === v)
    );
  });

  if (!matched) {
    ctx.logger.warn('No package found for variant combination', selectedAttrs);
    return;
  }

  if (slot.activePackageId === matched.ref_id) return;

  slot.activePackageId = matched.ref_id;

  if (ctx.mode === 'swap') {
    await applyEffectiveChange(card, ctx);
  }

  // Re-render slots after cart sync so template vars (image, price, etc.)
  // reflect the final cart state and don't blink from an intermediate render.
  ctx.renderSlotsForCard(card);

  void ctx.fetchAndUpdateBundlePrice(card);

  ctx.logger.debug(
    `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
    { packageId: matched.ref_id },
  );
}

/** Delegated click handler for custom variant option elements. */
export function handleVariantOptionClick(
  e: Event,
  cards: BundleCard[],
  ctx: HandlerContext,
): void {
  const target = e.target as HTMLElement;
  const optionEl = target.closest<HTMLElement>('[data-next-variant-option]');
  if (!optionEl) return;

  if (optionEl.dataset.nextUnavailable === 'true') return;

  const code = optionEl.dataset.nextVariantOption;
  const value = optionEl.dataset.nextVariantValue;
  if (!code || !value) return;

  const group = optionEl.closest<HTMLElement>('[data-next-variant-code]');
  if (!group) return;

  const bundleId = group.dataset.nextBundleId;
  const slotIndex = Number(group.dataset.nextSlotIndex);
  if (!bundleId) return;

  const card = cards.find(c => c.bundleId === bundleId);
  if (!card) return;

  // Update visual selection within this attribute group
  group.querySelectorAll<HTMLElement>('[data-next-variant-option]').forEach(el => {
    el.removeAttribute('data-selected');
    el.classList.remove(ctx.classNames.variantSelected);
  });
  optionEl.setAttribute('data-selected', 'true');
  optionEl.classList.add(ctx.classNames.variantSelected);

  // Read all currently selected values across groups for this slot.
  // Slots may be in an external container (data-next-bundle-slots-for), not inside card.element.
  const slotEl =
    card.element.querySelector<HTMLElement>(`[data-next-slot-index="${slotIndex}"]`) ??
    ctx.externalSlotsEl?.querySelector<HTMLElement>(
      `[data-next-bundle-id="${bundleId}"][data-next-slot-index="${slotIndex}"]:not([data-next-variant-code])`,
    ) ??
    null;
  if (!slotEl) return;

  const selectedAttrs: Record<string, string> = {};
  slotEl.querySelectorAll<HTMLElement>('[data-next-variant-code]').forEach(g => {
    const attrCode = g.dataset.nextVariantCode;
    if (!attrCode) return;
    const sel = g.querySelector<HTMLElement>('[data-next-variant-option][data-selected="true"]');
    if (sel?.dataset.nextVariantValue) selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
  });

  void applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}

export async function handleSelectVariantChange(
  _select: HTMLSelectElement,
  bundleId: string,
  slotIndex: number,
  cards: BundleCard[],
  ctx: HandlerContext,
): Promise<void> {
  const card = cards.find(c => c.bundleId === bundleId);
  if (!card) return;

  // Slots may be in an external container (data-next-bundle-slots-for), not inside card.element.
  const slotEl =
    card.element.querySelector<HTMLElement>(`[data-next-slot-index="${slotIndex}"]`) ??
    ctx.externalSlotsEl?.querySelector<HTMLElement>(
      `[data-next-bundle-id="${bundleId}"][data-next-slot-index="${slotIndex}"]:not([data-next-variant-code])`,
    ) ??
    null;
  if (!slotEl) return;

  const selectedAttrs: Record<string, string> = {};
  slotEl.querySelectorAll<HTMLSelectElement>('select[data-next-variant-code]').forEach(s => {
    if (s.dataset.nextVariantCode) selectedAttrs[s.dataset.nextVariantCode] = s.value;
  });

  await applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}
