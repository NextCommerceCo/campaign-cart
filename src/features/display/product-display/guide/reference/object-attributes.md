---
title: "Features/Display/Product Display/Object Attributes"
group: "Features"
category: "Product Display"
---

# Object Attributes

The display path resolves against a `Package` (or the campaign). Below are the properties this enhancer exposes. Direct fields come straight off the package; calculated fields are computed by `PriceCalculator`.

## Direct package fields

The full shape is in the SDK reference: {@link index.Package | Package}. Commonly displayed:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Package display name. |
| `price` | `string` | Per-unit price. |
| `price_total` | `string` | Total package price (all units). |
| `price_retail` | `string` | Per-unit retail/compare-at price. |
| `price_retail_total` | `string` | Total retail/compare-at price. |
| `image` | `string` | Product image URL (rendered as `src` on an `<img>`). |
| `qty` | `number` | Units in the package. |
| `is_recurring` | `boolean` | Subscription package. |

## Calculated properties

| Property | Type | Nullable | Description |
|----------|------|----------|-------------|
| `savingsAmount` | `number` | no | Retail savings amount for the package. |
| `savingsPercentage` | `number` | no | Retail savings as a percentage. |
| `unitPrice` | `string` | no | Per-unit price, currency-formatted. |
| `unitRetailPrice` | `string` | no | Per-unit retail price, formatted. |
| `unitSavings` | `string` | no | Per-unit savings, formatted. |
| `unitSavingsPercentage` | `number` | no | Per-unit savings percentage. |
| `hasSavings` | `boolean` | no | `true` when retail savings exist. |
| `hasRetailPrice` | `boolean` | no | `true` when a distinct retail price is set. |
| `isBundle` | `boolean` | no | `true` when `qty > 1`. |
| `isRecurring` | `boolean` | no | `true` for subscription packages. |
| `finalPrice` / `finalPriceTotal` | `number` | no | Price after discounts (per-unit / total). |
| `totalSavingsAmount` | `number` | no | Retail savings plus any discount amount. |
| `totalSavingsPercentage` | `number` | no | Total savings as a percentage of retail (0–100). |
| `hasTotalSavings` | `boolean` | no | `true` when total savings > 0. |
| `discountAmount` / `hasDiscount` | `number` / `boolean` | no | **Currently `0` / `false`** — per-package coupon breakdown is not available client-side. |

Append `.raw` to a numeric calculated property (e.g. `savingsPercentage.raw`) to get the unformatted number.

## Campaign properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Campaign name (`campaign.name`). |
| `currency` | `string` | Active currency code (`campaign.currency`). |
| `language` | `string` | Campaign language (`campaign.language`). |
