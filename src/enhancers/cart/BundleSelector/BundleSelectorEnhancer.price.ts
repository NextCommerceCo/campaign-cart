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
    const merged = [...new Set([...userCoupons, ...card.vouchers])];
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
          const hasDiscount = parseFloat(line.total_discount) > 0;
          const hasSavings =
            line.price_retail_total != null
              ? parseFloat(line.price_retail_total) > parseFloat(line.package_price)
              : state.hasSavings;
          card.packageStates.set(line.package_id, {
            ...state,
            unitPrice: line.unit_price,
            packagePrice: line.package_price,
            originalUnitPrice: line.original_unit_price,
            originalPackagePrice: line.original_package_price,
            totalDiscount: line.total_discount,
            subtotal: line.subtotal,
            total: line.total,
            hasDiscount,
            hasSavings,
          });
        }
      }
    }

    // Update aggregate bundle price summary
    // result fields are Decimal instances from a live fetch, but plain
    // numbers/strings when rehydrated from the sessionStorage cache — use
    // parseFloat(String()) to handle both cases safely.
    card.bundlePrice = {
      total: parseFloat(String(result.total)),
      subtotal: parseFloat(String(result.subtotal)),
      totalDiscount: parseFloat(String(result.totalDiscount)),
      totalDiscountPercentage: parseFloat(String(result.totalDiscountPercentage)),
    };

  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}
