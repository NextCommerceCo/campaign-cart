/**
 * Field mapping constants for checkout form.
 *
 * Four more maps once lived here — `COMMON_FIELD_PATTERNS`, `FIELD_NAME_MAP`,
 * `BILLING_FIELD_MAPPING` and `PAYMENT_METHOD_MAP` — none with an importer.
 * `checkout-form/method-selection.ts` carries its own local `PAYMENT_METHOD_MAP`
 * and `validation/field-labels.ts` owns the field-label wording, so keeping the
 * copies here only invited them to drift (finding 158's shape). Removed; this
 * file's history has them.
 */

import type { PaymentMethod } from '@/types/api';

/**
 * Selected payment method -> the `payment_detail.payment_method` the orders API
 * expects. The single map for every order path; anything not listed here is
 * submitted as `card_token`.
 */
export const API_PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  'credit-card': 'card_token',
  'card_token': 'card_token',
  'paypal': 'paypal',
  'apple_pay': 'apple_pay',
  'google_pay': 'google_pay',
  'klarna': 'klarna'
};

export const EXPRESS_PAYMENT_METHOD_MAP: Record<string, 'paypal' | 'apple_pay' | 'google_pay'> = {
  'paypal': 'paypal',
  'apple-pay': 'apple_pay',
  'google-pay': 'google_pay'
};