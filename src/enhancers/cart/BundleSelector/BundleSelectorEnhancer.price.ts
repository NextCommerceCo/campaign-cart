import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice, buildCartTotals } from '@/utils/calculations/CartCalculator';
import type { BundleCard, PriceContext } from './BundleSelectorEnhancer.types';

export async function fetchAndUpdateBundlePrice(
  card: BundleCard,
  ctx: PriceContext,
): Promise<void> {
  const items = ctx.getEffectiveItems(card);
  const currency = useCampaignStore.getState().currency ?? null;

  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    const allBundleVouchers = new Set(ctx.cards.flatMap(c => c.vouchers));
    const userCoupons = checkoutVouchers.filter(v => !allBundleVouchers.has(v));
    const merged = [...new Set([...userCoupons, ...card.vouchers])];
    const vouchers = merged.length ? merged : undefined;

    const { totals, summary } = await calculateBundlePrice(items, {
      currency,
      exclude_shipping: !ctx.includeShipping,
      vouchers,
    });

    // Skip stale results if effective items changed while the fetch was in flight
    const currentItems = ctx.getEffectiveItems(card);
    if (
      currentItems.length !== items.length ||
      currentItems.some(
        (ci, i) =>
          ci.packageId !== items[i].packageId || ci.quantity !== items[i].quantity,
      )
    ) {
      return;
    }

    ctx.previewLines.set(card.bundleId, summary.lines);

    // Re-render slots so per-item prices reflect the preview discounts
    if (ctx.slotTemplate) ctx.renderSlotsForCard(card);

    // Compute compareTotal from campaign retail prices so savings reflects
    // the retail/compare-at price diff, not just coupon discounts.
    const campaignPackages = useCampaignStore.getState().packages;
    const retailCompareTotal = items.reduce((sum, item) => {
      const pkg = campaignPackages.find(p => p.ref_id === item.packageId);
      if (!pkg?.price_retail) return sum;
      return sum + parseFloat(pkg.price_retail) * item.quantity;
    }, 0);

    const effectiveTotals =
      retailCompareTotal > 0
        ? buildCartTotals(summary, {
            exclude_shipping: !ctx.includeShipping,
            compareTotal: retailCompareTotal,
          })
        : totals;

    updateBundlePriceElements(card.element, effectiveTotals);
  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}

function updateBundlePriceElements(
  cardEl: HTMLElement,
  totals: {
    subtotal: { formatted: string };
    compareTotal: { formatted: string };
    totalSavings: { formatted: string };
    totalSavingsPercentage: { formatted: string };
    total: { formatted: string };
  },
): void {
  cardEl.querySelectorAll<HTMLElement>('[data-next-bundle-price]').forEach(el => {
    const field = el.getAttribute('data-next-bundle-price') || 'total';
    switch (field) {
      case 'subtotal':          el.textContent = totals.subtotal.formatted; break;
      case 'compare':           el.textContent = totals.compareTotal.formatted; break;
      case 'savings':           el.textContent = totals.totalSavings.formatted; break;
      case 'savingsPercentage': el.textContent = totals.totalSavingsPercentage.formatted; break;
      default:                  el.textContent = totals.total.formatted; break;
    }
  });
}
