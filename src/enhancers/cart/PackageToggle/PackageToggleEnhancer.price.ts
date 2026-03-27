import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice } from '@/utils/calculations/CartCalculator';
import type { Logger } from '@/utils/logger';
import type { ToggleCard } from './PackageToggleEnhancer.types';
import { renderTogglePrice } from './PackageToggleEnhancer.renderer';

export async function fetchAndUpdateTogglePrice(
  card: ToggleCard,
  includeShipping: boolean,
  logger: Logger,
): Promise<void> {
  const cartState = useCartStore.getState();

  if (cartState.items.some(i => i.packageId === card.packageId)) {
    if (cartState.summary) {
      const line = cartState.summary.lines.find(l => l.package_id === card.packageId) ?? null;
      renderTogglePrice(card, line);
    }
    return;
  }

  const priceSlots = card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]');
  if (priceSlots.length === 0) return;

  const cartItems = cartState.items.map(i => ({ packageId: i.packageId, quantity: i.quantity }));
  const itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: 1 }];

  const currency = useCampaignStore.getState().data?.currency ?? null;
  const checkoutVouchers = useCheckoutStore.getState().vouchers;
  const vouchers = checkoutVouchers.length ? checkoutVouchers : undefined;

  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    const { summary } = await calculateBundlePrice(
      itemsToCalc,
      { currency, exclude_shipping: !includeShipping, vouchers }
    );
    const line = summary.lines.find(l => l.package_id === card.packageId) ?? null;
    renderTogglePrice(card, line);
  } catch (error) {
    logger.warn(`Failed to fetch toggle price for packageId ${card.packageId}`, error);
    renderTogglePrice(card, null);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}
