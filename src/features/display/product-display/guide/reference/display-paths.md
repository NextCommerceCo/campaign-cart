---
title: "Features/Display/Product Display/Display Paths"
group: "Features"
category: "Product Display"
---

# Display Paths

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `package.` namespace can show. Write it as `data-next-display="package.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

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

Generated from the SDK's own routing table, so this list matches the shipped code rather than a transcription of it.
