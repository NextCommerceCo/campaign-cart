import { Decimal } from 'decimal.js';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
import type { Logger } from '@/utils/logger';
import type { SelectorItem } from '@/types/global';

export async function fetchAndUpdatePrice(
  item: SelectorItem,
  includeShipping: boolean,
  logger: Logger,
  upsell?: boolean,
): Promise<void> {
  const currency = useCampaignStore.getState().currency ?? null;
  const checkoutVouchers = useCheckoutStore.getState().vouchers;
  const vouchers = !upsell && checkoutVouchers.length ? checkoutVouchers : undefined;

  const priceSlots = item.element.querySelectorAll<HTMLElement>('[data-next-package-price]');
  if (priceSlots.length === 0) return;

  item.element.classList.add('next-loading');
  item.element.setAttribute('data-next-loading', 'true');

  try {
    const { subtotal, total } = await calculateBundlePrice(
      [{ packageId: item.packageId, quantity: item.quantity }],
      { currency, exclude_shipping: !includeShipping, vouchers, upsell }
    );

    const campaignPackages = useCampaignStore.getState().packages;
    const pkg = campaignPackages.find(p => p.ref_id === item.packageId);
    const compareD = pkg?.price_retail
      ? new Decimal(pkg.price_retail).times(item.quantity)
      : null;

    priceSlots.forEach(el => {
      const field = el.getAttribute('data-next-package-price') ?? 'total';
      switch (field) {
        case 'subtotal':
          el.textContent = formatCurrency(subtotal.toNumber());
          break;
        case 'compare':
          el.textContent = compareD ? formatCurrency(compareD.toNumber()) : '';
          break;
        case 'savings':
          el.textContent = compareD
            ? formatCurrency(compareD.minus(subtotal).toNumber())
            : '';
          break;
        case 'savingsPercentage':
          el.textContent = compareD?.gt(0)
            ? formatPercentage(compareD.minus(subtotal).div(compareD).times(100).toNumber())
            : '';
          break;
        default:
          el.textContent = formatCurrency(total.toNumber());
      }
    });
  } catch (error) {
    logger.warn(`Failed to fetch price for package ${item.packageId}`, error);
  } finally {
    item.element.classList.remove('next-loading');
    item.element.setAttribute('data-next-loading', 'false');
  }
}
