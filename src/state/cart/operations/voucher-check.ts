import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import {
  calculateCart,
  type CalculateCartResult,
} from '@/state/cart/cart-calculator';
import { couponTexts } from '@/state/cart/coupon-texts';
import { useCheckoutStore } from '@/state/checkout';
import { normalizeVoucherCode } from '@/utils/voucher';
import { calculateTotals, cartCalculateParams } from './calculate-totals';
import { logger } from './shared';

/**
 * Whether the calculate API honours `code` on the current cart, next to the `applied`
 * codes already on it. The API ignores a code it has no offer for without flagging it,
 * and its discounts name an `offer_id`, never a code, so the only evidence is the
 * difference the code makes: a discount that is not there without it, or a lower total
 * (a shipping voucher can lower `shipping_method.price` alone).
 */
export async function voucherAddsDiscount(
  applied: string[],
  code: string
): Promise<boolean> {
  const { useCampaignStore } = await import('@/state/campaign');
  const currency = useCampaignStore.getState().currency ?? null;

  const [without, withCode] = await Promise.all([
    calculateCart(cartCalculateParams([...applied], currency)),
    calculateCart(cartCalculateParams([...applied, code], currency)),
  ]);

  const before = discountOfferIds(without);
  return (
    [...discountOfferIds(withCode)].some(id => !before.has(id)) ||
    withCode.total.lt(without.total)
  );
}

function discountOfferIds(result: CalculateCartResult): Set<number> {
  const summary = result.summary;
  return new Set(
    [
      ...(summary?.voucher_discounts ?? []),
      ...(summary?.offer_discounts ?? []),
      ...(summary?.shipping_method?.discounts ?? []),
    ].map(d => d.offer_id)
  );
}

let recheck: Promise<void> | null = null;

/**
 * Checks the codes `applyCoupon` stored unchecked on an empty cart, now that the cart
 * has lines to price them against. A code that gives no discount is taken off and
 * reported with `coupon:validation-failed`; one that could not be checked stays
 * unchecked for the next calculation to try again. Concurrent calls share one run.
 */
export function recheckUncheckedVouchers(): Promise<void> {
  recheck ??= checkEach().finally(() => {
    recheck = null;
  });
  return recheck;
}

async function checkEach(): Promise<void> {
  let removed = false;
  for (const code of useCheckoutStore.getState().uncheckedVouchers) {
    // Priced against an empty cart, every code would read as refused.
    if (useCartStore.getState().items.length === 0) break;

    const normalized = normalizeVoucherCode(code);
    const others = useCheckoutStore
      .getState()
      .vouchers.filter(v => normalizeVoucherCode(v) !== normalized);
    let accepted: boolean;
    try {
      accepted = await voucherAddsDiscount(others, code);
    } catch (error) {
      logger.warn('Failed to recheck coupon, will retry:', error);
      continue;
    }

    if (accepted) {
      useCheckoutStore.getState().markVoucherChecked(code);
      continue;
    }
    const texts = await couponTexts(normalized);
    useCheckoutStore.getState().removeVoucher(code);
    removed = true;
    EventBus.getInstance().emit('coupon:validation-failed', {
      code,
      message: texts('coupon.errors.invalid'),
    });
  }
  if (removed) calculateTotals();
}
