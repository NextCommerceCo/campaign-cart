---
title: "Features/Display/Selection Display/Display Paths"
group: "Features"
category: "Selection Display"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `selection.` namespace can show. Write it as `data-next-display="selection.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

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
| `selection.discountAmount` | `currency` |  |
| `selection.price_total` | `currency` |  |
| `selection.price_retail_total` | `currency` |  |
| `selection.savings` | `currency` |  |
| `selection.pricePerUnit` | `currency` |  |
| `selection.totalQuantity` | `number` |  |
| `selection.isMultiPack` | `boolean` |  |
| `selection.isSingleUnit` | `boolean` |  |
| `selection.discountedPrice` | auto |  |
| `selection.finalPrice` | auto |  |
| `selection.appliedDiscountAmount` | auto |  |
| `selection.hasDiscount` | auto |  |
| `selection.discountPercentage` | auto |  |
| `selection.appliedDiscounts` | auto |  |

## Declared but not answered

`core/base/display-types.ts › PROPERTY_MAPPINGS` also lists these under `selection`, and `selection-display.enhancer.ts › SelectionDisplayEnhancer.getPropertyValue` has no answer for any of them. Writing one renders nothing — or, where the routing entry declares a fallback value, renders that fallback, which reads as though it worked.

| Path | Routed to | Write instead |
|---|---|---|
| `selection.monthlyPrice` | — | Nothing computes it. Divide an answered path with the expression form: `data-next-display="selection.{selectorId}.total/12"`. |
| `selection.yearlyPrice` | — | Nothing computes it. Multiply an answered path: `data-next-display="selection.{selectorId}.total*12"`. |
| `selection.pricePerDay` | — | Nothing computes it. Divide an answered path by the number of days: `data-next-display="selection.{selectorId}.total/30"`. |
| `selection.savingsPerUnit` | — | Use `selection.savingsAmount` for the whole selection, or divide it by `selection.totalUnits` with the expression form. |

Generated from `selection-display.enhancer.ts › SelectionDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
