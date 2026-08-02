---
title: "Features/Display/Order Display/Display Paths"
group: "Features"
category: "Order Display"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `order.` namespace can show. Write it as `data-next-display="order.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `order.isLoading` | auto |  |
| `order.hasError` | auto |  |
| `order.errorMessage` | auto |  |
| `order.number` | auto |  |
| `order.ref_id` | auto |  |
| `order.created_at` | `date` |  |
| `order.payment_method` | `text` |  |
| `order.refId` | auto |  |
| `order.createdAt` | `date` |  |
| `order.total` | `currency` |  |
| `order.statusUrl` | auto |  |
| `order.isTest` | auto |  |
| `order.supportsUpsells` | auto |  |
| `order.paymentMethod` | `text` |  |
| `order.shippingMethod` | `text` |  |
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
| `order.user` | auto |  |
| `order.user.name` | auto |  |
| `order.user.email` | auto |  |
| `order.user.firstName` | auto |  |
| `order.user.lastName` | auto |  |
| `order.user.phone` | auto |  |
| `order.user.acceptsMarketing` | auto |  |
| `order.user.language` | auto |  |
| `order.user.ip` | auto |  |
| `order.customer` | auto |  |
| `order.customer.acceptsMarketing` | auto |  |
| `order.customer.language` | auto |  |
| `order.customer.ip` | auto |  |
| `order.shippingAddress` | auto |  |
| `order.shippingAddress.name` | auto |  |
| `order.shippingAddress.phone` | auto |  |
| `order.billingAddress` | auto |  |
| `order.billingAddress.name` | auto |  |
| `order.billingAddress.phone` | auto |  |
| `order.items.count` | auto |  |
| `order.items.totalQuantity` | auto |  |
| `order.items.upsellCount` | auto |  |
| `order.items.mainProduct` | auto |  |
| `order.items.mainProductSku` | auto |  |
| `order.attribution.source` | auto |  |
| `order.attribution.utm_source` | auto |  |
| `order.attribution.medium` | auto |  |
| `order.attribution.utm_medium` | auto |  |
| `order.attribution.campaign` | auto |  |
| `order.attribution.utm_campaign` | auto |  |
| `order.attribution.term` | auto |  |
| `order.attribution.utm_term` | auto |  |
| `order.attribution.content` | auto |  |
| `order.attribution.utm_content` | auto |  |
| `order.attribution.gclid` | auto |  |
| `order.attribution.funnel` | auto |  |
| `order.attribution.affiliate` | auto |  |
| `order.attribution.hasTracking` | auto |  |

## Declared but not answered

`core/base/display-types.ts › PROPERTY_MAPPINGS` also lists these under `order`, and `order-display.enhancer.ts › OrderDisplayEnhancer.getPropertyValue` has no answer for any of them. Writing one renders nothing — or, where the routing entry declares a fallback value, renders that fallback, which reads as though it worked.

| Path | Routed to | Write instead |
|---|---|---|
| `order.id` | `order.id` | Use `order.ref_id` for the reference the API keys on, or `order.number` for the one to show a customer. `Order` declares no `id`. |
| `order.total_incl_tax` | — | Use `order.total`. |
| `order.order_status_url` | — | Use `order.statusUrl`. |
| `order.is_test` | — | Use `order.isTest`. |
| `order.supports_upsells` | — | Use `order.supportsUpsells`. |
| `order.shipping_method` | — | Use `order.shippingMethod`. |
| `order.status` | `order.status` | Nothing — the orders API sends no order status, so `Order` declares none and this path renders empty. Reaching a page with a `ref_id` already means the order was placed; use `order.isTest` to tell a test order apart, and link `order.statusUrl` for the hosted page that does show fulfilment state. |
| `order.total.formatted` | `_formatted.total` | Use `order.total`, which is currency-formatted already. |
| `order.createdAt.formatted` | `_formatted.createdAt` | Use `order.createdAt`, which is date-formatted already. |

Generated from `order-display.enhancer.ts › OrderDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
