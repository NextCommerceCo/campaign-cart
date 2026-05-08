import { useCartStore } from '@/stores/cartStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { useCampaignStore } from '@/stores/campaignStore';
import type { BundleCard, HandlerContext } from './BundleSelectorEnhancer.types';
import { getEffectiveItems, makePackageState } from './BundleSelectorEnhancer.state';

// ─── Card click / bundle selection ───────────────────────────────────────────

export async function handleCardClick(
  e: Event,
  card: BundleCard,
  previousCard: BundleCard | null,
  ctx: HandlerContext,
): Promise<void> {
  e.preventDefault();
  if (previousCard === card) return;
  if (ctx.isApplyingRef.value) return;

  if (ctx.isUpsellContext) {
    ctx.selectCard(card);
    ctx.emit('bundle:selected', { selectorId: ctx.selectorId ?? '', items: getEffectiveItems(card) });
    return;
  }

  ctx.selectCard(card);
  ctx.emit('bundle:selected', { selectorId: ctx.selectorId ?? '', items: getEffectiveItems(card) });

  if (card.vouchers.length || previousCard?.vouchers.length) {
    await applyVoucherSwap(previousCard, card);
  }
  if (ctx.mode === 'swap') {
    const success = await applyBundle(previousCard, card, ctx);
    if (success && card.shippingId) await setShippingMethod(card.shippingId, ctx);
  }
}

// ─── Cart write ───────────────────────────────────────────────────────────────

/**
 * Apply a bundle to the cart.
 * Strips the outgoing bundle's items (previous when swapping, or any stale
 * items already tagged with the selected bundle ID on first selection) and
 * replaces them with the new bundle's items, leaving all unrelated cart items
 * untouched.
 */
export async function applyBundle(
  previous: BundleCard | null,
  selected: BundleCard,
  ctx: HandlerContext,
): Promise<boolean> {
  if (ctx.isApplyingRef.value) return false;
  ctx.isApplyingRef.value = true;
  const { selectorId } = ctx;
  const cartStore = useCartStore.getState();
  const newItems = getEffectiveItems(selected).map(i => ({
    ...i,
    selectorId,
  }));
  try {
    const retained = cartStore.items
      .filter(ci => ci.selectorId !== selectorId)
      .map(ci => ({
        packageId: ci.packageId,
        quantity: ci.quantity,
        isUpsell: ci.is_upsell,
        selectorId: ci.selectorId,
      }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Applied bundle "${selected.bundleId}" (selector "${selectorId}")`, newItems);
    return true;
  } catch (error) {
    // Revert visual selection so UI stays consistent with cart state
    if (previous) {
      ctx.selectCard(previous);
      await applyVoucherSwap(selected, previous);
    } else {
      selected.element.classList.remove(ctx.classNames.selected);
      selected.element.setAttribute('data-next-selected', 'false');
      await applyVoucherSwap(selected, { vouchers: [] } as unknown as BundleCard);
    }
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error('Error in applyBundle:', msg);
    return false;
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
  const { selectorId } = ctx;
  const slotSnapshot = card.slots.map(s => s.activePackageId);
  try {
    const cartStore = useCartStore.getState();
    const retained = cartStore.items
      .filter(ci => ci.selectorId !== selectorId)
      .map(ci => ({
        packageId: ci.packageId,
        quantity: ci.quantity,
        isUpsell: ci.is_upsell,
        selectorId: ci.selectorId,
      }));
    const newItems = getEffectiveItems(card).map(i => ({
      ...i,
      selectorId,
    }));
    await cartStore.swapCart([...retained, ...newItems]);
    ctx.logger.debug(`Variant change synced for bundle "${card.bundleId}" (selector "${selectorId}")`, newItems);
  } catch (error) {
    // Revert slot state so the UI stays consistent with the actual cart
    card.slots.forEach((s, i) => { s.activePackageId = slotSnapshot[i]; });
    ctx.emit('bundle:selection-changed', {
      selectorId: selectorId ?? '',
      items: getEffectiveItems(card),
    });
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

// ─── Voucher-change handler ───────────────────────────────────────────────────

/**
 * Called when checkout vouchers change.
 * Compares the user-entered portion of the voucher list — vouchers that do not
 * belong to any bundle across **all** BundleSelectorEnhancer instances. Re-fetches
 * prices for every card in this instance only when that user-coupon set changes.
 *
 * This means a bundle swap (which only adds/removes bundle-managed vouchers) will
 * NOT trigger a redundant price re-fetch, while a user manually entering or removing
 * a coupon code will.
 *
 * @param newVouchers       Current checkout vouchers after the change.
 * @param prevVouchers      Checkout vouchers before the change.
 * @param cards             Bundle cards owned by this enhancer instance.
 * @param allBundleVouchers Union of every bundle voucher across ALL live instances.
 * @param fetchPrice        Re-fetches the price for a single card.
 */
export function onVoucherApplied(
  newVouchers: string[],
  prevVouchers: string[],
  cards: BundleCard[],
  allBundleVouchers: Set<string>,
  fetchPrice: (card: BundleCard) => Promise<void>,
): void {
  const prevUserCoupons = prevVouchers.filter(v => !allBundleVouchers.has(v));
  const nextUserCoupons = newVouchers.filter(v => !allBundleVouchers.has(v));

  const prevSet = new Set(prevUserCoupons);
  const nextSet = new Set(nextUserCoupons);
  const changed =
    prevSet.size !== nextSet.size ||
    nextUserCoupons.some(v => !prevSet.has(v));

  if (!changed) return;

  for (const card of cards) {
    void fetchPrice(card);
  }
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

  slot.variantSelected = true;
  if (slot.activePackageId === matched.ref_id) {
    ctx.emit('bundle:selection-changed', {
      selectorId: ctx.selectorId ?? '',
      items: getEffectiveItems(card),
    });
    return;
  }

  slot.activePackageId = matched.ref_id;

  // Ensure the new packageId has a packageState entry (provisional campaign prices).
  // fetchAndUpdateBundlePrice will overwrite with bundle-computed prices afterward.
  if (!card.packageStates.has(matched.ref_id)) {
    card.packageStates.set(matched.ref_id, makePackageState(matched));
  }

  if (ctx.mode === 'swap') {
    await applyEffectiveChange(card, ctx);
  }

  ctx.emit('bundle:selection-changed', {
    selectorId: ctx.selectorId ?? '',
    items: getEffectiveItems(card),
  });

  void ctx.fetchAndUpdateBundlePrice(card);

  ctx.logger.debug(
    `Variant changed on bundle "${card.bundleId}" slot ${slotIndex}`,
    { packageId: matched.ref_id },
  );
}

/** Delegated click handler for custom variant option elements. */
export async function handleVariantOptionClick(
  e: Event,
  cards: BundleCard[],
  ctx: HandlerContext,
): Promise<void> {
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
  // Walk up from the clicked option so we find the slot wrapper the click
  // actually happened in — the same card can have slots rendered in both a
  // hidden card-internal [data-next-bundle-slots] and an external
  // [data-next-bundle-slots-for] container, and only the clicked slot's
  // groups carry the updated selection.
  const slotEl = optionEl.closest<HTMLElement>(
    `[data-next-bundle-id="${bundleId}"][data-next-slot-index="${slotIndex}"]:not([data-next-variant-code])`,
  );
  if (!slotEl) return;

  const selectedAttrs: Record<string, string> = {};
  slotEl.querySelectorAll<HTMLElement>('[data-next-variant-code]').forEach(g => {
    const attrCode = g.dataset.nextVariantCode;
    if (!attrCode) return;
    const sel = g.querySelector<HTMLElement>('[data-next-variant-option][data-selected="true"]');
    if (sel?.dataset.nextVariantValue) selectedAttrs[attrCode] = sel.dataset.nextVariantValue;
  });

  const previousCard = ctx.getSelectedCard();
  if (previousCard !== card) {
    ctx.selectCard(card);
    ctx.emit('bundle:selected', { selectorId: ctx.selectorId ?? '', items: getEffectiveItems(card) });
    if (card.vouchers.length || previousCard?.vouchers.length) {
      await applyVoucherSwap(previousCard, card);
    }
  }

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

  // Ensure the changed select's new value takes precedence — it may not be
  // inside slotEl (e.g. external slot containers), so the loop above can miss it.
  const changedCode = _select.dataset.nextVariantCode;
  if (changedCode) selectedAttrs[changedCode] = _select.value;

  await applyVariantChange(card, slotIndex, selectedAttrs, ctx);
}

// ─── Bundle quantity change ───────────────────────────────────────────────────

/**
 * Called by the shared inline-stepper util when the user changes the bundle
 * quantity. Writes through to cart in swap mode (only when this card is
 * currently selected), emits `bundle:quantity-changed`, and schedules a
 * debounced price refetch.
 *
 * Rapid clicks are handled three ways simultaneously:
 *   - `isApplyingRef` serializes overlapping cart writes in applyEffectiveChange
 *   - 150ms debounce coalesces price refetches
 *   - the stale-items guard inside fetchAndUpdateBundlePrice drops
 *     out-of-order results by comparing getEffectiveItems() post-await
 */
export async function applyBundleQuantityChange(
  card: BundleCard,
  ctx: HandlerContext,
): Promise<void> {
  const effectiveItems = getEffectiveItems(card);

  ctx.emit('bundle:quantity-changed', {
    selectorId: ctx.selectorId ?? '',
    bundleId: card.bundleId,
    quantity: card.bundleQuantity,
    items: effectiveItems,
  });
  ctx.emit('bundle:selection-changed', {
    selectorId: ctx.selectorId ?? '',
    items: effectiveItems,
  });

  // Cart sync only when in swap mode and this card is the currently selected one.
  // Upsell context never writes to cart.
  if (ctx.mode === 'swap' && !ctx.isUpsellContext && ctx.getSelectedCard() === card) {
    await applyEffectiveChange(card, ctx);
  }

  // Debounced price refetch — each rapid click resets the timer so we only
  // hit /calculate once the user settles on a value.
  if (card.qtyDebounceTimeout !== null) clearTimeout(card.qtyDebounceTimeout);
  card.qtyDebounceTimeout = setTimeout(() => {
    card.qtyDebounceTimeout = null;
    void ctx.fetchAndUpdateBundlePrice(card);
  }, 150);

  ctx.logger.debug(`Bundle quantity changed for "${card.bundleId}"`, {
    quantity: card.bundleQuantity,
  });
}

// ─── Shipping method ──────────────────────────────────────────────────────────

export async function setShippingMethod(
  shippingId: string,
  ctx: Pick<HandlerContext, 'logger'>,
): Promise<void> {
  const id = parseInt(shippingId, 10);
  if (isNaN(id)) {
    ctx.logger.warn('Invalid shipping ID:', shippingId);
    return;
  }
  try {
    await useCartStore.getState().setShippingMethod(id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    ctx.logger.error('Failed to set shipping method:', msg);
  }
}
