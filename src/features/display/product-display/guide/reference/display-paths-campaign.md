---
title: "Features/Display/Product Display/Campaign Display Paths"
group: "Features"
category: "Product Display"
---

# Campaign Display Paths

<!-- Generated from the enhancer that resolves this namespace, plus the
     feature manifest. Do not edit by hand: change getPropertyValue or
     <feature>.manifest.ts, then run `npm run docs:reference`. -->

Every value the `campaign.` namespace can show. Write it as `data-next-display="campaign.{path}"`, with no package id in front of it — a campaign has exactly one active currency and language at a time, so there is nothing to select between.

```html
<!-- The campaign's own name, currency, and language -->
<span data-next-display="campaign.name"></span>
<span data-next-display="campaign.currency"></span>
<span data-next-display="campaign.language"></span>
```

The Format column is what you get with no `data-next-format`; set that attribute to override it. `auto` means nothing declares a format for the path, so the SDK picks one from the property name in `core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType` — it is not a promise of unformatted output. Formatting and hiding modifiers are the same for every namespace — see [display-core](../../../../display/display-core/guide/reference/attributes.md).

| Path | Format | Notes |
|---|---|---|
| `campaign.name` | auto | The campaign's display name, as configured in NextCommerce. |
| `campaign.currency` | auto | The ISO 4217 code of the currency prices are shown in on this page (e.g. `USD`) — the same value `useCampaignStore.getState().data.currency` holds. |
| `campaign.language` | auto | The BCP 47 language tag the campaign is configured for (e.g. `en`) — not the visitor's browser language. |

## Cautions

- Any other property after `campaign.` — `campaign.price`, `campaign.id`, anything not `name`/`currency`/`language` — falls through to `getCampaignProperty`'s `default` case, which logs `Unknown campaign property: {property}` and renders nothing. There is no alias to `package.` here: a per-package value needs `package.{id}.{property}` instead.

Generated from `product-display.enhancer.ts › ProductDisplayEnhancer.getPropertyValue` — the method that resolves these paths — so a name missing here is one the namespace does not answer, whatever else in the feature accepts it.
