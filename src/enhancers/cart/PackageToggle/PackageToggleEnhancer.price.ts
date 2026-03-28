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
  upsell?: boolean,
): Promise<void> {
  const priceSlots = card.element.querySelectorAll<HTMLElement>('[data-next-toggle-price]');
  if (priceSlots.length === 0) return;

  const currency = useCampaignStore.getState().currency ?? null;

  // In upsell context: calculate the package standalone with ?upsell=true.
  // In normal context: merge with current cart items so the line price is accurate.
  let itemsToCalc: { packageId: number; quantity: number }[];
  let vouchers: string[] | undefined;

  if (upsell) {
    itemsToCalc = [{ packageId: card.packageId, quantity: card.quantity || 1 }];
  } else {
    const cartState = useCartStore.getState();
    if (cartState.items.some(i => i.packageId === card.packageId)) {
      if (cartState.summary) {
        const line = cartState.summary.lines.find(l => l.package_id === card.packageId) ?? null;
        renderTogglePrice(card, line);
      }
      return;
    }
    const cartItems = cartState.items.map(i => ({ packageId: i.packageId, quantity: i.quantity }));
    itemsToCalc = [...cartItems, { packageId: card.packageId, quantity: 1 }];
    const checkoutVouchers = useCheckoutStore.getState().vouchers;
    vouchers = checkoutVouchers.length ? checkoutVouchers : undefined;
  }

  card.element.classList.add('next-loading');
  card.element.setAttribute('data-next-loading', 'true');

  try {
    const { summary } = await calculateBundlePrice(
      itemsToCalc,
      { currency, exclude_shipping: !includeShipping, vouchers, upsell }
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
