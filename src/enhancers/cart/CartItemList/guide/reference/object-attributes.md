# Object Attributes

## `item`

The data object available inside the per-item template. Access fields as `{item.fieldName}` or `{item.fieldName|currency}` for formatted prices.

### Identification

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `number` | no | Cart line ID assigned by the API. Unique per line in the current cart. |
| `packageId` | `number` | no | Campaign package `ref_id`. |
| `name` | `string` | no | Display name. Reflects title map override if configured. |
| `title` | `string` | no | Same as `name`. Alias kept for compatibility. |
| `quantity` | `number` | no | Number of packages in the cart (not product units). |
| `sku` | `string` | no | Product SKU. Empty string when not set. |
| `image` | `string` | no | Product image URL. Empty string when not set. |

### Variant

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `productId` | `number` | yes | Associated product ID. |
| `productName` | `string` | no | Product display name. Empty string when not set. |
| `variantId` | `number` | yes | Product variant ID. |
| `variantName` | `string` | no | Variant display name. Empty string when not set. |
| `variantSku` | `string` | no | Variant SKU. Empty string when not set. |
| `variantAttributesFormatted` | `string` | no | Comma-separated attribute string, e.g. `"Color: Red, Size: L"`. Empty string when no attributes. |
| `variantAttributesList` | `string` | no | Attribute values as `<span class="variant-attr">` elements. Empty string when no attributes. |
| `variantAttributes` | `array` | no | Raw attribute array: `[{ code, name, value }]`. |
| `variant{Code}` | `string` | no | Individual attribute by code, capitalized. e.g. `variantColor`, `variantSize`. |
| `variant.{code}` | `string` | no | Individual attribute by code, lowercase. e.g. `variant.color`. |
| `variantAttr.{code}` | `string` | no | Alternative accessor. e.g. `variantAttr.color`. |
| `variant_{code}` | `string` | no | Underscore accessor. e.g. `variant_color`. |

### Pricing (formatted)

Price fields contain raw numbers. Apply the `currency` formatter for display: `{item.finalPrice|currency}`.

| Field | Type | Description |
|-------|------|-------------|
| `price` | `number` | Total package price (`price_total` from campaign). |
| `unitPrice` | `number` | Per-unit price (`price_per_unit` from campaign). |
| `finalPrice` | `number` | Package price after offer discounts. Equals `price` when no discount applies. |
| `finalLineTotal` | `number` | Line total after discounts × quantity. |
| `lineTotal` | `number` | Line total before discounts. |
| `lineCompare` | `number` | Retail line total (compare-at). Zero when no savings. |
| `comparePrice` | `number` | Retail package total. Zero when no savings. |
| `unitComparePrice` | `number` | Retail per-unit price. Zero when no savings. |
| `discountAmount` | `number` | Total offer discount applied to this line. Zero when none. |
| `discountedPrice` | `number` | Package price after discounts (same as `finalPrice`). |
| `discountedLineTotal` | `number` | Line total after discounts (same as `finalLineTotal`). |
| `unitFinalPrice` | `number` | Per-unit price after discounts. |
| `savingsAmount` | `number` | Total savings vs retail line total. Zero when no savings. |
| `unitSavings` | `number` | Per-unit savings vs retail. Zero when no savings. |
| `packagePrice` | `number` | Per-unit price (alias of `unitPrice`). |
| `packagePriceTotal` | `number` | Total package price (alias of `price`). |
| `packageRetailPrice` | `number` | Retail per-unit price (alias of `unitComparePrice`). |
| `packageRetailTotal` | `number` | Retail package total. |
| `packageSavings` | `number` | Package-level savings vs retail. Zero when no savings. |
| `recurringPrice` | `number` | Recurring per-unit price. Zero when not a subscription. |
| `recurringTotal` | `number` | Recurring line total. Zero when not a subscription. |

### Pricing (raw, unformatted)

Suffix `.raw` on any price field to get the unformatted number. Use these when building custom calculations via JavaScript.

Examples: `{item.price.raw}`, `{item.finalLineTotal.raw}`, `{item.savingsAmount.raw}`.

All `.raw` variants exist for every price field listed above.

### Calculated and display fields

| Field | Type | Description |
|-------|------|-------------|
| `savingsPct` | `string` | Savings percentage as a formatted string, e.g. `"15%"`. Empty string when zero. |
| `packageSavingsPct` | `string` | Package-level savings percentage. Same value as `savingsPct`. |
| `savingsPct.raw` | `number` | Raw savings percentage integer (e.g. `15`). Zero when no savings. |
| `packageQty` | `number` | Product units per package, from the campaign (`qty`). |
| `frequency` | `string` | Billing frequency text. `"One time"` for non-recurring. `"Per month"`, `"Every 3 months"`, etc. for subscriptions. |
| `isRecurring` | `string` | `"true"` or `"false"`. |
| `hasSavings` | `string` | `"true"` or `"false"`. |
| `hasPackageSavings` | `string` | `"true"` or `"false"`. |
| `hasDiscount` | `boolean` | `true` when an offer discount is applied. |

### Conditional display helpers

These fields output `"show"` or `"hide"`. Use them as CSS class values on wrapper elements. Pair with `.hide { display: none }` in your stylesheet.

| Field | `"show"` when |
|-------|--------------|
| `showCompare` | retail savings exist |
| `showSavings` | `savingsAmount > 0` |
| `showDiscount` | offer discount applied |
| `showOriginalPrice` | offer discount applied (same as `showDiscount`) |
| `showUnitPrice` | `packageQty > 1` |
| `showUnitCompare` | `packageQty > 1` and retail savings exist |
| `showUnitSavings` | `packageQty > 1` and `unitSavings > 0` |
| `showRecurring` | subscription item |
| `showPackageSavings` | `packageSavings > 0` |
| `showPackageTotal` | `packagePrice > 0` |
| `showRecurringTotal` | subscription and `recurringTotal > 0` |
