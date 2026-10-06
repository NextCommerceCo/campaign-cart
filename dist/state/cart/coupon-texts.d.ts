import { TextSource } from '../../core/i18n-rules';
declare const ENGLISH: {
    readonly 'coupon.applied': "Coupon {{code}} applied.";
    readonly 'coupon.removed': "Coupon {{code}} removed.";
    readonly 'coupon.errors.already_applied': "Coupon {{code}} is already applied.";
    readonly 'coupon.errors.invalid': "Coupon {{code}} isn't valid for this order.";
    readonly 'coupon.errors.network': "Couldn't check the coupon. Try again.";
};
export type CouponTextKey = keyof typeof ENGLISH;
export declare function couponTexts(code: string, source?: TextSource): Promise<(key: CouponTextKey) => string>;
export {};
//# sourceMappingURL=coupon-texts.d.ts.map