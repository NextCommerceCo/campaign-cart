---
title: "Features/Cart/Cart Summary/Display Paths"
group: "Features"
category: "Cart Summary"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `cart.` namespace can show. Write it as `data-next-display="cart.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `cart.isEmpty` | `boolean` |  |
| `cart.hasDiscounts` | `boolean` |  |
| `cart.hasShippingDiscount` | `boolean` |  |
| `cart.itemCount` | `number` |  |
| `cart.subtotal` | `currency` |  |
| `cart.total` | `currency` |  |
| `cart.shipping` | `currency` |  |
| `cart.shippingOriginal` | `currency` |  |
| `cart.shippingDiscountAmount` | `currency` |  |
| `cart.shippingDiscountPercentage` | `percentage` |  |
| `cart.totalDiscount` | `currency` |  |
| `cart.totalDiscountPercentage` | `percentage` |  |
| `cart.isFreeShipping` | `boolean` |  |
| `cart.isCalculating` | `boolean` |  |
| `cart.shippingName` | `text` |  |
| `cart.shippingCode` | `text` |  |
| `cart.currency` | `text` |  |
| `cart.totalQuantity` | `number` |  |

## Declared but not answered

`core/base/display-types.ts › PROPERTY_MAPPINGS` also lists these under `cart`, and `cart-summary.display.ts › CartDisplayEnhancer.getPropertyValue` has no answer for any of them. Writing most of these renders nothing — except the ones marked `fallback value` in the Renders column below, which render that value instead, reading as though it worked.

| Path | Routed to | Renders | Write instead |
|---|---|---|---|
| `cart.hasItems` | `!isEmpty` | nothing | Use `cart.isEmpty`. The routing table declares the negation and the display resolver never applies it — `data-next-show="cart.hasItems"` does work, because `conditional-display` resolves conditions with its own reader. |
| `cart.quantity` | `totalQuantity` | nothing | Use `cart.totalQuantity`. |
| `cart.discounts` | `totalDiscount` | nothing | Use `cart.totalDiscount`. |
| `cart.hasCoupons` | `vouchers.length` | nothing | No `cart.` path reads vouchers. The `coupon` feature renders the applied codes into its `data-next-coupon="display"` area. |
| `cart.hasCoupon` | `vouchers.length` | nothing | Same as `hasCoupons` — use the `coupon` feature's display area. |
| `cart.couponCount` | `vouchers.length` | nothing | No `cart.` path reads vouchers. Count the rows the `coupon` feature renders. |
| `cart.coupons[0].code` | `vouchers.0` | nothing | No `cart.` path reads vouchers. The `coupon` feature lists every applied code. |
| `cart.coupons[1].code` | `vouchers.1` | nothing | No `cart.` path reads vouchers. The `coupon` feature lists every applied code. |
| `cart.discountCode` | `vouchers.0` | fallback value | No `cart.` path reads vouchers — and this one renders an empty string rather than nothing, because its routing entry declares `fallback: ''`. Use the `coupon` feature. |
| `cart.discountCodes` | `vouchers` | nothing | No `cart.` path reads vouchers. The `coupon` feature lists every applied code. |

Generated from `cart-summary.display.ts › CartDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
