---
title: "Features/Display/Order Display/Display Paths"
group: "Features"
category: "Order Display"
---

# Display Paths

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `order.` namespace can show. Write it as `data-next-display="order.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `order.isLoading` | auto |  |
| `order.hasError` | auto |  |
| `order.errorMessage` | auto |  |
| `order.id` | auto |  |
| `order.number` | auto |  |
| `order.ref_id` | auto |  |
| `order.created_at` | `date` |  |
| `order.total_incl_tax` | `currency` |  |
| `order.order_status_url` | auto |  |
| `order.is_test` | auto |  |
| `order.supports_upsells` | auto |  |
| `order.payment_method` | `text` |  |
| `order.shipping_method` | `text` |  |
| `order.refId` | auto |  |
| `order.createdAt` | `date` |  |
| `order.total` | `currency` |  |
| `order.statusUrl` | auto |  |
| `order.isTest` | auto |  |
| `order.supportsUpsells` | auto |  |
| `order.paymentMethod` | `text` |  |
| `order.shippingMethod` | `text` |  |
| `order.status` | auto |  |
| `order.currency` | auto |  |
| `order.testBadge` | `text` |  |
| `order.subtotal` | `currency` |  |
| `order.subtotalExclShipping` | `currency` |  |
| `order.total_excl_tax` | `currency` |  |
| `order.tax` | `currency` |  |
| `order.shipping` | `currency` |  |
| `order.shippingExclTax` | `currency` |  |
| `order.shippingTax` | `currency` |  |
| `order.discounts` | `currency` |  |
| `order.savings` | `currency` |  |
| `order.savingsAmount` | `currency` |  |
| `order.savingsPercentage` | `percentage` |  |
| `order.hasSavings` | auto |  |
| `order.customer.name` | auto |  |
| `order.customer.firstName` | auto |  |
| `order.customer.lastName` | auto |  |
| `order.customer.email` | auto |  |
| `order.customer.phone` | auto |  |
| `order.shippingAddress.full` | `text` |  |
| `order.shippingAddress.line1` | `text` |  |
| `order.shippingAddress.line2` | `text` |  |
| `order.shippingAddress.city` | `text` |  |
| `order.shippingAddress.state` | `text` |  |
| `order.shippingAddress.country` | `text` |  |
| `order.shippingAddress.zip` | `text` |  |
| `order.shippingAddress.postcode` | `text` |  |
| `order.billingAddress.full` | `text` |  |
| `order.billingAddress.line1` | `text` |  |
| `order.billingAddress.line2` | `text` |  |
| `order.billingAddress.city` | `text` |  |
| `order.billingAddress.state` | `text` |  |
| `order.billingAddress.country` | `text` |  |
| `order.billingAddress.zip` | `text` |  |
| `order.billingAddress.postcode` | `text` |  |
| `order.hasItems` | auto |  |
| `order.isEmpty` | auto |  |
| `order.hasShipping` | auto |  |
| `order.hasTax` | auto |  |
| `order.hasDiscounts` | auto |  |
| `order.hasUpsells` | auto |  |
| `order.lines.count` | auto |  |
| `order.lines.totalQuantity` | auto |  |
| `order.lines.upsellCount` | auto |  |
| `order.lines.mainProduct` | auto |  |
| `order.lines.mainProductSku` | auto |  |
| `order.total.formatted` | auto |  |
| `order.createdAt.formatted` | auto |  |

Generated from the SDK's own routing table, so this list matches the shipped code rather than a transcription of it.
