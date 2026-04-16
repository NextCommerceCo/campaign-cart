import Decimal from 'decimal.js';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';
import type { BundleCard, PriceContext } from './BundleSelectorEnhancer.types';
import { getEffectiveItems } from './BundleSelectorEnhancer.state';

/**
 * Fetches the bundle-computed price for a card and writes the results directly
 * onto card.packageStates (per-item prices) and card.bundlePrice (aggregate totals).
 *
 * Slot re-rendering is NOT triggered here — the orchestrator (BundleSelectorEnhancer)
 * is responsible for calling renderSlotsForCard after this promise resolves.
 */
export async function fetchAndUpdateBundlePrice(
  card: BundleCard,
  ctx: PriceContext,
): Promise<void> {
  const items = getEffectiveItems(card);
  const currency = useCampaignStore.getState().currency ?? null;

  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const userCoupons = checkoutVouchers.filter(v => !ctx.allBundleVouchers.has(v));
    const merged = [...new Set([...card.vouchers, ...userCoupons])];
    const vouchers = merged.length ? merged : undefined;

    const result = await calculateBundlePrice(items, {
      currency,
      vouchers,
      upsell: ctx.isUpsellContext,
    });

    // Skip stale results if effective items changed while the fetch was in flight
    const currentItems = getEffectiveItems(card);
    if (
      currentItems.length !== items.length ||
      currentItems.some(
        (ci, i) =>
          ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity,
      )
    ) {
      return;
    }

    // Update per-package states with bundle-computed prices
    if (result.summary) {
      for (const line of result.summary.lines) {
        const state = card.packageStates.get(line.package_id);
        if (state) {
          const discountAmount = new Decimal(line.total_discount);
          const originalPrice = new Decimal(line.subtotal);
          const discountPercentage = originalPrice.gt(0)
            ? discountAmount.div(originalPrice).times(100)
            : new Decimal(0);
          const hasDiscount = discountAmount.gt(0);
          card.packageStates.set(line.package_id, {
            ...state,
            recurringPrice: new Decimal(line.price_recurring_total || 0),
            originalRecurringPrice: new Decimal(line.price_recurring_total || 0),
            unitPrice: new Decimal(line.package_price),
            originalUnitPrice: new Decimal(line.original_package_price),
            discountAmount,
            discountPercentage,
            originalPrice,
            price: new Decimal(line.total),
            hasDiscount,
            currency: result.currency ?? state.currency,
            discounts: line.discounts ?? [],
          });
        }
      }
    }

    // Update aggregate bundle price summary
    // result fields are Decimal instances from a live fetch, but plain
    // numbers/strings when rehydrated from the sessionStorage cache — use
    // parseFloat(String()) to handle both cases safely.
    const totalQuantity = card.slots
      .filter(s => !s.noSlot)
      .reduce((sum, s) => sum + s.quantity, 0);
    const price = new Decimal(result.total);
    const originalPrice = new Decimal(result.subtotal);
    const discountAmount = new Decimal(result.totalDiscount);
    const discountPercentage = new Decimal(result.totalDiscountPercentage);
    card.bundlePrice = {
      price,
      originalPrice,
      discountAmount,
      discountPercentage,
      unitPrice: totalQuantity > 0 ? price.div(totalQuantity) : price,
      originalUnitPrice: totalQuantity > 0 ? originalPrice.div(totalQuantity) : originalPrice,
      quantity: totalQuantity,
      hasDiscount: discountAmount.gt(0),
      currency: result.currency ?? currency ?? '',
    };

    card.offerDiscounts = result.summary?.offer_discounts ?? [];
    card.voucherDiscounts = result.summary?.voucher_discounts ?? [];

  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}
