import { cents, discountPercent, format, money } from './format';
import type { SummaryDiscount } from './cart/types';

export type Tokens = Record<string, string>;

export function discountTokens(discount: SummaryDiscount, currency: string | undefined, locale?: string): Tokens {
  return {
    'discount.name': discount.name ?? '',
    'discount.description': discount.description ?? '',
    'discount.amount': format(money(cents(discount.amount)), currency, locale),
    'discount.percentage': discountPercent(discount.percentage, locale),
  };
}
