---
title: "Features/Display/Selection Display/Display Paths"
group: "Features"
category: "Selection Display"
---

# Display Paths

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `selection.` namespace can show. Write it as `data-next-display="selection.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `selection.hasSelection` | `boolean` |  |
| `selection.packageId` | `number` |  |
| `selection.quantity` | `number` |  |
| `selection.name` | auto |  |
| `selection.price` | `currency` |  |
| `selection.total` | `currency` |  |
| `selection.compareTotal` | `currency` |  |
| `selection.unitPrice` | `currency` |  |
| `selection.savingsAmount` | `currency` |  |
| `selection.savingsPercentage` | `percentage` |  |
| `selection.hasSavings` | `boolean` |  |
| `selection.isBundle` | `boolean` |  |
| `selection.totalUnits` | `number` |  |
| `selection.monthlyPrice` | `currency` |  |
| `selection.yearlyPrice` | `currency` |  |
| `selection.pricePerDay` | `currency` |  |
| `selection.savingsPerUnit` | `currency` |  |
| `selection.discountAmount` | `currency` |  |
| `selection.price_total` | `currency` |  |
| `selection.price_retail_total` | `currency` |  |
| `selection.savings` | `currency` |  |
| `selection.pricePerUnit` | `currency` |  |
| `selection.totalQuantity` | `number` |  |
| `selection.isMultiPack` | `boolean` |  |
| `selection.isSingleUnit` | `boolean` |  |

Generated from the SDK's own routing table, so this list matches the shipped code rather than a transcription of it.
