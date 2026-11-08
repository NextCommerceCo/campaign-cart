import { cents, discountPercent, format, money } from './format';
import type { CartSummary, SummaryDiscount } from './cart/types';

export type Tokens = Record<string, string>;

export function discountTokens(discount: SummaryDiscount, currency: string | undefined, locale?: string): Tokens {
  return {
    'discount.name': discount.name ?? '',
    'discount.description': discount.description ?? '',
    'discount.amount': format(money(cents(discount.amount)), currency, locale),
    'discount.percentage': discountPercent(discount.percentage, locale),
  };
}

/** A `data-next-discounts` kind's discounts: `offer`, `voucher`, or both for any other value. */
export function discountsOfKind(summary: CartSummary | undefined, kind: string | null): SummaryDiscount[] {
  if (!summary) return [];
  if (kind === 'offer') return summary.offer_discounts;
  if (kind === 'voucher') return summary.voucher_discounts;
  return [...summary.offer_discounts, ...summary.voucher_discounts];
}
