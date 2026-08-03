---
title: "Features/Display/Product Display/Display Paths"
group: "Features"
category: "Product Display"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `package.` namespace can show. Write it as `data-next-display="package.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `package.ref_id` | `number` |  |
| `package.external_id` | auto |  |
| `package.qty` | `number` |  |
| `package.price` | `currency` |  |
| `package.price_total` | `currency` |  |
| `package.price_retail` | `currency` |  |
| `package.price_retail_total` | `currency` |  |
| `package.price_recurring` | `currency` |  |
| `package.is_recurring` | auto |  |
| `package.interval` | auto |  |
| `package.interval_count` | `number` |  |
| `package.unitPrice` | `currency` |  |
| `package.unitRetailPrice` | `currency` |  |
| `package.packageTotal` | `currency` |  |
| `package.comparePrice` | `currency` |  |
| `package.compareTotal` | `currency` |  |
| `package.savingsAmount` | `currency` |  |
| `package.savingsPercentage` | `percentage` |  |
| `package.unitSavings` | `currency` |  |
| `package.unitSavingsPercentage` | `percentage` |  |
| `package.hasSavings` | auto |  |
| `package.isRecurring` | auto |  |
| `package.isBundle` | auto |  |
| `package.unitsInPackage` | `number` |  |
| `package.discountedPrice` | `currency` |  |
| `package.discountedPriceTotal` | `currency` |  |
| `package.discountAmount` | `currency` |  |
| `package.hasDiscount` | auto |  |
| `package.finalPrice` | `currency` |  |
| `package.finalPriceTotal` | `currency` |  |
| `package.totalSavingsAmount` | `currency` |  |
| `package.totalSavingsPercentage` | `percentage` |  |
| `package.totalSavingsWithDiscounts` | `currency` |  |
| `package.totalSavingsPercentageWithDiscounts` | `percentage` |  |
| `package.hasTotalSavings` | auto |  |
| `package.hasRetailPrice` | auto |  |
| `package.savingsAmount.raw` | auto |  |
| `package.savingsPercentage.raw` | auto |  |
| `package.unitPrice.raw` | auto |  |
| `package.unitRetailPrice.raw` | auto |  |
| `package.totalSavingsAmount.raw` | auto |  |
| `package.totalSavingsWithDiscounts.raw` | auto |  |
| `package.totalSavingsPercentage.raw` | auto |  |
| `package.totalSavingsPercentageWithDiscounts.raw` | auto |  |

Generated from `product-display.enhancer.ts › ProductDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
