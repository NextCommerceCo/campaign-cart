---
title: "Features/Display/Shipping Display/Display Paths"
group: "Features"
category: "Shipping Display"
---

# Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `shipping.` namespace can show. Write it as `data-next-display="shipping.{path}"`.

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `shipping.isFree` | auto |  |
| `shipping.cost` | auto |  |
| `shipping.price` | auto |  |
| `shipping.name` | auto |  |
| `shipping.code` | auto |  |
| `shipping.method` | auto |  |
| `shipping.id` | auto |  |
| `shipping.refId` | auto |  |
| `shipping.cost.raw` | auto |  |
| `shipping.price.raw` | auto |  |

Generated from `shipping-display.enhancer.ts › ShippingDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
