import { useCampaignStore } from '@/stores/campaignStore';
import { useCheckoutStore } from '@/stores/checkoutStore';
import { calculateBundlePrice, CalculateCartResult } from '@/utils/calculations/CartCalculator';
import { formatCurrency, formatPercentage } from '@/utils/currencyFormatter';
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

    const result = await calculateBundlePrice(items, {
      currency,
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

    if (result.summary) ctx.previewLines.set(card.bundleId, result.summary.lines);

    // Re-render slots so per-item prices reflect the preview discounts
    if (ctx.slotTemplate) ctx.renderSlotsForCard(card);

    updateBundlePriceElements(card.element, result);
  } catch (error) {
    ctx.logger.warn(`Failed to fetch bundle price for "${card.bundleId}"`, error);
  } finally {
    card.element.classList.remove('next-loading');
    card.element.setAttribute('data-next-loading', 'false');
  }
}

function updateBundlePriceElements(
  cardEl: HTMLElement,
  calculated: CalculateCartResult,
): void {
  cardEl.querySelectorAll<HTMLElement>('[data-next-bundle-price]').forEach(el => {
    const field = el.getAttribute('data-next-bundle-price') ?? 'total';
    switch (field) {
      case 'compare': el.textContent = formatCurrency(calculated.subtotal.toNumber()); break;
      case 'savings': el.textContent = formatCurrency(calculated.totalDiscount.toNumber()); break;
      case 'savingsPercentage': el.textContent = formatPercentage(calculated.totalDiscountPercentage.toNumber()); break;
      case 'total':
      default:        el.textContent = formatCurrency(calculated.total.toNumber()); break;
    }
  });

  // Store raw numeric values for BundleDisplayEnhancer
  cardEl.setAttribute('data-bundle-price-total', calculated.total.toNumber().toString());
  cardEl.setAttribute('data-bundle-price-compare', calculated.subtotal.toNumber().toString());
  cardEl.setAttribute('data-bundle-price-savings', calculated.totalDiscount.toNumber().toString());
  cardEl.setAttribute('data-bundle-price-savings-pct', calculated.totalDiscountPercentage.toNumber().toString());

  // Notify BundleDisplayEnhancer subscribers
  cardEl.dispatchEvent(new CustomEvent('bundle:price-updated', {
    bubbles: true,
    detail: { bundleId: cardEl.getAttribute('data-next-bundle-id') ?? '' },
  }));
}
