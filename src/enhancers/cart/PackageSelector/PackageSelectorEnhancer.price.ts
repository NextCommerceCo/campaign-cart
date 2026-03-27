import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice, buildCartTotals } from '@/utils/calculations/CartCalculator';
import type { Logger } from '@/utils/logger';
import type { SelectorItem } from '@/types/global';

export async function fetchAndUpdatePrice(
  item: SelectorItem,
  includeShipping: boolean,
  logger: Logger,
): Promise<void> {
  const currency = useCampaignStore.getState().data?.currency ?? null;
  const checkoutVouchers = useCheckoutStore.getState().vouchers;
  const vouchers = checkoutVouchers.length ? checkoutVouchers : undefined;

  const priceSlots = item.element.querySelectorAll<HTMLElement>('[data-next-package-price]');
  if (priceSlots.length === 0) return;

  item.element.classList.add('next-loading');
  item.element.setAttribute('data-next-loading', 'true');

  try {
    const { totals, summary } = await calculateBundlePrice(
      [{ packageId: item.packageId, quantity: item.quantity }],
      { currency, exclude_shipping: !includeShipping, vouchers }
    );

    const campaignPackages = useCampaignStore.getState().packages;
    const pkg = campaignPackages.find(p => p.ref_id === item.packageId);
    const retailCompareTotal = pkg?.price_retail
      ? parseFloat(pkg.price_retail) * item.quantity
      : 0;

    const effectiveTotals = retailCompareTotal > 0
      ? buildCartTotals(summary, { exclude_shipping: !includeShipping, compareTotal: retailCompareTotal })
      : totals;

    priceSlots.forEach(el => {
      const field = el.getAttribute('data-next-package-price') || 'total';
      switch (field) {
        case 'subtotal':          el.textContent = effectiveTotals.subtotal.formatted; break;
        case 'compare':           el.textContent = effectiveTotals.compareTotal.formatted; break;
        case 'savings':           el.textContent = effectiveTotals.totalSavings.formatted; break;
        case 'savingsPercentage': el.textContent = effectiveTotals.totalSavingsPercentage.formatted; break;
        default:                  el.textContent = effectiveTotals.total.formatted; break;
      }
    });
  } catch (error) {
    logger.warn(`Failed to fetch price for package ${item.packageId}`, error);
  } finally {
    item.element.classList.remove('next-loading');
    item.element.setAttribute('data-next-loading', 'false');
  }
}
