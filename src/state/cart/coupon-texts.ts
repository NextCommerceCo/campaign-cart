/**
 * What the coupon field and `next.applyCoupon` say to the shopper, by the key the
 * address-rules service serves it under (`coupon.errors.invalid`). A text comes from the
 * page's `nextConfig.translations`, then the service's texts in the form's language, then
 * the English here, which is the service's own.
 */

import {
  addressLang,
  I18nRules,
  interpolate,
  textsWithin,
  translatedText,
  type TextSource,
} from '@/core/i18n-rules';

const ENGLISH = {
  'coupon.applied': 'Coupon {{code}} applied.',
  'coupon.removed': 'Coupon {{code}} removed.',
  'coupon.errors.already_applied': 'Coupon {{code}} is already applied.',
  'coupon.errors.invalid': "Coupon {{code}} isn't valid for this order.",
  'coupon.errors.network': "Couldn't check the coupon. Try again.",
} as const;

export type CouponTextKey = keyof typeof ENGLISH;

/**
 * How long a coupon answer waits for the service's texts when nothing on the page has
 * loaded them. The shopper is waiting on the answer; past this, it is in English.
 */
const TEXTS_WAIT_MS = 1500;

/**
 * The coupon texts for `code` in the form's language, once the service's have loaded or
 * {@link TEXTS_WAIT_MS} is up. Call it before the work the answer waits on, so the two
 * load together.
 *
 * @example
 * ```ts
 * const texts = couponTexts('SAVE10');
 * (await texts)('coupon.applied'); // 'Coupon SAVE10 applied.'
 * ```
 */
export async function couponTexts(
  code: string,
  source: TextSource = I18nRules.getInstance()
): Promise<(key: CouponTextKey) => string> {
  const lang = addressLang();
  const texts = await textsWithin(source, lang, TEXTS_WAIT_MS);
  return key =>
    interpolate(translatedText(key, lang, texts) ?? ENGLISH[key], { code });
}
