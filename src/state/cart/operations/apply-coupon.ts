import {
  calculateCart,
  type CalculateCartResult,
} from '@/state/cart/cart-calculator';
import { couponTexts } from '@/state/cart/coupon-texts';
import { calculateTotals, cartCalculateParams } from './calculate-totals';
import { logger } from './shared';
import { useCartStore } from '@/state/cart';
import { useCheckoutStore } from '@/state/checkout';
import { normalizeVoucherCode } from '@/utils/voucher';

export async function applyCoupon(
  code: string
): Promise<{ success: boolean; message: string }> {
  const checkoutState = useCheckoutStore.getState();

  const normalizedCode = normalizeVoucherCode(code);
  const texts = couponTexts(normalizedCode);

  // Compare normalised on both sides, not just the incoming code: a voucher
  // can also reach `vouchers` un-normalised, via bundle-selector's direct
  // `checkoutStore.addVoucher(code)` calls (bundle-configured codes are not
  // routed through this function). Comparing only `normalizedCode` against
  // raw stored entries would miss that duplicate.
  const isApplied = (vouchers: string[]): boolean =>
    vouchers.some(v => normalizeVoucherCode(v) === normalizedCode);

  if (isApplied(checkoutState.vouchers)) {
    return {
      success: false,
      message: (await texts)('coupon.errors.already_applied'),
    };
  }

  // The calculate API ignores a voucher it has no offer for without flagging
  // it, so the only evidence the code was accepted is a discount that appears
  // with it and not without it. An empty cart has no lines to price the code
  // against, so it is stored unchecked and takes effect once items arrive.
  if (useCartStore.getState().items.length > 0) {
    let accepted: boolean;
    try {
      accepted = await voucherAddsDiscount(
        checkoutState.vouchers,
        normalizedCode
      );
    } catch (error) {
      logger.error('Failed to verify coupon:', error);
      return {
        success: false,
        message: (await texts)('coupon.errors.network'),
      };
    }
    if (!accepted) {
      return {
        success: false,
        message: (await texts)('coupon.errors.invalid'),
      };
    }
    // A second apply of the same code may have resolved during the await.
    if (isApplied(useCheckoutStore.getState().vouchers)) {
      return {
        success: false,
        message: (await texts)('coupon.errors.already_applied'),
      };
    }
  }

  useCheckoutStore.getState().addVoucher(normalizedCode);
  calculateTotals();

  return { success: true, message: (await texts)('coupon.applied') };
}

async function voucherAddsDiscount(
  applied: string[],
  code: string
): Promise<boolean> {
  const { useCampaignStore } = await import('@/state/campaign');
  const currency = useCampaignStore.getState().currency ?? null;

  const [without, withCode] = await Promise.all([
    // No vouchers means no voucher discounts, so skip the request.
    applied.length > 0
      ? calculateCart(cartCalculateParams([...applied], currency))
      : null,
    calculateCart(cartCalculateParams([...applied, code], currency)),
  ]);

  const before = discountOfferIds(without);
  return [...discountOfferIds(withCode)].some(id => !before.has(id));
}

function discountOfferIds(result: CalculateCartResult | null): Set<number> {
  const summary = result?.summary;
  return new Set(
    [
      ...(summary?.voucher_discounts ?? []),
      ...(summary?.offer_discounts ?? []),
      ...(summary?.shipping_method?.discounts ?? []),
    ].map(d => d.offer_id)
  );
}
