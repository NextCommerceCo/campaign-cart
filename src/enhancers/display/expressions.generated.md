---
title: Display Expressions
---

# Display & Conditional Expressions

Auto-generated from `PROPERTY_MAPPINGS` in `src/enhancers/display/DisplayEnhancerTypes.ts` — do not edit by hand; run `npm run docs:expressions`.

Each row is an expression you write as `object.property`. Use it as a value in `data-next-display="…"`, or (for `boolean` rows) as a condition in `data-next-show` / `data-next-hide`. **Value type** is how the SDK formats the resolved value: the explicit `format` from the map, otherwise inferred from the property name.

## `cart.*`

| Expression | Value type |
|---|---|
| `cart.isEmpty` | `boolean` |
| `cart.hasItems` | `boolean` |
| `cart.hasDiscounts` | `currency` |
| `cart.hasShippingDiscount` | `currency` |
| `cart.quantity` | `number` |
| `cart.itemCount` | `number` |
| `cart.subtotal` | `currency` |
| `cart.total` | `currency` |
| `cart.shipping` | `currency` |
| `cart.shippingOriginal` | `currency` |
| `cart.shippingDiscountAmount` | `currency` |
| `cart.shippingDiscountPercentage` | `percentage` |
| `cart.totalDiscount` | `currency` |
| `cart.discounts` | `currency` |
| `cart.totalDiscountPercentage` | `percentage` |
| `cart.hasCoupons` | `boolean` |
| `cart.hasCoupon` | `boolean` |
| `cart.couponCount` | `number` |
| `cart.coupons[0].code` | `text` |
| `cart.coupons[1].code` | `text` |
| `cart.discountCode` | `text` |
| `cart.discountCodes` | `text` |

## `package.*`

| Expression | Value type |
|---|---|
| `package.ref_id` | `number` |
| `package.external_id` | `auto` |
| `package.qty` | `number` |
| `package.price` | `currency` |
| `package.price_total` | `currency` |
| `package.price_retail` | `currency` |
| `package.price_retail_total` | `currency` |
| `package.price_recurring` | `currency` |
| `package.is_recurring` | `boolean` |
| `package.interval` | `auto` |
| `package.interval_count` | `number` |
| `package.unitPrice` | `currency` |
| `package.unitRetailPrice` | `currency` |
| `package.packageTotal` | `currency` |
| `package.comparePrice` | `currency` |
| `package.compareTotal` | `currency` |
| `package.savingsAmount` | `currency` |
| `package.savingsPercentage` | `percentage` |
| `package.unitSavings` | `currency` |
| `package.unitSavingsPercentage` | `percentage` |
| `package.hasSavings` | `currency` |
| `package.isRecurring` | `boolean` |
| `package.isBundle` | `boolean` |
| `package.unitsInPackage` | `number` |
| `package.discountedPrice` | `currency` |
| `package.discountedPriceTotal` | `currency` |
| `package.discountAmount` | `currency` |
| `package.hasDiscount` | `currency` |
| `package.finalPrice` | `currency` |
| `package.finalPriceTotal` | `currency` |
| `package.totalSavingsAmount` | `currency` |
| `package.totalSavingsPercentage` | `percentage` |
| `package.totalSavingsWithDiscounts` | `currency` |
| `package.totalSavingsPercentageWithDiscounts` | `percentage` |
| `package.hasTotalSavings` | `currency` |

## `selection.*`

| Expression | Value type |
|---|---|
| `selection.hasSelection` | `boolean` |
| `selection.packageId` | `number` |
| `selection.quantity` | `number` |
| `selection.name` | `auto` |
| `selection.price` | `currency` |
| `selection.total` | `currency` |
| `selection.compareTotal` | `currency` |
| `selection.unitPrice` | `currency` |
| `selection.savingsAmount` | `currency` |
| `selection.savingsPercentage` | `percentage` |
| `selection.hasSavings` | `boolean` |
| `selection.isBundle` | `boolean` |
| `selection.totalUnits` | `number` |
| `selection.monthlyPrice` | `currency` |
| `selection.yearlyPrice` | `currency` |
| `selection.pricePerDay` | `currency` |
| `selection.savingsPerUnit` | `currency` |
| `selection.discountAmount` | `currency` |
| `selection.price_total` | `currency` |
| `selection.price_retail_total` | `currency` |
| `selection.savings` | `currency` |
| `selection.pricePerUnit` | `currency` |
| `selection.totalQuantity` | `number` |
| `selection.isMultiPack` | `boolean` |
| `selection.isSingleUnit` | `boolean` |

## `shipping.*`

| Expression | Value type |
|---|---|
| `shipping.isFree` | `boolean` |
| `shipping.cost` | `currency` |
| `shipping.price` | `currency` |
| `shipping.name` | `auto` |
| `shipping.code` | `auto` |
| `shipping.method` | `auto` |
| `shipping.id` | `auto` |
| `shipping.refId` | `auto` |

## `order.*`

| Expression | Value type |
|---|---|
| `order.isLoading` | `boolean` |
| `order.hasError` | `boolean` |
| `order.errorMessage` | `auto` |
| `order.id` | `auto` |
| `order.number` | `auto` |
| `order.ref_id` | `auto` |
| `order.created_at` | `date` |
| `order.total_incl_tax` | `currency` |
| `order.order_status_url` | `auto` |
| `order.is_test` | `boolean` |
| `order.supports_upsells` | `auto` |
| `order.payment_method` | `text` |
| `order.shipping_method` | `text` |
| `order.refId` | `auto` |
| `order.createdAt` | `date` |
| `order.total` | `currency` |
| `order.statusUrl` | `auto` |
| `order.isTest` | `boolean` |
| `order.supportsUpsells` | `auto` |
| `order.paymentMethod` | `text` |
| `order.shippingMethod` | `text` |
| `order.status` | `auto` |
| `order.currency` | `auto` |
| `order.testBadge` | `text` |
| `order.subtotal` | `currency` |
| `order.subtotalExclShipping` | `currency` |
| `order.total_excl_tax` | `currency` |
| `order.tax` | `currency` |
| `order.shipping` | `currency` |
| `order.shippingExclTax` | `currency` |
| `order.shippingTax` | `currency` |
| `order.discounts` | `currency` |
| `order.savings` | `currency` |
| `order.savingsAmount` | `currency` |
| `order.savingsPercentage` | `percentage` |
| `order.hasSavings` | `currency` |
| `order.customer.name` | `auto` |
| `order.customer.firstName` | `auto` |
| `order.customer.lastName` | `auto` |
| `order.customer.email` | `auto` |
| `order.customer.phone` | `auto` |
| `order.shippingAddress.full` | `text` |
| `order.shippingAddress.line1` | `text` |
| `order.shippingAddress.line2` | `text` |
| `order.shippingAddress.city` | `text` |
| `order.shippingAddress.state` | `text` |
| `order.shippingAddress.country` | `text` |
| `order.shippingAddress.zip` | `text` |
| `order.shippingAddress.postcode` | `text` |
| `order.billingAddress.full` | `text` |
| `order.billingAddress.line1` | `text` |
| `order.billingAddress.line2` | `text` |
| `order.billingAddress.city` | `text` |
| `order.billingAddress.state` | `text` |
| `order.billingAddress.country` | `text` |
| `order.billingAddress.zip` | `text` |
| `order.billingAddress.postcode` | `text` |
| `order.hasItems` | `boolean` |
| `order.isEmpty` | `boolean` |
| `order.hasShipping` | `currency` |
| `order.hasTax` | `currency` |
| `order.hasDiscounts` | `currency` |
| `order.hasUpsells` | `boolean` |
| `order.lines.count` | `number` |
| `order.lines.totalQuantity` | `currency` |
| `order.lines.upsellCount` | `number` |
| `order.lines.mainProduct` | `auto` |
| `order.lines.mainProductSku` | `auto` |
| `order.total.formatted` | `currency` |
| `order.createdAt.formatted` | `auto` |

## Conditional functions (`data-next-show` / `data-next-hide`)

These take an argument (call syntax) and return a boolean. They are evaluated by `ConditionalDisplayEnhancer` — they are **not** `data-next-display` value paths and are **not** TypeScript methods.

| Expression | Returns | Description |
|---|---|---|
| `cart.hasCoupon("CODE")` | `boolean` | True when coupon `CODE` is currently applied (matched case-insensitively). |
| `cart.hasCoupon` | `boolean` | True when **any** coupon is applied (bare form, no argument). |
| `cart.hasItem(packageId)` | `boolean` | True when the given package id is in the cart, e.g. `cart.hasItem(2)`. |
| `cart.hasItems` | `boolean` | True when the cart is not empty. |

Display values can also be combined with comparison operators in conditions, e.g. `data-next-show="cart.total > 100"` or `data-next-hide="package.qty == 1"`.
