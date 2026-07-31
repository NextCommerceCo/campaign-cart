---
title: "Features/Cart/Cart Summary/Display Paths"
group: "Features"
category: "Cart Summary"
---

# Display Paths

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `cart.` namespace can show. Write it as `data-next-display="cart.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `cart.isEmpty` | auto |  |
| `cart.hasItems` | auto | Inverse of another value. |
| `cart.hasDiscounts` | auto |  |
| `cart.hasShippingDiscount` | auto |  |
| `cart.quantity` | auto |  |
| `cart.itemCount` | auto |  |
| `cart.subtotal` | `currency` |  |
| `cart.total` | `currency` |  |
| `cart.shipping` | `currency` |  |
| `cart.shippingOriginal` | `currency` |  |
| `cart.shippingDiscountAmount` | `currency` |  |
| `cart.shippingDiscountPercentage` | `percentage` |  |
| `cart.totalDiscount` | `currency` |  |
| `cart.discounts` | `currency` |  |
| `cart.totalDiscountPercentage` | `percentage` |  |
| `cart.hasCoupons` | `boolean` |  |
| `cart.hasCoupon` | `boolean` |  |
| `cart.couponCount` | `number` |  |
| `cart.coupons[0].code` | `text` |  |
| `cart.coupons[1].code` | `text` |  |
| `cart.discountCode` | `text` |  |
| `cart.discountCodes` | `text` |  |

Generated from the SDK's own routing table, so this list matches the shipped code rather than a transcription of it.
